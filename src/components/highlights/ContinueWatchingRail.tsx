import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Play, X } from "lucide-react";
import { useIptv } from "@/context/IptvContext";
import { useWatchProgress, formatProgressTime } from "@/hooks/useWatchProgress";
import { proxyImageUrl } from "@/services/iptv";
import { SafeImage } from "@/components/SafeImage";
import { cn } from "@/lib/utils";

const MAX_ITEMS = 12;

/**
 * Prateleira "Continue assistindo" exibida no topo do Highlights.
 *
 * Fonte: localStorage do hook useWatchProgress (já sincronizado com o
 * backend). Lista filmes e episódios em andamento, ordenados pelo
 * mais recente. Click leva direto para o player com autoplay
 * (pula o details dialog).
 */
export function ContinueWatchingRail() {
  const { session } = useIptv();
  const creds = session?.creds;
  const navigate = useNavigate();
  const { listInProgress, clearProgress } = useWatchProgress(
    creds?.username,
    creds?.server,
  );

  const items = useMemo(() => {
    return listInProgress()
      .filter((e) => e.d > 0 && e.t > 0)
      .slice(0, MAX_ITEMS);
  }, [listInProgress]);

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1800px] px-4 md:px-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title text-2xl">Continue assistindo</h2>
      </div>
      <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 md:-mx-8 md:px-8 pb-2">
        {items.map((entry) => {
          const pct = Math.min(100, Math.max(0, Math.round((entry.t / entry.d) * 100)));
          const remaining = Math.max(0, entry.d - entry.t);
          const isEpisode = entry.kind === "episode" || entry.key.startsWith("episode:");
          const title = entry.title || (isEpisode ? "Episódio" : "Filme");

          const handleOpen = () => {
            if (isEpisode && entry.seriesId != null) {
              const epId = entry.key.startsWith("episode:")
                ? entry.key.slice("episode:".length)
                : null;
              navigate("/series", {
                state: { openId: entry.seriesId, episodeId: epId, autoplay: true },
              });
            } else if (!isEpisode) {
              const movieId = entry.key.startsWith("movie:")
                ? Number(entry.key.slice("movie:".length))
                : null;
              if (movieId != null && Number.isFinite(movieId)) {
                navigate("/movies", { state: { openId: movieId, autoplay: true } });
              }
            }
          };

          return (
            <div
              key={entry.key}
              className="relative group flex-shrink-0 w-[180px] md:w-[220px]"
            >
              <button
                type="button"
                onClick={handleOpen}
                className={cn(
                  "block w-full aspect-video rounded-xl overflow-hidden bg-card/60 relative border border-white/5",
                  "transition-all duration-500 ease-out",
                  "hover:ring-2 hover:ring-primary/60 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,1)]",
                  "active:scale-[0.96]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                )}

                aria-label={`Continuar ${title}`}
              >
                {entry.poster ? (
                  <SafeImage
                    src={proxyImageUrl(entry.poster, { w: 440, h: 248, q: 70 })}
                    alt={title}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground bg-gradient-to-br from-secondary to-secondary/40 p-3 text-center">
                    {title}
                  </div>
                )}

                {/* Play overlay no hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="h-12 w-12 rounded-full bg-primary/90 backdrop-blur flex items-center justify-center shadow-glow">
                    <Play className="h-5 w-5 fill-current text-primary-foreground ml-0.5" />
                  </div>
                </div>

                {/* Gradient + meta */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 pt-8">
                  <p className="text-[12px] font-semibold text-white leading-tight line-clamp-2 drop-shadow">
                    {title}
                  </p>
                  <p className="text-[10px] text-white/75 mt-0.5 tabular-nums">
                    {formatProgressTime(remaining)} restantes
                  </p>
                </div>

                {/* Barra de progresso */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60" aria-hidden>
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </button>

              {/* Botão remover (X) — top-right, aparece no hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearProgress(entry.key);
                }}
                aria-label="Remover de continue assistindo"
                className={cn(
                  "absolute top-1.5 right-1.5 h-7 w-7 rounded-full flex items-center justify-center",
                  "bg-black/70 backdrop-blur-sm text-white",
                  "md:opacity-0 md:group-hover:opacity-100 focus:opacity-100",
                  "transition-all duration-200 hover:scale-110 hover:bg-black/90 active:scale-95",
                )}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
