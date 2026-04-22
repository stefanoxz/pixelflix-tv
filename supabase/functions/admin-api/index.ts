import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function unauthorized(msg = "Não autorizado") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function internalError() {
  return new Response(JSON.stringify({ error: "Erro interno" }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeServer(url: string) {
  let u = url.trim().toLowerCase();
  if (!/^https?:\/\//.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, "");
}

function maskIp(ip: string | null | undefined): string {
  if (!ip) return "—";
  const m4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (m4) return `${m4[1]}.${m4[2]}.${m4[3]}.x`;
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":") + ":xxxx";
  }
  return ip;
}

// Mutating actions require explicit admin re-check
const MUTATING_ACTIONS = new Set([
  "allow_server",
  "remove_server",
  "unblock_user",
  "evict_session",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return unauthorized("Token ausente");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return unauthorized("Sessão inválida");
    const user = userData.user;

    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleErr) {
      console.error("[admin-api] role check error", roleErr.message);
      return internalError();
    }
    if (!isAdmin) return unauthorized("Acesso restrito a administradores");

    const body = await req.json().catch(() => ({}));
    const { action, payload } = body as { action?: string; payload?: Record<string, unknown> };

    // Re-check admin role for any mutating action (defence in depth)
    if (action && MUTATING_ACTIONS.has(action)) {
      const { data: stillAdmin } = await admin.rpc("has_role", {
        _user_id: user.id, _role: "admin",
      });
      if (!stillAdmin) return unauthorized("Acesso restrito a administradores");
    }

    if (action === "stats") {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const [eventsTotal, events24h, success24h, fail24h, online1h, distinctUsers, distinctServers, allowed] =
        await Promise.all([
          admin.from("login_events").select("id", { count: "exact", head: true }),
          admin.from("login_events").select("id", { count: "exact", head: true }).gte("created_at", since24h),
          admin.from("login_events").select("id", { count: "exact", head: true }).gte("created_at", since24h).eq("success", true),
          admin.from("login_events").select("id", { count: "exact", head: true }).gte("created_at", since24h).eq("success", false),
          admin.from("login_events").select("username").gte("created_at", since1h).eq("success", true),
          admin.from("login_events").select("username").eq("success", true),
          admin.from("login_events").select("server_url").eq("success", true),
          admin.from("allowed_servers").select("id", { count: "exact", head: true }),
        ]);

      const onlineSet = new Set((online1h.data ?? []).map((r: { username: string }) => r.username));
      const usersSet = new Set((distinctUsers.data ?? []).map((r: { username: string }) => r.username));
      const serversSet = new Set((distinctServers.data ?? []).map((r: { server_url: string }) => r.server_url));

      return ok({
        totalEvents: eventsTotal.count ?? 0,
        events24h: events24h.count ?? 0,
        success24h: success24h.count ?? 0,
        fail24h: fail24h.count ?? 0,
        onlineNow: onlineSet.size,
        totalUsers: usersSet.size,
        totalServers: serversSet.size,
        allowedServers: allowed.count ?? 0,
      });
    }

    if (action === "list_users") {
      const { data, error } = await admin
        .from("login_events")
        .select("username, server_url, created_at, success")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) { console.error(error.message); return internalError(); }

      const map = new Map<string, { username: string; last_server: string; last_login: string; last_success: boolean; total: number }>();
      for (const row of data ?? []) {
        const key = row.username;
        if (!map.has(key)) {
          map.set(key, { username: key, last_server: row.server_url, last_login: row.created_at, last_success: row.success, total: 0 });
        }
        map.get(key)!.total += 1;
      }
      return ok({ users: Array.from(map.values()) });
    }

    if (action === "list_servers") {
      const [{ data: events }, { data: allowed }] = await Promise.all([
        admin.from("login_events").select("server_url, success, created_at, username").order("created_at", { ascending: false }).limit(2000),
        admin.from("allowed_servers").select("id, server_url, label, notes, created_at"),
      ]);

      const stats = new Map<string, { last_seen: string; total_logins: number; success_count: number; fail_count: number; users: Set<string> }>();
      for (const row of events ?? []) {
        const key = row.server_url;
        if (!stats.has(key)) {
          stats.set(key, { last_seen: row.created_at, total_logins: 0, success_count: 0, fail_count: 0, users: new Set<string>() });
        }
        const item = stats.get(key)!;
        item.total_logins += 1;
        if (row.success) item.success_count += 1;
        else item.fail_count += 1;
        item.users.add(row.username);
      }

      const allowedList = (allowed ?? []).map((a: { id: string; server_url: string; label: string | null; notes: string | null; created_at: string }) => {
        const s = stats.get(a.server_url);
        return {
          id: a.id,
          server_url: a.server_url,
          label: a.label,
          notes: a.notes,
          created_at: a.created_at,
          last_seen: s?.last_seen ?? null,
          total_logins: s?.total_logins ?? 0,
          success_count: s?.success_count ?? 0,
          fail_count: s?.fail_count ?? 0,
          unique_users: s?.users?.size ?? 0,
        };
      });

      const allowedSet = new Set((allowed ?? []).map((a: { server_url: string }) => a.server_url));
      const pending = Array.from(stats.entries())
        .filter(([url]) => !allowedSet.has(url))
        .map(([url, s]) => ({
          server_url: url, last_seen: s.last_seen, total_logins: s.total_logins,
          success_count: s.success_count, fail_count: s.fail_count, unique_users: s.users.size,
        }));

      return ok({ allowed: allowedList, pending });
    }

    if (action === "recent_events") {
      const limit = Math.min(Number(payload?.limit ?? 50), 200);
      const { data, error } = await admin
        .from("login_events")
        .select("id, username, server_url, success, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) { console.error(error.message); return internalError(); }
      return ok({ events: data ?? [] });
    }

    if (action === "allow_server") {
      const url = normalizeServer(String(payload?.server_url ?? ""));
      if (!url) return bad("URL do servidor é obrigatória");
      const label = (payload?.label as string | undefined)?.slice(0, 120) ?? null;
      const notes = (payload?.notes as string | undefined)?.slice(0, 500) ?? null;
      const { error } = await admin.from("allowed_servers").upsert(
        { server_url: url, label, notes }, { onConflict: "server_url" });
      if (error) { console.error(error.message); return internalError(); }
      return ok({ ok: true, server_url: url });
    }

    if (action === "remove_server") {
      const url = normalizeServer(String(payload?.server_url ?? ""));
      if (!url) return bad("URL do servidor é obrigatória");
      const { error } = await admin.from("allowed_servers").delete().eq("server_url", url);
      if (error) { console.error(error.message); return internalError(); }
      return ok({ ok: true });
    }

    // ---------- MONITORING ----------
    if (action === "monitoring_overview") {
      const cutoff = new Date(Date.now() - 90_000).toISOString();
      const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

      const [sessions, blocks, recentErrors, topRej] = await Promise.all([
        admin.from("active_sessions").select("anon_user_id, iptv_username, ip, started_at, last_seen_at").gt("last_seen_at", cutoff).order("started_at", { ascending: false }).limit(200),
        admin.from("user_blocks").select("anon_user_id, blocked_until, reason, created_at").gt("blocked_until", new Date().toISOString()).order("blocked_until", { ascending: false }),
        admin.from("stream_events").select("id, anon_user_id, event_type, ip, meta, created_at").gte("created_at", since24h).in("event_type", ["stream_error", "token_rejected", "rate_limited", "user_blocked", "suspicious_pattern"]).order("created_at", { ascending: false }).limit(50),
        admin.from("stream_events").select("ip").eq("event_type", "token_rejected").gte("created_at", since24h),
      ]);

      const sessionsList = (sessions.data ?? []).map((s: { anon_user_id: string; iptv_username: string | null; ip: string | null; started_at: string; last_seen_at: string }) => ({
        anon_user_id: s.anon_user_id,
        iptv_username: s.iptv_username,
        ip_masked: maskIp(s.ip),
        started_at: s.started_at,
        last_seen_at: s.last_seen_at,
        duration_s: Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000),
      }));

      // Top IPs by token_rejected
      const ipCounts = new Map<string, number>();
      for (const r of (topRej.data ?? []) as { ip: string | null }[]) {
        if (!r.ip) continue;
        ipCounts.set(r.ip, (ipCounts.get(r.ip) ?? 0) + 1);
      }
      const topIps = Array.from(ipCounts.entries())
        .map(([ip, count]) => ({ ip_masked: maskIp(ip), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return ok({
        online_now: sessionsList.length,
        active_sessions: sessionsList,
        active_blocks: (blocks.data ?? []).map((b: { anon_user_id: string; blocked_until: string; reason: string | null; created_at: string }) => ({
          anon_user_id: b.anon_user_id,
          blocked_until: b.blocked_until,
          reason: b.reason,
          created_at: b.created_at,
        })),
        recent_errors: (recentErrors.data ?? []).map((e: { id: string; anon_user_id: string | null; event_type: string; ip: string | null; meta: Record<string, unknown> | null; created_at: string }) => ({
          id: e.id,
          anon_user_id: e.anon_user_id,
          event_type: e.event_type,
          ip_masked: maskIp(e.ip),
          meta: e.meta,
          created_at: e.created_at,
        })),
        top_rejected_ips: topIps,
      });
    }

    if (action === "top_consumers") {
      const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      const { data, error } = await admin
        .from("usage_counters")
        .select("anon_user_id, request_count, segment_count")
        .gte("window_start", since24h);
      if (error) { console.error(error.message); return internalError(); }
      const map = new Map<string, { anon_user_id: string; requests: number; segments: number }>();
      for (const row of data ?? []) {
        const key = row.anon_user_id;
        if (!map.has(key)) map.set(key, { anon_user_id: key, requests: 0, segments: 0 });
        const e = map.get(key)!;
        e.requests += row.request_count ?? 0;
        e.segments += row.segment_count ?? 0;
      }
      // Enrich with iptv_username via active_sessions (last known)
      const ids = Array.from(map.keys());
      let nameMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: sess } = await admin
          .from("active_sessions")
          .select("anon_user_id, iptv_username")
          .in("anon_user_id", ids);
        nameMap = new Map((sess ?? []).map((s: { anon_user_id: string; iptv_username: string | null }) => [s.anon_user_id, s.iptv_username || ""]));
      }
      const consumers = Array.from(map.values())
        .map((r) => ({ ...r, iptv_username: nameMap.get(r.anon_user_id) || "" }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 20);
      return ok({ consumers });
    }

    if (action === "unblock_user") {
      const id = String(payload?.anon_user_id ?? "");
      if (!id) return bad("anon_user_id obrigatório");
      const { error } = await admin.from("user_blocks").delete().eq("anon_user_id", id);
      if (error) { console.error(error.message); return internalError(); }
      return ok({ ok: true });
    }

    if (action === "evict_session") {
      const id = String(payload?.anon_user_id ?? "");
      if (!id) return bad("anon_user_id obrigatório");
      const { error } = await admin.from("active_sessions").delete().eq("anon_user_id", id);
      if (error) { console.error(error.message); return internalError(); }
      return ok({ ok: true });
    }

    return bad("Ação inválida");
  } catch (e) {
    console.error("[admin-api] unhandled", e);
    return internalError();
  }
});
