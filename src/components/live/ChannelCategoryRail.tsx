import { memo, useMemo } from "react";
import { Star, LayoutGrid, Folder, ArrowDownAZ, ArrowDownZA, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { CategorySort } from "@/hooks/useCategorySortPreference";

export interface RailCategory {
  id: string;
  name: string;
  count: number;
}

interface Props {
  categories: RailCategory[];
  active: string;
  onChange: (id: string) => void;
  totalCount: number;
  favoritesCount: number;
  sort: CategorySort;
  onSortChange: (s: CategorySort) => void;
  className?: string;
}

/**
 * Rail vertical de categorias (desktop). Inclui Todos + Favoritos no topo,
 * com contadores. Item ativo destacado.
 */
export const ChannelCategoryRail = memo(function ChannelCategoryRail({
  categories,
  active,
  onChange,
  totalCount,
  favoritesCount,
  sort,
  onSortChange,
  className,
}: Props) {
  const sorted = useMemo(() => sortCategories(categories, sort), [categories, sort]);

  return (
    <aside
      className={cn(
        "rounded-lg bg-card border border-border/50 flex flex-col",
        className,
      )}
    >
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Categorias</h2>
        <CategorySortToggle value={sort} onChange={onSortChange} />
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          <RailItem
            icon={<Star className="h-4 w-4" />}
            label="Favoritos"
            count={favoritesCount}
            active={active === "__favorites__"}
            onClick={() => onChange("__favorites__")}
            highlight
          />
          <RailItem
            icon={<LayoutGrid className="h-4 w-4" />}
            label="Todos os canais"
            count={totalCount}
            active={active === "all"}
            onClick={() => onChange("all")}
          />
          <div className="h-px bg-border/40 my-2" />
          {sorted.map((cat) => (
            <RailItem
              key={cat.id}
              icon={<Folder className="h-4 w-4" />}
              label={cat.name}
              count={cat.count}
              active={active === cat.id}
              onClick={() => onChange(cat.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
});

/** Reutilizável: ordena conforme preferência. */
export function sortCategories(cats: RailCategory[], sort: CategorySort): RailCategory[] {
  if (sort === "server") return cats;
  const arr = [...cats];
  arr.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  if (sort === "za") arr.reverse();
  return arr;
}

interface ItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}
function RailItem({ icon, label, count, active, onClick, highlight }: ItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-smooth text-left",
        active
          ? "bg-primary/15 text-primary font-medium"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        highlight && !active && "text-amber-500/80",
      )}
    >
      <span className={cn(active ? "text-primary" : "text-muted-foreground/70")}>
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span
        className={cn(
          "text-[10px] tabular-nums px-1.5 py-0.5 rounded",
          active ? "bg-primary/20" : "bg-secondary/60",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/** Seletor compacto de ordenação. Exportado para reuso no drawer mobile. */
export function CategorySortToggle({
  value,
  onChange,
}: {
  value: CategorySort;
  onChange: (s: CategorySort) => void;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <ToggleGroup
        type="single"
        size="sm"
        value={value}
        onValueChange={(v) => v && onChange(v as CategorySort)}
        className="gap-0.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="az" aria-label="Ordenar A a Z" className="h-7 w-7 p-0">
              <ArrowDownAZ className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom">A → Z</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="za" aria-label="Ordenar Z a A" className="h-7 w-7 p-0">
              <ArrowDownZA className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom">Z → A</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="server" aria-label="Ordem do servidor" className="h-7 w-7 p-0">
              <ListOrdered className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom">Ordem do servidor</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  );
}
