import { useEffect } from "react";

interface Options {
  enabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPrevCategory?: () => void;
  onNextCategory?: () => void;
  onSearchFocus?: () => void;
  onEscape?: () => void;
  onFavorite?: () => void;
  onPlay?: () => void;
}

/**
 * Atalhos de teclado/TV para o layout de biblioteca (Filmes/Séries).
 *
 * - ↑/↓ ou j/k : próximo/anterior título
 * - ←/→        : trocar categoria (quando handlers fornecidos)
 * - Enter      : play
 * - /          : foca busca
 * - f          : favorito
 * - Esc        : fechar
 *
 * Ignora quando o foco está em campo editável (Esc sempre passa).
 */
export function useGridKeyboardNav({
  enabled = true,
  onPrev,
  onNext,
  onPrevCategory,
  onNextCategory,
  onSearchFocus,
  onEscape,
  onFavorite,
  onPlay,
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
        onEscape?.();
        return;
      }
      if (isEditable) return;

      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          onNext();
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          onPrev();
          break;
        case "ArrowLeft":
        case "h":
          if (onPrevCategory) {
            e.preventDefault();
            onPrevCategory();
          }
          break;
        case "ArrowRight":
        case "l":
          if (onNextCategory) {
            e.preventDefault();
            onNextCategory();
          }
          break;
        case "/":
          if (onSearchFocus) {
            e.preventDefault();
            onSearchFocus();
          }
          break;
        case "f":
        case "F":
          onFavorite?.();
          break;
        case "Enter":
          if (onPlay) {
            e.preventDefault();
            onPlay();
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    enabled,
    onPrev,
    onNext,
    onPrevCategory,
    onNextCategory,
    onSearchFocus,
    onEscape,
    onFavorite,
    onPlay,
  ]);
}
