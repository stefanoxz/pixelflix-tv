# Acelerar fallback automático de proxy no Player

Apenas ajustar duas constantes em `src/components/Player.tsx`. Nenhuma alteração arquitetural, de cache, TTL, backend ou logs.

## Mudanças

**Arquivo:** `src/components/Player.tsx`

### 1. Watchdog de loadeddata: 6s → 4s (linha 241)

```ts
// antes
const LOADEDDATA_WATCHDOG_MS = 6_000;

// depois
const LOADEDDATA_WATCHDOG_MS = 4_000;
```

Comentário acima também atualizado de "6s" para "4s".

### 2. Threshold de fragLoadError: 2 → 1 (linhas 315-317)

```ts
// antes
// Reduzido de 3 → 2: 2 fragLoadError seguidos antes do primeiro frame já
// indicam bloqueio de segmento (o auto-fallback ativa o proxy do host).
const FRAG_LOAD_ERROR_THRESHOLD = 2;

// depois
// Reduzido para 1: o primeiro fragLoadError antes do primeiro frame já
// indica bloqueio de segmento — ativa o proxy do host imediatamente.
const FRAG_LOAD_ERROR_THRESHOLD = 1;
```

### 3. Item 3 da spec — já fica satisfeito automaticamente

A lógica em `Player.tsx:1201-1209` é:

```ts
if (
  !playbackStartedRef.current &&
  manifestReadyRef.current &&
  fragLoadErrorCountRef.current >= FRAG_LOAD_ERROR_THRESHOLD
) {
  // ...
  if (tryActivateProxyAndRestart(reason)) return;
}
```

Com `THRESHOLD = 1`, essa condição passa a disparar no primeiro `fragLoadError` ocorrido antes de qualquer `loadeddata` — exatamente o comportamento pedido. Nenhum código adicional necessário.

## O que NÃO muda

- `getHostProxyMode` / `markHostProxyRequired` / cache localStorage (`iptv.proxy.host:*`)
- `PROXY_HOST_TTL_MS` (30 min)
- `tryActivateProxyAndRestart` (guardas anti-loop continuam intactas)
- Logs (`segment_proxy_mode`, `proxy_required_activated`, `frag_load_error_count`)
- Edge functions (`stream-proxy`, `stream-token`, `iptv-login`)
- Banco, autenticação, UI

## Resultado esperado

| Cenário | Antes | Depois |
|---|---|---|
| Manifest OK + 0 frames | fallback em 6s | fallback em **4s** |
| Manifest OK + fragLoadError | fallback após 2 erros (~6-10s) | fallback no **1º erro (~2-4s)** |

Tempo total até começar a tocar via proxy em servidores bloqueados: ~3-5s (vs ~8-12s anteriores).

## Risco

`THRESHOLD = 1` torna o sistema mais sensível a erros transitórios (1 segmento que falhou por jitter pode ativar o proxy). Mitigações já existentes:

- Fallback só dispara antes do **primeiro frame** (`!playbackStartedRef.current`) — uma vez tocando, fragLoadError é tratado pelos retries normais do HLS.js.
- Cache de host expira em 30min — se o proxy foi ativado por engano, na próxima sessão volta a tentar direto.
- `proxyAutoRestartedRef` garante uma única tentativa de fallback por sessão de play.

Considerando que o fallback só roda durante o bootstrap e tem TTL curto, o trade-off vale a pena pela melhoria de UX em servidores realmente bloqueados.
