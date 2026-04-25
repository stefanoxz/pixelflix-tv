import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Input } from "@/components/ui/input";
import { PosterCard, type PosterItem } from "./PosterCard";
import { useIncompatibleKeys } from "@/hooks/useIncompatibleKeys";

interface Props {
  items: PosterItem[];
  activeId?: number;
  isFavorite?: (id: number) => boolean;
  onOpen: (item: PosterItem) => void;
  onActiveChange?: (id: number) => void;
  onToggleFavorite?: (id: number) => void;
  /** Disparado ao passar o mouse / focar um card — útil pra prefetch da sinopse. */
  onHoverItem?: (item: PosterItem) => void;
  search: string;
  onSearchChange: (v: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  searchPlaceholder?: string;
  emptyMessage?: string;
  totalLabel?: string;
}

// Mapeia largura do container → colunas (mesmo do tailwind grid antigo).
function colsFor(width: number): number {
  if (width >= 1280) return 7; // xl
  if (width >= 1024) return 6; // lg
  if (width >= 768) return 5;  // md
  if (width >= 640) return 4;  // sm
  return 3;
}

/**
 * Grade virtualizada de pôsteres. Renderiza só as linhas visíveis
 * (overscan de 4 linhas) — funciona com listas de milhares de itens
 * sem perda de fluidez. Marca de incompatibilidade vem de um único
 * subscriber global (sem listener por card).
 */
export function PosterGrid({
  items,
  activeId,
  isFavorite,
  onOpen,
  onActiveChange,
  onToggleFavorite,
  onHoverItem,
  search,
  onSearchChange,
  searchInputRef,
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum item encontrado.",
  totalLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const incompatibleKeys = useIncompatibleKeys();

  // Mede largura para decidir colunas + altura da linha (aspect 2:3 + gap).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = colsFor(containerWidth || 1200);
  const gap = containerWidth >= 768 ? 12 : 8; // md:gap-3 vs gap-2
  const colWidth = containerWidth
    ? Math.floor((containerWidth - gap * (cols - 1)) / cols)
    : 0;
  // aspect 2:3 = altura = largura * 1.5
  const rowHeight = colWidth ? Math.floor(colWidth * 1.5) + gap : 240;

  const rowCount = Math.ceil(items.length / cols);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 4,
  });

  // Recalcula quando rowHeight muda (resize de janela).
  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowHeight, rowVirtualizer]);

  // Scroll automático para manter o card ativo visível (navegação por teclado).
  // Só roda quando activeId muda — não quando a lista muda — pra não bagunçar
  // a posição do scroll quando o usuário só digita na busca.
  const lastActiveRef = useRef<number | undefined>(activeId);
  useEffect(() => {
    if (activeId == null || activeId === lastActiveRef.current) return;
    lastActiveRef.current = activeId;
    const idx = items.findIndex((i) => i.id === activeId);
    if (idx < 0) return;
    const row = Math.floor(idx / cols);
    rowVirtualizer.scrollToIndex(row, { align: "auto" });
  }, [activeId, items, cols, rowVirtualizer]);

  // Handlers estáveis pra preservar memoização do PosterCard.
  const handleOpen = useCallback(
    (item: PosterItem) => {
      onActiveChange?.(item.id);
      onOpen(item);
    },
    [onActiveChange, onOpen],
  );

  const upstreamHostMemo = useMemo(() => {
    // todos os items normalmente compartilham o mesmo host
    for (const it of items) if (it.host) return it.host;
    return null;
  }, [items]);

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
          // contain layout pra evitar que mudanças internas reflowem o pai.
          style={{ contain: "strict" } as React.CSSProperties}
        >
          {containerWidth > 0 && (
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const start = vRow.index * cols;
                const rowItems = items.slice(start, start + cols);
                return (
                  <div
                    key={vRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vRow.start}px)`,
                      height: rowHeight,
                      display: "grid",
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                      gap,
                      paddingBottom: gap,
                    }}
                  >
                    {rowItems.map((it) => {
                      const host = it.host ?? upstreamHostMemo;
                      const incompatible = host
                        ? incompatibleKeys.has(`${host}:${it.id}`)
                        : false;
                      return (
                        <PosterCard
                          key={it.id}
                          item={it}
                          active={it.id === activeId}
                          isFavorite={isFavorite?.(it.id)}
                          incompatible={incompatible}
                          onClick={() => handleOpen(it)}
                          onHover={onHoverItem ? () => onHoverItem(it) : undefined}
                          onToggleFavorite={
                            onToggleFavorite ? () => onToggleFavorite(it.id) : undefined
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
