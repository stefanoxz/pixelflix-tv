import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClock } from "@/hooks/useClock";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** Ícone à esquerda do título (default: Sparkles). */
  icon?: ReactNode;
  /** Subtítulo opcional (ex: contadores). */
  subtitle?: ReactNode;
  /** Mostra botão "filtro" para abrir o drawer de categorias no mobile. */
  onOpenCategoryDrawer?: () => void;
  /** Conteúdo extra à direita (ex: contador, busca). */
  rightExtra?: ReactNode;
  /** Esconde o botão de voltar (útil em páginas raiz). */
  hideBack?: boolean;
  className?: string;
}

/**
 * Topbar padronizada: voltar + ícone + título à esquerda; relógio + data à direita.
 * Sticky, com backdrop-blur. Em mobile mostra botão "filtro" para abrir o drawer.
 */
export function LibraryTopBar({
  title,
  icon,
  subtitle,
  onOpenCategoryDrawer,
  rightExtra,
  hideBack = false,
  className,
}: Props) {
  const navigate = useNavigate();
  const { time, date } = useClock();

  return (
    <header
      className={cn(
        // top-16 = 4rem = altura do Header sticky principal — evita sobreposição
        "sticky top-16 z-30 -mx-3 md:-mx-6 px-3 md:px-6 py-4 mb-4 flex items-center gap-3",
        "bg-background/80 backdrop-blur-2xl border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.1)]",

        className,
      )}
    >
      {!hideBack && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => navigate("/")}
          aria-label="Voltar para o início"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}

      <div className="flex items-center gap-2.5 min-w-0">
        <span className="h-8 w-8 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/20">
          {icon ?? <Sparkles className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <h1 className="page-title truncate">{title}</h1>
          {subtitle && (
            <div className="text-[11px] text-muted-foreground leading-tight truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-4">
        {rightExtra}
        {onOpenCategoryDrawer && (
          <Button
            variant="default"
            size="sm"
            className="lg:hidden gap-1.5 h-9 px-3 font-semibold shadow-glow ring-1 ring-primary/40"
            onClick={onOpenCategoryDrawer}
            aria-label="Abrir categorias"
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Categorias</span>
          </Button>
        )}
        <div className="hidden sm:block text-right leading-tight tabular-nums">
          <div className="text-base md:text-xl font-semibold">{time}</div>
          <div className="text-[10px] md:text-xs text-muted-foreground">{date}</div>
        </div>
      </div>
    </header>
  );
}
