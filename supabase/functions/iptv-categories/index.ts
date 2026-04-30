import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const ALLOWED_SUFFIXES = [".lovable.app", ".lovableproject.com", ".lovable.dev"];
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  let allow = "*";
  try {
    const u = new URL(origin);
    if (
      ALLOWED_SUFFIXES.some((s) => u.hostname.endsWith(s)) ||
      u.hostname === "localhost"
    ) {
      allow = origin;
    }
  } catch {
    // ignore invalid origin
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

/**
 * Verifica que o caller tem uma sessão Supabase válida (anônima ou não).
 * Sem isso, qualquer pessoa na internet podia enumerar catálogo / fazer
 * brute-force contra DNS allow-listadas.
 */
async function verifyJwt(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return false;
    return true;
  } catch {
    return false;
  }
}

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

// Cache allowlist for 60s to reduce DB hits.
let cache: { at: number; list: string[] } | null = null;
async function getAllowedServers(): Promise<string[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.list;
  const { data } = await admin.from("allowed_servers").select("server_url");
  const list = (data ?? []).map((r: any) => normalizeServer(r.server_url));
  cache = { at: Date.now(), list };
  return list;
}

const USER_AGENTS = [
  "VLC/3.0.20 LibVLC/3.0.20",
  "IPTVSmarters/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530, 444]);
// Upstream "soft-not-found": painel respondeu mas o endpoint/conta sumiu.
// Tratamos como resposta vazia para não quebrar a UI (evita blank screen).
// 401/403: painel bloqueou a conta/IP nesse endpoint específico.
// 404/410: endpoint/recurso inexistente.
// Em todos os casos, devolvemos payload vazio para manter a UI viva.
const SOFT_NOT_FOUND_STATUSES = new Set([401, 403, 404, 410]);
// Actions que retornam coleção (lista) — quando o painel responde 404/410,
// é seguro devolver `[]`. Para outras actions, devolvemos `null`.
const COLLECTION_ACTIONS = new Set([
  "get_live_categories",
  "get_live_streams",
  "get_vod_categories",
  "get_vod_streams",
  "get_series_categories",
  "get_series",
]);

async function fetchWithRetries(url: string, clientIp?: string, attemptsPerUa = 1): Promise<
  | { ok: true; data: unknown }
  | { ok: false; status: number; reason: string; softNotFound?: boolean }
> {
  let lastStatus = 0;
  let lastReason = "Unknown error";

  for (const ua of USER_AGENTS) {
    for (let attempt = 0; attempt < attemptsPerUa; attempt++) {
      try {
        const headers: Record<string, string> = { 
          "User-Agent": ua, 
          Accept: "application/json, */*" 
        };

        if (clientIp) {
          headers["X-Forwarded-For"] = clientIp;
          headers["X-Real-IP"] = clientIp;
          headers["Client-IP"] = clientIp;
          headers["True-Client-IP"] = clientIp;
          headers["CF-Connecting-IP"] = clientIp;
        }

        const res = await fetch(url, {
          headers,
          redirect: "follow",
        });

        if (TRANSIENT_STATUSES.has(res.status)) {
          lastStatus = res.status;
          lastReason = `HTTP ${res.status}`;
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }

        if (SOFT_NOT_FOUND_STATUSES.has(res.status)) {
          // Tenta ler o corpo: muitos painéis devolvem "LIMITE DE TELAS" /
          // "MAX CONNECTIONS REACHED" com 401/403. Detectamos para
          // sinalizar à UI em vez de devolver lista vazia silenciosa.
          let bodyText = "";
          try { bodyText = (await res.text()).slice(0, 200); } catch { /* ignore */ }
          const upper = bodyText.toUpperCase();
          // Detecta APENAS mensagens explícitas de limite de telas/conexões.
          // Evita falsos positivos com strings genéricas (ex.: "ERRO DE CONEXÃO").
          if (/LIMITE DE TELAS|MAX(IMUM)?[_ ]?CONNECTIONS?[_ ]?REACHED|TOO MANY CONNECTIONS|LIMITE DE CONEX[ÃA]O|CONNECTION[_ ]?LIMIT/.test(upper)) {
            return { ok: false, status: 429, reason: "MAX_CONNECTIONS" };
          }
          return { ok: false, status: res.status, reason: `HTTP ${res.status}`, softNotFound: true };
        }

        if (!res.ok) return { ok: false, status: res.status, reason: `HTTP ${res.status}` };

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
  const corsHeaders = corsFor(req);
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    undefined;
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Exige sessão Supabase válida (anônima ou autenticada). Sem isso, qualquer
  // visitante poderia enumerar catálogo / fazer brute-force contra DNS allow-listadas.
  const authed = await verifyJwt(req);
  if (!authed) {
    return new Response(
      JSON.stringify({ error: "Sessão necessária. Faça login para continuar." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  console.log(`[iptv-categories] Request received: ${req.method} from IP ${ip}`);
  try {
    const body = await req.json();
    const { server, username, password, action, ...extra } = body ?? {};
    if (!server || !username || !password || !action) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate server against allowlist (prevent open-proxy abuse).
    const allowed = await getAllowedServers();
    const baseUrl = String(server).replace(/\/+$/, "");
    const fullBase = /^https?:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`;
    const normalized = normalizeServer(fullBase);
    const inputHost = hostKey(fullBase);
    const match = allowed.find((a) => a === normalized || hostKey(a) === inputHost);
    if (!match) {
      return new Response(JSON.stringify({ error: NO_ACCESS_MSG }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({
      username: String(username),
      password: String(password),
      action: String(action),
    });
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== null) params.append(k, String(v));
    }
    const url = `${match}/player_api.php?${params.toString()}`;
    console.log(`[iptv-categories] Fetching from upstream: ${url.replace(/password=[^&]+/, 'password=***')}`);


    // Retry com backoff quando o painel devolve MAX_CONNECTIONS.
    // Conexões "fantasma" do próprio painel costumam liberar em poucos segundos,
    // mas painéis mais lentos podem precisar de até ~10s.
    let result = await fetchWithRetries(url, ip);
    if (!result.ok && result.reason === "MAX_CONNECTIONS") {
      const delays = [2000, 4000, 8000];
      for (const delay of delays) {
        await new Promise((r) => setTimeout(r, delay));
        result = await fetchWithRetries(url, ip);
        if (result.ok || result.reason !== "MAX_CONNECTIONS") break;
      }
    }

    if (!result.ok) {
      console.error(`[iptv-categories] Upstream error for ${action}: ${result.reason} (status ${result.status})`);
      // Limite de telas/conexões atingido — sinaliza explicitamente à UI.
      if (result.reason === "MAX_CONNECTIONS") {
        return new Response(
          JSON.stringify({
            error: "Limite de telas atingido. Feche outras conexões e tente novamente.",
            code: "MAX_CONNECTIONS",
          }),
          // Não devolvemos HTTP 429 aqui: o erro vem do painel externo e o
          // cliente já trata `code: MAX_CONNECTIONS`. Status 200 evita que o
          // runtime do navegador/Lovable derrube a tela por erro de Edge Function.
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // 401/403/404/410 do painel: trate como "vazio" para a UI continuar viva.
      // Para listas, devolve [] e status 200; para detalhes (ex: get_series_info),
      // devolve null com status 200.
      if (result.softNotFound) {
        const emptyPayload = COLLECTION_ACTIONS.has(String(action)) ? [] : null;
        return new Response(
          JSON.stringify(emptyPayload),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: `IPTV server error: ${result.reason}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
