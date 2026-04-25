import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CategoryRail, type RailCategory } from "./CategoryRail";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: RailCategory[];
  active: string;
  onChange: (id: string) => void;
  title?: string;
}

/**
 * Drawer lateral que envolve o CategoryRail para uso em mobile.
 */
export function MobileCategoryDrawer({
  open,
  onOpenChange,
  categories,
  active,
  onChange,
  title = "Categorias",
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border/40">
          <SheetTitle className="text-left">{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <CategoryRail
            categories={categories}
            active={active}
            onChange={(id) => {
              onChange(id);
              onOpenChange(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
