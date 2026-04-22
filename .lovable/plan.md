

## Relatório de investigação backend — `fragLoadError` e `stream_no_data`

### O que os logs do backend mostram (últimas 2h)

| Evento | Total |
|---|---|
| `token_issued` | 53 |
| `stream_started` | 30 (≈ **57% dos tokens viram playback**) |
| `stream_error` | 20 (≈ **38%**) |
| `token_rejected` | **76** ← muito alto |
| `nonce_replay_tolerated` | 2 |

**Quebra dos `token_rejected`:**
- `expired` → **59** (78%)
- `nonce_replay` → **17** (22%)

**Quebra dos `stream_error`:**
- `bootstrap_timeout_12s` + “manifest carregado, mas sem frames” → 7
- `bootstrap_timeout_12s` + “sem reprodução após 12s” → 6
- `fragLoadError + no frames` (`stream_no_data`) → 3
- vazio → 4

### Diagnóstico real

1. **Não é o `stream-proxy` quem está derrubando os segmentos.** A função do proxy para segmentos é apenas emitir um `302` para o upstream — o player baixa direto do `cinemaplaypro.shop`. O `fragLoadError` está acontecendo entre o navegador do cliente e o servidor IPTV, **não** dentro da nossa Edge Function.

2. **Há um problema sério, porém, ao redor dos tokens:**
   - **59 tokens expirados** em 2h. O TTL do segmento é 30s e o do playlist é 60s. Tantos `expired` indicam que tokens estão sendo gerados, ficando guardados (pelo `hls.js` ou por re-tentativas) e depois reusados quando já passaram do prazo.
   - **17 `nonce_replay`**. Isso é o `hls.js`/Chrome retentando o mesmo segmento. A janela atual de tolerância é de 10s, mas a duração do TTL do segmento também é 30s — quando há retry tardio, o nonce já foi consumido E o token ainda é válido, mas o reuse é negado.

3. O canal `318693` (cinemaplaypro.shop) **claramente está com problema upstream**: o manifesto vem (`#EXTM3U` ok), mas os segmentos `.ts` não respondem. Não dá para resolver isso no nosso backend — é o servidor do provedor.

4. **Mas nossa rejeição agressiva de tokens piora o cenário**: quando o player tenta retomar, recebe `403` em vez de uma chance de baixar. Isso amplifica a percepção de “canal travado” mesmo em canais cuja origem está OK.

### Plano de correção

#### 1. `stream-token` — separar TTL de playlist vs. segment
- Aumentar `TTL_SEGMENT_S` de 30s para **45s**. O `hls.js` faz retries com backoff e às vezes leva 20–30s para reusar o token; 30s é apertado demais.
- Manter `TTL_PLAYLIST_S` em 60s.

#### 2. `stream-proxy` — ampliar janela de tolerância de nonce
- Hoje: nonce single-use, com replay tolerado em 10s.
- Mudar para **30s**, alinhado ao TTL do segmento.
- Justificativa: a checagem de `ip_prefix + ua_hash + user_id` já garante que o replay não pode ser cross-user; permitir replay dentro do TTL do próprio segmento é seguro e elimina os 17 `nonce_replay` legítimos.

#### 3. `stream-proxy` — não rejeitar token expirado por margem de relógio
- Adicionar **2s de skew** ao checar `payload.e * 1000 < Date.now()`.
- Reduz `expired` em casos de retry borderline.

#### 4. Telemetria adicional no backend
- Registrar evento novo `segment_request` quando o stream-proxy recebe um segmento válido. Hoje só vemos `token_issued`, sem visibilidade do que efetivamente chegou a ser entregue.
- Registrar `meta.host` (host upstream) nos `stream_error` para conseguirmos identificar provedores problemáticos no futuro.

#### 5. Frontend — ajuste pequeno no `Player.tsx`
- Quando classificar como `stream_no_data`, incluir no `reportStreamEvent` o `host` extraído da URL original (não do proxy), para que a telemetria do passo 4 seja útil.
- Nenhuma mudança de comportamento de UI.

### O que **não** muda
- Nenhuma mudança em RLS, autenticação, lógica de bloqueio de IP, fila global, máquina de diagnóstico do player ou UI do cartão `stream_no_data`.
- Nenhuma migração de schema (todos os eventos já cabem no `stream_events.meta`).

### Arquivos a alterar
- `supabase/functions/stream-token/index.ts`
- `supabase/functions/stream-proxy/index.ts`
- `src/components/Player.tsx` (apenas linha de telemetria)

### Resultado esperado
- Queda significativa de `token_rejected:expired` e `nonce_replay`.
- Canais cujo upstream funciona param de virar `stream_no_data` por culpa de retry barrado.
- Canais cujo upstream realmente está caído continuam classificados corretamente, mas agora teremos o `host` registrado para análise futura.
- Conclusão sobre `cinemaplaypro.shop`/canal `318693`: as correções **não vão fazer esse canal específico voltar** — o problema é do servidor IPTV. Mas vamos eliminar os falsos positivos em outros canais.

