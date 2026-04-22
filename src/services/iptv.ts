import { supabase } from "@/integrations/supabase/client";

export interface IptvCredentials {
  server?: string;
  username: string;
  password: string;
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

function serverBase(creds: IptvCredentials): string {
  return (creds.server || "").replace(/\/+$/, "");
}

export function buildLiveStreamUrl(creds: IptvCredentials, streamId: number): string {
  return `${serverBase(creds)}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
}

export function buildVodStreamUrl(creds: IptvCredentials, streamId: number, ext: string): string {
  return `${serverBase(creds)}/movie/${creds.username}/${creds.password}/${streamId}.${ext}`;
}

export function buildSeriesEpisodeUrl(
  creds: IptvCredentials,
  episodeId: string | number,
  ext: string,
): string {
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

export function isBrowserPlayable(ext?: string): boolean {
  const e = normalizeExt(ext);
  return ["mp4", "m3u8", "webm"].includes(e);
}

export function isExternalOnly(ext?: string): boolean {
  const e = normalizeExt(ext);
  return ["mkv", "avi", "mov"].includes(e);
}

export type StreamType = "hls" | "video" | "external" | "unknown";

/**
 * Detecta o tipo de stream a partir da extensão e/ou URL.
 * - hls: m3u8 (precisa de hls.js ou suporte nativo Safari)
 * - video: mp4/webm (player nativo do navegador)
 * - external: mkv/avi/mov (não tocam no browser, precisam de player externo)
 */
export function getStreamType(ext?: string, url?: string): StreamType {
  const e = normalizeExt(ext);
  const u = (url || "").toLowerCase().split("?")[0];

  if (e === "m3u8" || u.includes(".m3u8") || u.includes("mpegurl")) return "hls";
  if (["mp4", "webm"].includes(e) || u.endsWith(".mp4") || u.endsWith(".webm")) return "video";
  if (["mkv", "avi", "mov"].includes(e) || /\.(mkv|avi|mov)$/.test(u)) return "external";

  return "unknown";
}

export type PlaybackStrategy =
  | { mode: "internal"; type: "hls" | "native" }
  | { mode: "external" }
  | { mode: "error"; reason: string };

/**
 * Decide como reproduzir um stream:
 * - internal/hls: usa hls.js (ou fallback nativo Safari)
 * - internal/native: tag <video> direto
 * - external: mostra botão pra abrir em VLC/MX Player
 * - error: URL inválida ou tipo desconhecido
 */
export function getPlaybackStrategy(ext?: string, url?: string): PlaybackStrategy {
  if (!isValidStreamUrl(url)) return { mode: "error", reason: "URL de stream inválida" };

  const type = getStreamType(ext, url);
  if (type === "hls") return { mode: "internal", type: "hls" };
  if (type === "video") return { mode: "internal", type: "native" };
  if (type === "external") return { mode: "external" };

  // unknown: tenta player nativo via proxy como último recurso
  return { mode: "internal", type: "native" };
}

/**
 * Valida se a URL é minimamente segura pra ser passada ao player.
 * Aceita apenas http(s) absoluto ou a URL do nosso proxy.
 */
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

export function getFormatBadge(ext?: string): FormatBadgeInfo {
  const e = normalizeExt(ext);
  if (e === "mp4")
    return { label: "MP4", tone: "green", tooltip: "Compatível com navegador" };
  if (e === "m3u8")
    return { label: "STREAM", tone: "blue", tooltip: "Streaming HLS" };
  if (e === "mkv" || e === "avi" || e === "mov")
    return { label: "EXTERNO", tone: "yellow", tooltip: "Abrir em player externo" };
  return { label: e.toUpperCase() || "?", tone: "gray", tooltip: "Formato desconhecido" };
}
