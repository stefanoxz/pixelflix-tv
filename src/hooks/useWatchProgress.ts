import { useCallback, useEffect, useState } from "react";

/**
 * Persistência de progresso de reprodução ("continue assistindo") em
 * localStorage, escopado por usuário IPTV. Não envolve servidor — é
 * privado ao navegador, igual aos favoritos.
 *
 * Chave de storage: `pixelflix:progress:<user>`
 * Estrutura:        Record<itemKey, { t, d, updatedAt }>
 *  - itemKey = "movie:<stream_id>" | "episode:<id>"
 *  - t       = currentTime em segundos
 *  - d       = duration em segundos (para % e detecção de "terminado")
 *  - updatedAt = epoch ms (para LRU + ordenação)
 */

export type ProgressKind = "movie" | "episode";

export interface ProgressEntry {
  t: number;
  d: number;
  updatedAt: number;
}

export type ProgressMap = Record<string, ProgressEntry>;

/** Considera "começado" a partir de 30s (evita lixo de cliques acidentais). */
export const MIN_RESUME_SECONDS = 30;
/** Acima de 95% considera assistido — some da lista. */
export const COMPLETED_RATIO = 0.95;
/** Limite de itens guardados (LRU). */
const MAX_ENTRIES = 200;

export function makeProgressKey(kind: ProgressKind, id: number | string): string {
  return `${kind}:${id}`;
}

function storageKeyFor(scope: string | null | undefined): string | null {
  return scope ? `pixelflix:progress:${scope}` : null;
}

function readMap(storageKey: string | null): ProgressMap {
  if (!storageKey) return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

function writeMap(storageKey: string | null, map: ProgressMap): void {
  if (!storageKey) return;
  try {
    // LRU: mantém só os MAX_ENTRIES mais recentes.
    const entries = Object.entries(map);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
      const trimmed: ProgressMap = {};
      for (const [k, v] of entries.slice(0, MAX_ENTRIES)) trimmed[k] = v;
      localStorage.setItem(storageKey, JSON.stringify(trimmed));
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    /* quota / private mode — ignora */
  }
}

/**
 * Hook reativo para gerenciar progresso. O `version` interno faz com que
 * componentes que usam `getProgress` recalculem quando salvamos algo.
 */
export function useWatchProgress(scopeKey: string | null | undefined) {
  const storageKey = storageKeyFor(scopeKey);
  const [version, setVersion] = useState(0);

  // Sincroniza entre abas/janelas do mesmo usuário.
  useEffect(() => {
    if (!storageKey) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setVersion((v) => v + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  const getProgress = useCallback(
    (key: string): ProgressEntry | null => {
      const map = readMap(storageKey);
      return map[key] ?? null;
    },
    // depende de version pra invalidar memoizações dos consumidores
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey, version],
  );

  const saveProgress = useCallback(
    (key: string, currentTime: number, duration: number) => {
      if (!storageKey) return;
      if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return;

      const map = readMap(storageKey);

      // Concluído: remove da lista (não queremos sugerir "continuar do final").
      if (currentTime / duration >= COMPLETED_RATIO) {
        if (map[key]) {
          delete map[key];
          writeMap(storageKey, map);
          setVersion((v) => v + 1);
        }
        return;
      }

      // Muito no início: ainda não vale guardar (evita poluir).
      if (currentTime < MIN_RESUME_SECONDS) return;

      map[key] = {
        t: Math.floor(currentTime),
        d: Math.floor(duration),
        updatedAt: Date.now(),
      };
      writeMap(storageKey, map);
      setVersion((v) => v + 1);
    },
    [storageKey],
  );

  const clearProgress = useCallback(
    (key: string) => {
      if (!storageKey) return;
      const map = readMap(storageKey);
      if (!map[key]) return;
      delete map[key];
      writeMap(storageKey, map);
      setVersion((v) => v + 1);
    },
    [storageKey],
  );

  /** Lista todos os itens em andamento (mais recentes primeiro). */
  const listInProgress = useCallback((): Array<{ key: string } & ProgressEntry> => {
    const map = readMap(storageKey);
    return Object.entries(map)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, version]);

  return { getProgress, saveProgress, clearProgress, listInProgress };
}

/** Formata segundos como mm:ss ou hh:mm:ss. */
export function formatProgressTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
