import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, X, Play, Star, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MediaCard } from "@/components/MediaCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Player } from "@/components/Player";
import { useIptv } from "@/context/IptvContext";
import {
  getSeriesCategories,
  getSeries,
  getSeriesInfo,
  buildSeriesEpisodeUrl,
  isBrowserPlayable,
  isExternalOnly,
  getFormatBadge,
  type Series,
  type Episode,
} from "@/services/iptv";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const toneClasses: Record<"green" | "blue" | "yellow" | "gray", string> = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  blue: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  yellow: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  gray: "bg-muted text-muted-foreground border-border",
};

const SeriesPage = () => {
  const { session } = useIptv();
  const creds = session!.creds;

  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [openSeries, setOpenSeries] = useState<Series | null>(null);
  const [activeSeason, setActiveSeason] = useState<string | null>(null);
  const [playingEp, setPlayingEp] = useState<Episode | null>(null);
  const [onlyCompatible, setOnlyCompatible] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["series-cats", creds.username],
    queryFn: () => getSeriesCategories(creds),
  });
  const { data: series = [], isLoading } = useQuery({
    queryKey: ["series", creds.username],
    queryFn: () => getSeries(creds),
  });

  const { data: seriesInfo, isLoading: loadingInfo } = useQuery({
    queryKey: ["series-info", openSeries?.series_id],
    queryFn: () => getSeriesInfo(creds, openSeries!.series_id),
    enabled: !!openSeries,
  });

  const filtered = useMemo(() => {
    return series.filter((s) => {
      const matchCat = activeCategory === "all" || s.category_id === activeCategory;
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [series, activeCategory, search]);

  const seasonKeys = seriesInfo ? Object.keys(seriesInfo.episodes || {}) : [];
  const currentSeason = activeSeason || seasonKeys[0];
  const allEpisodes = seriesInfo?.episodes?.[currentSeason] || [];

  const externalCount = useMemo(
    () =>
      allEpisodes.filter((ep) => isExternalOnly(ep.container_extension, ep.direct_source)).length,
    [allEpisodes],
  );

  const episodes = useMemo(
    () =>
      onlyCompatible
        ? allEpisodes.filter((ep) => isBrowserPlayable(ep.container_extension, ep.direct_source))
        : allEpisodes,
    [allEpisodes, onlyCompatible],
  );

  const closeModal = () => {
    setOpenSeries(null);
    setActiveSeason(null);
    setPlayingEp(null);
  };

  const handleCopyExternal = async (ep: Episode) => {
    const url = buildSeriesEpisodeUrl(creds, ep.id, ep.container_extension, ep.direct_source);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado — abra no VLC ou MX Player");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-[1600px] px-4 md:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Séries</h1>
          <p className="text-sm text-muted-foreground mt-1">{series.length} séries disponíveis</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar série..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>

        <CategoryFilter
          categories={categories.map((c) => ({ id: c.category_id, name: c.category_name }))}
          active={activeCategory}
          onChange={setActiveCategory}
        />

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.slice(0, 120).map((s) => (
              <MediaCard
                key={s.series_id}
                title={s.name}
                cover={s.cover}
                rating={s.rating_5based}
                onClick={() => {
                  setOpenSeries(s);
                  setActiveSeason(null);
                }}
              />
            ))}
          </div>
        )}

        {openSeries && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm overflow-y-auto animate-fade-in">
            <div className="mx-auto max-w-6xl p-4 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-foreground truncate">{openSeries.name}</h2>
                <Button variant="secondary" size="icon" onClick={closeModal}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {playingEp ? (
                <div className="space-y-4">
                  {(() => {
                    const epUrl = buildSeriesEpisodeUrl(
                      creds,
                      playingEp.id,
                      playingEp.container_extension,
                      playingEp.direct_source,
                    );
                    return (
                      <Player
                        src={epUrl}
                        rawUrl={epUrl}
                        containerExt={playingEp.container_extension}
                        title={playingEp.title}
                        poster={playingEp.info?.movie_image || openSeries.cover}
                        onClose={() => setPlayingEp(null)}
                      />
                    );
                  })()}
                  <Button variant="outline" onClick={() => setPlayingEp(null)}>
                    ← Voltar aos episódios
                  </Button>
                </div>
              ) : loadingInfo ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid md:grid-cols-[260px,1fr] gap-6">
                  <div className="space-y-3">
                    <img
                      src={openSeries.cover}
                      alt={openSeries.name}
                      className="w-full aspect-[2/3] object-cover rounded-lg shadow-card"
                      onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.2")}
                    />
                    {openSeries.rating && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-primary text-primary" />
                        <span>{openSeries.rating}</span>
                      </div>
                    )}
                    {openSeries.genre && (
                      <p className="text-xs text-muted-foreground">{openSeries.genre}</p>
                    )}
                    {openSeries.plot && (
                      <p className="text-sm text-muted-foreground line-clamp-6">
                        {openSeries.plot}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4 min-w-0">
                    {seasonKeys.length === 0 ? (
                      <p className="text-muted-foreground">Nenhum episódio disponível.</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {seasonKeys.map((sk) => (
                            <button
                              key={sk}
                              onClick={() => setActiveSeason(sk)}
                              className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-smooth",
                                currentSeason === sk
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-foreground hover:bg-secondary/70",
                              )}
                            >
                              Temporada {sk}
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                          <p className="text-xs text-muted-foreground">
                            {allEpisodes.length} episódios
                            {externalCount > 0 && (
                              <>
                                {" · "}
                                <span className="text-amber-400">
                                  {externalCount} só em player externo
                                </span>
                              </>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <Switch
                              id="only-compatible"
                              checked={onlyCompatible}
                              onCheckedChange={setOnlyCompatible}
                            />
                            <Label
                              htmlFor="only-compatible"
                              className="text-xs text-muted-foreground cursor-pointer"
                            >
                              Apenas compatíveis com navegador
                            </Label>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                          {episodes.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-6 text-center">
                              Nenhum episódio compatível nesta temporada.
                            </p>
                          ) : (
                            episodes.map((ep) => {
                              const ext = ep.container_extension;
                              const external = isExternalOnly(ext, ep.direct_source);
                              const badge = getFormatBadge(ext, ep.direct_source);
                              return (
                                <div
                                  key={ep.id}
                                  className="w-full flex gap-3 items-center p-3 rounded-lg bg-card hover:bg-secondary/50 border border-border/50 transition-smooth"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (external) {
                                        handleCopyExternal(ep);
                                      } else {
                                        setPlayingEp(ep);
                                      }
                                    }}
                                    className="flex gap-3 items-center flex-1 min-w-0 text-left"
                                  >
                                    <div className="h-16 w-28 shrink-0 rounded bg-secondary overflow-hidden flex items-center justify-center">
                                      {ep.info?.movie_image ? (
                                        <img
                                          src={ep.info.movie_image}
                                          alt={ep.title}
                                          className="h-full w-full object-cover"
                                          onError={(e) =>
                                            ((e.target as HTMLImageElement).style.display = "none")
                                          }
                                        />
                                      ) : (
                                        <Play className="h-5 w-5 text-muted-foreground" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium text-foreground truncate">
                                          {ep.episode_num}. {ep.title}
                                        </p>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span
                                              className={cn(
                                                "text-[10px] font-semibold px-1.5 py-0.5 rounded border tracking-wide",
                                                toneClasses[badge.tone],
                                              )}
                                            >
                                              {badge.label}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>{badge.tooltip}</TooltipContent>
                                        </Tooltip>
                                      </div>
                                      {ep.info?.plot && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                          {ep.info.plot}
                                        </p>
                                      )}
                                    </div>
                                  </button>
                                  {external ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-1.5 shrink-0"
                                          onClick={() => handleCopyExternal(ep)}
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" />
                                          Abrir externo
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Copiar link para VLC / MX Player
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Play className="h-4 w-4 text-primary shrink-0" />
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default SeriesPage;
