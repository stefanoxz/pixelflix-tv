import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

console.log("[iptv-login] boot");

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

const USER_AGENTS = [
  "VLC/3.0.20 LibVLC/3.0.20",
  "IPTVSmarters/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Lavf/58.76.100",
];

const NO_ACCESS_MSG =
  "Você não tem acesso a esta plataforma. Entre em contato com a sua revenda para liberar o seu servidor (DNS).";

let _admin: any = null;
function getAdminClient(): any {
  try {
    if (_admin) return _admin;
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log("[iptv-login] env", { hasUrl: !!url, hasKey: !!key });
    if (!url || !key) throw new Error("MISSING_ENV");
    _admin = createClient(url, key, { auth: { persistSession: false } });
    return _admin;
  } catch (err) {
    console.error("[iptv-login] getAdminClient error", err);
    throw err;
  }
}

function jsonResponse(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

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
    const admin = getAdminClient();
    await admin.from("login_events").insert({
      server_url: normalizeServer(opts.server),
      username: opts.username,
      success: opts.success,
      reason: opts.reason ?? null,
      user_agent: opts.ua ?? null,
      ip_address: opts.ip ?? null,
    });
  } catch (err) {
    console.warn("[iptv-login] logEvent failed", err);
    return;
  }
}

async function tryFetch(url: string): Promise<{ res: Response; ua: string } | { error: string; body?: string }> {
  let lastErr = "Unknown error";
  let lastBody = "";
  for (const ua of USER_AGENTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": ua, Accept: "application/json, */*" },
          redirect: "follow",
        });
        const text = await res.text();
        if (res.status === 444 || res.status >= 500) {
          lastErr = `HTTP ${res.status}`;
          lastBody = text;
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          continue;
        }
        return {
          res: new Response(text, { status: res.status, headers: res.headers }),
          ua,
        };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        // Erros de TLS/conexão não são resolvidos trocando User-Agent.
        // Aborta cedo para que o caller tente a próxima variante (HTTP).
        if (isTlsOrConnectError(lastErr)) {
          return { error: lastErr, body: "" };
        }
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }
  return { error: lastErr, body: lastBody };
}

function buildVariants(serverBase: string): string[] {
  const variants = new Set<string>();
  const stripped = serverBase.trim().replace(/\/+$/, "");
  let hostPort = stripped;
  const m = stripped.match(/^(https?):\/\/(.+)$/i);
  if (m) {
    hostPort = m[2];
  }
  hostPort = hostPort.replace(/\s+/g, "");
  if (!hostPort) return [];

  const hasPort = /:\d+$/.test(hostPort);
  const host = hasPort ? hostPort.replace(/:\d+$/, "") : hostPort;

  // Priorizar HTTP sempre primeiro — servidores IPTV Xtream costumam falhar
  // o handshake TLS (SNI / UnrecognisedName / certificado inválido) e
  // funcionar normalmente em HTTP plano.
  const candidates = [
    `http://${hostPort}`,
    `https://${hostPort}`,
  ];
  if (!hasPort) {
    candidates.push(`http://${host}:80`, `http://${host}:8080`, `http://${host}:8000`, `https://${host}:443`);
  }

  for (const c of candidates) {
    try {
      new URL(c);
      variants.add(c);
    } catch {
      // skip invalid variant
    }
  }
  return [...variants];
}

/** Erros de TLS/conexão recuperáveis trocando https→http. */
function isTlsOrConnectError(msg: string): boolean {
  return /UnrecognisedName|fatal alert|tls|certificate|ssl|handshake|Connect|ConnectionRefused|ConnectionReset/i
    .test(msg);
}

async function attemptLogin(serverBase: string, username: string, password: string) {
  const variants = buildVariants(serverBase);
  let lastReason = "credenciais inválidas";
  let lastBody = "";
  let httpResponded = false; // se algum HTTP respondeu (mesmo com falha de cred), não vale a pena tentar HTTPS

  for (const base of variants) {
    // Pula HTTPS se já recebemos qualquer resposta válida via HTTP — evita
    // mascarar a causa real com erro de TLS do upstream.
    if (httpResponded && base.startsWith("https://")) continue;

    const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const result = await tryFetch(url);
    if ("error" in result) {
      // Não sobrescreve um motivo "real" anterior com um erro de TLS.
      if (!isTlsOrConnectError(result.error) || !httpResponded) {
        lastReason = result.error;
        lastBody = result.body ?? "";
      }
      continue;
    }
    const { res } = result;
    if (base.startsWith("http://")) httpResponded = true;
    if (!res.ok) {
      lastReason = `HTTP ${res.status}`;
      lastBody = await res.text();
      continue;
    }
    const raw = await res.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      lastReason = "resposta não JSON";
      lastBody = raw;
      continue;
    }
    if (!data?.user_info || data.user_info.auth === 0) {
      return { ok: false as const, status: 401, reason: "credenciais inválidas", body: raw };
    }
    return { ok: true as const, data };
  }

  // Sanitiza o motivo final: erros de TLS são confusos para o usuário final.
  if (isTlsOrConnectError(lastReason)) {
    lastReason = "servidor IPTV não respondeu (verifique a DNS)";
  }
  return { ok: false as const, status: 502, reason: lastReason, body: lastBody };
}

Deno.serve(async (req) => {
  let corsHeaders: Record<string, string> = {};

  try {
    try {
      corsHeaders = corsFor(req);
    } catch {
      corsHeaders = { "Access-Control-Allow-Origin": "*" };
    }

    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    console.log("[iptv-login] start request");

    const ua = req.headers.get("user-agent") ?? undefined;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      undefined;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "Body inválido" }, corsHeaders);
    }

    const { mode, server, username, password } = body || {};
    const admin = getAdminClient();

    // ---------------------------------------------------------------------
    // Mode: "validate" — apenas confere allowlist e devolve candidatas.
    // Usado pelo fluxo híbrido (browser-first) ANTES de tentar fetch direto.
    // ---------------------------------------------------------------------
    if (mode === "validate") {
      let allowedRows: any[] | null = null;
      try {
        const result = await admin.from("allowed_servers").select("server_url");
        if (result.error) throw result.error;
        allowedRows = result.data;
      } catch (err) {
        console.error("[iptv-login] db error (validate)", err);
        return jsonResponse(503, { error: "Serviço temporariamente indisponível" }, corsHeaders);
      }
      const allowedList = (allowedRows ?? []).map((r: any) => normalizeServer(r.server_url));
      if (allowedList.length === 0) {
        return jsonResponse(200, { allowed: false, error: NO_ACCESS_MSG, candidates: [] }, corsHeaders);
      }
      let candidates: string[] = [];
      if (server) {
        const baseUrl = String(server).trim().replace(/\/+$/, "");
        const fullBase = /^https?:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`;
        const normalized = normalizeServer(fullBase);
        const inputHost = hostKey(fullBase);
        const match = allowedList.find((a) => a === normalized || hostKey(a) === inputHost);
        if (!match) {
          return jsonResponse(200, { allowed: false, error: NO_ACCESS_MSG, candidates: [] }, corsHeaders);
        }
        candidates = [match];
      } else {
        candidates = allowedList;
      }
      return jsonResponse(200, { allowed: true, candidates }, corsHeaders);
    }

    // ---------------------------------------------------------------------
    // Mode: "log" — registra o resultado de um login que aconteceu via browser.
    // Não autentica nada, só insere em login_events (best-effort).
    // ---------------------------------------------------------------------
    if (mode === "log") {
      const { success: logSuccess, reason: logReason } = body || {};
      if (!username || !server) {
        return jsonResponse(400, { error: "log requer server e username" }, corsHeaders);
      }
      await logEvent({
        server: String(server),
        username: String(username),
        success: !!logSuccess,
        reason: logReason ? String(logReason) : (logSuccess ? "browser_login" : "browser_failed"),
        ua,
        ip,
      });
      return jsonResponse(200, { ok: true }, corsHeaders);
    }

    // ---------------------------------------------------------------------
    // Default mode: login completo via edge (fallback do fluxo híbrido,
    // ou fluxo único quando o cliente não usa estratégia browser).
    // ---------------------------------------------------------------------
    if (!username || !password) {
      return jsonResponse(400, { error: "Informe usuário e senha" }, corsHeaders);
    }

    // Load allowlist
    let allowedRows: any[] | null = null;
    try {
      const result = await admin.from("allowed_servers").select("server_url");
      if (result.error) throw result.error;
      allowedRows = result.data;
    } catch (err) {
      console.error("[iptv-login] db error", err);
      return jsonResponse(503, { error: "Serviço temporariamente indisponível" }, corsHeaders);
    }

    const allowedList = (allowedRows ?? []).map((r: any) => normalizeServer(r.server_url));

    if (allowedList.length === 0) {
      await logEvent({ server: server ?? "-", username, success: false, reason: "nenhuma DNS cadastrada", ua, ip });
      return jsonResponse(403, { error: NO_ACCESS_MSG }, corsHeaders);
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
        return jsonResponse(403, { error: NO_ACCESS_MSG }, corsHeaders);
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
        return jsonResponse(
          200,
          { ...r.data, server_url: base, allowed_servers: allowedList },
          corsHeaders,
        );
      }
      lastReason = r.reason;
      await logEvent({ server: base, username, success: false, reason: r.reason, ua, ip });
    }

    return jsonResponse(401, { error: `Usuário ou senha inválidos (${lastReason})` }, corsHeaders);
  } catch (err) {
    console.error("[iptv-login] fatal", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "MISSING_ENV") {
      return jsonResponse(500, { error: "Configuração do servidor ausente" }, corsHeaders);
    }
    return jsonResponse(500, { error: "Erro interno do servidor" }, corsHeaders);
  }
});
