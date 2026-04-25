import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Heart, Loader2, Play, Star } from "lucide-react";
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

  if (!movie) return null;

  const info = data?.info;
  const cover = info?.movie_image || info?.cover_big || movie.stream_icon;
  const backdrop = Array.isArray(info?.backdrop_path)
    ? info!.backdrop_path[0]
    : (info?.backdrop_path as string | undefined) || cover;
  const releaseDate = info?.releasedate || info?.release_date;
  const year = releaseDate ? releaseDate.slice(0, 4) : null;
  const ratingNum = movie.rating_5based || (info?.rating_5based ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-border/50 bg-card">
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

        <div className="px-6 pb-6 -mt-20 md:-mt-24 grid grid-cols-1 md:grid-cols-[180px,1fr] gap-5 relative">
          {/* Capa */}
          <div className="aspect-[2/3] w-32 md:w-full rounded-lg overflow-hidden bg-secondary shadow-card shrink-0">
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

          <div className="min-w-0 space-y-3 md:pt-20">
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">{movie.name}</h2>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {ratingNum > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-foreground font-medium">{ratingNum.toFixed(1)}</span>
                </span>
              )}
              {year && <span>{year}</span>}
              {info?.duration && <span>{info.duration}</span>}
              {info?.genre && <span className="truncate max-w-[260px]">{info.genre}</span>}
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando detalhes…
              </div>
            ) : info?.plot ? (
              <p className="text-sm text-foreground/90 leading-relaxed line-clamp-6">{info.plot}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem sinopse disponível.</p>
            )}

            {(info?.cast || info?.director) && (
              <div className="text-xs text-muted-foreground space-y-1">
                {info?.director && (
                  <p>
                    <span className="font-semibold text-foreground/80">Direção:</span>{" "}
                    {info.director}
                  </p>
                )}
                {info?.cast && (
                  <p className="line-clamp-2">
                    <span className="font-semibold text-foreground/80">Elenco:</span> {info.cast}
                  </p>
                )}
              </div>
            )}

            {incompatible && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
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

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="lg"
                onClick={() => onPlay(movie)}
                className="bg-gradient-primary hover:opacity-90 shadow-glow gap-2"
              >
                <Play className="h-4 w-4 fill-current" />
                Assistir
              </Button>
              {onToggleFavorite && (
                <Button
                  size="lg"
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
      </DialogContent>
    </Dialog>
  );
}
