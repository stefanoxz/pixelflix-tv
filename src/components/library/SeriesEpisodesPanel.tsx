import { useState, useMemo } from "react";
import { ExternalLink, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isExternalOnly,
  getFormatBadge,
  proxyImageUrl,
  type Episode,
} from "@/services/iptv";
import { SafeImage } from "@/components/SafeImage";

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
    <div className="pt-1 space-y-4">
      <div className="border-b border-border/40">
        <div
          className="flex gap-1 overflow-x-auto whitespace-nowrap -mx-1 px-1 scrollbar-thin"
          style={{ scrollbarWidth: "thin" }}
        >
          {seasons.map((sk) => {
            const isActive = activeKey === sk;
            return (
              <button
                key={sk}
                onClick={() => setActive(sk)}
                className={cn(
                  "relative px-3 md:px-4 py-2.5 text-sm md:text-base font-semibold transition-smooth shrink-0 focus:outline-none",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80",
                )}
              >
                Temporada {sk}
                <span
                  className={cn(
                    "absolute left-2 right-2 -bottom-px h-[3px] rounded-t-sm transition-all",
                    isActive ? "bg-primary opacity-100" : "opacity-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-h-[55vh] md:max-h-[45vh] overflow-y-auto pr-1">
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
            <button
              key={ep.id}
              type="button"
              onClick={() => (external ? onCopyExternal(ep) : onPlay(ep))}
              title={external ? "Copiar link para player externo" : undefined}
              className="group flex flex-col text-left rounded-lg overflow-hidden bg-card border border-border/40 hover:border-primary/40 hover:bg-secondary/40 transition-smooth"
            >
              <div className="relative aspect-video w-full bg-secondary overflow-hidden">
                {displayStill ? (
                  <SafeImage
                    src={
                      ep.info?.movie_image
                        ? proxyImageUrl(displayStill, { w: 480, h: 270, q: 75 })
                        : displayStill
                    }
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Play className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <span
                  title={badge.tooltip}
                  className={cn(
                    "absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded border tracking-wide backdrop-blur-sm",
                    toneClasses[badge.tone],
                  )}
                >
                  {badge.label}
                </span>
                <div className="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  {external ? (
                    <ExternalLink className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                </div>
              </div>
              <div className="p-3 space-y-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {ep.episode_num}. {displayTitle}
                </p>
                {displayPlot && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                    {displayPlot}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
