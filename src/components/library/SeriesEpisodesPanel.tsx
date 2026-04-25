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

interface Props {
  episodesBySeason: Record<string, Episode[]>;
  onPlay: (ep: Episode) => void;
  onCopyExternal: (ep: Episode) => void;
}

export function SeriesEpisodesPanel({ episodesBySeason, onPlay, onCopyExternal }: Props) {
  const seasons = useMemo(() => Object.keys(episodesBySeason || {}), [episodesBySeason]);
  const [active, setActive] = useState<string>(seasons[0] || "");
  const current = active && episodesBySeason[active] ? episodesBySeason[active] : episodesBySeason[seasons[0]] || [];

  if (seasons.length === 0) {
    return <p className="text-xs text-muted-foreground italic pt-2">Nenhum episódio disponível.</p>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="pt-2 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {seasons.map((sk) => (
            <button
              key={sk}
              onClick={() => setActive(sk)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-smooth",
                (active || seasons[0]) === sk
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground/80 hover:bg-secondary/70",
              )}
            >
              T{sk}
            </button>
          ))}
        </div>

        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
          {current.map((ep) => {
            const ext = ep.container_extension;
            const external = isExternalOnly(ext, ep.direct_source);
            const badge = getFormatBadge(ext, ep.direct_source);
            return (
              <div
                key={ep.id}
                className="flex gap-2 items-center p-2 rounded-md bg-card hover:bg-secondary/40 border border-border/40 transition-smooth"
              >
                <button
                  type="button"
                  onClick={() => (external ? onCopyExternal(ep) : onPlay(ep))}
                  className="flex gap-2 items-center flex-1 min-w-0 text-left"
                >
                  <div className="h-12 w-20 shrink-0 rounded bg-secondary overflow-hidden flex items-center justify-center">
                    {ep.info?.movie_image ? (
                      <img
                        src={proxyImageUrl(ep.info.movie_image, { w: 160, h: 96, q: 70 })}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                      />
                    ) : (
                      <Play className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-medium text-foreground truncate">
                        {ep.episode_num}. {ep.title}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "text-[9px] font-semibold px-1 py-0.5 rounded border tracking-wide",
                              toneClasses[badge.tone],
                            )}
                          >
                            {badge.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{badge.tooltip}</TooltipContent>
                      </Tooltip>
                    </div>
                    {ep.info?.plot && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {ep.info.plot}
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
                        className="h-7 w-7 shrink-0"
                        onClick={() => onCopyExternal(ep)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copiar link para player externo</TooltipContent>
                  </Tooltip>
                ) : (
                  <Play className="h-3.5 w-3.5 text-primary shrink-0 mr-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
