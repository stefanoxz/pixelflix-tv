import { useQuery } from "@tanstack/react-query";
import { Heart, Loader2, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { SeriesEpisodesPanel } from "@/components/library/SeriesEpisodesPanel";
import {
  getSeriesInfo,
  proxyImageUrl,
  type Episode,
  type IptvCredentials,
  type Series,
} from "@/services/iptv";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: Series | null;
  creds: IptvCredentials;
  onPlayEpisode: (ep: Episode) => void;
  onCopyExternal: (ep: Episode) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function SeriesDetailsDialog({
  open,
  onOpenChange,
  series,
  creds,
  onPlayEpisode,
  onCopyExternal,
  isFavorite,
  onToggleFavorite,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["series-info", series?.series_id],
    queryFn: () => getSeriesInfo(creds, series!.series_id),
    enabled: !!series && open,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  if (!series) return null;

  const info = data?.info;
  const cover = info?.cover || series.cover;
  const backdrop = cover;
  const releaseDate = series.releaseDate || info?.releaseDate;
  const year = releaseDate ? releaseDate.slice(0, 4) : null;
  const ratingNum = series.rating_5based || 0;
  const plot = series.plot || info?.plot;
  const cast = series.cast || info?.cast;
  const director = series.director || info?.director;
  const genre = series.genre || info?.genre;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-border/50 bg-card max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">{series.name}</DialogTitle>
        <DialogDescription className="sr-only">Detalhes da série</DialogDescription>

        <div className="relative h-40 md:h-56 w-full overflow-hidden">
          {backdrop && (
            <img
              src={proxyImageUrl(backdrop, { w: 900, q: 75 })}
              alt=""
              loading="eager"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-transparent" />
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition-smooth"
            aria-label="Fechar"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        <div className="px-4 md:px-6 pb-6 -mt-16 md:-mt-20 grid grid-cols-1 md:grid-cols-[160px,1fr] gap-4 md:gap-5 relative">
          <div className="aspect-[2/3] w-28 md:w-full rounded-lg overflow-hidden bg-secondary shadow-card shrink-0">
            {cover ? (
              <img
                src={proxyImageUrl(cover, { w: 400, h: 600, q: 80 })}
                alt={series.name}
                loading="eager"
                decoding="async"
                className="h-full w-full object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.2")}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-4 text-center">
                {series.name}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3 md:pt-16">
            <h2 className="text-xl md:text-2xl font-bold leading-tight">{series.name}</h2>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {ratingNum > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-foreground font-medium">{ratingNum.toFixed(1)}</span>
                </span>
              )}
              {year && <span>{year}</span>}
              {genre && <span className="truncate max-w-[260px]">{genre}</span>}
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando detalhes…
              </div>
            ) : plot ? (
              <p className="text-sm text-foreground/90 leading-relaxed line-clamp-5">
                {plot}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem sinopse disponível.</p>
            )}

            {(cast || director) && (
              <div className="text-xs text-muted-foreground space-y-1">
                {director && (
                  <p>
                    <span className="font-semibold text-foreground/80">Direção:</span>{" "}
                    {director}
                  </p>
                )}
                {cast && (
                  <p className="line-clamp-2">
                    <span className="font-semibold text-foreground/80">Elenco:</span> {cast}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {onToggleFavorite && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onToggleFavorite}
                  className={cn("gap-2", isFavorite && "border-primary/60 text-primary")}
                >
                  <Heart
                    className={cn("h-4 w-4", isFavorite && "fill-primary text-primary")}
                  />
                  {isFavorite ? "Favorito" : "Favoritar"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 pb-6">
          <h3 className="text-sm font-semibold mb-2">Episódios</h3>
          {data?.episodes ? (
            <SeriesEpisodesPanel
              episodesBySeason={data.episodes}
              onPlay={onPlayEpisode}
              onCopyExternal={onCopyExternal}
            />
          ) : isLoading ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando episódios…
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Nenhum episódio disponível.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
