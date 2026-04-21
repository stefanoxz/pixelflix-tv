import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// Try multiple User-Agents — different IPTV panels accept different ones.
const USER_AGENTS = [
  "VLC/3.0.20 LibVLC/3.0.20",
  "IPTVSmarters/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Lavf/58.76.100",
];

async function tryFetch(url: string): Promise<{ res: Response; ua: string } | { error: string; body?: string }> {
  let lastErr = "Unknown error";
  let lastBody = "";
  for (const ua of USER_AGENTS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": ua, Accept: "application/json, */*" },
        redirect: "follow",
      });
      // Read body up-front so we can surface the real reason (e.g. "account suspended")
      const text = await res.text();
      // 444 / 5xx → try next UA, but remember the body for diagnostics
      if (res.status === 444 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        lastBody = text;
        continue;
      }
      // Re-wrap response with body so caller can read it
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

  try {
    const { server, username, password } = await req.json();
    if (!server || !username || !password) {
      return new Response(JSON.stringify({ error: "Informe servidor, usuário e senha" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = String(server).trim().replace(/\/+$/, "");
    // Ensure protocol present
    const fullBase = /^https?:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`;
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
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { res } = result;
    if (!res.ok) {
      const text = await res.text();
      return new Response(
        JSON.stringify({
          error: `Servidor IPTV retornou ${res.status}: ${text.slice(0, 200) || "sem corpo"}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let data: any;
    const raw = await res.text();
    try {
      data = JSON.parse(raw);
    } catch {
      return new Response(
        JSON.stringify({
          error: `Resposta inválida do servidor (não é JSON): ${raw.slice(0, 200)}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!data?.user_info || data.user_info.auth === 0) {
      return new Response(JSON.stringify({ error: "Usuário ou senha inválidos" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
