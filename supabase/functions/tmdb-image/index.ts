// Edge function: tmdb-image
// Resolves missing covers via TMDB. Caches results in `tmdb_image_cache`.
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

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

function buildCacheKey(p: ReqBody): string {
  const tmdbType = p.type === "series" ? "tv" : "movie";
  if (p.tmdb_id) return `${tmdbType}:id:${p.tmdb_id}`;
  return `${tmdbType}:q:${slug(p.name || "")}:${p.year || ""}`;
}

async function tmdbAuthFetch(url: string): Promise<Response> {
  // Supports both v3 keys and v4 read-access tokens.
  const key = TMDB_API_KEY.trim();
  // v4 tokens are JWTs (start with "ey" and contain dots)
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
  poster_path?: string | null;
  backdrop_path?: string | null;
  id?: number;
}

async function fetchByTmdbId(
  tmdbType: "movie" | "tv",
  id: string | number,
): Promise<TmdbResult | null> {
  const r = await tmdbAuthFetch(`${TMDB_BASE}/${tmdbType}/${id}`);
  if (!r.ok) return null;
  return (await r.json()) as TmdbResult;
}

async function searchTmdb(
  tmdbType: "movie" | "tv",
  name: string,
  year?: string | number | null,
): Promise<TmdbResult | null> {
  const params = new URLSearchParams({ query: name, language: "pt-BR" });
  if (year) {
    params.set(tmdbType === "movie" ? "year" : "first_air_date_year", String(year));
  }
  const r = await tmdbAuthFetch(`${TMDB_BASE}/search/${tmdbType}?${params}`);
  if (!r.ok) return null;
  const data = await r.json();
  const first = (data?.results || [])[0];
  return first || null;
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

  // 1. Check cache
  const { data: cached } = await supabase
    .from("tmdb_image_cache")
    .select("poster_url,backdrop_url,fetched_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < CACHE_TTL_MS) {
      return jsonResponse(200, {
        poster: cached.poster_url,
        backdrop: cached.backdrop_url,
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

  // 3. Store in cache (even nulls — avoid hammering TMDB for unknown items)
  await supabase.from("tmdb_image_cache").upsert(
    {
      cache_key: cacheKey,
      poster_url: poster,
      backdrop_url: backdrop,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );

  return jsonResponse(200, { poster, backdrop, cached: false });
});
