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

function buildUrl(path: string, params: Record<string, string> = {}): string {
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
  cast?: string[];
  director?: string;
}

// ─────────────────────────────────────────────
// Title cleaning: remove IPTV-specific suffixes
// ─────────────────────────────────────────────
const NOISE = [
  /\b(legendado|dublado|nacional|cinema|sinopse|completo|full|hd|fhd|4k|uhd|8k|bluray|blu-ray|web-dl|webdl|webrip|bdrip|dvdrip|ts|cam|hdcam|hdts)\b/gi,
  /\s*\(\d{4}\)\s*/g,     // (2025)
  /\s*\[\d{4}\]\s*/g,     // [2025]
  /\s*-\s*\d{4}\s*/g,     // - 2025
  /\s*s\d{2}e\d{2}.*/gi,  // S01E01...
  /\s+\d{3,4}p\b/gi,      // 720p, 1080p
  /\s{2,}/g,               // multiple spaces
];

function cleanTitle(raw: string): string {
  let t = raw;
  for (const re of NOISE) t = t.replace(re, ' ');
  return t.trim();
}

// Extract year from raw title if present
function extractYear(raw: string): string | undefined {
  const m = raw.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : undefined;
}

// ─────────────────────────────────────────────
// Core fetch helpers
// ─────────────────────────────────────────────
async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: headers() });
  return res.json();
}

async function searchEndpoint(
  endpoint: string,
  query: string,
  year?: string
): Promise<any[]> {
  const params: Record<string, string> = { query };
  if (year) params['year'] = year;
  try {
    const data = await fetchJson(buildUrl(endpoint, params));
    return data.results || [];
  } catch {
    return [];
  }
}

async function fetchDetail(path: string): Promise<any> {
  try { return await fetchJson(buildUrl(path, { append_to_response: 'credits' })); }
  catch { return {}; }
}

// ─────────────────────────────────────────────
// Build TmdbMeta from a raw TMDB result + detail
// ─────────────────────────────────────────────
function buildMeta(hit: any, detail: any, isMovie: boolean): TmdbMeta {
  return {
    title:         detail.title || detail.name || hit.title || hit.name || '',
    originalTitle: detail.original_title || detail.original_name || '',
    synopsis:      detail.overview || hit.overview || '',
    rating:        (hit.vote_average ?? detail.vote_average)?.toFixed(1) || '',
    year:          (detail.release_date || detail.first_air_date || hit.release_date || hit.first_air_date || '').substring(0, 4),
    genres:        (detail.genres || []).map((g: any) => g.name),
    backdrop:      hit.backdrop_path ? `${IMG}/original${hit.backdrop_path}` : '',
    poster:        hit.poster_path   ? `${IMG}/w500${hit.poster_path}`       : '',
    runtime:       isMovie
      ? (detail.runtime ? `${detail.runtime} min` : undefined)
      : (detail.episode_run_time?.[0] ? `${detail.episode_run_time[0]} min/ep` : undefined),
    tagline:       detail.tagline || undefined,
    tmdbId:        hit.id,
    cast:          (detail.credits?.cast || []).slice(0, 5).map((c: any) => c.name),
    director:      (detail.credits?.crew || []).find((c: any) => c.job === 'Director')?.name,
  };
}

// ─────────────────────────────────────────────
// Multi-strategy search
// ─────────────────────────────────────────────
async function multiSearch(
  rawName: string,
  endpoint: '/search/movie' | '/search/tv',
  detailPath: (id: number) => string,
  isMovie: boolean
): Promise<TmdbMeta | null> {
  const cleaned = cleanTitle(rawName);
  const year    = extractYear(rawName);

  // Strategy list: most specific → least specific
  const strategies: { query: string; year?: string }[] = [
    { query: cleaned, year },          // cleaned + year
    { query: cleaned },                // cleaned, no year
    { query: rawName.trim() },         // raw name
  ];

  // Also try first N words if title is long
  const words = cleaned.split(' ');
  if (words.length > 3) {
    strategies.push({ query: words.slice(0, 4).join(' ') });
    strategies.push({ query: words.slice(0, 3).join(' ') });
  }

  for (const strategy of strategies) {
    const results = await searchEndpoint(endpoint, strategy.query, strategy.year);
    if (results.length === 0) continue;

    const hit = results[0];
    const detail = await fetchDetail(detailPath(hit.id));

    // Accept result if it has a description (overview)
    const hasOverview = !!(detail.overview || hit.overview);
    if (hasOverview || results.length > 0) {
      return buildMeta(hit, detail, isMovie);
    }
  }

  // Last resort: try with language=en-US (some titles only have English descriptions)
  try {
    const params: Record<string, string> = { query: cleaned, language: 'en-US' };
    if (API_KEY) params['api_key'] = API_KEY!;
    const res = await fetch(`${BASE}${endpoint}?${new URLSearchParams(params)}`, { headers: headers() });
    const data = await res.json();
    const hit = data.results?.[0];
    if (hit) {
      const detail = await fetchDetail(detailPath(hit.id));
      return buildMeta(hit, detail, isMovie);
    }
  } catch {}

  return null;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────
const cache = new Map<string, TmdbMeta | null>();

export async function enrichFromTmdb(
  rawName: string,
  type: 'movie' | 'series'
): Promise<TmdbMeta | null> {
  if (!API_KEY && !TOKEN) return null;

  const key = `${type}::${rawName.toLowerCase().trim()}`;
  if (cache.has(key)) return cache.get(key)!;

  const result = type === 'movie'
    ? await multiSearch(rawName, '/search/movie', (id) => `/movie/${id}`, true)
    : await multiSearch(rawName, '/search/tv',    (id) => `/tv/${id}`,    false);

  cache.set(key, result);
  return result;
}
