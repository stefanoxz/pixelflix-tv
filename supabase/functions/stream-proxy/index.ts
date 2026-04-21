import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// Proxy for IPTV streams (m3u8 + segments + images) to bypass CORS in browsers.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response("Missing url param", { status: 400, headers: corsHeaders });
    }

    let decoded: URL;
    try {
      decoded = new URL(target);
    } catch {
      return new Response("Invalid url", { status: 400, headers: corsHeaders });
    }

    // Follow redirects manually so we can rewrite based on the final URL.
    const upstream = await fetch(decoded.toString(), {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
        Referer: `${decoded.protocol}//${decoded.host}/`,
        Accept: "*/*",
      },
    });

    // The URL after redirects — needed to resolve relative segment paths correctly.
    const finalUrl = new URL(upstream.url || decoded.toString());
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

      // Some servers return HTML errors with 200 — guard against that.
      if (!text.includes("#EXTM3U") && !text.includes("#EXT-X")) {
        return new Response(`Upstream did not return a playlist:\n${text.slice(0, 500)}`, {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      const baseHref = finalUrl.toString().substring(0, finalUrl.toString().lastIndexOf("/") + 1);
      const proxyBase = `${url.origin}${url.pathname}?url=`;

      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith("#")) {
            // Rewrite URI="..." inside tags (e.g., #EXT-X-KEY, #EXT-X-MAP)
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

    // Stream binary/ts/image directly
    const passthroughHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": upstream.headers.get("cache-control") || "no-cache",
    };
    const len = upstream.headers.get("content-length");
    if (len) passthroughHeaders["Content-Length"] = len;

    return new Response(upstream.body, {
      status: upstream.status,
      headers: passthroughHeaders,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(msg, { status: 500, headers: corsHeaders });
  }
});
