import { useEffect } from "react";

interface Options {
  enabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSearchFocus: () => void;
  onEscape: () => void;
  onFavorite: () => void;
}

/**
 * Atalhos globais da página /live. Ignora quando foco está em campo de texto
 * (exceto Escape, que sempre funciona).
 */
export function useLiveKeyboardNav({
  enabled = true,
  onPrev,
  onNext,
  onSearchFocus,
  onEscape,
  onFavorite,
}: Options) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;

      if (e.key === "Escape") {
        onEscape();
        return;
      }
      if (isEditable) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "/") {
        e.preventDefault();
        onSearchFocus();
      } else if (e.key === "f" || e.key === "F") {
        onFavorite();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onPrev, onNext, onSearchFocus, onEscape, onFavorite]);
}
