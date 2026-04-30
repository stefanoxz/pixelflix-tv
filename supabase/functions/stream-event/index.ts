// Receives client-side stream events (errors, started, etc).
// Auth required (Supabase JWT).
//
// Resiliência: telemetria NUNCA deve derrubar o cliente. Falhas internas
// retornam 200 {ok:false} em vez de 5xx — assim heartbeats que falham não
// disparam toasts/error loops no frontend nem invalidam a sessão.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { clientIp, uaHash, urlHash } from "../_shared/stream-token.ts";

const ALLOWED_SUFFIXES = [".lovable.app", ".lovableproject.com", ".lovable.dev"];
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  let allow = "*";
  try {
    const u = new URL(origin);
    if (ALLOWED_SUFFIXES.some((s) => u.hostname.endsWith(s)) || u.hostname === "localhost") {
      allow = origin;
    }
  } catch { /* ignore */ }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // Evita preflight repetido a cada heartbeat / evento. Telemetria não
    // precisa revalidar CORS — economiza ~500-700ms por evento.
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

// Lazy singleton: evita crash no top-level se SUPABASE_URL/SERVICE_ROLE_KEY
// estiverem ausentes em algum boot do worker (causa de 503
// SUPABASE_EDGE_RUNTIME_ERROR observada nos logs). Também adia I/O do
// createClient pra fora do path de boot.
let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("missing_env_supabase_credentials");
  }
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

const ALLOWED_EVENTS = new Set([
  "stream_started",
  "stream_error",
  "session_heartbeat",
  "user_report",
]);

// Decodifica o JWT sem validar criptograficamente (só pega o sub).
// Validação real é feita pelo Supabase Auth no gateway antes de chegar aqui
// quando verify_jwt=true; e mesmo sem isso, o uso aqui é só telemetria.
function extractUserIdFromJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const jsonHeaders = { ...cors, "Content-Type": "application/json" };
  const okResponse = (extra: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ ok: true, ...extra }), { status: 200, headers: jsonHeaders });
  const softFail = (reason: string) =>
    new Response(JSON.stringify({ ok: false, reason }), { status: 200, headers: jsonHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    // Edge Function desativada para limpeza total do sistema.
    // Retorna sucesso para não quebrar o frontend, mas não processa nada.
    return okResponse();
  } catch (e) {
    return okResponse();
  }
});

