import { supabase } from "@/integrations/supabase/client";

export interface IptvCredentials {
  server?: string;
  username: string;
  password: string;
  /**
   * Base de mídia resolvida a partir do `server_info` retornado pelo login
   * (protocolo + host + porta corretos pra streams). Quando ausente,
   * cai pro `server` (DNS do panel).
   */
  streamBase?: string;
}

export interface UserInfo {
  username: string;
  status: string;
  exp_date: string | null;
  is_trial: string;
  active_cons: string;
  max_connections: string;
  created_at: string | null;
}

export interface ServerInfo {
  url: string;
  port: string;
  https_port: string;
  server_protocol: string;
}

export interface LoginResponse {
  user_info: UserInfo;
  server_info: ServerInfo;
  /** DNS atualmente autorizadas no painel (devolvidas pela edge no login). */
  allowed_servers?: string[];
}

export interface Category {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface LiveStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string | null;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export interface VodStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string;
  direct_source: string;
}

export interface Series {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  category_id: string;
}

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// =============================================================================
// Connectivity, telemetry, global request queue
// =============================================================================

/**
 * Tunable connectivity & queue parameters. Mutable at runtime via
 * `setConnectivityConfig` for debug / progressive rollout.
 */
export const connectivityConfig = {
  // Online/offline debouncing
  failureWindowMs: 10_000,
  failuresToOffline: 3,
  successesToOnline: 2,
  cooldownMs: 4_000,
  // Reconnect storm control
  reconnectWindowMs: 1_500,
  reconnectSpacingMs: 200,
  reconnectConcurrency: 2,
  normalConcurrency: 4,
  // Per-operation timeouts (ms)
  timeoutLogin: 10_000,
  timeoutToken: 5_000,
  timeoutData: 7_000,
  // Retry budget
  retriesLogin: 1,
  retriesToken: 1,
  retriesData: 1,
};

export function setConnectivityConfig(partial: Partial<typeof connectivityConfig>) {
  Object.assign(connectivityConfig, partial);
}

// ---- Telemetry (in-memory, best-effort) -------------------------------------
type TelemetryEvent = {
  ts: number;
  type: string;
  meta?: Record<string, unknown>;
};
const telemetry: TelemetryEvent[] = [];
const TELEMETRY_CAP = 200;
function recordTelemetry(type: string, meta?: Record<string, unknown>) {
  telemetry.push({ ts: Date.now(), type, meta });
  if (telemetry.length > TELEMETRY_CAP) telemetry.splice(0, telemetry.length - TELEMETRY_CAP);
}
export function getTelemetrySnapshot() {
  return telemetry.slice();
}

// ---- Adaptive state machine (hysteresis) ------------------------------------
type AdaptiveLevel = "normal" | "degraded" | "severe";
const adaptive = {
  level: "normal" as AdaptiveLevel,
  failureTimestamps: [] as number[], // sliding 60s
  lastTransitionAt: 0,
  stableSince: Date.now(),
};
const ADAPTIVE_COOLDOWN_MS = 10_000;
const ADAPTIVE_STABLE_MS = 30_000;
const ADAPTIVE_RATE_WINDOW_MS = 60_000;

function pruneAdaptive(now: number) {
  const cutoff = now - ADAPTIVE_RATE_WINDOW_MS;
  while (adaptive.failureTimestamps.length && adaptive.failureTimestamps[0] < cutoff) {
    adaptive.failureTimestamps.shift();
  }
}

function applyLevel(next: AdaptiveLevel, rate: number) {
  if (next === adaptive.level) return;
  const from = adaptive.level;
  adaptive.level = next;
  adaptive.lastTransitionAt = Date.now();
  adaptive.stableSince = Date.now();
  if (next === "normal") {
    connectivityConfig.failureWindowMs = 10_000;
    connectivityConfig.normalConcurrency = 4;
  } else if (next === "degraded") {
    connectivityConfig.failureWindowMs = 15_000;
    connectivityConfig.normalConcurrency = 3;
  } else {
    connectivityConfig.failureWindowMs = 20_000;
    connectivityConfig.normalConcurrency = 2;
  }
  recordTelemetry("adaptive_state_change", { from, to: next, failureRate: rate });
}

function evaluateAdaptive() {
  const now = Date.now();
  pruneAdaptive(now);
  const rate = adaptive.failureTimestamps.length;
  const sinceTransition = now - adaptive.lastTransitionAt;
  if (sinceTransition < ADAPTIVE_COOLDOWN_MS) return;

  // Escalate readily
  if (adaptive.level === "normal" && rate > 8) return applyLevel("degraded", rate);
  if (adaptive.level === "degraded" && rate > 15) return applyLevel("severe", rate);

  // De-escalate only after sustained stability
  const stableEnough = rate < 3 && now - adaptive.stableSince >= ADAPTIVE_STABLE_MS;
  if (adaptive.level === "severe" && stableEnough) return applyLevel("degraded", rate);
  if (adaptive.level === "degraded" && stableEnough) return applyLevel("normal", rate);

  // Track stable window: reset stableSince if a recent failure exists
  if (rate >= 3) adaptive.stableSince = now;
}

// ---- Real connectivity (debounced, separate from navigator.onLine) ----------
type ConnectivityListener = (online: boolean) => void;
const connectivity = {
  realOnline: true,
  consecutiveSuccesses: 0,
  failureTimestamps: [] as number[],
  lastTransitionAt: 0,
  listeners: new Set<ConnectivityListener>(),
};

export function isRealOnline() {
  return connectivity.realOnline && (typeof navigator === "undefined" || navigator.onLine);
}

export function subscribeConnectivity(fn: ConnectivityListener): () => void {
  connectivity.listeners.add(fn);
  return () => connectivity.listeners.delete(fn);
}

function emitConnectivity() {
  const online = isRealOnline();
  connectivity.listeners.forEach((fn) => {
    try { fn(online); } catch { /* noop */ }
  });
}

function tryTransition(toOnline: boolean) {
  const now = Date.now();
  if (now - connectivity.lastTransitionAt < connectivityConfig.cooldownMs && !toOnline) return;
  if (connectivity.realOnline === toOnline) return;
  connectivity.realOnline = toOnline;
  connectivity.lastTransitionAt = now;
  recordTelemetry("connectivity_change", { online: toOnline });
  emitConnectivity();
  if (toOnline) onConnectivityRestored();
}

function noteRequestSuccess() {
  connectivity.consecutiveSuccesses += 1;
  if (
    !connectivity.realOnline &&
    connectivity.consecutiveSuccesses >= connectivityConfig.successesToOnline
  ) {
    tryTransition(true);
  }
}

function noteRequestFailure(kind: "timeout" | "network" | "other") {
  connectivity.consecutiveSuccesses = 0;
  const now = Date.now();
  connectivity.failureTimestamps.push(now);
  const cutoff = now - connectivityConfig.failureWindowMs;
  while (connectivity.failureTimestamps.length && connectivity.failureTimestamps[0] < cutoff) {
    connectivity.failureTimestamps.shift();
  }
  if (
    connectivity.realOnline &&
    connectivity.failureTimestamps.length >= connectivityConfig.failuresToOffline
  ) {
    tryTransition(false);
  }
  // Adaptive feeds only on real network/timeout failures
  if (kind === "timeout" || kind === "network") {
    adaptive.failureTimestamps.push(now);
    evaluateAdaptive();
    recordTelemetry(kind === "timeout" ? "request_timeout" : "request_network_error");
  }
}

// ---- Global request queue ---------------------------------------------------
type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  enqueuedAt: number;
};
const queue: QueueTask<unknown>[] = [];
let inFlight = 0;
let dynamicConcurrency = connectivityConfig.normalConcurrency;
let reconnectUntil = 0;
let lastDispatchAt = 0;
const waitSamples: number[] = []; // last 50
const QUEUE_SAMPLE_CAP = 50;

function effectiveConcurrency(): number {
  if (Date.now() < reconnectUntil) return connectivityConfig.reconnectConcurrency;
  return dynamicConcurrency;
}

function pump() {
  const cap = effectiveConcurrency();
  while (inFlight < cap && queue.length > 0) {
    if (Date.now() < reconnectUntil) {
      const since = Date.now() - lastDispatchAt;
      if (since < connectivityConfig.reconnectSpacingMs) {
        setTimeout(pump, connectivityConfig.reconnectSpacingMs - since);
        return;
      }
    }
    const task = queue.shift()!;
    inFlight += 1;
    lastDispatchAt = Date.now();
    const wait = lastDispatchAt - task.enqueuedAt;
    waitSamples.push(wait);
    if (waitSamples.length > QUEUE_SAMPLE_CAP) waitSamples.splice(0, waitSamples.length - QUEUE_SAMPLE_CAP);
    recordTelemetry("queue_dequeued", { waitMs: wait });
    Promise.resolve()
      .then(() => task.run())
      .then(
        (v) => task.resolve(v),
        (e) => task.reject(e),
      )
      .finally(() => {
        inFlight -= 1;
        pump();
      });
  }
}

function enqueue<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      run: run as () => Promise<unknown>,
      resolve: resolve as (v: unknown) => void,
      reject,
      enqueuedAt: Date.now(),
    });
    recordTelemetry("queue_enqueued");
    pump();
  });
}

function onConnectivityRestored() {
  reconnectUntil = Date.now() + connectivityConfig.reconnectWindowMs;
  recordTelemetry("reconnect_window_start", { windowMs: connectivityConfig.reconnectWindowMs });
  pump();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // Treat as a hint only; real status confirmed by request successes
    onConnectivityRestored();
  });
  window.addEventListener("offline", () => {
    tryTransition(false);
  });
}

// ---- Queue health & dynamic concurrency tuning -----------------------------
export type QueueHealth = "healthy" | "warning" | "critical";

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

export function getQueueStats() {
  const sorted = waitSamples.slice().sort((a, b) => a - b);
  const avg = sorted.length ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
  const p95 = percentile(sorted, 95);
  const depth = queue.length;
  let health: QueueHealth = "healthy";
  if (avg >= 700 || p95 >= 1800 || depth >= 10) health = "critical";
  else if (avg >= 300 || p95 >= 800 || depth >= 5) health = "warning";
  return {
    avgWaitMs: Math.round(avg),
    p95WaitMs: Math.round(p95),
    currentDepth: depth,
    currentInFlight: inFlight,
    concurrency: effectiveConcurrency(),
    adaptiveLevel: adaptive.level,
    health,
  };
}

let lastWarnLogAt = 0;
let lastHealth: QueueHealth = "healthy";
let highDepthSince = 0;
let monitorStarted = false;

function ensureMonitor() {
  if (monitorStarted || typeof window === "undefined") return;
  monitorStarted = true;
  setInterval(() => {
    const stats = getQueueStats();
    const now = Date.now();
    const baseline = connectivityConfig.normalConcurrency;
    const cap = 6;
    // Bump up when depth is high but waits stay low (healthy demand spike)
    if (stats.currentDepth > 8 && stats.avgWaitMs < 400) {
      if (!highDepthSince) highDepthSince = now;
      if (now - highDepthSince >= 2000 && dynamicConcurrency < Math.min(cap, baseline + 2)) {
        const from = dynamicConcurrency;
        dynamicConcurrency = Math.min(cap, baseline + 2);
        recordTelemetry("concurrency_adjusted", { from, to: dynamicConcurrency, reason: "depth_spike_healthy" });
      }
    } else {
      highDepthSince = 0;
    }
    // Pull back when latency is climbing
    if ((stats.avgWaitMs > 600 || stats.p95WaitMs > 1500) && dynamicConcurrency > baseline) {
      const from = dynamicConcurrency;
      dynamicConcurrency = Math.max(baseline, dynamicConcurrency - 1);
      recordTelemetry("concurrency_adjusted", { from, to: dynamicConcurrency, reason: "latency_pressure" });
    }
    // Decay back to baseline when stable
    if (stats.health === "healthy" && stats.currentDepth < 3 && dynamicConcurrency !== baseline) {
      const from = dynamicConcurrency;
      dynamicConcurrency = baseline;
      recordTelemetry("concurrency_adjusted", { from, to: dynamicConcurrency, reason: "decay_to_baseline" });
    }
    // Health logs
    if (stats.health === "critical" && lastHealth !== "critical") {
      console.warn("[iptv-queue] critical", stats);
    } else if (stats.health === "warning" && now - lastWarnLogAt > 60_000) {
      console.warn("[iptv-queue] warning", stats);
      lastWarnLogAt = now;
    }
    lastHealth = stats.health;
  }, 1000);
}

// ---- Wrapped invoker --------------------------------------------------------
type InvokeKind = "login" | "token" | "data" | "event";

function timeoutFor(kind: InvokeKind): number {
  switch (kind) {
    case "login": return connectivityConfig.timeoutLogin;
    case "token": return connectivityConfig.timeoutToken;
    case "event": return 4_000;
    default: return connectivityConfig.timeoutData;
  }
}

function retriesFor(kind: InvokeKind): number {
  switch (kind) {
    case "login": return connectivityConfig.retriesLogin;
    case "token": return connectivityConfig.retriesToken;
    case "event": return 0;
    default: return connectivityConfig.retriesData;
  }
}

class TimeoutError extends Error {
  constructor() { super("timeout"); this.name = "TimeoutError"; }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError()), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function classifyError(e: unknown): "timeout" | "network" | "other" {
  if (e instanceof TimeoutError) return "timeout";
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  if (/network|failed to fetch|networkerror|fetch failed|load failed/.test(msg)) return "network";
  return "other";
}

async function invokeFn<T>(
  name: string,
  body: Record<string, unknown>,
  kind: InvokeKind,
): Promise<T> {
  ensureMonitor();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("Sem conexão com a internet");
  }
  const timeout = timeoutFor(kind);
  const maxRetries = retriesFor(kind);

  const attempt = async (): Promise<T> => {
    const exec = async () => {
      const { data, error } = await supabase.functions.invoke(name, { body });
      if (error) throw new Error(error.message || `Falha em ${name}`);
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }
      return data as T;
    };
    return withTimeout(enqueue(exec), timeout);
  };

  let lastErr: unknown;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const out = await attempt();
      noteRequestSuccess();
      return out;
    } catch (e) {
      lastErr = e;
      const cls = classifyError(e);
      noteRequestFailure(cls);
      if (cls === "other" || i === maxRetries) break;
      // Small backoff
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
      recordTelemetry("request_retry", { fn: name, attempt: i + 1, kind: cls });
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Falha desconhecida");
}

/**
 * Versão "à prova de crash" do invoke. Sempre retorna um envelope
 * `{ data?, error? }` — nunca lança em respostas de erro estruturadas
 * (HTTP 4xx/5xx que vêm com JSON). Apenas lança em falha de rede/timeout
 * absolutos onde não conseguimos extrair JSON.
 *
 * Útil para o login: a edge agora SEMPRE devolve `{ success, code, error }`
 * mesmo em erro lógico, então não queremos que o supabase-js transforme
 * isso em throw.
 */
export type SafeResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; error: string; status?: number };

export async function invokeSafe<T = unknown>(
  name: string,
  body: Record<string, unknown>,
  kind: InvokeKind = "data",
): Promise<SafeResult<T>> {
  ensureMonitor();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, code: "OFFLINE", error: "Sem conexão com a internet" };
  }
  const timeout = timeoutFor(kind);

  try {
    const exec = async () => {
      const res = await supabase.functions.invoke(name, { body });
      // supabase-js v2: em HTTP não-2xx, ele preenche `error` mas TAMBÉM
      // costuma deixar `data` quando o body é JSON. Quando não conseguir
      // ler o body, tentamos extrair manualmente do contexto.
      const dataAny = res.data as any;
      const errAny = res.error as any;

      // Sucesso real
      if (!errAny && dataAny && (dataAny.success !== false) && !dataAny.error) {
        return { ok: true as const, data: dataAny as T };
      }

      // Erro estruturado vindo no body (preferido)
      if (dataAny && typeof dataAny === "object" && (dataAny.code || dataAny.error)) {
        return {
          ok: false as const,
          code: String(dataAny.code ?? "UNKNOWN_ERROR"),
          error: String(dataAny.error ?? "Erro desconhecido"),
        };
      }

      // FunctionsHttpError / FunctionsFetchError: tentar extrair JSON do response
      if (errAny) {
        const ctx = errAny.context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const parsed = await ctx.json();
            if (parsed && typeof parsed === "object") {
              return {
                ok: false as const,
                code: String(parsed.code ?? "UNKNOWN_ERROR"),
                error: String(parsed.error ?? errAny.message ?? "Erro desconhecido"),
                status: ctx.status,
              };
            }
          } catch {
            /* fallthrough */
          }
        }
        return {
          ok: false as const,
          code: "UNKNOWN_ERROR",
          error: String(errAny.message ?? "Falha ao contatar o servidor"),
          status: ctx?.status,
        };
      }

      return {
        ok: false as const,
        code: "UNKNOWN_ERROR",
        error: "Resposta inválida do servidor",
      };
    };

    const out = await withTimeout(enqueue(exec), timeout);
    if (out.ok) noteRequestSuccess();
    else noteRequestFailure("other");
    return out;
  } catch (e) {
    const cls = classifyError(e);
    noteRequestFailure(cls);
    if (cls === "timeout") {
      return { ok: false, code: "TIMEOUT", error: "Tempo esgotado ao contatar o servidor" };
    }
    if (cls === "network") {
      return { ok: false, code: "NETWORK_ERROR", error: "Falha de rede ao contatar o servidor" };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "UNKNOWN_ERROR", error: msg };
  }
}

// =============================================================================

// =============================================================================
// Hybrid login: tenta direto do navegador (IP residencial passa por Cloudflare),
// com fallback automático para a edge function quando CORS / rede / mixed-content
// impedirem o fetch direto.
// =============================================================================

const BROWSER_LOGIN_TIMEOUT_MS = 6000;

function buildClientVariants(serverBase: string): string[] {
  const variants = new Set<string>();
  const stripped = serverBase.trim().replace(/\/+$/, "");
  let proto = "http";
  let hostPort = stripped;
  const m = stripped.match(/^(https?):\/\/(.+)$/i);
  if (m) {
    proto = m[1].toLowerCase();
    hostPort = m[2];
  }
  hostPort = hostPort.replace(/\s+/g, "");
  if (!hostPort) return [];
  const hasPort = /:\d+$/.test(hostPort);
  const host = hasPort ? hostPort.replace(/:\d+$/, "") : hostPort;
  const candidates = [`${proto}://${hostPort}`];
  if (!hasPort) {
    // Espelha as portas testadas pela edge (buildVariants), mas sem testar
    // todas — o navegador trava em mixed-content/CORS antes da edge, então
    // só vale tentar as mais prováveis para login direto via fetch.
    candidates.push(
      `http://${host}:80`,
      `http://${host}:8080`,
      `http://${host}:2052`,
      `http://${host}:2082`,
      `http://${host}:8880`,
      `https://${host}:443`,
      `https://${host}:2095`,
    );
  }
  for (const c of candidates) {
    try {
      new URL(c);
      variants.add(c);
    } catch { /* skip */ }
  }
  return [...variants];
}

type BrowserLoginOk = {
  ok: true;
  data: LoginResponse;
  matchedBase: string;
};

/**
 * Razões de falha do login direto via navegador.
 *  - "auth_failed"     → auth=0 OU HTTP 401. Resposta legítima → SEM fallback.
 *  - "server_response" → 403 / 5xx / non-JSON / sem user_info. Servidor
 *                         respondeu negando ou com erro interno → SEM fallback.
 *  - "mixed_content"   → app HTTPS + DNS HTTP. Browser bloqueia, edge consegue.
 *  - "transport"       → CORS / network error / timeout. Edge pode ajudar.
 */
type BrowserLoginFailReason =
  | "auth_failed"
  | "server_response"
  | "mixed_content"
  | "transport";

type BrowserLoginFail = {
  ok: false;
  reason: BrowserLoginFailReason;
  detail?: string;
};

/** True quando a falha NÃO justifica tentar a edge function. */
function isTerminalBrowserFail(r: BrowserLoginFail): boolean {
  return r.reason === "auth_failed" || r.reason === "server_response";
}

function messageForTerminalFail(r: BrowserLoginFail): string {
  if (r.reason === "auth_failed") return "Usuário ou senha inválidos";
  // server_response
  const detail = r.detail ?? "";
  if (/^HTTP 403/.test(detail)) {
    return "Servidor recusou o acesso (HTTP 403). Verifique seu plano ou IP.";
  }
  if (/^HTTP 5\d\d/.test(detail)) {
    return `Servidor IPTV com erro interno (${detail}). Tente em alguns minutos.`;
  }
  if (/^HTTP 4\d\d/.test(detail)) {
    return `Servidor respondeu ${detail}.`;
  }
  if (detail === "non_json" || detail === "sem user_info") {
    return "Resposta inválida do servidor IPTV.";
  }
  return "Servidor IPTV recusou o login.";
}

async function tryBrowserLogin(
  serverBase: string,
  username: string,
  password: string,
): Promise<BrowserLoginOk | BrowserLoginFail> {
  // Mixed content: app HTTPS + servidor HTTP → o browser vai bloquear sempre.
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    /^http:\/\//i.test(serverBase)
  ) {
    return { ok: false, reason: "mixed_content" };
  }

  const variants = buildClientVariants(serverBase);
  let lastFail: BrowserLoginFail = { ok: false, reason: "transport" };

  for (const base of variants) {
    const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), BROWSER_LOGIN_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: ctrl.signal,
        // Sem headers customizados → evita preflight OPTIONS desnecessário.
        credentials: "omit",
        cache: "no-store",
      });
      clearTimeout(timer);

      // 401 → credenciais inválidas (resposta legítima). Encerra sem fallback.
      if (res.status === 401) {
        return { ok: false, reason: "auth_failed", detail: "HTTP 401" };
      }
      // 403 / 5xx → servidor respondeu negando ou com erro interno.
      // Resposta legítima dele; a edge daria o mesmo resultado.
      if (res.status === 403 || res.status >= 500) {
        return {
          ok: false,
          reason: "server_response",
          detail: `HTTP ${res.status}`,
        };
      }
      if (!res.ok) {
        // Outros 4xx (404, 405, 429...) → resposta do servidor, não transporte.
        lastFail = {
          ok: false,
          reason: "server_response",
          detail: `HTTP ${res.status}`,
        };
        continue;
      }

      const text = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        // Servidor respondeu, mas não é JSON Xtream → resposta dele.
        lastFail = { ok: false, reason: "server_response", detail: "non_json" };
        continue;
      }

      const obj = data as { user_info?: { auth?: number | string } };
      if (!obj?.user_info) {
        lastFail = {
          ok: false,
          reason: "server_response",
          detail: "sem user_info",
        };
        continue;
      }
      if (Number(obj.user_info.auth) === 0) {
        return { ok: false, reason: "auth_failed", detail: "auth=0" };
      }
      return {
        ok: true,
        data: data as LoginResponse,
        matchedBase: base,
      };
    } catch (err) {
      clearTimeout(timer);
      // TypeError: Failed to fetch → CORS, network, ou mixed content.
      // AbortError → timeout.
      const msg = err instanceof Error ? err.message : String(err);
      lastFail = { ok: false, reason: "transport", detail: msg };
      continue;
    }
  }
  return lastFail;
}

async function logBrowserLoginEvent(
  server: string,
  username: string,
  success: boolean,
  reason?: string,
): Promise<void> {
  // Best-effort: não bloqueia o login se a edge falhar.
  try {
    await supabase.functions.invoke("iptv-login", {
      body: { mode: "log", server, username, success, reason },
    });
  } catch { /* noop */ }
}

export async function iptvLogin(
  creds: IptvCredentials
): Promise<LoginResponse & { server_url?: string }> {
  const startedAt = Date.now();

  // 1) Pré-validar allowlist na edge (só lê o banco, não toca no painel).
  let candidates: string[] = [];
  try {
    const validation = await invokeFn<{ allowed: boolean; candidates?: string[]; error?: string }>(
      "iptv-login",
      { mode: "validate", server: creds.server },
      "login",
    );
    if (!validation.allowed) {
      throw new Error(validation.error || "DNS não autorizada");
    }
    candidates = validation.candidates ?? [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha na validação";
    if (/dns não autorizada|não autorizad|não tem acesso/i.test(msg)) {
      throw new Error(msg);
    }
    console.warn("[iptv] validate failed, falling back to edge login", msg);
    return iptvLoginViaEdge(creds, startedAt, "validate_failed");
  }

  if (candidates.length === 0) {
    throw new Error("Nenhuma DNS autorizada disponível");
  }

  // 2) Tentar cada candidato direto pelo navegador.
  let lastTransportFail: BrowserLoginFail | null = null;
  for (const base of candidates) {
    const r = await tryBrowserLogin(base, creds.username, creds.password);
    if (r.ok === true) {
      const durationMs = Date.now() - startedAt;
      console.log("[iptv] method: browser", { server: r.matchedBase, durationMs });
      void logBrowserLoginEvent(r.matchedBase, creds.username, true, "browser_login_ok");
      return { ...r.data, server_url: r.matchedBase };
    }

    // Falha terminal: servidor respondeu (auth_failed / server_response).
    // Não tem por que tentar a edge — daria a mesma resposta.
    if (isTerminalBrowserFail(r)) {
      const message = messageForTerminalFail(r);
      console.log("[iptv] method: browser", {
        server: base,
        result: "terminal_fail",
        reason: r.reason,
        detail: r.detail,
      });
      void logBrowserLoginEvent(base, creds.username, false, `${r.reason}:${r.detail ?? ""}`);
      throw new Error(message);
    }

    // Transporte (CORS / timeout / rede) ou mixed_content → guarda e tenta próximo.
    lastTransportFail = r;
  }

  // 3) Fallback: edge function. Só chega aqui se TODOS os candidatos falharam
  //    por transporte (CORS / network / timeout / mixed-content).
  const reason = lastTransportFail?.reason ?? "all_failed";
  const detail = lastTransportFail?.detail;
  console.log("[iptv] method: edge", { trigger: reason, detail });
  return iptvLoginViaEdge(creds, startedAt, reason);
}

/** Mensagem amigável para cada `code` retornado pela edge `iptv-login`. */
function messageForLoginCode(code: string, fallback: string): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "Usuário ou senha inválidos";
    case "SERVER_UNREACHABLE":
      return "Servidor IPTV não respondeu. Verifique a DNS ou porta da URL.";
    case "DNS_ERROR":
      return "DNS do servidor IPTV não resolveu. Verifique o endereço.";
    case "TIMEOUT":
      return "Tempo esgotado ao contatar o servidor. Tente novamente.";
    case "NOT_ALLOWED":
      return fallback || "DNS não autorizada nesta plataforma.";
    case "NETWORK_ERROR":
      return "Falha de rede. Verifique sua conexão.";
    case "OFFLINE":
      return "Sem conexão com a internet";
    case "BAD_REQUEST":
      return fallback || "Dados inválidos para login";
    case "SERVICE_UNAVAILABLE":
      return "Serviço temporariamente indisponível. Tente em instantes.";
    default:
      return fallback || "Falha no login";
  }
}

async function iptvLoginViaEdge(
  creds: IptvCredentials,
  startedAt: number,
  reason: string,
): Promise<LoginResponse & { server_url?: string }> {
  const result: SafeResult<LoginResponse & { server_url?: string }> =
    await invokeSafe<LoginResponse & { server_url?: string }>(
      "iptv-login",
      creds as unknown as Record<string, unknown>,
      "login",
    );
  if (result.ok === true) {
    const durationMs = Date.now() - startedAt;
    console.log("[iptv] method: edge", { reason, durationMs, result: "ok" });
    return result.data;
  }
  console.log("[iptv] method: edge", {
    reason,
    result: "fail",
    code: result.code,
    error: result.error,
  });
  throw new Error(messageForLoginCode(result.code, result.error));
}

export interface Episode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  direct_source?: string;
  info?: {
    movie_image?: string;
    plot?: string;
    duration?: string;
    rating?: string | number;
  };
}

export interface SeriesInfo {
  seasons: Array<{ season_number: number; name?: string; cover?: string }>;
  info: {
    name: string;
    cover: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    releaseDate: string;
    rating: string;
  };
  episodes: Record<string, Episode[]>;
}

export async function iptvFetch<T>(
  creds: IptvCredentials,
  action: string,
  extra: Record<string, string | number> = {},
): Promise<T> {
  return invokeFn<T>(
    "iptv-categories",
    { ...creds, action, ...extra } as Record<string, unknown>,
    "data",
  );
}

export const getLiveCategories = (c: IptvCredentials) =>
  iptvFetch<Category[]>(c, "get_live_categories");
export const getLiveStreams = (c: IptvCredentials) =>
  iptvFetch<LiveStream[]>(c, "get_live_streams");
export const getVodCategories = (c: IptvCredentials) =>
  iptvFetch<Category[]>(c, "get_vod_categories");
export const getVodStreams = (c: IptvCredentials) =>
  iptvFetch<VodStream[]>(c, "get_vod_streams");
export const getSeriesCategories = (c: IptvCredentials) =>
  iptvFetch<Category[]>(c, "get_series_categories");
export const getSeries = (c: IptvCredentials) =>
  iptvFetch<Series[]>(c, "get_series");
export const getSeriesInfo = (c: IptvCredentials, seriesId: number) =>
  iptvFetch<SeriesInfo>(c, "get_series_info", { series_id: seriesId });

/**
 * Extrai o hostname (lowercase, sem porta) de uma URL — tolerante a entradas
 * sem protocolo. Retorna null se não conseguir parsear.
 */
function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const withProto = /^https?:\/\//i.test(url) ? url : `http://${url}`;
  try {
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True se `candidate` (host ou URL) bate com algum host em `allowed`.
 */
export function isHostAllowed(candidate: string | null | undefined, allowed?: string[] | null): boolean {
  const h = hostnameOf(candidate);
  if (!h || !allowed?.length) return false;
  return allowed.some((a) => hostnameOf(a) === h);
}

/**
 * Resolve a base correta de stream a partir do server_info do login.
 * Prefere protocolo/porta retornados pelo provedor, MAS só aceita o host
 * dele se estiver dentro da allowlist atual. Se o provedor devolver um host
 * que não está mais cadastrado no painel, cai para o `fallback` (que já
 * passou pela validação da edge).
 */
export function resolveStreamBase(
  serverInfo?: ServerInfo | null,
  fallback?: string,
  allowed?: string[] | null,
): string {
  if (serverInfo?.url) {
    const proto = (serverInfo.server_protocol || "http").toLowerCase();
    const host = serverInfo.url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const port =
      proto === "https"
        ? serverInfo.https_port || serverInfo.port
        : serverInfo.port || serverInfo.https_port;
    const portPart = port && !host.includes(":") ? `:${port}` : "";
    const built = `${proto}://${host}${portPart}`;

    // Sem allowlist disponível → comportamento legado.
    if (!allowed || allowed.length === 0) return built;

    // Só aceita o host devolvido pelo provedor se estiver na allowlist.
    if (isHostAllowed(built, allowed)) return built;
  }
  return (fallback || "").replace(/\/+$/, "");
}

/**
 * Pergunta à edge a lista atual de DNS autorizadas (sem credenciais).
 * Usado no boot para revalidar sessões salvas no localStorage.
 */
export async function fetchAllowedServers(): Promise<string[]> {
  try {
    const r = await invokeFn<{ allowed: boolean; candidates?: string[] }>(
      "iptv-login",
      { mode: "validate" },
      "data",
    );
    return r.allowed ? r.candidates ?? [] : [];
  } catch {
    return [];
  }
}

function serverBase(creds: IptvCredentials): string {
  return (creds.streamBase || creds.server || "").replace(/\/+$/, "");
}

/** Considera direct_source válido se for uma URL absoluta http(s). */
function pickDirectSource(direct?: string): string | null {
  if (!direct) return null;
  const trimmed = direct.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export function buildLiveStreamUrl(
  creds: IptvCredentials,
  streamId: number,
  directSource?: string,
): string {
  const direct = pickDirectSource(directSource);
  if (direct) return direct;
  return `${serverBase(creds)}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
}

export function buildVodStreamUrl(
  creds: IptvCredentials,
  streamId: number,
  ext: string,
  directSource?: string,
): string {
  const direct = pickDirectSource(directSource);
  if (direct) return direct;
  return `${serverBase(creds)}/movie/${creds.username}/${creds.password}/${streamId}.${ext}`;
}

export function buildSeriesEpisodeUrl(
  creds: IptvCredentials,
  episodeId: string | number,
  ext: string,
  directSource?: string,
): string {
  const direct = pickDirectSource(directSource);
  if (direct) return direct;
  return `${serverBase(creds)}/series/${creds.username}/${creds.password}/${episodeId}.${ext || "mp4"}`;
}

/**
 * Legacy raw proxy URL — kept for any debug/external case.
 * Real reproduction must go through `requestStreamToken` below,
 * which validates auth, rate limit and sessions and returns a
 * short-lived signed URL.
 */
export function proxyUrl(url: string): string {
  return `${FUNCTIONS_BASE}/stream-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Reescreve URLs de imagem HTTP para passar por uma CDN HTTPS pública
 * (images.weserv.nl) — necessário porque o app roda em HTTPS e o provedor
 * IPTV serve `stream_icon` em HTTP, o que o navegador bloqueia como mixed
 * content. Não usa nossa edge para não consumir cota com tráfego de imagem.
 */
export function proxyImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  // Já é HTTPS ou data: → passa direto.
  if (/^(https:|data:)/i.test(trimmed)) return trimmed;
  // Página em HTTP (dev local) → não precisa de proxy.
  if (typeof window !== "undefined" && window.location.protocol !== "https:") {
    return trimmed;
  }
  // HTTP em página HTTPS → reescreve via weserv (entende host+path sem protocolo).
  const stripped = trimmed.replace(/^https?:\/\//i, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}`;
}

export type StreamKind = "playlist" | "segment";
export type StreamMode = "redirect" | "stream";

// =============================================================================
// Per-host proxy mode cache (localStorage). Activated only after real failure.
// =============================================================================
const PROXY_HOST_PREFIX = "iptv.proxy.host:";
const PROXY_HOST_TTL_MS = 30 * 60_000; // 30 min

interface ProxyHostEntry {
  mode: StreamMode;
  expiresAt: number;
  reason?: string;
}

function hostFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).host.toLowerCase(); } catch { return null; }
}

export function getHostProxyMode(url: string | null | undefined): StreamMode {
  const host = hostFromUrl(url);
  if (!host) return "redirect";
  try {
    const raw = localStorage.getItem(`${PROXY_HOST_PREFIX}${host}`);
    if (!raw) return "redirect";
    const entry = JSON.parse(raw) as ProxyHostEntry;
    if (!entry || typeof entry.expiresAt !== "number") return "redirect";
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(`${PROXY_HOST_PREFIX}${host}`);
      return "redirect";
    }
    return entry.mode === "stream" ? "stream" : "redirect";
  } catch { return "redirect"; }
}

export function markHostProxyRequired(url: string | null | undefined, reason: string): boolean {
  const host = hostFromUrl(url);
  if (!host) return false;
  try {
    const entry: ProxyHostEntry = {
      mode: "stream",
      expiresAt: Date.now() + PROXY_HOST_TTL_MS,
      reason,
    };
    localStorage.setItem(`${PROXY_HOST_PREFIX}${host}`, JSON.stringify(entry));
    return true;
  } catch { return false; }
}

export function clearHostProxyMode(url: string | null | undefined): void {
  const host = hostFromUrl(url);
  if (!host) return;
  try { localStorage.removeItem(`${PROXY_HOST_PREFIX}${host}`); } catch { /* noop */ }
}

/**
 * Asks the backend for a signed, short-lived stream URL.
 * Requires an active Supabase session (anonymous or otherwise).
 */
export async function requestStreamToken(params: {
  url: string;
  kind: StreamKind;
  iptvUsername?: string;
  mode?: StreamMode;
}): Promise<{ url: string; expires_at: number }> {
  return invokeFn<{ url: string; expires_at: number }>(
    "stream-token",
    {
      url: params.url,
      kind: params.kind,
      iptv_username: params.iptvUsername,
      mode: params.mode ?? "redirect",
    },
    "token",
  );
}

/** Lightweight event reporting (errors / heartbeats). Best-effort. */
export async function reportStreamEvent(
  event_type: "stream_started" | "stream_error" | "session_heartbeat",
  payload?: { url?: string; meta?: Record<string, unknown> },
): Promise<void> {
  try {
    await invokeFn<unknown>(
      "stream-event",
      { event_type, ...payload },
      "event",
    );
  } catch {
    // best-effort
  }
}

export function normalizeExt(ext?: string): string {
  return (ext || "").toLowerCase().replace(/^\./, "");
}

/** Extrai a extensão real (sem querystring) de uma URL, se houver. */
export function extFromUrl(url?: string | null): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const m = u.pathname.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
    return m ? m[1] : "";
  } catch {
    const cleaned = url.toLowerCase().split("?")[0];
    const m = cleaned.match(/\.([a-z0-9]{2,5})$/);
    return m ? m[1] : "";
  }
}

/**
 * Decide se um conteúdo abre no navegador, considerando extensão declarada,
 * direct_source e URL final. Mais robusto que olhar só container_extension.
 */
export function isBrowserPlayable(ext?: string, url?: string | null): boolean {
  const candidates = [normalizeExt(ext), extFromUrl(url)].filter(Boolean);
  return candidates.some((e) => ["mp4", "m3u8", "webm"].includes(e));
}

export function isExternalOnly(ext?: string, url?: string | null): boolean {
  const candidates = [normalizeExt(ext), extFromUrl(url)].filter(Boolean);
  // Só considera "externo" se pelo menos uma pista bater e nenhuma indicar compatível
  if (candidates.length === 0) return false;
  if (candidates.some((e) => ["mp4", "m3u8", "webm"].includes(e))) return false;
  return candidates.some((e) => ["mkv", "avi", "mov", "ts", "wmv", "flv"].includes(e));
}

export type StreamType = "hls" | "video" | "external" | "unknown";

/**
 * Detecta o tipo de stream a partir da extensão e/ou URL.
 */
export function getStreamType(ext?: string, url?: string): StreamType {
  const e = normalizeExt(ext);
  const u = (url || "").toLowerCase().split("?")[0];

  if (e === "m3u8" || u.includes(".m3u8") || u.includes("mpegurl")) return "hls";
  if (["mp4", "webm"].includes(e) || u.endsWith(".mp4") || u.endsWith(".webm")) return "video";
  if (["mkv", "avi", "mov", "ts", "wmv", "flv"].includes(e) || /\.(mkv|avi|mov|ts|wmv|flv)$/.test(u))
    return "external";

  return "unknown";
}

export type PlaybackStrategy =
  | { mode: "internal"; type: "hls" | "native" }
  | { mode: "external" }
  | { mode: "error"; reason: string };

export function getPlaybackStrategy(ext?: string, url?: string): PlaybackStrategy {
  if (!isValidStreamUrl(url)) return { mode: "error", reason: "URL de stream inválida" };

  const type = getStreamType(ext, url);
  if (type === "hls") return { mode: "internal", type: "hls" };
  if (type === "video") return { mode: "internal", type: "native" };
  if (type === "external") return { mode: "external" };

  return { mode: "internal", type: "native" };
}

export function isValidStreamUrl(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed, FUNCTIONS_BASE);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export type FormatBadgeInfo = {
  label: string;
  tone: "green" | "blue" | "yellow" | "gray";
  tooltip: string;
};

export function getFormatBadge(ext?: string, url?: string | null): FormatBadgeInfo {
  const e = normalizeExt(ext) || extFromUrl(url);
  if (e === "mp4")
    return { label: "MP4", tone: "green", tooltip: "Compatível com navegador" };
  if (e === "m3u8")
    return { label: "STREAM", tone: "blue", tooltip: "Streaming HLS" };
  if (["mkv", "avi", "mov", "ts", "wmv", "flv"].includes(e))
    return { label: "EXTERNO", tone: "yellow", tooltip: "Abrir em player externo" };
  return { label: e.toUpperCase() || "?", tone: "gray", tooltip: "Formato desconhecido" };
}
