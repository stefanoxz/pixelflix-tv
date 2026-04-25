# Plano: habilitar autenticação na DNS BLACK (`bkpac.cc`) e robustecer player

## Status atual (já implementado)

1. **DNS escondida do cliente** ✅ — login só pede usuário/senha; admin cadastra DNS em `allowed_servers`. Quando o usuário não envia `server`, a edge tenta todas as DNS cadastradas.
2. **Proxy interno do player** ✅ — `stream-proxy` edge function + `requestStreamToken()` + `proxyUrl()` no frontend. HLS, segmentos `.ts` e VOD passam por ele.
3. **HTTP-first com fallback HTTPS** ✅ — `buildVariants()` na edge tenta `http://` antes de `https://` e ainda testa portas 80/8080/8000/443.
4. **Fallback `.ts` ↔ `.m3u8`** ✅ — `Player.tsx` cria mpegts.js apontando para `.ts`; em erro, recria automaticamente em `.m3u8`.
5. **mpegts.js + hls.js** ✅ — engines disponíveis, troca automática no erro.

## O que falta para o cenário BLACK funcionar

O bloqueio relatado em `bkpac.cc` (e antes em `assistz.top`) acontece em duas camadas:

### A. Login não passa porque a DNS não está cadastrada

A allowlist hoje exige cadastro prévio. Cliente não consegue logar em uma DNS nova como `bkpac.cc` enquanto o admin não rodar “Cadastrar DNS”.

**Ação**: garantir que `bkpac.cc` (e variações `http://bkpac.cc`, `bkpac.cc:80`, `bkpac.cc:8080`) seja cadastrada via tela `/admin` → DNS / Servidores → "Cadastrar DNS". *Esse passo é manual do admin, não muda código.*

### B. Quando a DNS responde só em portas/protocolos atípicos

Hoje `buildVariants()` testa `http://host`, `https://host`, `http://host:80`, `http://host:8080`, `http://host:8000`, `https://host:443`. Faltam portas que painéis BLACK costumam usar (`2052`, `2082`, `2086`, `2095`, `8880`).

**Ação**: ampliar `buildVariants()` na edge `iptv-login` e em `buildClientVariants()` no frontend para incluir essas portas, **somente quando o usuário não informou porta**. Mantém ordem: HTTP primeiro, HTTPS depois.

### C. Reportar erro real em vez de "DNS não resolveu"

Quando todas as variantes caem em TLS/connect refused, a mensagem confunde. Já refinei o `classifyReason()` no plano anterior; preciso aplicá-lo de fato.

**Ação**: aplicar a classificação refinada (`SERVER_UNREACHABLE` com texto "Servidor IPTV recusou conexão (TLS/porta inválida)..." em vez de `DNS_ERROR`).

### D. Player: ordem de tentativa para canal ao vivo

`buildLiveStreamUrl()` hoje sempre devolve `.m3u8`. O Player tenta `.ts` primeiro só dentro do mpegts.js. Para painéis BLACK que entregam melhor em `.ts`, isso já funciona — *nenhuma mudança necessária*.

### E. Proxy: forwarding de Range / headers para `.ts` BLACK

`stream-proxy` já existe; não vou tocar a menos que o teste com `bkpac.cc` mostre falha específica de header.

## Arquivos que vou alterar

1. `supabase/functions/iptv-login/index.ts`
   - Ampliar `buildVariants()` com portas extras (`2052`, `2082`, `2086`, `2095`, `8880`).
   - Aplicar `classifyReason()` refinado: separar TLS/connect (SERVER_UNREACHABLE) de DNS real.

2. `src/services/iptv.ts`
   - Ampliar `buildClientVariants()` espelhando as mesmas portas — para o login direto via browser também tentar.
   - Atualizar `messageForLoginCode()` se necessário (já mapeia SERVER_UNREACHABLE).

3. *(Nada em UI, parser M3U, banco, sessão.)*

## Não vou alterar

- Banco / RLS / tabelas.
- Sessão / autenticação Supabase.
- UI da tela de login (campo de DNS continua escondido).
- Parser M3U.
- Edge `stream-proxy` (já cobre o caso).
- Player.tsx (fallback `.ts` ↔ `.m3u8` já funciona).

## Resultado esperado

- Admin cadastra `bkpac.cc` em DNS / Servidores.
- Cliente entra com usuário/senha.
- Edge testa portas extras automaticamente; uma delas responde.
- Login OK → categorias e canais carregam.
- Reprodução passa por `stream-proxy` + mpegts.js (.ts) com fallback HLS.
- Mensagens de erro deixam claro se é DNS, porta/TLS ou credenciais.
