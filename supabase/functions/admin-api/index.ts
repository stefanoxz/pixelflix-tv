import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { proxiedFetch, isProxyEnabled, directFetch, proxyOnlyFetch } from "../_shared/proxied-fetch.ts";

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
  "approve_signup",
  "reject_signup",
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

    // Valida o JWT via getClaims (compatível com o sistema de signing keys
    // do Supabase). getUser() pode falhar 401 mesmo com token válido em
    // alguns boots do worker — getClaims é o caminho oficial.
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(jwt);
    if (claimsErr || !claimsData?.claims?.sub) {
      console.error("[admin-api] claims check failed", claimsErr?.message);
      return unauthorized("Sessão inválida");
    }
    const user = { id: claimsData.claims.sub as string, email: (claimsData.claims.email as string | undefined) ?? null };

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

    if (action === "dashboard_bundle") {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const cutoff = new Date(Date.now() - 90_000).toISOString();
      const eventsLimit = Math.min(Number(payload?.eventsLimit ?? 50), 200);

      const [
        eventsTotal, events24h, success24h, fail24h, online1h, distinctUsers, distinctServers, allowedCount,
        recentUserEvents, serverEvents, allowedRows, brokenEvents, recentEvents, sessions, blocks, recentErrors, topRej,
        usageRows,
      ] = await Promise.all([
        admin.from("login_events").select("id", { count: "exact", head: true }),
        admin.from("login_events").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        admin.from("login_events").select("id", { count: "exact", head: true }).gte("created_at", since24h).eq("success", true),
        admin.from("login_events").select("id", { count: "exact", head: true }).gte("created_at", since24h).eq("success", false),
        admin.from("login_events").select("username").gte("created_at", since1h).eq("success", true),
        admin.from("login_events").select("username").eq("success", true),
        admin.from("login_events").select("server_url").eq("success", true),
        admin.from("allowed_servers").select("id", { count: "exact", head: true }),
        admin.from("login_events").select("username, server_url, created_at, success").order("created_at", { ascending: false }).limit(1000),
        admin.from("login_events").select("server_url, success, created_at, username").order("created_at", { ascending: false }).limit(2000),
        admin.from("allowed_servers").select("id, server_url, label, notes, created_at"),
        admin.from("stream_events").select("meta").eq("event_type", "stream_error").gte("created_at", fiveMinAgo).limit(1000),
        admin.from("login_events").select("id, username, server_url, success, reason, created_at").order("created_at", { ascending: false }).limit(eventsLimit),
        admin.from("active_sessions").select("anon_user_id, iptv_username, ip, started_at, last_seen_at, content_kind, content_title, content_id, content_started_at").gt("last_seen_at", cutoff).order("started_at", { ascending: false }).limit(200),
        admin.from("user_blocks").select("anon_user_id, blocked_until, reason, created_at").gt("blocked_until", new Date().toISOString()).order("blocked_until", { ascending: false }),
        admin.from("stream_events").select("id, anon_user_id, event_type, ip, meta, created_at").gte("created_at", since24h).in("event_type", ["stream_error", "token_rejected", "rate_limited", "user_blocked", "suspicious_pattern"]).order("created_at", { ascending: false }).limit(50),
        admin.from("stream_events").select("ip").eq("event_type", "token_rejected").gte("created_at", since24h),
        admin.from("usage_counters").select("anon_user_id, request_count, segment_count").gte("window_start", since24h),
      ]);

      const queryError = [eventsTotal, events24h, success24h, fail24h, online1h, distinctUsers, distinctServers, allowedCount, recentUserEvents, serverEvents, allowedRows, brokenEvents, recentEvents, sessions, blocks, recentErrors, topRej, usageRows]
        .find((r) => r.error)?.error;
      if (queryError) { console.error(queryError.message); return internalError(); }

      const onlineSet = new Set((online1h.data ?? []).map((r: { username: string }) => r.username));
      const usersSet = new Set((distinctUsers.data ?? []).map((r: { username: string }) => r.username));
      const serversSet = new Set((distinctServers.data ?? []).map((r: { server_url: string }) => r.server_url));

      const usersMap = new Map<string, { username: string; last_server: string; last_login: string; last_success: boolean; total: number }>();
      for (const row of recentUserEvents.data ?? []) {
        const key = row.username;
        if (!usersMap.has(key)) usersMap.set(key, { username: key, last_server: row.server_url, last_login: row.created_at, last_success: row.success, total: 0 });
        usersMap.get(key)!.total += 1;
      }

      const brokenCount = new Map<string, number>();
      for (const row of (brokenEvents.data ?? []) as { meta: Record<string, unknown> | null }[]) {
        const meta = row.meta ?? {};
        if (meta.type !== "stream_no_data") continue;
        const host = typeof meta.host === "string" ? meta.host.toLowerCase() : null;
        if (host) brokenCount.set(host, (brokenCount.get(host) ?? 0) + 1);
      }
      const brokenHosts = new Set(Array.from(brokenCount.entries()).filter(([, n]) => n >= 3).map(([host]) => host));

      const serverStats = new Map<string, { last_seen: string; total_logins: number; success_count: number; fail_count: number; users: Set<string> }>();
      for (const row of serverEvents.data ?? []) {
        const key = row.server_url;
        if (!serverStats.has(key)) serverStats.set(key, { last_seen: row.created_at, total_logins: 0, success_count: 0, fail_count: 0, users: new Set<string>() });
        const item = serverStats.get(key)!;
        item.total_logins += 1;
        if (row.success) item.success_count += 1;
        else item.fail_count += 1;
        item.users.add(row.username);
      }

      const allowedList = (allowedRows.data ?? []).map((a: { id: string; server_url: string; label: string | null; notes: string | null; created_at: string }) => {
        const s = serverStats.get(a.server_url);
        let host: string | null = null;
        try { host = new URL(a.server_url).host.toLowerCase(); } catch { /* noop */ }
        return {
          id: a.id, server_url: a.server_url, label: a.label, notes: a.notes, created_at: a.created_at,
          last_seen: s?.last_seen ?? null, total_logins: s?.total_logins ?? 0, success_count: s?.success_count ?? 0,
          fail_count: s?.fail_count ?? 0, unique_users: s?.users?.size ?? 0, stream_broken: host ? brokenHosts.has(host) : false,
        };
      });
      const allowedSet = new Set((allowedRows.data ?? []).map((a: { server_url: string }) => a.server_url));
      const pending = Array.from(serverStats.entries()).filter(([url]) => !allowedSet.has(url)).map(([url, s]) => ({
        server_url: url, last_seen: s.last_seen, total_logins: s.total_logins, success_count: s.success_count, fail_count: s.fail_count, unique_users: s.users.size,
      }));

      const sessionsList = (sessions.data ?? []).map((s: { anon_user_id: string; iptv_username: string | null; ip: string | null; started_at: string; last_seen_at: string; content_kind: string | null; content_title: string | null; content_id: string | null; content_started_at: string | null }) => ({
        anon_user_id: s.anon_user_id, iptv_username: s.iptv_username, ip_masked: maskIp(s.ip), started_at: s.started_at,
        last_seen_at: s.last_seen_at, duration_s: Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000),
        content_kind: s.content_kind, content_title: s.content_title, content_id: s.content_id, content_started_at: s.content_started_at,
      }));
      const ipCounts = new Map<string, number>();
      for (const r of (topRej.data ?? []) as { ip: string | null }[]) if (r.ip) ipCounts.set(r.ip, (ipCounts.get(r.ip) ?? 0) + 1);

      const usageMap = new Map<string, { anon_user_id: string; requests: number; segments: number }>();
      for (const row of usageRows.data ?? []) {
        const key = row.anon_user_id;
        if (!usageMap.has(key)) usageMap.set(key, { anon_user_id: key, requests: 0, segments: 0 });
        const e = usageMap.get(key)!;
        e.requests += row.request_count ?? 0;
        e.segments += row.segment_count ?? 0;
      }
      const ids = Array.from(usageMap.keys());
      let nameMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: sess } = await admin.from("active_sessions").select("anon_user_id, iptv_username").in("anon_user_id", ids);
        nameMap = new Map((sess ?? []).map((s: { anon_user_id: string; iptv_username: string | null }) => [s.anon_user_id, s.iptv_username || ""]));
      }

      return ok({
        stats: {
          totalEvents: eventsTotal.count ?? 0, events24h: events24h.count ?? 0, success24h: success24h.count ?? 0,
          fail24h: fail24h.count ?? 0, onlineNow: onlineSet.size, totalUsers: usersSet.size,
          totalServers: serversSet.size, allowedServers: allowedCount.count ?? 0,
        },
        users: Array.from(usersMap.values()),
        servers: { allowed: allowedList, pending },
        events: recentEvents.data ?? [],
        monitoring: {
          online_now: sessionsList.length,
          active_sessions: sessionsList,
          active_blocks: (blocks.data ?? []).map((b: { anon_user_id: string; blocked_until: string; reason: string | null; created_at: string }) => ({ anon_user_id: b.anon_user_id, blocked_until: b.blocked_until, reason: b.reason, created_at: b.created_at })),
          recent_errors: (recentErrors.data ?? []).map((e: { id: string; anon_user_id: string | null; event_type: string; ip: string | null; meta: Record<string, unknown> | null; created_at: string }) => ({ id: e.id, anon_user_id: e.anon_user_id, event_type: e.event_type, ip_masked: maskIp(e.ip), meta: e.meta, created_at: e.created_at })),
          top_rejected_ips: Array.from(ipCounts.entries()).map(([ip, count]) => ({ ip_masked: maskIp(ip), count })).sort((a, b) => b.count - a.count).slice(0, 10),
        },
        top_consumers: Array.from(usageMap.values()).map((r) => ({ ...r, iptv_username: nameMap.get(r.anon_user_id) || "" })).sort((a, b) => b.requests - a.requests).slice(0, 20),
      });
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
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const [{ data: events }, { data: allowed }, { data: brokenEvents }] = await Promise.all([
        admin.from("login_events").select("server_url, success, created_at, username").order("created_at", { ascending: false }).limit(2000),
        admin.from("allowed_servers").select("id, server_url, label, notes, created_at"),
        admin.from("stream_events")
          .select("meta")
          .eq("event_type", "stream_error")
          .gte("created_at", fiveMinAgo)
          .limit(1000),
      ]);

      // Hosts com >=3 reports de stream_no_data nos últimos 5 min
      const brokenCount = new Map<string, number>();
      for (const row of (brokenEvents ?? []) as { meta: Record<string, unknown> | null }[]) {
        const meta = row.meta ?? {};
        if (meta.type !== "stream_no_data") continue;
        const host = typeof meta.host === "string" ? meta.host.toLowerCase() : null;
        if (!host) continue;
        brokenCount.set(host, (brokenCount.get(host) ?? 0) + 1);
      }
      const brokenHosts = new Set<string>();
      for (const [host, n] of brokenCount.entries()) {
        if (n >= 3) brokenHosts.add(host);
      }

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
        let host: string | null = null;
        try { host = new URL(a.server_url).host.toLowerCase(); } catch { /* noop */ }
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
          stream_broken: host ? brokenHosts.has(host) : false,
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

    if (action === "list_user_reports") {
      const limit = Math.min(Number(payload?.limit ?? 100), 500);
      const hours = Math.min(Number(payload?.hours ?? 24 * 30), 24 * 90);
      const since = new Date(Date.now() - hours * 60 * 60_000).toISOString();
      const { data, error } = await admin
        .from("stream_events")
        .select("id, anon_user_id, meta, created_at, ip")
        .eq("event_type", "user_report")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) { console.error(error.message); return internalError(); }
      const reports = (data ?? []).map((r) => ({
        id: r.id,
        anon_user_id: r.anon_user_id,
        created_at: r.created_at,
        ip: maskIp(r.ip),
        category: (r.meta as Record<string, unknown> | null)?.category ?? null,
        description: (r.meta as Record<string, unknown> | null)?.description ?? null,
        title: (r.meta as Record<string, unknown> | null)?.title ?? null,
        upstream_host: (r.meta as Record<string, unknown> | null)?.upstream_host ?? null,
        engine: (r.meta as Record<string, unknown> | null)?.engine ?? null,
        load_method: (r.meta as Record<string, unknown> | null)?.load_method ?? null,
        root_cause: (r.meta as Record<string, unknown> | null)?.root_cause ?? null,
        last_reason: (r.meta as Record<string, unknown> | null)?.last_reason ?? null,
        status: (r.meta as Record<string, unknown> | null)?.status ?? null,
        user_agent: (r.meta as Record<string, unknown> | null)?.user_agent ?? null,
        container_ext: (r.meta as Record<string, unknown> | null)?.container_ext ?? null,
      }));
      return ok({ reports });
    }

    if (action === "count_user_reports_24h") {
      const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      const { count, error } = await admin
        .from("stream_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "user_report")
        .gte("created_at", since);
      if (error) { console.error(error.message); return internalError(); }
      return ok({ count: count ?? 0 });
    }

    if (action === "allow_server") {
      const url = normalizeServer(String(payload?.server_url ?? ""));
      if (!url) return bad("URL do servidor é obrigatória");
      const label = (payload?.label as string | undefined)?.slice(0, 120) ?? null;
      const notes = (payload?.notes as string | undefined)?.slice(0, 500) ?? null;

      // Sondagem best-effort: detecta DNS que responde via Cloudflare mas não
      // tem backend Xtream ativo. NUNCA bloqueia o cadastro — só emite warning.
      let warning: string | null = null;
      try {
        const probeUrl = `${url}/player_api.php`;
        const res = await proxiedFetch(probeUrl, {
          method: "HEAD",
          headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
          signal: AbortSignal.timeout(4000),
        });
        const isCf = (res.headers.get("server") ?? "").toLowerCase().includes("cloudflare")
                  || !!res.headers.get("cf-ray");
        if (res.status === 404 && isCf) {
          warning = "Servidor responde via Cloudflare mas /player_api.php retorna 404. Pode estar inativo.";
        }
        try { await res.body?.cancel(); } catch { /* noop */ }
      } catch { /* sondagem é best-effort, ignora falhas */ }

      const { error } = await admin.from("allowed_servers").upsert(
        { server_url: url, label, notes }, { onConflict: "server_url" });
      if (error) { console.error(error.message); return internalError(); }
      return ok({ ok: true, server_url: url, warning });
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
        admin.from("active_sessions").select("anon_user_id, iptv_username, ip, started_at, last_seen_at, content_kind, content_title, content_id, content_started_at").gt("last_seen_at", cutoff).order("started_at", { ascending: false }).limit(200),
        admin.from("user_blocks").select("anon_user_id, blocked_until, reason, created_at").gt("blocked_until", new Date().toISOString()).order("blocked_until", { ascending: false }),
        admin.from("stream_events").select("id, anon_user_id, event_type, ip, meta, created_at").gte("created_at", since24h).in("event_type", ["stream_error", "token_rejected", "rate_limited", "user_blocked", "suspicious_pattern"]).order("created_at", { ascending: false }).limit(50),
        admin.from("stream_events").select("ip").eq("event_type", "token_rejected").gte("created_at", since24h),
      ]);

      const sessionsList = (sessions.data ?? []).map((s: { anon_user_id: string; iptv_username: string | null; ip: string | null; started_at: string; last_seen_at: string; content_kind: string | null; content_title: string | null; content_id: string | null; content_started_at: string | null }) => ({
        anon_user_id: s.anon_user_id,
        iptv_username: s.iptv_username,
        ip_masked: maskIp(s.ip),
        started_at: s.started_at,
        last_seen_at: s.last_seen_at,
        duration_s: Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000),
        content_kind: s.content_kind,
        content_title: s.content_title,
        content_id: s.content_id,
        content_started_at: s.content_started_at,
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

    // ---------- DNS ERROR ANALYTICS ----------
    if (action === "dns_errors") {
      const hours = Math.min(Math.max(Number(payload?.hours ?? 24), 1), 168);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const { data, error } = await admin
        .from("login_events")
        .select("server_url, success, reason, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) { console.error(error.message); return internalError(); }

      type Bucket =
        | "refused"
        | "reset"
        | "http_404"
        | "http_444"
        | "http_5xx"
        | "tls"
        | "cert_invalid"
        | "timeout"
        | "io_timeout"
        | "dns"
        | "no_route"
        | "net_unreach"
        | "protocol"
        | "other";
      const classify = (reason: string | null): Bucket | null => {
        if (!reason) return "other";
        const r = reason.toLowerCase();

        // HTTP status buckets first (most specific)
        if (/http\s*404|not found/.test(r)) return "http_404";
        if (/http\s*444/.test(r)) return "http_444";
        if (/http\s*5\d\d|bad gateway|gateway timeout|service unavailable/.test(r)) return "http_5xx";

        // Connection-level errors
        if (/connection refused|os error 111|econnrefused/.test(r)) return "refused";
        if (/reset by peer|connection reset|os error 104|econnreset/.test(r)) return "reset";

        // Routing / network reachability
        if (/no route to host|ehostunreach|os error 113/.test(r)) return "no_route";
        if (/network is unreachable|enetunreach|os error 101/.test(r)) return "net_unreach";

        // Certificate / TLS
        if (/certificate verify failed|cert.*(expired|invalid|untrusted|unknown)|self.signed|x509|hostname mismatch|certificateerror/.test(r)) return "cert_invalid";
        if (/tls|ssl|handshake|unrecognisedname|alert|wrong version number/.test(r)) return "tls";

        // Protocol / parse
        if (/invalid (status line|http response|chunked|content-length)|protocol error|malformed|unexpected eof|http parse/.test(r)) return "protocol";

        // Timeouts (IO vs generic)
        if (/i\/o timeout|read timeout|write timeout|recv timeout|send timeout|socket timeout/.test(r)) return "io_timeout";
        if (/timeout|timed out|deadline/.test(r)) return "timeout";

        // DNS resolution
        if (/dns|name resolution|getaddrinfo|nodename|no address|enotfound|name or service not known/.test(r)) return "dns";

        // Fallback heuristics
        if (/não respondeu|server unreachable|unreach/.test(r)) return "refused";
        return "other";
      };

      type Agg = {
        server_url: string;
        total: number;
        success: number;
        fail: number;
        last_seen: string | null;
        last_error: string | null;
        last_error_at: string | null;
        buckets: Record<Bucket, number>;
      };
      const map = new Map<string, Agg>();
      const buckets0 = (): Record<Bucket, number> => ({
        refused: 0, reset: 0, http_404: 0, http_444: 0, http_5xx: 0,
        tls: 0, cert_invalid: 0, timeout: 0, io_timeout: 0,
        dns: 0, no_route: 0, net_unreach: 0, protocol: 0, other: 0,
      });

      for (const row of (data ?? []) as { server_url: string; success: boolean; reason: string | null; created_at: string }[]) {
        if (!map.has(row.server_url)) {
          map.set(row.server_url, {
            server_url: row.server_url,
            total: 0, success: 0, fail: 0,
            last_seen: row.created_at,
            last_error: null,
            last_error_at: null,
            buckets: buckets0(),
          });
        }
        const a = map.get(row.server_url)!;
        a.total += 1;
        if (row.success) a.success += 1;
        else {
          a.fail += 1;
          const b = classify(row.reason);
          if (b) a.buckets[b] += 1;
          if (!a.last_error) {
            a.last_error = row.reason;
            a.last_error_at = row.created_at;
          }
        }
      }

      // Totals across all servers
      const totals = {
        total: 0, success: 0, fail: 0,
        buckets: buckets0(),
      };
      for (const a of map.values()) {
        totals.total += a.total;
        totals.success += a.success;
        totals.fail += a.fail;
        for (const k of Object.keys(a.buckets) as Bucket[]) {
          totals.buckets[k] += a.buckets[k];
        }
      }

      const servers = Array.from(map.values()).sort((a, b) => b.fail - a.fail);

      // ---- Time series ----
      const stepMs = hours <= 6 ? 15 * 60_000
        : hours <= 24 ? 60 * 60_000
        : hours <= 72 ? 3 * 60 * 60_000
        : 6 * 60 * 60_000;

      const sinceMs = Date.now() - hours * 60 * 60_000;
      const startMs = Math.floor(sinceMs / stepMs) * stepMs;
      const endMs = Math.ceil(Date.now() / stepMs) * stepMs;
      const slots: number[] = [];
      for (let t = startMs; t <= endMs; t += stepMs) slots.push(t);

      type SeriesPoint = {
        t: string;
        total: number;
        success: number;
        fail: number;
      } & Record<Bucket, number>;

      const emptyPoint = (t: number): SeriesPoint => ({
        t: new Date(t).toISOString(),
        total: 0, success: 0, fail: 0,
        refused: 0, reset: 0, http_404: 0, http_444: 0, http_5xx: 0,
        tls: 0, cert_invalid: 0, timeout: 0, io_timeout: 0,
        dns: 0, no_route: 0, net_unreach: 0, protocol: 0, other: 0,
      } as SeriesPoint);

      const globalSeries: SeriesPoint[] = slots.map(emptyPoint);
      const slotIndex = (ts: string) => {
        const ms = Date.parse(ts);
        if (isNaN(ms)) return -1;
        const idx = Math.floor((ms - startMs) / stepMs);
        return idx >= 0 && idx < globalSeries.length ? idx : -1;
      };

      const topServers = [...map.values()]
        .sort((a, b) => b.total - a.total)
        .slice(0, 6)
        .map((s) => s.server_url);
      const perServer = new Map<string, SeriesPoint[]>(
        topServers.map((u) => [u, slots.map(emptyPoint)]),
      );

      for (const row of (data ?? []) as { server_url: string; success: boolean; reason: string | null; created_at: string }[]) {
        const idx = slotIndex(row.created_at);
        if (idx < 0) continue;
        const g = globalSeries[idx];
        g.total += 1;
        if (row.success) g.success += 1;
        else {
          g.fail += 1;
          const b = classify(row.reason);
          if (b) g[b] += 1;
        }
        const ps = perServer.get(row.server_url);
        if (ps) {
          const p = ps[idx];
          p.total += 1;
          if (row.success) p.success += 1;
          else {
            p.fail += 1;
            const b = classify(row.reason);
            if (b) p[b] += 1;
          }
        }
      }

      const perServerSeries = topServers.map((u) => ({
        server_url: u,
        points: perServer.get(u)!,
      }));

      return ok({
        since,
        hours,
        step_ms: stepMs,
        totals,
        servers,
        series: globalSeries,
        per_server_series: perServerSeries,
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

    // ---------- PENDING ADMIN SIGNUPS ----------
    if (action === "list_pending_signups") {
      const { data, error } = await admin
        .from("pending_admin_signups")
        .select("user_id, email, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) { console.error(error.message); return internalError(); }
      return ok({ pending: data ?? [] });
    }

    if (action === "approve_signup") {
      const id = String(payload?.user_id ?? "");
      if (!id) return bad("user_id obrigatório");
      const { error: roleErr } = await admin
        .from("user_roles")
        .insert({ user_id: id, role: "admin" });
      if (roleErr && !roleErr.message.includes("duplicate")) {
        console.error(roleErr.message); return internalError();
      }
      const { error: delErr } = await admin
        .from("pending_admin_signups").delete().eq("user_id", id);
      if (delErr) { console.error(delErr.message); return internalError(); }
      return ok({ ok: true });
    }

    if (action === "reject_signup") {
      const id = String(payload?.user_id ?? "");
      if (!id) return bad("user_id obrigatório");
      const { error: authErr } = await admin.auth.admin.deleteUser(id);
      if (authErr) {
        console.error("[admin-api] deleteUser failed", authErr.message);
        return internalError();
      }
      // Trigger ON DELETE CASCADE não cobre pending (sem FK), limpa manualmente.
      await admin.from("pending_admin_signups").delete().eq("user_id", id);
      return ok({ ok: true });
    }

    // Tenta MULTIPLAS variantes (porta + protocolo) contra o player_api de
    // um servidor IPTV e devolve o resultado de cada uma. Não exige
    // credenciais válidas — só queremos saber qual variante responde TCP +
    // HTTP. 401 conta como "servidor vivo, credencial inválida".
    if (action === "probe_server") {
      const rawUrl = String(payload?.server_url ?? "").trim();
      if (!rawUrl) return bad("server_url obrigatório");

      const stripped = rawUrl.replace(/\/+$/, "");
      const m = stripped.match(/^(https?):\/\/(.+)$/i);
      const originalScheme = (m?.[1]?.toLowerCase() as "http" | "https" | undefined) ?? null;
      const hostPort = (m?.[2] ?? stripped).replace(/\s+/g, "");
      if (!hostPort) return bad("URL inválida");

      const hasPort = /:\d+$/.test(hostPort);
      const host = hasPort ? hostPort.replace(/:\d+$/, "") : hostPort;

      // Lista completa de variantes para diagnóstico (mais ampla que o
      // login real — aqui queremos saber TUDO).
      const primary = originalScheme ?? "http";
      const secondary = primary === "http" ? "https" : "http";
      const candidatesSet = new Set<string>();
      candidatesSet.add(`${primary}://${hostPort}`);
      if (!hasPort) {
        if (primary === "http") {
          candidatesSet.add(`http://${host}:80`);
          candidatesSet.add(`http://${host}:8080`);
        } else {
          candidatesSet.add(`https://${host}:443`);
        }
      }
      candidatesSet.add(`${secondary}://${hostPort}`);
      if (!hasPort) {
        if (secondary === "http") {
          candidatesSet.add(`http://${host}:80`);
          candidatesSet.add(`http://${host}:8080`);
        } else {
          candidatesSet.add(`https://${host}:443`);
        }
        // Portas IPTV exóticas (no esquema primário)
        for (const p of [2052, 2082, 2095, 8880]) {
          candidatesSet.add(`${primary}://${host}:${p}`);
        }
      }

      const variants = [...candidatesSet];
      const PROBE_TIMEOUT_MS = 4000;
      const PROBE_UA = "VLC/3.0.20 LibVLC/3.0.20";

      const results = await Promise.all(
        variants.map(async (base) => {
          const url = `${base}/player_api.php?username=probe&password=probe`;
          const startedAt = Date.now();
          try {
            const res = await fetch(url, {
              headers: { "User-Agent": PROBE_UA, Accept: "application/json, */*" },
              redirect: "follow",
              signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
            });
            const body = await res.text();
            const elapsed = Date.now() - startedAt;
            // Tenta parsear como JSON Xtream — se vier user_info é um IPTV real.
            let isXtream = false;
            let authValue: number | string | null = null;
            try {
              const parsed = JSON.parse(body);
              if (parsed?.user_info) {
                isXtream = true;
                authValue = parsed.user_info.auth ?? null;
              }
            } catch { /* não é JSON */ }
            return {
              variant: base,
              ok: res.ok,
              status: res.status,
              latency_ms: elapsed,
              is_xtream: isXtream,
              auth: authValue,
              body_preview: body.slice(0, 200),
              error: null as string | null,
            };
          } catch (err) {
            const elapsed = Date.now() - startedAt;
            const msg = err instanceof Error ? err.message : String(err);
            return {
              variant: base,
              ok: false,
              status: null as number | null,
              latency_ms: elapsed,
              is_xtream: false,
              auth: null as number | string | null,
              body_preview: "",
              error: msg,
            };
          }
        }),
      );

      // Resumo: a "melhor" variante é a que teve status 2xx OU 401 (servidor
      // vivo) e respondeu como Xtream — ou, no pior caso, qualquer status HTTP.
      const working = results.find((r) => r.is_xtream) ??
        results.find((r) => r.status === 401) ??
        results.find((r) => r.status && r.status >= 200 && r.status < 500) ??
        null;

      return ok({
        server_url: rawUrl,
        normalized: normalizeServer(rawUrl),
        tested_variants: variants.length,
        timeout_ms: PROBE_TIMEOUT_MS,
        best_variant: working?.variant ?? null,
        best_status: working?.status ?? null,
        results,
      });
    }

    // ---------- TEST ENDPOINT (admin diagnostics) ----------
    // Faz UMA requisição contra um endpoint IPTV usando o pipeline real
    // (proxiedFetch com fallback automático direto → proxy) e devolve qual
    // rota foi efetivamente usada + status HTTP + preview do corpo.
    //
    // payload: {
    //   server_url: string;          // ex: "http://bkpac.cc:80"
    //   path?: string;               // default: "/player_api.php"
    //   username?: string;           // se vier, anexa ?username=..&password=..
    //   password?: string;
    //   method?: "GET" | "HEAD";     // default GET
    //   timeout_ms?: number;         // default 5000
    // }
    if (action === "test_endpoint") {
      const rawUrl = String(payload?.server_url ?? "").trim();
      if (!rawUrl) return bad("server_url obrigatório");
      const path = String(payload?.path ?? "/player_api.php").trim() || "/player_api.php";
      const username = payload?.username ? String(payload.username) : "";
      const password = payload?.password ? String(payload.password) : "";
      const method = (String(payload?.method ?? "GET").toUpperCase() === "HEAD") ? "HEAD" : "GET";
      const mode = String(payload?.mode ?? "full").toLowerCase() === "quick" ? "quick" : "full";
      const testStream = payload?.test_stream === undefined ? Boolean(username && password) : Boolean(payload.test_stream);
      const compareRoutes = payload?.compare_routes === undefined ? true : Boolean(payload.compare_routes);
      const timeoutMs = Math.min(15_000, Math.max(1_000, Number(payload?.timeout_ms ?? 8000)));

      const base = rawUrl.replace(/\/+$/, "");
      const fullPath = path.startsWith("/") ? path : `/${path}`;
      let target = `${base}${fullPath}`;
      if (username || password) {
        const sep = target.includes("?") ? "&" : "?";
        target += `${sep}username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      }

      const TEST_UA = "VLC/3.0.20 LibVLC/3.0.20";
      const HEADERS_OF_INTEREST = ["server", "content-type", "content-length", "cf-ray", "via", "x-cache", "x-powered-by", "location", "date"];

      const pickHeaders = (h: Headers) => {
        const out: Record<string, string> = {};
        for (const k of HEADERS_OF_INTEREST) {
          const v = h.get(k);
          if (v) out[k] = v.length > 200 ? v.slice(0, 200) + "…" : v;
        }
        return out;
      };

      const maskCreds = (u: string) =>
        u.replace(/([?&])(username|password)=[^&]*/gi, "$1$2=***");

      type ProbeResult = {
        name: string;
        url: string;
        method: "GET" | "HEAD";
        route: "direct" | "proxy" | null;
        status: number | null;
        status_text: string | null;
        latency_ms: number;
        headers: Record<string, string>;
        body_size: number;
        body_preview: string;
        error: string | null;
        meta?: Record<string, unknown>;
      };

      const runProbe = async (
        name: string,
        url: string,
        opts: { method?: "GET" | "HEAD"; timeout?: number; capturePreview?: boolean } = {},
      ): Promise<ProbeResult> => {
        const m: "GET" | "HEAD" = opts.method ?? "GET";
        const startedAt = Date.now();
        try {
          const res = await proxiedFetch(url, {
            method: m,
            headers: { "User-Agent": TEST_UA, Accept: "application/json, */*" },
            redirect: "follow",
            signal: AbortSignal.timeout(opts.timeout ?? timeoutMs),
          });
          // @ts-ignore - tag injetada por proxiedFetch
          const route: "direct" | "proxy" = (res as Response & { _iptvRoute?: "direct" | "proxy" })._iptvRoute ?? "direct";
          let body = "";
          let size = 0;
          if (m !== "HEAD") {
            body = await res.text();
            size = body.length;
          } else {
            const cl = Number(res.headers.get("content-length"));
            size = Number.isFinite(cl) ? cl : 0;
            // consome para evitar leak
            try { await res.body?.cancel(); } catch { /* noop */ }
          }
          return {
            name,
            url: maskCreds(url),
            method: m,
            route,
            status: res.status,
            status_text: res.statusText,
            latency_ms: Date.now() - startedAt,
            headers: pickHeaders(res.headers),
            body_size: size,
            body_preview: opts.capturePreview ? body.slice(0, 500) : "",
            error: null,
          };
        } catch (err) {
          return {
            name,
            url: maskCreds(url),
            method: m,
            route: null,
            status: null,
            status_text: null,
            latency_ms: Date.now() - startedAt,
            headers: {},
            body_size: 0,
            body_preview: "",
            error: err instanceof Error ? err.message : String(err),
          };
        }
      };

      const probes: ProbeResult[] = [];

      // 1) Probe raiz (TTFB básico, headers do servidor)
      const rootProbe = await runProbe("root", `${base}/`, { method: "HEAD", timeout: Math.min(timeoutMs, 5000) });
      probes.push(rootProbe);

      // 2) Probe principal (auth)
      const authProbe = await runProbe("auth", target, { method, capturePreview: true });
      probes.push(authProbe);

      // Parse Xtream do auth probe
      let xtream: {
        auth: number | string | null;
        status: string | null;
        exp_date: string | null;
        active_cons: number | null;
        max_connections: number | null;
        created_at: string | null;
        is_trial: string | null;
        username: string | null;
      } | null = null;

      if (authProbe.body_preview) {
        try {
          const parsed = JSON.parse(authProbe.body_preview.length >= 500
            ? (await (async () => {
                // re-fetch corpo completo se preview foi truncado
                try {
                  const r2 = await proxiedFetch(target, {
                    method: "GET",
                    headers: { "User-Agent": TEST_UA, Accept: "application/json, */*" },
                    redirect: "follow",
                    signal: AbortSignal.timeout(timeoutMs),
                  });
                  return await r2.text();
                } catch { return authProbe.body_preview; }
              })())
            : authProbe.body_preview);
          if (parsed?.user_info) {
            const ui = parsed.user_info;
            xtream = {
              auth: ui.auth ?? null,
              status: ui.status ?? null,
              exp_date: ui.exp_date ?? null,
              active_cons: ui.active_cons != null ? Number(ui.active_cons) : null,
              max_connections: ui.max_connections != null ? Number(ui.max_connections) : null,
              created_at: ui.created_at ?? null,
              is_trial: ui.is_trial ?? null,
              username: ui.username ?? null,
            };
            authProbe.meta = { xtream };
          }
        } catch { /* não é JSON */ }
      }

      const xtreamAuthOk = xtream?.auth === 1 || xtream?.auth === "1";

      // 3) Bateria full: categorias em paralelo
      if (mode === "full" && username && password) {
        const buildXtreamUrl = (action: string) =>
          `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${action}`;

        const catActions: Array<["live_categories" | "vod_categories" | "series_categories", string]> = [
          ["live_categories", "get_live_categories"],
          ["vod_categories", "get_vod_categories"],
          ["series_categories", "get_series_categories"],
        ];

        const catResults = await Promise.all(
          catActions.map(([name, act]) => runProbe(name, buildXtreamUrl(act), { method: "GET", capturePreview: true })),
        );

        // anota count de itens
        for (const r of catResults) {
          if (r.body_preview) {
            try {
              const arr = JSON.parse(r.body_preview);
              if (Array.isArray(arr)) r.meta = { count: arr.length };
            } catch { /* não é JSON */ }
          }
          // limpa preview pesado
          r.body_preview = r.body_preview.slice(0, 200);
          probes.push(r);
        }

        // 4) Probe de stream — só se auth ok e flag ligada
        if (testStream && xtreamAuthOk) {
          try {
            // pega 1ª categoria live
            const liveCatProbe = catResults.find((r) => r.name === "live_categories");
            let categoryId: string | null = null;
            if (liveCatProbe && liveCatProbe.status === 200) {
              const r = await proxiedFetch(buildXtreamUrl("get_live_categories"), {
                method: "GET",
                headers: { "User-Agent": TEST_UA, Accept: "application/json, */*" },
                signal: AbortSignal.timeout(timeoutMs),
              });
              const arr = await r.json().catch(() => null);
              if (Array.isArray(arr) && arr.length > 0) {
                categoryId = String(arr[0].category_id ?? arr[0].categoryId ?? "");
              }
            }

            if (categoryId) {
              const streamsUrl = `${buildXtreamUrl("get_live_streams")}&category_id=${encodeURIComponent(categoryId)}`;
              const sr = await proxiedFetch(streamsUrl, {
                method: "GET",
                headers: { "User-Agent": TEST_UA, Accept: "application/json, */*" },
                signal: AbortSignal.timeout(timeoutMs),
              });
              const streams = await sr.json().catch(() => null);
              if (Array.isArray(streams) && streams.length > 0) {
                const streamId = String(streams[0].stream_id ?? streams[0].streamId ?? "");
                if (streamId) {
                  const streamUrl = `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(streamId)}.ts`;
                  const streamProbe = await runProbe("stream_head", streamUrl, { method: "HEAD", timeout: Math.min(timeoutMs, 6000) });
                  streamProbe.meta = { ...(streamProbe.meta ?? {}), category_id: categoryId, stream_id: streamId };
                  probes.push(streamProbe);
                }
              }
            }
          } catch (err) {
            probes.push({
              name: "stream_head",
              url: "—",
              method: "HEAD",
              route: null,
              status: null,
              status_text: null,
              latency_ms: 0,
              headers: {},
              body_size: 0,
              body_preview: "",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      // 5) Comparativo direto vs proxy (paralelo) sobre player_api.php
      let route_comparison: {
        direct: { status: number | null; latency_ms: number; error: string | null };
        proxy: { status: number | null; latency_ms: number; error: string | null } | null;
      } | null = null;

      if (compareRoutes && isProxyEnabled()) {
        const compareUrl = target;
        const tDirect = Date.now();
        const tProxy = Date.now();
        const [dRes, pRes] = await Promise.all([
          directFetch(compareUrl, {
            method: "HEAD",
            headers: { "User-Agent": TEST_UA },
            redirect: "follow",
            signal: AbortSignal.timeout(Math.min(timeoutMs, 6000)),
          }).then((r) => ({ status: r.status, error: null as string | null, ts: Date.now() - tDirect, body: r.body }))
            .catch((e) => ({ status: null as number | null, error: e instanceof Error ? e.message : String(e), ts: Date.now() - tDirect, body: null })),
          proxyOnlyFetch(compareUrl, {
            method: "HEAD",
            headers: { "User-Agent": TEST_UA },
            redirect: "follow",
            signal: AbortSignal.timeout(Math.min(timeoutMs, 6000)),
          }).then((r) => r ? ({ status: r.status, error: null as string | null, ts: Date.now() - tProxy, body: r.body }) : null)
            .catch((e) => ({ status: null as number | null, error: e instanceof Error ? e.message : String(e), ts: Date.now() - tProxy, body: null })),
        ]);
        // consome bodies para evitar leak
        try { await dRes?.body?.cancel?.(); } catch { /* noop */ }
        try { await pRes?.body?.cancel?.(); } catch { /* noop */ }
        route_comparison = {
          direct: { status: dRes?.status ?? null, latency_ms: dRes?.ts ?? 0, error: dRes?.error ?? null },
          proxy: pRes ? { status: pRes.status, latency_ms: pRes.ts, error: pRes.error } : null,
        };
      }

      // 6) Veredito
      type Verdict = { level: "ok" | "warn" | "error"; code: string; message: string };
      const verdict: Verdict = (() => {
        const allFailed = probes.every((p) => p.status === null);
        if (allFailed) {
          const directDead = route_comparison?.direct?.status === null && route_comparison?.direct?.error;
          const proxyAlive = route_comparison?.proxy?.status && route_comparison.proxy.status < 500;
          if (directDead && proxyAlive) {
            return { level: "warn", code: "geo_blocked", message: "Rota direta falhou mas o proxy responde — provável bloqueio geográfico no servidor." };
          }
          return { level: "error", code: "offline", message: "Servidor não respondeu em nenhuma sonda. Verifique se a DNS está no ar." };
        }

        // Geo-block detectado mesmo com sondas parciais
        if (route_comparison?.direct?.error && route_comparison.proxy && route_comparison.proxy.status && route_comparison.proxy.status < 500) {
          return { level: "warn", code: "geo_blocked", message: "Direto falhou e proxy passou — bloqueio geográfico provável." };
        }

        if (xtream) {
          if (!xtreamAuthOk) {
            return { level: "error", code: "bad_credentials", message: "Servidor respondeu mas as credenciais foram rejeitadas (auth=0)." };
          }
          // Status da conta
          const st = (xtream.status ?? "").toLowerCase();
          if (st && st !== "active") {
            return { level: "error", code: "account_inactive", message: `Conta Xtream com status "${xtream.status}".` };
          }
          // Expiração
          if (xtream.exp_date) {
            const expMs = Number(xtream.exp_date) * 1000;
            if (Number.isFinite(expMs) && expMs < Date.now()) {
              return { level: "error", code: "account_expired", message: "Conta Xtream expirada." };
            }
          }
          // Stream falhou mas auth ok
          const sp = probes.find((p) => p.name === "stream_head");
          if (sp && (sp.status === null || (sp.status !== null && sp.status >= 400))) {
            return { level: "warn", code: "stream_failed", message: `Auth ok, mas a entrega de stream falhou (${sp.status ?? sp.error ?? "sem resposta"}). Servidor pode estar saturado.` };
          }
          return { level: "ok", code: "healthy", message: "Servidor saudável: API Xtream e stream respondendo." };
        }

        // Sem Xtream parsing — usa só HTTP
        const ap = probes.find((p) => p.name === "auth");
        if (ap?.status && ap.status >= 200 && ap.status < 300) {
          return { level: "ok", code: "http_ok", message: `Endpoint respondeu HTTP ${ap.status} em ${ap.latency_ms}ms.` };
        }
        if (ap?.status === 401) {
          return { level: "warn", code: "http_401", message: "Servidor vivo, mas exige autenticação (401). Informe usuário/senha para testar Xtream." };
        }
        if (ap?.status && ap.status >= 500) {
          return { level: "error", code: "http_5xx", message: `Servidor com erro interno (HTTP ${ap.status}).` };
        }
        if (ap?.error) {
          return { level: "error", code: "network", message: `Falha de rede: ${ap.error}` };
        }
        return { level: "warn", code: "unknown", message: "Não foi possível determinar saúde com certeza." };
      })();

      // Heurística adicional (NÃO substitui o verdict): Cloudflare na frente
      // + 404 em todas as sondas + nenhum payload Xtream = origin desligado.
      let extra_warning: { code: string; message: string } | null = null;
      const cfMarker = probes.some((p) =>
        ((p.headers.server ?? p.headers.Server ?? "") as string).toLowerCase().includes("cloudflare") ||
        Boolean(p.headers["cf-ray"] ?? p.headers["CF-RAY"])
      );
      const httpProbes = probes.filter((p) => p.status !== null);
      const all404 = httpProbes.length > 0 && httpProbes.every((p) => p.status === 404);
      const noXtreamPayload = !xtream && probes.every((p) => !(p.body_preview ?? "").includes("user_info"));
      if (cfMarker && all404 && noXtreamPayload) {
        extra_warning = {
          code: "origin_suspect",
          message:
            "Servidor responde via Cloudflare mas todas as rotas Xtream retornam 404. " +
            "O backend IPTV provavelmente foi desligado/removido. Solicite uma DNS atualizada ao provedor.",
        };
      }

      // Resposta retro-compatível: campos antigos + novos
      const primary = probes.find((p) => p.name === "auth")!;
      return ok({
        // Campos legados (mantidos para retrocompatibilidade)
        target,
        method,
        route: primary.route,
        proxy_configured: isProxyEnabled(),
        ok: primary.status !== null && primary.status >= 200 && primary.status < 300,
        status: primary.status,
        status_text: primary.status_text,
        latency_ms: primary.latency_ms,
        is_xtream: !!xtream,
        auth: xtream?.auth ?? null,
        body_preview: primary.body_preview,
        error: primary.error,
        // Campos novos
        mode,
        verdict,
        xtream,
        probes,
        route_comparison,
        extra_warning,
      });
    }

    // Tenta resolver automaticamente uma falha de comunicação testando variantes
    // (esquema http/https, portas comuns, com/sem credenciais e via proxy).
    if (action === "resolve_endpoint") {
      const rawUrl = String(payload?.server_url ?? "").trim();
      if (!rawUrl) return bad("server_url obrigatório");
      const username = payload?.username ? String(payload.username) : "";
      const password = payload?.password ? String(payload.password) : "";
      const failureCode = String(payload?.failure_code ?? "").trim();
      const TEST_UA = "VLC/3.0.20 LibVLC/3.0.20";
      const PER_PROBE_TIMEOUT = 2500;
      const GLOBAL_BUDGET_MS = 18000;
      const startedAt = Date.now();
      const remaining = () => Math.max(0, GLOBAL_BUDGET_MS - (Date.now() - startedAt));

      // 1) Parse base
      let parsed: URL | null = null;
      try {
        const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`;
        parsed = new URL(withProto);
      } catch {
        return bad("URL inválida");
      }

      // 2) Gera variantes (host fixo, varia esquema/porta)
      const host = parsed.hostname;
      const originalScheme = parsed.protocol.replace(":", "") as "http" | "https";
      const originalPort = parsed.port || (originalScheme === "https" ? "443" : "80");

      // Conjunto reduzido para não saturar o worker em hosts inalcançáveis
      const HTTP_PORTS = ["80", "8080", "8000"];
      const HTTPS_PORTS = ["443", "8443"];

      const variants: { scheme: "http" | "https"; port: string; base: string; label: string }[] = [];
      const seen = new Set<string>();
      const push = (scheme: "http" | "https", port: string, label: string) => {
        const key = `${scheme}://${host}:${port}`;
        if (seen.has(key)) return;
        seen.add(key);
        const isDefault = (scheme === "http" && port === "80") || (scheme === "https" && port === "443");
        const base = isDefault ? `${scheme}://${host}` : `${scheme}://${host}:${port}`;
        variants.push({ scheme, port, base, label });
      };

      // ordem: original primeiro, depois alternativas razoáveis
      push(originalScheme, originalPort, "original");
      const otherScheme = originalScheme === "http" ? "https" : "http";
      push(otherScheme, originalPort, "troca-esquema");
      for (const p of HTTP_PORTS) push("http", p, `http:${p}`);
      for (const p of HTTPS_PORTS) push("https", p, `https:${p}`);

      // limita custo: máx 7 variantes
      const limited = variants.slice(0, 7);

      type VariantResult = {
        base: string;
        scheme: "http" | "https";
        port: string;
        label: string;
        status: number | null;
        latency_ms: number;
        route: "direct" | "proxy" | null;
        is_xtream: boolean;
        xtream_auth: number | string | null;
        xtream_status: string | null;
        error: string | null;
      };

      const probeVariant = async (v: { scheme: "http" | "https"; port: string; base: string; label: string }): Promise<VariantResult> => {
        let url = `${v.base}/player_api.php`;
        if (username || password) {
          url += `?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        }
        const t0 = Date.now();
        const probeTimeout = Math.min(PER_PROBE_TIMEOUT, Math.max(800, remaining()));
        try {
          const res = await proxiedFetch(url, {
            method: "GET",
            headers: { "User-Agent": TEST_UA, Accept: "application/json, */*" },
            redirect: "follow",
            signal: AbortSignal.timeout(probeTimeout),
          });
          // @ts-ignore tag
          const route = (res as Response & { _iptvRoute?: "direct" | "proxy" })._iptvRoute ?? "direct";
          const text = await res.text();
          let isXtream = false;
          let xAuth: number | string | null = null;
          let xStatus: string | null = null;
          try {
            const j = JSON.parse(text);
            if (j?.user_info) {
              isXtream = true;
              xAuth = j.user_info.auth ?? null;
              xStatus = j.user_info.status ?? null;
            }
          } catch { /* not json */ }
          return {
            base: v.base,
            scheme: v.scheme,
            port: v.port,
            label: v.label,
            status: res.status,
            latency_ms: Date.now() - t0,
            route,
            is_xtream: isXtream,
            xtream_auth: xAuth,
            xtream_status: xStatus,
            error: null,
          };
        } catch (err) {
          return {
            base: v.base,
            scheme: v.scheme,
            port: v.port,
            label: v.label,
            status: null,
            latency_ms: Date.now() - t0,
            route: null,
            is_xtream: false,
            xtream_auth: null,
            xtream_status: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      };

      // Roda serial: paralelizar muitos probes em hosts inalcançáveis (TCP reset)
      // satura sockets do worker e dispara SUPABASE_EDGE_RUNTIME_ERROR (503).
      // Aborta o restante quando o orçamento global se esgota.
      const results: VariantResult[] = [];
      let aborted = false;
      for (const v of limited) {
        if (remaining() < 1000) {
          aborted = true;
          break;
        }
        const r = await probeVariant(v);
        results.push(r);
        // Atalho: se já achou um Xtream auth=1, não precisa testar o resto
        if (r.is_xtream && (r.xtream_auth === 1 || r.xtream_auth === "1")) break;
      }

      // Classifica candidatos
      const score = (r: VariantResult): number => {
        if (r.is_xtream && (r.xtream_auth === 1 || r.xtream_auth === "1")) return 100 - Math.min(50, r.latency_ms / 100);
        if (r.is_xtream) return 60 - Math.min(30, r.latency_ms / 100);
        if (r.status && r.status >= 200 && r.status < 300) return 50 - Math.min(25, r.latency_ms / 100);
        if (r.status === 401 || r.status === 403) return 30;
        if (r.status && r.status < 500) return 20;
        if (r.status) return 10;
        return 0;
      };

      const candidates = results
        .map((r) => ({ ...r, _score: score(r) }))
        .filter((r) => r._score > 0)
        .sort((a, b) => b._score - a._score);

      // Sugestões textuais
      const suggestions: string[] = [];
      const best = candidates[0];

      if (failureCode === "geo_blocked" || candidates.some((c) => c.route === "proxy")) {
        if (isProxyEnabled()) {
          suggestions.push("Proxy está configurado: requisições já fazem fallback automático quando o IP do Supabase é bloqueado. Nenhuma ação manual necessária.");
        } else {
          suggestions.push("Configure o secret IPTV_PROXY_URL para habilitar fallback automático via proxy quando o servidor bloquear o IP do Supabase.");
        }
      }

      if (failureCode === "bad_credentials") {
        suggestions.push("Credenciais foram rejeitadas pelo servidor. Confirme usuário/senha sem espaços extras. O servidor pode também ter bloqueado o IP por excesso de tentativas.");
      }

      if (failureCode === "account_expired") {
        suggestions.push("A conta Xtream expirou. Renove com o provedor — não há fix técnico no app.");
      }

      if (failureCode === "account_inactive") {
        suggestions.push("A conta está com status diferente de 'Active' (banida/desativada). Não há fix técnico — contate o provedor.");
      }

      if (failureCode === "stream_failed") {
        suggestions.push("API responde mas a entrega de stream falha. Servidor pode estar saturado. Tente novamente em alguns minutos ou peça ao provedor para liberar mais conexões simultâneas.");
      }

      if (best && best.base !== `${originalScheme}://${host}${originalPort && originalPort !== (originalScheme === "https" ? "443" : "80") ? ":" + originalPort : ""}`) {
        if (best.is_xtream && (best.xtream_auth === 1 || best.xtream_auth === "1")) {
          suggestions.push(`Encontrada URL alternativa funcional: ${best.base} — atualize a DNS cadastrada para esse endereço.`);
        } else if (best.status && best.status >= 200 && best.status < 300) {
          suggestions.push(`Endpoint alternativo respondeu HTTP ${best.status} em ${best.base}. Confirme com credenciais.`);
        }
      }

      if (!best) {
        suggestions.push("Nenhuma variante respondeu. Servidor parece totalmente offline para esta região. Aguarde ou contate o provedor.");
      }

      return ok({
        original: { scheme: originalScheme, port: originalPort, base: `${originalScheme}://${host}${originalPort && originalPort !== (originalScheme === "https" ? "443" : "80") ? ":" + originalPort : ""}` },
        variants_tested: results.length,
        variants_planned: limited.length,
        aborted_by_budget: aborted,
        elapsed_ms: Date.now() - startedAt,
        results: results.map(({ ...r }) => r),
        candidates: candidates.map(({ _score, ...r }) => ({ ...r, score: Math.round(_score) })),
        best: best ? { base: best.base, scheme: best.scheme, port: best.port, score: Math.round(best._score) } : null,
        suggestions,
        proxy_configured: isProxyEnabled(),
      });
    }

    // ---------- CLIENT DIAGNOSTICS ----------
    if (action === "client_diagnostics_list") {
      const limit = Math.min(Math.max(Number(payload?.limit ?? 200), 1), 1000);
      const hours = Math.min(Math.max(Number(payload?.hours ?? 24), 1), 24 * 14);
      const outcome = typeof payload?.outcome === "string" ? payload.outcome : null;
      const username = typeof payload?.username === "string" && payload.username.trim() ? payload.username.trim() : null;
      const server_url = typeof payload?.server_url === "string" && payload.server_url.trim() ? payload.server_url.trim() : null;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      let q = admin
        .from("client_diagnostics")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (outcome) q = q.eq("outcome", outcome);
      if (username) q = q.ilike("username", `%${username}%`);
      if (server_url) q = q.ilike("server_url", `%${server_url}%`);

      const { data, error } = await q;
      if (error) { console.error(error.message); return internalError(); }

      // Resumo simples
      const rows = data ?? [];
      const total = rows.length;
      const byOutcome: Record<string, number> = {};
      let downSum = 0, downN = 0, rttSum = 0, rttN = 0, durSum = 0, durN = 0;
      for (const r of rows) {
        byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
        if (typeof r.downlink_mbps === "number") { downSum += r.downlink_mbps; downN++; }
        if (typeof r.rtt_ms === "number") { rttSum += r.rtt_ms; rttN++; }
        if (typeof r.duration_ms === "number") { durSum += r.duration_ms; durN++; }
      }

      return ok({
        rows,
        summary: {
          total,
          by_outcome: byOutcome,
          avg_downlink_mbps: downN ? Number((downSum / downN).toFixed(2)) : null,
          avg_rtt_ms: rttN ? Math.round(rttSum / rttN) : null,
          avg_duration_ms: durN ? Math.round(durSum / durN) : null,
        },
      });
    }

    return bad("Ação inválida");
  } catch (e) {
    console.error("[admin-api] unhandled", e);
    return internalError();
  }
});
