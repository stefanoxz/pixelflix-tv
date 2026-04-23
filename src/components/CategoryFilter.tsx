import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  categories: { id: string; name: string }[];
  active: string;
  onChange: (id: string) => void;
}

export const CategoryFilter = forwardRef<HTMLDivElement, CategoryFilterProps>(
  function CategoryFilter({ categories, active, onChange }, ref) {
    return (
      <div
        ref={ref}
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
      >
        <button
          onClick={() => onChange("all")}
          className={cn(
            "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-smooth whitespace-nowrap",
            active === "all"
              ? "bg-primary text-primary-foreground shadow-glow"
              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/70"
          )}
        >
          Todas
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-smooth whitespace-nowrap",
              active === cat.id
                ? "bg-primary text-primary-foreground shadow-glow"
                : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/70"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
    );
  }
);
