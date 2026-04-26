import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Persistência de progresso de reprodução ("continue assistindo").
 *
 * Modelo híbrido:
 * - LOCAL (localStorage)  → fonte de verdade durante a sessão. Resposta
 *   instantânea, funciona offline, sobrevive a refresh.
 * - REMOTO (Supabase `watch_progress`) → sincroniza entre dispositivos
 *   da MESMA linha IPTV (chave: server_url + username). Não há
 *   isolamento por pessoa — quem usa a mesma conta IPTV vê o mesmo
 *   progresso (modelo "perfil único por linha").
 *
 * Estratégia de merge (LWW — last-write-wins):
 * - Ao montar: lê remoto, compara com local entrada-a-entrada por
 *   `updatedAt`, mantém a mais recente em ambos os lados.
 * - Ao escrever: grava local IMEDIATO + agenda upsert remoto debounced 5s.
 * - Realtime: assina mudanças do canal e funde no estado local.
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

export function makeProgressKey(kind: ProgressKind, id: number | string): string {
  return `${kind}:${id}`;
}

function storageKeyFor(scope: string | null | undefined): string | null {
  return scope ? `pixelflix:progress:${scope}` : null;
}

/** Normaliza server_url para casar com o que vai no banco (lower + sem barra final). */
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

  // Snapshot estável das credenciais para uso dentro de listeners/timers.
  const usernameRef = useRef<string | null>(scopeKey ?? null);
  const serverRef = useRef<string>(normalizeServerUrl(serverUrl));
  useEffect(() => {
    usernameRef.current = scopeKey ?? null;
    serverRef.current = normalizeServerUrl(serverUrl);
  }, [scopeKey, serverUrl]);

  // Buffer de upserts pendentes — evita uma chamada por save().
  const pendingRef = useRef<Map<string, ProgressEntry>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Marca chaves que já fundimos (evita disparar realtime echo de nós mesmos).
  const lastWriteAtRef = useRef<Map<string, number>>(new Map());

  const flushRemote = useCallback(async () => {
    flushTimerRef.current = null;
    const username = usernameRef.current;
    const server = serverRef.current;
    if (!username || !server || pendingRef.current.size === 0) return;
    const batch = Array.from(pendingRef.current.entries());
    pendingRef.current.clear();
    const rows = batch.map(([item_key, e]) => {
      const [kind, ...rest] = item_key.split(":");
      const content_id = rest.join(":");
      return {
        server_url: server,
        username,
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
    try {
      const { error } = await supabase
        .from("watch_progress")
        .upsert(rows, { onConflict: "server_url,username,item_key" });
      if (error) throw error;
    } catch (err) {
      // Falha de rede: re-coloca na fila p/ próxima tentativa, sem bloquear UX.
      for (const [k, v] of batch) {
        const existing = pendingRef.current.get(k);
        if (!existing || existing.updatedAt < v.updatedAt) {
          pendingRef.current.set(k, v);
        }
      }
      // log silencioso — sync é "best effort"
      if (typeof console !== "undefined") {
        // eslint-disable-next-line no-console
        console.warn("[watch_progress] upsert failed:", err);
      }
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = setTimeout(flushRemote, REMOTE_FLUSH_MS);
  }, [flushRemote]);

  const enqueueRemote = useCallback(
    (key: string, entry: ProgressEntry | null) => {
      if (!serverRef.current || !usernameRef.current) return;
      lastWriteAtRef.current.set(key, entry?.updatedAt ?? Date.now());
      if (entry == null) {
        // Delete: flush imediato (não tem ganho em segurar).
        const username = usernameRef.current;
        const server = serverRef.current;
        void supabase
          .from("watch_progress")
          .delete()
          .match({ server_url: server, username, item_key: key })
          .then(({ error }) => {
            if (error && typeof console !== "undefined") {
              // eslint-disable-next-line no-console
              console.warn("[watch_progress] delete failed:", error);
            }
          });
        return;
      }
      pendingRef.current.set(key, entry);
      scheduleFlush();
    },
    [scheduleFlush],
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

  // Merge inicial remoto → local + canal realtime.
  useEffect(() => {
    if (!storageKey || !scopeKey) return;
    const server = normalizeServerUrl(serverUrl);
    if (!server) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("watch_progress")
          .select("*")
          .eq("server_url", server)
          .eq("username", scopeKey);
        if (error) throw error;
        if (cancelled || !data) return;

        const local = readMap(storageKey);
        let changed = false;
        // Upserts vindos do remoto que ainda precisam ir pro local.
        for (const row of data as RemoteRow[]) {
          const remoteEntry = rowToEntry(row);
          const localEntry = local[row.item_key];
          if (!localEntry || localEntry.updatedAt < remoteEntry.updatedAt) {
            local[row.item_key] = remoteEntry;
            changed = true;
          }
        }
        // Locals mais novos que o remoto: enfileira pra subir.
        const remoteByKey = new Map<string, ProgressEntry>();
        for (const row of data as RemoteRow[]) {
          remoteByKey.set(row.item_key, rowToEntry(row));
        }
        for (const [k, v] of Object.entries(local)) {
          const r = remoteByKey.get(k);
          if (!r || r.updatedAt < v.updatedAt) {
            pendingRef.current.set(k, v);
          }
        }
        if (pendingRef.current.size > 0) scheduleFlush();
        if (changed) {
          writeMap(storageKey, local);
          setVersion((v) => v + 1);
        }
      } catch (err) {
        if (typeof console !== "undefined") {
          // eslint-disable-next-line no-console
          console.warn("[watch_progress] initial sync failed:", err);
        }
      }
    })();

    // Realtime: reflete progresso de outro dispositivo na mesma linha.
    const channel = supabase
      .channel(`watch_progress:${server}:${scopeKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watch_progress",
          filter: `username=eq.${scopeKey}`,
        },
        (payload) => {
          // Filtra por server_url no client (filtro composto não suportado).
          const row = (payload.new ?? payload.old) as RemoteRow | null;
          if (!row || row.server_url !== server) return;

          const map = readMap(storageKey);
          if (payload.eventType === "DELETE") {
            if (map[row.item_key]) {
              delete map[row.item_key];
              writeMap(storageKey, map);
              setVersion((v) => v + 1);
            }
            return;
          }
          const newRow = payload.new as RemoteRow;
          const incoming = rowToEntry(newRow);
          // Echo da nossa própria escrita: ignora se for o mesmo updatedAt.
          const ourLast = lastWriteAtRef.current.get(newRow.item_key);
          if (ourLast && Math.abs(ourLast - incoming.updatedAt) < 1000) return;

          const existing = map[newRow.item_key];
          if (!existing || existing.updatedAt < incoming.updatedAt) {
            map[newRow.item_key] = incoming;
            writeMap(storageKey, map);
            setVersion((v) => v + 1);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [storageKey, scopeKey, serverUrl, scheduleFlush]);

  // Flush ao desmontar / fechar aba.
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
      flush();
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

  /**
   * Salva progresso. `meta` é opcional e enriquece a entrada com dados
   * que serão úteis para o rail "Continue assistindo" e para os cards
   * de séries — sem precisar de uma segunda chamada ao catálogo.
   */
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

      // Concluído: remove da lista (não queremos sugerir "continuar do final").
      if (currentTime / duration >= COMPLETED_RATIO) {
        if (map[key]) {
          delete map[key];
          writeMap(storageKey, map);
          enqueueRemote(key, null);
          setVersion((v) => v + 1);
        }
        return;
      }

      // Muito no início: ainda não vale guardar (evita poluir).
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
      enqueueRemote(key, merged);
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
      enqueueRemote(key, null);
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
