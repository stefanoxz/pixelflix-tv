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

// =============================================================================

export async function iptvLogin(
  creds: IptvCredentials
): Promise<LoginResponse & { server_url?: string }> {
  try {
    return await invokeFn<LoginResponse & { server_url?: string }>("iptv-login", creds as unknown as Record<string, unknown>, "login");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha no login";
    if (e instanceof TimeoutError || /timeout/i.test(msg)) {
      throw new Error("Tempo esgotado ao contatar o servidor. Verifique sua conexão.");
    }
    if (/invalid|credenc|unauthor|401|403/i.test(msg)) {
      throw new Error("Usuário ou senha inválidos");
    }
    if (/network|failed to fetch/i.test(msg)) {
      throw new Error("Servidor inacessível. Tente novamente em instantes.");
    }
    throw new Error(msg);
  }
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
 * Resolve a base correta de stream a partir do server_info do login.
 * Prefere protocolo/porta retornados pelo provedor (que podem diferir do panel).
 * Fallback: server_url cru.
 */
export function resolveStreamBase(serverInfo?: ServerInfo | null, fallback?: string): string {
  if (serverInfo?.url) {
    const proto = (serverInfo.server_protocol || "http").toLowerCase();
    const host = serverInfo.url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const port =
      proto === "https"
        ? serverInfo.https_port || serverInfo.port
        : serverInfo.port || serverInfo.https_port;
    const portPart = port && !host.includes(":") ? `:${port}` : "";
    return `${proto}://${host}${portPart}`;
  }
  return (fallback || "").replace(/\/+$/, "");
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

export type StreamKind = "playlist" | "segment";

/**
 * Asks the backend for a signed, short-lived stream URL.
 * Requires an active Supabase session (anonymous or otherwise).
 */
export async function requestStreamToken(params: {
  url: string;
  kind: StreamKind;
  iptvUsername?: string;
}): Promise<{ url: string; expires_at: number }> {
  const { data, error } = await supabase.functions.invoke("stream-token", {
    body: {
      url: params.url,
      kind: params.kind,
      iptv_username: params.iptvUsername,
    },
  });
  if (error) throw new Error(error.message || "Falha ao autorizar stream");
  if ((data as { error?: string })?.error) {
    throw new Error((data as { error: string }).error);
  }
  return data as { url: string; expires_at: number };
}

/** Lightweight event reporting (errors / heartbeats). Best-effort. */
export async function reportStreamEvent(
  event_type: "stream_started" | "stream_error" | "session_heartbeat",
  payload?: { url?: string; meta?: Record<string, unknown> },
): Promise<void> {
  try {
    await supabase.functions.invoke("stream-event", {
      body: { event_type, ...payload },
    });
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
