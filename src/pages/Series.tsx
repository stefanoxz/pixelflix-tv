import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tv2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Player } from "@/components/Player";
import { useIsMobile } from "@/hooks/use-mobile";
import { LibraryTopBar } from "@/components/library/LibraryTopBar";
import { CategoryRail, type RailCategory } from "@/components/library/CategoryRail";
import { MobileCategoryDrawer } from "@/components/library/MobileCategoryDrawer";
import { PosterGrid } from "@/components/library/PosterGrid";
import type { PosterItem } from "@/components/library/PosterCard";
import { SeriesDetailsDialog } from "@/components/SeriesDetailsDialog";
import { useFavorites } from "@/hooks/useFavorites";
import { useGridKeyboardNav } from "@/hooks/useGridKeyboardNav";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useIptv } from "@/context/IptvContext";
import {
  buildSeriesEpisodeUrl,
  getSeries,
  getSeriesCategories,
  getSeriesInfo,
  proxyImageUrl,
  type Episode,
  type Series,
} from "@/services/iptv";

const SPECIAL_ALL = "all";
const SPECIAL_FAVS = "__favorites__";
const SPECIAL_RECENT = "__recent__";

const SeriesPage = () => {
  const { session } = useIptv();
  const navigate = useNavigate();
  const location = useLocation();
  const creds = session!.creds;
  const isMobile = useIsMobile();

  const [activeCategory, setActiveCategory] = useState<string>(SPECIAL_ALL);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<number | undefined>();
  const [openSeries, setOpenSeries] = useState<Series | null>(null);
  const [playingEp, setPlayingEp] = useState<{ ep: Episode; coverFallback?: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { isFavorite, toggle, favorites } = useFavorites(creds.username, "series");

  const { data: categories = [] } = useQuery({
    queryKey: ["series-cats", creds.username],
    queryFn: () => getSeriesCategories(creds),
  });
  const { data: series = [] } = useQuery({
    queryKey: ["series", creds.username],
    queryFn: () => getSeries(creds),
  });

  // Deep-link
  useEffect(() => {
    const openId = (location.state as { openId?: number } | null)?.openId;
    if (openId && series.length) {
      setActiveId(openId);
      const s = series.find((x) => x.series_id === openId);
      if (s) setOpenSeries(s);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, series, navigate]);

  const filtered = useMemo(() => {
    return series.filter((s) => {
      if (activeCategory === SPECIAL_FAVS) {
        if (!favorites.has(s.series_id)) return false;
      } else if (activeCategory === SPECIAL_RECENT) {
        // sem filtro adicional
      } else if (activeCategory !== SPECIAL_ALL && s.category_id !== activeCategory) {
        return false;
      }
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [series, activeCategory, search, favorites]);

  const sorted = useMemo(() => {
    if (activeCategory === SPECIAL_RECENT) {
      return [...filtered]
        .sort((a, b) => Number(b.last_modified || 0) - Number(a.last_modified || 0))
        .slice(0, 60);
    }
    return filtered;
  }, [filtered, activeCategory]);

  const items: PosterItem[] = useMemo(
    () =>
      sorted.map((s) => {
        const yearMatch = s.name.match(/\((\d{4})\)\s*$/);
        return {
          id: s.series_id,
          title: yearMatch ? s.name.replace(/\s*\(\d{4}\)\s*$/, "") : s.name,
          cover: s.cover,
          rating: s.rating_5based,
          year: yearMatch
            ? yearMatch[1]
            : s.releaseDate
              ? s.releaseDate.slice(0, 4)
              : undefined,
        };
      }),
    [sorted],
  );

  useEffect(() => {
    if (items.length === 0) setActiveId(undefined);
    else if (activeId == null || !items.find((i) => i.id === activeId)) {
      setActiveId(items[0].id);
    }
  }, [items, activeId]);

  const railCategories: RailCategory[] = useMemo(() => {
    const base: RailCategory[] = [
      { id: SPECIAL_ALL, name: "Todas as séries", variant: "all", count: series.length },
      { id: SPECIAL_FAVS, name: "Favoritas", variant: "favorites", count: favorites.size },
      { id: SPECIAL_RECENT, name: "Recentes", variant: "recent" },
    ];
    return [
      ...base,
      ...categories.map((c) => ({
        id: c.category_id,
        name: c.category_name,
        variant: "default" as const,
      })),
    ];
  }, [categories, series.length, favorites.size]);

  const handleCopyExternal = async (ep: Episode) => {
    const url = buildSeriesEpisodeUrl(creds, ep.id, ep.container_extension, ep.direct_source);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado — abra no VLC ou MX Player");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  useGridKeyboardNav({
    enabled: !isMobile && !playingEp && !openSeries,
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
      if (idx >= 0 && idx < railCategories.length - 1)
        setActiveCategory(railCategories[idx + 1].id);
    },
    onSearchFocus: () => searchRef.current?.focus(),
    onEscape: () => {
      if (playingEp) setPlayingEp(null);
      else if (openSeries) setOpenSeries(null);
    },
    onFavorite: () => activeId != null && toggle(activeId),
    onPlay: () => {
      const s = sorted.find((x) => x.series_id === activeId);
      if (s) setOpenSeries(s);
    },
  });

  const epUrl = playingEp
    ? buildSeriesEpisodeUrl(
        creds,
        playingEp.ep.id,
        playingEp.ep.container_extension,
        playingEp.ep.direct_source,
      )
    : null;

  return (
    <div className="mx-auto max-w-[1800px] px-3 md:px-6 py-2 md:py-3">
      <LibraryTopBar
        title="Séries"
        icon={<Tv2 className="h-4 w-4" />}
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
              const s = sorted.find((x) => x.series_id === it.id);
              if (s) setOpenSeries(s);
            }}
            onToggleFavorite={toggle}
            search={search}
            onSearchChange={setSearch}
            searchInputRef={searchRef}
            searchPlaceholder="Buscar série..."
            totalLabel={`${items.length} de ${series.length}`}
            emptyMessage={
              activeCategory === SPECIAL_FAVS
                ? "Você ainda não favoritou nenhuma série."
                : "Nenhuma série encontrada."
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
        title="Categorias de Séries"
      />

      <SeriesDetailsDialog
        open={!!openSeries}
        onOpenChange={(o) => !o && setOpenSeries(null)}
        series={openSeries}
        creds={creds}
        onPlayEpisode={(ep) => {
          setPlayingEp({ ep, coverFallback: openSeries?.cover });
          setOpenSeries(null);
        }}
        onCopyExternal={handleCopyExternal}
        isFavorite={openSeries ? isFavorite(openSeries.series_id) : false}
        onToggleFavorite={openSeries ? () => toggle(openSeries.series_id) : undefined}
      />

      {playingEp && epUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-5xl">
            <Button
              variant="secondary"
              size="icon"
              className="absolute -top-12 right-0 z-10"
              onClick={() => setPlayingEp(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <Player
              src={epUrl}
              rawUrl={epUrl}
              containerExt={playingEp.ep.container_extension}
              title={playingEp.ep.title}
              poster={proxyImageUrl(
                playingEp.ep.info?.movie_image || playingEp.coverFallback || "",
              )}
              onClose={() => setPlayingEp(null)}
              streamId={playingEp.ep.id}
              contentKind="episode"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SeriesPage;
