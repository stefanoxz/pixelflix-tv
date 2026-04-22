

## Plano — Histerese, balanceamento de fila e debounce de troca

### Mudanças

**1. `src/services/iptv.ts` — histerese na adaptação automática**
- Hoje a adaptação ativa em >10 falhas/60s e restaura quando cai. Substituir por máquina de 3 estados explícita: `normal` → `degraded` → `severe`.
  - `normal → degraded`: >8 falhas em 60s. Aplica `failureWindowMs = 15000`, `normalConcurrency = 3`.
  - `degraded → severe`: >15 falhas em 60s. Aplica `failureWindowMs = 20000`, `normalConcurrency = 2`.
  - **Restauração só após janela estável**: precisa de ≥30s contínuos com <3 falhas para descer um nível. Sem regressão por flap isolado.
  - Cooldown mínimo de 10s entre transições adaptativas (independente do cooldown de online/offline).
- Telemetria: `adaptive_state_change` com `{from, to, failureRate}`.

**2. `src/services/iptv.ts` — balanceamento fila × concorrência**
- Ajuste dinâmico de `MAX_CONCURRENT` baseado em `getQueueStats()`:
  - Se `currentDepth > 8` por 2s seguidos **e** `avgWaitMs < 400` (rede saudável, fila enche por demanda): permitir bump temporário até `normalConcurrency + 2` (cap absoluto 6).
  - Se `avgWaitMs > 600` **ou** `p95WaitMs > 1500`: reduzir `MAX_CONCURRENT` em 1 (mínimo respeitando estado adaptativo). Evita aumentar latência empurrando mais paralelismo numa rede que já não dá conta.
  - Avaliação a cada 1s via `setInterval` único no módulo (lazy start na primeira chamada).
- Telemetria: `concurrency_adjusted` com `{from, to, reason}`.

**3. `src/services/iptv.ts` — thresholds de alerta refinados**
- `isBottleneck` antigo era binário e grosseiro. Substituir por níveis:
  - `healthy`: `avgWaitMs < 300 && p95WaitMs < 800 && currentDepth < 5`
  - `warning`: `avgWaitMs >= 300 || p95WaitMs >= 800 || currentDepth >= 5`
  - `critical`: `avgWaitMs >= 700 || p95WaitMs >= 1800 || currentDepth >= 10`
- `getQueueStats()` retorna `health: "healthy" | "warning" | "critical"` em vez de só `isBottleneck`.
- Log throttled (1×/min) em `warning`; log imediato em transição para `critical`.
- Permite consumidores futuros (header, debug overlay) reagirem antes do impacto chegar ao usuário.

**4. `src/components/Player.tsx` — debounce de troca de stream**
- Trocas rápidas (zapping de canais ao vivo) hoje disparam teardown + setup completo a cada clique. Adicionar debounce de **250ms** na resolução do stream:
  - `useEffect` em `[streamUrl]` agenda `setTimeout(applyStream, 250)`.
  - Cleanup do effect cancela o timeout — se usuário troca de novo antes de 250ms, o anterior nunca executa.
  - Resultado: zapping rápido só materializa o último canal escolhido.
- Quando o setup finalmente roda, mantém política de reuso seguro do `loadSource` (do plano anterior) para reduzir custo no caso comum.
- Teardown completo via `teardownHls()` continua acontecendo no cleanup do componente e em casos de erro — debounce só evita teardowns intermediários durante navegação rápida.
- Telemetria: `player_switch_debounced` quando um setup é cancelado pelo debounce.

**5. Sem mudanças em**
- Backend, schema, ErrorBoundary, Header, Login, hook `useOnlineStatus`, demais páginas, fila global em si (apenas tunada), telemetria base.

### Arquivos tocados
- `src/services/iptv.ts` — máquina de estados adaptativa com histerese + ajuste dinâmico de concorrência + níveis de saúde da fila
- `src/components/Player.tsx` — debounce de 250ms na troca de stream

### Resultado esperado
- Adaptação não oscila: precisa de degradação clara para piorar e estabilidade real para melhorar.
- Concorrência se ajusta à saúde da fila — não empurra mais carga em rede ruim, aproveita folga em rede boa.
- Sinais de degradação aparecem em `warning` antes de virarem `critical`, dando margem para reação.
- Zapping rápido entre canais não derruba nem reinstancia o player a cada clique — só o último alvo é montado.

