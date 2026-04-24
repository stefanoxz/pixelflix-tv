import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MediaCard } from "@/components/MediaCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Player } from "@/components/Player";
import { useIptv } from "@/context/IptvContext";
import {
  getVodCategories,
  getVodStreams,
  buildVodStreamUrl,
  isBrowserPlayable,
  proxyImageUrl,
  type VodStream,
} from "@/services/iptv";
import { Button } from "@/components/ui/button";

const Movies = () => {
  const { session } = useIptv();
  const creds = session!.creds;

  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<VodStream | null>(null);
  const [onlyCompatible, setOnlyCompatible] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["vod-cats", creds.username],
    queryFn: () => getVodCategories(creds),
  });
  const { data: movies = [], isLoading } = useQuery({
    queryKey: ["vod-streams", creds.username],
    queryFn: () => getVodStreams(creds),
  });

  const filtered = useMemo(() => {
    return movies.filter((m) => {
      const matchCat = activeCategory === "all" || m.category_id === activeCategory;
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
      const matchCompat =
        !onlyCompatible || isBrowserPlayable(m.container_extension, m.direct_source);
      return matchCat && matchSearch && matchCompat;
    });
  }, [movies, activeCategory, search, onlyCompatible]);

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

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar filme..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="movies-only-compatible"
            checked={onlyCompatible}
            onCheckedChange={setOnlyCompatible}
          />
          <Label
            htmlFor="movies-only-compatible"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Apenas compatíveis com navegador
          </Label>
        </div>
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
          {filtered.slice(0, 120).map((m) => (
            <MediaCard
              key={m.stream_id}
              title={m.name}
              cover={m.stream_icon}
              rating={m.rating_5based}
              onClick={() => setPlaying(m)}
            />
          ))}
        </div>
      )}

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
