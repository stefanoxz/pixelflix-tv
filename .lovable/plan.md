# Causa raiz: token de playlist expira em 60s

## O que os logs provaram

```
+0s    setup OK
+5s    primeiro frame (TTFF=4818ms) ✅
+5s..+60s  reprodução perfeita, 6 segmentos baixados, buffer 30s ✅
+64s   💥 PRIMEIRO 403 ao buscar playlist (refresh) — token expirou
+66s, +68s, +72s, +80s... 403, 403, 403, 403...
+84s   buffer drena pra 0.04s — vídeo trava
+104s  stall_timeout
... 60+ erros 403 nos 4 minutos seguintes
```

Decodifiquei o token na URL: `e:1777092867` = TTL de exatamente **60 segundos**.

O 403 vem da nossa edge `stream-proxy`, NÃO do servidor IPTV. Quando o `hls.js` faz refresh da playlist em live (toda ~10s), reusa a URL do `<source>` que contém o token original. Após 60s, todos os refreshes dão 403.

## A correção

Subir o TTL da playlist em 2 lugares:

### 1. `supabase/functions/stream-token/index.ts` (linha 66)
```diff
- const TTL_PLAYLIST_S = 60;
+ const TTL_PLAYLIST_S = 1800;  // 30 minutos
```

### 2. `supabase/functions/stream-proxy/index.ts` (linha 436)
Mesma constante repetida pra nested playlists (master → variant). Subir de 60s → 1800s também.

## Por que 30min é seguro

O token continua amarrado a:
- **session_id** do JWT (`s`)
- **IP /24** (`i`)
- **UA hash** (`h`)
- **Assinatura HMAC** (`STREAM_PROXY_SECRET`)

TTL longo NÃO dá privilégio adicional — só alarga a janela em que a mesma sessão pode reusar o token. Cliente já chama `/stream-token` toda vez que troca de canal, então a janela efetiva por canal continua bem limitada na prática.

`TTL_SEGMENT_S` (45s) fica como está — segmentos têm rotatividade alta e curtos por design.

## O que NÃO faço agora

- Refresh automático de token em 403 (defesa em profundidade) — fica como melhoria futura, não é necessária pra resolver o problema imediato
- Mexer em rate limits (`RATE_REQ_PER_MIN=60`) — não é gargalo aqui

## Resultado esperado

- Canais que travavam após ~1min agora aguentam ≥30min sem token expiry
- 99% dos 403 que você está vendo somem
- Ainda haverá quedas reais (server IPTV 503, IP block) mas não esses 403 sintéticos nossos
- Zero impacto no TTFF, zero impacto em segurança

## Deploy

Após edit, deploy automático das 2 edge functions: `stream-token` e `stream-proxy`. Sem migration, sem secret novo, sem mudança no frontend.
