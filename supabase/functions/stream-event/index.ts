// Receives client-side stream events (errors, started, etc).
// Auth required (Supabase JWT).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { clientIp, uaHash, urlHash } from "../_shared/stream-token.ts";

const ALLOWED_SUFFIXES = [".lovable.app", ".lovableproject.com", ".lovable.dev"];
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  let allow = "*";
  try {
    const u = new URL(origin);
    if (ALLOWED_SUFFIXES.some((s) => u.hostname.endsWith(s)) || u.hostname === "localhost") {
      allow = origin;
    }
  } catch { /* ignore */ }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const ALLOWED_EVENTS = new Set([
  "stream_started",
  "stream_error",
  "session_heartbeat",
]);

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!auth) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${auth}` } },
    auth: { persistSession: false },
  });
  const { data: udata, error } = await userClient.auth.getUser();
  if (error || !udata?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: { event_type?: string; url?: string; meta?: Record<string, unknown> };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const evType = String(body.event_type || "");
  if (!ALLOWED_EVENTS.has(evType)) {
    return new Response(JSON.stringify({ error: "Invalid event_type" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";

  // Heartbeat: bump active_sessions.last_seen_at — no event row.
  if (evType === "session_heartbeat") {
    await admin.from("active_sessions").update({
      last_seen_at: new Date().toISOString(),
      ip,
      ua_hash: await uaHash(ua),
    }).eq("anon_user_id", udata.user.id);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  await admin.from("stream_events").insert({
    anon_user_id: udata.user.id,
    event_type: evType,
    ip,
    ua_hash: await uaHash(ua),
    url_hash: body.url ? await urlHash(body.url) : null,
    meta: body.meta ?? null,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
});
