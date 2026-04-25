import { useCallback, useEffect, useState } from "react";

export type FavoriteKind = "live" | "vod" | "series";

/**
 * Favoritos persistidos em localStorage, escopados por usuário IPTV + tipo.
 * IDs são numéricos: stream_id (live, vod) ou series_id.
 *
 * Chave: `pixelflix:favorites:{kind}:{user}`. Mantém compat com a chave antiga
 * `pixelflix:favorites:{user}` (sem kind) — quando `kind === "live"` faz
 * fallback de leitura para a chave legada uma única vez e migra.
 */
export function useFavorites(scopeKey: string | null | undefined, kind: FavoriteKind = "live") {
  const storageKey = scopeKey ? `pixelflix:favorites:${kind}:${scopeKey}` : null;
  const legacyKey = scopeKey && kind === "live" ? `pixelflix:favorites:${scopeKey}` : null;
  const [ids, setIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!storageKey) {
      setIds(new Set());
      return;
    }
    try {
      let raw = localStorage.getItem(storageKey);
      if (!raw && legacyKey) {
        raw = localStorage.getItem(legacyKey);
        if (raw) {
          // migra para a nova chave e remove a antiga
          localStorage.setItem(storageKey, raw);
          localStorage.removeItem(legacyKey);
        }
      }
      const arr = raw ? (JSON.parse(raw) as number[]) : [];
      setIds(new Set(arr.filter((n) => Number.isFinite(n))));
    } catch {
      setIds(new Set());
    }
  }, [storageKey, legacyKey]);

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

/**
 * Lê (somente leitura, sem reagir a mudanças cross-tab) os IDs favoritos de
 * um tipo específico para uso em telas que só precisam exibir contagens.
 */
export function readFavoriteIds(scopeKey: string | null | undefined, kind: FavoriteKind): number[] {
  if (!scopeKey) return [];
  try {
    const raw = localStorage.getItem(`pixelflix:favorites:${kind}:${scopeKey}`);
    const legacy =
      kind === "live" && !raw ? localStorage.getItem(`pixelflix:favorites:${scopeKey}`) : null;
    const source = raw ?? legacy;
    if (!source) return [];
    const arr = JSON.parse(source) as number[];
    return arr.filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}
