import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pixelflix:series:autoplay";

function read(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return true; // default ON
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

/**
 * Preferência de autoplay do próximo episódio em séries.
 * Persiste em localStorage; default ON.
 * Sincroniza entre abas via evento `storage`.
 */
export function useAutoplayPreference() {
  const [enabled, setEnabled] = useState<boolean>(() => read());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabled(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const set = useCallback((next: boolean) => {
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return { enabled, toggle, set };
}
