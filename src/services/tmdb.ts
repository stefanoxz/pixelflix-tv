// TMDB metadata enrichment service
// Uses API key (v3) with Bearer token fallback

const API_KEY = import.meta.env.VITE_TMDB_API_KEY as string | undefined;
const TOKEN   = import.meta.env.VITE_TMDB_TOKEN   as string | undefined;
const BASE    = 'https://api.themoviedb.org/3';
const IMG     = 'https://image.tmdb.org/t/p';

function headers(): Record<string, string> {
  if (TOKEN && !API_KEY) return { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  return {};
}

function url(path: string, params: Record<string, string> = {}): string {
  const q = new URLSearchParams({ language: 'pt-BR', ...params });
  if (API_KEY) q.set('api_key', API_KEY);
  return `${BASE}${path}?${q}`;
}

export interface TmdbMeta {
  title: string;
  originalTitle: string;
  synopsis: string;
  rating: string;
  year: string;
  genres: string[];
  backdrop: string;
  poster: string;
  runtime?: string;
  tagline?: string;
  tmdbId: number;
}

async function searchMovie(name: string): Promise<TmdbMeta | null> {
  try {
    const res = await fetch(url('/search/movie', { query: name }), { headers: headers() });
    const json = await res.json();
    const hit = json.results?.[0];
    if (!hit) return null;

    // Fetch full detail for runtime + genres
    const detail = await fetch(url(`/movie/${hit.id}`), { headers: headers() }).then(r => r.json());

    return {
      title:         detail.title || hit.title,
      originalTitle: detail.original_title || '',
      synopsis:      detail.overview || hit.overview || '',
      rating:        hit.vote_average?.toFixed(1) || '',
      year:          (detail.release_date || hit.release_date || '').substring(0, 4),
      genres:        (detail.genres || []).map((g: any) => g.name),
      backdrop:      hit.backdrop_path ? `${IMG}/original${hit.backdrop_path}` : '',
      poster:        hit.poster_path   ? `${IMG}/w500${hit.poster_path}`       : '',
      runtime:       detail.runtime ? `${detail.runtime} min` : undefined,
      tagline:       detail.tagline || undefined,
      tmdbId:        hit.id,
    };
  } catch {
    return null;
  }
}

async function searchSeries(name: string): Promise<TmdbMeta | null> {
  try {
    const res = await fetch(url('/search/tv', { query: name }), { headers: headers() });
    const json = await res.json();
    const hit = json.results?.[0];
    if (!hit) return null;

    const detail = await fetch(url(`/tv/${hit.id}`), { headers: headers() }).then(r => r.json());

    return {
      title:         detail.name || hit.name,
      originalTitle: detail.original_name || '',
      synopsis:      detail.overview || hit.overview || '',
      rating:        hit.vote_average?.toFixed(1) || '',
      year:          (detail.first_air_date || hit.first_air_date || '').substring(0, 4),
      genres:        (detail.genres || []).map((g: any) => g.name),
      backdrop:      hit.backdrop_path ? `${IMG}/original${hit.backdrop_path}` : '',
      poster:        hit.poster_path   ? `${IMG}/w500${hit.poster_path}`       : '',
      runtime:       detail.episode_run_time?.[0] ? `${detail.episode_run_time[0]} min/ep` : undefined,
      tagline:       detail.tagline || undefined,
      tmdbId:        hit.id,
    };
  } catch {
    return null;
  }
}

// Shared in-memory cache to avoid repeated searches
const cache = new Map<string, TmdbMeta | null>();

export async function enrichFromTmdb(
  name: string,
  type: 'movie' | 'series'
): Promise<TmdbMeta | null> {
  if (!API_KEY && !TOKEN) return null;
  const key = `${type}::${name.toLowerCase().trim()}`;
  if (cache.has(key)) return cache.get(key)!;
  const result = type === 'movie' ? await searchMovie(name) : await searchSeries(name);
  cache.set(key, result);
  return result;
}
