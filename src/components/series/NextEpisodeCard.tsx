import { useEffect, useRef, useState } from "react";
import { Play, X, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { proxyImageUrl, type Episode } from "@/services/iptv";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  episode: Episode | null;
  season: number;
  episodeNumber: number;
  coverFallback?: string;
  /** Em segundos. Quando autoplay está OFF, ignorado (sem countdown). */
  autoplaySeconds?: number;
  /** Quanto tempo antes do disparo automático chamar `onPrefetch` (segundos). */
  prefetchLeadSeconds?: number;
  autoplayEnabled: boolean;
  onAutoplayToggle: () => void;
  onPlayNow: () => void;
  onCancel: () => void;
  /** Disparado uma vez por countdown, ~prefetchLeadSeconds antes do autoplay. */
  onPrefetch?: () => void;
}

/**
 * Card "Próximo episódio" estilo Netflix, sobreposto ao Player.
 * Aparece quando o episódio termina; faz contagem regressiva se autoplay
 * estiver ligado e dispara `onPlayNow` ao zerar.
 */
export function NextEpisodeCard({
  open,
  episode,
  season,
  episodeNumber,
  coverFallback,
  autoplaySeconds = 10,
  autoplayEnabled,
  onAutoplayToggle,
  onPlayNow,
  onCancel,
}: Props) {
  const [progress, setProgress] = useState(0); // 0..1
  const [secondsLeft, setSecondsLeft] = useState(autoplaySeconds);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!open || !episode) {
      setProgress(0);
      setSecondsLeft(autoplaySeconds);
      startRef.current = null;
      firedRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    if (!autoplayEnabled) {
      // sem countdown — só exibe o card
      setProgress(0);
      setSecondsLeft(autoplaySeconds);
      return;
    }

    firedRef.current = false;
    startRef.current = performance.now();

    const tick = (now: number) => {
      if (startRef.current === null) return;
      const elapsedMs = now - startRef.current;
      const totalMs = autoplaySeconds * 1000;
      const p = Math.min(1, elapsedMs / totalMs);
      setProgress(p);
      setSecondsLeft(Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000)));
      if (p >= 1) {
        if (!firedRef.current) {
          firedRef.current = true;
          onPlayNow();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [open, episode, autoplayEnabled, autoplaySeconds, onPlayNow]);

  // Atalhos: Enter = tocar agora, Esc = cancelar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onPlayNow();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onPlayNow, onCancel]);

  if (!open || !episode) return null;

  const thumb =
    proxyImageUrl(episode.info?.movie_image || coverFallback || "", { w: 480, h: 270, q: 80 }) ||
    "/placeholder.svg";

  return (
    <div
      className={cn(
        "absolute z-30 pointer-events-auto animate-fade-in",
        // Desktop: canto inferior direito; Mobile: rodapé inteiro
        "left-3 right-3 bottom-3 md:left-auto md:right-6 md:bottom-6 md:w-[420px]",
      )}
      role="dialog"
      aria-label="Próximo episódio"
    >
      <div className="rounded-2xl border border-border/60 bg-card/85 backdrop-blur-md shadow-2xl overflow-hidden">
        <div className="flex gap-3 p-3">
          {/* Thumb */}
          <div className="relative shrink-0 w-32 md:w-36 aspect-video rounded-lg overflow-hidden bg-secondary">
            <img
              src={thumb}
              alt={episode.title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-1 left-1.5 text-[10px] font-bold text-white/95 tracking-wide">
              T{season} • E{episodeNumber}
            </div>
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Próximo episódio
              </p>
              <p className="mt-0.5 text-sm font-bold text-foreground truncate" title={episode.title}>
                {episode.title}
              </p>
              {episode.info?.duration && (
                <p className="text-xs text-muted-foreground mt-0.5">{episode.info.duration}</p>
              )}
            </div>

            {autoplayEnabled && (
              <p className="text-xs text-muted-foreground mt-1">
                Tocando em <span className="font-semibold text-foreground">{secondsLeft}s</span>
              </p>
            )}
          </div>
        </div>

        {/* Barra de progresso */}
        {autoplayEnabled && (
          <div className="h-1 w-full bg-secondary/80 overflow-hidden">
            <div
              className="h-full bg-gradient-primary transition-[width] duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-between gap-2 p-3 pt-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              id="autoplay-pref"
              checked={autoplayEnabled}
              onCheckedChange={onAutoplayToggle}
              aria-label="Ativar reprodução automática"
            />
            <label htmlFor="autoplay-pref" className="cursor-pointer select-none">
              Autoplay
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={onPlayNow}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-2xl"
            >
              {autoplayEnabled ? (
                <FastForward className="h-4 w-4 mr-1" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Próximo episódio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
