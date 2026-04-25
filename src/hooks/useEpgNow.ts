import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getShortEpg, type EpgEntry, type IptvCredentials } from "@/services/iptv";

/**
 * Tick global de 30s — todos os componentes que mostram "agora/próximo"
 * compartilham o mesmo timer pra evitar dezenas de setIntervals.
 */
let _now = Date.now();
const _listeners = new Set<(n: number) => void>();
let _timer: ReturnType<typeof setInterval> | null = null;

function ensureTimer() {
  if (_timer) return;
  _timer = setInterval(() => {
    _now = Date.now();
    _listeners.forEach((fn) => fn(_now));
  }, 30_000);
}

export function useNowTick(): number {
  const [n, setN] = useState(_now);
  useEffect(() => {
    ensureTimer();
    _listeners.add(setN);
    return () => {
      _listeners.delete(setN);
    };
  }, []);
  return n;
}

/**
 * Carrega EPG curto de um canal (programa atual + próximos).
 * Cache de 5min, gc 30min — reaproveita ao trocar de canal e voltar.
 */
export function useChannelEpg(
  creds: IptvCredentials | null,
  streamId: number | null | undefined,
  hasEpg: boolean,
) {
  return useQuery<EpgEntry[]>({
    queryKey: ["short-epg", creds?.username, streamId],
    queryFn: () => getShortEpg(creds!, streamId!),
    enabled: !!creds && !!streamId && hasEpg,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export interface EpgNowNextResult {
  now?: EpgEntry;
  next?: EpgEntry;
  progress: number; // 0..1
  remainingMs: number;
}

/** Calcula programa atual + próximo + progresso a partir da lista do EPG. */
export function pickNowNext(list: EpgEntry[] | undefined, nowMs: number): EpgNowNextResult {
  if (!list || list.length === 0) {
    return { progress: 0, remainingMs: 0 };
  }
  const now = list.find((e) => e.startMs <= nowMs && e.endMs > nowMs);
  const next = list.find((e) => e.startMs > nowMs);
  if (!now) return { next, progress: 0, remainingMs: 0 };
  const total = now.endMs - now.startMs;
  const elapsed = nowMs - now.startMs;
  const progress = total > 0 ? Math.max(0, Math.min(1, elapsed / total)) : 0;
  return { now, next, progress, remainingMs: Math.max(0, now.endMs - nowMs) };
}
