import { Heart, Sparkles, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RailCategory {
  id: string;
  name: string;
  /** Pré-defs especiais que recebem ícone. */
  variant?: "all" | "favorites" | "recent" | "default";
  count?: number;
}

interface Props {
  categories: RailCategory[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

const iconFor = (v?: RailCategory["variant"], active?: boolean) => {
  switch (v) {
    case "favorites":
      return <Heart className={cn("h-4 w-4", active && "fill-current")} />;
    case "recent":
      return <Sparkles className="h-4 w-4" />;
    case "all":
      return active ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />;
    default:
      return active ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />;
  }
};

/** Rail vertical de categorias estilo IBO. */
export function CategoryRail({ categories, active, onChange, className }: Props) {
  return (
    <nav className={cn("flex flex-col h-full overflow-y-auto py-2", className)}>
      {categories.map((cat) => {
        const isActive = cat.id === active;
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            data-active={isActive}
            className={cn(
              "group flex items-center gap-2.5 px-4 py-2.5 text-sm transition-smooth text-left border-l-2",
              isActive
                ? "border-primary bg-primary/10 text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40",
            )}
          >
            <span
              className={cn(
                "shrink-0",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            >
              {iconFor(cat.variant, isActive)}
            </span>
            <span className="flex-1 truncate">{cat.name}</span>
            {typeof cat.count === "number" && cat.count > 0 && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {cat.count > 999 ? "999+" : cat.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
