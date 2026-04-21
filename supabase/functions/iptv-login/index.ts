import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// Try multiple User-Agents — different IPTV panels accept different ones.
const USER_AGENTS = [
  "VLC/3.0.20 LibVLC/3.0.20",
  "IPTVSmarters/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Lavf/58.76.100",
];

async function tryFetch(url: string): Promise<{ res: Response; ua: string } | { error: string }> {
  let lastErr = "Unknown error";
  for (const ua of USER_AGENTS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": ua, Accept: "application/json, */*" },
        redirect: "follow",
      });
      // 444 / 5xx → try next UA
      if (res.status === 444 || res.status >= 500) {
        lastErr = `HTTP ${res.status} with UA "${ua}"`;
        try {
          await res.body?.cancel();
        } catch {
          /* ignore */
        }
        continue;
      }
      return { res, ua };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { error: lastErr };
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
      return new Response(
        JSON.stringify({
          error: `O servidor IPTV recusou a conexão (${result.error}). Verifique o endereço/DNS.`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
