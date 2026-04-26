import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, Tv } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Player } from "@/components/Player";
import { LibraryTopBar } from "@/components/library/LibraryTopBar";
import { ChannelCategoryRail, type RailCategory } from "@/components/live/ChannelCategoryRail";
import { VirtualChannelList } from "@/components/live/VirtualChannelList";
import { MobileChannelDrawer } from "@/components/live/MobileChannelDrawer";
import { PlayerInfoBar } from "@/components/live/PlayerInfoBar";
import { useFavorites } from "@/hooks/useFavorites";
import { useLiveKeyboardNav } from "@/hooks/useLiveKeyboardNav";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useIptv } from "@/context/IptvContext";
import {
  getLiveCategories,
  getLiveStreams,
  buildLiveStreamUrl,
  proxyImageUrl,
  type LiveStream,
} from "@/services/iptv";

// Pré-aquece as edge functions de stream — elimina o cold-start de
// ~500-1000ms no primeiro canal aberto. Dispara só uma vez por sessão.
let _preheated = false;
function preheatStreamFunctions() {
  if (_preheated) return;
  _preheated = true;
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) return;
  const opts: RequestInit = { method: "OPTIONS", keepalive: true, mode: "cors" };
  try { void fetch(`${base}/functions/v1/stream-token`, opts); } catch { /* noop */ }
  try { void fetch(`${base}/functions/v1/stream-proxy`, opts); } catch { /* noop */ }
  try { void fetch(`${base}/functions/v1/stream-event`, opts); } catch { /* noop */ }
}

const Live = () => {
  const { session } = useIptv();
  const creds = session!.creds;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { preheatStreamFunctions(); }, []);

  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [activeChannel, setActiveChannel] = useState<LiveStream | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { favorites, toggle, isFavorite } = useFavorites(creds.username, "live");

  const { data: categories = [] } = useQuery({
    queryKey: ["live-cats", creds.username],
    queryFn: () => getLiveCategories(creds),
  });
  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["live-streams", creds.username],
    queryFn: () => getLiveStreams(creds),
  });

  // Contagem por categoria — calculada uma vez quando channels muda.
  const railCategories = useMemo<RailCategory[]>(() => {
    const counts = new Map<string, number>();
    for (const ch of channels) {
      counts.set(ch.category_id, (counts.get(ch.category_id) ?? 0) + 1);
    }
    return categories.map((c) => ({
      id: c.category_id,
      name: c.category_name,
      count: counts.get(c.category_id) ?? 0,
    }));
  }, [categories, channels]);

  // Filtragem: categoria + favoritos + busca.
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return channels.filter((c) => {
      let matchCat = true;
      if (activeCategory === "favorites") matchCat = favorites.has(c.stream_id);
      else if (activeCategory !== "all") matchCat = c.category_id === activeCategory;
      const matchSearch = !q || c.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [channels, activeCategory, debouncedSearch, favorites]);

  // Abre canal específico vindo de outra página (ex: Conta) com state.openId
  useEffect(() => {
    const openId = (location.state as { openId?: number } | null)?.openId;
    if (openId && channels.length) {
      const ch = channels.find((x) => x.stream_id === openId);
      if (ch) setActiveChannel(ch);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, channels, navigate]);

  // Auto-seleciona o primeiro canal quando a lista carrega/muda e nada está ativo
  // (ou o ativo saiu do filtro).
  useEffect(() => {
    if (filtered.length === 0) return;
    if (!activeChannel || !filtered.find((c) => c.stream_id === activeChannel.stream_id)) {
      // mantém o canal atual se ainda existe na lista global, mesmo que filtrado fora
      if (!activeChannel) setActiveChannel(filtered[0]);
    }
  }, [filtered, activeChannel]);

  // Navegação por teclado
  const moveBy = (delta: number) => {
    if (!activeChannel || filtered.length === 0) return;
    const idx = filtered.findIndex((c) => c.stream_id === activeChannel.stream_id);
    const nextIdx = idx === -1 ? 0 : (idx + delta + filtered.length) % filtered.length;
    setActiveChannel(filtered[nextIdx]);
  };

  useLiveKeyboardNav({
    onPrev: () => moveBy(-1),
    onNext: () => moveBy(1),
    onSearchFocus: () => searchRef.current?.focus(),
    onEscape: () => {
      if (drawerOpen) setDrawerOpen(false);
      else if (search) setSearch("");
    },
    onFavorite: () => activeChannel && toggle(activeChannel.stream_id),
  });

  const rawLiveUrl = activeChannel
    ? buildLiveStreamUrl(creds, activeChannel.stream_id, activeChannel.direct_source)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1800px] px-3 md:px-6 py-2 md:py-3">
      <LibraryTopBar
        title="Canais ao Vivo"
        icon={<Tv className="h-4 w-4" />}
        subtitle={`${channels.length} canais · ${favorites.size} favoritos`}
        onOpenCategoryDrawer={() => setDrawerOpen(true)}
        rightExtra={
          <div className="hidden md:block relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Buscar canal... (/)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="pl-10 h-9 bg-secondary/50 border-border/40"
            />
          </div>
        }
      />

      {/* Grid responsivo:
          - mobile: player + info, drawer pra canais
          - tablet (md): player + lista direita
          - desktop (xl): rail esquerda + player + lista direita */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] xl:grid-cols-[240px_1fr_360px] gap-4">
        {/* Rail de categorias (desktop apenas) */}
        <ChannelCategoryRail
          categories={railCategories}
          active={activeCategory}
          onChange={setActiveCategory}
          totalCount={channels.length}
          favoritesCount={favorites.size}
          className="hidden lg:flex h-[calc(100vh-160px)] sticky top-4"
        />

        {/* Coluna central: player + info/EPG */}
        <div className="min-w-0 space-y-4">
          <Player
            key={activeChannel?.stream_id ?? "none"}
            src={rawLiveUrl}
            rawUrl={rawLiveUrl ?? undefined}
            containerExt="m3u8"
            title={activeChannel?.name}
            poster={proxyImageUrl(activeChannel?.stream_icon)}
            streamId={activeChannel?.stream_id}
            contentKind="live"
          />
          <PlayerInfoBar
            channel={activeChannel}
            creds={creds}
            favorite={activeChannel ? isFavorite(activeChannel.stream_id) : false}
            onToggleFavorite={() => activeChannel && toggle(activeChannel.stream_id)}
          />

          {/* Busca mobile (acima do FAB) — sm:hidden */}
          <div className="md:hidden relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar canal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="pl-10 bg-secondary/50 border-border/50"
            />
          </div>
        </div>

        {/* Lista de canais (tablet/desktop) */}
        <aside className="hidden lg:flex flex-col rounded-lg bg-card border border-border/50 overflow-hidden h-[calc(100vh-160px)] sticky top-4">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Tv className="h-4 w-4 text-primary" />
              {activeCategory === "favorites"
                ? "Favoritos"
                : activeCategory === "all"
                ? "Todos os canais"
                : railCategories.find((c) => c.id === activeCategory)?.name ?? "Canais"}
            </h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {filtered.length}
            </span>
          </div>
          <VirtualChannelList
            channels={filtered}
            activeId={activeChannel?.stream_id}
            favorites={favorites}
            onSelect={setActiveChannel}
            onToggleFavorite={toggle}
            creds={creds}
            autoScrollToActive
            className="flex-1"
          />
        </aside>
      </div>

      {/* Drawer mobile + FAB */}
      <Button
        onClick={() => setDrawerOpen(true)}
        size="lg"
        className="lg:hidden fixed bottom-4 right-4 z-40 shadow-lg shadow-primary/30 rounded-full px-5"
      >
        <Tv className="h-4 w-4 mr-2" />
        Canais
        <span className="ml-2 text-[11px] tabular-nums opacity-80">{filtered.length}</span>
      </Button>

      <MobileChannelDrawer
        channels={filtered}
        categories={railCategories}
        activeChannelId={activeChannel?.stream_id}
        activeCategory={activeCategory}
        favorites={favorites}
        totalCount={channels.length}
        search={search}
        onSearchChange={setSearch}
        onCategoryChange={setActiveCategory}
        onSelect={setActiveChannel}
        onToggleFavorite={toggle}
        creds={creds}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
};

export default Live;
