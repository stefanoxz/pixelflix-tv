import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Conteúdo do player (já contém o `<Player … onClose={…} />`). */
  children: ReactNode;
}

/**
 * Overlay "cinema mode" que enquadra o `<Player>` para reprodução de filmes
 * e episódios de série.
 *
 * Comportamento:
 * - Backdrop preto edge-to-edge (sem padding externo) — mais imersivo.
 * - Vídeo dimensionado pela altura disponível, preservando 16:9.
 * - ESC fecha. Clique fora NÃO fecha (evita fechar sem querer).
 * - Trava o scroll do `<body>` enquanto está aberto.
 * - Devolve o foco ao gatilho anterior ao fechar.
 *
 * O botão X de fechar fica DENTRO do próprio Player (junto dos demais
 * controles) — esse overlay não desenha nenhum botão extra.
 */
export function PlayerOverlay({ open, onClose, children }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Body scroll lock + foco
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // foca no container pra capturar ESC mesmo se o usuário ainda não clicou no vídeo
    requestAnimationFrame(() => frameRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  // ESC global
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Não fecha se houver outro dialog (ex: ReportProblemDialog) aberto por cima.
      const openDialog = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      );
      if (openDialog && frameRef.current && !frameRef.current.contains(openDialog)) {
        return;
      }
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={frameRef}
        tabIndex={-1}
        className="relative w-auto h-auto max-h-[calc(100vh-2rem)] max-w-[min(100vw-2rem,1600px)] aspect-video outline-none transition-opacity duration-200 motion-safe:animate-[player-fade-in_220ms_ease-out_both]"
      >
        {/* Dica "Pressione Esc para fechar" — canto superior esquerdo, fora do quadro do vídeo
            (escondido em telas pequenas para não competir com os controles). */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar player (Esc)"
          className="hidden md:inline-flex absolute -top-3 -translate-y-full left-0 z-10 items-center gap-2 rounded-full bg-black/70 hover:bg-black/85 backdrop-blur px-3 py-1.5 text-xs text-white/90 border border-white/10 shadow-lg transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Pressione <kbd className="font-sans font-semibold text-white">Esc</kbd> para fechar</span>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
