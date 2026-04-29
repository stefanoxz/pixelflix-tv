// Public endpoint: returns the active demo IPTV credentials (server/user/pass)
// when admin has enabled the "Acesso teste" feature. Returns 404 otherwise so
// the login screen can show a friendly toast.
//
// Security notes:
// - This endpoint is INTENTIONALLY public (no JWT) so any visitor can click
//   "Testar grátis" without signing up.
// - To make trivial scraping/abuse harder, we restrict the response to
//   browser requests coming from our known web origins. A bot can spoof
//   Origin, but this stops casual `curl` scraping showing up in logs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_ORIGINS = new Set<string>([
  "https://supertechweb.lovable.app",
  "https://www.supertech.fun",
  "https://supertech.fun",
  "https://id-preview--1c24e52c-d430-494c-8e08-55923434b0dd.lovable.app",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow lovable preview/sandbox subdomains used during development.
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith(".lovable.app")) return true;
    if (u.hostname.endsWith(".lovableproject.com")) return true;
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

function buildCors(origin: string | null) {
  const allow = isAllowedOrigin(origin) ? origin! : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = buildCors(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Block requests that don't come from a browser on a known origin.
  // This stops casual scraping (curl with no Origin, random bots).
  if (!isAllowedOrigin(origin)) {
    return new Response(
      JSON.stringify({ enabled: false }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("demo_credentials")
      .select("server_url, username, password, enabled")
      .eq("singleton", true)
      .maybeSingle();

    if (error) throw error;

    if (
      !data ||
      !data.enabled ||
      !data.username ||
      !data.password
    ) {
      return new Response(
        JSON.stringify({ enabled: false }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        enabled: true,
        server_url: data.server_url || "",
        username: data.username,
        password: data.password,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[demo-creds]", err);
    return new Response(
      JSON.stringify({ error: "Erro ao carregar credenciais de teste" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
