import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const ALLOWED_SUFFIXES = [".lovable.app", ".lovableproject.com", ".lovable.dev"];
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  let allow = "*";
  try {
    const u = new URL(origin);
    if (
      ALLOWED_SUFFIXES.some((s) => u.hostname.endsWith(s)) ||
      u.hostname === "localhost"
    ) {
      allow = origin;
    }
  } catch {
    // ignore
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

let _admin: any = null;
function getAdmin() {
  if (_admin) return _admin;
  _admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _admin;
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

function pickStr(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}
function pickNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && isFinite(Number(v))) return Number(v);
  return null;
}
function pickInt(v: unknown): number | null {
  const n = pickNum(v);
  return n === null ? null : Math.trunc(n);
}
function pickBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

async function geoLookup(ip: string | null): Promise<{
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
}> {
  const empty = { country: null, region: null, city: null, isp: null };
  if (!ip || ip === "127.0.0.1" || ip.startsWith("10.") || ip.startsWith("192.168.")) return empty;
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 2000);
    // ip-api.com é gratuito e não exige chave (limite ~45 req/min por IP de origem)
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp`, { signal: ctrl.signal });
    clearTimeout(tm);
    if (!res.ok) return empty;
    const j = await res.json();
    if (j?.status !== "success") return empty;
    return {
      country: pickStr(j.country, 80),
      region: pickStr(j.regionName, 80),
      city: pickStr(j.city, 80),
      isp: pickStr(j.isp, 200),
    };
  } catch {
    return empty;
  }
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const ip = clientIp(req);
  const ua = pickStr(req.headers.get("user-agent") ?? "", 500);

  const outcome = pickStr(body?.outcome, 30) ?? "unknown";
  const validOutcomes = new Set(["success", "fail", "timeout", "abort", "unknown"]);
  const finalOutcome = validOutcomes.has(outcome) ? outcome : "unknown";

  const geo = await geoLookup(ip);

  const row = {
    login_event_id: pickStr(body?.login_event_id, 64),
    username: pickStr(body?.username, 200),
    server_url: pickStr(body?.server_url, 500),
    outcome: finalOutcome,
    client_error: pickStr(body?.client_error, 500),
    duration_ms: pickInt(body?.duration_ms),
    ip,
    user_agent: ua,
    effective_type: pickStr(body?.effective_type, 30),
    downlink_mbps: pickNum(body?.downlink_mbps),
    rtt_ms: pickInt(body?.rtt_ms),
    save_data: pickBool(body?.save_data),
    device_memory: pickNum(body?.device_memory),
    hardware_concurrency: pickInt(body?.hardware_concurrency),
    screen: pickStr(body?.screen, 30),
    language: pickStr(body?.language, 30),
    timezone: pickStr(body?.timezone, 80),
    country: geo.country,
    region: geo.region,
    city: geo.city,
    isp: geo.isp,
    speed_kbps: pickInt(body?.speed_kbps),
  };

  try {
    const admin = getAdmin();
    const { data, error } = await admin
      .from("client_diagnostics")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      console.error("[client-diagnostic] insert error", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, id: data?.id ?? null }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[client-diagnostic] fatal", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
