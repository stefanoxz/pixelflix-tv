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

export async function iptvLogin(
  creds: IptvCredentials
): Promise<LoginResponse & { server_url?: string }> {
  const { data, error } = await supabase.functions.invoke("iptv-login", { body: creds });
  if (error) throw new Error(error.message || "Falha no login");
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as LoginResponse & { server_url?: string };
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
  const { data, error } = await supabase.functions.invoke("iptv-categories", {
    body: { ...creds, action, ...extra },
  });
  if (error) throw new Error(error.message || `Falha ao buscar ${action}`);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
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
 * Proxy de streaming via edge function HTTPS.
 * Necessário para evitar mixed content quando o app roda em HTTPS
 * e a origem do stream é HTTP. Também reescreve playlists HLS.
 */
export function proxyUrl(url: string): string {
  return `${FUNCTIONS_BASE}/stream-proxy?url=${encodeURIComponent(url)}`;
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
