import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, X, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MediaCard } from "@/components/MediaCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Player } from "@/components/Player";
import { MovieDetailsDialog } from "@/components/MovieDetailsDialog";
import { useIptv } from "@/context/IptvContext";
import {
  getVodCategories,
  getVodStreams,
  buildVodStreamUrl,
  proxyImageUrl,
  type VodStream,
} from "@/services/iptv";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

const Movies = () => {
  const { session } = useIptv();
  const navigate = useNavigate();
  const location = useLocation();
  const creds = session!.creds;

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [details, setDetails] = useState<VodStream | null>(null);
  const [playing, setPlaying] = useState<VodStream | null>(null);
  const [showOnlyFavs, setShowOnlyFavs] = useState(false);

  const { isFavorite, toggle, favorites } = useFavorites(creds.username, "vod");

  const { data: categories = [] } = useQuery({
    queryKey: ["vod-cats", creds.username],
    queryFn: () => getVodCategories(creds),
  });
  const { data: movies = [], isLoading } = useQuery({
    queryKey: ["vod-streams", creds.username],
    queryFn: () => getVodStreams(creds),
  });

  // Abrir item vindo de outra página (ex: Destaques) com state.openId
  useEffect(() => {
    const openId = (location.state as { openId?: number } | null)?.openId;
    if (openId && movies.length) {
      const m = movies.find((x) => x.stream_id === openId);
      if (m) setDetails(m);
      // limpa o state pra não reabrir após fechar
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, movies, navigate]);

  const filtered = useMemo(() => {
    return movies.filter((m) => {
      const matchCat = activeCategory === "all" || m.category_id === activeCategory;
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
      const matchFav = !showOnlyFavs || favorites.has(m.stream_id);
      return matchCat && matchSearch && matchFav;
    });
  }, [movies, activeCategory, search, showOnlyFavs, favorites]);

  const playingRawUrl = playing
    ? buildVodStreamUrl(
        creds,
        playing.stream_id,
        playing.container_extension || "mp4",
        playing.direct_source,
      )
    : null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Filmes</h1>
        <p className="text-sm text-muted-foreground mt-1">{movies.length} filmes na biblioteca</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar filme..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>
        <Button
          variant={showOnlyFavs ? "default" : "outline"}
          size="sm"
          onClick={() => setShowOnlyFavs((v) => !v)}
          className={cn("gap-2", showOnlyFavs && "bg-primary text-primary-foreground")}
        >
          <Heart className={cn("h-4 w-4", showOnlyFavs && "fill-current")} />
          Favoritos {favorites.size > 0 && `(${favorites.size})`}
        </Button>
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {showOnlyFavs
            ? "Você ainda não favoritou nenhum filme."
            : "Nenhum filme encontrado."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.slice(0, 120).map((m) => (
            <MediaCard
              key={m.stream_id}
              title={m.name}
              cover={m.stream_icon}
              rating={m.rating_5based}
              onClick={() => setDetails(m)}
              isFavorite={isFavorite(m.stream_id)}
              onToggleFavorite={() => toggle(m.stream_id)}
            />
          ))}
        </div>
      )}

      <MovieDetailsDialog
        open={!!details}
        onOpenChange={(o) => !o && setDetails(null)}
        movie={details}
        creds={creds}
        onPlay={(m) => {
          setDetails(null);
          setPlaying(m);
        }}
        isFavorite={details ? isFavorite(details.stream_id) : false}
        onToggleFavorite={details ? () => toggle(details.stream_id) : undefined}
      />

      {playing && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-5xl">
            <Button
              variant="secondary"
              size="icon"
              className="absolute -top-12 right-0 z-10"
              onClick={() => setPlaying(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <Player
              src={playingRawUrl}
              rawUrl={playingRawUrl ?? undefined}
              containerExt={playing.container_extension || "mp4"}
              title={playing.name}
              poster={proxyImageUrl(playing.stream_icon)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Movies;
