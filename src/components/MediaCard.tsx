import { forwardRef, type MouseEvent } from "react";
import { Heart, Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { proxyImageUrl } from "@/services/iptv";

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

export const MediaCard = forwardRef<HTMLButtonElement, MediaCardProps>(
  ({ title, cover, rating, tmdbRating, onClick, aspect = "poster", isFavorite, onToggleFavorite }, ref) => {
    // Prefer real TMDB rating (0-10) when we have a meaningful number of votes.
    const tmdbVotes = tmdbRating?.vote_count ?? 0;
    const tmdbAvg = tmdbRating?.vote_average ?? 0;
    const useTmdb = tmdbVotes >= 20 && tmdbAvg > 0;

    // Fallback: provider rating in 0-5 scale. Hide the "5.0 default" that
    // the IPTV upstream returns for almost every entry — informs nothing.
    const providerNum = typeof rating === "string" ? parseFloat(rating) : rating;
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

    const handleFav = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onToggleFavorite?.();
    };

    return (
      <button
        ref={ref}
        onClick={onClick}
        className={cn(
          "group relative overflow-hidden rounded-lg bg-gradient-card transition-bounce text-left",
          "hover:scale-105 hover:z-10 hover:shadow-hover focus:outline-none focus:ring-2 focus:ring-primary",
          aspect === "poster" ? "aspect-[2/3]" : "aspect-video"
        )}
      >
        {cover ? (
          <img
            src={proxyImageUrl(cover)}
            alt={title}
            loading="lazy"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
            className="absolute inset-0 h-full w-full object-cover transition-smooth group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
            {title}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-80 group-hover:opacity-100 transition-smooth" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-smooth">
          <div className="h-12 w-12 rounded-full bg-primary/90 flex items-center justify-center shadow-glow">
            <Play className="h-5 w-5 text-primary-foreground fill-current ml-0.5" />
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
              "absolute top-2 left-2 h-8 w-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center transition-smooth",
              "md:opacity-0 md:group-hover:opacity-100",
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

        {ratingLabel && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/70 backdrop-blur px-2 py-0.5 text-xs">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-white font-medium">{ratingLabel}</span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-semibold text-white line-clamp-2 drop-shadow">{title}</h3>
        </div>
      </button>
    );
  }
);

MediaCard.displayName = "MediaCard";
