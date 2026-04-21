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

export function buildLiveStreamUrl(creds: IptvCredentials, streamId: number): string {
  const base = creds.server.replace(/\/+$/, "");
  return `${base}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
}

export function buildVodStreamUrl(creds: IptvCredentials, streamId: number, ext: string): string {
  const base = creds.server.replace(/\/+$/, "");
  return `${base}/movie/${creds.username}/${creds.password}/${streamId}.${ext}`;
}

export function buildSeriesEpisodeUrl(
  creds: IptvCredentials,
  episodeId: string | number,
  ext: string,
): string {
  const base = creds.server.replace(/\/+$/, "");
  return `${base}/series/${creds.username}/${creds.password}/${episodeId}.${ext || "mp4"}`;
}

export function proxyUrl(url: string): string {
  return `${FUNCTIONS_BASE}/stream-proxy?url=${encodeURIComponent(url)}`;
}
