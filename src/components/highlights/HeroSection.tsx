import { useNavigate } from "react-router-dom";
import { Play, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/SafeImage";
import { proxyImageUrl } from "@/services/iptv";
import { cn } from "@/lib/utils";
import { memo, useRef } from "react";
import type { TmdbRatingResult } from "@/hooks/useTmdbRating";

export interface FeaturedItem {
  kind: "movie" | "series";
  id: number;
  title: string;
  cover: string;
  rating: number;
  tmdb: TmdbRatingResult | null;
}

interface HeroSectionProps {
  featuredQueue: FeaturedItem[];
  activeIdx: number;
  setActiveIdx: (idx: number) => void;
  greeting: string;
  displayName: string | null;
}

/** Extrai (YYYY) do nome do título (formato comum nos catálogos Xtream). */
function extractYear(name: string): string | undefined {
  const m = name.match(/\((\d{4})\)\s*$/);
  return m ? m[1] : undefined;
}

export const HeroSection = memo(({ 
  featuredQueue, 
  activeIdx, 
  setActiveIdx, 
  greeting, 
  displayName 
}: HeroSectionProps) => {
  const navigate = useNavigate();
  const pausedRef = useRef(false);
  const featured = featuredQueue[activeIdx];

  const openFeatured = (item: FeaturedItem) => {
    if (item.kind === "movie") {
      navigate("/movies", { state: { openId: item.id } });
    } else {
      navigate("/series", { state: { openId: item.id } });
    }
  };

  return (
    <section
      className="relative h-[55vh] md:h-[58vh] lg:h-[60vh] min-h-[380px] md:min-h-[420px] md:max-h-[640px] w-full overflow-hidden"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      {featuredQueue.map((item, i) => (
        <SafeImage
          key={`${item.kind}-${item.id}`}
          src={proxyImageUrl(item.cover)}
          alt=""
          aria-hidden
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-all duration-1000",
            i === activeIdx
              ? "opacity-30 scale-105"
              : "opacity-0 scale-100",
          )}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 md:via-background/85 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 md:via-background/70 to-transparent" />
      <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

      <div className="relative h-full flex items-end pb-8 md:pb-8 mx-auto max-w-[1800px] px-4 md:px-8 gap-6">
        <div key={featured?.id ?? "empty"} className="max-w-2xl md:max-w-md lg:max-w-xl space-y-6 animate-fade-in flex-1 min-w-0">
          <div className="space-y-2">
            <p className="text-[10px] md:text-sm text-muted-foreground/70 md:text-muted-foreground/90 font-bold tracking-[0.2em] uppercase" aria-live="polite">
              {greeting}{displayName ? `, ${displayName}` : ""}
            </p>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/20 border border-primary/30 px-4 py-1.5 text-[11px] font-bold text-primary backdrop-blur-xl shadow-lg shadow-primary/10">
              ✨ Destaque do Dia {featured?.kind === "series" ? "· Série" : featured?.kind === "movie" ? "· Filme" : ""}
            </span>

          </div>
          
          <h1 className="hero-title">
            {featured?.title || "Bem-vindo ao SuperTech"}
          </h1>

          {featured && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {featured.tmdb?.vote_average ? (
                <span className="inline-flex items-center gap-1 text-warning font-semibold">
                  ★ {featured.tmdb.vote_average.toFixed(1)}
                  {featured.tmdb.vote_count ? (
                    <span className="text-[11px] text-muted-foreground font-normal ml-1">
                      ({featured.tmdb.vote_count.toLocaleString("pt-BR")} votos)
                    </span>
                  ) : null}
                </span>
              ) : null}
              {extractYear(featured.title) && (
                <>
                  <span className="opacity-50">·</span>
                  <span>{extractYear(featured.title)}</span>
                </>
              )}
              <span className="opacity-50">·</span>
              <span className="uppercase tracking-wider text-[11px]">
                {featured.kind === "series" ? "Série" : "Filme"}
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 pt-2">
            <Button
              size="lg"
              onClick={() => featured && openFeatured(featured)}
              className="w-full sm:w-auto h-12 px-8 bg-gradient-primary hover:opacity-100 hover:scale-[1.03] hover:shadow-[0_0_32px_-4px_hsl(var(--primary)/0.6)] shadow-glow gap-2.5 transition-all duration-300 font-bold tap-feedback rounded-xl"
              disabled={!featured}
            >
              <Play className="h-5 w-5 fill-current" />
              Assistir agora
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => featured && openFeatured(featured)}
              className="w-full sm:w-auto h-12 px-8 gap-2.5 backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 font-semibold tap-feedback rounded-xl"
              disabled={!featured}
            >
              <Info className="h-5 w-5" />
              Mais informações
            </Button>

          </div>

          {featuredQueue.length > 1 && (
            <div className="hidden md:flex items-center gap-1.5 pt-3">
              {featuredQueue.slice(0, 7).map((_, i) => (
                <button
                  key={i}
                  aria-label={`Ir para destaque ${i + 1}`}
                  onClick={() => setActiveIdx(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === activeIdx
                      ? "w-8 bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]"
                      : "w-3 bg-foreground/25 hover:bg-foreground/50",
                  )}
                />
              ))}
              {featuredQueue.length > 7 && (
                <span className="text-[10px] text-muted-foreground ml-1 tabular-nums">
                  +{featuredQueue.length - 7}
                </span>
              )}
            </div>
          )}
        </div>

        {featured && (
          <div className="hidden md:flex items-end gap-3 lg:gap-4 pb-2 animate-fade-in">
            {featuredQueue.length > 1 && (
              <div className="hidden lg:flex flex-col gap-3">
                {featuredQueue
                  .filter((_, i) => i !== activeIdx)
                  .slice(0, 4)
                  .map((item) => {
                    const realIdx = featuredQueue.findIndex(
                      (x) => x.kind === item.kind && x.id === item.id,
                    );
                    return (
                      <button
                        key={`mini-${item.kind}-${item.id}`}
                        aria-label={`Ver destaque: ${item.title}`}
                        onClick={() => setActiveIdx(realIdx)}
                        className="relative w-16 aspect-[2/3] rounded-md overflow-hidden border border-border/40 opacity-70 hover:opacity-100 hover:scale-110 hover:border-primary/60 transition-all duration-200 tap-feedback"
                      >
                        <SafeImage
                          src={proxyImageUrl(item.cover)}
                          alt=""
                          aria-hidden
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </button>
                    );
                  })}
              </div>
            )}

            <button
              onClick={() => openFeatured(featured)}
              aria-label={`Abrir ${featured.title}`}
              className="group relative w-[180px] lg:w-[240px] xl:w-[280px] aspect-[2/3] rounded-xl overflow-hidden border border-border/40 shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.4)] hover:shadow-[0_25px_70px_-10px_hsl(var(--primary)/0.6)] hover:scale-[1.02] transition-all duration-300 tap-feedback bg-secondary/40"
            >
              <SafeImage
                key={`hero-${featured.kind}-${featured.id}`}
                src={proxyImageUrl(featured.cover)}
                alt={featured.title}
                className="absolute inset-0 h-full w-full object-cover animate-fade-in"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="h-14 w-14 rounded-full bg-primary/90 backdrop-blur flex items-center justify-center shadow-glow">
                  <Play className="h-6 w-6 fill-current text-primary-foreground" />
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
    </section>
  );
});

HeroSection.displayName = "HeroSection";
