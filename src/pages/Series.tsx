import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Player } from "@/components/Player";
import { useIsMobile } from "@/hooks/use-mobile";
import { LibraryShell } from "@/components/library/LibraryShell";
import { CategoryRail, type RailCategory } from "@/components/library/CategoryRail";
import { TitleList } from "@/components/library/TitleList";
import type { TitleListItemData } from "@/components/library/TitleListItem";
import { PreviewPanel } from "@/components/library/PreviewPanel";
import { SeriesEpisodesPanel } from "@/components/library/SeriesEpisodesPanel";
import { useFavorites } from "@/hooks/useFavorites";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useGridKeyboardNav } from "@/hooks/useGridKeyboardNav";
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
  const [playingEp, setPlayingEp] = useState<{ ep: Episode; coverFallback?: string } | null>(null);
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

  const items: TitleListItemData[] = useMemo(
    () =>
      sorted.map((s) => ({
        id: s.series_id,
        title: s.name,
        cover: s.cover,
        rating: s.rating_5based,
        subtitle: s.genre,
      })),
    [sorted],
  );

  useEffect(() => {
    if (items.length === 0) {
      setActiveId(undefined);
      return;
    }
    if (activeId == null || !items.find((i) => i.id === activeId)) {
      setActiveId(items[0].id);
    }
  }, [items, activeId]);

  const activeSeries: Series | null = useMemo(
    () => sorted.find((s) => s.series_id === activeId) || null,
    [sorted, activeId],
  );

  const debouncedActiveId = useDebouncedValue(activeId, 300);
  const { data: seriesInfo, isLoading: loadingInfo } = useQuery({
    queryKey: ["series-info", debouncedActiveId],
    queryFn: () => getSeriesInfo(creds, debouncedActiveId!),
    enabled: !!debouncedActiveId && !isMobile,
    staleTime: 1000 * 60 * 5,
  });

  const railCategories: RailCategory[] = useMemo(() => {
    const base: RailCategory[] = [
      { id: SPECIAL_ALL, name: "Todas", variant: "all", count: series.length },
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

  // Mobile fallback: usa modal antigo grande
  // Para não quebrar a experiência mobile (poucas mudanças), apresenta também 3-col simplificado.

  useGridKeyboardNav({
    enabled: !isMobile && !playingEp,
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
    onEscape: () => playingEp && setPlayingEp(null),
    onFavorite: () => activeId != null && toggle(activeId),
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
    <>
      <LibraryShell
        showPreview={!isMobile}
        header={
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Séries</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {series.length} séries · use ↑↓ ←→ para navegar
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
            onActivate={(it) => setActiveId(it.id)}
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
        }
        preview={
          <PreviewPanel
            loading={loadingInfo}
            cover={activeSeries?.cover}
            backdrop={activeSeries?.cover}
            title={activeSeries?.name}
            rating={activeSeries?.rating_5based}
            year={activeSeries?.releaseDate?.slice(0, 4)}
            genre={activeSeries?.genre}
            director={activeSeries?.director}
            cast={activeSeries?.cast}
            plot={activeSeries?.plot}
            isFavorite={activeId != null && isFavorite(activeId)}
            onToggleFavorite={activeId != null ? () => toggle(activeId) : undefined}
            playLabel="Episódios"
            emptyMessage="Selecione uma série à esquerda para ver os episódios."
          >
            {seriesInfo?.episodes && (
              <SeriesEpisodesPanel
                episodesBySeason={seriesInfo.episodes}
                onPlay={(ep) =>
                  setPlayingEp({
                    ep,
                    coverFallback: activeSeries?.cover,
                  })
                }
                onCopyExternal={handleCopyExternal}
              />
            )}
          </PreviewPanel>
        }
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
            />
          </div>
        </div>
      )}
    </>
  );
};

export default SeriesPage;
