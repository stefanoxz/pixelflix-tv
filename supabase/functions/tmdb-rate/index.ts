// Edge function: tmdb-rate
// Returns TMDB vote_average + vote_count for a movie/series, used by the
// Highlights page to rank items by *real* popularity. The IPTV provider's
// rating_5based field is "5" for nearly every catalog entry, making any
// ranking based on it effectively arbitrary.
//
// No DB persistence — kept lightweight on purpose. The client caches results
// via React Query (24h staleTime). TMDB tolerates the occasional batch of
// 60-90 lookups easily.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") ?? "";

interface ReqBody {
  type: "movie" | "series";
  tmdb_id?: string | number | null;
  name?: string | null;
  year?: string | number | null;
}

interface RateResult {
  vote_average: number | null;
  vote_count: number | null;
  tmdb_id: number | null;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanQuery(name: string): string {
  return name
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .replace(/\s+S\d{1,2}(E\d{1,3})?\s*$/i, "")
    .replace(/\s+(temporada|season)\s+\d+\s*$/i, "")
    .replace(/\s+-\s+.*$/, "")
    .trim();
}

async function tmdbAuthFetch(url: string): Promise<Response> {
  const key = TMDB_API_KEY.trim();
  // v4 read-access tokens are JWTs (start with "ey" and contain dots)
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

interface TmdbRow {
  id?: number;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
}

async function fetchById(
  tmdbType: "movie" | "tv",
  id: string | number,
): Promise<TmdbRow | null> {
  const r = await tmdbAuthFetch(
    `${TMDB_BASE}/${tmdbType}/${id}?language=en-US`,
  );
  if (!r.ok) return null;
  return (await r.json()) as TmdbRow;
}

async function searchTmdb(
  tmdbType: "movie" | "tv",
  name: string,
  year?: string | number | null,
): Promise<TmdbRow | null> {
  const cleaned = cleanQuery(name);
  // Most specific match first, then progressively relax.
  const candidates: Array<{ q: string; year?: string | number | null }> = [];
  if (year) candidates.push({ q: name, year });
  if (year && cleaned !== name) candidates.push({ q: cleaned, year });
  candidates.push({ q: cleaned });

  for (const c of candidates) {
    if (!c.q) continue;
    const params = new URLSearchParams({
      query: c.q,
      language: "en-US",
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
      const results = (data?.results || []) as TmdbRow[];
      if (results.length > 0) {
        // Disambiguate common titles by popularity.
        results.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
        return results[0];
      }
    } catch (e) {
      console.error("[tmdb-rate] search error", c, e);
    }
  }
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

  const tmdbType: "movie" | "tv" = body.type === "series" ? "tv" : "movie";

  let row: TmdbRow | null = null;
  try {
    if (body.tmdb_id) {
      row = await fetchById(tmdbType, body.tmdb_id);
    }
    if (!row && body.name) {
      row = await searchTmdb(tmdbType, body.name, body.year);
    }
  } catch (e) {
    console.error("[tmdb-rate] error", e);
  }

  const result: RateResult = {
    vote_average:
      typeof row?.vote_average === "number" ? row.vote_average : null,
    vote_count:
      typeof row?.vote_count === "number" ? row.vote_count : null,
    tmdb_id: typeof row?.id === "number" ? row.id : null,
  };

  return jsonResponse(200, result);
});
