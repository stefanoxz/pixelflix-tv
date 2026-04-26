import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { SeriesEpisodesPanel } from "@/components/library/SeriesEpisodesPanel";
import { useTmdbFallback } from "@/hooks/useTmdbFallback";
import { useTmdbRating } from "@/hooks/useTmdbRating";
import { useTmdbEpisodes } from "@/hooks/useTmdbEpisodes";
import {
  getSeriesInfo,
  proxyImageUrl,
  type Episode,
  type IptvCredentials,
  type Series,
} from "@/services/iptv";
import { SafeImage } from "@/components/SafeImage";

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

  // Always enrich with TMDB so the synopsis can be shown in pt-BR and we
  // can resolve the tmdb_id used to fetch episode overlays / ratings.
  const { data: tmdb } = useTmdbFallback({
    type: "series",
    hasCover: false,
    name: series?.name,
    year: year ?? undefined,
    enabled: !!series && open,
  });

  // Same TMDB rating that the catalog cards display — keeps the number
  // consistent between "Séries em alta" and the details modal.
  const { data: tmdbRating } = useTmdbRating({
    type: "series",
    tmdb_id: tmdb?.tmdb_id ?? undefined,
    name: series?.name,
    year: year ?? undefined,
    enabled: !!series && open,
  });

  // pt-BR overlay for episodes (titles + synopses). Lazy per season.
  const seasonKeys = data?.episodes ? Object.keys(data.episodes) : [];
  const epOverlay = useTmdbEpisodes(tmdb?.tmdb_id ?? null, seasonKeys);

  if (!series) return null;

  const providerRating = series.rating_5based || 0;
  const tmdbVotes = tmdbRating?.vote_count ?? 0;
  const tmdbAvg = tmdbRating?.vote_average ?? 0;
  const useTmdb = tmdbVotes >= 20 && tmdbAvg > 0;
  // Display unified rating in 0-10 scale. Provider's 5-based gets doubled.
  const displayRating = useTmdb ? tmdbAvg : providerRating > 0 && providerRating < 5 ? providerRating * 2 : 0;
  const ratingSource: "tmdb" | "provider" | null = useTmdb
    ? "tmdb"
    : displayRating > 0
      ? "provider"
      : null;
  // Prefer TMDB pt-BR overview when available, fall back to provider plot.
  const plot = tmdb?.overview || sourcePlot || null;
  const cast = series.cast || info?.cast;
  const director = series.director || info?.director;
  const genre = series.genre || info?.genre;
  const cover = sourceCover || tmdb?.poster || null;
  const backdrop = tmdb?.backdrop || cover;

  const seasonsCount = data?.episodes ? Object.keys(data.episodes).length : 0;
  const episodesCount = data?.episodes
    ? Object.values(data.episodes).reduce((acc, eps) => acc + (eps?.length ?? 0), 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/90 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-5xl translate-x-[-50%] translate-y-[-50%]",
            "max-h-[92vh] overflow-y-auto overflow-x-hidden",
            "border border-border/50 bg-card sm:rounded-2xl shadow-2xl",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogTitle className="sr-only">{series.name}</DialogTitle>
          <DialogDescription className="sr-only">Detalhes da série</DialogDescription>

          {/* Botão fechar custom */}
          <DialogPrimitive.Close
            className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md ring-1 ring-white/15 transition-all hover:bg-black/80 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <X className="h-5 w-5 stroke-[2.5]" />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>

          {/* Mobile: backdrop horizontal no topo */}
          <div className="md:hidden relative h-40 w-full overflow-hidden">
            {backdrop && (
              <SafeImage
                src={proxyImageUrl(backdrop, { w: 900, q: 75 })}
                alt=""
                loading="eager"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-transparent" />
          </div>

          {/* Bloco superior: capa spotlight + conteúdo */}
          <div className="flex flex-col md:flex-row md:min-h-[520px]">
            {/* Capa lateral spotlight — desktop only */}
            <div className="hidden md:block relative w-[42%] max-w-[420px] shrink-0 self-stretch overflow-hidden">
              {cover ? (
                <SafeImage
                  src={proxyImageUrl(cover, { w: 600, h: 900, q: 85 })}
                  alt={series.name}
                  loading="eager"
                  decoding="async"
                  onErrorMode="fade"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground p-6 text-center bg-secondary">
                  {series.name}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-card/30 to-card pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30 pointer-events-none" />
            </div>

            {/* Coluna direita: conteúdo */}
            <div className="flex-1 min-w-0 px-5 md:px-8 pt-5 md:pt-8 pb-6 -mt-16 md:mt-0 relative">
              {/* Mobile: capa pequena flutuando */}
              <div className="md:hidden flex gap-4 mb-4">
                <div className="aspect-[2/3] w-28 rounded-xl overflow-hidden bg-secondary shadow-card shrink-0 ring-1 ring-border/40">
                  {cover ? (
                    <img
                      src={proxyImageUrl(cover, { w: 400, h: 600, q: 80 })}
                      alt={series.name}
                      loading="eager"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
              </div>

              <div className="space-y-4 md:space-y-5">
                {/* Título */}
                <h2 className="text-2xl md:text-4xl font-extrabold uppercase tracking-tight leading-[1.05]">
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
                  {displayRating > 0 && (
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Star className="h-[18px] w-[18px] fill-yellow-400 text-yellow-400" />
                      <span>{displayRating.toFixed(1)}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">
                        {ratingSource === "tmdb" ? "TMDB" : "/10"}
                      </span>
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
          </div>

          {/* Episódios — full width abaixo */}
          <div className="px-5 md:px-8 pb-7">
            <div className="flex items-center gap-2 mb-4">
              <ListVideo className="h-[22px] w-[22px] text-primary" />
              <h3 className="text-2xl md:text-3xl font-bold">Episódios</h3>
            </div>
            {data?.episodes ? (
              <SeriesEpisodesPanel
                episodesBySeason={data.episodes}
                onPlay={onPlayEpisode}
                onCopyExternal={onCopyExternal}
                overlay={epOverlay}
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
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
