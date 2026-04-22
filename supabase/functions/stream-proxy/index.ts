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
      "authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function normalizeServer(url: string) {
  let u = url.trim().toLowerCase();
  if (!/^https?:\/\//.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, "");
}
function hostOf(url: string) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `http://${url}`).host.toLowerCase();
  } catch {
    return "";
  }
}

let cache: { at: number; hosts: Set<string> } | null = null;
async function getAllowedHosts(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.hosts;
  const { data } = await admin.from("allowed_servers").select("server_url");
  const hosts = new Set<string>();
  for (const r of data ?? []) {
    const h = hostOf(normalizeServer((r as any).server_url));
    if (h) hosts.add(h);
  }
  cache = { at: Date.now(), hosts };
  return hosts;
}

// Block private/loopback/link-local ranges to prevent SSRF against internal infra.
function isPrivateHost(host: string): boolean {
  const h = host.split(":")[0].toLowerCase();
  if (h === "localhost" || h === "ip6-localhost" || h === "ip6-loopback") return true;

  // IPv4 literal
  const m4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m4) {
    const [a, b] = [parseInt(m4[1], 10), parseInt(m4[2], 10)];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  // IPv6 literal (simple checks)
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fe80:")) return true; // link-local
    if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local fc00::/7
    return false;
  }
  return false;
}

/**
 * Verifica se um host de redirecionamento é "razoavelmente derivado" do host
 * original. Aceitamos:
 *  - mesmo host
 *  - subdomínio do mesmo registrable domain (ex.: cdn.dominio.com a partir de dominio.com)
 *  - host pai (ex.: dominio.com a partir de cdn.dominio.com)
 *  - mesma "raiz" de 2 últimos labels (heurística simples, ignora TLD multiparte)
 */
function isRelatedHost(originalHost: string, redirectHost: string): boolean {
  const o = originalHost.toLowerCase().split(":")[0];
  const r = redirectHost.toLowerCase().split(":")[0];
  if (o === r) return true;
  if (r.endsWith(`.${o}`) || o.endsWith(`.${r}`)) return true;
  const oParts = o.split(".");
  const rParts = r.split(".");
  if (oParts.length >= 2 && rParts.length >= 2) {
    const oRoot = oParts.slice(-2).join(".");
    const rRoot = rParts.slice(-2).join(".");
    if (oRoot === rRoot) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("url");
    if (!target) return new Response("Missing url param", { status: 400, headers: corsHeaders });

    let decoded: URL;
    try {
      decoded = new URL(target);
    } catch {
      return new Response("Invalid url", { status: 400, headers: corsHeaders });
    }

    if (decoded.protocol !== "http:" && decoded.protocol !== "https:") {
      return new Response("Unsupported protocol", { status: 400, headers: corsHeaders });
    }

    const targetHost = decoded.host.toLowerCase();

    if (isPrivateHost(targetHost)) {
      return new Response("Forbidden host", { status: 403, headers: corsHeaders });
    }

    const allowedHosts = await getAllowedHosts();
    const originalAllowed =
      allowedHosts.has(targetHost) || allowedHosts.has(targetHost.split(":")[0]);
    if (!originalAllowed) {
      console.warn("[stream-proxy] host not allowed:", targetHost);
      return new Response(`Host not allowed: ${targetHost}`, { status: 403, headers: corsHeaders });
    }

    const fwdHeaders: Record<string, string> = {
      "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
      Referer: `${decoded.protocol}//${decoded.host}/`,
      Accept: "*/*",
    };
    const range = req.headers.get("range");
    if (range) fwdHeaders["Range"] = range;

    const upstream = await fetch(decoded.toString(), {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      redirect: "follow",
      headers: fwdHeaders,
    });

    const finalUrl = new URL(upstream.url || decoded.toString());
    const finalHost = finalUrl.host.toLowerCase();

    // Re-valida após redirects: bloqueia hosts privados, mas aceita CDNs derivadas
    // do host original autorizado (defesa em profundidade contra SSRF sem
    // quebrar provedores que entregam mídia via subdomínio/CDN).
    if (isPrivateHost(finalHost)) {
      return new Response("Redirect to private host", { status: 403, headers: corsHeaders });
    }
    const finalDirectAllowed =
      allowedHosts.has(finalHost) || allowedHosts.has(finalHost.split(":")[0]);
    if (!finalDirectAllowed && !isRelatedHost(targetHost, finalHost)) {
      console.warn(
        "[stream-proxy] redirect blocked:",
        targetHost,
        "->",
        finalHost,
      );
      return new Response(
        `Redirect to forbidden host: ${finalHost}`,
        { status: 403, headers: corsHeaders },
      );
    }

    const contentType = upstream.headers.get("content-type") || "";
    const looksLikeM3u8 =
      contentType.includes("mpegurl") ||
      contentType.includes("application/x-mpegurl") ||
      finalUrl.pathname.endsWith(".m3u8") ||
      finalUrl.pathname.endsWith(".m3u") ||
      decoded.pathname.endsWith(".m3u8") ||
      decoded.pathname.endsWith(".m3u");

    if (looksLikeM3u8) {
      const text = await upstream.text();
      if (!text.includes("#EXTM3U") && !text.includes("#EXT-X")) {
        return new Response(`Upstream did not return a playlist:\n${text.slice(0, 500)}`, {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      const baseHref = finalUrl.toString().substring(0, finalUrl.toString().lastIndexOf("/") + 1);
      const supabasePublicUrl = Deno.env.get("SUPABASE_URL") || `${url.protocol}//${url.host}`;
      const proxyBase = `${supabasePublicUrl.replace(/\/+$/, "")}/functions/v1/stream-proxy?url=`;

      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith("#")) {
            return line.replace(/URI="([^"]+)"/g, (_m, p1) => {
              const abs = new URL(p1, baseHref).toString();
              return `URI="${proxyBase}${encodeURIComponent(abs)}"`;
            });
          }
          try {
            const abs = new URL(trimmed, baseHref).toString();
            return `${proxyBase}${encodeURIComponent(abs)}`;
          } catch {
            return line;
          }
        })
        .join("\n");

      return new Response(rewritten, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache",
        },
      });
    }

    const passthroughHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": upstream.headers.get("cache-control") || "no-cache",
      "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
    };
    const len = upstream.headers.get("content-length");
    if (len) passthroughHeaders["Content-Length"] = len;
    const cr = upstream.headers.get("content-range");
    if (cr) passthroughHeaders["Content-Range"] = cr;

    return new Response(upstream.body, {
      status: upstream.status,
      headers: passthroughHeaders,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(msg, { status: 500, headers: corsFor(req) });
  }
});
