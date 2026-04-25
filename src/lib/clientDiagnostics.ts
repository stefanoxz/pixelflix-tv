import { supabase } from "@/integrations/supabase/client";

export interface ClientDiagnosticBase {
  effective_type?: string;
  downlink_mbps?: number;
  rtt_ms?: number;
  save_data?: boolean;
  device_memory?: number;
  hardware_concurrency?: number;
  screen?: string;
  language?: string;
  timezone?: string;
}

export interface ClientDiagnosticReport extends ClientDiagnosticBase {
  outcome: "success" | "fail" | "timeout" | "abort" | "unknown";
  username?: string | null;
  server_url?: string | null;
  client_error?: string | null;
  duration_ms?: number | null;
  speed_kbps?: number | null;
  login_event_id?: string | null;
}

/** Lê informações de rede/dispositivo do navegador, tudo opcional. */
export function collectClientDiagnostic(): ClientDiagnosticBase {
  const out: ClientDiagnosticBase = {};
  try {
    // @ts-ignore - Network Information API
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      if (typeof conn.effectiveType === "string") out.effective_type = conn.effectiveType;
      if (typeof conn.downlink === "number") out.downlink_mbps = conn.downlink;
      if (typeof conn.rtt === "number") out.rtt_ms = conn.rtt;
      if (typeof conn.saveData === "boolean") out.save_data = conn.saveData;
    }
  } catch { /* ignore */ }
  try {
    // @ts-ignore - Device Memory API
    const dm = (navigator as any).deviceMemory;
    if (typeof dm === "number") out.device_memory = dm;
  } catch { /* ignore */ }
  try {
    if (typeof navigator.hardwareConcurrency === "number") out.hardware_concurrency = navigator.hardwareConcurrency;
  } catch { /* ignore */ }
  try {
    if (typeof window !== "undefined" && window.screen) {
      out.screen = `${window.screen.width}x${window.screen.height}`;
    }
  } catch { /* ignore */ }
  try {
    out.language = navigator.language;
  } catch { /* ignore */ }
  try {
    out.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch { /* ignore */ }
  return out;
}

/**
 * Mede velocidade de download de um pequeno recurso estático.
 * Best-effort: nunca lança; retorna null se não conseguir medir.
 */
export async function runQuickSpeedProbe(timeoutMs = 3000): Promise<number | null> {
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), timeoutMs);
    const url = `/favicon.ico?cb=${Date.now()}`;
    const t0 = performance.now();
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) {
      clearTimeout(tm);
      return null;
    }
    const buf = await res.arrayBuffer();
    clearTimeout(tm);
    const dt = (performance.now() - t0) / 1000; // s
    if (dt <= 0) return null;
    const kb = buf.byteLength / 1024;
    return Math.round(kb / dt);
  } catch {
    return null;
  }
}

/**
 * Envia diagnóstico ao backend. Best-effort: nunca lança.
 */
export async function reportDiagnostic(report: ClientDiagnosticReport): Promise<void> {
  try {
    const base = collectClientDiagnostic();
    const payload = { ...base, ...report };
    await supabase.functions.invoke("client-diagnostic", { body: payload });
  } catch (err) {
    // Silencioso por design.
    console.warn("[diagnostic] report failed", err);
  }
}

/**
 * Classifica uma mensagem/erro de rede em um outcome amigável.
 */
export function classifyOutcome(err: unknown): "timeout" | "abort" | "fail" {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  if (/abort/.test(msg)) return "abort";
  if (/timeout|timed out/.test(msg)) return "timeout";
  return "fail";
}
