import { useEffect, useState } from "react";

const STORAGE_KEY = "player.incompatible.v1";

type Store = Record<string, { reason: string; at: number }>;

function readKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Store;
    return new Set(Object.keys(parsed || {}));
  } catch {
    return new Set();
  }
}

/**
 * Versão "global" reativa do conjunto de chaves marcadas como incompatíveis.
 * Uma única assinatura de eventos serve para todo o grid (em vez de uma por
 * card). O componente que usar deve construir a chave com `${host}:${id}`.
 */
export function useIncompatibleKeys(): Set<string> {
  const [keys, setKeys] = useState<Set<string>>(() => readKeys());

  useEffect(() => {
    const refresh = () => setKeys(readKeys());
    window.addEventListener("incompatible-content-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("incompatible-content-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return keys;
}
