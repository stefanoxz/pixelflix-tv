import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clapperboard,
  Film,
  Heart,
  Layers,
  ListVideo,
  Loader2,
  Star,
  Tv,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { SeriesEpisodesPanel } from "@/components/library/SeriesEpisodesPanel";
import { useTmdbFallback } from "@/hooks/useTmdbFallback";
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

  const info = data?.info;
  const sourceCover = info?.cover || series?.cover;
  const sourcePlot = series?.plot || info?.plot;
  const releaseDate = series?.releaseDate || info?.releaseDate;
  const year = releaseDate ? releaseDate.slice(0, 4) : null;

  // Fallback TMDB — chamado SEMPRE (antes de qualquer return) pra preservar a ordem dos hooks.
  const { data: tmdb } = useTmdbFallback({
    type: "series",
    hasCover: (!!sourceCover && !!sourcePlot) || !series,
    name: series?.name,
    year: year ?? undefined,
  });

  if (!series) return null;

  const ratingNum = series.rating_5based || 0;
  const plot = sourcePlot || tmdb?.overview || null;
  const cast = series.cast || info?.cast;
  const director = series.director || info?.director;
  const genre = series.genre || info?.genre;
  const cover = sourceCover || tmdb?.poster || null;
  const backdrop = tmdb?.backdrop || cover;

  // Contagens de temporadas/episódios
  const seasonsCount = data?.episodes ? Object.keys(data.episodes).length : 0;
  const episodesCount = data?.episodes
    ? Object.values(data.episodes).reduce((acc, eps) => acc + (eps?.length ?? 0), 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-4xl p-0 overflow-hidden border-border/50 bg-card max-h-[92vh] overflow-y-auto",
          "[&>button]:h-10 [&>button]:w-10 [&>button]:rounded-full [&>button]:bg-black/60 [&>button]:backdrop-blur [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:top-4 [&>button]:right-4 [&>button]:opacity-100 [&>button]:hover:bg-black/80 [&>button>svg]:h-5 [&>button>svg]:w-5",
        )}
      >
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
        </div>

        <div className="px-4 md:px-6 pb-6 -mt-16 md:-mt-20 grid grid-cols-1 md:grid-cols-[180px,1fr] gap-4 md:gap-6 relative">
          <div className="aspect-[2/3] w-28 md:w-full rounded-xl overflow-hidden bg-secondary shadow-card shrink-0 ring-1 ring-border/40">
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

          <div className="min-w-0 space-y-4 md:pt-16">
            {/* Título */}
            <h2 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight leading-[1.05]">
              {series.name}
              {year && <span className="text-foreground/70"> ({year})</span>}
            </h2>

            {/* Barra de chips: metadados */}
            <div className="inline-flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border/60 bg-secondary/60 px-5 py-3">
              {seasonsCount > 0 && (
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Tv className="h-[18px] w-[18px] text-primary" />
                  <span>
                    {seasonsCount} Temporada{seasonsCount > 1 ? "s" : ""}
                  </span>
                </span>
              )}
              {episodesCount > 0 && (
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Layers className="h-[18px] w-[18px] text-primary" />
                  <span>
                    {episodesCount} Episódio{episodesCount > 1 ? "s" : ""}
                  </span>
                </span>
              )}
              {releaseDate && (
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-[18px] w-[18px] text-primary" />
                  <span>{releaseDate}</span>
                </span>
              )}
              {genre && (
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Film className="h-[18px] w-[18px] text-primary" />
                  <span className="truncate max-w-[260px]">{genre}</span>
                </span>
              )}
              {ratingNum > 0 && (
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Star className="h-[18px] w-[18px] fill-yellow-400 text-yellow-400" />
                  <span>{ratingNum.toFixed(1)}</span>
                </span>
              )}
            </div>

            {/* Card de Direção / Elenco */}
            {(cast || director) && (
              <div className="rounded-2xl border border-border/50 bg-secondary/40 p-4 space-y-3">
                {director && (
                  <div className="grid grid-cols-[auto,1fr] gap-3 items-start">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90 min-w-[88px]">
                      <Video className="h-5 w-5 text-muted-foreground" />
                      <span>Direção:</span>
                    </div>
                    <p className="text-sm text-foreground/75 leading-relaxed">
                      {director}
                    </p>
                  </div>
                )}
                {cast && (
                  <div className="grid grid-cols-[auto,1fr] gap-3 items-start">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90 min-w-[88px]">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span>Elenco:</span>
                    </div>
                    <p className="text-sm text-foreground/75 leading-relaxed line-clamp-3">
                      {cast}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Sinopse */}
            <div className="rounded-2xl border border-border/50 bg-secondary/30 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold">Sinopse</h3>
              </div>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando detalhes…
                </div>
              ) : plot ? (
                <p className="text-sm md:text-base text-foreground/85 leading-relaxed">
                  {plot}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Sem sinopse disponível.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {onToggleFavorite && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onToggleFavorite}
                  className={cn(
                    "h-12 px-6 rounded-full text-base gap-2",
                    isFavorite && "border-primary/60 text-primary",
                  )}
                >
                  <Heart
                    className={cn("h-5 w-5", isFavorite && "fill-primary text-primary")}
                  />
                  {isFavorite ? "Favorito" : "Favoritar"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 pb-6">
          <div className="flex items-center gap-2 mb-4">
            <ListVideo className="h-[22px] w-[22px] text-primary" />
            <h3 className="text-2xl md:text-3xl font-bold">Episódios</h3>
          </div>
          {data?.episodes ? (
            <SeriesEpisodesPanel
              episodesBySeason={data.episodes}
              onPlay={onPlayEpisode}
              onCopyExternal={onCopyExternal}
            />
          ) : isLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando episódios…
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Nenhum episódio disponível.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
