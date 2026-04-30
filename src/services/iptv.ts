import { supabase } from "@/integrations/supabase/client";
import {
  reportDiagnostic,
  runQuickSpeedProbe,
  classifyOutcome,
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
// Connectivity, telemetry, global request queue
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

export async function iptvLogin(creds: IptvCredentials) {
  return invokeSafe<LoginResponse & { server_url?: string }>("iptv-login", { ...creds, mode: "login" }, "login").then(r => {
    if (!r.ok) throw new IptvLoginError(r.error, r.code, r.extra?.debug as any);
    return r.data;
  });
}

export async function iptvLoginM3u(creds: IptvCredentials) {
  return invokeSafe<LoginResponse & { server_url?: string; auto_registered?: boolean }>("iptv-login", { ...creds, mode: "m3u_register" }, "login").then(r => {
    if (!r.ok) throw new IptvLoginError(r.error, r.code, r.extra?.debug as any);
    return r.data;
  });
}

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
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, code: "UNKNOWN", error: e.message };
  }
}

export async function fetchAllowedServers(): Promise<string[]> {
  const r = await invokeSafe<{ allowed: boolean, candidates?: string[] }>("iptv-login", { mode: "validate" });
  return r.ok && r.data.allowed ? r.data.candidates ?? [] : [];
}

export function isHostAllowed(candidate: string | null | undefined, allowed?: string[] | null): boolean {
  if (!candidate || !allowed?.length) return false;
  const h = candidate.toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  return allowed.some(a => a.toLowerCase().includes(h));
}

export function resolveStreamBase(serverInfo?: ServerInfo | null, fallback?: string, allowed?: string[] | null): string {
  if (serverInfo?.url && isHostAllowed(serverInfo.url, allowed)) {
     const proto = (serverInfo.server_protocol || "http").toLowerCase();
     return `${proto}://${serverInfo.url.replace(/^https?:\/\//i, "")}:${serverInfo.port || 80}`;
  }
  return fallback || "";
}

export async function iptvFetch<T>(creds: IptvCredentials, action: string, extra: any = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("iptv-categories", { body: { ...creds, action, ...extra } });
  if (error) throw error;
  return data as T;
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
      id: raw.id || raw.epg_id,
      title: atob(raw.title || ""),
      description: atob(raw.description || ""),
      startMs: Number(raw.start_timestamp) * 1000,
      endMs: Number(raw.stop_timestamp) * 1000,
    }));
  } catch { return []; }
}

export function buildLiveStreamUrl(creds: IptvCredentials, streamId: number, directSource?: string) {
  if (directSource) return directSource;
  const base = (creds.streamBase || creds.server || "").replace(/\/+$/, "");
  return `${base}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
}

export function buildVodStreamUrl(creds: IptvCredentials, streamId: number, ext: string, directSource?: string) {
  if (directSource) return directSource;
  const base = (creds.streamBase || creds.server || "").replace(/\/+$/, "");
  return `${base}/movie/${creds.username}/${creds.password}/${streamId}.${ext}`;
}

export function buildSeriesEpisodeUrl(creds: IptvCredentials, episodeId: string | number, ext: string, directSource?: string) {
  if (directSource) return directSource;
  const base = (creds.streamBase || creds.server || "").replace(/\/+$/, "");
  return `${base}/series/${creds.username}/${creds.password}/${episodeId}.${ext || "mp4"}`;
}

export async function requestStreamToken(url: string) {
  const { data, error } = await supabase.functions.invoke("stream-token", { body: { url } });
  if (error) throw error;
  return data as { token: string, expires_at: string, signed_url: string };
}

export function proxyImageUrl(url: string | null | undefined, opts?: { w?: number, h?: number, q?: number }) {
  if (!url) return "";
  const params = new URLSearchParams();
  params.set("url", url.replace(/^https?:\/\//i, ""));
  if (opts?.w) params.set("w", String(opts.w));
  if (opts?.h) params.set("h", String(opts.h));
  return `https://images.weserv.nl/?${params.toString()}`;
}

export function getHostProxyMode(url: string | null | undefined): StreamMode {
  return "redirect";
}

export function markHostProxyRequired(url: string | null | undefined, reason: string) {
  return true;
}

export function clearHostProxyMode(url: string | null | undefined) {}

export function markHostSuccess(url: string | null | undefined) {}
export function markHostFailure(url: string | null | undefined, reason: string) {}

export function shouldUseProxy(url: string | null | undefined): boolean {
  return false;
}

export function getPreferredEngine(url: string | null | undefined): "hls" | "mpegts" {
  return "hls";
}

export function setPreferredEngine(url: string | null | undefined, engine: "hls" | "mpegts") {}

export async function primeStreamToken(url: string) {
  return requestStreamToken(url);
}

export type PlaybackStrategy = { mode: "internal", type: "hls" | "native" } | { mode: "external" } | { mode: "error", reason: string };

export function getPlaybackStrategy(ext?: string, url?: string): PlaybackStrategy {
  return { mode: "internal", type: "hls" };
}

export function isValidStreamUrl(url?: string | null): url is string {
  return !!url && (url.startsWith("http://") || url.startsWith("https://"));
}

export function getFormatBadge(ext?: string, url?: string | null) {
  return { label: "STREAM", tone: "blue", tooltip: "Streaming" };
}

export function getStreamType(ext?: string, url?: string): any {
  return "hls";
}

export function isExternalOnly(ext?: string, url?: string | null): boolean {
  return false;
}

export function normalizeExt(ext?: string): string {
  return (ext || "").toLowerCase().replace(/^\./, "");
}

export function reportStreamEvent(body: any) {
  supabase.functions.invoke("stream-events", { body }).catch(() => {});
}

export function isRealOnline() { return true; }
export function subscribeConnectivity(fn: any) { return () => {}; }
export function getQueueStats() { return { health: "healthy" }; }
export function getTelemetrySnapshot() { return []; }

// Backward compatibility exports
export {
  iptvLogin,
  iptvLoginM3u,
  fetchAllowedServers,
  resolveStreamBase,
  isHostAllowed,
  IptvLoginError,
  getLiveCategories,
  getLiveStreams,
  getVodCategories,
  getVodStreams,
  getSeriesCategories,
  getSeries,
  getSeriesInfo,
  getVodInfo,
  iptvFetch,
  buildLiveStreamUrl,
  buildVodStreamUrl,
  buildSeriesEpisodeUrl,
  requestStreamToken,
  reportStreamEvent,
  getHostProxyMode,
  markHostProxyRequired,
  clearHostProxyMode,
  getPlaybackStrategy,
  isValidStreamUrl,
  getFormatBadge,
  getStreamType,
  isExternalOnly,
  normalizeExt,
  getShortEpg,
  proxyImageUrl,
  connectivityConfig,
  setConnectivityConfig,
  getTelemetrySnapshot,
  isRealOnline,
  subscribeConnectivity,
  getQueueStats
};

// Export types
export type {
  IptvCredentials,
  LoginResponse,
  Category,
  LiveStream,
  VodStream,
  Series,
  EpgEntry
};
