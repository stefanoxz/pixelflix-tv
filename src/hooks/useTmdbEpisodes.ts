import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TmdbEpisodeOverlay {
  episode_number: number;
  name: string | null;
  overview: string | null;
  still: string | null;
}

export type EpisodesOverlayBySeason = Map<string, Map<number, TmdbEpisodeOverlay>>;

interface FetchInput {
  tmdb_id: number;
  season: number;
}

async function fetchSeason(input: FetchInput): Promise<TmdbEpisodeOverlay[]> {
  const { data, error } = await supabase.functions.invoke<{
    episodes: TmdbEpisodeOverlay[];
  }>("tmdb-episodes", {
    body: { tmdb_id: input.tmdb_id, season: input.season },
  });
  if (error) {
    console.warn("[tmdb-episodes] error", error);
    return [];
  }
  return data?.episodes ?? [];
}

/**
 * Fetches pt-BR overlay (title + overview + still) for each season of a
 * series. The result is keyed by season number (string, matching the IPTV
 * Xtream payload) → episode number. Consumers should treat absence as a
 * silent miss and fall back to the original Xtream data.
 *
 * Important: this NEVER replaces the playback fields (stream_id, etc).
 */
export function useTmdbEpisodes(
  tmdbId: number | null | undefined,
  seasons: string[],
): EpisodesOverlayBySeason {
  const numericSeasons = seasons
    .map((s) => ({ raw: s, num: Number(s) }))
    .filter((s) => Number.isFinite(s.num));

  const queries = useQueries({
    queries: numericSeasons.map(({ raw, num }) => ({
      queryKey: ["tmdb-episodes", tmdbId ?? null, num] as const,
      queryFn: () => fetchSeason({ tmdb_id: tmdbId!, season: num }),
      enabled: !!tmdbId && Number.isFinite(num),
      staleTime: 1000 * 60 * 60 * 24, // 24h
      gcTime: 1000 * 60 * 60 * 48,
      retry: false,
      // identifies which season this is, since useQueries result order matches input
      meta: { season: raw },
    })),
  });

  const map: EpisodesOverlayBySeason = new Map();
  numericSeasons.forEach(({ raw }, i) => {
    const list = queries[i]?.data ?? [];
    if (!list.length) return;
    const inner = new Map<number, TmdbEpisodeOverlay>();
    for (const ep of list) {
      if (Number.isFinite(ep.episode_number)) {
        inner.set(Number(ep.episode_number), ep);
      }
    }
    if (inner.size > 0) map.set(raw, inner);
  });
  return map;
}
