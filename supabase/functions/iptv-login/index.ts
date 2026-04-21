import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const USER_AGENTS = [
  "VLC/3.0.20 LibVLC/3.0.20",
  "IPTVSmarters/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Lavf/58.76.100",
];

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const NO_ACCESS_MSG =
  "Você não tem acesso a esta plataforma. Entre em contato com a sua revenda para liberar o seu servidor (DNS).";

function normalizeServer(url: string) {
  let u = url.trim().toLowerCase();
  if (!/^https?:\/\//.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, "");
}

function hostKey(url: string) {
  return normalizeServer(url).replace(/^https?:\/\//, "");
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

async function attemptLogin(serverBase: string, username: string, password: string) {
  const url = `${serverBase}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  const result = await tryFetch(url);
  if ("error" in result) {
    return { ok: false as const, status: 502, reason: result.error, body: result.body ?? "" };
  }
  const { res } = result;
  if (!res.ok) {
    const text = await res.text();
    return { ok: false as const, status: res.status, reason: `HTTP ${res.status}`, body: text };
  }
  const raw = await res.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false as const, status: 502, reason: "resposta não JSON", body: raw };
  }
  if (!data?.user_info || data.user_info.auth === 0) {
    return { ok: false as const, status: 401, reason: "credenciais inválidas", body: raw };
  }
  return { ok: true as const, data };
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
    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Informe usuário e senha" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load allowlist
    const { data: allowedRows } = await admin.from("allowed_servers").select("server_url");
    const allowedList = (allowedRows ?? []).map((r: any) => normalizeServer(r.server_url));

    if (allowedList.length === 0) {
      await logEvent({ server: server ?? "-", username, success: false, reason: "nenhuma DNS cadastrada", ua, ip });
      return new Response(JSON.stringify({ error: NO_ACCESS_MSG }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If client sent a server, validate it's in allowlist; otherwise try all allowed servers
    let candidates: string[] = [];
    if (server) {
      const baseUrl = String(server).trim().replace(/\/+$/, "");
      const fullBase = /^https?:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`;
      const normalized = normalizeServer(fullBase);
      const inputHost = hostKey(fullBase);
      const match = allowedList.find((a) => a === normalized || hostKey(a) === inputHost);
      if (!match) {
        await logEvent({ server: fullBase, username, success: false, reason: "DNS não autorizada", ua, ip });
        return new Response(JSON.stringify({ error: NO_ACCESS_MSG }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      candidates = [match];
    } else {
      candidates = allowedList;
    }

    // Try each candidate server until one authenticates
    let lastReason = "credenciais inválidas";
    for (const base of candidates) {
      const r = await attemptLogin(base, username, password);
      if (r.ok) {
        await logEvent({ server: base, username, success: true, ua, ip });
        return new Response(JSON.stringify({ ...r.data, server_url: base }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      lastReason = r.reason;
      // Log each failed attempt for admin visibility
      await logEvent({ server: base, username, success: false, reason: r.reason, ua, ip });
    }

    // Nothing worked
    return new Response(JSON.stringify({ error: `Usuário ou senha inválidos (${lastReason})` }), {
      status: 401,
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
