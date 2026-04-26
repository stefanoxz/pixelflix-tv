import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Play, Tv, Film, Clapperboard, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/MediaCard";
import { useIptv } from "@/context/IptvContext";
import { getLiveStreams, getVodStreams, getSeries, proxyImageUrl } from "@/services/iptv";
import { useTmdbRatings, type TmdbRatingResult } from "@/hooks/useTmdbRating";
import { seededShuffle, todaySeed } from "@/lib/dailyShuffle";
import { cn } from "@/lib/utils";
import { SafeImage } from "@/components/SafeImage";

type FeaturedItem =
  | { kind: "movie"; id: number; title: string; cover: string; rating: number; tmdb: TmdbRatingResult | null }
  | { kind: "series"; id: number; title: string; cover: string; rating: number; tmdb: TmdbRatingResult | null };

// Quantos candidatos enriquecemos com TMDB. Mais = melhor seleção, mais
// chamadas no primeiro acesso. Depois disso tudo vem do cache do React Query.
const MOVIE_CANDIDATES = 60;
const SERIES_CANDIDATES = 30;
const MIN_TMDB_VOTES = 50; // limiar pra evitar ranquear nichos

/** Extrai (YYYY) do nome do título (formato comum nos catálogos Xtream). */
function extractYear(name: string): string | undefined {
  const m = name.match(/\((\d{4})\)\s*$/);
  return m ? m[1] : undefined;
}

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

  // ---------------------------------------------------------------------------
  // Pré-filtro: candidatos elegíveis (priorizando lançamentos + nota > 0).
  // O Xtream marca quase todo item com rating_5based = 5 por default, então
  // o "rating provider" sozinho não distingue obscuro de clássico — usamos
  // ele só pra eliminar o ruído (== 0 ou inválido) e priorizar conteúdo
  // recente, depois deixamos o TMDB ranquear de fato.
  // ---------------------------------------------------------------------------
  const movieCandidates = useMemo(() => {
    const filtered = movies.filter((m) => (m.rating_5based ?? 0) > 0);
    // Ordena por added (mais recente primeiro) — `added` é unix timestamp em string
    const sorted = filtered.sort((a, b) => Number(b.added || 0) - Number(a.added || 0));
    return sorted.slice(0, MOVIE_CANDIDATES);
  }, [movies]);

  const seriesCandidates = useMemo(() => {
    const filtered = series.filter((s) => (s.rating_5based ?? 0) > 0);
    // Séries não têm `added` confiável — usamos last_modified como proxy
    const sorted = filtered.sort(
      (a, b) => Number(b.last_modified || 0) - Number(a.last_modified || 0),
    );
    return sorted.slice(0, SERIES_CANDIDATES);
  }, [series]);

  // ---------------------------------------------------------------------------
  // Enriquecimento TMDB: dispara em paralelo, cada lookup cacheado por 24h.
  // Re-renderizar com dados parciais é OK — o memo abaixo recalcula conforme
  // ratings vão chegando.
  // ---------------------------------------------------------------------------
  const movieRatings = useTmdbRatings(
    movieCandidates.map((m) => ({
      type: "movie" as const,
      key: m.stream_id,
      name: m.name,
      year: extractYear(m.name),
    })),
  );
  const seriesRatings = useTmdbRatings(
    seriesCandidates.map((s) => ({
      type: "series" as const,
      key: s.series_id,
      name: s.name,
      year: extractYear(s.name),
    })),
  );

  // ---------------------------------------------------------------------------
  // Re-rank por TMDB vote_average (com piso de votos) + rotação diária.
  // ---------------------------------------------------------------------------
  const seed = useMemo(() => todaySeed("highlights"), []);

  const topMovies = useMemo(() => {
    const enriched = movieCandidates
      .map((m) => {
        const tmdb = movieRatings.get(m.stream_id);
        return { item: m, tmdb };
      })
      // Eleitos: têm TMDB com votos suficientes
      .filter((x) => (x.tmdb?.vote_count ?? 0) >= MIN_TMDB_VOTES && (x.tmdb?.vote_average ?? 0) > 0)
      .sort((a, b) => (b.tmdb!.vote_average ?? 0) - (a.tmdb!.vote_average ?? 0));

    // Pegamos um top 24 e embaralhamos com seed do dia → 12 finais.
    // Isso dá variedade entre dias mantendo qualidade.
    const top = enriched.slice(0, 24);
    const shuffled = seededShuffle(top, seed);
    return shuffled.slice(0, 12);
  }, [movieCandidates, movieRatings, seed]);

  const topSeries = useMemo(() => {
    const enriched = seriesCandidates
      .map((s) => {
        const tmdb = seriesRatings.get(s.series_id);
        return { item: s, tmdb };
      })
      .filter((x) => (x.tmdb?.vote_count ?? 0) >= MIN_TMDB_VOTES && (x.tmdb?.vote_average ?? 0) > 0)
      .sort((a, b) => (b.tmdb!.vote_average ?? 0) - (a.tmdb!.vote_average ?? 0));

    const top = enriched.slice(0, 18);
    const shuffled = seededShuffle(top, seed + 1);
    return shuffled.slice(0, 12);
  }, [seriesCandidates, seriesRatings, seed]);

  // Fila de destaques (top 8 filmes + top 4 séries) intercalada
  const featuredQueue = useMemo<FeaturedItem[]>(() => {
    const m: FeaturedItem[] = topMovies.slice(0, 8).map((x) => ({
      kind: "movie",
      id: x.item.stream_id,
      title: x.item.name,
      cover: x.item.stream_icon,
      rating: x.item.rating_5based,
      tmdb: x.tmdb ?? null,
    }));
    const s: FeaturedItem[] = topSeries.slice(0, 4).map((x) => ({
      kind: "series",
      id: x.item.series_id,
      title: x.item.name,
      cover: x.item.cover,
      rating: x.item.rating_5based,
      tmdb: x.tmdb ?? null,
    }));
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

  // Sem gate de loading: o cache é populado pelo Sync e as seções abaixo
  // já se escondem sozinhas enquanto não houver dados (renderização progressiva).

  return (
    <div className="space-y-12 pb-12 animate-fade-in">
      {/* HERO ROTATIVO */}
      <section
        className="relative h-[55vh] md:h-[68vh] min-h-[380px] md:min-h-[460px] w-full overflow-hidden"
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
      >
        {/* camadas de fundo cross-fade — opacity sutil + scale leve no ativo (Ken Burns) */}
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
        {/* Vinheta + gradient lateral — mais forte em mobile pra leitura sem competir com o pôster */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 md:via-background/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 md:via-background/70 to-transparent" />
        {/* Glow sutil no canto superior */}
        <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

        <div className="relative h-full flex items-end pb-8 md:pb-12 mx-auto max-w-[1800px] px-4 md:px-8 gap-6">
          <div key={featured?.id ?? "empty"} className="max-w-2xl md:max-w-md lg:max-w-xl space-y-4 animate-fade-in flex-1 min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
              ✨ Em destaque {featured?.kind === "series" ? "· Série" : featured?.kind === "movie" ? "· Filme" : ""}
            </span>
            <h1 className="hero-title">
              {featured?.title || "Bem-vindo ao SuperTech"}
            </h1>

            {/* Metadata real do TMDB */}
            {(featured?.tmdb || featured?.title) && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {featured?.tmdb?.vote_average ? (
                  <span className="inline-flex items-center gap-1 text-warning font-semibold">
                    ★ {featured.tmdb.vote_average.toFixed(1)}
                    {featured.tmdb.vote_count ? (
                      <span className="text-[11px] text-muted-foreground font-normal">
                        ({featured.tmdb.vote_count.toLocaleString("pt-BR")} votos)
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {featured && extractYear(featured.title) && (
                  <>
                    <span className="opacity-50">·</span>
                    <span>{extractYear(featured.title)}</span>
                  </>
                )}
                <span className="opacity-50">·</span>
                <span className="uppercase tracking-wider text-[11px]">
                  {featured?.kind === "series" ? "Série" : "Filme"}
                </span>
              </div>
            )}

            <p className="text-base md:text-lg text-muted-foreground max-w-xl">
              Descubra milhares de filmes, séries e canais ao vivo em alta qualidade.
              Streaming sem limites, em qualquer dispositivo.
            </p>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 pt-2">
              <Button
                size="lg"
                onClick={() => featured && openFeatured(featured)}
                className="w-full sm:w-auto bg-gradient-primary hover:opacity-100 hover:scale-[1.03] hover:shadow-[0_0_32px_-4px_hsl(var(--primary)/0.6)] shadow-glow gap-2 transition-all duration-200 font-semibold tap-feedback"
                disabled={!featured}
              >
                <Play className="h-4 w-4 fill-current" />
                Assistir agora
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => featured && openFeatured(featured)}
                className="w-full sm:w-auto gap-2 backdrop-blur bg-secondary/70 hover:bg-secondary tap-feedback"
                disabled={!featured}
              >
                <Info className="h-4 w-4" />
                Mais informações
              </Button>
            </div>

            {/* MOBILE: tira horizontal de pôsteres (substitui os dots em telas pequenas) */}
            {featuredQueue.length > 1 && (
              <div className="md:hidden -mx-4 px-4 pt-3 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 pb-1">
                  {featuredQueue.slice(0, 8).map((item, i) => (
                    <button
                      key={`m-${item.kind}-${item.id}`}
                      aria-label={`Ver destaque ${i + 1}: ${item.title}`}
                      onClick={() => setActiveIdx(i)}
                      onTouchStart={() => (pausedRef.current = true)}
                      onTouchEnd={() => (pausedRef.current = false)}
                      className={cn(
                        "relative flex-shrink-0 w-14 aspect-[2/3] rounded-md overflow-hidden border transition-all duration-200 tap-feedback",
                        i === activeIdx
                          ? "border-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)] scale-105"
                          : "border-border/40 opacity-60 hover:opacity-100",
                      )}
                    >
                      <SafeImage
                        src={proxyImageUrl(item.cover)}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DESKTOP: indicadores em dots — limitados a 7 com fade nas extremidades */}
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

          {/* DESKTOP: coluna de pôsteres à direita (pôster grande + mini-pôsteres da fila) */}
          {featured && (
            <div className="hidden md:flex items-end gap-3 lg:gap-4 pb-2 animate-fade-in">
              {/* Mini-pôsteres verticais (próximos da fila, exclui o ativo) */}
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
                          onMouseEnter={() => (pausedRef.current = true)}
                          onMouseLeave={() => (pausedRef.current = false)}
                          className="relative w-16 aspect-[2/3] rounded-md overflow-hidden border border-border/40 opacity-70 hover:opacity-100 hover:scale-110 hover:border-primary/60 transition-all duration-200 tap-feedback"
                        >
                          <SafeImage
                            src={proxyImageUrl(item.cover)}
                            alt=""
                            aria-hidden
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Pôster grande do destaque ativo */}
              <button
                onClick={() => openFeatured(featured)}
                onMouseEnter={() => (pausedRef.current = true)}
                onMouseLeave={() => (pausedRef.current = false)}
                aria-label={`Abrir ${featured.title}`}
                className="group relative w-[180px] lg:w-[240px] xl:w-[280px] aspect-[2/3] rounded-xl overflow-hidden border border-border/40 shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.4)] hover:shadow-[0_25px_70px_-10px_hsl(var(--primary)/0.6)] hover:scale-[1.02] transition-all duration-300 tap-feedback bg-secondary/40"
              >
                <SafeImage
                  key={`hero-${featured.kind}-${featured.id}`}
                  src={proxyImageUrl(featured.cover)}
                  alt={featured.title}
                  decoding="async"
                  {...({ fetchpriority: "high" } as Record<string, string>)}
                  className="absolute inset-0 h-full w-full object-cover animate-fade-in"
                />
                {/* Overlay sutil + ícone de play no hover */}
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

      <div className="mx-auto max-w-[1800px] px-4 md:px-8 space-y-12">
        {/* QUICK STATS */}
        <section className="grid grid-cols-3 gap-3 md:gap-4">
          {[
            { icon: Tv, label: "Canais ao vivo", value: live.length, to: "/live", color: "from-rose-500/20 to-rose-500/5" },
            { icon: Film, label: "Filmes", value: movies.length, to: "/movies", color: "from-primary/20 to-primary/5" },
            { icon: Clapperboard, label: "Séries", value: series.length, to: "/series", color: "from-violet-500/20 to-violet-500/5" },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => navigate(s.to)}
              className="relative overflow-hidden rounded-xl bg-gradient-card border border-border/50 p-4 md:p-6 text-left transition-all duration-300 hover:border-primary/60 hover:shadow-hover hover:-translate-y-1 group"
            >
              <div className={cn(
                "absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                s.color,
              )} />
              <div className="relative">
                <div className="h-9 w-9 md:h-10 md:w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                  <s.icon className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <p className="text-2xl md:text-3xl font-bold tabular-nums">
                  {s.value.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
              <span className="absolute top-4 right-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300">
                →
              </span>
            </button>
          ))}
        </section>

        {/* TOP MOVIES */}
        {topMovies.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title text-2xl">Filmes populares</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/movies")}>
                Ver todos →
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {topMovies.map(({ item: m, tmdb }) => (
                <MediaCard
                  key={m.stream_id}
                  title={m.name}
                  cover={m.stream_icon}
                  rating={m.rating_5based}
                  tmdbRating={tmdb}
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
              <h2 className="section-title text-2xl">Séries em alta</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/series")}>
                Ver todas →
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {topSeries.map(({ item: s, tmdb }) => (
                <MediaCard
                  key={s.series_id}
                  title={s.name}
                  cover={s.cover}
                  rating={s.rating_5based}
                  tmdbRating={tmdb}
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
