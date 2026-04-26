import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Calendar,
  Clapperboard,
  Clock,
  Film,
  Heart,
  Loader2,
  Play,
  Star,
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
import {
  getVodInfo,
  proxyImageUrl,
  type IptvCredentials,
  type VodStream,
} from "@/services/iptv";
import { useIsIncompatible } from "@/hooks/useIsIncompatible";
import { clearIncompatible } from "@/lib/incompatibleContent";
import { useTmdbFallback } from "@/hooks/useTmdbFallback";
import { useTmdbRating } from "@/hooks/useTmdbRating";

interface MovieDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movie: VodStream | null;
  creds: IptvCredentials;
  onPlay: (movie: VodStream) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function MovieDetailsDialog({
  open,
  onOpenChange,
  movie,
  creds,
  onPlay,
  isFavorite,
  onToggleFavorite,
}: MovieDetailsDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["vod-info", movie?.stream_id],
    queryFn: () => getVodInfo(creds, movie!.stream_id),
    enabled: !!movie && open,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const upstreamHost = (() => {
    try {
      return new URL(creds.streamBase || creds.server).host;
    } catch {
      return null;
    }
  })();
  const incompatible = useIsIncompatible(upstreamHost, movie?.stream_id ?? null);

  const info = data?.info;
  const sourceCover = info?.movie_image || info?.cover_big || movie?.stream_icon;
  const sourceBackdrop = Array.isArray(info?.backdrop_path)
    ? info!.backdrop_path[0]
    : (info?.backdrop_path as string | undefined) || sourceCover;
  const sourcePlot = info?.plot;
  const releaseDate = info?.releasedate || info?.release_date;
  const year = releaseDate ? releaseDate.slice(0, 4) : null;

  // Always enrich with TMDB so the synopsis can be shown in pt-BR and we
  // get a tmdb_id to keep the rating consistent with the catalog cards.
  const { data: tmdb } = useTmdbFallback({
    type: "movie",
    hasCover: false,
    tmdb_id: info?.tmdb_id ?? undefined,
    name: movie?.name,
    year: year ?? undefined,
    enabled: !!movie && open,
  });

  const { data: tmdbRating } = useTmdbRating({
    type: "movie",
    tmdb_id: info?.tmdb_id ?? tmdb?.tmdb_id ?? undefined,
    name: movie?.name,
    year: year ?? undefined,
    enabled: !!movie && open,
  });

  if (!movie) return null;

  const providerRating =
    movie.rating_5based || (info?.rating_5based ?? 0);
  const tmdbVotes = tmdbRating?.vote_count ?? 0;
  const tmdbAvg = tmdbRating?.vote_average ?? 0;
  const useTmdb = tmdbVotes >= 20 && tmdbAvg > 0;
  const displayRating = useTmdb
    ? tmdbAvg
    : providerRating > 0 && providerRating < 5
      ? providerRating * 2
      : 0;
  const ratingSource: "tmdb" | "provider" | null = useTmdb
    ? "tmdb"
    : displayRating > 0
      ? "provider"
      : null;
  const cover = sourceCover || tmdb?.poster || null;
  const backdrop = sourceBackdrop || tmdb?.backdrop || cover;
  // Prefer TMDB pt-BR overview when available.
  const plot = tmdb?.overview || sourcePlot || null;

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
          <DialogTitle className="sr-only">{movie.name}</DialogTitle>
          <DialogDescription className="sr-only">Detalhes do filme</DialogDescription>

          {/* Botão fechar custom — fica acima da capa lateral */}
          <DialogPrimitive.Close
            className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md ring-1 ring-white/15 transition-all hover:bg-black/80 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <X className="h-5 w-5 stroke-[2.5]" />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>

          {/* Mobile: backdrop horizontal no topo */}
          <div className="md:hidden relative h-44 w-full overflow-hidden">
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

          {/* Layout principal: flex horizontal no desktop */}
          <div className="flex flex-col md:flex-row md:min-h-[600px]">
            {/* Capa lateral spotlight — desktop only */}
            <div className="hidden md:block relative w-[42%] max-w-[420px] shrink-0 self-stretch overflow-hidden">
              {cover ? (
                <img
                  src={proxyImageUrl(cover, { w: 600, h: 900, q: 85 })}
                  alt={movie.name}
                  loading="eager"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.2")}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground p-6 text-center bg-secondary">
                  {movie.name}
                </div>
              )}
              {/* Fade pra direita: integra a capa com a área de conteúdo */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-card/30 to-card pointer-events-none" />
              {/* Vinheta sutil top/bottom pra dar profundidade */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30 pointer-events-none" />
            </div>

            {/* Coluna direita: conteúdo */}
            <div className="flex-1 min-w-0 px-5 md:px-8 pt-5 md:pt-8 pb-7 md:pb-8 -mt-20 md:mt-0 relative">
              {/* Mobile: capa pequena flutuando */}
              <div className="md:hidden flex gap-4 mb-4">
                <div className="aspect-[2/3] w-28 rounded-xl overflow-hidden bg-secondary shadow-card shrink-0 ring-1 ring-border/40">
                  {cover ? (
                    <img
                      src={proxyImageUrl(cover, { w: 400, h: 600, q: 80 })}
                      alt={movie.name}
                      loading="eager"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
              </div>

              <div className="space-y-4 md:space-y-5">
                {/* Título */}
                <h2 className="text-2xl md:text-4xl font-extrabold uppercase tracking-tight leading-[1.05]">
                  {movie.name}
                  {year && <span className="text-foreground/70"> ({year})</span>}
                </h2>

                {/* Barra de chips: metadados */}
                <div className="inline-flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border/60 bg-secondary/60 px-5 py-3">
                  {year && (
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="h-[18px] w-[18px] text-primary" />
                      <span>{year}</span>
                    </span>
                  )}
                  {info?.genre && (
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Film className="h-[18px] w-[18px] text-primary" />
                      <span className="truncate max-w-[260px]">{info.genre}</span>
                    </span>
                  )}
                  {info?.duration && (
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-[18px] w-[18px] text-primary" />
                      <span>{info.duration}</span>
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
                {(info?.cast || info?.director) && (
                  <div className="rounded-2xl border border-border/50 bg-secondary/40 p-4 space-y-3">
                    {info?.director && (
                      <div className="grid grid-cols-[auto,1fr] gap-3 items-start">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90 min-w-[88px]">
                          <Video className="h-5 w-5 text-muted-foreground" />
                          <span>Direção:</span>
                        </div>
                        <p className="text-sm text-foreground/75 leading-relaxed">
                          {info.director}
                        </p>
                      </div>
                    )}
                    {info?.cast && (
                      <div className="grid grid-cols-[auto,1fr] gap-3 items-start">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90 min-w-[88px]">
                          <Users className="h-5 w-5 text-muted-foreground" />
                          <span>Elenco:</span>
                        </div>
                        <p className="text-sm text-foreground/75 leading-relaxed line-clamp-3">
                          {info.cast}
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

                {incompatible && (
                  <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold">Conteúdo marcado como incompatível</p>
                      <p className="opacity-90">
                        Você já tentou abrir este filme antes e o navegador não conseguiu
                        decodificar (provavelmente HEVC/4K). Recomendamos abrir em um
                        player externo (VLC, MX Player). Você ainda pode tentar de novo.
                      </p>
                      <button
                        type="button"
                        onClick={() => clearIncompatible(upstreamHost, movie.stream_id)}
                        className="underline underline-offset-2 hover:text-destructive/80"
                      >
                        Esquecer marcação
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    size="lg"
                    onClick={() => onPlay(movie)}
                    className="h-12 px-8 rounded-full text-base font-semibold bg-gradient-primary hover:opacity-90 shadow-glow gap-2"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    Assistir
                  </Button>
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
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
