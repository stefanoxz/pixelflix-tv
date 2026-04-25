import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TitleListItem, type TitleListItemData } from "./TitleListItem";

interface Props {
  items: TitleListItemData[];
  activeId?: number;
  isFavorite?: (id: number) => boolean;
  onSelect: (item: TitleListItemData) => void;
  onActivate: (item: TitleListItemData) => void;
  onToggleFavorite?: (id: number) => void;
  search: string;
  onSearchChange: (v: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  searchPlaceholder?: string;
  emptyMessage?: string;
  totalLabel?: string;
}

const ITEM_HEIGHT = 76;

export function TitleList({
  items,
  activeId,
  isFavorite,
  onSelect,
  onActivate,
  onToggleFavorite,
  search,
  onSearchChange,
  searchInputRef,
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum item encontrado.",
  totalLabel,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 8,
  });

  // Auto-scroll quando o ativo muda por teclado.
  useEffect(() => {
    if (activeId == null) return;
    const idx = items.findIndex((i) => i.id === activeId);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, items.length]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-border/40 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-10 bg-secondary/40 border-border/40 h-9"
          />
        </div>
        {totalLabel && (
          <span className="text-xs text-muted-foreground hidden sm:inline whitespace-nowrap">
            {totalLabel}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
          {emptyMessage}
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-auto">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const item = items[row.index];
              return (
                <div
                  key={item.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${row.size}px`,
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  <TitleListItem
                    item={item}
                    active={item.id === activeId}
                    isFavorite={isFavorite?.(item.id)}
                    onSelect={() => onSelect(item)}
                    onDoubleClick={() => onActivate(item)}
                    onToggleFavorite={
                      onToggleFavorite ? () => onToggleFavorite(item.id) : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
