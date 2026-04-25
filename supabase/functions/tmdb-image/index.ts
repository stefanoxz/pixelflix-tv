// Edge function: tmdb-image
// Resolves missing covers/synopsis via TMDB. Caches results in `tmdb_image_cache`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const CACHE_TTL_HIT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for hits
const CACHE_TTL_MISS_MS = 24 * 60 * 60 * 1000; // 1 day for misses (auto-retry)

interface ReqBody {
  type: "movie" | "series";
  tmdb_id?: string | number | null;
  name?: string | null;
  year?: string | number | null;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Strip trailing year, season suffixes (S01E01), and " - subtitle" tails. */
function cleanQuery(name: string): string {
  return name
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .replace(/\s+S\d{1,2}(E\d{1,3})?\s*$/i, "")
    .replace(/\s+(temporada|season)\s+\d+\s*$/i, "")
    .replace(/\s+-\s+.*$/, "")
    .trim();
}

function buildCacheKey(p: ReqBody): string {
  const tmdbType = p.type === "series" ? "tv" : "movie";
  if (p.tmdb_id) return `${tmdbType}:id:${p.tmdb_id}`;
  return `${tmdbType}:q:${slug(p.name || "")}:${p.year || ""}`;
}

async function tmdbAuthFetch(url: string): Promise<Response> {
  const key = TMDB_API_KEY.trim();
  // v4 read-access tokens are JWTs (start with "ey" and contain dots)
  if (key.startsWith("ey") && key.split(".").length === 3) {
    return fetch(url, {
      headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
    });
  }
  // v3: append api_key query param
  const sep = url.includes("?") ? "&" : "?";
  return fetch(`${url}${sep}api_key=${encodeURIComponent(key)}`, {
    headers: { accept: "application/json" },
  });
}

interface TmdbResult {
  id?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  popularity?: number;
}

async function fetchByTmdbId(
  tmdbType: "movie" | "tv",
  id: string | number,
): Promise<TmdbResult | null> {
  const r = await tmdbAuthFetch(
    `${TMDB_BASE}/${tmdbType}/${id}?language=pt-BR`,
  );
  if (!r.ok) return null;
  return (await r.json()) as TmdbResult;
}

async function searchTmdb(
  tmdbType: "movie" | "tv",
  name: string,
  year?: string | number | null,
): Promise<TmdbResult | null> {
  const cleaned = cleanQuery(name);
  // Cascade: try most specific first, then progressively relax filters.
  const candidates: Array<{ q: string; year?: string | number | null }> = [];
  if (year) candidates.push({ q: name, year });
  if (year && cleaned !== name) candidates.push({ q: cleaned, year });
  candidates.push({ q: cleaned });
  if (cleaned !== name) candidates.push({ q: name });

  for (const c of candidates) {
    if (!c.q) continue;
    const params = new URLSearchParams({
      query: c.q,
      language: "pt-BR",
      include_adult: "false",
    });
    if (c.year) {
      params.set(
        tmdbType === "movie" ? "year" : "first_air_date_year",
        String(c.year),
      );
    }
    try {
      const r = await tmdbAuthFetch(`${TMDB_BASE}/search/${tmdbType}?${params}`);
      if (!r.ok) continue;
      const data = await r.json();
      const results = (data?.results || []) as TmdbResult[];
      if (results.length > 0) {
        // Sort by popularity to disambiguate common titles.
        results.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
        console.log(
          `[tmdb-image] hit q="${c.q}" year=${c.year ?? "-"} -> id=${results[0].id}`,
        );
        return results[0];
      }
    } catch (e) {
      console.error("[tmdb-image] search error", c, e);
    }
  }
  console.log(
    `[tmdb-image] miss type=${tmdbType} name="${name}" year=${year ?? "-"}`,
  );
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!TMDB_API_KEY) {
    return jsonResponse(500, { error: "TMDB_API_KEY not configured" });
  }

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  if (!body?.type || (body.type !== "movie" && body.type !== "series")) {
    return jsonResponse(400, { error: "type required (movie|series)" });
  }
  if (!body.tmdb_id && !body.name) {
    return jsonResponse(400, { error: "tmdb_id or name required" });
  }

  const cacheKey = buildCacheKey(body);
  const tmdbType: "movie" | "tv" = body.type === "series" ? "tv" : "movie";

  // 1. Cache check (split TTL: hits last 30d, misses 1d for retry)
  const { data: cached } = await supabase
    .from("tmdb_image_cache")
    .select("poster_url,backdrop_url,overview,fetched_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    const isMiss = !cached.poster_url && !cached.backdrop_url;
    const ttl = isMiss ? CACHE_TTL_MISS_MS : CACHE_TTL_HIT_MS;
    if (age < ttl) {
      return jsonResponse(200, {
        poster: cached.poster_url,
        backdrop: cached.backdrop_url,
        overview: cached.overview ?? null,
        cached: true,
      });
    }
  }

  // 2. Fetch from TMDB
  let result: TmdbResult | null = null;
  try {
    if (body.tmdb_id) {
      result = await fetchByTmdbId(tmdbType, body.tmdb_id);
    }
    if (!result && body.name) {
      result = await searchTmdb(tmdbType, body.name, body.year);
      // Search results sometimes lack overview; fetch full details to enrich.
      if (result?.id && !result.overview) {
        const full = await fetchByTmdbId(tmdbType, result.id);
        if (full) result = { ...result, ...full };
      }
    }
  } catch (e) {
    console.error("[tmdb-image] fetch error", e);
  }

  const poster = result?.poster_path
    ? `${IMG_BASE}/w500${result.poster_path}`
    : null;
  const backdrop = result?.backdrop_path
    ? `${IMG_BASE}/w1280${result.backdrop_path}`
    : null;
  const overview = result?.overview || null;

  // 3. Persist (even nulls — short TTL handles retries automatically)
  await supabase.from("tmdb_image_cache").upsert(
    {
      cache_key: cacheKey,
      poster_url: poster,
      backdrop_url: backdrop,
      overview,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );

  return jsonResponse(200, { poster, backdrop, overview, cached: false });
});
