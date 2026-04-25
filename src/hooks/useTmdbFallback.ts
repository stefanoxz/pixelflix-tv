import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TmdbFallbackInput {
  type: "movie" | "series";
  /** Disable lookup when a usable cover is already available. */
  hasCover: boolean;
  tmdb_id?: string | number | null;
  name?: string | null;
  year?: string | number | null;
}

export interface TmdbFallbackResult {
  poster: string | null;
  backdrop: string | null;
}

/**
 * Lazily fetches TMDB poster/backdrop when the IPTV provider does not supply a
 * cover. Results are cached server-side in `tmdb_image_cache` for 30 days.
 */
export function useTmdbFallback(input: TmdbFallbackInput) {
  const enabled =
    !input.hasCover && (!!input.tmdb_id || !!(input.name && input.name.trim()));

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
