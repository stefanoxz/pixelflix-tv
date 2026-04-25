import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

  // Fallback TMDB — chamado SEMPRE (antes de qualquer return) pra preservar a ordem dos hooks.
  const { data: tmdb } = useTmdbFallback({
    type: "movie",
    hasCover: (!!sourceCover && !!sourcePlot) || !movie,
    tmdb_id: info?.tmdb_id ?? undefined,
    name: movie?.name,
    year: year ?? undefined,
  });

  if (!movie) return null;

  const ratingNum = movie.rating_5based || (info?.rating_5based ?? 0);
  const cover = sourceCover || tmdb?.poster || null;
  const backdrop = sourceBackdrop || tmdb?.backdrop || cover;
  const plot = sourcePlot || tmdb?.overview || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-4xl p-0 overflow-hidden border-border/50 bg-card max-h-[92vh] overflow-y-auto",
          // Override do botão close (X) do shadcn pra ficar maior e mais visível
          "[&>button]:h-10 [&>button]:w-10 [&>button]:rounded-full [&>button]:bg-black/60 [&>button]:backdrop-blur [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:top-4 [&>button]:right-4 [&>button]:opacity-100 [&>button]:hover:bg-black/80 [&>button>svg]:h-5 [&>button>svg]:w-5",
        )}
      >
        <DialogTitle className="sr-only">{movie.name}</DialogTitle>
        <DialogDescription className="sr-only">Detalhes do filme</DialogDescription>

        {/* Hero / backdrop */}
        <div className="relative h-48 md:h-64 w-full overflow-hidden">
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

        <div className="px-6 pb-6 -mt-20 md:-mt-24 grid grid-cols-1 md:grid-cols-[180px,1fr] gap-5 md:gap-6 relative">
          {/* Capa */}
          <div className="aspect-[2/3] w-32 md:w-full rounded-xl overflow-hidden bg-secondary shadow-card shrink-0 ring-1 ring-border/40">
            {cover ? (
              <img
                src={proxyImageUrl(cover, { w: 400, h: 600, q: 80 })}
                alt={movie.name}
                loading="eager"
                decoding="async"
                className="h-full w-full object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.2")}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-4 text-center">
                {movie.name}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-4 md:pt-20">
            {/* Título */}
            <h2 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight leading-[1.05]">
              {movie.name}
              {year && (
                <span className="text-foreground/70"> ({year})</span>
              )}
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
              {ratingNum > 0 && (
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Star className="h-[18px] w-[18px] fill-yellow-400 text-yellow-400" />
                  <span>{ratingNum.toFixed(1)}</span>
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
                    onClick={() =>
                      clearIncompatible(upstreamHost, movie.stream_id)
                    }
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
      </DialogContent>
    </Dialog>
  );
}
