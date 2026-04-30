import { supabase } from "@/integrations/supabase/client";
import { type IptvCredentials, type InvokeKind } from "./types";

export const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const connectivityConfig = {
  failureWindowMs: 10_000,
  failuresToOffline: 3,
  successesToOnline: 2,
  cooldownMs: 4_000,
  reconnectWindowMs: 1_500,
  reconnectSpacingMs: 200,
  reconnectConcurrency: 1,
  normalConcurrency: 1,
  timeoutLogin: 12_000,
  timeoutToken: 5_000,
  timeoutData: 20_000,
  retriesLogin: 3,
  retriesToken: 1,
  retriesData: 2,
};

export class TimeoutError extends Error {
  constructor() { super("timeout"); this.name = "TimeoutError"; }
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError()), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export function classifyError(e: unknown): "timeout" | "network" | "transient" | "other" {
  if (e instanceof TimeoutError) return "timeout";
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  if (/503|502|504|temporarily unavailable|supabase_edge_runtime_error|boot_error|edge_runtime/.test(msg)) {
    return "transient";
  }
  if (/network|failed to fetch|networkerror|fetch failed|load failed|failed to send a request|edge function/.test(msg)) {
    return "network";
  }
  return "other";
}

export async function invokeFn<T>(
  name: string,
  body: Record<string, unknown>,
  kind: InvokeKind,
): Promise<T> {
  const timeout = kind === "login" ? connectivityConfig.timeoutLogin : kind === "token" ? connectivityConfig.timeoutToken : connectivityConfig.timeoutData;
  const baseRetries = kind === "login" ? connectivityConfig.retriesLogin : kind === "token" ? connectivityConfig.retriesToken : connectivityConfig.retriesData;

  let lastErr: unknown;
  for (let i = 0; i <= baseRetries; i++) {
    try {
      const { data, error } = await supabase.functions.invoke(name, { body });
      if (error) throw new Error(error.message || `Falha em ${name}`);
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as T;
    } catch (e) {
      lastErr = e;
      const cls = classifyError(e);
      if (cls === "other" || i === baseRetries) break;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Falha desconhecida");
}

export async function invokeSafe<T = unknown>(
  name: string,
  body: Record<string, unknown>,
  kind: InvokeKind = "data",
): Promise<{ ok: boolean; data?: T; code?: string; error?: string; status?: number }> {
  try {
    const data = await invokeFn<T>(name, body, kind);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, code: "ERROR", error: e instanceof Error ? e.message : String(e) };
  }
}

export function proxyImageUrl(url: string | null | undefined, opts?: { w?: number; h?: number; q?: number }): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  const wantsResize = !!opts && (opts.w || opts.h);
  if (!wantsResize && /^(https:|data:)/i.test(trimmed)) return trimmed;
  if (/^data:/i.test(trimmed)) return trimmed;
  const stripped = trimmed.replace(/^https?:\/\//i, "");
  const params = new URLSearchParams();
  params.set("url", stripped);
  if (opts?.w) params.set("w", String(opts.w));
  if (opts?.h) params.set("h", String(opts.h));
  if (wantsResize) {
    params.set("fit", "cover");
    params.set("output", "webp");
    params.set("q", String(opts?.q ?? 75));
  }
  return `https://images.weserv.nl/?${params.toString()}`;
}

export function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `http://${url}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch { return null; }
}

export function isHostAllowed(candidate: string | null | undefined, allowed?: string[] | null): boolean {
  const h = hostnameOf(candidate);
  if (!h || !allowed?.length) return false;
  return allowed.some((a) => hostnameOf(a) === h);
}
