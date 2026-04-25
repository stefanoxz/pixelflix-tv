import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PosterCard, type PosterItem } from "./PosterCard";

interface Props {
  items: PosterItem[];
  activeId?: number;
  isFavorite?: (id: number) => boolean;
  onOpen: (item: PosterItem) => void;
  onActiveChange?: (id: number) => void;
  onToggleFavorite?: (id: number) => void;
  search: string;
  onSearchChange: (v: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  searchPlaceholder?: string;
  emptyMessage?: string;
  totalLabel?: string;
}

/**
 * Grade responsiva de pôsteres com busca no topo. Sem virtualização — para
 * 5-7 colunas e listas de até alguns milhares funciona bem (img lazy).
 */
export function PosterGrid({
  items,
  activeId,
  isFavorite,
  onOpen,
  onActiveChange,
  onToggleFavorite,
  search,
  onSearchChange,
  searchInputRef,
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum item encontrado.",
  totalLabel,
}: Props) {
  const cardRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincroniza foco/scroll quando activeId muda via teclado.
  useEffect(() => {
    if (activeId == null) return;
    const node = cardRefs.current.get(activeId);
    if (node) {
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activeId]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 pb-3">
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
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
            {totalLabel}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
          {emptyMessage}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto pr-1 -mr-1"
        >
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 md:gap-3 pb-4">
            {items.map((it) => (
              <PosterCard
                key={it.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(it.id, node);
                  else cardRefs.current.delete(it.id);
                }}
                item={it}
                active={it.id === activeId}
                isFavorite={isFavorite?.(it.id)}
                onClick={() => {
                  onActiveChange?.(it.id);
                  onOpen(it);
                }}
                onToggleFavorite={
                  onToggleFavorite ? () => onToggleFavorite(it.id) : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
