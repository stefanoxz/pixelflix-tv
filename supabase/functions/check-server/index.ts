import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { proxiedFetch, isProxyEnabled } from "../_shared/proxied-fetch.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type State = "online" | "unstable" | "offline";

type Reason =
  | "online"
  | "auth_required"
  | "blocked"
  | "not_found"
  | "http_error"
  | "timeout"
  | "rst"
  | "network"
  | "unknown";

interface Attempt {
  state: State;
  latency: number | null;
  status: number | null;
  reason: Reason;
  error?: "timeout" | "network";
}

interface PingResult {
  url: string;
  state: State;
  online: boolean; // compat: true se online OU unstable (servidor respondeu)
  latency: number | null;
  status: number | null;
  attempts: number;
  reason: Reason;
  error?: "timeout" | "network";
  checked_at: string;
}

function classifyHttp(s: number): { state: State; reason: Reason } {
  if (s >= 200 && s < 300) return { state: "online", reason: "online" };
  if (s === 401) return { state: "online", reason: "auth_required" };
  if (s === 403) return { state: "unstable", reason: "blocked" };
  if (s === 404) return { state: "unstable", reason: "not_found" };
  if (s >= 500 && s < 600) return { state: "unstable", reason: "http_error" };
  return { state: "unstable", reason: "unknown" };
}

async function singlePing(url: string): Promise<Attempt> {
  const target = url.replace(/\/+$/, "") + "/player_api.php";
  const start = Date.now();
  try {
    let res = await fetch(target, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(target, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      try { await res.text(); } catch { /* ignore */ }
    }
    const latency = Date.now() - start;
    const { state, reason } = classifyHttp(res.status);
    return { state, latency, status: res.status, reason };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = /timeout|timed out|aborted|abort/i.test(message);
    const isReset = /reset|ECONNRESET|connection reset/i.test(message);
    let reason: Reason;
    let state: State;
    if (isTimeout) { reason = "timeout"; state = "unstable"; }
    else if (isReset) { reason = "rst"; state = "offline"; }
    else { reason = "network"; state = "offline"; }
    return {
      state,
      latency: null,
      status: null,
      reason,
      error: isTimeout ? "timeout" : "network",
    };
  }
}

const RANK: Record<State, number> = { online: 2, unstable: 1, offline: 0 };

function combine(a: Attempt, b: Attempt): { state: State; pick: Attempt } {
  // Caso especial: ambos timeout -> offline
  if (a.error === "timeout" && b.error === "timeout") {
    return { state: "offline", pick: { ...a, state: "offline" } };
  }
  // Caso especial: qualquer erro de rede + a outra não-online -> offline
  const networkA = a.error === "network";
  const networkB = b.error === "network";
  if ((networkA || networkB) && !(a.state === "online" || b.state === "online")) {
    return { state: "offline", pick: networkA ? a : b };
  }
  // Regra geral: melhor estado vence
  const best = RANK[a.state] >= RANK[b.state] ? a : b;
  return { state: best.state, pick: best };
}

async function pingOne(url: string): Promise<PingResult> {
  const checked_at = new Date().toISOString();
  const a1 = await singlePing(url);
  if (a1.state === "online") {
    return {
      url,
      state: "online",
      online: true,
      latency: a1.latency,
      status: a1.status,
      attempts: 1,
      reason: a1.reason,
      error: a1.error,
      checked_at,
    };
  }
  const a2 = await singlePing(url);
  const { state, pick } = combine(a1, a2);
  // Latência: menor entre as bem-sucedidas
  const latencies = [a1.latency, a2.latency].filter((n): n is number => typeof n === "number");
  const latency = latencies.length ? Math.min(...latencies) : pick.latency;
  return {
    url,
    state,
    online: state === "online" || state === "unstable",
    latency,
    status: pick.status,
    attempts: 2,
    reason: pick.reason,
    error: pick.error,
    checked_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Token ausente" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Sessão inválida" }, 401);

    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr) {
      console.error("[check-server] role check error", roleErr.message);
      return json({ error: "Erro interno" }, 500);
    }
    if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 401);

    const body = await req.json().catch(() => ({}));
    const rawUrls = (body as { urls?: unknown }).urls;
    if (!Array.isArray(rawUrls)) return json({ error: "urls deve ser um array" }, 400);

    const urls = rawUrls
      .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      .slice(0, 50);

    const results = await Promise.all(urls.map(pingOne));
    return json({ results });
  } catch (e) {
    console.error("[check-server] unhandled", e);
    return json({ error: "Erro interno" }, 500);
  }
});
