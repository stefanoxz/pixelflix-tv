import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Play, Tv, Film, Clapperboard, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/MediaCard";
import { useIptv } from "@/context/IptvContext";
import { getLiveStreams, getVodStreams, getSeries, proxyImageUrl } from "@/services/iptv";
import { useTmdbRatings } from "@/hooks/useTmdbRating";
import { seededShuffle, todaySeed } from "@/lib/dailyShuffle";
import { cn } from "@/lib/utils";
import { SafeImage } from "@/components/SafeImage";
import { ContinueWatchingRail } from "@/components/highlights/ContinueWatchingRail";
import { WelcomeNameDialog } from "@/components/WelcomeNameDialog";
import { getGreeting, hasSeenWelcomeModal, useDisplayName } from "@/lib/displayName";
import { HeroSection, type FeaturedItem } from "@/components/highlights/HeroSection";

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

  // Saudação personalizada — calculada no render (custo zero, sem requisição).
  // Não atualiza no meio da sessão se virar a hora pra evitar "salto" visual.
  const displayName = useDisplayName(creds.username);
  const greeting = useMemo(() => getGreeting(), []);

  // Modal de boas-vindas: aparece UMA vez por dispositivo no 1º acesso
  const [welcomeOpen, setWelcomeOpen] = useState(() => !hasSeenWelcomeModal(creds.username));

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
    <div className="space-y-10 md:space-y-8 pb-12 animate-fade-in">
      <HeroSection 
        featuredQueue={featuredQueue}
        activeIdx={activeIdx}
        setActiveIdx={setActiveIdx}
        greeting={greeting}
        displayName={displayName}
      />

      {/* CONTINUE ASSISTINDO — esconde sozinho quando vazio */}
      <ContinueWatchingRail />

      <div className="mx-auto max-w-[1800px] px-4 md:px-8 space-y-12">
        {/* QUICK STATS */}
        <section className="grid grid-cols-3 gap-3 md:gap-5">
          {[
            { icon: Tv, label: "Canais ao vivo", value: live.length, to: "/live", color: "from-rose-500/20 to-rose-500/5" },
            { icon: Film, label: "Filmes", value: movies.length, to: "/movies", color: "from-primary/20 to-primary/5" },
            { icon: Clapperboard, label: "Séries", value: series.length, to: "/series", color: "from-violet-500/20 to-violet-500/5" },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => navigate(s.to)}
              className="relative overflow-hidden rounded-xl bg-gradient-card border border-border/50 p-4 md:p-7 lg:p-8 text-left transition-all duration-300 hover:border-primary/60 hover:shadow-hover hover:-translate-y-1 group"
            >
              <div className={cn(
                "absolute -top-12 -right-12 h-32 w-32 md:h-40 md:w-40 rounded-full bg-gradient-to-br blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                s.color,
              )} />
              <div className="relative">
                <div className="h-9 w-9 md:h-14 md:w-14 lg:h-16 lg:w-16 rounded-lg md:rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                  <s.icon className="h-4 w-4 md:h-7 md:w-7 lg:h-8 lg:w-8" />
                </div>
                <p className="text-2xl md:text-4xl lg:text-5xl font-bold tabular-nums">
                  {s.value.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs md:text-base text-muted-foreground mt-1 md:mt-2">{s.label}</p>
                <span className="hidden md:inline-flex items-center gap-1 mt-3 lg:mt-4 text-sm font-medium text-muted-foreground/70 group-hover:text-primary transition-colors duration-300">
                  Explorar
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </span>
              </div>
              <span className="md:hidden absolute top-4 right-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300">
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
      <WelcomeNameDialog
        username={creds.username}
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
      />
    </div>
  );
};

export default Highlights;
