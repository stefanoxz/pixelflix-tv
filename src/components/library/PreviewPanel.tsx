import { ReactNode } from "react";
import { Heart, Play, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { proxyImageUrl } from "@/services/iptv";
import { SafeImage } from "@/components/SafeImage";

interface Props {
  loading?: boolean;
  cover?: string;
  backdrop?: string;
  title?: string;
  year?: string | number;
  rating?: number;
  duration?: string;
  genre?: string;
  director?: string;
  cast?: string;
  plot?: string;
  isFavorite?: boolean;
  onPlay?: () => void;
  onToggleFavorite?: () => void;
  /** Conteúdo extra após sinopse (ex: lista de episódios). */
  children?: ReactNode;
  /** Texto do botão principal (default "Assistir"). */
  playLabel?: string;
  /** Mensagem quando não há item selecionado. */
  emptyMessage?: string;
}

export function PreviewPanel({
  loading,
  cover,
  backdrop,
  title,
  year,
  rating,
  duration,
  genre,
  director,
  cast,
  plot,
  isFavorite,
  onPlay,
  onToggleFavorite,
  children,
  playLabel = "Assistir",
  emptyMessage = "Selecione um título à esquerda para ver os detalhes.",
}: Props) {
  if (!title) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
        {emptyMessage}
      </div>
    );
  }

  const bgImage = backdrop || cover;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Backdrop */}
      <div className="relative h-44 w-full overflow-hidden shrink-0">
        {bgImage && (
          <SafeImage
            src={proxyImageUrl(bgImage)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-transparent" />
      </div>

      <div className="px-5 pb-5 -mt-16 relative space-y-4">
        <div className="flex gap-4">
          <div className="h-36 w-24 shrink-0 rounded-lg overflow-hidden bg-secondary shadow-card">
            {cover ? (
              <SafeImage
                src={proxyImageUrl(cover)}
                alt={title}
                onErrorMode="fade"
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pt-12">
            <h2 className="text-lg font-bold leading-tight line-clamp-2">{title}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
              {rating && rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-foreground font-medium">{rating.toFixed(1)}</span>
                </span>
              )}
              {year && <span>{year}</span>}
              {duration && <span>{duration}</span>}
            </div>
            {genre && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{genre}</p>}
          </div>
        </div>

        <div className="flex gap-2">
          {onPlay && (
            <Button
              size="sm"
              onClick={onPlay}
              className="flex-1 bg-gradient-primary hover:opacity-90 shadow-glow gap-2"
            >
              <Play className="h-4 w-4 fill-current" />
              {playLabel}
            </Button>
          )}
          {onToggleFavorite && (
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleFavorite}
              className={cn(isFavorite && "border-primary/60 text-primary")}
              aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar"}
            >
              <Heart className={cn("h-4 w-4", isFavorite && "fill-primary text-primary")} />
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando detalhes…
          </div>
        ) : (
          <>
            {plot && <p className="text-sm text-foreground/85 leading-relaxed">{plot}</p>}
            {(director || cast) && (
              <div className="text-xs text-muted-foreground space-y-1 pt-1">
                {director && (
                  <p>
                    <span className="font-semibold text-foreground/80">Direção:</span> {director}
                  </p>
                )}
                {cast && (
                  <p className="line-clamp-3">
                    <span className="font-semibold text-foreground/80">Elenco:</span> {cast}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {children}
      </div>
    </div>
  );
}
