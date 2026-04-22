

## Plano — Painel opcional “Logs do player”

### Objetivo
Adicionar um painel interno de diagnóstico em `src/components/Player.tsx`, desativado por padrão, que mostra eventos do HLS, do `<video>`, da rede e do diagnóstico, com timestamps relativos e métrica de TTFF. Sem alterar nenhuma lógica existente do player.

### 1. Estrutura de logs (sem re-render desnecessário)

Adicionar tipo e refs no componente:

```ts
type LogEntry = {
  t: number;
  tRel: number;
  source: "hls" | "video" | "diag" | "net";
  level: "info" | "warn" | "error";
  label: string;
  details?: string;
};

const logsRef = useRef<LogEntry[]>([]);
const setupStartRef = useRef(0);
const firstFrameAtRef = useRef<number | null>(null);
const manifestParsedAtRef = useRef<number | null>(null);

const [logsPanelOpen, setLogsPanelOpen] = useState<boolean>(() => {
  try { return localStorage.getItem("player.logsPanel.open") === "1"; }
  catch { return false; }
});
const [logsVersion, setLogsVersion] = useState(0);
```

Persistir `logsPanelOpen` em `localStorage` chave `player.logsPanel.open` via `useEffect`.

### 2. Helper `pushLog`

```ts
const pushLog = (entry: Omit<LogEntry, "t" | "tRel">) => {
  const t = performance.now();
  logsRef.current.push({ ...entry, t, tRel: t - setupStartRef.current });
  if (logsRef.current.length > 200) logsRef.current.shift();
  if (logsPanelOpenRef.current) setLogsVersion(v => v + 1);
};
```

Usar um `logsPanelOpenRef` espelho (`useRef`) sincronizado com o state, para não recriar o helper a cada render e evitar re-renders quando o painel estiver fechado.

### 3. Reset no início do setup

Dentro do `useEffect` principal, antes do bootstrap do HLS:

```ts
logsRef.current = [];
firstFrameAtRef.current = null;
manifestParsedAtRef.current = null;
setupStartRef.current = performance.now();
pushLog({ source: "diag", level: "info", label: "setup_start" });
```

### 4. Pontos de instrumentação

Inserir `pushLog` nos pontos já existentes no `Player.tsx`, sem mudar nenhuma lógica:

- `MEDIA_ATTACHED` → `hls/media_attached`
- `MANIFEST_PARSED` → `hls/manifest_parsed` + `manifestParsedAtRef.current = performance.now()`
- `Hls.Events.ERROR` → `hls/error` com `details: ${type}/${details} fatal=${fatal}`
- bootstrap timeout (12s) → `diag/bootstrap_timeout_12s`
- stall timeout (8s) → `diag/stall_timeout_8s`
- `<video>` `playing` (apenas primeira vez via `firstFrameAtRef === null`) → `video/first_playing` + grava `firstFrameAtRef` + log do TTFF como `details`
- `<video>` `loadeddata` → `video/loadeddata`
- `<video>` `waiting` → `video/waiting`
- `<video>` `stalled` → `video/stalled`
- `<video>` `error` → `video/error` com `code`/`message`
- requisição de token OK → `net/token_ok`
- requisição de token erro → `net/token_error` com mensagem
- `handleRetry` → `diag/retry`

Cada chamada apenas adiciona ao buffer; nenhuma branch de execução existente é alterada.

### 5. Botão de abertura

Pequeno botão no canto **inferior esquerdo** do player:
- Ícone `Terminal` do `lucide-react`
- `pointer-events-auto`, `z-20`
- Sempre visível enquanto houver `src`
- Toggla `logsPanelOpen`

### 6. Painel de logs

Overlay sobre o player, lado direito, largura ~360px, altura limitada à do player:
- `bg-background/95 backdrop-blur-md border rounded-md`
- `overflow-y-auto`
- `pointer-events-auto`
- não cobre todo o vídeo

**Cabeçalho:**
- Título “Logs do player”
- Botões: copiar JSON (`navigator.clipboard.writeText(JSON.stringify(logsRef.current, null, 2))`), limpar (`logsRef.current = []; setLogsVersion(v=>v+1)`), fechar.

**Resumo de tempos:**
- Setup → Manifest: `manifestParsedAtRef - setupStartRef` ms
- Setup → First Frame (TTFF): `firstFrameAtRef - setupStartRef` ms
- Manifest → First Frame: diferença
- Mostrar `—` quando não disponível.

**Lista:**
- `[+1234ms]` tempo relativo
- badge por `source`:
  - `hls` → azul
  - `video` → verde
  - `diag` → âmbar
  - `net` → roxo
- `label` + `details` (truncado, `title` com texto completo)
- `level === "error"` em vermelho, `warn` em amarelo

**Auto-scroll:**
- ref no container da lista; `useEffect` em `[logsVersion, logsPanelOpen]` faz `scrollTop = scrollHeight`.

### 7. Garantias de não-regressão

- Nenhuma alteração na máquina de diagnóstico, retry, watchdogs, bootstrap HLS, integração com backend ou telemetria.
- Logs ficam em `useRef` — não disparam render.
- `setLogsVersion` só é chamado quando o painel está aberto (via `logsPanelOpenRef`).
- Buffer limitado a 200 entradas para não crescer indefinidamente.

### Arquivo tocado
- `src/components/Player.tsx` (único)

### Sem mudanças em
- `src/pages/Live.tsx`, edge functions, schema, telemetria, `IptvContext`, demais componentes.

