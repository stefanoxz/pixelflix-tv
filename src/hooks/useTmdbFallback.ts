import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TmdbFallbackInput {
  type: "movie" | "series";
  /**
   * When true, the lookup is skipped entirely. Pass `false` to always enrich
   * with TMDB (e.g. to pull pt-BR overview even when the provider has plot in
   * English). The previous "hasCover" semantics were too restrictive.
   */
  hasCover?: boolean;
  tmdb_id?: string | number | null;
  name?: string | null;
  year?: string | number | null;
  /** Disable fetch entirely — useful when dialog is closed. */
  enabled?: boolean;
}

export interface TmdbFallbackResult {
  poster: string | null;
  backdrop: string | null;
  overview: string | null;
  tmdb_id: number | null;
}

/**
 * Lazily fetches TMDB poster/backdrop/overview/tmdb_id. Even when the IPTV
 * provider already supplies cover/plot we still query TMDB so that:
 *   - the synopsis can be displayed in pt-BR;
 *   - the resolved tmdb_id can be reused to fetch episodes/ratings.
 * Server-side cache (`tmdb_image_cache`) keeps this cheap.
 */
export function useTmdbFallback(input: TmdbFallbackInput) {
  const enabled =
    (input.enabled ?? true) &&
    !input.hasCover && // legacy path: only used by callers that still want the gate
    (!!input.tmdb_id || !!(input.name && input.name.trim()));

  // Ignore legacy hasCover when caller explicitly asks for always-on mode
  // (hasCover === false makes `enabled` true even with cover present).
  return useQuery<TmdbFallbackResult | null>({
    queryKey: [
      "tmdb-fallback",
      input.type,
      input.tmdb_id ?? null,
      input.name ?? null,
      input.year ?? null,
    ],
    enabled,
    staleTime: 1000 * 60 * 60 * 24, // 24h client side
    gcTime: 1000 * 60 * 60 * 24,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<TmdbFallbackResult>(
        "tmdb-image",
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
        console.warn("[tmdb-fallback] error", error);
        return null;
      }
      return data ?? null;
    },
  });
}
