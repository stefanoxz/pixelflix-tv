import { memo, useMemo } from "react";
import { Star, LayoutGrid, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  className,
}: Props) {
  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [categories],
  );

  return (
    <aside
      className={cn(
        "rounded-lg bg-card border border-border/50 flex flex-col",
        className,
      )}
    >
      <div className="px-4 py-3 border-b border-border/50">
        <h2 className="text-sm font-semibold text-foreground">Categorias</h2>
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
