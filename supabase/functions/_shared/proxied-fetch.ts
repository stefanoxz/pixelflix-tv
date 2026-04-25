// Wrapper de fetch que opcionalmente roteia chamadas para servidores IPTV
// através de um proxy HTTP/HTTPS configurado via secret IPTV_PROXY_URL.
//
// Por que existe: muitos servidores IPTV (ex.: bkpac.cc) bloqueiam IPs de
// datacenters estrangeiros (Supabase Edge roda nos EUA). Quando o secret está
// configurado com um proxy residencial/VPS no Brasil, todas as requisições
// para essas DNS saem do IP do proxy.
//
// Formato do secret (qualquer um destes funciona):
//   http://user:pass@proxy.host:8080
//   http://proxy.host:8080         (sem auth)
//   https://user:pass@proxy.host:443
//
// Quando IPTV_PROXY_URL não está definido (ou está vazio), o fetch padrão
// é usado — comportamento idêntico ao código original.

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

    // Extrai user:pass da URL se presente (Deno.createHttpClient não aceita
    // credentials embutidas — precisa ser passado em basicAuth separadamente).
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
      // URL malformada — deixa o createHttpClient reclamar abaixo.
    }

    _client = Deno.createHttpClient({
      proxy: { url: cleanUrl, basicAuth },
    });
    _proxyConfigured = true;
    console.log("[proxied-fetch] proxy ativo:", cleanUrl.replace(/:\/\/.*@/, "://***@"));
    return _client;
  } catch (err) {
    console.error("[proxied-fetch] falha ao criar HTTP client com proxy:", err);
    _client = null;
    _proxyConfigured = false;
    return null;
  }
}

/** Indica se um proxy está configurado e ativo. Útil para diagnóstico. */
export function isProxyEnabled(): boolean {
  getClient();
  return _proxyConfigured;
}

/**
 * fetch que usa o proxy IPTV quando configurado. Mesma assinatura do fetch
 * global. Se o proxy não estiver configurado, delega ao fetch padrão.
 */
export function proxiedFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const client = getClient();
  if (!client) return fetch(input, init);
  // @ts-ignore - `client` é uma extensão Deno do RequestInit
  return fetch(input, { ...(init ?? {}), client });
}
