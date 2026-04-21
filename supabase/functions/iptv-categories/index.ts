import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const USER_AGENTS = [
  "VLC/3.0.20 LibVLC/3.0.20",
  "IPTVSmarters/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Lavf/58.76.100",
];

// Status codes worth retrying with a different UA / another attempt.
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530, 444]);

async function fetchWithRetries(url: string, attemptsPerUa = 2): Promise<{ ok: true; data: unknown } | { ok: false; status: number; reason: string }> {
  let lastStatus = 0;
  let lastReason = "Unknown error";

  for (const ua of USER_AGENTS) {
    for (let attempt = 0; attempt < attemptsPerUa; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": ua,
            Accept: "application/json, */*",
          },
          redirect: "follow",
        });

        if (TRANSIENT_STATUSES.has(res.status)) {
          lastStatus = res.status;
          lastReason = `HTTP ${res.status}`;
          // small backoff
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }

        if (!res.ok) {
          return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
        }

        const text = await res.text();
        try {
          return { ok: true, data: JSON.parse(text) };
        } catch {
          return { ok: false, status: 502, reason: "resposta não JSON" };
        }
      } catch (e) {
        lastStatus = 502;
        lastReason = e instanceof Error ? e.message : String(e);
      }
    }
  }

  return { ok: false, status: lastStatus || 502, reason: lastReason };
}

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

    const result = await fetchWithRetries(url);
    if (!result.ok) {
      return new Response(
        JSON.stringify({ error: `IPTV server error: ${result.reason}` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(result.data), {
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
