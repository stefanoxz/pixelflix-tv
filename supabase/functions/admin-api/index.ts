import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Token simples para o painel admin (mesmo do AdminLogin.tsx)
const ADMIN_TOKEN = Deno.env.get("ADMIN_PASSWORD") ?? "admin-panel-2024";
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

    if (!token || token !== ADMIN_TOKEN) return unauthorized();

    if (action === "stats") {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const [eventsTotal, events24h, success24h, fail24h, online1h, distinctUsers, distinctServers, allowed] =
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
          admin.from("allowed_servers").select("id", { count: "exact", head: true }),
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
        allowedServers: allowed.count ?? 0,
      });
    }

    if (action === "list_users") {
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
      const [{ data: events }, { data: allowed }] = await Promise.all([
        admin
          .from("login_events")
          .select("server_url, success, created_at, username")
          .order("created_at", { ascending: false })
          .limit(2000),
        admin.from("allowed_servers").select("id, server_url, label, notes, created_at"),
      ]);

      // Aggregate stats by server from events
      const stats = new Map<string, any>();
      for (const row of events ?? []) {
        const key = row.server_url;
        if (!stats.has(key)) {
          stats.set(key, {
            last_seen: row.created_at,
            total_logins: 0,
            success_count: 0,
            fail_count: 0,
            users: new Set<string>(),
          });
        }
        const item = stats.get(key);
        item.total_logins += 1;
        if (row.success) item.success_count += 1;
        else item.fail_count += 1;
        item.users.add(row.username);
      }

      // Build allowed list with stats
      const allowedList = (allowed ?? []).map((a: any) => {
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

      // Pending = servers seen in events that are NOT in allowlist (rejected attempts)
      const allowedSet = new Set((allowed ?? []).map((a: any) => a.server_url));
      const pending = Array.from(stats.entries())
        .filter(([url]) => !allowedSet.has(url))
        .map(([url, s]) => ({
          server_url: url,
          last_seen: s.last_seen,
          total_logins: s.total_logins,
          success_count: s.success_count,
          fail_count: s.fail_count,
          unique_users: s.users.size,
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
      if (error) return bad(error.message, 500);
      return ok({ events: data ?? [] });
    }

    if (action === "allow_server") {
      const url = normalizeServer(String(payload?.server_url ?? ""));
      if (!url) return bad("URL do servidor é obrigatória");
      const label = (payload?.label as string | undefined)?.slice(0, 120) ?? null;
      const notes = (payload?.notes as string | undefined)?.slice(0, 500) ?? null;
      const { error } = await admin
        .from("allowed_servers")
        .upsert({ server_url: url, label, notes }, { onConflict: "server_url" });
      if (error) return bad(error.message, 500);
      return ok({ ok: true, server_url: url });
    }

    if (action === "remove_server") {
      const url = normalizeServer(String(payload?.server_url ?? ""));
      if (!url) return bad("URL do servidor é obrigatória");
      const { error } = await admin.from("allowed_servers").delete().eq("server_url", url);
      if (error) return bad(error.message, 500);
      return ok({ ok: true });
    }

    return bad("Ação inválida");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return bad(msg, 500);
  }
});
