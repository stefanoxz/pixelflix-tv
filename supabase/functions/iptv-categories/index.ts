import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { server, username, password, action, ...extra } = body ?? {};
    if (!server || !username || !password || !action) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = String(server).replace(/\/+$/, "");
    const params = new URLSearchParams({
      username: String(username),
      password: String(password),
      action: String(action),
    });
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== null) params.append(k, String(v));
    }
    const url = `${baseUrl}/player_api.php?${params.toString()}`;

    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `IPTV server error: ${res.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();

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
