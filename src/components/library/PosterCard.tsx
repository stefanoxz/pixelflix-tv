import { forwardRef, useState } from "react";
import { Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { proxyImageUrl } from "@/services/iptv";

export interface PosterItem {
  id: number;
  title: string;
  cover?: string | null;
  year?: string | number;
  rating?: number;
}

interface Props {
  item: PosterItem;
  active?: boolean;
  isFavorite?: boolean;
  onClick: () => void;
  onToggleFavorite?: () => void;
}

/**
 * Card de pôster (aspect 2:3) estilo Netflix/IBO. Mostra capa, gradiente
 * inferior com nome/ano, badge de favorito e indicador de rating.
 */
export const PosterCard = forwardRef<HTMLButtonElement, Props>(function PosterCard(
  { item, active, isFavorite, onClick, onToggleFavorite },
  ref,
) {
  const [imgFailed, setImgFailed] = useState(false);
  const cover = item.cover ? proxyImageUrl(item.cover) : null;

  return (
    <div className="relative group">
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        data-active={active}
        className={cn(
          "block w-full aspect-[2/3] rounded-md overflow-hidden bg-secondary/60 relative",
          "transition-all duration-200",
          "hover:ring-2 hover:ring-primary/70 hover:-translate-y-0.5",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          active && "ring-2 ring-primary shadow-glow",
        )}
        aria-label={item.title}
      >
        {cover && !imgFailed ? (
          <img
            src={cover}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center p-3 text-center text-[11px] text-muted-foreground bg-gradient-to-br from-secondary to-secondary/40">
            {item.title}
          </div>
        )}

        {/* Gradient + título sempre visível na parte de baixo */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-6">
          <p className="text-[11px] md:text-xs font-semibold text-white leading-tight line-clamp-2 drop-shadow">
            {item.title}
            {item.year ? (
              <span className="font-normal opacity-80"> ({item.year})</span>
            ) : null}
          </p>
        </div>

        {item.rating != null && item.rating > 0 && (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/65 backdrop-blur-sm text-[10px] text-white font-medium">
            <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
            {item.rating.toFixed(1)}
          </div>
        )}
      </button>

      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn(
            "absolute top-1.5 right-1.5 h-7 w-7 rounded-full flex items-center justify-center",
            "bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 focus:opacity-100",
            "transition-opacity",
            isFavorite && "opacity-100",
          )}
          aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart className={cn("h-3.5 w-3.5", isFavorite && "fill-primary text-primary")} />
        </button>
      )}
    </div>
  );
});
