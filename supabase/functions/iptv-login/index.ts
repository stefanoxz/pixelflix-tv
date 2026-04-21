import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Try multiple User-Agents — different IPTV panels accept different ones.
const USER_AGENTS = [
  "VLC/3.0.20 LibVLC/3.0.20",
  "IPTVSmarters/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Lavf/58.76.100",
];

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function normalizeServer(url: string) {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

async function logEvent(opts: {
  server: string;
  username: string;
  success: boolean;
  reason?: string;
  ua?: string;
  ip?: string;
}) {
  try {
    await admin.from("login_events").insert({
      server_url: normalizeServer(opts.server),
      username: opts.username,
      success: opts.success,
      reason: opts.reason ?? null,
      user_agent: opts.ua ?? null,
      ip_address: opts.ip ?? null,
    });
  } catch (_e) {
    // never fail login because telemetry failed
  }
}

async function tryFetch(url: string): Promise<{ res: Response; ua: string } | { error: string; body?: string }> {
  let lastErr = "Unknown error";
  let lastBody = "";
  for (const ua of USER_AGENTS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": ua, Accept: "application/json, */*" },
        redirect: "follow",
      });
      const text = await res.text();
      if (res.status === 444 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        lastBody = text;
        continue;
      }
      return {
        res: new Response(text, { status: res.status, headers: res.headers }),
        ua,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { error: lastErr, body: lastBody };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ua = req.headers.get("user-agent") ?? undefined;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    undefined;

  try {
    const { server, username, password } = await req.json();
    if (!server || !username || !password) {
      return new Response(JSON.stringify({ error: "Informe servidor, usuário e senha" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = String(server).trim().replace(/\/+$/, "");
    const fullBase = /^https?:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`;
    const normalized = normalizeServer(fullBase);

    // Check blocklist
    const { data: blocked } = await admin
      .from("blocked_servers")
      .select("server_url, reason")
      .eq("server_url", normalized)
      .maybeSingle();

    if (blocked) {
      const reason = blocked.reason || "Servidor bloqueado pelo administrador";
      await logEvent({ server: fullBase, username, success: false, reason: `bloqueado: ${reason}`, ua, ip });
      return new Response(JSON.stringify({ error: `Acesso negado: ${reason}` }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `${fullBase}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    const result = await tryFetch(url);
    if ("error" in result) {
      const body = (result.body || "").trim();
      let msg = `O servidor IPTV recusou a conexão (${result.error}).`;
      if (/suspend/i.test(body)) {
        msg = "Sua conta no servidor IPTV foi suspensa. Entre em contato com o provedor.";
      } else if (/expir|vencid/i.test(body)) {
        msg = "Sua assinatura no servidor IPTV expirou.";
      } else if (body) {
        msg = `Servidor IPTV: "${body.slice(0, 120)}"`;
      } else {
        msg += " Verifique o endereço/DNS ou tente outro servidor.";
      }
      await logEvent({ server: fullBase, username, success: false, reason: msg, ua, ip });
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { res } = result;
    if (!res.ok) {
      const text = await res.text();
      const msg = `Servidor IPTV retornou ${res.status}: ${text.slice(0, 200) || "sem corpo"}`;
      await logEvent({ server: fullBase, username, success: false, reason: msg, ua, ip });
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data: any;
    const raw = await res.text();
    try {
      data = JSON.parse(raw);
    } catch {
      const msg = `Resposta inválida do servidor (não é JSON): ${raw.slice(0, 200)}`;
      await logEvent({ server: fullBase, username, success: false, reason: msg, ua, ip });
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data?.user_info || data.user_info.auth === 0) {
      await logEvent({ server: fullBase, username, success: false, reason: "credenciais inválidas", ua, ip });
      return new Response(JSON.stringify({ error: "Usuário ou senha inválidos" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logEvent({ server: fullBase, username, success: true, ua, ip });
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
