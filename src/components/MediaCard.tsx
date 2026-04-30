import { forwardRef, memo, useCallback, useMemo, type MouseEvent, useEffect, useState } from "react";
import { Heart, Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { proxyImageUrl } from "@/services/iptv";
import { SafeImage } from "@/components/SafeImage";

interface MediaCardProps {
  title: string;
  cover?: string;
  /** Provider rating (0-5 scale). Often "5" by default — used as fallback. */
  rating?: number | string;
  /** Real TMDB rating (0-10 scale) — preferred when present. */
  tmdbRating?: { vote_average: number | null; vote_count: number | null } | null;
  onClick?: () => void;
  aspect?: "poster" | "landscape";
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export const MediaCard = memo(forwardRef<HTMLButtonElement, MediaCardProps>(
  ({ title, cover, rating, tmdbRating, onClick, aspect = "poster", isFavorite, onToggleFavorite }, ref) => {
    // Prefer real TMDB rating (0-10) when we have a meaningful number of votes.
    const tmdbVotes = tmdbRating?.vote_count ?? 0;
    const tmdbAvg = tmdbRating?.vote_average ?? 0;
    const useTmdb = tmdbVotes >= 20 && tmdbAvg > 0;

    // Fallback: provider rating in 0-5 scale. Hide the "5.0 default" that
    // the IPTV upstream returns for almost every entry — informs nothing.
    const providerNum = useMemo(() => {
      if (typeof rating === "string") return parseFloat(rating);
      return rating;
    }, [rating]);

    const showProvider =
      !useTmdb &&
      providerNum != null &&
      !isNaN(providerNum) &&
      providerNum > 0 &&
      providerNum < 5;

    const ratingLabel = useTmdb
      ? tmdbAvg.toFixed(1)
      : showProvider
        ? providerNum!.toFixed(1)
        : null;
    const showFav = typeof onToggleFavorite === "function";

    const handleFav = useCallback((e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onToggleFavorite?.();
    }, [onToggleFavorite]);

    const [isLoaded, setIsLoaded] = useState(false);

    return (
      <button
        ref={ref}
        onClick={onClick}
        className={cn(
          "group relative overflow-hidden rounded-2xl bg-card text-left",
          "transition-all duration-500 ease-out",
          "hover:-translate-y-2 hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] hover:ring-1 hover:ring-white/20",
          "active:scale-95",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background",
          aspect === "poster" ? "aspect-[2/3]" : "aspect-video"
        )}
      >

        {cover ? (
          <div className={cn("absolute inset-0 transition-opacity duration-700", isLoaded ? "opacity-100" : "opacity-0")}>
            <SafeImage
              src={proxyImageUrl(cover)}
              alt={`Capa de ${title}`}
              loading="lazy"
              decoding="async"
              width={aspect === "poster" ? 200 : 320}
              height={aspect === "poster" ? 300 : 180}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
              onLoad={() => setIsLoaded(true)}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
            {title}
          </div>
        )}

        {/* Vinheta + gradient inferior */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

        {/* Botão Play centralizado no hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-300">
          <div className="h-14 w-14 rounded-full bg-primary/95 flex items-center justify-center shadow-[0_0_24px_hsl(var(--primary)/0.6)] ring-2 ring-white/20">
            <Play className="h-6 w-6 text-primary-foreground fill-current ml-0.5" />
          </div>
        </div>

        {showFav && (
          <span
            role="button"
            tabIndex={0}
            aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            onClick={handleFav}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite?.();
              }
            }}
            className={cn(
              "absolute top-2 left-2 h-8 w-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center transition-all duration-200",
              "md:opacity-0 md:group-hover:opacity-100 hover:scale-110",
              isFavorite && "md:opacity-100",
              "hover:bg-black/80 cursor-pointer",
            )}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-smooth",
                isFavorite ? "fill-primary text-primary" : "text-white",
              )}
            />
          </span>
        )}

        {ratingLabel && (() => {
          const score = useTmdb ? tmdbAvg : (providerNum ?? 0) * 2;
          const tone =
            score >= 7.5
              ? "bg-emerald-500/90 text-white"
              : score >= 6
                ? "bg-amber-500/90 text-white"
                : "bg-black/70 text-white";
          return (
            <div className={cn(
              "absolute top-2 right-2 flex items-center gap-1 rounded-md backdrop-blur px-2 py-0.5 text-xs font-bold tabular-nums shadow-md",
              tone,
            )}>
              <Star className="h-3 w-3 fill-current" />
              <span>{ratingLabel}</span>
            </div>
          );
        })()}

        <div className="absolute bottom-0 left-0 right-0 p-4 pt-10 bg-gradient-to-t from-black via-black/80 to-transparent">
          <h3 className="text-[13px] md:text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-primary transition-colors duration-300">{title}</h3>
        </div>
      </button>
    );
  }
));

MediaCard.displayName = "MediaCard";
