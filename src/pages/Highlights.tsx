import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Loader2, Play, Tv, Film, Clapperboard, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/MediaCard";
import { useIptv } from "@/context/IptvContext";
import { getLiveStreams, getVodStreams, getSeries, proxyImageUrl } from "@/services/iptv";
import { cn } from "@/lib/utils";

type FeaturedItem =
  | { kind: "movie"; id: number; title: string; cover: string; rating: number }
  | { kind: "series"; id: number; title: string; cover: string; rating: number };

const Highlights = () => {
  const { session } = useIptv();
  const navigate = useNavigate();
  const creds = session!.creds;

  const { data: live = [] } = useQuery({
    queryKey: ["live-streams", creds.username],
    queryFn: () => getLiveStreams(creds),
  });
  const { data: movies = [], isLoading: loadingMovies } = useQuery({
    queryKey: ["vod-streams", creds.username],
    queryFn: () => getVodStreams(creds),
  });
  const { data: series = [] } = useQuery({
    queryKey: ["series", creds.username],
    queryFn: () => getSeries(creds),
  });

  const topMovies = useMemo(
    () => [...movies].sort((a, b) => b.rating_5based - a.rating_5based).slice(0, 12),
    [movies],
  );
  const topSeries = useMemo(
    () => [...series].sort((a, b) => b.rating_5based - a.rating_5based).slice(0, 12),
    [series],
  );

  // Fila de destaques (top 8 filmes + top 4 séries) embaralhada de forma estável
  const featuredQueue = useMemo<FeaturedItem[]>(() => {
    const m: FeaturedItem[] = topMovies.slice(0, 8).map((x) => ({
      kind: "movie",
      id: x.stream_id,
      title: x.name,
      cover: x.stream_icon,
      rating: x.rating_5based,
    }));
    const s: FeaturedItem[] = topSeries.slice(0, 4).map((x) => ({
      kind: "series",
      id: x.series_id,
      title: x.name,
      cover: x.cover,
      rating: x.rating_5based,
    }));
    // intercala filmes e séries
    const out: FeaturedItem[] = [];
    const max = Math.max(m.length, s.length);
    for (let i = 0; i < max; i++) {
      if (m[i]) out.push(m[i]);
      if (i < s.length && s[i]) out.push(s[i]);
    }
    return out;
  }, [topMovies, topSeries]);

  const [activeIdx, setActiveIdx] = useState(0);
  const pausedRef = useRef(false);

  // Reseta o índice se o tamanho da fila muda
  useEffect(() => {
    if (activeIdx >= featuredQueue.length) setActiveIdx(0);
  }, [featuredQueue.length, activeIdx]);

  // Rotação automática a cada 8s
  useEffect(() => {
    if (featuredQueue.length <= 1) return;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setActiveIdx((i) => (i + 1) % featuredQueue.length);
    }, 8000);
    return () => clearInterval(id);
  }, [featuredQueue.length]);

  const featured = featuredQueue[activeIdx];

  const openFeatured = (item: FeaturedItem) => {
    if (item.kind === "movie") {
      navigate("/movies", { state: { openId: item.id } });
    } else {
      navigate("/series", { state: { openId: item.id } });
    }
  };

  if (loadingMovies && movies.length === 0) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12">
      {/* HERO ROTATIVO */}
      <section
        className="relative h-[60vh] min-h-[420px] w-full overflow-hidden"
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
      >
        {/* camadas de fundo cross-fade */}
        {featuredQueue.map((item, i) => (
          <img
            key={`${item.kind}-${item.id}`}
            src={proxyImageUrl(item.cover)}
            alt=""
            aria-hidden
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              i === activeIdx ? "opacity-40" : "opacity-0",
            )}
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />

        <div className="relative h-full flex items-end pb-12 mx-auto max-w-[1600px] px-4 md:px-8">
          <div key={featured?.id ?? "empty"} className="max-w-2xl space-y-4 animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary">
              ✨ Em destaque {featured?.kind === "series" ? "· Série" : featured?.kind === "movie" ? "· Filme" : ""}
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              {featured?.title || "Bem-vindo ao SuperTech"}
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl">
              Descubra milhares de filmes, séries e canais ao vivo em alta qualidade.
              Streaming sem limites, em qualquer dispositivo.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                size="lg"
                onClick={() => featured && openFeatured(featured)}
                className="bg-gradient-primary hover:opacity-90 shadow-glow gap-2"
                disabled={!featured}
              >
                <Play className="h-4 w-4 fill-current" />
                Assistir agora
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => featured && openFeatured(featured)}
                className="gap-2"
                disabled={!featured}
              >
                <Info className="h-4 w-4" />
                Mais informações
              </Button>
              <Button size="lg" variant="ghost" onClick={() => navigate("/live")} className="gap-2">
                <Tv className="h-4 w-4" />
                Canais ao vivo
              </Button>
            </div>

            {/* Indicadores */}
            {featuredQueue.length > 1 && (
              <div className="flex gap-1.5 pt-3">
                {featuredQueue.map((_, i) => (
                  <button
                    key={i}
                    aria-label={`Ir para destaque ${i + 1}`}
                    onClick={() => setActiveIdx(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === activeIdx ? "w-8 bg-primary" : "w-3 bg-foreground/30 hover:bg-foreground/50",
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 md:px-8 space-y-12">
        {/* QUICK STATS */}
        <section className="grid grid-cols-3 gap-4">
          {[
            { icon: Tv, label: "Canais ao vivo", value: live.length, to: "/live" },
            { icon: Film, label: "Filmes", value: movies.length, to: "/movies" },
            { icon: Clapperboard, label: "Séries", value: series.length, to: "/series" },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => navigate(s.to)}
              className="rounded-lg bg-gradient-card border border-border/50 p-4 md:p-6 text-left transition-smooth hover:border-primary/50 hover:shadow-glow group"
            >
              <s.icon className="h-5 w-5 text-primary mb-2 group-hover:scale-110 transition-bounce" />
              <p className="text-2xl md:text-3xl font-bold">{s.value.toLocaleString("pt-BR")}</p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">{s.label}</p>
            </button>
          ))}
        </section>

        {/* TOP MOVIES */}
        {topMovies.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Filmes populares</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/movies")}>
                Ver todos →
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {topMovies.map((m) => (
                <MediaCard
                  key={m.stream_id}
                  title={m.name}
                  cover={m.stream_icon}
                  rating={m.rating_5based}
                  onClick={() => navigate("/movies", { state: { openId: m.stream_id } })}
                />
              ))}
            </div>
          </section>
        )}

        {/* TOP SERIES */}
        {topSeries.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Séries em alta</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/series")}>
                Ver todas →
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {topSeries.map((s) => (
                <MediaCard
                  key={s.series_id}
                  title={s.name}
                  cover={s.cover}
                  rating={s.rating_5based}
                  onClick={() => navigate("/series", { state: { openId: s.series_id } })}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Highlights;
