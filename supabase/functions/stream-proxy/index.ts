import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allow =
    ALLOWED_ORIGIN === "*"
      ? "*"
      : ALLOWED_ORIGIN.split(",").map((s) => s.trim()).includes(origin)
      ? origin
      : ALLOWED_ORIGIN.split(",")[0].trim();
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    if (!allowedHosts.has(targetHost) && !allowedHosts.has(targetHost.split(":")[0])) {
      return new Response("Host not allowed", { status: 403, headers: corsHeaders });
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
    // Re-validate after redirects (defense in depth).
    if (isPrivateHost(finalUrl.host) || (!allowedHosts.has(finalUrl.host.toLowerCase()) && !allowedHosts.has(finalUrl.host.toLowerCase().split(":")[0]))) {
      return new Response("Redirect to forbidden host", { status: 403, headers: corsHeaders });
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
