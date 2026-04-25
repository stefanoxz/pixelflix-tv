# Aprendizado por host + escolha automática de engine

Adicionar duas camadas de inteligência no Player IPTV — sem mexer em backend, token, TTL de proxy ou anti-loop.

---

## PARTE 1 — Estatísticas por host (`src/services/iptv.ts`)

Adicionar após `clearHostProxyMode` (~linha 1365):

```ts
const HOST_STATS_PREFIX = "iptv.host.stats:";
const MAX_SCORE = 10;
const DECAY_WINDOW = 24 * 60 * 60 * 1000; // 24h

export interface HostStats {
  success: number;
  fail: number;
  lastFailAt?: number;
  lastSuccessAt?: number;
}

// Helpers internos: applyDecay, saveHostStats (com clamp em MAX_SCORE)

export function getHostStats(url): HostStats { ... }
export function markHostSuccess(url): void { ... }
export function markHostFailure(url, reason?): void {
  // Filtro: só conta se reason inclui frag|no_data|network|rst
}
export function shouldUseProxy(url): boolean {
  return stats.success - stats.fail <= -2;
}
```

Detalhes:
- Reusa `hostFromUrl()` interno do arquivo (recebe URL completa, extrai hostname).
- **Decay**: a cada `getHostStats`, se passou >24h da última falha/sucesso, decrementa 1 daquele contador. Garante que histórico antigo perde peso.
- **Clamp**: `success`/`fail` nunca passam de 10 (evita explosão e mantém recuperação rápida).
- **Filtro de falha real**: `markHostFailure` só conta se o reason mencionar `frag`, `no_data`, `network`, ou `rst` — assim erros de codec/usuário não pesam.
- **Threshold `≤ -2`**: precisa 2 falhas líquidas a mais que sucessos antes de forçar proxy (mais conservador que `< -1`).

---

## PARTE 2 — Engine preference reutilizando o que já existe

**O Player já tem** `getPreferredEngine`/`setPreferredEngine` em `Player.tsx:35-48` usando a chave `player.engine.host:<host>`. Para evitar duplicação e manter retrocompatibilidade, **vou reusar essas funções** em vez de criar `iptv.engine.host:` novos em `iptv.ts`.

A spec pede `EnginePreference = "hls" | "mpegts"`, mas o Player suporta também `"external"`. Solução: as funções existentes já retornam `PlaybackEngine | null`, e o subconjunto `"hls" | "mpegts"` é compatível — basta usá-las nos novos pontos de integração.

**Nada novo em `iptv.ts` para engine.** A engine continua em `Player.tsx`.

---

## PARTE 3 — Integração no Player (`src/components/Player.tsx`)

### 3a. Imports (linhas 64-75)

Adicionar `markHostSuccess`, `markHostFailure`, `shouldUseProxy` aos imports de `@/services/iptv`.

### 3b. Decisão inicial de proxy (linha 623)

Substituir:

```ts
segmentModeRef.current = getHostProxyMode(rawUrl ?? src);
```

por:

```ts
const decisionUrl = rawUrl ?? src;
segmentModeRef.current = shouldUseProxy(decisionUrl)
  ? "stream"
  : getHostProxyMode(decisionUrl);
```

Engine: a inicialização e re-sincronização por host já existem (linhas 384-400) usando `getPreferredEngine` local — **continuam funcionando como estão**, e agora ganham um novo ponto de gravação automática (3c e 3d abaixo).

### 3c. Marcar sucesso (em `onPlaying` e `onLoadedData`, ~linhas 1407-1442)

Dentro do bloco `if (wasFirst) { ... }` das duas funções, adicionar:

```ts
markHostSuccess(rawUrl ?? src);
setPreferredEngine(safeHostFromUrl(rawUrl ?? src), engine);
```

`wasFirst` garante que só conta uma vez por sessão de play. A gravação da engine **persiste a engine que efetivamente funcionou** — assim, se o usuário (ou o fallback automático de 3e) mudou para mpegts e o canal voltou a tocar, mpegts vira o default desse host.

### 3d. Marcar falha em `tryActivateProxyAndRestart` (~linhas 727-749)

Adicionar antes de `markHostProxyRequired`:

```ts
const url = rawUrl ?? src;
markHostFailure(url, reason);
if (!markHostProxyRequired(url, reason)) return false;
```

`reason` aqui é uma das strings: `"no_loadeddata_6s"`, `"fragLoadError + no frames"`, ou similares — todas casam com o filtro de `markHostFailure`.

### 3e. Fallback automático HLS → MPEG-TS (antes de ativar proxy)

Em `tryActivateProxyAndRestart`, **antes** de marcar proxy required, dar uma chance ao motor mpegts:

```ts
const tryActivateProxyAndRestart = (reason: string): boolean => {
  if (segmentModeRef.current === "stream") return false;
  if (proxyAutoRestartedRef.current) return false;

  const url = rawUrl ?? src;

  // Em canais ao vivo, antes de ir pro proxy, tentar trocar HLS → MPEG-TS
  // (uma única vez). Se o host já tem mpegts como preferência, pula direto.
  if (
    isLive &&
    engine === "hls" &&
    !engineAutoSwitchedRef.current
  ) {
    engineAutoSwitchedRef.current = true;
    markHostFailure(url, reason);
    setPreferredEngine(safeHostFromUrl(url), "mpegts");
    pushLog({
      source: "diag",
      level: "warn",
      label: "engine_auto_switch",
      details: `hls → mpegts (${reason})`,
    });
    setEngine("mpegts");
    setError(null);
    setLoading(true);
    updateStatus("connecting", `engine auto: ${reason}`);
    return true; // bloqueia o caller para não cair no setError
  }

  // Caminho original: ativa proxy
  markHostFailure(url, reason);
  if (!markHostProxyRequired(url, reason)) return false;
  proxyAutoRestartedRef.current = true;
  // ... resto inalterado
};
```

Adicionar o ref novo no topo do componente (próximo a `proxyAutoRestartedRef`):

```ts
const engineAutoSwitchedRef = useRef(false);
```

E **resetar** no listener de troca de canal (linha ~398, junto com `proxyAutoRestartedRef.current = false`):

```ts
engineAutoSwitchedRef.current = false;
```

Isso garante:
- 1 troca de engine + 1 ativação de proxy por sessão de play (no máximo).
- Se mpegts funcionar → engine fica salva pelo bloco de sucesso (3c) e próximas sessões iniciam direto em mpegts.
- Se mpegts também falhar → cai no caminho do proxy normalmente.

---

## O que NÃO muda

- `getHostProxyMode` / `markHostProxyRequired` / cache de 30min do `PROXY_HOST_PREFIX`
- `proxyAutoRestartedRef` e anti-loop de proxy
- `LOADEDDATA_WATCHDOG_MS` (4s) e `FRAG_LOAD_ERROR_THRESHOLD` (1)
- Edge functions (`stream-token`, `stream-proxy`, `iptv-login`)
- Banco, autenticação, UI, dropdown manual de engine
- `getPreferredEngine`/`setPreferredEngine` locais em `Player.tsx` (continuam usando `player.engine.host:`)

---

## Comportamento esperado

| Cenário | 1ª sessão | Após aprendizado |
|---|---|---|
| Servidor "bom" | HLS direto | HLS direto |
| Servidor que falha em HLS mas funciona em MPEG-TS | HLS → auto-switch para mpegts → toca | **MPEG-TS direto** |
| Servidor bloqueado (bkpac.cc) | HLS → mpegts (falha) → proxy → toca | **MPEG-TS** + **proxy** desde o start |
| Servidor que melhora | mpegts/proxy persistem | Após decay 24h + sucessos, volta para HLS direto |

---

## Riscos & mitigação

- **Engine "external"** (escolha manual): preservada — o auto-switch só age quando `engine === "hls"` e ignora "external".
- **Falsos positivos de falha**: filtro de reason em `markHostFailure` + threshold `≤ -2` + decay 24h.
- **Loop engine ↔ proxy**: `engineAutoSwitchedRef` e `proxyAutoRestartedRef` separados garantem 1 tentativa de cada por sessão.
- **Quota localStorage**: ~80 bytes por entry de stats + ~10 bytes por entry de engine. 100 hosts = ~10KB.

---

## Arquivos modificados

- `src/services/iptv.ts` — adicionar ~80 linhas após `clearHostProxyMode` (HostStats + helpers)
- `src/components/Player.tsx` — 6 edições pequenas:
  1. Imports (+ 3 nomes de iptv.ts)
  2. `engineAutoSwitchedRef` novo (próximo a `proxyAutoRestartedRef`)
  3. Reset desse ref no listener de troca de canal
  4. Decisão inicial de proxy (linha 623) considera `shouldUseProxy`
  5. `markHostSuccess` + `setPreferredEngine` em `onPlaying`/`onLoadedData`
  6. Auto-switch de engine + `markHostFailure` em `tryActivateProxyAndRestart`
