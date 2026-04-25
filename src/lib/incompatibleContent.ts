/**
 * Utilitário para marcar conteúdos (filmes/episódios) que falharam com
 * codec_incompatible / formato não suportado no navegador. Persistimos
 * apenas localmente (localStorage) para evitar que o usuário tente abrir
 * de novo o mesmo arquivo que já sabemos que não vai tocar.
 *
 * Chave de identificação: `${host}:${streamId}` — o mesmo stream em outro
 * provedor (host diferente) é tratado independentemente.
 */

const STORAGE_KEY = "player.incompatible.v1";
const MAX_ENTRIES = 500; // hard cap para não estourar quota

type Store = Record<string, { reason: string; at: number }>;

function safeRead(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function safeWrite(store: Store) {
  try {
    const keys = Object.keys(store);
    if (keys.length > MAX_ENTRIES) {
      // Remove as entradas mais antigas
      const sorted = keys
        .map((k) => [k, store[k].at] as const)
        .sort((a, b) => a[1] - b[1]);
      const toDrop = sorted.slice(0, keys.length - MAX_ENTRIES);
      for (const [k] of toDrop) delete store[k];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / privacy mode — ignora */
  }
}

export function hostFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

export function buildKey(host: string | null | undefined, id: number | string | null | undefined): string | null {
  if (!host || id == null || id === "") return null;
  return `${host}:${id}`;
}

export function markIncompatible(
  host: string | null | undefined,
  id: number | string | null | undefined,
  reason: string,
): void {
  const key = buildKey(host, id);
  if (!key) return;
  const store = safeRead();
  if (store[key]) return; // já marcado — preserva o primeiro reason/at
  store[key] = { reason, at: Date.now() };
  safeWrite(store);
  // Notifica componentes interessados na mesma aba (storage event só dispara cross-tab)
  try {
    window.dispatchEvent(new CustomEvent("incompatible-content-changed", { detail: { key } }));
  } catch {
    /* noop */
  }
}

export function isIncompatible(
  host: string | null | undefined,
  id: number | string | null | undefined,
): boolean {
  const key = buildKey(host, id);
  if (!key) return false;
  const store = safeRead();
  return !!store[key];
}

export function getIncompatibleInfo(
  host: string | null | undefined,
  id: number | string | null | undefined,
): { reason: string; at: number } | null {
  const key = buildKey(host, id);
  if (!key) return null;
  const store = safeRead();
  return store[key] ?? null;
}

export function clearIncompatible(
  host: string | null | undefined,
  id: number | string | null | undefined,
): void {
  const key = buildKey(host, id);
  if (!key) return;
  const store = safeRead();
  if (!store[key]) return;
  delete store[key];
  safeWrite(store);
  try {
    window.dispatchEvent(new CustomEvent("incompatible-content-changed", { detail: { key } }));
  } catch {
    /* noop */
  }
}
