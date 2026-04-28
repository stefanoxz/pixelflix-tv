import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Player } from "@/components/Player";
import { PlayerOverlay } from "@/components/PlayerOverlay";
import { MovieDetailsDialog } from "@/components/MovieDetailsDialog";
import { LibraryTopBar } from "@/components/library/LibraryTopBar";
import { CategoryRail, type RailCategory } from "@/components/library/CategoryRail";
import { MobileCategoryDrawer } from "@/components/library/MobileCategoryDrawer";
import { PosterGrid } from "@/components/library/PosterGrid";
import type { PosterItem } from "@/components/library/PosterCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useGridKeyboardNav } from "@/hooks/useGridKeyboardNav";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFuzzyFilter } from "@/lib/fuzzySearch";
import {
  useWatchProgress,
  makeProgressKey,
  MIN_RESUME_SECONDS,
  COMPLETED_RATIO,
} from "@/hooks/useWatchProgress";
import { ResumeDialog } from "@/components/ResumeDialog";
import { useIptv } from "@/context/IptvContext";
import {
  buildVodStreamUrl,
  getVodCategories,
  getVodInfo,
  getVodStreams,
  proxyImageUrl,
  type VodStream,
} from "@/services/iptv";

const SPECIAL_ALL = "all";
const SPECIAL_FAVS = "__favorites__";
const SPECIAL_RECENT = "__recent__";

const Movies = () => {
  const { session } = useIptv();
  const navigate = useNavigate();
  const location = useLocation();
  const creds = session!.creds;
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<string>(SPECIAL_ALL);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [activeId, setActiveId] = useState<number | undefined>();
  const [openMovie, setOpenMovie] = useState<VodStream | null>(null);
  const [playing, setPlaying] = useState<VodStream | null>(null);
  // Quando > 0, o player começa nesse segundo.
  const [resumeAt, setResumeAt] = useState<number>(0);
  // Quando definido, mostra o ResumeDialog antes de tocar.
  const [pendingResume, setPendingResume] =
    useState<{ movie: VodStream; t: number; d: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { isFavorite, toggle, favorites } = useFavorites(creds.username, "vod");
  const { getProgress, saveProgress, clearProgress, listInProgress } = useWatchProgress(
    creds.username,
    creds.server,
  );

  // Mapa stream_id → pct (0-100) para a barrinha "continue assistindo" nos cards.
  const movieProgressById = useMemo(() => {
    const map = new Map<number, number>();
    for (const entry of listInProgress()) {
      if (!entry.key.startsWith("movie:")) continue;
      const id = Number(entry.key.slice("movie:".length));
      if (!Number.isFinite(id) || entry.d <= 0) continue;
      const pct = Math.min(100, Math.round((entry.t / entry.d) * 100));
      if (pct > 0) map.set(id, pct);
    }
    return map;
  }, [listInProgress]);

  const { data: categories = [] } = useQuery({
    queryKey: ["vod-cats", creds.username],
    queryFn: () => getVodCategories(creds),
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
  const { data: movies = [], isLoading: moviesLoading } = useQuery({
    queryKey: ["vod-streams", creds.username],
    queryFn: () => getVodStreams(creds),
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  // Deep-link de Destaques / Conta / "Continue assistindo"
  useEffect(() => {
    const state = location.state as { openId?: number; autoplay?: boolean } | null;
    const openId = state?.openId;
    if (openId && movies.length) {
      setActiveId(openId);
      const m = movies.find((x) => x.stream_id === openId);
      if (m) {
        // Sempre abre o detalhe; se for autoplay, o player cobre por cima
        // e ao fechar o usuário volta para a tela do título.
        setOpenMovie(m);
        if (state?.autoplay) {
          playMovieRef.current?.(m);
        }
      }
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, movies, navigate]);

  // Primeiro filtra por categoria/favoritos (sem busca) — reduz o conjunto
  // antes de aplicar o fuzzy match.
  const byCategory = useMemo(() => {
    return movies.filter((m) => {
      if (activeCategory === SPECIAL_FAVS) return favorites.has(m.stream_id);
      if (activeCategory === SPECIAL_RECENT) return true;
      if (activeCategory !== SPECIAL_ALL && m.category_id !== activeCategory) return false;
      return true;
    });
  }, [movies, activeCategory, favorites]);

  // Busca tolerante a erros de digitação, acentos e ordem de palavras.
  // Quando a query é vazia, devolve `byCategory` inalterado.
  const filteredMovies = useFuzzyFilter(byCategory, debouncedSearch, (m) => m.name);

  const sortedMovies = useMemo(() => {
    if (activeCategory === SPECIAL_RECENT) {
      return [...filteredMovies]
        .sort((a, b) => Number(b.added || 0) - Number(a.added || 0))
        .slice(0, 60);
    }
    return filteredMovies;
  }, [filteredMovies, activeCategory]);

  const upstreamHost = useMemo(() => {
    try {
      return new URL(creds.streamBase || creds.server).host;
    } catch {
      return null;
    }
  }, [creds.server, creds.streamBase]);

  const items: PosterItem[] = useMemo(
    () =>
      sortedMovies.map((m) => {
        // Tenta extrair (ano) do nome se ele estiver lá
        const yearMatch = m.name.match(/\((\d{4})\)\s*$/);
        return {
          id: m.stream_id,
          title: yearMatch ? m.name.replace(/\s*\(\d{4}\)\s*$/, "") : m.name,
          cover: m.stream_icon,
          rating: m.rating_5based,
          year: yearMatch ? yearMatch[1] : undefined,
          host: upstreamHost,
          kind: "movie" as const,
          progressPct: movieProgressById.get(m.stream_id),
        };
      }),
    [sortedMovies, upstreamHost, movieProgressById],
  );

  // Quando filtros mudam, reseta o ativo
  useEffect(() => {
    if (items.length === 0) setActiveId(undefined);
    else if (activeId == null || !items.find((i) => i.id === activeId)) {
      setActiveId(items[0].id);
    }
  }, [items, activeId]);

  const railCategories: RailCategory[] = useMemo(() => {
    const base: RailCategory[] = [
      { id: SPECIAL_ALL, name: "Todos os filmes", variant: "all", count: movies.length },
      { id: SPECIAL_FAVS, name: "Favoritos", variant: "favorites", count: favorites.size },
      { id: SPECIAL_RECENT, name: "Lançamentos", variant: "recent" },
    ];
    return [
      ...base,
      ...categories.map((c) => ({
        id: c.category_id,
        name: c.category_name,
        variant: "default" as const,
      })),
    ];
  }, [categories, movies.length, favorites.size]);

  const playMovie = useCallback(
    (m: VodStream) => {
      // Mantém o MovieDetailsDialog aberto por trás do PlayerOverlay,
      // para que ao fechar o player o usuário volte ao título e não à grade.
      // Consulta progresso salvo: se houver posição válida (>= MIN_RESUME e < 95%),
      // abre o ResumeDialog; senão toca do início.
      const saved = getProgress(makeProgressKey("movie", m.stream_id));
      if (
        saved &&
        saved.t >= MIN_RESUME_SECONDS &&
        saved.d > 0 &&
        saved.t / saved.d < COMPLETED_RATIO
      ) {
        setPendingResume({ movie: m, t: saved.t, d: saved.d });
        return;
      }
      setResumeAt(0);
      setPlaying(m);
    },
    [getProgress],
  );

  // Ref para o playMovie poder ser chamado pelo deep-link useEffect sem
  // recriar dependências circulares.
  const playMovieRef = useRef<typeof playMovie>(playMovie);
  useEffect(() => {
    playMovieRef.current = playMovie;
  }, [playMovie]);

  const playingRawUrl = playing
    ? buildVodStreamUrl(
        creds,
        playing.stream_id,
        playing.container_extension || "mp4",
        playing.direct_source,
      )
    : null;

  // Navegação por teclado (desktop apenas)
  useGridKeyboardNav({
    enabled: !isMobile && !playing && !openMovie,
    onPrev: () => {
      const idx = items.findIndex((i) => i.id === activeId);
      if (idx > 0) setActiveId(items[idx - 1].id);
    },
    onNext: () => {
      const idx = items.findIndex((i) => i.id === activeId);
      if (idx >= 0 && idx < items.length - 1) setActiveId(items[idx + 1].id);
    },
    onPrevCategory: () => {
      const idx = railCategories.findIndex((c) => c.id === activeCategory);
      if (idx > 0) setActiveCategory(railCategories[idx - 1].id);
    },
    onNextCategory: () => {
      const idx = railCategories.findIndex((c) => c.id === activeCategory);
      if (idx >= 0 && idx < railCategories.length - 1) setActiveCategory(railCategories[idx + 1].id);
    },
    onSearchFocus: () => searchRef.current?.focus(),
    onEscape: () => {
      if (playing) setPlaying(null);
      else if (openMovie) setOpenMovie(null);
    },
    onFavorite: () => activeId != null && toggle(activeId),
    onPlay: () => {
      const m = sortedMovies.find((x) => x.stream_id === activeId);
      if (m) setOpenMovie(m);
    },
  });

  // Prefetch da sinopse ao passar o mouse / focar — fica instantâneo no clique.
  const prefetchInfo = useCallback(
    (it: PosterItem) => {
      queryClient.prefetchQuery({
        queryKey: ["vod-info", it.id],
        queryFn: () => getVodInfo(creds, it.id),
        staleTime: 1000 * 60 * 5,
      });
    },
    [queryClient, creds],
  );

  return (
    <div className="mx-auto max-w-[1800px] px-3 md:px-6 py-2 md:py-3">
      <LibraryTopBar
        title="Filmes"
        icon={<Film className="h-4 w-4" />}
        onOpenCategoryDrawer={() => setDrawerOpen(true)}
      />

      <div
        className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-[240px,minmax(0,1fr)] lg:h-[calc(100vh-7rem)] lg:[height:calc(100dvh-7rem)] lg:min-h-[520px] min-h-[60vh]"
      >
        <aside
          className="hidden lg:flex flex-col rounded-xl border border-border/40 bg-card/30 backdrop-blur overflow-hidden"
          aria-label="Categorias"
        >
          <CategoryRail
            categories={railCategories}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        </aside>

        <section className="flex flex-col min-h-0">
          <PosterGrid
            items={items}
            isLoading={moviesLoading}
            activeId={activeId}
            isFavorite={isFavorite}
            onActiveChange={setActiveId}
            onOpen={(it) => {
              const m = sortedMovies.find((x) => x.stream_id === it.id);
              if (m) setOpenMovie(m);
            }}
            onToggleFavorite={toggle}
            onHoverItem={prefetchInfo}
            search={search}
            onSearchChange={setSearch}
            searchInputRef={searchRef}
            searchPlaceholder="Buscar filme..."
            totalLabel={`${items.length} de ${movies.length}`}
            emptyMessage={
              activeCategory === SPECIAL_FAVS
                ? "Você ainda não favoritou nenhum filme."
                : "Nenhum filme encontrado."
            }
          />
        </section>
      </div>

      <MobileCategoryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        categories={railCategories}
        active={activeCategory}
        onChange={setActiveCategory}
        title="Categorias de Filmes"
      />

      <MovieDetailsDialog
        open={!!openMovie}
        onOpenChange={(o) => !o && setOpenMovie(null)}
        movie={openMovie}
        creds={creds}
        onPlay={playMovie}
        isFavorite={openMovie ? isFavorite(openMovie.stream_id) : false}
        onToggleFavorite={openMovie ? () => toggle(openMovie.stream_id) : undefined}
      />

      <PlayerOverlay open={!!playing} onClose={() => setPlaying(null)}>
        {playing && (
          <Player
            src={playingRawUrl}
            rawUrl={playingRawUrl ?? undefined}
            containerExt={playing.container_extension || "mp4"}
            title={playing.name}
            poster={proxyImageUrl(playing.stream_icon)}
            streamId={playing.stream_id}
            contentKind="movie"
            initialTime={resumeAt}
            onProgress={(t, d) =>
              saveProgress(makeProgressKey("movie", playing.stream_id), t, d, {
                kind: "movie",
                title: playing.name,
                poster: playing.stream_icon ?? undefined,
              })
            }
            onClose={() => setPlaying(null)}
          />
        )}
      </PlayerOverlay>

      <ResumeDialog
        open={!!pendingResume}
        onOpenChange={(o) => !o && setPendingResume(null)}
        resumeAt={pendingResume?.t ?? 0}
        duration={pendingResume?.d}
        title={pendingResume?.movie.name}
        onResume={() => {
          if (!pendingResume) return;
          setResumeAt(pendingResume.t);
          setPlaying(pendingResume.movie);
          setPendingResume(null);
        }}
        onRestart={() => {
          if (!pendingResume) return;
          clearProgress(makeProgressKey("movie", pendingResume.movie.stream_id));
          setResumeAt(0);
          setPlaying(pendingResume.movie);
          setPendingResume(null);
        }}
      />
    </div>
  );
};

export default Movies;
