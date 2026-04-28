## Objetivo

Reduzir o número de canais que morrem com `stream_no_data` no primeiro 404 de fragmento. Os logs mostram canais (`A&E HD`, `ADULT SWIM`, `Southampton x Ipswich`) caindo todos com o mesmo padrão: manifest carrega ok, primeiro `.ts` dá 404 no upstream `spclick.shop`, player desiste imediatamente.

## Causa raiz

1. **`FRAG_LOAD_ERROR_THRESHOLD = 1`** em `src/components/Player.tsx`: o player declara `stream_no_data` na primeira falha de fragmento, sem deixar o hls.js (que tem `fragLoadingMaxRetry: 8`) tentar o próximo segmento. Painéis IPTV frequentemente têm 1-2 segmentos furados na borda do sliding window do HLS — eles se autocorrigem se a gente não desistir.

2. **`SEGMENT_FETCH_TIMEOUT_MS = 8_000`** em `supabase/functions/stream-proxy/index.ts`: 8s é apertado pra alguns painéis lentos. Logs da edge mostram `TimeoutError: Signal timed out` recorrente.

## O que fazer

1. **`src/components/Player.tsx`** — subir `FRAG_LOAD_ERROR_THRESHOLD` de `1` → `3`. Atualizar o comentário explicando o porquê (deixar hls.js pular fragmentos ruins isolados antes de declarar morte).

2. **`supabase/functions/stream-proxy/index.ts`** — subir `SEGMENT_FETCH_TIMEOUT_MS` de `8_000` → `12_000` ms pra dar margem em painéis lentos. Redeploy automático da edge function.

## O que NÃO muda

- `fragLoadingMaxRetry`, `levelLoadingMaxRetry` e demais configs do hls.js continuam como estão (já estão bons em 8-10).
- Nenhuma mudança em token, autenticação, ou lógica do proxy — só a janela de timeout.
- Se o canal estiver realmente offline (todos os fragmentos 404), o player ainda vai cair em `stream_no_data` depois de 3 tentativas — só não vai mais cair no primeiro tropeço.