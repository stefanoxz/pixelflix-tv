import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tv2 } from "lucide-react";
import { toast } from "sonner";
import { Player } from "@/components/Player";
import { PlayerOverlay } from "@/components/PlayerOverlay";
import { NextEpisodeCard } from "@/components/series/NextEpisodeCard";
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
import { useFuzzyFilter } from "@/lib/fuzzySearch";
import { useAutoplayPreference } from "@/hooks/useAutoplayPreference";
import {
  useWatchProgress,
  makeProgressKey,
  MIN_RESUME_SECONDS,
  COMPLETED_RATIO,
} from "@/hooks/useWatchProgress";
import { ResumeDialog } from "@/components/ResumeDialog";
import { useIptv } from "@/context/IptvContext";
import {
  buildSeriesEpisodeUrl,
  getSeries,
  getSeriesCategories,
  getSeriesInfo,
  normalizeExt,
  primeStreamToken,
  proxyImageUrl,
  type Episode,
  type Series,
  type SeriesInfo,
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
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<string>(SPECIAL_ALL);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [activeId, setActiveId] = useState<number | undefined>();
  const [openSeries, setOpenSeries] = useState<Series | null>(null);
  const [playingEp, setPlayingEp] = useState<{
    ep: Episode;
    seriesId: number;
    coverFallback?: string;
  } | null>(null);
  const [showNextCard, setShowNextCard] = useState(false);
  // Posição inicial em segundos para o próximo episódio a carregar.
  const [resumeAt, setResumeAt] = useState<number>(0);
  // Quando definido, mostra o ResumeDialog antes de tocar o episódio.
  const [pendingResume, setPendingResume] = useState<{
    ep: Episode;
    seriesId: number;
    coverFallback?: string;
    t: number;
    d: number;
  } | null>(null);
  const autoplayPref = useAutoplayPreference();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { isFavorite, toggle, favorites } = useFavorites(creds.username, "series");
  const { getProgress, saveProgress, clearProgress, listInProgress } = useWatchProgress(
    creds.username,
    creds.server,
  );

  // Mapa series_id → pct (0-100) baseado no último episódio assistido daquela
  // série. Custo O(n) sobre nº de itens em progresso (≤200). Memoizado pra
  // não recalcular a cada render da grade.
  const seriesProgressById = useMemo(() => {
    const map = new Map<number, number>();
    for (const entry of listInProgress()) {
      const isEp = entry.kind === "episode" || entry.key.startsWith("episode:");
      if (!isEp || entry.seriesId == null || entry.d <= 0) continue;
      const pct = Math.min(100, Math.round((entry.t / entry.d) * 100));
      if (pct <= 0) continue;
      // listInProgress já vem ordenado por updatedAt desc — primeiro vence.
      if (!map.has(entry.seriesId)) map.set(entry.seriesId, pct);
    }
    return map;
  }, [listInProgress]);

  const { data: categories = [] } = useQuery({
    queryKey: ["series-cats", creds.username],
    queryFn: () => getSeriesCategories(creds),
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
  const { data: series = [], isLoading: seriesLoading } = useQuery({
    queryKey: ["series", creds.username],
    queryFn: () => getSeries(creds),
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  // Deep-link (Highlights, Conta, Continue assistindo).
  // - openId         → abre o details dialog da série (comportamento padrão).
  // - autoplay+epId  → vem do rail "Continue assistindo": baixa o info da série,
  //                    encontra o episódio e dispara o ResumeDialog/player direto.
  useEffect(() => {
    const state = location.state as
      | { openId?: number; autoplay?: boolean; episodeId?: string | number | null }
      | null;
    const openId = state?.openId;
    if (openId && series.length) {
      setActiveId(openId);
      const s = series.find((x) => x.series_id === openId);
      if (!s) {
        navigate(location.pathname, { replace: true, state: null });
        return;
      }
      if (state?.autoplay && state.episodeId != null) {
        // Busca info da série (cacheado), localiza o episódio, dispara o flow.
        const epId = String(state.episodeId);
        void (async () => {
          try {
            const info = await queryClient.fetchQuery({
              queryKey: ["series-info", openId],
              queryFn: () => getSeriesInfo(creds, openId),
              staleTime: 1000 * 60 * 5,
            });
            const ep = Object.values(info?.episodes ?? {})
              .flat()
              .find((e) => String(e.id) === epId);
            if (!ep) {
              setOpenSeries(s);
              return;
            }
            const saved = getProgress(makeProgressKey("episode", ep.id));
            if (
              saved &&
              saved.t >= MIN_RESUME_SECONDS &&
              saved.d > 0 &&
              saved.t / saved.d < COMPLETED_RATIO
            ) {
              setPendingResume({
                ep,
                seriesId: s.series_id,
                coverFallback: s.cover,
                t: saved.t,
                d: saved.d,
              });
            } else {
              setResumeAt(0);
              setPlayingEp({ ep, seriesId: s.series_id, coverFallback: s.cover });
            }
          } catch {
            setOpenSeries(s);
          }
        })();
      } else {
        setOpenSeries(s);
      }
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, series, navigate, queryClient, creds, getProgress]);

  // Categoria/favoritos primeiro — depois passa pelo fuzzy filter.
  const byCategory = useMemo(() => {
    return series.filter((s) => {
      if (activeCategory === SPECIAL_FAVS) return favorites.has(s.series_id);
      if (activeCategory === SPECIAL_RECENT) return true;
      if (activeCategory !== SPECIAL_ALL && s.category_id !== activeCategory) return false;
      return true;
    });
  }, [series, activeCategory, favorites]);

  const filtered = useFuzzyFilter(byCategory, debouncedSearch, (s) => s.name);

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
          kind: "series" as const,
          year: yearMatch
            ? yearMatch[1]
            : s.releaseDate
              ? s.releaseDate.slice(0, 4)
              : undefined,
          // Barra "continue assistindo" no card — usa o último episódio
          // assistido daquela série.
          progressPct: seriesProgressById.get(s.series_id),
        };
      }),
    [sorted, seriesProgressById],
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

  const prefetchSeriesInfo = useCallback(
    (it: PosterItem) => {
      queryClient.prefetchQuery({
        queryKey: ["series-info", it.id],
        queryFn: () => getSeriesInfo(creds, it.id),
        staleTime: 1000 * 60 * 5,
      });
    },
    [queryClient, creds],
  );

  // Calcula próximo episódio cruzando o ep atual com o SeriesInfo cacheado.
  const nextEpisodeInfo = useMemo<{
    ep: Episode;
    season: number;
    episodeNumber: number;
  } | null>(() => {
    if (!playingEp) return null;
    const info = queryClient.getQueryData<SeriesInfo>([
      "series-info",
      playingEp.seriesId,
    ]);
    if (!info?.episodes) return null;
    // Ordena temporadas numericamente
    const seasonNums = Object.keys(info.episodes)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    for (let i = 0; i < seasonNums.length; i++) {
      const sNum = seasonNums[i];
      const list = info.episodes[String(sNum)] ?? [];
      const idx = list.findIndex((e) => String(e.id) === String(playingEp.ep.id));
      if (idx === -1) continue;
      // Próximo da mesma temporada
      if (idx + 1 < list.length) {
        const nextEp = list[idx + 1];
        return { ep: nextEp, season: sNum, episodeNumber: nextEp.episode_num ?? idx + 2 };
      }
      // Primeiro da próxima temporada
      const nextS = seasonNums[i + 1];
      if (nextS != null) {
        const nextList = info.episodes[String(nextS)] ?? [];
        if (nextList.length > 0) {
          const nextEp = nextList[0];
          return { ep: nextEp, season: nextS, episodeNumber: nextEp.episode_num ?? 1 };
        }
      }
      return null;
    }
    return null;
  }, [playingEp, queryClient]);

  const handleEpisodeEnded = useCallback(() => {
    setShowNextCard(true);
  }, []);

  const handlePlayNext = useCallback(() => {
    if (!nextEpisodeInfo || !playingEp) {
      setShowNextCard(false);
      return;
    }
    setShowNextCard(false);
    // Próximo episódio: começa do início, mesmo se houver progresso salvo
    // antigo (o usuário acabou de assistir um episódio inteiro, não faz
    // sentido perguntar nada).
    setResumeAt(0);
    setPlayingEp({
      ep: nextEpisodeInfo.ep,
      seriesId: playingEp.seriesId,
      coverFallback: playingEp.coverFallback,
    });
  }, [nextEpisodeInfo, playingEp]);

  // Prefetch do próximo episódio (token + warm-up TCP/TLS) ~1.5s antes do
  // autoplay disparar, para reduzir latência ao trocar automaticamente.
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const handlePrefetchNext = useCallback(() => {
    if (!nextEpisodeInfo) return;
    const ep = nextEpisodeInfo.ep;
    const url = buildSeriesEpisodeUrl(
      creds,
      ep.id,
      ep.container_extension,
      ep.direct_source,
    );
    if (!url) return;
    // Cancela qualquer prefetch anterior (ex: usuário cancelou e voltou).
    prefetchAbortRef.current?.abort();
    const ac = new AbortController();
    prefetchAbortRef.current = ac;
    const ext = normalizeExt(ep.container_extension);
    const kind = ext === "m3u8" ? "playlist" : "segment";
    void primeStreamToken({
      url,
      kind,
      iptvUsername: creds.username,
      mode: "redirect",
      signal: ac.signal,
    });
  }, [nextEpisodeInfo, creds]);

  // Aborta prefetch se o card fechar sem disparar autoplay.
  useEffect(() => {
    if (!showNextCard) {
      prefetchAbortRef.current?.abort();
      prefetchAbortRef.current = null;
    }
  }, [showNextCard]);

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
            isLoading={seriesLoading}
            activeId={activeId}
            isFavorite={isFavorite}
            onActiveChange={setActiveId}
            onOpen={(it) => {
              const s = sorted.find((x) => x.series_id === it.id);
              if (s) setOpenSeries(s);
            }}
            onToggleFavorite={toggle}
            onHoverItem={prefetchSeriesInfo}
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
        open={!!openSeries && !playingEp}
        onOpenChange={(o) => !o && setOpenSeries(null)}
        series={openSeries}
        creds={creds}
        onPlayEpisode={(ep) => {
          // Mantém `openSeries` definido — quando o player fechar,
          // o diálogo da série reaparece automaticamente (condição `&& !playingEp`).
          if (!openSeries) return;
          setShowNextCard(false);
          // Consulta progresso salvo deste episódio.
          const saved = getProgress(makeProgressKey("episode", ep.id));
          if (
            saved &&
            saved.t >= MIN_RESUME_SECONDS &&
            saved.d > 0 &&
            saved.t / saved.d < COMPLETED_RATIO
          ) {
            setPendingResume({
              ep,
              seriesId: openSeries.series_id,
              coverFallback: openSeries.cover,
              t: saved.t,
              d: saved.d,
            });
            return;
          }
          setResumeAt(0);
          setPlayingEp({
            ep,
            seriesId: openSeries.series_id,
            coverFallback: openSeries.cover,
          });
        }}
        onCopyExternal={handleCopyExternal}
        isFavorite={openSeries ? isFavorite(openSeries.series_id) : false}
        onToggleFavorite={openSeries ? () => toggle(openSeries.series_id) : undefined}
      />

      <PlayerOverlay
        open={!!(playingEp && epUrl)}
        onClose={() => {
          setShowNextCard(false);
          setPlayingEp(null);
        }}
      >
        {playingEp && epUrl && (
          <>
            <Player
              // Forçar remontagem ao trocar de episódio garante reset limpo de hls/mpegts.
              key={String(playingEp.ep.id)}
              src={epUrl}
              rawUrl={epUrl}
              containerExt={playingEp.ep.container_extension}
              title={playingEp.ep.title}
              poster={proxyImageUrl(
                playingEp.ep.info?.movie_image || playingEp.coverFallback || "",
              )}
              onClose={() => {
                setShowNextCard(false);
                setPlayingEp(null);
              }}
              streamId={playingEp.ep.id}
              contentKind="episode"
              initialTime={resumeAt}
              onProgress={(t, d) => {
                const ep = playingEp.ep;
                const seriesObj = openSeries;
                const seriesName = seriesObj?.name;
                const epLabel = ep.title
                  ? seriesName
                    ? `${seriesName} — ${ep.title}`
                    : ep.title
                  : seriesName ?? "Episódio";
                saveProgress(makeProgressKey("episode", ep.id), t, d, {
                  kind: "episode",
                  seriesId: playingEp.seriesId,
                  title: epLabel,
                  poster:
                    ep.info?.movie_image ||
                    playingEp.coverFallback ||
                    seriesObj?.cover ||
                    undefined,
                });
              }}
              onEnded={handleEpisodeEnded}
            />
            <NextEpisodeCard
              open={showNextCard && !!nextEpisodeInfo}
              episode={nextEpisodeInfo?.ep ?? null}
              season={nextEpisodeInfo?.season ?? 0}
              episodeNumber={nextEpisodeInfo?.episodeNumber ?? 0}
              coverFallback={playingEp.coverFallback}
              autoplaySeconds={10}
              prefetchLeadSeconds={1.5}
              autoplayEnabled={autoplayPref.enabled}
              onAutoplayToggle={autoplayPref.toggle}
              onPlayNow={handlePlayNext}
              onPrefetch={handlePrefetchNext}
              onCancel={() => setShowNextCard(false)}
            />
          </>
        )}
      </PlayerOverlay>

      <ResumeDialog
        open={!!pendingResume}
        onOpenChange={(o) => !o && setPendingResume(null)}
        resumeAt={pendingResume?.t ?? 0}
        duration={pendingResume?.d}
        title={pendingResume?.ep.title}
        onResume={() => {
          if (!pendingResume) return;
          setResumeAt(pendingResume.t);
          setPlayingEp({
            ep: pendingResume.ep,
            seriesId: pendingResume.seriesId,
            coverFallback: pendingResume.coverFallback,
          });
          setPendingResume(null);
        }}
        onRestart={() => {
          if (!pendingResume) return;
          clearProgress(makeProgressKey("episode", pendingResume.ep.id));
          setResumeAt(0);
          setPlayingEp({
            ep: pendingResume.ep,
            seriesId: pendingResume.seriesId,
            coverFallback: pendingResume.coverFallback,
          });
          setPendingResume(null);
        }}
      />
    </div>
  );
};

export default SeriesPage;
