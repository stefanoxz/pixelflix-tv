import { useCallback, useEffect, useState } from "react";

/**
 * Favoritos persistidos em localStorage, escopados por usuário IPTV.
 * Aceita qualquer ID numérico (stream_id de canais).
 */
export function useFavorites(scopeKey: string | null | undefined) {
  const storageKey = scopeKey ? `pixelflix:favorites:${scopeKey}` : null;
  const [ids, setIds] = useState<Set<number>>(() => new Set());

  // Hidrata do storage quando o escopo muda.
  useEffect(() => {
    if (!storageKey) {
      setIds(new Set());
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      const arr = raw ? (JSON.parse(raw) as number[]) : [];
      setIds(new Set(arr.filter((n) => Number.isFinite(n))));
    } catch {
      setIds(new Set());
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: Set<number>) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {
        /* quota / private mode — ignora */
      }
    },
    [storageKey],
  );

  const toggle = useCallback(
    (id: number) => {
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const isFavorite = useCallback((id: number) => ids.has(id), [ids]);

  return { favorites: ids, toggle, isFavorite };
}
