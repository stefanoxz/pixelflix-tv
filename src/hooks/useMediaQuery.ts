import { useEffect, useState } from "react";

/**
 * Hook reativo para `window.matchMedia`. Retorna `true`/`false` e atualiza
 * automaticamente quando o navegador mudar (resize, rotação, DevTools).
 *
 * Use em vez de avaliar `matchMedia` no top-level do módulo — constantes
 * estáticas ficam "presas" no estado do primeiro render e não acompanham
 * mudanças (ex: girar tablet, ativar device-toolbar, redimensionar janela).
 *
 * @param query CSS media query (ex: `(max-width: 767px)`).
 * @returns `true` se a query bate, `false` caso contrário. Em SSR/Node, `false`.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // sincroniza estado inicial (caso SSR tenha chutado false)
    setMatches(mql.matches);
    // Safari < 14 só suporta addListener
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Safari < 14 fallback
    const legacy = mql as unknown as {
      addListener: (cb: (e: MediaQueryListEvent) => void) => void;
      removeListener: (cb: (e: MediaQueryListEvent) => void) => void;
    };
    legacy.addListener(onChange);
    return () => legacy.removeListener(onChange);
  }, [query]);

  return matches;
}
