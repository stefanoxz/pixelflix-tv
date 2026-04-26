import { forwardRef, memo, useState } from "react";
import { Heart, Star, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { proxyImageUrl } from "@/services/iptv";
import { useTmdbFallback } from "@/hooks/useTmdbFallback";

export interface PosterItem {
  id: number;
  title: string;
  cover?: string | null;
  year?: string | number;
  /** Provider rating (0-5 scale). Often "5" by default. */
  rating?: number;
  /** Real TMDB rating (0-10 scale). Preferred when present with enough votes. */
  tmdbRating?: { vote_average: number | null; vote_count: number | null } | null;
  /** Host upstream do conteúdo — usado para checar a marca de incompatibilidade. */
  host?: string | null;
  /** Tipo de mídia para o fallback TMDB. */
  kind?: "movie" | "series";
}

interface Props {
  item: PosterItem;
  active?: boolean;
  isFavorite?: boolean;
  /** Marcado como incompatível (HEVC/4K que falhou antes). Vem do grid. */
  incompatible?: boolean;
  onClick: () => void;
  onHover?: () => void;
  onToggleFavorite?: () => void;
}

/**
 * Card de pôster (aspect 2:3) estilo Netflix/IBO. Memoizado — só
 * re-renderiza quando `item.id`, `active`, `isFavorite` ou `incompatible`
 * mudam. A marca de incompatibilidade vem por prop (sem listener por card).
 */
const PosterCardImpl = forwardRef<HTMLButtonElement, Props>(function PosterCard(
  { item, active, isFavorite, incompatible, onClick, onHover, onToggleFavorite },
  ref,
) {
  const [imgFailed, setImgFailed] = useState(false);
  // Capas em ~150px exibidas → pedimos 300px de largura (retina) em WebP.
  const cover = item.cover ? proxyImageUrl(item.cover, { w: 300, h: 450, q: 70 }) : null;

  // Fallback TMDB: só dispara quando não há cover OU quando a imagem original
  // falhou. Isso evita inundar a edge function com requests para grids gigantes.
  const needsFallback = !item.cover || imgFailed;
  const { data: tmdb } = useTmdbFallback({
    type: item.kind ?? "movie",
    hasCover: !needsFallback,
    name: item.title,
    year: item.year,
  });
  const fallbackCover = tmdb?.poster
    ? proxyImageUrl(tmdb.poster, { w: 300, h: 450, q: 70 })
    : null;

  const finalCover = imgFailed ? fallbackCover : cover ?? fallbackCover;
  const showPlaceholder = !finalCover;

  return (
    <div className="relative group">
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onMouseEnter={onHover}
        onFocus={onHover}
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
        {!showPlaceholder ? (
          <img
            src={finalCover}
            alt={item.title}
            loading="lazy"
            decoding="async"
            width={200}
            height={300}
            className="h-full w-full object-cover"
            onError={() => {
              // Se a capa original falhar e ainda não temos fallback, marca falha
              // pra disparar o lookup TMDB no próximo render.
              if (!imgFailed) setImgFailed(true);
            }}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center p-3 text-center text-[11px] text-muted-foreground bg-gradient-to-br from-secondary to-secondary/40">
            {item.title}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-6">
          <p className="text-[11px] md:text-xs font-semibold text-white leading-tight line-clamp-2 drop-shadow">
            {item.title}
            {item.year ? (
              <span className="font-normal opacity-80"> ({item.year})</span>
            ) : null}
          </p>
        </div>

        {(() => {
          // Prefer real TMDB rating (0-10) when we have a meaningful vote count.
          const tv = item.tmdbRating?.vote_count ?? 0;
          const ta = item.tmdbRating?.vote_average ?? 0;
          const useTmdb = tv >= 20 && ta > 0;
          // Fallback: provider rating in 0-5 scale, hiding the "5.0 default"
          // and "0" — both are uninformative noise for the user.
          const showProvider =
            !useTmdb && item.rating != null && item.rating > 0 && item.rating < 5;
          const label = useTmdb ? ta.toFixed(1) : showProvider ? item.rating!.toFixed(1) : null;
          if (!label) return null;
          return (
            <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/65 backdrop-blur-sm text-[10px] text-white font-medium">
              <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
              {label}
            </div>
          );
        })()}

        {incompatible && (
          <div
            className="absolute inset-0 bg-black/55 flex items-end justify-center pb-10 pointer-events-none"
            aria-hidden
          >
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/90 text-destructive-foreground text-[10px] font-semibold shadow-lg">
              <AlertTriangle className="h-3 w-3" />
              Incompatível
            </div>
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

export const PosterCard = memo(PosterCardImpl, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.item.cover === next.item.cover &&
    prev.item.title === next.item.title &&
    prev.item.year === next.item.year &&
    prev.item.rating === next.item.rating &&
    prev.item.tmdbRating?.vote_average === next.item.tmdbRating?.vote_average &&
    prev.item.tmdbRating?.vote_count === next.item.tmdbRating?.vote_count &&
    prev.item.kind === next.item.kind &&
    prev.active === next.active &&
    prev.isFavorite === next.isFavorite &&
    prev.incompatible === next.incompatible &&
    prev.onClick === next.onClick &&
    prev.onHover === next.onHover &&
    prev.onToggleFavorite === next.onToggleFavorite
  );
});
