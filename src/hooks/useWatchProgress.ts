import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIptv } from "@/context/useIptv";

/**
 * Persistência de progresso de reprodução ("continue assistindo").
 *
 * Modelo híbrido SEGURO (gateway via edge function):
 * - LOCAL (localStorage)  → fonte de verdade durante a sessão. Resposta
 *   instantânea, funciona offline, sobrevive a refresh.
 * - REMOTO (Supabase `watch_progress`, via edge function `watch-progress`) →
 *   sincroniza entre dispositivos da MESMA linha IPTV.
 *
 * Segurança: a tabela `watch_progress` está isolada — só o backend
 * (service_role, dentro da edge function) lê/grava. O cliente troca as
 * credenciais IPTV (já validadas) por um token HMAC de 24h e usa ele em
 * cada chamada. Sem o token (= sem credencial IPTV válida), não há acesso.
 *
 * Estratégia de merge (LWW — last-write-wins):
 * - Ao montar: lê remoto, compara com local entrada-a-entrada por
 *   `updatedAt`, mantém a mais recente em ambos os lados.
 * - Ao escrever: grava local IMEDIATO + agenda upsert remoto debounced 5s.
 * - Foco da janela: re-lê remoto (substitui realtime — seria complexo
 *   broadcastar updates feitos por service_role).
 *
 * Chave de storage local: `pixelflix:progress:<user>`
 * Estrutura:               Record<itemKey, ProgressEntry>
 *  - itemKey = "movie:<stream_id>" | "episode:<id>"
 */

export type ProgressKind = "movie" | "episode";

export interface ProgressEntry {
  /** currentTime em segundos */
  t: number;
  /** duration em segundos */
  d: number;
  /** epoch ms — usado para LWW e ordenação */
  updatedAt: number;
  /** Tipo (redundante com prefixo da chave, facilita consumo) */
  kind?: ProgressKind;
  /** Para episódios: id da série pai (alimenta a barra no card da série) */
  seriesId?: number;
  /** Título amigável (alimenta o rail "Continue assistindo") */
  title?: string;
  /** URL da capa (alimenta o rail) */
  poster?: string;
}

export type ProgressMap = Record<string, ProgressEntry>;

/** Considera "começado" a partir de 30s (evita lixo de cliques acidentais). */
export const MIN_RESUME_SECONDS = 30;
/** Acima de 95% considera assistido — some da lista. */
export const COMPLETED_RATIO = 0.95;
/** Limite de itens guardados (LRU). */
const MAX_ENTRIES = 200;
/** Debounce do upsert remoto. */
const REMOTE_FLUSH_MS = 5_000;
/** Re-sync remoto quando a aba volta ao foco, no máximo uma vez por X ms. */
const REFOCUS_SYNC_THROTTLE_MS = 30_000;

export function makeProgressKey(kind: ProgressKind, id: number | string): string {
  return `${kind}:${id}`;
}

function storageKeyFor(scope: string | null | undefined): string | null {
  return scope ? `pixelflix:progress:${scope}` : null;
}

/** Normaliza server_url para casar com o que vai no banco. */
function normalizeServerUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.trim().toLowerCase().replace(/\/+$/, "");
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

interface RemoteRow {
  server_url: string;
  username: string;
  item_key: string;
  kind: string;
  content_id: string;
  series_id: number | null;
  title: string | null;
  poster_url: string | null;
  position_seconds: number;
  duration_seconds: number;
  updated_at: string;
}

function rowToEntry(row: RemoteRow): ProgressEntry {
  return {
    t: row.position_seconds || 0,
    d: row.duration_seconds || 0,
    updatedAt: new Date(row.updated_at).getTime(),
    kind: (row.kind === "episode" || row.kind === "movie") ? row.kind : undefined,
    seriesId: row.series_id ?? undefined,
    title: row.title ?? undefined,
    poster: row.poster_url ?? undefined,
  };
}

// ---------- Token cache (HMAC, 24h) ----------

interface TokenCacheEntry {
  token: string;
  expiresAt: number; // epoch seconds
}

function tokenCacheKey(server: string, username: string): string {
  return `pixelflix:wp-token:${server}::${username}`;
}

function readToken(server: string, username: string): string | null {
  if (!server || !username) return null;
  try {
    const raw = localStorage.getItem(tokenCacheKey(server, username));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenCacheEntry;
    // Margem de 60s pra evitar bater no servidor com token quase expirado.
    if (parsed.expiresAt > Math.floor(Date.now() / 1000) + 60) return parsed.token;
    return null;
  } catch {
    return null;
  }
}

function saveToken(server: string, username: string, token: string, expiresAt: number) {
  try {
    localStorage.setItem(
      tokenCacheKey(server, username),
      JSON.stringify({ token, expiresAt }),
    );
  } catch { /* ignora */ }
}

function clearToken(server: string, username: string) {
  try { localStorage.removeItem(tokenCacheKey(server, username)); } catch { /* ignora */ }
}

async function fetchToken(
  server: string,
  username: string,
  password: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("watch-progress", {
      body: { action: "auth", server, username, password },
    });
    if (error) {
      console.warn("[watch-progress] auth failed:", error);
      return null;
    }
    if (!data?.token || !data?.expires_at) return null;
    saveToken(server, username, data.token, Number(data.expires_at));
    return String(data.token);
  } catch (err) {
    console.warn("[watch-progress] auth exception:", err);
    return null;
  }
}

async function callWithToken(
  token: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data?: any; expired?: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke("watch-progress", {
      body,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) {
      // Tenta detectar token expirado para forçar re-auth.
      const msg = String(error.message ?? "").toLowerCase();
      const expired = msg.includes("invalid_or_expired") || msg.includes("401");
      return { ok: false, expired };
    }
    return { ok: true, data };
  } catch (err) {
    console.warn("[watch-progress] call failed:", err);
    return { ok: false };
  }
}

/**
 * Hook reativo para gerenciar progresso. O `version` interno faz com que
 * componentes que usam `getProgress`/`listInProgress` recalculem ao salvar.
 *
 * @param scopeKey   username IPTV — usado como escopo local + parte da PK remota.
 * @param serverUrl  server_url IPTV — outra parte da PK remota (opcional;
 *                   se ausente, sync remoto é desligado mas local funciona).
 */
export function useWatchProgress(
  scopeKey: string | null | undefined,
  serverUrl?: string | null,
) {
  const storageKey = storageKeyFor(scopeKey);
  const [version, setVersion] = useState(0);

  // Pega a senha da sessão IPTV — necessária pra trocar por token.
  // O hook é chamado em vários lugares (ContinueWatchingRail, Movies, Series),
  // todos dentro de IptvProvider. Se algum dia for usado fora, useIptv lança
  // — mas isso é o comportamento desejado.
  const { session } = useIptv();
  const password = session?.creds?.password ?? null;

  const usernameRef = useRef<string | null>(scopeKey ?? null);
  const serverRef = useRef<string>(normalizeServerUrl(serverUrl));
  const passwordRef = useRef<string | null>(password);
  useEffect(() => {
    usernameRef.current = scopeKey ?? null;
    serverRef.current = normalizeServerUrl(serverUrl);
    passwordRef.current = password;
  }, [scopeKey, serverUrl, password]);

  const pendingRef = useRef<Map<string, ProgressEntry>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Coalesce concurrent token requests across multiple hook instances.
  const inflightTokenRef = useRef<Promise<string | null> | null>(null);

  /**
   * Garante um token válido. Reusa cache do localStorage se disponível;
   * senão troca credenciais por um novo. Retorna null se faltar info ou
   * o servidor recusar a credencial. Coalesce: se já existe uma chamada
   * em andamento, aguarda a mesma promise (evita 3+ requests paralelas
   * quando vários componentes montam juntos).
   */
  const ensureToken = useCallback(async (): Promise<string | null> => {
    const server = serverRef.current;
    const username = usernameRef.current;
    const pass = passwordRef.current;
    if (!server || !username) return null;
    const cached = readToken(server, username);
    if (cached) return cached;
    if (!pass) return null;
    if (inflightTokenRef.current) return inflightTokenRef.current;
    const p = fetchToken(server, username, pass).finally(() => {
      inflightTokenRef.current = null;
    });
    inflightTokenRef.current = p;
    return p;
  }, []);

  const flushRemote = useCallback(async () => {
    flushTimerRef.current = null;
    const username = usernameRef.current;
    const server = serverRef.current;
    if (!username || !server || pendingRef.current.size === 0) return;
    const batch = Array.from(pendingRef.current.entries());
    pendingRef.current.clear();
    const entries = batch.map(([item_key, e]) => {
      const [kind, ...rest] = item_key.split(":");
      const content_id = rest.join(":");
      return {
        item_key,
        kind,
        content_id,
        series_id: e.seriesId ?? null,
        title: e.title ?? null,
        poster_url: e.poster ?? null,
        position_seconds: Math.floor(e.t),
        duration_seconds: Math.floor(e.d),
        updated_at: new Date(e.updatedAt).toISOString(),
      };
    });

    let token = await ensureToken();
    if (!token) {
      // Sem token — rebufera pra próxima tentativa, mas evita loop infinito
      // descartando o batch se nem dá pra autenticar (sem senha em sessão).
      if (passwordRef.current) {
        for (const [k, v] of batch) {
          const existing = pendingRef.current.get(k);
          if (!existing || existing.updatedAt < v.updatedAt) {
            pendingRef.current.set(k, v);
          }
        }
      }
      return;
    }

    let res = await callWithToken(token, { action: "upsert", entries });
    if (!res.ok && res.expired) {
      // Token expirado: limpa cache e tenta uma vez mais.
      clearToken(serverRef.current, usernameRef.current ?? "");
      token = await ensureToken();
      if (token) res = await callWithToken(token, { action: "upsert", entries });
    }
    if (!res.ok) {
      // Falha: re-enfileira (sem perder dados).
      for (const [k, v] of batch) {
        const existing = pendingRef.current.get(k);
        if (!existing || existing.updatedAt < v.updatedAt) {
          pendingRef.current.set(k, v);
        }
      }
    }
  }, [ensureToken]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = setTimeout(flushRemote, REMOTE_FLUSH_MS);
  }, [flushRemote]);

  const enqueueRemote = useCallback(
    async (key: string, entry: ProgressEntry | null) => {
      if (!serverRef.current || !usernameRef.current) return;
      if (entry == null) {
        // Delete: imediato, fora do batch.
        let token = await ensureToken();
        if (!token) return;
        let res = await callWithToken(token, { action: "delete", item_key: key });
        if (!res.ok && res.expired) {
          clearToken(serverRef.current, usernameRef.current);
          token = await ensureToken();
          if (token) res = await callWithToken(token, { action: "delete", item_key: key });
        }
        return;
      }
      pendingRef.current.set(key, entry);
      scheduleFlush();
    },
    [ensureToken, scheduleFlush],
  );

  // Sincroniza entre abas/janelas do mesmo navegador.
  useEffect(() => {
    if (!storageKey) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setVersion((v) => v + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  // Pull inicial do remoto (e re-pull em foco, com throttle).
  const lastSyncAtRef = useRef(0);
  const pullRemote = useCallback(async () => {
    const storage = storageKey;
    const username = usernameRef.current;
    const server = serverRef.current;
    if (!storage || !username || !server) return;
    const token = await ensureToken();
    if (!token) return;
    const res = await callWithToken(token, { action: "list" });
    if (!res.ok) {
      if (res.expired) clearToken(server, username);
      return;
    }
    const rows: RemoteRow[] = Array.isArray(res.data?.entries) ? res.data.entries : [];
    const local = readMap(storage);
    let changed = false;
    const remoteByKey = new Map<string, ProgressEntry>();
    for (const row of rows) {
      const remoteEntry = rowToEntry(row);
      remoteByKey.set(row.item_key, remoteEntry);
      const localEntry = local[row.item_key];
      if (!localEntry || localEntry.updatedAt < remoteEntry.updatedAt) {
        local[row.item_key] = remoteEntry;
        changed = true;
      }
    }
    // Locals mais novos que o remoto: enfileira pra subir UMA vez.
    // (não re-enfileiramos se já há um item pendente — evita loop infinito
    // de re-tentativas quando upload falha continuamente)
    for (const [k, v] of Object.entries(local)) {
      const r = remoteByKey.get(k);
      if ((!r || r.updatedAt < v.updatedAt) && !pendingRef.current.has(k)) {
        pendingRef.current.set(k, v);
      }
    }
    if (pendingRef.current.size > 0) scheduleFlush();
    if (changed) {
      writeMap(storage, local);
      setVersion((v) => v + 1);
    }
    lastSyncAtRef.current = Date.now();
  }, [ensureToken, scheduleFlush, storageKey]);

  useEffect(() => {
    if (!storageKey || !scopeKey) return;
    void pullRemote();
  }, [storageKey, scopeKey, pullRemote]);

  // Re-sync ao voltar ao foco (no lugar do realtime).
  // IMPORTANTE: o handler de visibilitychange precisa ser removido no cleanup
  // — antes ficava acumulando a cada re-render, vazando memória + chamadas.
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastSyncAtRef.current < REFOCUS_SYNC_THROTTLE_MS) return;
      void pullRemote();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pullRemote]);

  // Flush ao fechar a aba. NÃO disparamos no cleanup do effect — antes
  // qualquer re-render que mudasse `flushRemote` (ex.: token novo) acionava
  // um flush espúrio. Agora só o "pagehide/beforeunload" faz flush.
  useEffect(() => {
    const flush = () => {
      if (flushTimerRef.current != null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      void flushRemote();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [flushRemote]);

  const getProgress = useCallback(
    (key: string): ProgressEntry | null => {
      const map = readMap(storageKey);
      return map[key] ?? null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey, version],
  );

  const saveProgress = useCallback(
    (
      key: string,
      currentTime: number,
      duration: number,
      meta?: { kind?: ProgressKind; seriesId?: number; title?: string; poster?: string },
    ) => {
      if (!storageKey) return;
      if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return;

      const map = readMap(storageKey);

      // Concluído: remove da lista.
      if (currentTime / duration >= COMPLETED_RATIO) {
        if (map[key]) {
          delete map[key];
          writeMap(storageKey, map);
          void enqueueRemote(key, null);
          setVersion((v) => v + 1);
        }
        return;
      }

      if (currentTime < MIN_RESUME_SECONDS) return;

      const existing = map[key];
      const merged: ProgressEntry = {
        t: Math.floor(currentTime),
        d: Math.floor(duration),
        updatedAt: Date.now(),
        kind: meta?.kind ?? existing?.kind,
        seriesId: meta?.seriesId ?? existing?.seriesId,
        title: meta?.title ?? existing?.title,
        poster: meta?.poster ?? existing?.poster,
      };
      map[key] = merged;
      writeMap(storageKey, map);
      void enqueueRemote(key, merged);
      setVersion((v) => v + 1);
    },
    [storageKey, enqueueRemote],
  );

  const clearProgress = useCallback(
    (key: string) => {
      if (!storageKey) return;
      const map = readMap(storageKey);
      if (!map[key]) return;
      delete map[key];
      writeMap(storageKey, map);
      void enqueueRemote(key, null);
      setVersion((v) => v + 1);
    },
    [storageKey, enqueueRemote],
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
