import { Search, Tv } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { LiveStream, IptvCredentials } from "@/services/iptv";
import { VirtualChannelList } from "./VirtualChannelList";
import { CategorySortToggle, sortCategories, type RailCategory } from "./ChannelCategoryRail";
import type { CategorySort } from "@/hooks/useCategorySortPreference";
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
  sort: CategorySort;
  onSortChange: (s: CategorySort) => void;
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
  sort,
  onSortChange,
}: Props) {
  const [tab, setTab] = useState<"channels" | "categories">("channels");
  const sortedCategories = sortCategories(categories, sort);

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
            <div className="px-4 pb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ordenar por</span>
              <CategorySortToggle value={sort} onChange={onSortChange} />
            </div>
            <ScrollArea className="h-full px-2">
              <div className="space-y-1 pb-4">
                <CatBtn
                  label="★ Favoritos"
                  count={favorites.size}
                  active={activeCategory === "__favorites__"}
                  onClick={() => handleCategory("__favorites__")}
                />
                <CatBtn
                  label="Todos os canais"
                  count={totalCount}
                  active={activeCategory === "all"}
                  onClick={() => handleCategory("all")}
                />
                <div className="h-px bg-border/40 my-2" />
                {sortedCategories.map((c) => (
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

// Nota: o FAB para abrir o drawer vive em `Live.tsx` (posicionado acima da
// BottomNav). Mantemos esse arquivo focado apenas no Sheet — sem trigger
// duplicado.
