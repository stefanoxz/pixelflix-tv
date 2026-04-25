// Wrapper de fetch com FALLBACK INTELIGENTE direto → proxy.
//
// Estratégia (quando IPTV_PROXY_URL está configurado):
//   1. Tenta primeiro DIRETO (fetch normal, IP do Supabase Edge).
//   2. Se falhar com erro de rede (refused/reset/timeout/dns/tls), retenta
//      automaticamente via PROXY.
//   3. Resposta HTTP "ruim" (4xx/5xx) NÃO dispara fallback — é resposta legítima
//      do servidor, proxy não vai mudar nada.
//
// Quando IPTV_PROXY_URL NÃO está configurado:
//   - Apenas faz fetch direto (comportamento idêntico ao antes).
//
// Para diagnóstico:
//   - Cada chamada loga `[proxied-fetch] route=direct|proxy host=...`
//   - A resposta retornada tem a propriedade não-padrão `_iptvRoute`
//     ("direct" | "proxy") via Object.defineProperty (best-effort).
//
// Formato do secret:
//   http://user:pass@proxy.host:8080
//   http://proxy.host:8080         (sem auth)
//   https://user:pass@proxy.host:443

let _client: Deno.HttpClient | null | undefined = undefined;
let _proxyConfigured = false;

function getClient(): Deno.HttpClient | null {
  if (_client !== undefined) return _client;

  const proxyUrl = (Deno.env.get("IPTV_PROXY_URL") ?? "").trim();
  if (!proxyUrl) {
    _client = null;
    _proxyConfigured = false;
    return null;
  }

  try {
    let basicAuth: { username: string; password: string } | undefined;
    let cleanUrl = proxyUrl;

    try {
      const u = new URL(proxyUrl);
      if (u.username || u.password) {
        basicAuth = {
          username: decodeURIComponent(u.username),
          password: decodeURIComponent(u.password),
        };
        u.username = "";
        u.password = "";
        cleanUrl = u.toString().replace(/\/+$/, "");
      }
    } catch {
      // URL malformada — Deno.createHttpClient vai reclamar abaixo.
    }

    _client = Deno.createHttpClient({
      proxy: { url: cleanUrl, basicAuth },
    });
    _proxyConfigured = true;
    console.log(
      "[proxied-fetch] proxy disponível (fallback):",
      cleanUrl.replace(/:\/\/.*@/, "://***@"),
    );
    return _client;
  } catch (err) {
    console.error("[proxied-fetch] falha ao criar HTTP client com proxy:", err);
    _client = null;
    _proxyConfigured = false;
    return null;
  }
}

/** Indica se um proxy está configurado e disponível para fallback. */
export function isProxyEnabled(): boolean {
  getClient();
  return _proxyConfigured;
}

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
 * fetch com fallback inteligente: tenta DIRETO primeiro; se erro de rede
 * E proxy estiver configurado, retenta via proxy. Erros HTTP (4xx/5xx) NÃO
 * acionam retry — são resposta legítima do servidor.
 */
export async function proxiedFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const host = hostOf(input);

  // 1) DIRETO (sempre primeiro)
  try {
    const res = await fetch(input, init);
    console.log(`[proxied-fetch] route=direct host=${host} status=${res.status}`);
    return tagRoute(res, "direct");
  } catch (directErr) {
    const client = getClient();

    // Sem proxy configurado OU erro não-rede → propaga como antes.
    if (!client || !isNetworkError(directErr)) {
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
      }) — retentando via proxy`,
    );
    try {
      // @ts-ignore - `client` é uma extensão Deno do RequestInit
      const res = await fetch(input, { ...(init ?? {}), client });
      console.log(`[proxied-fetch] route=proxy host=${host} status=${res.status}`);
      return tagRoute(res, "proxy");
    } catch (proxyErr) {
      console.error(
        `[proxied-fetch] route=proxy host=${host} FAIL: ${
          proxyErr instanceof Error ? proxyErr.message : String(proxyErr)
        }`,
      );
      // Propaga o erro do proxy (mais informativo que o direto, normalmente).
      throw proxyErr;
    }
  }
}
