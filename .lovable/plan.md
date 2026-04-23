

## Revisão completa do projeto — front, back e infraestrutura

Esta é uma **revisão (sem alterações)**. Lista todos os problemas encontrados, classificados por severidade e camada. No final há um plano de correção em fases para você aprovar quando quiser.

---

### 🔴 Críticos (afetam segurança, correção ou produção)

**C1. Banco — `used_nonces` tem RLS habilitado mas zero policies**
Linter aponta `RLS Enabled No Policy`. Como o stream-proxy usa `service_role`, hoje funciona, mas qualquer cliente autenticado lendo essa tabela recebe vazio. É correto manter assim; falta só a policy explícita "deny all" (boa prática de defesa em profundidade).

**C2. Banco — `user_roles` permite usuário ler outras roles além das próprias?**
Policies atuais: "Users can read own roles" (`user_id = auth.uid()`) **e** "Admins can read all roles" (`has_role(...)`). OK, mas a policy "Admins can manage roles" usa `has_role(auth.uid(), 'admin')` tanto em USING quanto WITH CHECK — isso permite que um admin promova **qualquer** usuário (incluindo a si mesmo a roles que não tem). Sem trilha de auditoria. Não é falha grave, mas vale registrar evento de mudança de role.

**C3. Auth — proteção de senha vazada desligada**
Linter `Leaked Password Protection Disabled`. Habilitar nas configs de Auth.

**C4. Edge `iptv-login` — uso de `any` e ausência de validação Zod**
Aceita `body` como `any`, sem schema. Trim/validação manual. Em produção, isso pode quebrar com payloads mal-formados.

**C5. Edge `iptv-categories` — sem auth**
A função roda com `verify_jwt = false` e expõe um proxy para qualquer servidor da allowlist. Hoje qualquer pessoa que descobrir a URL pode usar o endpoint para listar streams sem login. Deveria exigir credenciais IPTV válidas (já exige) **e** opcionalmente JWT da sessão anônima Supabase, similar ao `stream-token`.

**C6. Stream-proxy — playlist mode faz fetch sem timeout**
`await fetch(payload.u, ...)` na rota de playlist não tem `AbortController`. Se o upstream travar, o worker fica preso até o limite do Deno. Em alta carga isso esgota workers.

**C7. Player — `stall_timeout` ainda dispara antes de `stream_no_data` em alguns casos**
Olhando os logs reais (eventos das últimas 24h):
- `bootstrap_timeout_12s` + "manifest carregado, mas sem frames" → 7 ocorrências
- `bootstrap_timeout_12s` + "sem reprodução após 12s" → 6 ocorrências
- `stream_no_data` → 8 ocorrências

A condição em `bootstrap_timeout` (linha 275-282 do `Player.tsx`) reclassifica para `stream_no_data` apenas se `fragLoadErrorCountRef.current > 0` no momento do timeout. Mas no log que você mostrou antes, o 1º `fragLoadError` chega em ~12.3s (depois do timeout às 12.0s). Resultado: meia segunda em "stall_timeout" antes de virar "stream_no_data". Bug cosmético confirmado.

---

### 🟡 Importantes (degradam UX ou observabilidade)

**A1. Console — warnings de `forwardRef` em 3 componentes**
`CategoryFilter`, `Player`, `ChannelSidebar` recebem `ref` implícito do React DevTools/StrictMode mas não são `forwardRef`. Não quebra nada, mas polui o console. Solução: envolver com `forwardRef` ou ignorar (são function components consumindo state interno apenas).

**A2. `iptv-login` — armazena senha em texto puro no `localStorage` via `IptvProvider`**
A senha do IPTV é serializada inteira em `localStorage`. Qualquer XSS exfiltra. Mitigações: (a) cifrar com chave derivada da sessão Supabase, ou (b) trocar por um token opaco emitido pelo backend.

**A3. `Live.tsx` — usa `session!.creds` (non-null assertion)**
Tecnicamente seguro porque está dentro de `<ProtectedRoute>`, mas se alguém remover o guard a página crasha. Deveria ter um early return defensivo.

**A4. Player — timer de heartbeat (45s) continua disparando depois de erro fatal**
Em `start()`, o `setInterval` de heartbeat é armado **antes** do HLS bootar. Em `teardown()` ele é limpo, mas se o catch do `start()` (linha 491) for atingido, o heartbeat já pode não ter sido criado **ou** ter sido criado e o intervalo depende do teardown subsequente. O fluxo atual está correto, mas frágil — vale mover o heartbeat para dentro do `onPlaying` (só quando há reprodução real).

**A5. `Movies.tsx` e `Highlights.tsx` — slice fixo `.slice(0, 120)` / `.slice(0, 12)`**
Sem paginação. Para usuários com 50k filmes, há filtragem completa em memória a cada keystroke. A `useQuery` com `staleTime: 5min` ajuda, mas a UX de busca trava em listas grandes. Falta debounce + virtualização.

**A6. Stream-proxy — playlist parsing não trata `EXT-X-MEDIA URI` separadamente**
A regex `URI="..."` casa também em tags como `#EXT-X-MEDIA:URI=...` (alternate audio/video tracks). OK, mas o parser não diferencia stream de áudio (que talvez devesse usar TTL maior). Não bloqueia uso, é só refinamento.

**A7. Telemetria — `stream_started` 31 vs `token_issued` 62**
50% dos tokens emitidos não viram playback. Já melhoramos com TTL ampliado, mas vale instrumentar `manifest_parsed_event` no backend (hoje só temos client-side) para distinguir "token nunca usado" de "manifesto baixado mas falhou".

---

### 🟢 Menores (qualidade, dívida técnica)

**Q1. Múltiplos arquivos usam `any`**: `iptv-login` e `iptv-categories` têm `body: any`, `data: any`, etc. Trocar por `unknown` + validação.

**Q2. `IptvContext.tsx` exporta `useIptv` re-exportado** de outro arquivo — válido, mas confunde rastreamento. Manter um único ponto de export.

**Q3. `tailwind.config.lov.json`** está duplicado com `tailwind.config.ts`. Provavelmente artefato; conferir se precisa.

**Q4. `Index.tsx` renderiza `<Header />` próprio enquanto outras rotas usam `WithChrome` em `App.tsx`**. Inconsistência: home tem dupla camada.

**Q5. `_shared/stream-token.ts`** — `cachedKey` é módulo-escopo e nunca invalidado. Se o secret rotacionar, o worker fica com chave velha até reboot. Não é crítico (Edge Functions reiniciam).

**Q6. `getQueueStats` / `connectivityConfig`** em `services/iptv.ts` exporta APIs internas (debug helpers). Tudo bem em dev, mas em produção expõe área de ataque para tampering via DevTools. Considerar remover do build de produção.

**Q7. Migrations** — não há índice em `stream_events(event_type, created_at)` nem em `stream_events(anon_user_id, event_type)`. Com o volume crescendo (76 `token_rejected` em 2h), queries de admin vão lentificar.

**Q8. `stream-proxy` + `stream-token` — duplicação do `corsFor`**, `isPrivateHost`, etc. Bom candidato a consolidar em `_shared/`.

**Q9. `Player.tsx` — 965 linhas em um único componente.** Painel de logs, watchdogs, lógica HLS, UI de erro — tudo junto. Vale extrair `usePlayerLogs`, `usePlayerWatchdogs`, `<PlayerErrorOverlay/>`, `<PlayerLogsPanel/>`.

**Q10. `ProtectedRoute`** verifica apenas `session` do `IptvContext`, não a sessão do Supabase Auth. Se a sessão Supabase expirar, o usuário continua "logado" no front mas todas as chamadas a `stream-token` falham com 401 silenciosamente. Falta sincronização.

---

### 📊 Estado atual confirmado via banco (últimas 24h)

| Métrica | Valor |
|---|---|
| `token_issued` | 62 |
| `stream_started` | 31 (50% conversão) |
| `stream_error` | 25 |
| `token_rejected` | 76 (59 expired, 17 nonce_replay) |
| `nonce_replay_tolerated` | 2 |
| `segment_request` | 2 (sample 5%) |

Top hosts com `stream_no_data`: **`cinemaplaypro.shop`** (5/8). Confirma que o problema é majoritariamente upstream em provedores específicos.

---

### Plano de correção recomendado (em fases — aprove quando quiser)

**Fase 1 — Segurança (alta prioridade)**
- C1: Adicionar policy explícita "deny all" em `used_nonces`
- C3: Habilitar Leaked Password Protection
- C5: Exigir JWT em `iptv-categories`
- C6: AbortController/timeout no fetch upstream do stream-proxy
- A2: Plano de mitigação para senha em localStorage

**Fase 2 — Correção do bug do flicker (UX)**
- C7: Quando `manifestReadyRef === true` no bootstrap timeout, aguardar mais 2s antes de classificar (espera o 3º fragLoadError). Ou disparar `stream_no_data` no 1º fragLoadError pós-manifest com `manifestReadyRef === true`.
- A1: Resolver warnings de forwardRef
- Q10: Sincronizar sessão Supabase com IptvContext

**Fase 3 — Performance e observabilidade**
- A5: Debounce da busca + virtualização das listas grandes
- A7: Logar `manifest_event` no backend
- Q7: Índices nas tabelas `stream_events`
- Q6: Esconder helpers de debug em prod

**Fase 4 — Qualidade de código**
- Q9: Refatorar `Player.tsx` em hooks/componentes menores
- Q1, Q4, Q8: Limpeza de `any`, consolidar headers, padronizar `WithChrome`

---

### Não há mudanças neste passo
Esta é uma revisão. Aprove a fase que quer atacar primeiro (1, 2, 3 ou 4) ou peça itens específicos por código (C1, A2, etc.) e eu implemento.

