// Wrapper de fetch com FALLBACK INTELIGENTE direto → proxy.
//
// Suporta DOIS tipos de proxy via IPTV_PROXY_URL:
//
//  A) HTTP CONNECT proxy (estilo Squid/SOCKS-tunnel/VPS Nginx):
//     Detectado quando a URL contém "@" (auth) OU porta explícita NÃO-443/80
//     OU termina sem path. Ex.:
//       http://user:pass@proxy.host:8080
//       http://proxy.host:8080
//       https://user:pass@proxy.host:443
//     Usa Deno.createHttpClient({ proxy }) — fetch transparente.
//
//  B) REST bridge (estilo Cloudflare Worker / Vercel Function):
//     Detectado quando é HTTPS sem auth, sem porta exótica, e geralmente
//     com path "/" raiz ou "/proxy". Ex.:
//       https://iptv-bridge.SEU-USER.workers.dev
//       https://iptv-bridge.SEU-USER.workers.dev/proxy
//     A URL alvo é enviada como query param `?url=ENCODED_TARGET_URL`,
//     método/body/headers preservados.
//
// Para forçar modo REST mesmo se a URL for ambígua, prefixe com `rest:`:
//   IPTV_PROXY_URL=rest:https://meu-proxy.exemplo.com
//
// Estratégia (quando IPTV_PROXY_URL está configurado):
//   1. Tenta primeiro DIRETO (fetch normal, IP do Supabase Edge).
//   2. Se falhar com erro de rede (refused/reset/timeout/dns/tls), retenta
//      automaticamente via PROXY (CONNECT ou REST conforme detectado).
//   3. Resposta HTTP "ruim" (4xx/5xx) NÃO dispara fallback — é resposta
//      legítima do servidor, proxy não vai mudar nada.
//
// Para diagnóstico:
//   - Cada chamada loga `[proxied-fetch] route=direct|proxy(connect)|proxy(rest) host=...`
//   - A resposta retornada tem a propriedade não-padrão `_iptvRoute`
//     ("direct" | "proxy") via Object.defineProperty (best-effort).

type ProxyMode = "connect" | "rest" | "none";

let _client: Deno.HttpClient | null | undefined = undefined;
let _restBaseUrl: string | null = null;
let _proxyMode: ProxyMode = "none";
let _initialized = false;

/**
 * Decide automaticamente entre modo CONNECT e REST a partir do formato da URL.
 *  - Prefixo `rest:` força modo REST.
 *  - URL com user:pass@ → CONNECT (proxy autenticado).
 *  - URL HTTP → CONNECT (CDN/Worker quase sempre é HTTPS).
 *  - URL HTTPS sem auth → REST (caso típico do Cloudflare Worker).
 */
function detectMode(rawUrl: string): { mode: Exclude<ProxyMode, "none">; cleanUrl: string } {
  let url = rawUrl.trim();

  if (url.toLowerCase().startsWith("rest:")) {
    return { mode: "rest", cleanUrl: url.slice(5).trim() };
  }
  if (url.toLowerCase().startsWith("connect:")) {
    return { mode: "connect", cleanUrl: url.slice(8).trim() };
  }

  try {
    const u = new URL(url);
    if (u.username || u.password) return { mode: "connect", cleanUrl: url };
    if (u.protocol === "http:") return { mode: "connect", cleanUrl: url };
    // HTTPS sem auth → assumimos REST bridge (Cloudflare Worker, Vercel, etc.)
    return { mode: "rest", cleanUrl: url };
  } catch {
    // Fallback para CONNECT se URL malformada — Deno vai reclamar de qualquer jeito.
    return { mode: "connect", cleanUrl: url };
  }
}

function init(): void {
  if (_initialized) return;
  _initialized = true;

  const proxyUrl = (Deno.env.get("IPTV_PROXY_URL") ?? "").trim();
  if (!proxyUrl) {
    _proxyMode = "none";
    return;
  }

  const { mode, cleanUrl } = detectMode(proxyUrl);

  if (mode === "rest") {
    _restBaseUrl = cleanUrl.replace(/\/+$/, "");
    _proxyMode = "rest";
    console.log(`[proxied-fetch] proxy REST disponível (fallback): ${_restBaseUrl}`);
    return;
  }

  // mode === "connect"
  try {
    let basicAuth: { username: string; password: string } | undefined;
    let connectUrl = cleanUrl;
    try {
      const u = new URL(cleanUrl);
      if (u.username || u.password) {
        basicAuth = {
          username: decodeURIComponent(u.username),
          password: decodeURIComponent(u.password),
        };
        u.username = "";
        u.password = "";
        connectUrl = u.toString().replace(/\/+$/, "");
      }
    } catch { /* ignora */ }
    _client = Deno.createHttpClient({ proxy: { url: connectUrl, basicAuth } });
    _proxyMode = "connect";
    console.log(
      `[proxied-fetch] proxy CONNECT disponível (fallback): ${connectUrl.replace(/:\/\/.*@/, "://***@")}`,
    );
  } catch (err) {
    console.error("[proxied-fetch] falha ao criar HTTP client com proxy CONNECT:", err);
    _proxyMode = "none";
  }
}

/** Indica se um proxy está configurado (qualquer modo). */
export function isProxyEnabled(): boolean {
  init();
  return _proxyMode !== "none";
}

/** Força fetch DIRETO (sem fallback). Útil para diagnóstico A/B. */
export async function directFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const host = hostOf(input);
  const res = await fetch(input, init);
  console.log(`[proxied-fetch] route=direct(forced) host=${host} status=${res.status}`);
  return tagRoute(res, "direct");
}

/** Força fetch via PROXY (sem fallback). Retorna null se proxy não configurado. */
export async function proxyOnlyFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response | null> {
  init_();
  if (_proxyMode === "none") return null;
  const host = hostOf(input);
  const res = await doProxyFetch(input, init);
  console.log(`[proxied-fetch] route=proxy(${_proxyMode},forced) host=${host} status=${res.status}`);
  return tagRoute(res, "proxy");
}

// alias interno (init é shadowed por param `init?:` no scope local)
function init_() { init(); }

/** Erros de TRANSPORTE que justificam retry via proxy. */
function isNetworkError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /connection refused|econnrefused|connection reset|econnreset|reset by peer|timeout|timed out|aborted|abort|os error 111|os error 104|getaddrinfo|enotfound|nxdomain|name resolution|no route to host|ehostunreach|tls|ssl|certificate|handshake|unrecognisedname|fatal alert|network|sending request|connect/i
    .test(msg);
}

function tagRoute(res: Response, route: "direct" | "proxy"): Response {
  try {
    Object.defineProperty(res, "_iptvRoute", {
      value: route,
      enumerable: false,
      writable: false,
    });
  } catch { /* best-effort */ }
  return res;
}

function hostOf(input: string | URL | Request): string {
  try {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;
    return new URL(url).host;
  } catch {
    return "<invalid-url>";
  }
}

/**
 * Despacha o fetch para o proxy correto (CONNECT ou REST).
 * Pré-condição: init() já foi chamado e _proxyMode != "none".
 */
async function doProxyFetch(
  input: string | URL | Request,
  reqInit?: RequestInit,
): Promise<Response> {
  if (_proxyMode === "connect" && _client) {
    // @ts-ignore - `client` é uma extensão Deno do RequestInit
    return await fetch(input, { ...(reqInit ?? {}), client: _client });
  }
  if (_proxyMode === "rest" && _restBaseUrl) {
    const targetUrl = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

    const proxyUrl = `${_restBaseUrl}/?url=${encodeURIComponent(targetUrl)}`;
    const method = (reqInit?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const passthroughHeaders: Record<string, string> = {};
    const srcHeaders = reqInit?.headers ?? (input instanceof Request ? input.headers : undefined);
    if (srcHeaders) {
      const it = srcHeaders instanceof Headers
        ? srcHeaders.entries()
        : Array.isArray(srcHeaders)
        ? srcHeaders[Symbol.iterator]()
        : Object.entries(srcHeaders)[Symbol.iterator]();
      for (const [k, v] of it as IterableIterator<[string, string]>) {
        // Header X-Forwarded-* fica a critério do Worker. Encaminhamos UA e Accept.
        const lk = k.toLowerCase();
        if (lk === "user-agent" || lk === "accept" || lk === "content-type") {
          passthroughHeaders[`x-iptv-${lk}`] = v;
        }
      }
    }
    let body: BodyInit | null | undefined = reqInit?.body ?? null;
    if (["GET", "HEAD"].includes(method)) body = null;

    return await fetch(proxyUrl, {
      method,
      headers: passthroughHeaders,
      body,
      signal: reqInit?.signal,
      redirect: reqInit?.redirect ?? "follow",
    });
  }
  throw new Error("[proxied-fetch] proxy não inicializado");
}

/**
 * fetch com fallback inteligente: tenta DIRETO primeiro; se erro de rede
 * E proxy estiver configurado, retenta via proxy. Erros HTTP (4xx/5xx) NÃO
 * acionam retry — são resposta legítima do servidor.
 */
export async function proxiedFetch(
  input: string | URL | Request,
  reqInit?: RequestInit,
): Promise<Response> {
  init();
  const host = hostOf(input);

  // 1) DIRETO (sempre primeiro)
  try {
    const res = await fetch(input, reqInit);
    console.log(`[proxied-fetch] route=direct host=${host} status=${res.status}`);
    return tagRoute(res, "direct");
  } catch (directErr) {
    if (_proxyMode === "none" || !isNetworkError(directErr)) {
      console.log(
        `[proxied-fetch] route=direct host=${host} FAIL (no fallback): ${
          directErr instanceof Error ? directErr.message : String(directErr)
        }`,
      );
      throw directErr;
    }

    // 2) PROXY (fallback)
    console.log(
      `[proxied-fetch] direct falhou host=${host} (${
        directErr instanceof Error ? directErr.message : String(directErr)
      }) — retentando via proxy(${_proxyMode})`,
    );
    try {
      const res = await doProxyFetch(input, reqInit);
      console.log(`[proxied-fetch] route=proxy(${_proxyMode}) host=${host} status=${res.status}`);
      return tagRoute(res, "proxy");
    } catch (proxyErr) {
      console.error(
        `[proxied-fetch] route=proxy(${_proxyMode}) host=${host} FAIL: ${
          proxyErr instanceof Error ? proxyErr.message : String(proxyErr)
        }`,
      );
      throw proxyErr;
    }
  }
}
