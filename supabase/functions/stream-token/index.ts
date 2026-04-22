// Issues short-lived signed tokens for the stream-proxy. Enforces:
// - JWT (anonymous Supabase auth)
// - active block check
// - per-user rate limit (60 tokens/min, 300 segments/min)
// - active session upsert (kills extra sessions over MAX_SESSIONS)
// - logs token_issued / rate_limited / user_blocked events

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import {
  clientIp,
  ipPrefix,
  newNonce,
  signToken,
  uaHash,
  urlHash,
  type TokenKind,
} from "../_shared/stream-token.ts";

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

const MAX_SESSIONS = 2;
const RATE_REQ_PER_MIN = 60;
const RATE_SEG_PER_MIN = 300;
const TTL_PLAYLIST_S = 60;
const TTL_SEGMENT_S = 30;

const PROXY_BASE = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/stream-proxy`;

function json(body: unknown, status: number, cors: Record<string, string>, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...extra },
  });
}

async function logEvent(
  userId: string | null,
  type: string,
  ip: string,
  ua: string,
  url: string | null,
  meta?: Record<string, unknown>,
) {
  try {
    await admin.from("stream_events").insert({
      anon_user_id: userId,
      event_type: type,
      ip,
      ua_hash: await uaHash(ua),
      url_hash: url ? await urlHash(url) : null,
      meta: meta ?? null,
    });
  } catch {
    // never block on logging
  }
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const ua = req.headers.get("user-agent") || "";
  const ip = clientIp(req);

  // 1) Auth
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "Missing token" }, 401, cors);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: udata, error: uerr } = await userClient.auth.getUser();
  if (uerr || !udata?.user) return json({ error: "Invalid session" }, 401, cors);
  const userId = udata.user.id;

  // 2) Body
  let body: { url?: string; kind?: TokenKind; iptv_username?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid body" }, 400, cors);
  }
  const target = (body.url || "").trim();
  const kind: TokenKind = body.kind === "segment" ? "segment" : "playlist";
  if (!target || !/^https?:\/\//i.test(target)) {
    return json({ error: "Invalid url" }, 400, cors);
  }

  // 3) Block check
  const { data: blockRow } = await admin
    .from("user_blocks")
    .select("blocked_until, reason")
    .eq("anon_user_id", userId)
    .maybeSingle();

  if (blockRow && new Date(blockRow.blocked_until).getTime() > Date.now()) {
    await logEvent(userId, "token_rejected", ip, ua, target, { reason: "blocked" });
    return json(
      {
        error: "Acesso temporariamente bloqueado",
        blocked_until: blockRow.blocked_until,
      },
      403,
      cors,
    );
  }

  // 4) Rate limit (UPSERT counter for current minute)
  const now = new Date();
  const winStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0).toISOString();

  const { data: cur } = await admin
    .from("usage_counters")
    .select("request_count, segment_count")
    .eq("anon_user_id", userId)
    .eq("window_start", winStart)
    .maybeSingle();

  const nextReq = (cur?.request_count ?? 0) + 1;
  const nextSeg = (cur?.segment_count ?? 0) + (kind === "segment" ? 1 : 0);

  if (nextReq > RATE_REQ_PER_MIN || nextSeg > RATE_SEG_PER_MIN) {
    await logEvent(userId, "rate_limited", ip, ua, target, { nextReq, nextSeg });

    // Escalating block on repeat offenders (>3 rate_limited in 10min)
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count: viol } = await admin
      .from("stream_events")
      .select("id", { count: "exact", head: true })
      .eq("anon_user_id", userId)
      .eq("event_type", "rate_limited")
      .gte("created_at", since);

    if ((viol ?? 0) > 3) {
      const minutes = (viol ?? 0) > 10 ? 60 : (viol ?? 0) > 6 ? 15 : 5;
      const until = new Date(Date.now() + minutes * 60_000).toISOString();
      await admin.from("user_blocks").upsert(
        { anon_user_id: userId, blocked_until: until, reason: `rate_limit_x${viol}` },
        { onConflict: "anon_user_id" },
      );
      await logEvent(userId, "user_blocked", ip, ua, null, { minutes, reason: "rate_limit" });
    }
    return json({ error: "Too many requests" }, 429, cors, { "Retry-After": "60" });
  }

  await admin.from("usage_counters").upsert(
    { anon_user_id: userId, window_start: winStart, request_count: nextReq, segment_count: nextSeg },
    { onConflict: "anon_user_id,window_start" },
  );

  // Opportunistic cleanup of old counters
  if (Math.random() < 0.05) {
    const cutoff = new Date(Date.now() - 60 * 60_000).toISOString();
    admin.from("usage_counters").delete().lt("window_start", cutoff).then(() => {});
  }

  // 5) Session upsert + enforce MAX_SESSIONS
  const uah = await uaHash(ua);
  const cutoff = new Date(Date.now() - 90_000).toISOString();
  const iptvUser = (body.iptv_username || "").slice(0, 120) || null;

  // Count active sessions for this iptv account (excluding this user)
  if (iptvUser) {
    const { data: actives } = await admin
      .from("active_sessions")
      .select("anon_user_id, last_seen_at, started_at")
      .eq("iptv_username", iptvUser)
      .gt("last_seen_at", cutoff)
      .neq("anon_user_id", userId)
      .order("started_at", { ascending: true });

    const total = (actives?.length ?? 0) + 1;
    if (total > MAX_SESSIONS) {
      const evictCount = total - MAX_SESSIONS;
      const toEvict = (actives ?? []).slice(0, evictCount).map((r) => r.anon_user_id);
      if (toEvict.length > 0) {
        await admin.from("active_sessions").delete().in("anon_user_id", toEvict);
        await logEvent(userId, "session_evicted", ip, ua, null, { evicted: toEvict, iptv_username: iptvUser });
      }
    }
  }

  await admin.from("active_sessions").upsert(
    {
      anon_user_id: userId,
      iptv_username: iptvUser,
      ip,
      ua_hash: uah,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "anon_user_id" },
  );

  // 6) Sign token
  const ttl = kind === "segment" ? TTL_SEGMENT_S : TTL_PLAYLIST_S;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const nonce = newNonce();
  const token = await signToken({
    u: target,
    e: exp,
    s: userId,
    i: ipPrefix(ip),
    h: uah,
    n: nonce,
    k: kind,
  });

  await logEvent(userId, "token_issued", ip, ua, target, { kind });

  const proxied = `${PROXY_BASE}?t=${encodeURIComponent(token)}`;
  return json({ url: proxied, expires_at: exp }, 200, cors);
});
