import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TmdbRatingInput {
  type: "movie" | "series";
  /** Stable identifier of the source item (used in queryKey). */
  key: string | number;
  tmdb_id?: string | number | null;
  name?: string | null;
  year?: string | number | null;
}

export interface TmdbRatingResult {
  vote_average: number | null;
  vote_count: number | null;
  tmdb_id: number | null;
}

const STALE_MS = 1000 * 60 * 60 * 24; // 24h
const GC_MS = 1000 * 60 * 60 * 24 * 2; // 48h

async function fetchOne(input: TmdbRatingInput): Promise<TmdbRatingResult | null> {
  if (!input.tmdb_id && !(input.name && input.name.trim())) return null;
  const { data, error } = await supabase.functions.invoke<TmdbRatingResult>(
    "tmdb-rate",
    {
      body: {
        type: input.type,
        tmdb_id: input.tmdb_id ?? undefined,
        name: input.name ?? undefined,
        year: input.year ?? undefined,
      },
    },
  );
  if (error) {
    console.warn("[tmdb-rate] error", error);
    return null;
  }
  return data ?? null;
}

/**
 * Batch hook: enriches a list of items with TMDB vote_average/vote_count.
 * Each lookup is its own React Query (cached 24h), so subsequent visits
 * hit the cache. Useful for ranking the Highlights candidates by *real*
 * TMDB popularity instead of the IPTV provider's 5.0 default.
 */
export function useTmdbRatings(
  inputs: TmdbRatingInput[],
  enabled = true,
): Map<string | number, TmdbRatingResult | null> {
  const queries = useQueries({
    queries: inputs.map((input) => ({
      queryKey: [
        "tmdb-rate",
        input.type,
        input.tmdb_id ?? null,
        input.name ?? null,
        input.year ?? null,
      ] as const,
      queryFn: () => fetchOne(input),
      enabled: enabled && (!!input.tmdb_id || !!input.name?.trim()),
      staleTime: STALE_MS,
      gcTime: GC_MS,
      retry: false,
    })),
  });

  const map = new Map<string | number, TmdbRatingResult | null>();
  inputs.forEach((input, i) => {
    map.set(input.key, queries[i]?.data ?? null);
  });
  return map;
}
