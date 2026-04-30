import { supabase } from "@/integrations/supabase/client";
import {
  reportDiagnostic,
} from "@/lib/clientDiagnostics";

export interface IptvCredentials {
  server?: string;
  username: string;
  password: string;
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
  allowed_servers?: string[];
  at_connection_limit?: boolean;
  server_url?: string;
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

export interface EpgEntry {
  id: string;
  title: string;
  description: string;
  startMs: number;
  endMs: number;
}

export type StreamMode = "redirect" | "stream";
export type InvokeKind = "login" | "token" | "data" | "event";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// =============================================================================
// Utils & Connectivity
// =============================================================================

export const connectivityConfig = {
  failureWindowMs: 10_000,
  failuresToOffline: 3,
  successesToOnline: 2,
  cooldownMs: 4_000,
  reconnectWindowMs: 1_500,
  reconnectSpacingMs: 200,
  reconnectConcurrency: 1,
  normalConcurrency: 1,
  timeoutLogin: 12_000,
  timeoutToken: 5_000,
  timeoutData: 20_000,
  retriesLogin: 3,
  retriesToken: 1,
  retriesData: 2,
};

export function setConnectivityConfig(partial: Partial<typeof connectivityConfig>) {
  Object.assign(connectivityConfig, partial);
}

export function isRealOnline() { return typeof navigator !== "undefined" ? navigator.onLine : true; }
export function subscribeConnectivity(fn: (online: boolean) => void) {
  const handler = () => fn(isRealOnline());
  if (typeof window !== "undefined") {
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  }
  return () => {};
}

export function getQueueStats() { return { health: "healthy" as const }; }
export function getTelemetrySnapshot() { return []; }

// =============================================================================
// Auth
// =============================================================================

export class IptvLoginError extends Error {
  constructor(message: string, public code: string, public debug: any) {
    super(message);
    this.name = "IptvLoginError";
  }
}

export async function invokeSafe<T>(name: string, body: any, kind: InvokeKind = "data"): Promise<{ ok: true, data: T } | { ok: false, code: string, error: string, status?: number, extra?: any }> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) return { ok: false, code: "ERROR", error: error.message };
    const d = data as any;
    if (d?.success === false) return { ok: false, code: d.code || "ERROR", error: d.error || "Unknown error", extra: d };
    return { ok: true, data: d };
  } catch (e: any) {
    return { ok: false, code: "UNKNOWN", error: e.message };
  }
}

export async function iptvLogin(creds: IptvCredentials): Promise<LoginResponse> {
  const r = await invokeSafe<LoginResponse>("iptv-login", { ...creds, mode: "login" }, "login");
  if (!r.ok) throw new IptvLoginError((r as any).error, (r as any).code, (r as any).extra?.debug);
  return r.data;
}

export async function iptvLoginM3u(creds: IptvCredentials): Promise<LoginResponse & { auto_registered?: boolean }> {
  const r = await invokeSafe<LoginResponse & { auto_registered?: boolean }>("iptv-login", { ...creds, mode: "m3u_register" }, "login");
  if (!r.ok) throw new IptvLoginError((r as any).error, (r as any).code, (r as any).extra?.debug);
  return r.data;
}

export async function fetchAllowedServers(): Promise<string[]> {
  const r = await invokeSafe<{ allowed: boolean, candidates?: string[] }>("iptv-login", { mode: "validate" });
  return r.ok && r.data.allowed ? r.data.candidates ?? [] : [];
}

export function isHostAllowed(candidate: string | null | undefined, allowed?: string[] | null): boolean {
  if (!candidate || !allowed?.length) return false;
  try {
    const h = new URL(candidate.startsWith("http") ? candidate : `http://${candidate}`).hostname.toLowerCase();
    return allowed.some(a => a.toLowerCase().includes(h));
  } catch { return false; }
}

export function resolveStreamBase(serverInfo?: ServerInfo | null, fallback?: string, allowed?: string[] | null): string {
  if (serverInfo?.url && isHostAllowed(serverInfo.url, allowed)) {
     const proto = (serverInfo.server_protocol || "http").toLowerCase();
     const port = proto === "https" ? (serverInfo.https_port || serverInfo.port || "443") : (serverInfo.port || serverInfo.https_port || "80");
     const host = serverInfo.url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
     return `${proto}://${host}:${port}`;
  }
  return (fallback || "").replace(/\/+$/, "");
}

// =============================================================================
// Catalog
// =============================================================================

export async function iptvFetch<T>(creds: IptvCredentials, action: string, extra: any = {}): Promise<T> {
  const params = new URLSearchParams({
    username: creds.username,
    password: creds.password,
    action,
    ...extra
  });
  const directUrl = `${creds.server}/player_api.php?${params.toString()}`;

  return tryBrowserFetch<T>(directUrl, async () => {
    const { data, error } = await supabase.functions.invoke("iptv-categories", { body: { ...creds, action, ...extra } });
    if (error) throw error;
    return data as T;
  });
}

export const getLiveCategories = (c: IptvCredentials) => iptvFetch<Category[]>(c, "get_live_categories");
export const getLiveStreams = (c: IptvCredentials) => iptvFetch<LiveStream[]>(c, "get_live_streams");
export const getVodCategories = (c: IptvCredentials) => iptvFetch<Category[]>(c, "get_vod_categories");
export const getVodStreams = (c: IptvCredentials) => iptvFetch<VodStream[]>(c, "get_vod_streams");
export const getSeriesCategories = (c: IptvCredentials) => iptvFetch<Category[]>(c, "get_series_categories");
export const getSeries = (c: IptvCredentials) => iptvFetch<Series[]>(c, "get_series");
export const getSeriesInfo = (c: IptvCredentials, seriesId: number) => iptvFetch<SeriesInfo>(c, "get_series_info", { series_id: seriesId });
export const getVodInfo = (c: IptvCredentials, vodId: number) => iptvFetch<any>(c, "get_vod_info", { vod_id: vodId });

export async function getShortEpg(c: IptvCredentials, streamId: number, limit = 6): Promise<EpgEntry[]> {
  try {
    const res = await iptvFetch<any>(c, "get_short_epg", { stream_id: streamId, limit });
    const list = Array.isArray(res) ? res : res?.epg_listings ?? [];
    return list.map((raw: any) => ({
      id: String(raw.id || raw.epg_id),
      title: decodeB64(raw.title),
      description: decodeB64(raw.description),
      startMs: Number(raw.start_timestamp) * 1000,
      endMs: Number(raw.stop_timestamp) * 1000,
    }));
  } catch { return []; }
}

function decodeB64(s: string | undefined | null): string {
  if (!s) return "";
  try {
    const binString = atob(s);
    const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
    return new TextDecoder("utf-8").decode(bytes);
  } catch { return s; }
}

// =============================================================================
// Streaming
// =============================================================================

export function buildLiveStreamUrl(creds: IptvCredentials, streamId: number, directSource?: string) {
  if (directSource && directSource.startsWith("http")) return directSource;
  const base = (creds.streamBase || creds.server || "").replace(/\/+$/, "");
  return `${base}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
}

export function buildVodStreamUrl(creds: IptvCredentials, streamId: number, ext: string, directSource?: string) {
  if (directSource && directSource.startsWith("http")) return directSource;
  const base = (creds.streamBase || creds.server || "").replace(/\/+$/, "");
  return `${base}/movie/${creds.username}/${creds.password}/${streamId}.${ext}`;
}

export function buildSeriesEpisodeUrl(creds: IptvCredentials, episodeId: string | number, ext: string, directSource?: string) {
  if (directSource && directSource.startsWith("http")) return directSource;
  const base = (creds.streamBase || creds.server || "").replace(/\/+$/, "");
  return `${base}/series/${creds.username}/${creds.password}/${episodeId}.${ext || "mp4"}`;
}

export async function requestStreamToken(params: { url: string, kind: string, iptvUsername?: string, mode: StreamMode }) {
  const { data, error } = await supabase.functions.invoke("stream-token", { body: params });
  if (error) throw error;
  return data as { token: string, expires_at: string, signed_url: string, url: string };
}

export async function primeStreamToken(params: { url: string, kind: string, iptvUsername?: string, mode: string, signal?: AbortSignal }) {
  return requestStreamToken({ url: params.url, kind: params.kind, iptvUsername: params.iptvUsername, mode: params.mode as any });
}

export function proxyImageUrl(url: string | null | undefined, opts?: { w?: number, h?: number, q?: number }) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  const params = new URLSearchParams();
  params.set("url", trimmed.replace(/^https?:\/\//i, ""));
  if (opts?.w) params.set("w", String(opts.w));
  if (opts?.h) params.set("h", String(opts.h));
  return `https://images.weserv.nl/?${params.toString()}`;
}

const PROXY_HOST_PREFIX = "iptv.proxy.host:";
const ENGINE_PREF_PREFIX = "iptv.engine.pref:";

export function getHostProxyMode(url: string | null | undefined): StreamMode {
  if (!url) return "redirect";
  try {
    const host = new URL(url).hostname;
    return (localStorage.getItem(`${PROXY_HOST_PREFIX}${host}`) as StreamMode) || "redirect";
  } catch { return "redirect"; }
}

export function markHostProxyRequired(url: string | null | undefined, reason: string) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    localStorage.setItem(`${PROXY_HOST_PREFIX}${host}`, "stream");
    return true;
  } catch { return false; }
}

export function clearHostProxyMode(url: string | null | undefined) {
  if (!url) return;
  try {
    const host = new URL(url).hostname;
    localStorage.removeItem(`${PROXY_HOST_PREFIX}${host}`);
  } catch {}
}

export function markHostSuccess(url: string | null | undefined) {}
export function markHostFailure(url: string | null | undefined, reason: string) {}

export function shouldUseProxy(url: string | null | undefined): boolean {
  return getHostProxyMode(url) === "stream";
}

export function getPreferredEngine(url: string | null | undefined): "hls" | "mpegts" {
  if (!url) return "hls";
  try {
    const host = new URL(url).hostname;
    return (localStorage.getItem(`${ENGINE_PREF_PREFIX}${host}`) as any) || "hls";
  } catch { return "hls"; }
}

export function setPreferredEngine(url: string | null | undefined, engine: "hls" | "mpegts") {
  if (!url) return;
  try {
    const host = new URL(url).hostname;
    localStorage.setItem(`${ENGINE_PREF_PREFIX}${host}`, engine);
  } catch {}
}

export type PlaybackStrategy = { mode: "internal", type: "hls" | "native" } | { mode: "external" } | { mode: "error", reason: string };

export function getPlaybackStrategy(ext?: string, url?: string): PlaybackStrategy {
  const e = (ext || "").toLowerCase().replace(/^\./, "");
  if (e === "m3u8" || url?.includes(".m3u8")) return { mode: "internal", type: "hls" };
  if (["mp4", "webm", "m4v"].includes(e)) return { mode: "internal", type: "native" };
  if (["mkv", "avi", "mov", "ts"].includes(e)) return { mode: "external" };
  return { mode: "internal", type: "native" };
}

export function isValidStreamUrl(url?: string | null): url is string {
  return !!url && (url.startsWith("http://") || url.startsWith("https://"));
}

export function getFormatBadge(ext?: string, url?: string | null) {
  const strategy = getPlaybackStrategy(ext, url || undefined);
  if (strategy.mode === "external") return { label: "EXTERNO", tone: "yellow", tooltip: "Player externo" };
  return { label: "STREAM", tone: "blue", tooltip: "Streaming" };
}

export function getStreamType(ext?: string, url?: string): any {
  const strategy = getPlaybackStrategy(ext, url);
  return strategy.mode === "internal" ? strategy.type : "native";
}

export function isExternalOnly(ext?: string, url?: string | null): boolean {
  return getPlaybackStrategy(ext, url || undefined).mode === "external";
}

export function normalizeExt(ext?: string): string {
  return (ext || "").toLowerCase().replace(/^\./, "");
}

export function reportStreamEvent(event: string, payload: any) {
  supabase.functions.invoke("stream-events", { body: { event, ...payload } }).catch(() => {});
}
