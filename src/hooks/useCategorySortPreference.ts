import { useCallback, useEffect, useState } from "react";

export type CategorySort = "az" | "za" | "server";

const KEY = "live_category_sort";
const DEFAULT: CategorySort = "az";

function read(): CategorySort {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "az" || v === "za" || v === "server") return v;
  } catch {
    /* noop */
  }
  return DEFAULT;
}

/**
 * Persiste a preferência do usuário sobre a ordenação das categorias
 * na página de Canais ao Vivo (rail desktop + drawer mobile).
 */
export function useCategorySortPreference() {
  const [sort, setSortState] = useState<CategorySort>(read);

  // Sincroniza entre abas/janelas
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setSortState(read());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSort = useCallback((next: CategorySort) => {
    setSortState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* noop */
    }
  }, []);

  return { sort, setSort };
}
