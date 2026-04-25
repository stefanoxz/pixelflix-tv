import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Player } from "@/components/Player";
import { MovieDetailsDialog } from "@/components/MovieDetailsDialog";
import { LibraryShell } from "@/components/library/LibraryShell";
import { CategoryRail, type RailCategory } from "@/components/library/CategoryRail";
import { TitleList } from "@/components/library/TitleList";
import type { TitleListItemData } from "@/components/library/TitleListItem";
import { PreviewPanel } from "@/components/library/PreviewPanel";
import { useFavorites } from "@/hooks/useFavorites";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useGridKeyboardNav } from "@/hooks/useGridKeyboardNav";
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

  const [activeCategory, setActiveCategory] = useState<string>(SPECIAL_ALL);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<number | undefined>();
  const [playing, setPlaying] = useState<VodStream | null>(null);
  const [mobileDetails, setMobileDetails] = useState<VodStream | null>(null);
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
      if (isMobile) {
        const m = movies.find((x) => x.stream_id === openId);
        if (m) setMobileDetails(m);
      }
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, movies, navigate, isMobile]);

  const filteredMovies = useMemo(() => {
    return movies.filter((m) => {
      if (activeCategory === SPECIAL_FAVS) {
        if (!favorites.has(m.stream_id)) return false;
      } else if (activeCategory === SPECIAL_RECENT) {
        // recentes: deixa todos, ordena depois
      } else if (activeCategory !== SPECIAL_ALL && m.category_id !== activeCategory) {
        return false;
      }
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [movies, activeCategory, search, favorites]);

  const sortedMovies = useMemo(() => {
    if (activeCategory === SPECIAL_RECENT) {
      return [...filteredMovies]
        .sort((a, b) => Number(b.added || 0) - Number(a.added || 0))
        .slice(0, 60);
    }
    return filteredMovies;
  }, [filteredMovies, activeCategory]);

  const items: TitleListItemData[] = useMemo(
    () =>
      sortedMovies.map((m) => ({
        id: m.stream_id,
        title: m.name,
        cover: m.stream_icon,
        rating: m.rating_5based,
      })),
    [sortedMovies],
  );

  // Quando filtros mudam, ajusta o ativo
  useEffect(() => {
    if (items.length === 0) {
      setActiveId(undefined);
      return;
    }
    if (activeId == null || !items.find((i) => i.id === activeId)) {
      setActiveId(items[0].id);
    }
  }, [items, activeId]);

  const activeMovie = useMemo(
    () => sortedMovies.find((m) => m.stream_id === activeId) || null,
    [sortedMovies, activeId],
  );

  const debouncedActiveId = useDebouncedValue(activeId, 250);
  const { data: vodInfoData, isLoading: loadingInfo } = useQuery({
    queryKey: ["vod-info", debouncedActiveId],
    queryFn: () => getVodInfo(creds, debouncedActiveId!),
    enabled: !!debouncedActiveId && !isMobile,
    staleTime: 1000 * 60 * 5,
  });
  const info = vodInfoData?.info;

  const railCategories: RailCategory[] = useMemo(() => {
    const base: RailCategory[] = [
      { id: SPECIAL_ALL, name: "Todos", variant: "all", count: movies.length },
      { id: SPECIAL_FAVS, name: "Favoritos", variant: "favorites", count: favorites.size },
      { id: SPECIAL_RECENT, name: "Adicionados recentemente", variant: "recent" },
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
    setMobileDetails(null);
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
    enabled: !isMobile && !playing,
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
    onEscape: () => playing && setPlaying(null),
    onFavorite: () => activeId != null && toggle(activeId),
    onPlay: () => activeMovie && playMovie(activeMovie),
  });

  const releaseDate = info?.releasedate || info?.release_date;
  const year = releaseDate ? releaseDate.slice(0, 4) : undefined;
  const cover = info?.movie_image || info?.cover_big || activeMovie?.stream_icon;
  const backdrop = Array.isArray(info?.backdrop_path)
    ? info?.backdrop_path[0]
    : (info?.backdrop_path as string | undefined) || cover;

  // Mobile: renderiza grid simples + dialog (mantém comportamento anterior simplificado)
  if (isMobile) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Filmes</h1>
          <p className="text-xs text-muted-foreground">{movies.length} filmes</p>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
          <TitleList
            items={items}
            activeId={activeId}
            isFavorite={isFavorite}
            onSelect={(it) => setActiveId(it.id)}
            onActivate={(it) => {
              const m = sortedMovies.find((x) => x.stream_id === it.id);
              if (m) setMobileDetails(m);
            }}
            onToggleFavorite={toggle}
            search={search}
            onSearchChange={setSearch}
            searchInputRef={searchRef}
            searchPlaceholder="Buscar filme..."
            totalLabel={`${items.length}`}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {railCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-smooth ${
                activeCategory === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {c.name}
              {typeof c.count === "number" && c.count > 0 ? ` (${c.count})` : ""}
            </button>
          ))}
        </div>

        <MovieDetailsDialog
          open={!!mobileDetails}
          onOpenChange={(o) => !o && setMobileDetails(null)}
          movie={mobileDetails}
          creds={creds}
          onPlay={playMovie}
          isFavorite={mobileDetails ? isFavorite(mobileDetails.stream_id) : false}
          onToggleFavorite={
            mobileDetails ? () => toggle(mobileDetails.stream_id) : undefined
          }
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
  }

  return (
    <>
      <LibraryShell
        header={
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Filmes</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {movies.length} títulos · use ↑↓ ←→ para navegar, / para buscar, Enter para assistir
              </p>
            </div>
          </div>
        }
        rail={
          <CategoryRail
            categories={railCategories}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        }
        list={
          <TitleList
            items={items}
            activeId={activeId}
            isFavorite={isFavorite}
            onSelect={(it) => setActiveId(it.id)}
            onActivate={(it) => {
              const m = sortedMovies.find((x) => x.stream_id === it.id);
              if (m) playMovie(m);
            }}
            onToggleFavorite={toggle}
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
        }
        preview={
          <PreviewPanel
            loading={loadingInfo}
            cover={cover}
            backdrop={backdrop}
            title={activeMovie?.name}
            year={year}
            rating={activeMovie?.rating_5based || info?.rating_5based}
            duration={info?.duration}
            genre={info?.genre}
            director={info?.director}
            cast={info?.cast}
            plot={info?.plot}
            isFavorite={activeId != null && isFavorite(activeId)}
            onPlay={activeMovie ? () => playMovie(activeMovie) : undefined}
            onToggleFavorite={activeId != null ? () => toggle(activeId) : undefined}
          />
        }
      />

      {playing && (
        <PlayerOverlay
          playing={playing}
          url={playingRawUrl}
          onClose={() => setPlaying(null)}
        />
      )}
    </>
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
        />
      </div>
    </div>
  );
}

export default Movies;
