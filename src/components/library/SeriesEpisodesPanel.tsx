import { useState, useMemo } from "react";
import { ExternalLink, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  isExternalOnly,
  getFormatBadge,
  proxyImageUrl,
  type Episode,
} from "@/services/iptv";

const toneClasses: Record<"green" | "blue" | "yellow" | "gray", string> = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  blue: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  yellow: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  gray: "bg-muted text-muted-foreground border-border",
};

interface EpisodeOverlay {
  name: string | null;
  overview: string | null;
  still: string | null;
}

interface Props {
  episodesBySeason: Record<string, Episode[]>;
  onPlay: (ep: Episode) => void;
  onCopyExternal: (ep: Episode) => void;
  /**
   * Optional pt-BR overlay from TMDB. Keyed by season → episode_number.
   * Used purely for display: title, synopsis, fallback still image.
   * Playback always uses the original Episode object from the IPTV provider.
   */
  overlay?: Map<string, Map<number, EpisodeOverlay>>;
}

export function SeriesEpisodesPanel({ episodesBySeason, onPlay, onCopyExternal, overlay }: Props) {
  const seasons = useMemo(() => Object.keys(episodesBySeason || {}), [episodesBySeason]);
  const [active, setActive] = useState<string>(seasons[0] || "");
  const current = active && episodesBySeason[active] ? episodesBySeason[active] : episodesBySeason[seasons[0]] || [];
  const activeOverlay = overlay?.get(active || seasons[0]) ?? null;

  if (seasons.length === 0) {
    return <p className="text-sm text-muted-foreground italic pt-2">Nenhum episódio disponível.</p>;
  }

  const activeKey = active || seasons[0];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="pt-2 space-y-5">
        <div className="space-y-2 pb-3 border-b border-border/40">
          <p className="text-base font-semibold text-foreground/80">
            Temporadas
          </p>
          <div className="flex flex-wrap gap-2.5">
            {seasons.map((sk) => {
              const isActive = activeKey === sk;
              return (
                <button
                  key={sk}
                  onClick={() => setActive(sk)}
                  className={cn(
                    "px-5 py-2.5 rounded-lg text-base font-bold transition-smooth border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary scale-105 shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]"
                      : "bg-secondary/60 text-foreground/80 border-border/60 hover:bg-secondary hover:border-primary/40",
                  )}
                >
                  T{sk}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          {current.map((ep) => {
            const ext = ep.container_extension;
            const external = isExternalOnly(ext, ep.direct_source);
            const badge = getFormatBadge(ext, ep.direct_source);
            // Pure display overlay — never replaces the playable Episode object.
            const epNum = Number(ep.episode_num);
            const ov = activeOverlay && Number.isFinite(epNum)
              ? activeOverlay.get(epNum)
              : null;
            // TMDB sometimes returns generic placeholders like "Episódio N" with
            // empty overview — treat those as misses and prefer the server data.
            const ovName = ov?.name?.trim() || "";
            const ovIsPlaceholder =
              !!ovName && /^epis(ó|o)dio\s*\d+$/i.test(ovName);
            const displayTitle = ovName && !ovIsPlaceholder ? ovName : ep.title;
            const displayPlot = ov?.overview?.trim() || ep.info?.plot;
            const displayStill = ep.info?.movie_image || ov?.still || null;
            return (
              <div
                key={ep.id}
                className="flex gap-4 items-center p-4 rounded-lg bg-card hover:bg-secondary/40 border border-border/40 transition-smooth"
              >
                <button
                  type="button"
                  onClick={() => (external ? onCopyExternal(ep) : onPlay(ep))}
                  className="flex gap-4 items-center flex-1 min-w-0 text-left"
                >
                  <div className="h-20 w-36 shrink-0 rounded-md bg-secondary overflow-hidden flex items-center justify-center">
                    {displayStill ? (
                      <img
                        src={
                          ep.info?.movie_image
                            ? proxyImageUrl(displayStill, { w: 288, h: 160, q: 75 })
                            : displayStill
                        }
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                      />
                    ) : (
                      <Play className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base md:text-lg font-semibold text-foreground truncate">
                        {ep.episode_num}. {displayTitle}
                      </p>
                      <span
                        title={badge.tooltip}
                        className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded border tracking-wide",
                          toneClasses[badge.tone],
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                    {displayPlot && (
                      <p className="text-sm md:text-base text-muted-foreground line-clamp-2 mt-1 leading-snug">
                        {displayPlot}
                      </p>
                    )}
                  </div>
                </button>
                {external ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        onClick={() => onCopyExternal(ep)}
                      >
                        <ExternalLink className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copiar link para player externo</TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="h-11 w-11 shrink-0 flex items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Play className="h-5 w-5 fill-current" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
