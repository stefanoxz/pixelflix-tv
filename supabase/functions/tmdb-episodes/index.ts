// Edge function: tmdb-episodes
// Fetches Brazilian Portuguese (pt-BR) titles + overviews for the episodes of
// a given series/season from TMDB and caches them in `tmdb_episode_cache`.
// The IPTV provider returns episode plots in English; we overlay the pt-BR
// data on the client without ever touching playback fields, so failures here
// degrade gracefully to the original server data.
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

const CACHE_TTL_HIT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_TTL_MISS_MS = 24 * 60 * 60 * 1000; // 1 day for misses

interface ReqBody {
  tmdb_id: string | number;
  season: string | number;
}

interface CachedEpisode {
  episode_number: number;
  name: string | null;
  overview: string | null;
  still: string | null;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function tmdbAuthFetch(url: string): Promise<Response> {
  const key = TMDB_API_KEY.trim();
  if (key.startsWith("ey") && key.split(".").length === 3) {
    return fetch(url, {
      headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
    });
  }
  const sep = url.includes("?") ? "&" : "?";
  return fetch(`${url}${sep}api_key=${encodeURIComponent(key)}`, {
    headers: { accept: "application/json" },
  });
}

interface TmdbSeasonResponse {
  episodes?: Array<{
    episode_number?: number;
    name?: string | null;
    overview?: string | null;
    still_path?: string | null;
  }>;
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

  const tmdbIdNum = Number(body?.tmdb_id);
  const seasonNum = Number(body?.season);
  if (!Number.isFinite(tmdbIdNum) || tmdbIdNum <= 0) {
    return jsonResponse(400, { error: "tmdb_id required" });
  }
  if (!Number.isFinite(seasonNum) || seasonNum < 0) {
    return jsonResponse(400, { error: "season required" });
  }

  const cacheKey = `tv:${tmdbIdNum}:s:${seasonNum}`;

  // 1) Cache check
  const { data: cached } = await supabase
    .from("tmdb_episode_cache")
    .select("episodes,fetched_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    const isMiss =
      !Array.isArray(cached.episodes) || cached.episodes.length === 0;
    const ttl = isMiss ? CACHE_TTL_MISS_MS : CACHE_TTL_HIT_MS;
    if (age < ttl) {
      return jsonResponse(200, {
        episodes: cached.episodes ?? [],
        cached: true,
      });
    }
  }

  // 2) Fetch from TMDB
  let episodes: CachedEpisode[] = [];
  try {
    const r = await tmdbAuthFetch(
      `${TMDB_BASE}/tv/${tmdbIdNum}/season/${seasonNum}?language=pt-BR`,
    );
    if (r.ok) {
      const data = (await r.json()) as TmdbSeasonResponse;
      episodes = (data.episodes ?? []).map((e) => ({
        episode_number: Number(e.episode_number ?? 0),
        name: e.name ?? null,
        overview: e.overview ?? null,
        still: e.still_path ? `${IMG_BASE}/w300${e.still_path}` : null,
      }));
    } else {
      console.log(
        `[tmdb-episodes] miss tmdb_id=${tmdbIdNum} season=${seasonNum} status=${r.status}`,
      );
    }
  } catch (e) {
    console.error("[tmdb-episodes] fetch error", e);
  }

  // 3) Persist (even empty arrays — short TTL handles retries)
  await supabase.from("tmdb_episode_cache").upsert(
    {
      cache_key: cacheKey,
      tmdb_id: tmdbIdNum,
      season_number: seasonNum,
      episodes,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );

  return jsonResponse(200, { episodes, cached: false });
});
