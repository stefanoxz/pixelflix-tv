import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MediaCard } from "@/components/MediaCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { useIptv } from "@/context/IptvContext";
import { getSeriesCategories, getSeries } from "@/services/iptv";
import { toast } from "sonner";

const SeriesPage = () => {
  const { session } = useIptv();
  const creds = session!.creds;

  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["series-cats", creds.username],
    queryFn: () => getSeriesCategories(creds),
  });
  const { data: series = [], isLoading } = useQuery({
    queryKey: ["series", creds.username],
    queryFn: () => getSeries(creds),
  });

  const filtered = useMemo(() => {
    return series.filter((s) => {
      const matchCat = activeCategory === "all" || s.category_id === activeCategory;
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [series, activeCategory, search]);

  return (
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
              onClick={() => toast.info(`${s.name} — selecione um episódio (em breve)`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SeriesPage;
