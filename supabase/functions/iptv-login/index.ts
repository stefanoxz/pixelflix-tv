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

// VLC é o User-Agent padrão (servidores Xtream aceitam quase universalmente).
// Os fallbacks só entram em jogo quando a resposta indica anti-scraping
// (HTTP 403/444), nunca em loop cego — isso elimina ~75% das requisições.
const PRIMARY_UA = "VLC/3.0.20 LibVLC/3.0.20";
const FALLBACK_UAS = [
  "IPTVSmarters/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Lavf/58.76.100",
];

// Timeout agressivo em cada fetch — sockets pendurados são a maior fonte
// de eventos `reset/timeout` no dashboard.
const FETCH_TIMEOUT_MS = 4000;

// Cooldown automático foi removido — toda tentativa de login é executada de fato.
// Mantemos apenas o contador `consecutive_failures` (estatística para o admin).

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

/**
 * Resposta de erro PADRONIZADA — sempre HTTP 200 + JSON.
 * Frontend nunca vê isso como "edge function returned 4xx/5xx".
 *
 * code: INVALID_CREDENTIALS | SERVER_UNREACHABLE | DNS_ERROR | TIMEOUT |
 *       NOT_ALLOWED | BAD_REQUEST | SERVICE_UNAVAILABLE | UNKNOWN_ERROR
 */
function errorResponse(
  code: string,
  error: string,
  cors: Record<string, string>,
  extra: Record<string, unknown> = {},
) {
  return new Response(
    JSON.stringify({ success: false, code, error, ...extra }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
}

/** Mapeia uma string de motivo (vinda de attemptLogin) para um código padronizado. */
function classifyReason(reason: string): { code: string; message: string } {
  const r = (reason || "").toLowerCase();
  if (/credenc|invalid|auth=0|unauthor|401/.test(r)) {
    return { code: "INVALID_CREDENTIALS", message: "Usuário ou senha inválidos" };
  }
  if (/timeout|timed out|deadline|i\/o timeout/.test(r)) {
    return {
      code: "TIMEOUT",
      message: "Tempo esgotado ao contatar o servidor IPTV. Servidor pode estar lento ou bloqueado.",
    };
  }
  // Connection refused = porta fechada / serviço offline. Mensagem específica
  // para que o admin saiba que provavelmente é problema de protocolo/porta.
  if (/connection refused|os error 111|econnrefused/.test(r)) {
    return {
      code: "SERVER_UNREACHABLE",
      message:
        "Servidor recusou a conexão. A porta pode estar fechada — verifique se a DNS deve usar HTTP/HTTPS ou uma porta específica (ex: :8080).",
    };
  }
  // Reset by peer = geralmente UA bloqueado ou firewall ativo.
  if (/connection reset|reset by peer|os error 104|econnreset/.test(r)) {
    return {
      code: "SERVER_UNREACHABLE",
      message: "Servidor encerrou a conexão (possível bloqueio por User-Agent ou firewall).",
    };
  }
  // TLS/cert: cair pra HTTP costuma resolver, mas isso é cadastro do admin.
  if (/tls|ssl|certificate|handshake|unrecognisedname|fatal alert|cert.*invalid/.test(r)) {
    return {
      code: "SERVER_UNREACHABLE",
      message: "Erro de certificado/TLS. Tente cadastrar a DNS como HTTP (sem 's') se o servidor não tiver SSL válido.",
    };
  }
  if (/no route to host|ehostunreach/.test(r)) {
    return {
      code: "SERVER_UNREACHABLE",
      message: "Sem rota até o servidor. DNS pode estar offline ou com firewall bloqueando.",
    };
  }
  if (/getaddrinfo|name resolution|enotfound|nxdomain|^dns |name or service not known/.test(r)) {
    return {
      code: "DNS_ERROR",
      message: "Hostname não resolveu. Verifique se o endereço está correto.",
    };
  }
  if (/http\s*5\d\d|bad gateway|service unavailable/.test(r)) {
    return {
      code: "SERVER_UNREACHABLE",
      message: "Servidor IPTV retornou erro interno. Tente novamente em alguns minutos.",
    };
  }
  if (/http\s*44[34]/.test(r)) {
    return {
      code: "SERVER_UNREACHABLE",
      message: "Servidor recusou a requisição (provável bloqueio anti-scraping).",
    };
  }
  if (/verifique a dns|servidor iptv não respondeu|unreach/.test(r)) {
    return {
      code: "SERVER_UNREACHABLE",
      message: "Servidor IPTV não respondeu. Confirme com sua revenda se essa DNS ainda está ativa.",
    };
  }
  return { code: "UNKNOWN_ERROR", message: reason || "Erro desconhecido ao contatar o servidor" };
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

/** Erros de TLS/conexão recuperáveis trocando https→http. */
function isTlsOrConnectError(msg: string): boolean {
  return /UnrecognisedName|fatal alert|tls|certificate|ssl|handshake|Connect|ConnectionRefused|ConnectionReset/i
    .test(msg);
}

/** True para respostas que indicam anti-scraping — vale tentar outro UA. */
function shouldRetryWithFallbackUa(status: number): boolean {
  return status === 403 || status === 444;
}

/**
 * Faz UM fetch com timeout. NÃO tenta múltiplos UAs nem repete — quem decide
 * fallback é o caller (attemptLogin), com base no status HTTP.
 */
async function fetchOnce(
  url: string,
  ua: string,
): Promise<{ res: Response; body: string } | { error: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ua, Accept: "application/json, */*" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = await res.text();
    return { res, body };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

type Phase = "fast" | "fallback";

/**
 * FASE 1 (fast):  http://host, :80, :8080, https://host, :443
 * FASE 2 (slow):  portas IPTV exóticas (2052, 2082, 2095, 8880)
 *
 * O caller só entra na fase 2 se a fase 1 inteira falhou por transporte
 * (sem nenhum HTTP responder). Isso reduz drasticamente o número de
 * sockets abertos contra DNS que respondem rápido.
 */
function buildVariants(serverBase: string, phase: Phase): string[] {
  const variants = new Set<string>();
  const stripped = serverBase.trim().replace(/\/+$/, "");
  let hostPort = stripped;
  // Detectamos o esquema ORIGINAL cadastrado. Se admin cadastrou http://,
  // priorizamos http; se https://, priorizamos https. Isso evita o bug
  // do "Black" (bkpac.cc) que era cadastrado http mas só recebia tentativas
  // https → connection refused na 443.
  let originalScheme: "http" | "https" | null = null;
  const m = stripped.match(/^(https?):\/\/(.+)$/i);
  if (m) {
    originalScheme = m[1].toLowerCase() as "http" | "https";
    hostPort = m[2];
  }
  hostPort = hostPort.replace(/\s+/g, "");
  if (!hostPort) return [];

  const hasPort = /:\d+$/.test(hostPort);
  const host = hasPort ? hostPort.replace(/:\d+$/, "") : hostPort;

  const candidates: string[] = [];
  // Default: assume HTTP se nada foi declarado (IPTV é majoritariamente HTTP).
  const primary = originalScheme ?? "http";
  const secondary = primary === "http" ? "https" : "http";

  if (phase === "fast") {
    // Schema PRIMÁRIO primeiro, em todas as portas razoáveis.
    candidates.push(`${primary}://${hostPort}`);
    if (!hasPort) {
      if (primary === "http") {
        candidates.push(`http://${host}:80`, `http://${host}:8080`);
      } else {
        candidates.push(`https://${host}:443`);
      }
    }
    // Schema SECUNDÁRIO depois — só como alternativa.
    candidates.push(`${secondary}://${hostPort}`);
    if (!hasPort) {
      if (secondary === "http") {
        candidates.push(`http://${host}:80`, `http://${host}:8080`);
      } else {
        candidates.push(`https://${host}:443`);
      }
    }
  } else {
    // FASE 2 — portas IPTV exóticas, no schema primário.
    if (!hasPort) {
      const proto = primary;
      candidates.push(
        `${proto}://${host}:2052`,
        `${proto}://${host}:2082`,
        `${proto}://${host}:8880`,
        `${proto}://${host}:2095`,
      );
    }
  }

  for (const c of candidates) {
    try {
      new URL(c);
      variants.add(c);
    } catch { /* skip invalid */ }
  }
  return [...variants];
}

/** Resolve duração de cooldown a partir do número de falhas consecutivas. */
function cooldownMs(consecutiveFailures: number): number {
  const idx = Math.min(
    Math.max(consecutiveFailures - COOLDOWN_THRESHOLD, 0),
    COOLDOWN_STEPS_MS.length - 1,
  );
  return COOLDOWN_STEPS_MS[idx];
}

/**
 * Tenta uma única variante (URL completa do player_api). Aplica fallback de UA
 * SOMENTE se o servidor responder com 403/444. Para qualquer outro caso
 * (sucesso, 401, 5xx, timeout, TLS) retorna direto — quem decide é o caller.
 */
async function tryVariant(
  base: string,
  username: string,
  password: string,
): Promise<
  | { ok: true; data: any; usedVariant: string }
  | { ok: false; status: number; body: string; reason: string }
  | { ok: false; transportError: string }
> {
  const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  const uas = [PRIMARY_UA, ...FALLBACK_UAS];

  for (let i = 0; i < uas.length; i++) {
    const r = await fetchOnce(url, uas[i]);
    if ("error" in r) {
      // Erro de transporte — UA não muda nada. Aborta cedo.
      return { ok: false, transportError: r.error };
    }
    const { res, body } = r;
    // Anti-scraping → vale a pena tentar próximo UA.
    if (shouldRetryWithFallbackUa(res.status) && i < uas.length - 1) continue;

    if (res.status === 401) {
      return { ok: false, status: 401, body, reason: "credenciais inválidas" };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, body, reason: `HTTP ${res.status}` };
    }
    let data: any;
    try {
      data = JSON.parse(body);
    } catch {
      return { ok: false, status: 200, body, reason: "resposta não JSON" };
    }
    if (!data?.user_info || data.user_info.auth === 0) {
      return { ok: false, status: 401, body, reason: "credenciais inválidas" };
    }
    return { ok: true, data, usedVariant: base };
  }

  // unreachable, mas TS exige
  return { ok: false, transportError: "no_attempts" };
}

/**
 * Fluxo principal de login para uma DNS:
 *   0. Se DNS está em cooldown → retorna SERVER_UNREACHABLE imediatamente.
 *   1. Cache: tenta `last_working_variant` antes de tudo.
 *   2. FASE 1 (rápida): variantes mais prováveis.
 *   3. FASE 2 (fallback): portas IPTV exóticas, só se fase 1 falhou por transporte.
 *   4. Em sucesso: salva `last_working_variant` + zera contador de falhas.
 *   5. Em falha total: incrementa contador e ativa cooldown se passar do limite.
 */
async function attemptLogin(
  serverBase: string,
  username: string,
  password: string,
  serverRow: { id?: string; last_working_variant?: string | null; consecutive_failures?: number; unreachable_until?: string | null } | null,
  admin: any,
) {
  // 0) Cooldown ativo → não faz nem um fetch. Para de inflar logs.
  if (serverRow?.unreachable_until) {
    const until = new Date(serverRow.unreachable_until).getTime();
    if (until > Date.now()) {
      return {
        ok: false as const,
        status: 503,
        reason: `cooldown ativo até ${serverRow.unreachable_until}`,
        body: "",
        skipped: true as const,
      };
    }
  }

  // 1) Monta lista de variantes: cache primeiro, depois fase 1.
  const fast = buildVariants(serverBase, "fast");
  const cached = serverRow?.last_working_variant;
  const phase1 = cached
    ? [cached, ...fast.filter((v) => v !== cached)]
    : fast;

  let lastReason = "credenciais inválidas";
  let lastBody = "";
  let anyHttpResponded = false;

  const runVariants = async (vs: string[]) => {
    for (const base of vs) {
      const r = await tryVariant(base, username, password);

      if ("transportError" in r) {
        lastReason = r.transportError;
        continue;
      }
      if (base.startsWith("http://")) anyHttpResponded = true;
      if (r.ok) return r;

      lastReason = r.reason;
      lastBody = r.body;

      // Resposta legítima do servidor (401 = cred inválida) → encerra.
      if (r.status === 401) return r;
      // Outras respostas HTTP do servidor (403/404/5xx) também encerram —
      // não é um problema de transporte que outra porta resolveria.
      if (r.status >= 400 && r.status < 600 && r.status !== 444) return r;
    }
    return null;
  };

  // FASE 1
  const r1 = await runVariants(phase1);
  if (r1?.ok) {
    await markServerHealthy(admin, serverRow, r1.usedVariant);
    return r1;
  }
  if (r1 && !r1.ok) {
    // Resposta definitiva do servidor (401/4xx/5xx) — não vai pra fase 2.
    await markServerFailure(admin, serverRow);
    return { ok: false as const, status: r1.status, reason: r1.reason, body: r1.body };
  }

  // FASE 2 — só rola se nenhum HTTP respondeu.
  if (!anyHttpResponded) {
    const phase2 = buildVariants(serverBase, "fallback");
    const r2 = await runVariants(phase2);
    if (r2?.ok) {
      await markServerHealthy(admin, serverRow, r2.usedVariant);
      return r2;
    }
    if (r2 && !r2.ok) {
      await markServerFailure(admin, serverRow);
      return { ok: false as const, status: r2.status, reason: r2.reason, body: r2.body };
    }
  }

  // Falha total por transporte. Preserva a mensagem original (refused/reset/tls)
  // para o admin classificar corretamente no dashboard.
  await markServerFailure(admin, serverRow);
  return { ok: false as const, status: 502, reason: lastReason, body: lastBody };
}

/** Persiste a variante que funcionou + zera contador de falhas. Best-effort. */
async function markServerHealthy(
  admin: any,
  serverRow: { id?: string; last_working_variant?: string | null } | null,
  usedVariant: string,
) {
  if (!serverRow?.id) return;
  try {
    await admin
      .from("allowed_servers")
      .update({
        last_working_variant: usedVariant,
        last_working_at: new Date().toISOString(),
        consecutive_failures: 0,
        unreachable_until: null,
      })
      .eq("id", serverRow.id);
  } catch (err) {
    console.warn("[iptv-login] markServerHealthy failed", err);
  }
}

/** Incrementa contador e ativa cooldown progressivo se passar do limite. */
async function markServerFailure(
  admin: any,
  serverRow: { id?: string; consecutive_failures?: number } | null,
) {
  if (!serverRow?.id) return;
  const next = (serverRow.consecutive_failures ?? 0) + 1;
  const patch: Record<string, unknown> = { consecutive_failures: next };
  if (next >= COOLDOWN_THRESHOLD) {
    patch.unreachable_until = new Date(Date.now() + cooldownMs(next)).toISOString();
  }
  try {
    await admin.from("allowed_servers").update(patch).eq("id", serverRow.id);
  } catch (err) {
    console.warn("[iptv-login] markServerFailure failed", err);
  }
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
      return errorResponse("BAD_REQUEST", "Body inválido", corsHeaders);
    }

    const { mode, server, username, password } = body || {};
    let admin: any;
    try {
      admin = getAdminClient();
    } catch {
      return errorResponse(
        "SERVICE_UNAVAILABLE",
        "Configuração do servidor ausente",
        corsHeaders,
      );
    }

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
        return errorResponse(
          "SERVICE_UNAVAILABLE",
          "Serviço temporariamente indisponível",
          corsHeaders,
        );
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
        return errorResponse(
          "BAD_REQUEST",
          "log requer server e username",
          corsHeaders,
        );
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
      return errorResponse("BAD_REQUEST", "Informe usuário e senha", corsHeaders);
    }

    // Load allowlist (com colunas de cache/cooldown)
    let allowedRows: any[] | null = null;
    try {
      const result = await admin
        .from("allowed_servers")
        .select("id, server_url, last_working_variant, consecutive_failures, unreachable_until");
      if (result.error) throw result.error;
      allowedRows = result.data;
    } catch (err) {
      console.error("[iptv-login] db error", err);
      return errorResponse(
        "SERVICE_UNAVAILABLE",
        "Serviço temporariamente indisponível",
        corsHeaders,
      );
    }

    type ServerRow = {
      id: string;
      server_url: string;
      last_working_variant: string | null;
      consecutive_failures: number;
      unreachable_until: string | null;
    };
    const allRows: ServerRow[] = (allowedRows ?? []).map((r: any) => ({
      id: r.id,
      server_url: normalizeServer(r.server_url),
      last_working_variant: r.last_working_variant ?? null,
      consecutive_failures: r.consecutive_failures ?? 0,
      unreachable_until: r.unreachable_until ?? null,
    }));
    const allowedList = allRows.map((r) => r.server_url);

    if (allowedList.length === 0) {
      await logEvent({ server: server ?? "-", username, success: false, reason: "nenhuma DNS cadastrada", ua, ip });
      return errorResponse("NOT_ALLOWED", NO_ACCESS_MSG, corsHeaders);
    }

    // If client sent a server, validate it's in allowlist; otherwise try all allowed servers
    let candidateRows: ServerRow[] = [];
    if (server) {
      const baseUrl = String(server).trim().replace(/\/+$/, "");
      const fullBase = /^https?:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`;
      const normalized = normalizeServer(fullBase);
      const inputHost = hostKey(fullBase);
      const match = allRows.find(
        (r) => r.server_url === normalized || hostKey(r.server_url) === inputHost,
      );
      if (!match) {
        await logEvent({ server: fullBase, username, success: false, reason: "DNS não autorizada", ua, ip });
        return errorResponse("NOT_ALLOWED", NO_ACCESS_MSG, corsHeaders);
      }
      candidateRows = [match];
    } else {
      candidateRows = allRows;
    }

    // Try each candidate server until one authenticates
    let lastReason = "credenciais inválidas";
    for (const row of candidateRows) {
      const r = await attemptLogin(row.server_url, username, password, row, admin);
      if (r.ok) {
        await logEvent({ server: row.server_url, username, success: true, ua, ip });
        return jsonResponse(
          200,
          { success: true, ...r.data, server_url: row.server_url, allowed_servers: allowedList },
          corsHeaders,
        );
      }
      lastReason = r.reason;
      // Em cooldown: NÃO loga (a ideia é justamente parar de poluir o dashboard).
      if (!("skipped" in r && r.skipped)) {
        await logEvent({ server: row.server_url, username, success: false, reason: r.reason, ua, ip });
      }
    }

    const { code, message } = classifyReason(lastReason);
    return errorResponse(code, message, corsHeaders, { reason: lastReason });
  } catch (err) {
    console.error("[iptv-login] fatal", err);
    const msg = err instanceof Error ? err.message : String(err);
    // Erros inesperados → 500 com JSON estruturado (cliente também trata).
    return new Response(
      JSON.stringify({
        success: false,
        code: "UNKNOWN_ERROR",
        error: "Erro interno do servidor",
        detail: msg,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
