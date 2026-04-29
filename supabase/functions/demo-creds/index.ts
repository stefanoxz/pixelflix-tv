// Public endpoint: returns the active demo IPTV credentials (server/user/pass)
// when admin has enabled the "Acesso teste" feature. Returns 404 otherwise so
// the login screen can show a friendly toast.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
