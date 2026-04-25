import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClock } from "@/hooks/useClock";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** Ícone à esquerda do título (default: Sparkles). */
  icon?: ReactNode;
  /** Mostra botão "filtro" para abrir o drawer de categorias no mobile. */
  onOpenCategoryDrawer?: () => void;
  /** Conteúdo extra à direita (ex: contador). */
  rightExtra?: ReactNode;
  className?: string;
}

/**
 * Topbar estilo IBO Pro: voltar + ícone + título à esquerda; relógio + data à direita.
 * Sticky, com backdrop-blur. Em mobile mostra botão "filtro" para abrir o drawer.
 */
export function LibraryTopBar({
  title,
  icon,
  onOpenCategoryDrawer,
  rightExtra,
  className,
}: Props) {
  const navigate = useNavigate();
  const { time, date } = useClock();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 -mx-3 md:-mx-6 px-3 md:px-6 py-3 mb-3 flex items-center gap-3",
        "bg-background/85 backdrop-blur border-b border-border/40",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => navigate("/")}
        aria-label="Voltar para o início"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 min-w-0">
        <span className="h-7 w-7 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
          {icon ?? <Sparkles className="h-4 w-4" />}
        </span>
        <h1 className="text-lg md:text-2xl font-bold tracking-tight truncate">
          {title}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-4">
        {rightExtra}
        {onOpenCategoryDrawer && (
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden gap-1.5"
            onClick={onOpenCategoryDrawer}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden xs:inline">Categorias</span>
          </Button>
        )}
        <div className="text-right leading-tight tabular-nums">
          <div className="text-base md:text-xl font-semibold">{time}</div>
          <div className="text-[10px] md:text-xs text-muted-foreground">{date}</div>
        </div>
      </div>
    </header>
  );
}
