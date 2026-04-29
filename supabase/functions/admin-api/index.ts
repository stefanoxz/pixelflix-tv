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

// Ações restritas a ADMIN (moderador NÃO pode executar).
// Tudo que altera DNS/servidores, gerencia equipe, aprova cadastros, ou
// libera bloqueios permanentes fica aqui.
const ADMIN_ONLY_ACTIONS = new Set([
  "allow_server",
  "remove_server",
  "approve_signup",
  "reject_signup",
  "unblock_user",
  "list_team",
  "add_team_member",
  "update_team_role",
  "remove_team_member",
  "set_team_password",
  "list_audit_log",
  "cleanup_table",
  "evict_idle_now",
  "clear_server_quarantine",
  "blocked_dns_create",
  "blocked_dns_update",
  "blocked_dns_delete",
  "blocked_dns_confirm",
  "blocked_dns_dismiss",
  "blocked_dns_reactivate",
]);

// Tabelas permitidas para limpeza manual via UI. Cada uma mapeia a uma RPC
// `cleanup_*` SECURITY DEFINER que já existe no banco — evita expor SQL bruto
// ou nomes arbitrários de tabela na superfície da API.
const CLEANUP_FUNCTIONS: Record<string, { fn: string; label: string; retentionDays: number; dateCol: string }> = {
  login_events:        { fn: "cleanup_login_events",        label: "Logins",                  retentionDays: 90,  dateCol: "created_at" },
  stream_events:       { fn: "cleanup_stream_events",       label: "Eventos de stream",       retentionDays: 30,  dateCol: "created_at" },
  client_diagnostics:  { fn: "cleanup_client_diagnostics",  label: "Diagnóstico de clientes", retentionDays: 30,  dateCol: "created_at" },
  used_nonces:         { fn: "cleanup_used_nonces",         label: "Nonces usados",           retentionDays: 1,   dateCol: "used_at" },
  admin_audit_log:     { fn: "cleanup_admin_audit_log",     label: "Audit log",               retentionDays: 180, dateCol: "created_at" },
  tmdb_image_cache:    { fn: "cleanup_tmdb_image_cache",    label: "Cache TMDB (imagens)",    retentionDays: 90,  dateCol: "fetched_at" },
  tmdb_episode_cache:  { fn: "cleanup_tmdb_episode_cache",  label: "Cache TMDB (episódios)",  retentionDays: 30,  dateCol: "fetched_at" },
  blocked_dns_failures:{ fn: "cleanup_blocked_dns_failures",label: "Falhas DNS bloqueados",   retentionDays: 2,   dateCol: "created_at" },
};

// Ações que moderador também pode executar (escrita operacional).
// Esta lista é informativa — qualquer ação não-restrita roda para
// admin OU moderator.
const MODERATOR_WRITE_ACTIONS = new Set([
  "evict_session",
]);

async function logAudit(
  actorId: string,
  actorEmail: string | null,
  action: string,
  target?: { user_id?: string | null; email?: string | null; metadata?: Record<string, unknown> },
) {
  try {
    await admin.from("admin_audit_log").insert({
      actor_user_id: actorId,
      actor_email: actorEmail,
      action,
      target_user_id: target?.user_id ?? null,
      target_email: target?.email ?? null,
      metadata: target?.metadata ?? null,
    });
  } catch (e) {
    console.error("[admin-api] audit log failed", (e as Error).message);
  }
}

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

    // Verifica papéis do usuário (admin OU moderator).
    // IMPORTANTE: consultamos `user_roles` direto com o service-role client.
    // Não usamos `has_role()` aqui porque essa função SECURITY DEFINER bloqueia
    // chamadas sem `auth.uid()` (caso típico de chamadas server-side com
    // service key) — o que causa falsos negativos no gate do painel.
    const { data: roleRows, error: rolesErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rolesErr) {
      console.error("[admin-api] role check error", rolesErr.message);
      return internalError();
    }
    const roles = new Set((roleRows ?? []).map((r) => r.role as string));
    const isAdmin = roles.has("admin");
    const isModerator = roles.has("moderator");
    if (!isAdmin && !isModerator) {
      return unauthorized("Acesso restrito ao painel administrativo");
    }

    const body = await req.json().catch(() => ({}));
    const { action, payload } = body as { action?: string; payload?: Record<string, unknown> };

    // Re-check role para ações restritas a admin (defence in depth).
    if (action && ADMIN_ONLY_ACTIONS.has(action)) {
      if (!isAdmin) return unauthorized("Apenas administradores podem executar esta ação");
    }
    void MODERATOR_WRITE_ACTIONS; // mantida para documentação

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
        admin.from("active_sessions").select("anon_user_id, iptv_username, ip, server_url, started_at, last_seen_at, content_kind, content_title, content_id, content_started_at").gt("last_seen_at", cutoff).order("started_at", { ascending: false }).limit(200),
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

      const sessionsList = (sessions.data ?? []).map((s: { anon_user_id: string; iptv_username: string | null; ip: string | null; server_url: string | null; started_at: string; last_seen_at: string; content_kind: string | null; content_title: string | null; content_id: string | null; content_started_at: string | null }) => ({
        anon_user_id: s.anon_user_id, iptv_username: s.iptv_username, ip_masked: maskIp(s.ip), server_url: s.server_url, started_at: s.started_at,
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
      // Para cada usuário, busca o nome IPTV E o servidor (DNS) que ele está
      // usando. Resolve o host pra exibir só o domínio no painel.
      const nameMap = new Map<string, string>();
      const serverMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: sess } = await admin
          .from("active_sessions")
          .select("anon_user_id, iptv_username, server_url")
          .in("anon_user_id", ids);
        for (const s of (sess ?? []) as { anon_user_id: string; iptv_username: string | null; server_url: string | null }[]) {
          nameMap.set(s.anon_user_id, s.iptv_username || "");
          let host = "";
          if (s.server_url) {
            try { host = new URL(s.server_url).host.toLowerCase(); } catch { host = s.server_url; }
          }
          serverMap.set(s.anon_user_id, host);
        }
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
        top_consumers: Array.from(usageMap.values()).map((r) => ({ ...r, iptv_username: nameMap.get(r.anon_user_id) || "", server_host: serverMap.get(r.anon_user_id) || "" })).sort((a, b) => b.requests - a.requests).slice(0, 20),
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
        admin.from("allowed_servers").select("id, server_url, label, notes, created_at, consecutive_failures, unreachable_until, last_working_at"),
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

      const allowedList = (allowed ?? []).map((a: {
        id: string; server_url: string; label: string | null; notes: string | null;
        created_at: string; consecutive_failures: number | null;
        unreachable_until: string | null; last_working_at: string | null;
      }) => {
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
          consecutive_failures: a.consecutive_failures ?? 0,
          unreachable_until: a.unreachable_until,
          last_working_at: a.last_working_at,
          quarantined: !!(a.unreachable_until && new Date(a.unreachable_until).getTime() > Date.now()),
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
        const res = await fetch(probeUrl, {
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
      await logAudit(user.id, user.email, "allow_server", { metadata: { server_url: url, label, notes } });
      return ok({ ok: true, server_url: url, warning });
    }

    if (action === "remove_server") {
      const url = normalizeServer(String(payload?.server_url ?? ""));
      if (!url) return bad("URL do servidor é obrigatória");

      // Apagar definitivamente: além da allowlist, limpa TODOS os registros
      // associados a essa DNS para que ela não volte a aparecer como pendente,
      // bloqueada ou em estatísticas/erros após a remoção.
      const cleanup = await Promise.allSettled([
        admin.from("allowed_servers").delete().eq("server_url", url),
        admin.from("blocked_dns_servers").delete().eq("server_url", url),
        admin.from("blocked_dns_failures").delete().eq("server_url", url),
        admin.from("login_events").delete().eq("server_url", url),
        admin.from("client_diagnostics").delete().eq("server_url", url),
        admin.from("active_sessions").delete().eq("server_url", url),
      ]);

      const cleanupSummary: Record<string, string> = {};
      cleanup.forEach((r, i) => {
        const name = ["allowed_servers", "blocked_dns_servers", "blocked_dns_failures", "login_events", "client_diagnostics", "active_sessions"][i];
        if (r.status === "rejected") {
          cleanupSummary[name] = `error: ${(r.reason as Error)?.message ?? "unknown"}`;
        } else if ((r.value as { error?: { message?: string } } | null)?.error) {
          cleanupSummary[name] = `error: ${(r.value as { error: { message: string } }).error.message}`;
        } else {
          cleanupSummary[name] = "ok";
        }
      });

      await logAudit(user.id, user.email, "remove_server", {
        metadata: { server_url: url, cleanup: cleanupSummary, mode: "definitive_delete" },
      });
      return ok({ ok: true, cleanup: cleanupSummary });
    }

    // ---------- MONITORING ----------
    if (action === "monitoring_overview") {
      const cutoff = new Date(Date.now() - 90_000).toISOString();
      const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

      const [sessions, blocks, recentErrors, topRej] = await Promise.all([
        admin.from("active_sessions").select("anon_user_id, iptv_username, ip, server_url, started_at, last_seen_at, content_kind, content_title, content_id, content_started_at").gt("last_seen_at", cutoff).order("started_at", { ascending: false }).limit(200),
        admin.from("user_blocks").select("anon_user_id, blocked_until, reason, created_at").gt("blocked_until", new Date().toISOString()).order("blocked_until", { ascending: false }),
        admin.from("stream_events").select("id, anon_user_id, event_type, ip, meta, created_at").gte("created_at", since24h).in("event_type", ["stream_error", "token_rejected", "rate_limited", "user_blocked", "suspicious_pattern"]).order("created_at", { ascending: false }).limit(50),
        admin.from("stream_events").select("ip").eq("event_type", "token_rejected").gte("created_at", since24h),
      ]);

      const sessionsList = (sessions.data ?? []).map((s: { anon_user_id: string; iptv_username: string | null; ip: string | null; server_url: string | null; started_at: string; last_seen_at: string; content_kind: string | null; content_title: string | null; content_id: string | null; content_started_at: string | null }) => ({
        anon_user_id: s.anon_user_id,
        iptv_username: s.iptv_username,
        ip_masked: maskIp(s.ip),
        server_url: s.server_url,
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
      await logAudit(user.id, user.email, "unblock_user", { user_id: id });
      return ok({ ok: true });
    }

    if (action === "evict_session") {
      const id = String(payload?.anon_user_id ?? "");
      if (!id) return bad("anon_user_id obrigatório");
      const { error } = await admin.from("active_sessions").delete().eq("anon_user_id", id);
      if (error) { console.error(error.message); return internalError(); }
      await logAudit(user.id, user.email, "evict_session", { user_id: id });
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

      const rows = (data ?? []) as Array<{ user_id: string; email: string | null; created_at: string }>;

      // Para qualquer linha sem e-mail, busca direto na auth.users via service role.
      // Também tenta backfillar a tabela para que apareça correto em consultas futuras.
      const missing = rows.filter((r) => !r.email || r.email.trim() === "");
      if (missing.length > 0) {
        const resolved = await Promise.all(
          missing.map(async (r) => {
            try {
              const { data: u } = await admin.auth.admin.getUserById(r.user_id);
              const meta = (u?.user?.user_metadata ?? {}) as Record<string, unknown>;
              const appMeta = (u?.user?.app_metadata ?? {}) as Record<string, unknown>;
              const email = (
                u?.user?.email ||
                (typeof meta.email === "string" ? meta.email : "") ||
                (typeof appMeta.email === "string" ? appMeta.email : "") ||
                ""
              ).trim();
              return { user_id: r.user_id, email: email || null };
            } catch (e) {
              console.error("[admin-api] getUserById failed", r.user_id, (e as Error).message);
              return { user_id: r.user_id, email: null };
            }
          }),
        );

        const resolvedMap = new Map(resolved.map((x) => [x.user_id, x.email] as const));

        // Backfill best-effort (não bloqueia resposta se falhar)
        const toBackfill = resolved.filter((x) => x.email);
        if (toBackfill.length > 0) {
          await Promise.all(
            toBackfill.map((x) =>
              admin
                .from("pending_admin_signups")
                .update({ email: x.email })
                .eq("user_id", x.user_id),
            ),
          ).catch((e) => console.error("[admin-api] backfill failed", (e as Error).message));
        }

        for (const r of rows) {
          if (!r.email || r.email.trim() === "") {
            r.email = resolvedMap.get(r.user_id) ?? null;
          }
        }
      }

      return ok({ pending: rows });
    }

    if (action === "approve_signup") {
      const id = String(payload?.user_id ?? "");
      if (!id) return bad("user_id obrigatório");
      // Resolve e-mail do alvo (para o log)
      let targetEmail: string | null = null;
      try {
        const { data: u } = await admin.auth.admin.getUserById(id);
        targetEmail = u?.user?.email ?? null;
      } catch { /* ignore */ }
      const { error: roleErr } = await admin
        .from("user_roles")
        .insert({ user_id: id, role: "admin" });
      if (roleErr && !roleErr.message.includes("duplicate")) {
        console.error(roleErr.message); return internalError();
      }
      const { error: delErr } = await admin
        .from("pending_admin_signups").delete().eq("user_id", id);
      if (delErr) { console.error(delErr.message); return internalError(); }
      await logAudit(user.id, user.email, "approve_signup", { user_id: id, email: targetEmail, metadata: { role: "admin" } });
      return ok({ ok: true });
    }

    if (action === "reject_signup") {
      const id = String(payload?.user_id ?? "");
      if (!id) return bad("user_id obrigatório");
      let targetEmail: string | null = null;
      try {
        const { data: u } = await admin.auth.admin.getUserById(id);
        targetEmail = u?.user?.email ?? null;
      } catch { /* ignore */ }
      const { error: authErr } = await admin.auth.admin.deleteUser(id);
      if (authErr) {
        console.error("[admin-api] deleteUser failed", authErr.message);
        return internalError();
      }
      // Trigger ON DELETE CASCADE não cobre pending (sem FK), limpa manualmente.
      await admin.from("pending_admin_signups").delete().eq("user_id", id);
      await logAudit(user.id, user.email, "reject_signup", { user_id: id, email: targetEmail });
      return ok({ ok: true });
    }

    // ---------- PROBE SERVER (admin diagnostics) ----------
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
            // Captura headers úteis para diagnóstico (WAF/rate-limit/geo/cache)
            const headersOfInterest = [
              "server", "cf-ray", "cf-mitigated", "cf-cache-status", "cf-chl-bypass",
              "x-powered-by", "via", "x-cache", "x-served-by",
              "retry-after", "x-ratelimit-remaining", "x-ratelimit-limit", "x-ratelimit-reset",
              "x-sucuri-id", "x-sucuri-cache", "x-iinfo",
              "content-type", "x-frame-options", "location",
            ];
            const respHeaders: Record<string, string> = {};
            for (const h of headersOfInterest) {
              const v = res.headers.get(h);
              if (v) respHeaders[h] = v.length > 200 ? v.slice(0, 200) : v;
            }
            return {
              variant: base,
              ok: res.ok,
              status: res.status,
              latency_ms: elapsed,
              is_xtream: isXtream,
              auth: authValue,
              body_preview: body.slice(0, 400),
              headers: respHeaders,
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
              headers: {} as Record<string, string>,
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
    // (fetch direto) e devolve status HTTP + preview do corpo.
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
          const res = await fetch(url, {
            method: m,
            headers: { "User-Agent": TEST_UA, Accept: "application/json, */*" },
            redirect: "follow",
            signal: AbortSignal.timeout(opts.timeout ?? timeoutMs),
          });
          const route: "direct" | "proxy" = "direct";
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
                  const r2 = await fetch(target, {
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
              const r = await fetch(buildXtreamUrl("get_live_categories"), {
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
              const sr = await fetch(streamsUrl, {
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

      // 5) Comparativo direto vs proxy — desativado (sem proxy configurado).
      type RouteComparison = {
        direct: { status: number | null; latency_ms: number; error: string | null };
        proxy: { status: number | null; latency_ms: number; error: string | null } | null;
      };
      const route_comparison: RouteComparison | null = null as RouteComparison | null;

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
        proxy_configured: false,
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
          const res = await fetch(url, {
            method: "GET",
            headers: { "User-Agent": TEST_UA, Accept: "application/json, */*" },
            redirect: "follow",
            signal: AbortSignal.timeout(probeTimeout),
          });
          const route: "direct" | "proxy" = "direct";
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

      if (failureCode === "geo_blocked") {
        suggestions.push("O servidor parece estar bloqueando o IP do backend. Considere usar uma VPS própria como proxy, ou solicite à revenda uma DNS alternativa.");
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
        proxy_configured: false,
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

    // ---------- TEAM / ROLES ----------
    if (action === "list_team") {
      const { data: roles, error } = await admin
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .order("created_at", { ascending: true });
      if (error) { console.error(error.message); return internalError(); }
      const rows = (roles ?? []) as Array<{ id: string; user_id: string; role: string; created_at: string }>;

      // Resolve e-mails via service role
      const uniqueIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const emailMap = new Map<string, string | null>();
      await Promise.all(uniqueIds.map(async (uid) => {
        try {
          const { data: u } = await admin.auth.admin.getUserById(uid);
          emailMap.set(uid, u?.user?.email ?? null);
        } catch { emailMap.set(uid, null); }
      }));

      const team = rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        email: emailMap.get(r.user_id) ?? null,
        created_at: r.created_at,
        is_self: r.user_id === user.id,
      }));

      const adminCount = team.filter((m) => m.role === "admin").length;
      return ok({ team, admin_count: adminCount });
    }

    if (action === "add_team_member") {
      const email = String(payload?.email ?? "").trim().toLowerCase();
      const role = String(payload?.role ?? "moderator");
      if (!email || !email.includes("@")) return bad("E-mail inválido");
      if (role !== "admin" && role !== "moderator") return bad("Papel inválido");

      // Procura usuário existente por e-mail — pagina até 5 páginas (1000 contas).
      let targetUserId: string | null = null;
      try {
        for (let page = 1; page <= 5 && !targetUserId; page++) {
          const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          const users = data?.users ?? [];
          const found = users.find((u) => (u.email ?? "").toLowerCase() === email);
          if (found) { targetUserId = found.id; break; }
          if (users.length < 200) break; // última página
        }
      } catch (e) {
        console.error("[admin-api] listUsers failed", (e as Error).message);
      }

      if (!targetUserId) {
        // Envia convite (cria usuário pendente)
        try {
          const { data, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${new URL(req.url).origin.replace(/\.functions\.supabase\.co$/, "")}/admin`,
          });
          if (invErr) {
            console.error("[admin-api] invite failed", invErr.message);
            return bad("Não foi possível enviar o convite. Verifique o e-mail.");
          }
          targetUserId = data?.user?.id ?? null;
        } catch (e) {
          console.error("[admin-api] invite exception", (e as Error).message);
          return internalError();
        }
      }

      if (!targetUserId) return bad("Não foi possível resolver o usuário");

      const { error: roleErr } = await admin
        .from("user_roles")
        .insert({ user_id: targetUserId, role });
      if (roleErr && !/duplicate|unique/i.test(roleErr.message)) {
        console.error(roleErr.message); return internalError();
      }

      // Remove cadastro pendente se existir (já é membro de equipe)
      await admin.from("pending_admin_signups").delete().eq("user_id", targetUserId);

      await logAudit(user.id, user.email, "add_team_member", { user_id: targetUserId, email, metadata: { role } });
      return ok({ ok: true, user_id: targetUserId, role });
    }

    if (action === "update_team_role") {
      const targetId = String(payload?.user_id ?? "");
      const newRole = String(payload?.role ?? "");
      if (!targetId) return bad("user_id obrigatório");
      if (newRole !== "admin" && newRole !== "moderator") return bad("Papel inválido");

      // Verifica papel atual
      const { data: currentRoles } = await admin
        .from("user_roles").select("role").eq("user_id", targetId);
      const isCurrentlyAdmin = (currentRoles ?? []).some((r) => r.role === "admin");

      // Trava: não rebaixar o último admin
      if (isCurrentlyAdmin && newRole !== "admin") {
        const { count } = await admin
          .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
        if ((count ?? 0) <= 1) {
          return bad("Não é possível rebaixar o último administrador");
        }
      }

      // Remove papéis atuais e insere o novo (substitui)
      await admin.from("user_roles").delete().eq("user_id", targetId);
      const { error: insErr } = await admin
        .from("user_roles").insert({ user_id: targetId, role: newRole });
      if (insErr) { console.error(insErr.message); return internalError(); }

      let targetEmail: string | null = null;
      try {
        const { data: u } = await admin.auth.admin.getUserById(targetId);
        targetEmail = u?.user?.email ?? null;
      } catch { /* ignore */ }

      await logAudit(user.id, user.email, "update_team_role", {
        user_id: targetId, email: targetEmail, metadata: { new_role: newRole },
      });
      return ok({ ok: true });
    }

    if (action === "remove_team_member") {
      const targetId = String(payload?.user_id ?? "");
      if (!targetId) return bad("user_id obrigatório");
      if (targetId === user.id) return bad("Você não pode remover a si mesmo. Peça a outro admin.");

      const { data: currentRoles } = await admin
        .from("user_roles").select("role").eq("user_id", targetId);
      const isCurrentlyAdmin = (currentRoles ?? []).some((r) => r.role === "admin");

      if (isCurrentlyAdmin) {
        const { count } = await admin
          .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
        if ((count ?? 0) <= 1) return bad("Não é possível remover o último administrador");
      }

      let targetEmail: string | null = null;
      try {
        const { data: u } = await admin.auth.admin.getUserById(targetId);
        targetEmail = u?.user?.email ?? null;
      } catch { /* ignore */ }

      const { error } = await admin.from("user_roles").delete().eq("user_id", targetId);
      if (error) { console.error(error.message); return internalError(); }

      await logAudit(user.id, user.email, "remove_team_member", { user_id: targetId, email: targetEmail });
      return ok({ ok: true });
    }

    if (action === "set_team_password") {
      const targetId = String(payload?.user_id ?? "");
      const newPassword = String(payload?.new_password ?? "");
      if (!targetId) return bad("user_id obrigatório");
      if (newPassword.length < 8) return bad("Senha precisa ter ao menos 8 caracteres");
      if (newPassword.length > 72) return bad("Senha muito longa (máx. 72 caracteres)");

      // Confirma que o alvo é admin ou moderator (não permite trocar senha de
      // contas que não são da equipe).
      const { data: targetRoles, error: targetRolesErr } = await admin
        .from("user_roles").select("role").eq("user_id", targetId);
      if (targetRolesErr) { console.error(targetRolesErr.message); return internalError(); }
      const targetRoleSet = new Set((targetRoles ?? []).map((r) => r.role as string));
      if (!targetRoleSet.has("admin") && !targetRoleSet.has("moderator")) {
        return bad("Usuário não pertence à equipe administrativa");
      }

      // Trava: se alvo é o último admin e quem está executando NÃO é o próprio,
      // bloqueia (evita reset acidental por outro admin que não consegue avisar).
      if (targetRoleSet.has("admin") && targetId !== user.id) {
        const { count } = await admin
          .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
        if ((count ?? 0) <= 1) {
          return bad("Não é possível trocar a senha do último administrador. Faça pela conta dele.");
        }
      }

      let targetEmail: string | null = null;
      try {
        const { data: u, error: getErr } = await admin.auth.admin.updateUserById(targetId, {
          password: newPassword,
        });
        if (getErr) {
          console.error("[admin-api] updateUserById failed", getErr.message);
          const msg = getErr.message || "";
          if (/weak|pwned|known to be|compromised/i.test(msg)) {
            return bad("Senha fraca ou vazada em algum site conhecido. Escolha uma senha mais forte (combine letras, números e símbolos).");
          }
          if (/not.found|no.*user/i.test(msg)) {
            return bad("Usuário não encontrado.");
          }
          return bad(`Falha ao atualizar senha: ${msg}`);
        }
        targetEmail = u?.user?.email ?? null;
      } catch (e) {
        console.error("[admin-api] set_team_password exception", (e as Error).message);
        return internalError();
      }

      await logAudit(user.id, user.email, "set_team_password", {
        user_id: targetId,
        email: targetEmail,
        metadata: { self: targetId === user.id },
      });
      return ok({ ok: true });
    }

    if (action === "list_audit_log") {
      const limit = Math.min(Math.max(Number(payload?.limit ?? 100), 1), 500);
      const { data, error } = await admin
        .from("admin_audit_log")
        .select("id, actor_user_id, actor_email, action, target_user_id, target_email, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) { console.error(error.message); return internalError(); }
      return ok({ entries: data ?? [] });
    }

    // ---------- HISTORICAL STATS ----------
    if (action === "stats_logins_daily") {
      const days = Math.min(Math.max(Number(payload?.days ?? 30), 1), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await admin
        .from("login_events")
        .select("created_at, success")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(50000);
      if (error) { console.error(error.message); return internalError(); }
      const buckets = new Map<string, { date: string; success: number; fail: number }>();
      for (const r of data ?? []) {
        const day = (r.created_at as string).slice(0, 10);
        const cur = buckets.get(day) ?? { date: day, success: 0, fail: 0 };
        if (r.success) cur.success++; else cur.fail++;
        buckets.set(day, cur);
      }
      // Preenche dias faltantes
      const series: Array<{ date: string; success: number; fail: number; total: number }> = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const b = buckets.get(d) ?? { date: d, success: 0, fail: 0 };
        series.push({ ...b, total: b.success + b.fail });
      }
      return ok({ days, series });
    }

    if (action === "stats_dau_mau") {
      const days = Math.min(Math.max(Number(payload?.days ?? 30), 1), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await admin
        .from("active_sessions")
        .select("anon_user_id, last_seen_at")
        .gte("last_seen_at", since)
        .limit(50000);
      if (error) { console.error(error.message); return internalError(); }

      const dailyUsers = new Map<string, Set<string>>();
      for (const r of data ?? []) {
        const day = (r.last_seen_at as string).slice(0, 10);
        if (!dailyUsers.has(day)) dailyUsers.set(day, new Set());
        dailyUsers.get(day)!.add(r.anon_user_id as string);
      }

      const series: Array<{ date: string; dau: number; mau_rolling: number }> = [];
      // Calcula MAU rolling de 30 dias para cada ponto
      const sortedDays: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        sortedDays.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      }
      for (let i = 0; i < sortedDays.length; i++) {
        const day = sortedDays[i];
        const dau = dailyUsers.get(day)?.size ?? 0;
        // MAU rolling: união dos últimos 30 dias até aqui
        const mauSet = new Set<string>();
        for (let j = Math.max(0, i - 29); j <= i; j++) {
          const u = dailyUsers.get(sortedDays[j]);
          if (u) for (const id of u) mauSet.add(id);
        }
        series.push({ date: day, dau, mau_rolling: mauSet.size });
      }
      return ok({ days, series });
    }

    if (action === "stats_peak_heatmap") {
      const days = Math.min(Math.max(Number(payload?.days ?? 7), 1), 30);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await admin
        .from("active_sessions")
        .select("last_seen_at")
        .gte("last_seen_at", since)
        .limit(50000);
      if (error) { console.error(error.message); return internalError(); }

      // grid 7 (dom..sáb) x 24 (0..23)
      const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
      for (const r of data ?? []) {
        const d = new Date(r.last_seen_at as string);
        grid[d.getUTCDay()][d.getUTCHours()]++;
      }
      let max = 0;
      for (const row of grid) for (const v of row) if (v > max) max = v;
      return ok({ days, grid, max });
    }

    if (action === "stats_top_content") {
      const days = Math.min(Math.max(Number(payload?.days ?? 7), 1), 30);
      const limit = Math.min(Math.max(Number(payload?.limit ?? 10), 1), 50);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await admin
        .from("active_sessions")
        .select("content_kind, content_title, content_id, started_at, last_seen_at, content_started_at")
        .gte("last_seen_at", since)
        .not("content_title", "is", null)
        .in("content_kind", ["live", "movie", "episode"])
        .limit(20000);
      if (error) { console.error(error.message); return internalError(); }

      // Cap em 12h por sessão — evita inflar métrica com sessões zumbis
      // (heartbeat travado, processo morto sem cleanup, etc).
      const MAX_DURATION_S = 12 * 60 * 60;

      const tally = new Map<string, { title: string; kind: string; total_s: number; views: number }>();
      for (const r of data ?? []) {
        const title = r.content_title as string;
        if (!title) continue;
        const kind = (r.content_kind as string) ?? "unknown";
        const key = `${kind}:${title}`;
        // content_started_at é setado pelo player quando o usuário troca de conteúdo.
        // Fallback para started_at quando o painel ainda não recebeu o heartbeat
        // de troca (sessões antigas ou primeira reprodução).
        const startIso = (r.content_started_at as string | null) ?? (r.started_at as string);
        const start = new Date(startIso).getTime();
        const end = new Date(r.last_seen_at as string).getTime();
        const dur = Math.max(0, Math.round((end - start) / 1000));
        if (dur === 0 || dur > MAX_DURATION_S) continue;
        const cur = tally.get(key) ?? { title, kind, total_s: 0, views: 0 };
        cur.total_s += dur;
        cur.views += 1;
        tally.set(key, cur);
      }
      const items = Array.from(tally.values())
        .sort((a, b) => b.total_s - a.total_s)
        .slice(0, limit);
      return ok({ days, items });
    }

    if (action === "table_stats") {
      // Retorna contagens e idade da linha mais antiga em cada tabela limpável.
      // Usado pela aba Manutenção pra mostrar ao admin o que está acumulando.
      const targets = Object.keys(CLEANUP_FUNCTIONS);
      const stats: Array<{
        table: string;
        label: string;
        retention_days: number;
        row_count: number;
        oldest_at: string | null;
        expired_count: number;
      }> = [];
      for (const table of targets) {
        const meta = CLEANUP_FUNCTIONS[table];
        const cutoff = new Date(Date.now() - meta.retentionDays * 24 * 60 * 60 * 1000).toISOString();
        const dateCol = meta.dateCol;
        const [{ count: total }, { count: expired }, { data: oldestRow }] = await Promise.all([
          admin.from(table).select("*", { count: "exact", head: true }),
          admin.from(table).select("*", { count: "exact", head: true }).lt(dateCol, cutoff),
          admin.from(table).select(dateCol).order(dateCol, { ascending: true }).limit(1).maybeSingle(),
        ]);
        stats.push({
          table,
          label: meta.label,
          retention_days: meta.retentionDays,
          row_count: total ?? 0,
          oldest_at: (oldestRow as Record<string, string> | null)?.[dateCol] ?? null,
          expired_count: expired ?? 0,
        });
      }
      // Sessões ativas e bloqueios ativos (não passíveis de cleanup_table mas
      // úteis pra visão geral).
      const [{ count: sessions }, { count: blocks }] = await Promise.all([
        admin.from("active_sessions").select("*", { count: "exact", head: true }),
        admin.from("user_blocks").select("*", { count: "exact", head: true }),
      ]);
      return ok({
        tables: stats,
        live: { active_sessions: sessions ?? 0, user_blocks: blocks ?? 0 },
      });
    }

    if (action === "cleanup_table") {
      const table = String(payload?.table ?? "");
      const meta = CLEANUP_FUNCTIONS[table];
      if (!meta) return bad("Tabela inválida para limpeza");
      const { data, error } = await admin.rpc(meta.fn);
      if (error) {
        console.error(`[admin-api] cleanup ${meta.fn} failed`, error.message);
        return internalError();
      }
      const removed = typeof data === "number" ? data : 0;
      await logAudit(user.id, user.email, "cleanup_table", {
        metadata: { table, removed, retention_days: meta.retentionDays },
      });
      return ok({ table, removed });
    }

    if (action === "evict_idle_now") {
      const { data, error } = await admin.rpc("evict_idle_sessions");
      if (error) {
        console.error("[admin-api] evict_idle_sessions failed", error.message);
        return internalError();
      }
      const removed = typeof data === "number" ? data : 0;
      await logAudit(user.id, user.email, "evict_idle_sessions", { metadata: { removed } });
      return ok({ removed });
    }

    if (action === "user_detail") {
      const username = String(payload?.username ?? "").trim();
      if (!username) return bad("username obrigatório");

      // Histórico de logins (últimos 90 dias, máx 100)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const [logins, watch, sessions, diagnostics] = await Promise.all([
        admin
          .from("login_events")
          .select("id, server_url, success, reason, ip_address, user_agent, created_at")
          .eq("username", username)
          .gte("created_at", ninetyDaysAgo)
          .order("created_at", { ascending: false })
          .limit(100),
        admin
          .from("watch_progress")
          .select("kind, content_id, title, poster_url, server_url, position_seconds, duration_seconds, updated_at")
          .eq("username", username)
          .order("updated_at", { ascending: false })
          .limit(50),
        admin
          .from("active_sessions")
          .select("anon_user_id, server_url, ip, started_at, last_seen_at, content_kind, content_title, content_started_at")
          .eq("iptv_username", username)
          .order("last_seen_at", { ascending: false })
          .limit(20),
        admin
          .from("client_diagnostics")
          .select("id, server_url, outcome, client_error, duration_ms, ip, country, region, city, isp, speed_kbps, effective_type, downlink_mbps, created_at")
          .eq("username", username)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (logins.error || watch.error || sessions.error || diagnostics.error) {
        console.error("[admin-api] user_detail error",
          logins.error?.message ?? watch.error?.message ?? sessions.error?.message ?? diagnostics.error?.message);
        return internalError();
      }

      // Resumo: total, sucessos, falhas, IPs únicos, servidores únicos
      const loginRows = logins.data ?? [];
      const ips = new Set<string>();
      const servers = new Set<string>();
      let successes = 0;
      let failures = 0;
      for (const row of loginRows) {
        if (row.ip_address) ips.add(row.ip_address);
        if (row.server_url) servers.add(row.server_url);
        if (row.success) successes++; else failures++;
      }

      // Mascarar IPs nas listas devolvidas pra não vazar IPs cheios à UI
      const maskedLogins = loginRows.map((r) => ({
        ...r,
        ip_address: r.ip_address ? maskIp(r.ip_address) : null,
      }));
      const maskedSessions = (sessions.data ?? []).map((r) => ({
        ...r,
        ip: r.ip ? maskIp(r.ip) : null,
      }));
      const maskedDiagnostics = (diagnostics.data ?? []).map((r) => ({
        ...r,
        ip: r.ip ? maskIp(r.ip) : null,
      }));

      return ok({
        username,
        summary: {
          total_logins: loginRows.length,
          success_count: successes,
          fail_count: failures,
          unique_ips: ips.size,
          unique_servers: servers.size,
          last_login_at: loginRows[0]?.created_at ?? null,
        },
        logins: maskedLogins,
        watch_progress: watch.data ?? [],
        sessions: maskedSessions,
        diagnostics: maskedDiagnostics,
      });
    }

    if (action === "stream_events_overview") {
      // Janela em horas (padrão 24h, máx 7d).
      const hours = Math.min(Math.max(Number(payload?.hours ?? 24), 1), 168);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const includeDebounce = Boolean(payload?.includeDebounce);

      const { data: rows, error } = await admin
        .from("stream_events")
        .select("id, event_type, ip, ua_hash, anon_user_id, meta, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) {
        console.error("[admin-api] stream_events_overview", error.message);
        return internalError();
      }

      type Row = {
        id: string;
        event_type: string;
        ip: string | null;
        ua_hash: string | null;
        anon_user_id: string | null;
        meta: Record<string, unknown> | null;
        created_at: string;
      };
      const all = (rows ?? []) as Row[];

      // Contadores por tipo
      const counts: Record<string, number> = {};
      for (const r of all) counts[r.event_type] = (counts[r.event_type] ?? 0) + 1;

      // Listas detalhadas
      const tokenRejected = all
        .filter((r) => r.event_type === "token_rejected")
        .slice(0, 50)
        .map((r) => ({
          id: r.id,
          ip_masked: maskIp(r.ip),
          ua_hash: r.ua_hash,
          reason: (r.meta as { reason?: string } | null)?.reason ?? null,
          created_at: r.created_at,
        }));

      const replayTolerated = all
        .filter((r) => r.event_type === "nonce_replay_tolerated")
        .slice(0, 50)
        .map((r) => ({
          id: r.id,
          ip_masked: maskIp(r.ip),
          anon_user_id: r.anon_user_id,
          created_at: r.created_at,
        }));

      // Erros agrupados por host + reason (com filtro de debounce)
      const errorBuckets = new Map<
        string,
        { host: string | null; reason: string | null; type: string | null; count: number; last_at: string }
      >();
      for (const r of all) {
        if (r.event_type !== "stream_error") continue;
        const m = (r.meta ?? {}) as Record<string, string | undefined>;
        const reason = m.reason ?? null;
        if (!includeDebounce && reason === "player_switch_debounced") continue;
        const host = m.host ?? null;
        const type = m.type ?? null;
        const key = `${host ?? ""}|${type ?? ""}|${reason ?? ""}`;
        const cur = errorBuckets.get(key) ?? { host, reason, type, count: 0, last_at: r.created_at };
        cur.count += 1;
        if (r.created_at > cur.last_at) cur.last_at = r.created_at;
        errorBuckets.set(key, cur);
      }
      const errors = Array.from(errorBuckets.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);

      // Série por hora
      const seriesMap = new Map<string, {
        hour: string;
        token_issued: number;
        token_rejected: number;
        stream_started: number;
        stream_error: number;
        replay_tolerated: number;
      }>();
      for (const r of all) {
        const h = new Date(r.created_at);
        h.setMinutes(0, 0, 0);
        const key = h.toISOString();
        const cur = seriesMap.get(key) ?? {
          hour: key,
          token_issued: 0,
          token_rejected: 0,
          stream_started: 0,
          stream_error: 0,
          replay_tolerated: 0,
        };
        if (r.event_type === "token_issued") cur.token_issued += 1;
        else if (r.event_type === "token_rejected") cur.token_rejected += 1;
        else if (r.event_type === "stream_started") cur.stream_started += 1;
        else if (r.event_type === "stream_error") cur.stream_error += 1;
        else if (r.event_type === "nonce_replay_tolerated") cur.replay_tolerated += 1;
        seriesMap.set(key, cur);
      }
      const series = Array.from(seriesMap.values()).sort((a, b) => a.hour.localeCompare(b.hour));

      return ok({
        hours,
        counts: {
          token_issued: counts.token_issued ?? 0,
          token_rejected: counts.token_rejected ?? 0,
          stream_started: counts.stream_started ?? 0,
          stream_error: counts.stream_error ?? 0,
          replay_tolerated: counts.nonce_replay_tolerated ?? 0,
          segment_request: counts.segment_request ?? 0,
          session_evicted: counts.session_evicted ?? 0,
          user_report: counts.user_report ?? 0,
        },
        token_rejected: tokenRejected,
        replay_tolerated: replayTolerated,
        errors,
        series,
      });
    }

    if (action === "update_report_status") {
      const id = String(payload?.id ?? "");
      const status = String(payload?.status ?? "");
      if (!id) return bad("id obrigatório");
      const ALLOWED_STATUS = new Set(["open", "investigating", "resolved", "ignored"]);
      if (!ALLOWED_STATUS.has(status)) return bad("status inválido");

      // Carrega o reporte atual pra validar tipo + preservar meta existente
      const { data: existing, error: fetchErr } = await admin
        .from("stream_events")
        .select("id, event_type, meta")
        .eq("id", id)
        .maybeSingle();
      if (fetchErr) {
        console.error("[admin-api] update_report_status fetch", fetchErr.message);
        return internalError();
      }
      if (!existing) return bad("Reporte não encontrado", 404);
      if (existing.event_type !== "user_report") return bad("Evento não é um reporte de usuário");

      const newMeta = {
        ...((existing.meta as Record<string, unknown> | null) ?? {}),
        status,
        status_changed_at: new Date().toISOString(),
        status_changed_by: user.email ?? user.id,
      };

      const { error: updateErr } = await admin
        .from("stream_events")
        .update({ meta: newMeta })
        .eq("id", id);
      if (updateErr) {
        console.error("[admin-api] update_report_status update", updateErr.message);
        return internalError();
      }

      await logAudit(user.id, user.email, "update_report_status", {
        metadata: { report_id: id, status },
      });
      return ok({ id, status });
    }

    if (action === "clear_server_quarantine") {
      const url = normalizeServer(String(payload?.server_url ?? ""));
      if (!url) return bad("URL do servidor é obrigatória");

      const { data: existing, error: fetchErr } = await admin
        .from("allowed_servers")
        .select("server_url, unreachable_until, consecutive_failures")
        .eq("server_url", url)
        .maybeSingle();
      if (fetchErr) {
        console.error("[admin-api] clear_quarantine fetch", fetchErr.message);
        return internalError();
      }
      if (!existing) return bad("Servidor não encontrado", 404);

      const { error: updateErr } = await admin
        .from("allowed_servers")
        .update({ unreachable_until: null, consecutive_failures: 0 })
        .eq("server_url", url);
      if (updateErr) {
        console.error("[admin-api] clear_quarantine update", updateErr.message);
        return internalError();
      }

      await logAudit(user.id, user.email, "clear_server_quarantine", {
        metadata: {
          server_url: url,
          previous_failures: existing.consecutive_failures ?? 0,
          previous_unreachable_until: existing.unreachable_until,
        },
      });
      return ok({ server_url: url });
    }

    // ==========================================================
    // BLOCKED DNS — catálogo de DNS com bloqueio anti-datacenter
    // ==========================================================

    if (action === "blocked_dns_list") {
      const status = (payload?.status as string | undefined) ?? null; // 'suggested' | 'confirmed' | 'dismissed' | null=all
      let q = admin
        .from("blocked_dns_servers")
        .select("id, server_url, label, provider_name, block_type, status, notes, evidence, failure_count, distinct_ip_count, first_detected_at, last_detected_at, confirmed_at, dismissed_at, created_at, updated_at")
        .order("last_detected_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (status && ["suggested", "confirmed", "dismissed"].includes(status)) {
        q = q.eq("status", status);
      }
      const { data, error } = await q;
      if (error) {
        console.error("[admin-api] blocked_dns_list", error.message);
        return internalError();
      }

      // Contadores por status (sempre — pra UI mostrar badges)
      const { data: counts } = await admin
        .from("blocked_dns_servers")
        .select("status");
      const tally = { suggested: 0, confirmed: 0, dismissed: 0 } as Record<string, number>;
      for (const row of counts ?? []) {
        const s = (row as { status: string }).status;
        if (s in tally) tally[s] += 1;
      }

      return ok({ items: data ?? [], counts: tally });
    }

    if (action === "blocked_dns_create") {
      const url = normalizeServer(String(payload?.server_url ?? ""));
      if (!url) return bad("URL do servidor é obrigatória");
      const block_type = String(payload?.block_type ?? "anti_datacenter");
      const status = String(payload?.status ?? "confirmed");
      if (!["anti_datacenter", "geoblock", "waf", "dns_error", "outro"].includes(block_type)) {
        return bad("Tipo de bloqueio inválido");
      }
      if (!["suggested", "confirmed", "dismissed"].includes(status)) {
        return bad("Status inválido");
      }
      const now = new Date().toISOString();
      const insertRow: Record<string, unknown> = {
        server_url: url,
        label: payload?.label ?? null,
        provider_name: payload?.provider_name ?? null,
        block_type,
        status,
        notes: payload?.notes ?? null,
        evidence: payload?.evidence ?? null,
      };
      if (status === "confirmed") insertRow.confirmed_at = now;
      if (status === "dismissed") insertRow.dismissed_at = now;

      const { data, error } = await admin
        .from("blocked_dns_servers")
        .upsert(insertRow, { onConflict: "server_url" })
        .select()
        .single();
      if (error) {
        console.error("[admin-api] blocked_dns_create", error.message);
        return bad(error.message);
      }
      await logAudit(user.id, user.email, "blocked_dns_create", {
        metadata: { server_url: url, block_type, status, label: payload?.label ?? null },
      });
      return ok(data);
    }

    if (action === "blocked_dns_update") {
      const id = String(payload?.id ?? "");
      if (!id) return bad("ID obrigatório");
      const patch: Record<string, unknown> = {};
      if ("label" in (payload ?? {})) patch.label = payload?.label ?? null;
      if ("provider_name" in (payload ?? {})) patch.provider_name = payload?.provider_name ?? null;
      if ("notes" in (payload ?? {})) patch.notes = payload?.notes ?? null;
      if ("block_type" in (payload ?? {})) {
        const bt = String(payload?.block_type);
        if (!["anti_datacenter", "geoblock", "waf", "dns_error", "outro"].includes(bt)) {
          return bad("Tipo de bloqueio inválido");
        }
        patch.block_type = bt;
      }
      if (Object.keys(patch).length === 0) return bad("Nada para atualizar");
      const { data, error } = await admin
        .from("blocked_dns_servers")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("[admin-api] blocked_dns_update", error.message);
        return bad(error.message);
      }
      await logAudit(user.id, user.email, "blocked_dns_update", { metadata: { id, ...patch } });
      return ok(data);
    }

    if (action === "blocked_dns_delete") {
      const id = String(payload?.id ?? "");
      if (!id) return bad("ID obrigatório");
      // Buscar URL antes de deletar para também limpar falhas associadas e
      // evitar que a mesma DNS volte como sugestão imediatamente.
      const { data: row } = await admin
        .from("blocked_dns_servers").select("server_url").eq("id", id).maybeSingle();
      const { error } = await admin.from("blocked_dns_servers").delete().eq("id", id);
      if (error) {
        console.error("[admin-api] blocked_dns_delete", error.message);
        return bad(error.message);
      }
      const serverUrl = (row as { server_url?: string } | null)?.server_url ?? null;
      if (serverUrl) {
        await admin.from("blocked_dns_failures").delete().eq("server_url", serverUrl);
      }
      await logAudit(user.id, user.email, "blocked_dns_delete", { metadata: { id, server_url: serverUrl } });
      return ok({ id });
    }

    if (action === "blocked_dns_confirm") {
      const id = String(payload?.id ?? "");
      if (!id) return bad("ID obrigatório");
      const patch: Record<string, unknown> = {
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        dismissed_at: null,
      };
      if (payload?.label !== undefined) patch.label = payload.label;
      if (payload?.provider_name !== undefined) patch.provider_name = payload.provider_name;
      if (payload?.notes !== undefined) patch.notes = payload.notes;
      const { data, error } = await admin
        .from("blocked_dns_servers")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("[admin-api] blocked_dns_confirm", error.message);
        return bad(error.message);
      }
      await logAudit(user.id, user.email, "blocked_dns_confirm", { metadata: { id } });
      return ok(data);
    }

    if (action === "blocked_dns_dismiss") {
      const id = String(payload?.id ?? "");
      if (!id) return bad("ID obrigatório");
      const { data, error } = await admin
        .from("blocked_dns_servers")
        .update({
          status: "dismissed",
          dismissed_at: new Date().toISOString(),
          confirmed_at: null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("[admin-api] blocked_dns_dismiss", error.message);
        return bad(error.message);
      }
      await logAudit(user.id, user.email, "blocked_dns_dismiss", { metadata: { id } });
      return ok(data);
    }

    if (action === "blocked_dns_reactivate") {
      const id = String(payload?.id ?? "");
      if (!id) return bad("ID obrigatório");
      const { data, error } = await admin
        .from("blocked_dns_servers")
        .update({
          status: "suggested",
          dismissed_at: null,
          confirmed_at: null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("[admin-api] blocked_dns_reactivate", error.message);
        return bad(error.message);
      }
      await logAudit(user.id, user.email, "blocked_dns_reactivate", { metadata: { id } });
      return ok(data);
    }

    // ==========================================================
    // DEMO CREDENTIALS — credenciais de teste para botão da tela de login
    // ==========================================================
    if (action === "demo_credentials_get") {
      const { data, error } = await admin
        .from("demo_credentials")
        .select("server_url, username, password, enabled, updated_at, updated_by")
        .eq("singleton", true)
        .maybeSingle();
      if (error) {
        console.error("[admin-api] demo_credentials_get", error.message);
        return internalError();
      }
      return ok(
        data ?? {
          server_url: "",
          username: "",
          password: "",
          enabled: false,
          updated_at: null,
          updated_by: null,
        },
      );
    }

    if (action === "demo_credentials_update") {
      const server_url = String(payload?.server_url ?? "").trim();
      const username = String(payload?.username ?? "").trim();
      const password = String(payload?.password ?? "");
      const enabled = Boolean(payload?.enabled);

      if (username.length > 200 || password.length > 400 || server_url.length > 500) {
        return bad("Campos muito longos");
      }
      if (enabled && (!username || !password)) {
        return bad("Para ativar, informe usuário e senha");
      }

      const normalizedServer = server_url ? normalizeServer(server_url) : "";

      const { data, error } = await admin
        .from("demo_credentials")
        .upsert(
          {
            singleton: true,
            server_url: normalizedServer,
            username,
            password,
            enabled,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          },
          { onConflict: "singleton" },
        )
        .select("server_url, username, password, enabled, updated_at, updated_by")
        .single();

      if (error) {
        console.error("[admin-api] demo_credentials_update", error.message);
        return bad(error.message);
      }
      await logAudit(user.id, user.email, "demo_credentials_update", {
        metadata: { enabled, server: normalizedServer, username },
      });
      return ok(data);
    }

    return bad("Ação inválida");
  } catch (e) {
    console.error("[admin-api] unhandled", e);
    return internalError();
  }
});
