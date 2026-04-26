import { Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { proxyImageUrl } from "@/services/iptv";
import { SafeImage } from "@/components/SafeImage";

export interface TitleListItemData {
  id: number;
  title: string;
  cover?: string;
  rating?: number;
  year?: string;
  subtitle?: string; // ex: "Drama, Ação"
}

interface Props {
  item: TitleListItemData;
  active?: boolean;
  isFavorite?: boolean;
  onSelect: () => void;
  onToggleFavorite?: () => void;
  onDoubleClick?: () => void;
}

export function TitleListItem({
  item,
  active,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onDoubleClick,
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onSelect}
      data-active={active}
      aria-selected={active}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 text-left transition-smooth border-l-2",
        active
          ? "border-primary bg-primary/10"
          : "border-transparent hover:bg-secondary/40 focus:bg-secondary/40",
        "focus:outline-none",
      )}
    >
      <div className="relative shrink-0 h-[60px] w-10 rounded overflow-hidden bg-secondary">
        {item.cover ? (
          <SafeImage
            src={proxyImageUrl(item.cover)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm truncate",
            active ? "text-foreground font-medium" : "text-foreground/90",
          )}
        >
          {item.title}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          {item.year && <span>{item.year}</span>}
          {item.rating && item.rating > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {item.rating.toFixed(1)}
            </span>
          )}
          {item.subtitle && <span className="truncate">{item.subtitle}</span>}
        </div>
      </div>

      {onToggleFavorite && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggleFavorite();
          }}
          className={cn(
            "h-7 w-7 shrink-0 rounded-full flex items-center justify-center transition-smooth",
            "hover:bg-secondary",
            isFavorite ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
        </span>
      )}
    </button>
  );
}
