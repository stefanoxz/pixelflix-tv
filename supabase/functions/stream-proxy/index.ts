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

    const upstream = await fetch(decoded.toString(), {
      method: req.method,
      headers: { "User-Agent": "Mozilla/5.0", Referer: `${decoded.protocol}//${decoded.host}/` },
    });

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";

    // If it's an m3u8 playlist, rewrite segment/playlist URLs through this proxy.
    if (
      contentType.includes("mpegurl") ||
      decoded.pathname.endsWith(".m3u8") ||
      decoded.pathname.endsWith(".m3u")
    ) {
      const text = await upstream.text();
      const baseHref = decoded.toString().substring(0, decoded.toString().lastIndexOf("/") + 1);
      const proxyBase = `${url.origin}${url.pathname}?url=`;

      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) {
            // Rewrite URI="..." inside tags (e.g., #EXT-X-KEY)
            return line.replace(/URI="([^"]+)"/g, (_m, p1) => {
              const abs = new URL(p1, baseHref).toString();
              return `URI="${proxyBase}${encodeURIComponent(abs)}"`;
            });
          }
          const abs = new URL(trimmed, baseHref).toString();
          return `${proxyBase}${encodeURIComponent(abs)}`;
        })
        .join("\n");

      return new Response(rewritten, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Stream binary/ts/image directly
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": upstream.headers.get("cache-control") || "no-cache",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(msg, { status: 500, headers: corsHeaders });
  }
});
