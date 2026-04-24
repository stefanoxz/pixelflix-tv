import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Player } from "@/components/Player";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { CategoryFilter } from "@/components/CategoryFilter";
import { useIptv } from "@/context/IptvContext";
import {
  getLiveCategories,
  getLiveStreams,
  buildLiveStreamUrl,
  proxyImageUrl,
  type LiveStream,
} from "@/services/iptv";

const Live = () => {
  const { session } = useIptv();
  const creds = session!.creds;

  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [activeChannel, setActiveChannel] = useState<LiveStream | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["live-cats", creds.username],
    queryFn: () => getLiveCategories(creds),
  });
  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["live-streams", creds.username],
    queryFn: () => getLiveStreams(creds),
  });

  const filtered = useMemo(() => {
    return channels.filter((c) => {
      const matchCat = activeCategory === "all" || c.category_id === activeCategory;
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [channels, activeCategory, search]);

  useEffect(() => {
    if (!activeChannel && filtered.length > 0) setActiveChannel(filtered[0]);
  }, [filtered, activeChannel]);

  const rawLiveUrl = activeChannel
    ? buildLiveStreamUrl(creds, activeChannel.stream_id, activeChannel.direct_source)
    : null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Canais ao Vivo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {channels.length} canais disponíveis
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar canal..."
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
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <Player
              key={activeChannel?.stream_id ?? "none"}
              src={rawLiveUrl}
              rawUrl={rawLiveUrl ?? undefined}
              containerExt="m3u8"
              title={activeChannel?.name}
              poster={proxyImageUrl(activeChannel?.stream_icon)}
            />
          </div>
          <ChannelSidebar
            channels={filtered}
            activeId={activeChannel?.stream_id}
            onSelect={setActiveChannel}
          />
        </div>
      )}
    </div>
  );
};

export default Live;
