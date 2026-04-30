import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Keep module initialization lightweight. Calling proxy/env helpers at boot can
// make cold starts more fragile; request handlers log proxy state when needed.
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
  "IPTV Smarters Pro/2.2.1 (Android/9; SM-G960F)",
  "OttPlayer/2.0.0 (Linux; Tizen 4.0; Samsung SmartTV)",
  "GSE Smart IPTV/7.4 (iPhone; iOS 15.1; Scale/3.00)",
  "Perfect Player/1.5.9.1",
  "Xtream-Player/3.0",
  "XCIPTV/4.0",
  "AppleCoreMedia/1.0.0.19B88 (iPhone; iPhone OS 15_1; en_us)",
  "TiviMate/4.7.0 (Android/11; Sony TV)",
  "Player/4.0 (Linux;Android 11) SmartersPlayer/4.0",
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
  // Observação: "limite de telas" NÃO entra mais como erro aqui. Quando o
  // painel responde com auth=1 + telas cheias, `tryVariant` devolve sucesso
  // com `at_connection_limit: true` e o cliente exibe só um aviso. Esta
  // função só é chamada para falhas reais (auth=0, transporte, etc.).
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
  if (/http\s*404/.test(r)) {
    return {
      code: "SERVER_UNREACHABLE",
      message:
        "O servidor respondeu, mas o endpoint Xtream não foi encontrado (HTTP 404). A DNS pode estar desatualizada — peça uma URL M3U nova ao seu provedor.",
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

/**
 * Detecta o padrão "404 com corpo curto não-JSON" — típico de Cloudflare na
 * frente de um origin Xtream desligado. Devolve uma dica amigável ou null.
 * NÃO altera status HTTP nem código de erro — só anexa um campo `hint`.
 */
function maybeOriginSuspectHint(status: number | undefined, body: string | undefined): string | null {
  if (status !== 404) return null;
  const b = (body ?? "").trim();
  if (!b || b.length > 200) return null;
  try { JSON.parse(b); return null; } catch { /* não é JSON, segue */ }
  return "O servidor respondeu mas não parece ser um endpoint Xtream válido. " +
         "Sua DNS pode estar desatualizada — peça uma nova ao provedor.";
}

function normalizeServer(url: string) {
  let u = url.trim().replace(/[\u200B-\u200D\uFEFF]/g, "").toLowerCase();
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
  clientIp?: string,
): Promise<{ res: Response; body: string; route: "direct" | "proxy" } | { error: string }> {
  try {
    const headers: Record<string, string> = { 
      "User-Agent": ua, 
      Accept: "application/json, */*" 
    };

    // IP Spoofing / Simulation headers
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
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = await res.text();
    const route: "direct" | "proxy" = "direct";
    return { res, body, route };
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


/**
 * Tenta uma única variante (URL completa do player_api). Aplica fallback de UA
 * SOMENTE se o servidor responder com 403/444. Para qualquer outro caso
 * (sucesso, 401, 5xx, timeout, TLS) retorna direto — quem decide é o caller.
 *
 * O caminho de erro carrega `contentType` para o caller decidir se vale a pena
 * tentar o fallback de PLAYLIST (`/get.php?type=m3u_plus`) — alguns painéis
 * (ex.: maxtv.uk) só implementam playlist e não Xtream API JSON.
 */
async function tryVariant(
  base: string,
  username: string,
  password: string,
  clientIp?: string,
): Promise<
  | { ok: true; data: any; usedVariant: string; route: "direct" | "proxy" }
  | { ok: false; status: number; body: string; reason: string; contentType?: string }
  | { ok: false; transportError: string }
> {
  const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  const uas = [PRIMARY_UA, ...FALLBACK_UAS];

  for (let i = 0; i < uas.length; i++) {
    const r = await fetchOnce(url, uas[i], clientIp);
    if ("error" in r) {
      return { ok: false, transportError: r.error };
    }
    const { res, body, route } = r;
    if (shouldRetryWithFallbackUa(res.status) && i < uas.length - 1) continue;
    const contentType = res.headers.get("content-type") ?? undefined;

    if (res.status === 401) {
      return { ok: false, status: 401, body, reason: "credenciais inválidas", contentType };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, body, reason: `HTTP ${res.status}`, contentType };
    }
    let data: any;
    try {
      data = JSON.parse(body);
    } catch {
      return { ok: false, status: 200, body, reason: "resposta não JSON", contentType };
    }
    if (!data?.user_info || data.user_info.auth === 0) {
      return { ok: false, status: 401, body, reason: "credenciais inválidas", contentType };
    }
    // Detecta limite de telas/conexões: painel autenticou (auth=1) mas
    // active_cons >= max_connections. ANTES bloqueávamos o login com 429,
    // mas isso impedia o usuário até de navegar pelo catálogo. Agora deixamos
    // entrar e marcamos `at_connection_limit: true` para o cliente avisar
    // só quando o stream realmente falhar — e dar tempo das conexões fantasmas
    // do próprio painel expirarem (alguns levam minutos).
    const maxC = Number(data.user_info.max_connections);
    const actC = Number(data.user_info.active_cons);
    const msg = String(data.user_info.message || "").toUpperCase();
    const atLimit =
      (Number.isFinite(maxC) && Number.isFinite(actC) && maxC > 0 && actC >= maxC) ||
      /LIMITE DE TELAS|MAX[_ ]?CONNECTIONS|TOO MANY CONNECTIONS/.test(msg);
    if (atLimit) {
      data.at_connection_limit = true;
    }
    return { ok: true, data, usedVariant: base, route };
  }

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
  clientIp?: string,
) {
  // Cooldown removido — toda DNS é tentada de fato a cada login.

  // 1) Monta lista de variantes: cache primeiro, depois fase 1.
  const fast = buildVariants(serverBase, "fast");
  const cached = serverRow?.last_working_variant;
  const phase1 = cached
    ? [cached, ...fast.filter((v) => v !== cached)]
    : fast;

  let lastReason = "credenciais inválidas";
  let lastBody = "";
  let lastStatus: number | undefined;
  let lastContentType: string | undefined;
  let lastVariant: string | undefined;
  let anyHttpResponded = false;

  const runVariants = async (vs: string[]) => {
    for (const base of vs) {
      const r = await tryVariant(base, username, password, clientIp);

      if ("transportError" in r) {
        lastReason = r.transportError;
        continue;
      }
      if (base.startsWith("http://")) anyHttpResponded = true;
      if (r.ok) return r;

      lastReason = r.reason;
      lastBody = r.body;
      lastStatus = r.status;
      lastContentType = r.contentType;
      lastVariant = base;

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
    return {
      ok: false as const,
      status: r1.status,
      reason: r1.reason,
      body: r1.body,
      contentType: (r1 as { contentType?: string }).contentType,
      variant: lastVariant,
    };
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
      return {
        ok: false as const,
        status: r2.status,
        reason: r2.reason,
        body: r2.body,
        contentType: (r2 as { contentType?: string }).contentType,
        variant: lastVariant,
      };
    }
  }

  // Falha total por transporte. Preserva a mensagem original (refused/reset/tls)
  // para o admin classificar corretamente no dashboard.
  await markServerFailure(admin, serverRow);
  return {
    ok: false as const,
    status: lastStatus ?? 502,
    reason: lastReason,
    body: lastBody,
    contentType: lastContentType,
    variant: lastVariant,
  };
}

/**
 * Tenta logar em modo PLAYLIST: bate em `/get.php?...&type=m3u_plus` e considera
 * sucesso se o body começa com `#EXTM3U`. É usado como FALLBACK quando o painel
 * responde HTTP 200 em `/player_api.php` mas com conteúdo não-Xtream (HTML,
 * playlist crua, JSON sem `user_info`). Caso típico: maxtv.uk e similares que
 * só implementam M3U e não Xtream API.
 *
 * Quando funciona, devolvemos um `user_info` SINTÉTICO marcado com
 * `message: "playlist-mode"` para o resto do app saber que não tem
 * categorias/EPG via Xtream e cair em fluxos compatíveis.
 */
async function tryPlaylistFallback(
  serverBase: string,
  username: string,
  password: string,
  clientIp?: string,
): Promise<
  | { ok: true; data: any; usedVariant: string }
  | {
      ok: false;
      reason: string;
      attempts: Array<{
        variant: string;
        endpoint: string;
        status?: number;
        contentType?: string | null;
        bodyPreview?: string;
        error?: string;
      }>;
    }
> {
  const variants = buildVariants(serverBase, "fast");
  // Endpoints de playlist mais comuns em painéis Xtream/clones. Cada base
  // (http/https/porta) é combinada com cada endpoint.
  const endpoints = (u: string, p: string) => [
    `/get.php?username=${u}&password=${p}&type=m3u_plus&output=ts`,
    `/get.php?username=${u}&password=${p}&type=m3u_plus`,
    `/get.php?username=${u}&password=${p}&type=m3u`,
    `/playlist/${u}/${p}/m3u_plus`,
  ];
  const u = encodeURIComponent(username);
  const p = encodeURIComponent(password);
  const attempts: Array<{
    variant: string;
    endpoint: string;
    status?: number;
    contentType?: string | null;
    bodyPreview?: string;
    error?: string;
  }> = [];

  for (const base of variants) {
    for (const ep of endpoints(u, p)) {
      const url = `${base}${ep}`;
      const r = await fetchOnce(url, PRIMARY_UA, clientIp);
      if ("error" in r) {
        attempts.push({ variant: base, endpoint: ep, error: r.error });
        // Erro de transporte para esta base — pula os demais endpoints dela.
        break;
      }
      const { res, body } = r;
      const contentType = res.headers.get("content-type");
      const trimmed = (body ?? "").trimStart();
      if (!res.ok || !trimmed.startsWith("#EXTM3U")) {
        attempts.push({
          variant: base,
          endpoint: ep,
          status: res.status,
          contentType,
          bodyPreview: trimmed.slice(0, 160),
        });
        continue;
      }
      // Sucesso — montamos resposta no formato esperado pelo cliente.
      return {
        ok: true,
        usedVariant: base,
        data: {
          user_info: {
            username,
            password,
            auth: 1,
            status: "Active",
            message: "playlist-mode",
            // Indica downstream que não há Xtream API completo.
            is_trial: 0,
            active_cons: 0,
            max_connections: 0,
            allowed_output_formats: ["m3u8", "ts"],
          },
          server_info: {
            url: base.replace(/^https?:\/\//, ""),
            server_protocol: base.startsWith("https") ? "https" : "http",
            time_now: new Date().toISOString(),
          },
        },
      };
    }
  }
  return { ok: false, reason: "playlist-fallback-failed", attempts };
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

/** Incrementa contador de falhas (estatística). Cooldown automático foi removido. */
async function markServerFailure(
  admin: any,
  serverRow: { id?: string; consecutive_failures?: number } | null,
) {
  if (!serverRow?.id) return;
  const next = (serverRow.consecutive_failures ?? 0) + 1;
  const patch: Record<string, unknown> = { consecutive_failures: next };
  try {
    await admin.from("allowed_servers").update(patch).eq("id", serverRow.id);
  } catch (err) {
    console.warn("[iptv-login] markServerFailure failed", err);
  }
}

/**
 * Detecção automática de DNS com bloqueio anti-datacenter.
 * Registra a falha em blocked_dns_failures e, se atingir threshold
 * (5 falhas em 24h de 2+ IPs distintos), promove o servidor pra
 * blocked_dns_servers com status='suggested' (esperando revisão admin).
 *
 * Só dispara quando o erro é classificado como padrão anti-datacenter:
 * - timeout total
 * - connection reset by peer
 * - connection refused (em todas as variantes)
 * NÃO dispara em 401, 5xx, DNS error puro ou WAF.
 */
const ANTI_DC_PATTERNS = /timeout|timed out|deadline|connection reset|reset by peer|os error 104|econnreset|connection refused|os error 111|econnrefused|no route to host|ehostunreach/i;
const NON_BLOCK_PATTERNS = /credenc|invalid|auth=0|unauthor|401|http\s*5\d\d|getaddrinfo|nxdomain|enotfound|name resolution|cloudflare|just a moment|attention required|tls|ssl|certificate|handshake/i;

function classifyForBlockDetection(reason: string): string | null {
  const r = (reason || "").toLowerCase();
  if (NON_BLOCK_PATTERNS.test(r)) return null;
  if (/timeout|timed out|deadline|i\/o timeout/.test(r)) return "timeout";
  if (/connection reset|reset by peer|os error 104|econnreset/.test(r)) return "reset";
  if (/connection refused|os error 111|econnrefused/.test(r)) return "refused";
  if (/no route to host|ehostunreach/.test(r)) return "unreachable";
  return null;
}

async function hashIp(ip: string): Promise<string> {
  try {
    const buf = new TextEncoder().encode(`bdns:${ip}`);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return ip.slice(0, 16);
  }
}

async function recordPotentialBlock(
  admin: any,
  serverUrl: string,
  reason: string,
  ip: string | undefined,
): Promise<void> {
  const errorKind = classifyForBlockDetection(reason);
  if (!errorKind) return;
  const normalized = normalizeServer(serverUrl);
  const ipHash = ip ? await hashIp(ip) : null;

  try {
    // 1. Registra a falha
    await admin.from("blocked_dns_failures").insert({
      server_url: normalized,
      error_kind: errorKind,
      ip_hash: ipHash,
    });

    // 2. Verifica se já está cadastrado e está dismissed (descarte permanente)
    const { data: existing } = await admin
      .from("blocked_dns_servers")
      .select("id, status, failure_count")
      .eq("server_url", normalized)
      .maybeSingle();
    if (existing?.status === "dismissed") return; // descarte permanente

    // 3. Conta falhas dos últimos 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: failures } = await admin
      .from("blocked_dns_failures")
      .select("ip_hash, error_kind, created_at")
      .eq("server_url", normalized)
      .gte("created_at", since24h);

    const totalFailures = failures?.length ?? 0;
    const distinctIps = new Set((failures ?? []).map((f: any) => f.ip_hash).filter(Boolean));

    // Threshold conservador: 5 falhas em 24h de 2+ IPs distintos
    const THRESHOLD_COUNT = 5;
    const THRESHOLD_IPS = 2;
    if (totalFailures < THRESHOLD_COUNT || distinctIps.size < THRESHOLD_IPS) return;

    const now = new Date().toISOString();
    const evidence = {
      detected_at: now,
      sample_errors: Array.from(new Set((failures ?? []).map((f: any) => f.error_kind))),
      total_failures_24h: totalFailures,
      distinct_ips_24h: distinctIps.size,
      last_reason: reason.slice(0, 200),
    };

    if (existing?.id) {
      // Atualiza contadores (suggested ou confirmed)
      await admin
        .from("blocked_dns_servers")
        .update({
          failure_count: totalFailures,
          distinct_ip_count: distinctIps.size,
          last_detected_at: now,
          evidence,
        })
        .eq("id", existing.id);
    } else {
      // Cria nova entrada como sugestão
      await admin.from("blocked_dns_servers").insert({
        server_url: normalized,
        status: "suggested",
        block_type: "anti_datacenter",
        failure_count: totalFailures,
        distinct_ip_count: distinctIps.size,
        first_detected_at: now,
        last_detected_at: now,
        evidence,
        notes: "Detectado automaticamente (5+ falhas em 24h de IPs distintos).",
      });
      console.log(`[iptv-login] blocked-dns auto-suggested: ${normalized} (${totalFailures} falhas, ${distinctIps.size} IPs)`);
    }
  } catch (err) {
    console.warn("[iptv-login] recordPotentialBlock failed", (err as Error).message);
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

    console.log("[iptv-login] start request", { proxy_enabled: false });

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

    if (mode === "ping") {
      return jsonResponse(200, { ok: true }, corsHeaders);
    }

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
    // Mode: "m3u_register" — login via URL M3U que pode AUTO-CADASTRAR a DNS.
    // Pula a checagem de allowlist; só cadastra se o Xtream autenticar com
    // user_info válido (auth=1). Servidores inválidos NUNCA entram na lista.
    // ---------------------------------------------------------------------
    if (mode === "m3u_register") {
      if (!server || !username || !password) {
        return errorResponse(
          "BAD_REQUEST",
          "m3u_register requer server, username e password",
          corsHeaders,
        );
      }

      // 0. Verifica configuração de bloqueio de novas DNS
      const { data: blockSetting } = await admin
        .from("app_settings")
        .select("value")
        .eq("key", "block_new_dns")
        .maybeSingle();

      const isBlockNewDns = blockSetting?.value === true;

      const baseUrl = String(server).trim().replace(/\/+$/, "");
      const fullBase = /^https?:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`;
      const normalizedInput = normalizeServer(fullBase);


      // 1. Verifica se já está cadastrada
      let existingRow: { id: string; last_working_variant: string | null; consecutive_failures: number; unreachable_until: string | null } | null = null;
      try {
        const { data: existing } = await admin
          .from("allowed_servers")
          .select("id, server_url, last_working_variant, consecutive_failures, unreachable_until")
          .eq("server_url", normalizedInput)
          .maybeSingle();

        if (existing) {
          existingRow = {
            id: existing.id,
            last_working_variant: existing.last_working_variant ?? null,
            consecutive_failures: existing.consecutive_failures ?? 0,
            unreachable_until: existing.unreachable_until ?? null,
          };
        }
      } catch (err) {
        console.warn("[iptv-login] m3u_register: lookup failed", err);
      }

      if (!existingRow && isBlockNewDns) {
        console.log(`[iptv-login] registration blocked by setting: ${normalizedInput}`);
        return errorResponse(
          "NOT_ALLOWED",
          "O cadastro automático de novos servidores está temporariamente desativado pelo administrador.",
          corsHeaders
        );
      }

      let r = await attemptLogin(fullBase, username, password, existingRow, admin);


      // Fallback playlist-mode: o servidor respondeu HTTP mas não em formato
      // Xtream válido. Cobre:
      //  - HTML / M3U cru / JSON sem user_info (status 200 não JSON)
      //  - 401 com corpo não-Xtream (alguns painéis exigem /get.php)
      //  - 404 em /player_api.php quando o painel só implementa /get.php
      //    (caso comum: Cloudflare na frente de origin que só serve M3U)
      const failStatus = (r as { status?: number }).status;
      const failReason = (r as { reason?: string }).reason ?? "";
      // Removido fallback de playlist para limpeza total de rotas alternativas
      const shouldTryPlaylist = false;


      if (!r.ok) {
        await logEvent({ server: fullBase, username, success: false, reason: `m3u_register:${r.reason}`, ua, ip });
        let { code, message } = classifyReason(r.reason);
        // Caso clássico: /player_api.php deu 404 vazio E o fallback de playlist
        // também não achou nada válido. A DNS está viva mas não expõe nem
        // Xtream nem M3U nesse caminho — provável URL incompleta.
        if (
          playlistFallbackDebug?.tried &&
          /^HTTP 404$/i.test(r.reason)
        ) {
          message =
            "A DNS respondeu, mas não encontramos endpoints Xtream (/player_api.php) nem M3U (/get.php, /playlist) válidos nesse endereço. Verifique se a URL M3U está completa (com porta e caminho corretos) ou peça uma nova ao seu provedor.";
        }
        const hint = maybeOriginSuspectHint((r as { status?: number }).status, (r as { body?: string }).body);
        const rawBody = String((r as { body?: string }).body ?? "");
        const bodyPreview = rawBody.slice(0, 300);
        const debug = {
          httpStatus: (r as { status?: number }).status,
          contentType: (r as { contentType?: string }).contentType ?? null,
          variant: (r as { variant?: string }).variant ?? fullBase,
          bodyPreview,
          looksLikeHtml: /^\s*<(!doctype|html|head|body)/i.test(rawBody),
          looksLikeM3u: /^\s*#extm3u/i.test(rawBody),
          reason: r.reason,
          ...(playlistFallbackDebug ? { playlistFallback: playlistFallbackDebug } : {}),
        };
        console.log(
          `[iptv-login] m3u_register FAIL host=${fullBase} reason=${r.reason} status=${debug.httpStatus} ct=${debug.contentType} preview=${bodyPreview.slice(0, 120).replace(/\s+/g, " ")}`,
        );
        return errorResponse(code, message, corsHeaders, {
          reason: r.reason,
          ...(hint ? { hint } : {}),
          debug,
        });
      }

      // @ts-ignore - usedVariant existe no caminho ok
      const usedVariant: string = (r as any).usedVariant ?? fullBase;
      const normalizedUsed = normalizeServer(usedVariant);

      let autoRegistered = false;
      if (!existingRow) {
        // Decide o label: server_info.url do Xtream → fallback hostname.
        let label: string | null = null;
        try {
          const infoUrl = (r.data?.server_info?.url as string | undefined)?.trim();
          if (infoUrl) {
            label = infoUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "").slice(0, 120);
          }
        } catch { /* noop */ }
        if (!label) {
          try {
            label = new URL(normalizedUsed).hostname.slice(0, 120);
          } catch {
            label = normalizedUsed.replace(/^https?:\/\//i, "").slice(0, 120);
          }
        }
        try {
          const { error: upErr } = await admin.from("allowed_servers").upsert(
            {
              server_url: normalizedUsed,
              label,
              notes: "Auto-cadastrado via login M3U",
              last_working_variant: usedVariant,
              last_working_at: new Date().toISOString(),
              consecutive_failures: 0,
              unreachable_until: null,
            },
            { onConflict: "server_url" },
          );
          if (upErr) {
            console.error("[iptv-login] m3u_register upsert error", upErr.message);
          } else {
            autoRegistered = true;
          }
        } catch (err) {
          console.error("[iptv-login] m3u_register upsert exception", err);
        }
      }

      // Lista atualizada de allowed (para o cliente cachear/usar).
      let allowedList: string[] = [];
      try {
        const { data: rows } = await admin.from("allowed_servers").select("server_url");
        allowedList = (rows ?? []).map((r: { server_url: string }) => normalizeServer(r.server_url));
      } catch { /* noop */ }

      // @ts-ignore - route existe no caminho ok
      const route: "direct" | "proxy" = (r as any).route ?? "direct";
      // Removido log de eventos de registro

      console.log(`[iptv-login] M3U_REGISTER server=${normalizedUsed} route=${route} auto_registered=${autoRegistered}`);
      return jsonResponse(
        200,
        {
          success: true,
          ...r.data,
          server_url: normalizedUsed,
          allowed_servers: allowedList,
          route,
          auto_registered: autoRegistered,
        },
        corsHeaders,
      );
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
      // Removido log de eventos
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
        // Removido log de eventos
        return errorResponse("NOT_ALLOWED", NO_ACCESS_MSG, corsHeaders);

      }
      candidateRows = [match];
    } else {
      candidateRows = allRows;
      // Quando o cliente NÃO informou DNS, priorizamos as DNS em que esse
      // mesmo usuário já logou com sucesso recentemente. Isso reduz drasticamente
      // a chance de o login "varrer" várias DNS antes de achar a correta.
      try {
        const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: history } = await admin
          .from("login_events")
          .select("server_url, created_at, success")
          .eq("username", username)
          .eq("success", true)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(20);
        const seen = new Set<string>();
        const order: string[] = [];
        for (const ev of (history ?? []) as { server_url: string }[]) {
          const norm = normalizeServer(ev.server_url);
          if (!seen.has(norm)) {
            seen.add(norm);
            order.push(norm);
          }
        }
        if (order.length > 0) {
          const rank = new Map<string, number>();
          order.forEach((u, i) => rank.set(u, i));
          candidateRows = [...allRows].sort((a, b) => {
            const ra = rank.has(a.server_url) ? rank.get(a.server_url)! : Number.MAX_SAFE_INTEGER;
            const rb = rank.has(b.server_url) ? rank.get(b.server_url)! : Number.MAX_SAFE_INTEGER;
            if (ra !== rb) return ra - rb;
            // Empate: DNS saudável (sem cooldown e com last_working_at) primeiro
            const ah = a.unreachable_until && new Date(a.unreachable_until).getTime() > Date.now() ? 1 : 0;
            const bh = b.unreachable_until && new Date(b.unreachable_until).getTime() > Date.now() ? 1 : 0;
            return ah - bh;
          });
          console.log(`[iptv-login] candidate ordering by user history: top=${candidateRows[0]?.server_url}`);
        }
      } catch (err) {
        console.warn("[iptv-login] history sort failed", (err as Error).message);
      }
    }

    // Try each candidate server until one authenticates
    let lastReason = "credenciais inválidas";
    let lastStatus: number | undefined;
    let lastBody = "";
    for (const row of candidateRows) {
      const r = await attemptLogin(row.server_url, username, password, row, admin, ip);
      if (r.ok) {
        // @ts-ignore - route só existe no caminho ok
        const route: "direct" | "proxy" = (r as any).route ?? "direct";
        // Removido log de eventos de sucesso
        console.log(`[iptv-login] SUCCESS server=${row.server_url} route=${route}`);
        return jsonResponse(
          200,
          { success: true, ...r.data, server_url: row.server_url, allowed_servers: allowedList, route },
          corsHeaders,
        );
      }
      lastReason = r.reason;
      lastStatus = (r as { status?: number }).status;
      lastBody = (r as { body?: string }).body ?? "";
      // Removido registro automático de bloqueio e logs de histórico
    }


    const { code, message } = classifyReason(lastReason);
    const hint = maybeOriginSuspectHint(lastStatus, lastBody);
    return errorResponse(code, message, corsHeaders, { reason: lastReason, ...(hint ? { hint } : {}) });
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
