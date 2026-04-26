import { Search, Tv } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { LiveStream, IptvCredentials } from "@/services/iptv";
import { VirtualChannelList } from "./VirtualChannelList";
import type { RailCategory } from "./ChannelCategoryRail";
import { useState } from "react";

interface Props {
  channels: LiveStream[];
  categories: RailCategory[];
  activeChannelId?: number;
  activeCategory: string;
  favorites: Set<number>;
  totalCount: number;
  search: string;
  onSearchChange: (s: string) => void;
  onCategoryChange: (id: string) => void;
  onSelect: (c: LiveStream) => void;
  onToggleFavorite: (id: number) => void;
  creds: IptvCredentials;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Drawer mobile com tabs (Todos / Favoritos / Categorias) — substitui a
 * sidebar de canais empilhada abaixo do player no mobile.
 */
export function MobileChannelDrawer({
  channels,
  categories,
  activeChannelId,
  activeCategory,
  favorites,
  totalCount,
  search,
  onSearchChange,
  onCategoryChange,
  onSelect,
  onToggleFavorite,
  creds,
  open,
  onOpenChange,
}: Props) {
  const [tab, setTab] = useState<"channels" | "categories">("channels");

  const handleSelect = (c: LiveStream) => {
    onSelect(c);
    onOpenChange(false);
  };

  const handleCategory = (id: string) => {
    onCategoryChange(id);
    setTab("channels");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[92vw] sm:w-[420px] md:w-[480px] p-0 flex flex-col pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="px-4 py-3 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Tv className="h-4 w-4 text-primary" />
            Canais ({channels.length})
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 py-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar canal..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-secondary/50 border-border/50"
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "channels" | "categories")} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 grid grid-cols-2">
            <TabsTrigger value="channels">Canais</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="flex-1 min-h-0 mt-2">
            <VirtualChannelList
              channels={channels}
              activeId={activeChannelId}
              favorites={favorites}
              onSelect={handleSelect}
              onToggleFavorite={onToggleFavorite}
              creds={creds}
              autoScrollToActive
              className="h-full"
            />
          </TabsContent>

          <TabsContent value="categories" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-full px-2">
              <div className="space-y-1 pb-4">
                <CatBtn
                  label="★ Favoritos"
                  count={favorites.size}
                  active={activeCategory === "favorites"}
                  onClick={() => handleCategory("favorites")}
                />
                <CatBtn
                  label="Todos os canais"
                  count={totalCount}
                  active={activeCategory === "all"}
                  onClick={() => handleCategory("all")}
                />
                <div className="h-px bg-border/40 my-2" />
                {categories
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                  .map((c) => (
                    <CatBtn
                      key={c.id}
                      label={c.name}
                      count={c.count}
                      active={activeCategory === c.id}
                      onClick={() => handleCategory(c.id)}
                    />
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function CatBtn({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm text-left transition-smooth",
        active
          ? "bg-primary/15 text-primary font-medium"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-secondary/60">
        {count}
      </span>
    </button>
  );
}

/** Botão flutuante mobile para abrir o drawer. */
export function MobileChannelTrigger({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          onClick={onClick}
          size="lg"
          className="lg:hidden fixed bottom-4 right-4 z-40 shadow-lg shadow-primary/30 rounded-full px-5"
        >
          <Tv className="h-4 w-4 mr-2" />
          Canais
          <span className="ml-2 text-[10px] tabular-nums opacity-80">{count}</span>
        </Button>
      </SheetTrigger>
    </Sheet>
  );
}
