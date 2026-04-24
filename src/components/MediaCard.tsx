import { forwardRef } from "react";
import { Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { proxyImageUrl } from "@/services/iptv";

interface MediaCardProps {
  title: string;
  cover?: string;
  rating?: number | string;
  onClick?: () => void;
  aspect?: "poster" | "landscape";
}

export const MediaCard = forwardRef<HTMLButtonElement, MediaCardProps>(
  ({ title, cover, rating, onClick, aspect = "poster" }, ref) => {
    const ratingNum = typeof rating === "string" ? parseFloat(rating) : rating;
    const showRating = ratingNum && !isNaN(ratingNum) && ratingNum > 0;

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

        {showRating && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/70 backdrop-blur px-2 py-0.5 text-xs">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-white font-medium">{ratingNum?.toFixed(1)}</span>
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
