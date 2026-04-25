import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** Coluna esquerda — categorias. */
  rail: ReactNode;
  /** Coluna central — busca + lista de títulos. */
  list: ReactNode;
  /** Coluna direita — painel de detalhes (apenas em ≥lg). */
  preview?: ReactNode;
  /** Header opcional acima das 3 colunas. */
  header?: ReactNode;
  /** Mostrar painel de preview (desktop). */
  showPreview?: boolean;
  className?: string;
}

/**
 * Layout 3-col (rail / lista / preview) responsivo, estilo IBO Pro.
 * No mobile (<lg) o preview é omitido — a lista assume largura total.
 */
export function LibraryShell({ rail, list, preview, header, showPreview = true, className }: Props) {
  return (
    <div className={cn("mx-auto max-w-[1800px] px-3 md:px-6 py-4 md:py-6 space-y-4", className)}>
      {header}
      <div
        className={cn(
          "grid gap-4",
          showPreview
            ? "grid-cols-1 lg:grid-cols-[220px,minmax(0,1fr)] xl:grid-cols-[220px,minmax(0,1fr),420px]"
            : "grid-cols-1 lg:grid-cols-[220px,minmax(0,1fr)]",
        )}
        style={{ height: "calc(100vh - 11rem)", minHeight: 520 }}
      >
        <aside
          role="region"
          aria-label="Categorias"
          className="hidden lg:flex flex-col rounded-xl border border-border/40 bg-card/30 backdrop-blur overflow-hidden"
        >
          {rail}
        </aside>

        <section
          role="region"
          aria-label="Títulos"
          className="flex flex-col rounded-xl border border-border/40 bg-card/30 backdrop-blur overflow-hidden min-h-0"
        >
          {list}
        </section>

        {showPreview && preview && (
          <aside
            role="region"
            aria-label="Detalhes"
            className="hidden xl:flex flex-col rounded-xl border border-border/40 bg-card/30 backdrop-blur overflow-hidden"
          >
            {preview}
          </aside>
        )}
      </div>
    </div>
  );
}
