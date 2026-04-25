import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Player } from "@/components/Player";
import { MovieDetailsDialog } from "@/components/MovieDetailsDialog";
import { LibraryTopBar } from "@/components/library/LibraryTopBar";
import { CategoryRail, type RailCategory } from "@/components/library/CategoryRail";
import { MobileCategoryDrawer } from "@/components/library/MobileCategoryDrawer";
import { PosterGrid } from "@/components/library/PosterGrid";
import type { PosterItem } from "@/components/library/PosterCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useGridKeyboardNav } from "@/hooks/useGridKeyboardNav";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { isFavorite, toggle, favorites } = useFavorites(creds.username, "vod");

  const { data: categories = [] } = useQuery({
    queryKey: ["vod-cats", creds.username],
    queryFn: () => getVodCategories(creds),
  });
  const { data: movies = [] } = useQuery({
    queryKey: ["vod-streams", creds.username],
    queryFn: () => getVodStreams(creds),
  });

  // Deep-link de Destaques / Conta
  useEffect(() => {
    const openId = (location.state as { openId?: number } | null)?.openId;
    if (openId && movies.length) {
      setActiveId(openId);
      const m = movies.find((x) => x.stream_id === openId);
      if (m) setOpenMovie(m);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, movies, navigate]);

  const filteredMovies = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return movies.filter((m) => {
      if (activeCategory === SPECIAL_FAVS) {
        if (!favorites.has(m.stream_id)) return false;
      } else if (activeCategory === SPECIAL_RECENT) {
        // sem filtro adicional
      } else if (activeCategory !== SPECIAL_ALL && m.category_id !== activeCategory) {
        return false;
      }
      if (q && !m.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [movies, activeCategory, debouncedSearch, favorites]);

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
        };
      }),
    [sortedMovies, upstreamHost],
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

  const playMovie = (m: VodStream) => {
    setOpenMovie(null);
    setPlaying(m);
  };

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
        className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-[240px,minmax(0,1fr)]"
        style={{ height: "calc(100vh - 7rem)", minHeight: 520 }}
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

      {playing && (
        <PlayerOverlay
          playing={playing}
          url={playingRawUrl}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
};

function PlayerOverlay({
  playing,
  url,
  onClose,
}: {
  playing: VodStream;
  url: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-5xl">
        <Button
          variant="secondary"
          size="icon"
          className="absolute -top-12 right-0 z-10"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <Player
          src={url}
          rawUrl={url ?? undefined}
          containerExt={playing.container_extension || "mp4"}
          title={playing.name}
          poster={proxyImageUrl(playing.stream_icon)}
          streamId={playing.stream_id}
          contentKind="movie"
        />
      </div>
    </div>
  );
}

export default Movies;
