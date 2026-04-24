import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

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

interface PingResult {
  url: string;
  online: boolean;
  latency: number | null;
  status: number | null;
  error?: string;
  checked_at: string;
}

async function pingOne(url: string): Promise<PingResult> {
  const checked_at = new Date().toISOString();
  const target = url.replace(/\/+$/, "") + "/player_api.php";
  const start = Date.now();
  try {
    let res = await fetch(target, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    // Alguns servidores Xtream não respondem HEAD (405/501) — fallback para GET
    if (res.status === 405 || res.status === 501) {
      res = await fetch(target, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      try { await res.text(); } catch { /* ignore */ }
    }
    const latency = Date.now() - start;
    return {
      url,
      // Servidor respondeu = está vivo (inclui 401/403 — auth ausente, mas online)
      online: res.ok || res.status === 401 || res.status === 403,
      latency,
      status: res.status,
      checked_at,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = /timeout|timed out|aborted/i.test(message);
    return {
      url,
      online: false,
      latency: null,
      status: null,
      error: isTimeout ? "timeout" : "network",
      checked_at,
    };
  }
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
      .slice(0, 50); // safety cap

    const results = await Promise.all(urls.map(pingOne));
    return json({ results });
  } catch (e) {
    console.error("[check-server] unhandled", e);
    return json({ error: "Erro interno" }, 500);
  }
});
