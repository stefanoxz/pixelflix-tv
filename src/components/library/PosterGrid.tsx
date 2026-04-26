import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Input } from "@/components/ui/input";
import { PosterCard, type PosterItem } from "./PosterCard";
import { useIncompatibleKeys } from "@/hooks/useIncompatibleKeys";
import { useMediaQuery } from "@/hooks/useMediaQuery";

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
  /** Quantos itens revelar inicialmente. */
  pageSize?: number;
  /** Quantos itens adicionar a cada vez que o sentinela entrar em view. */
  pageIncrement?: number;
  /** Se true e items vazio, renderiza skeletons em vez de mensagem vazia. */
  isLoading?: boolean;
}

// Mapeia largura do container → colunas (mesmo do tailwind grid antigo).
function colsFor(width: number): number {
  if (width >= 1280) return 7; // xl
  if (width >= 1024) return 6; // lg
  if (width >= 768) return 5;  // md
  if (width >= 640) return 4;  // sm
  if (width >= 360) return 3;  // mobile padrão
  return 2;                    // telas muito pequenas (<360px)
}

/**
 * Grade virtualizada de pôsteres com paginação incremental no client.
 *
 * Renderiza só as linhas visíveis (overscan de 4 linhas) e além disso só
 * "expõe" `visibleCount` itens à virtualização — revelando mais conforme o
 * usuário rola até o sentinela. Funciona com listas de milhares de itens
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
  pageSize: pageSizeProp,
  pageIncrement: pageIncrementProp,
  isLoading = false,
}: Props) {
  // Defaults adaptativos: mobile recebe páginas bem menores pra reduzir a
  // fila inicial de imagens em 3G/4G. Desktop mantém o comportamento antigo
  // (120 / 60). Props explícitas sempre vencem.
  const pageSize = pageSizeProp ?? (IS_MOBILE_VIEWPORT ? 36 : 120);
  const pageIncrement = pageIncrementProp ?? (IS_MOBILE_VIEWPORT ? 24 : 60);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const incompatibleKeys = useIncompatibleKeys();

  // Janela incremental — reseta quando a lista muda de identidade
  // (nova busca / categoria / favoritos). `Movies`/`Series` memoizam
  // `items`, então mudar o filtro gera nova referência.
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(pageSize, items.length),
  );
  useEffect(() => {
    setVisibleCount(Math.min(pageSize, items.length));
    // role para o topo ao trocar a lista
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [items, pageSize]);

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
  const gap = containerWidth >= 768 ? 12 : 10; // mais arejado no mobile (era 8)
  const colWidth = containerWidth
    ? Math.floor((containerWidth - gap * (cols - 1)) / cols)
    : 0;
  // aspect 2:3 = altura = largura * 1.5
  const rowHeight = colWidth ? Math.floor(colWidth * 1.5) + gap : 240;

  // Slice exposto à virtualização.
  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );
  const hasMore = visibleCount < items.length;
  const rowCount = Math.ceil(visibleItems.length / cols);

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

  // Revelação incremental por scroll: quando faltarem <800px para o fim
  // do conteúdo virtual, expande a janela. Mais previsível que IO num
  // sentinela que pode estar visível desde o primeiro render.
  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < 800) {
      setVisibleCount((c) => Math.min(c + pageIncrement, items.length));
    }
  }, [items.length, pageIncrement]);

  // Scroll automático para manter o card ativo visível (navegação por teclado).
  // Se o ativo está além da janela revelada, expande a janela primeiro.
  const lastActiveRef = useRef<number | undefined>(activeId);
  useEffect(() => {
    if (activeId == null || activeId === lastActiveRef.current) return;
    lastActiveRef.current = activeId;
    const idx = items.findIndex((i) => i.id === activeId);
    if (idx < 0) return;
    if (idx >= visibleCount) {
      // expande até cobrir o índice (arredondando pra próximo múltiplo do incremento)
      const needed = Math.min(
        items.length,
        Math.max(visibleCount + pageIncrement, idx + pageIncrement),
      );
      setVisibleCount(needed);
      // o scroll efetivo acontece no próximo effect (após re-render)
      return;
    }
    const row = Math.floor(idx / cols);
    rowVirtualizer.scrollToIndex(row, { align: "auto" });
  }, [activeId, items, cols, rowVirtualizer, visibleCount, pageIncrement]);

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

  const totalSize = rowVirtualizer.getTotalSize();

  // Auto-fill: se a grade ainda não preenche a viewport (ex.: 120 itens
  // cabem na tela e o usuário não precisa rolar), revela o próximo chunk
  // automaticamente até preencher. Em mobile usamos um buffer menor pra
  // evitar disparar 2-3 expansões consecutivas no primeiro paint em 3G/4G.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasMore || totalSize === 0) return;
    const buffer = IS_MOBILE_VIEWPORT ? 200 : 600;
    if (totalSize <= el.clientHeight + buffer) {
      const id = requestAnimationFrame(() => {
        setVisibleCount((c) => Math.min(c + pageIncrement, items.length));
      });
      return () => cancelAnimationFrame(id);
    }
  }, [totalSize, containerWidth, hasMore, items.length, pageIncrement]);

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
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="pl-10 bg-secondary/40 border-border/40 h-9"
          />
        </div>
        {/* Indicador discreto de refetch (background) — útil quando há cache
            mas a query está revalidando. Sem repintar a grade. */}
        {isLoading && items.length > 0 && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-label="Atualizando"
          />
        )}
        {totalLabel && (
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
            {totalLabel}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        isLoading ? (
          <div
            className="flex-1 overflow-hidden grid gap-2 md:gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7"
            aria-label="Carregando catálogo"
          >
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="w-full aspect-[2/3] rounded-lg skeleton-shimmer"
                style={{ animationDelay: `${(i % 6) * 0.08}s` }}
              />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
            {emptyMessage}
          </div>
        )
      ) : (
        <div
          ref={containerRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto pr-1 -mr-1"
          // contain layout pra evitar que mudanças internas reflowem o pai.
          style={{ contain: "strict" } as React.CSSProperties}
        >
          {containerWidth > 0 && (
            <div
              style={{
                height: totalSize,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const start = vRow.index * cols;
                const rowItems = visibleItems.slice(start, start + cols);
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
                          priority={vRow.index === 0}
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

          {/* Rodapé discreto: progresso da revelação local.
              Spinner só aparece se a query externa ainda está buscando dados. */}
          <div className="py-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            {hasMore ? (
              <>
                {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>
                  Mostrando {visibleItems.length} de {items.length}
                </span>
              </>
            ) : items.length > pageSize ? (
              <span>{items.length} itens</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
