import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "admin123";
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function unauthorized() {
  return new Response(JSON.stringify({ error: "Não autorizado" }), {
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

function normalizeServer(url: string) {
  let u = url.trim().toLowerCase();
  if (!/^https?:\/\//.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { token, action, payload } = body as {
      token?: string;
      action?: string;
      payload?: any;
    };

    if (!token || token !== ADMIN_PASSWORD) return unauthorized();

    if (action === "stats") {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const [eventsTotal, events24h, success24h, fail24h, online1h, distinctUsers, distinctServers, blocked] =
        await Promise.all([
          admin.from("login_events").select("id", { count: "exact", head: true }),
          admin.from("login_events").select("id", { count: "exact", head: true }).gte("created_at", since24h),
          admin
            .from("login_events")
            .select("id", { count: "exact", head: true })
            .gte("created_at", since24h)
            .eq("success", true),
          admin
            .from("login_events")
            .select("id", { count: "exact", head: true })
            .gte("created_at", since24h)
            .eq("success", false),
          admin
            .from("login_events")
            .select("username")
            .gte("created_at", since1h)
            .eq("success", true),
          admin.from("login_events").select("username").eq("success", true),
          admin.from("login_events").select("server_url").eq("success", true),
          admin.from("blocked_servers").select("id", { count: "exact", head: true }),
        ]);

      const onlineSet = new Set((online1h.data ?? []).map((r: any) => r.username));
      const usersSet = new Set((distinctUsers.data ?? []).map((r: any) => r.username));
      const serversSet = new Set((distinctServers.data ?? []).map((r: any) => r.server_url));

      return ok({
        totalEvents: eventsTotal.count ?? 0,
        events24h: events24h.count ?? 0,
        success24h: success24h.count ?? 0,
        fail24h: fail24h.count ?? 0,
        onlineNow: onlineSet.size,
        totalUsers: usersSet.size,
        totalServers: serversSet.size,
        blockedServers: blocked.count ?? 0,
      });
    }

    if (action === "list_users") {
      // Last successful login per username
      const { data, error } = await admin
        .from("login_events")
        .select("username, server_url, created_at, success")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) return bad(error.message, 500);

      const map = new Map<string, any>();
      for (const row of data ?? []) {
        const key = row.username;
        if (!map.has(key)) {
          map.set(key, {
            username: key,
            last_server: row.server_url,
            last_login: row.created_at,
            last_success: row.success,
            total: 0,
          });
        }
        map.get(key).total += 1;
      }
      return ok({ users: Array.from(map.values()) });
    }

    if (action === "list_servers") {
      const { data: events, error: evErr } = await admin
        .from("login_events")
        .select("server_url, success, created_at, username")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (evErr) return bad(evErr.message, 500);

      const { data: blocks, error: blErr } = await admin
        .from("blocked_servers")
        .select("server_url, reason, created_at");
      if (blErr) return bad(blErr.message, 500);
      const blockedMap = new Map((blocks ?? []).map((b: any) => [b.server_url, b]));

      const map = new Map<string, any>();
      for (const row of events ?? []) {
        const key = row.server_url;
        if (!map.has(key)) {
          map.set(key, {
            server_url: key,
            last_seen: row.created_at,
            total_logins: 0,
            success_count: 0,
            fail_count: 0,
            users: new Set<string>(),
            blocked: blockedMap.has(key),
            block_reason: blockedMap.get(key)?.reason ?? null,
          });
        }
        const item = map.get(key);
        item.total_logins += 1;
        if (row.success) item.success_count += 1;
        else item.fail_count += 1;
        item.users.add(row.username);
      }
      // include blocked-only servers (no events yet)
      for (const b of blocks ?? []) {
        if (!map.has(b.server_url)) {
          map.set(b.server_url, {
            server_url: b.server_url,
            last_seen: b.created_at,
            total_logins: 0,
            success_count: 0,
            fail_count: 0,
            users: new Set<string>(),
            blocked: true,
            block_reason: b.reason,
          });
        }
      }
      const servers = Array.from(map.values()).map((s) => ({
        ...s,
        unique_users: s.users.size,
        users: undefined,
      }));
      servers.sort((a, b) => (a.last_seen < b.last_seen ? 1 : -1));
      return ok({ servers });
    }

    if (action === "recent_events") {
      const limit = Math.min(Number(payload?.limit ?? 50), 200);
      const { data, error } = await admin
        .from("login_events")
        .select("id, username, server_url, success, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return bad(error.message, 500);
      return ok({ events: data ?? [] });
    }

    if (action === "block_server") {
      const url = normalizeServer(String(payload?.server_url ?? ""));
      if (!url) return bad("URL do servidor é obrigatória");
      const reason = (payload?.reason as string | undefined)?.slice(0, 280) ?? null;
      const { error } = await admin
        .from("blocked_servers")
        .upsert({ server_url: url, reason }, { onConflict: "server_url" });
      if (error) return bad(error.message, 500);
      return ok({ ok: true, server_url: url });
    }

    if (action === "unblock_server") {
      const url = normalizeServer(String(payload?.server_url ?? ""));
      if (!url) return bad("URL do servidor é obrigatória");
      const { error } = await admin.from("blocked_servers").delete().eq("server_url", url);
      if (error) return bad(error.message, 500);
      return ok({ ok: true });
    }

    return bad("Ação inválida");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return bad(msg, 500);
  }
});
