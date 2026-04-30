// Stream proxy.
// New mode (preferred): GET /stream-proxy?t=<signed token>
//   - playlist token  → fetches upstream m3u8, rewrites segment URLs as new tokens
//   - segment token   → 302 redirect to upstream (no video bytes through Supabase)
// Legacy mode (kept for backward compat with admin/manual debugging only):
//   - GET /stream-proxy?url=<raw>  → proxies bytes if host is allow-listed
//
// Anti-abuse:
//   - HMAC verification (timing-safe)
//   - exp / ip /24 / ua hash checks
//   - segment nonces single-use
//   - per-IP failure blocklist (in-memory, best-effort)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import {
  clientIp,
  ipPrefix,
  newNonce,
  signToken,
  uaHash,
  urlHash,
  verifyToken,
  type TokenPayload,
} from "../_shared/stream-token.ts";

const ALLOWED_SUFFIXES = [".lovable.app", ".lovableproject.com", ".lovable.dev"];
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  let allow = "*";
  try {
    const u = new URL(origin);
    if (ALLOWED_SUFFIXES.some((s) => u.hostname.endsWith(s)) || u.hostname === "localhost") {
      allow = origin;
    }
  } catch { /* ignore */ }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    // Cacheia o preflight CORS por 24h. Cada GET de playlist/segment HLS
    // aciona preflight; sem max-age o browser refaz o OPTIONS toda vez.
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const PROXY_BASE = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/stream-proxy`;
// Aligned with stream-token TTL_SEGMENT_S (45s).
const SEGMENT_TTL_S = 45;
// Tolerate clock skew between client/edge when checking token expiration.
const EXP_SKEW_MS = 2_000;
// Window in which a previously-used nonce can be replayed by the same
// (user, ip/24, ua) — aligned with SEGMENT_TTL_S so hls.js retries within the
// token's own lifetime are not falsely rejected.
const NONCE_REPLAY_WINDOW_MS = 30_000;
// Per-segment upstream timeout when streaming bytes through the edge.
// 12s dá margem pra painéis IPTV lentos (BR/intercontinental) sem deixar
// requests pendurados eternamente. Antes era 8s e estourava muito.
const SEGMENT_FETCH_TIMEOUT_MS = 12_000;
// Cap concurrent streamed segments per client IP /24 to avoid abuse.
const MAX_STREAM_CONCURRENCY_PER_IP = 6;

// Free Proxies List (CORS & Region bypass)
const PUBLIC_PROXIES = [
  "https://cors-anywhere.herokuapp.com/",
  "https://api.allorigins.win/raw?url=",
  "https://proxy.cors.sh/",
];

// In-memory per-IP failure tracking (best-effort, per worker)
const ipFailures = new Map<string, { count: number; first: number; until?: number }>();
function noteFailure(ip: string) {
  const now = Date.now();
  const cur = ipFailures.get(ip);
  if (!cur || now - cur.first > 60_000) {
    ipFailures.set(ip, { count: 1, first: now });
    return;
  }
  cur.count += 1;
  if (cur.count > 10) cur.until = now + 5 * 60_000;
}
function isIpBlocked(ip: string): boolean {
  const cur = ipFailures.get(ip);
  if (!cur?.until) return false;
  if (Date.now() > cur.until) {
    ipFailures.delete(ip);
    return false;
  }
  return true;
}

// Per-IP /24 in-flight streamed-segment counter (best-effort, per worker).
const ipInFlight = new Map<string, number>();
function ipBump(prefix: string, delta: number) {
  const cur = ipInFlight.get(prefix) ?? 0;
  const next = Math.max(0, cur + delta);
  if (next === 0) ipInFlight.delete(prefix);
  else ipInFlight.set(prefix, next);
}

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
    const h = hostOf(normalizeServer((r as { server_url: string }).server_url));
    if (h) hosts.add(h);
  }
  cache = { at: Date.now(), hosts };
  return hosts;
}

function isPrivateHost(host: string): boolean {
  const h = host.split(":")[0].toLowerCase();
  if (h === "localhost" || h === "ip6-localhost" || h === "ip6-loopback") return true;
  const m4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m4) {
    const [a, b] = [parseInt(m4[1], 10), parseInt(m4[2], 10)];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fe80:")) return true;
    if (h.startsWith("fc") || h.startsWith("fd")) return true;
    return false;
  }
  return false;
}

async function logEvent(
  userId: string | null,
  type: string,
  ip: string,
  ua: string,
  url: string | null,
  meta?: Record<string, unknown>,
) {
  try {
    await admin.from("stream_events").insert({
      anon_user_id: userId,
      event_type: type,
      ip,
      ua_hash: await uaHash(ua),
      url_hash: url ? await urlHash(url) : null,
      meta: meta ?? null,
    });
  } catch { /* never block */ }
}

async function rejectToken(
  ip: string,
  ua: string,
  reason: string,
  cors: Record<string, string>,
  userId: string | null = null,
  url: string | null = null,
) {
  noteFailure(ip);
  await logEvent(userId, "token_rejected", ip, ua, url, { reason });
  return new Response("Forbidden", { status: 403, headers: cors });
}

// Detect rapid IP /24 changes for the same user (token sharing)
async function checkSuspiciousIp(userId: string, ip: string, ua: string) {
  const since = new Date(Date.now() - 30_000).toISOString();
  const { data } = await admin
    .from("stream_events")
    .select("ip, created_at")
    .eq("anon_user_id", userId)
    .eq("event_type", "token_issued")
    .gte("created_at", since)
    .limit(20);
  const prefixes = new Set<string>();
  prefixes.add(ipPrefix(ip));
  for (const row of data ?? []) {
    if (row.ip) prefixes.add(ipPrefix(row.ip));
  }
  if (prefixes.size > 1) {
    const until = new Date(Date.now() + 5 * 60_000).toISOString();
    await admin.from("user_blocks").upsert(
      { anon_user_id: userId, blocked_until: until, reason: "ip_jump" },
      { onConflict: "anon_user_id" },
    );
    await admin.from("active_sessions").delete().eq("anon_user_id", userId);
    await logEvent(userId, "suspicious_pattern", ip, ua, null, { kind: "ip_jump", prefixes: Array.from(prefixes) });
    return true;
  }
  return false;
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";

  if (isIpBlocked(ip)) {
    return new Response("Too many failures", { status: 429, headers: cors });
  }

  const tokenStr = url.searchParams.get("t");

  // ===== TOKEN MODE =====
  if (tokenStr) {
    const payload = await verifyToken(tokenStr) as TokenPayload | null;
    if (!payload) return await rejectToken(ip, ua, "bad_signature", cors);

    if (payload.e * 1000 + EXP_SKEW_MS < Date.now()) {
      return await rejectToken(ip, ua, "expired", cors, payload.s, payload.u);
    }
    if (payload.i && payload.i !== ipPrefix(ip)) {
      return await rejectToken(ip, ua, "ip_mismatch", cors, payload.s, payload.u);
    }
    const curUa = await uaHash(ua);
    if (payload.h && payload.h !== curUa) {
      return await rejectToken(ip, ua, "ua_mismatch", cors, payload.s, payload.u);
    }
    if (!ua) {
      return await rejectToken(ip, ua, "empty_ua", cors, payload.s, payload.u);
    }

    // Block list
    const { data: blockRow } = await admin
      .from("user_blocks")
      .select("blocked_until")
      .eq("anon_user_id", payload.s)
      .maybeSingle();
    if (blockRow && new Date(blockRow.blocked_until).getTime() > Date.now()) {
      return await rejectToken(ip, ua, "blocked", cors, payload.s, payload.u);
    }

    // Nonce single-use for segment tokens — but tolerate legitimate re-fetches
    // by hls.js/Chrome within NONCE_REPLAY_WINDOW_MS from the same user/ip/ua.
    if (payload.k === "segment") {
      const { error } = await admin
        .from("used_nonces")
        .insert({ nonce: payload.n });
      if (error) {
        // Nonce already exists. Allow the replay only if it was used within
        // the segment TTL window — the token itself is already bound to
        // user/ip/ua via earlier checks, so this cannot be exploited cross-user.
        const windowStart = new Date(Date.now() - NONCE_REPLAY_WINDOW_MS).toISOString();
        const { data: recent } = await admin
          .from("used_nonces")
          .select("used_at")
          .eq("nonce", payload.n)
          .gte("used_at", windowStart)
          .maybeSingle();
        if (!recent) {
          return await rejectToken(ip, ua, "nonce_replay", cors, payload.s, payload.u);
        }
        // Tolerated replay — log and continue.
        logEvent(payload.s, "nonce_replay_tolerated", ip, ua, payload.u).catch(() => {});
      }
      // Best-effort cleanup
      if (Math.random() < 0.01) {
        const cutoff = new Date(Date.now() - 60 * 60_000).toISOString();
        admin.from("used_nonces").delete().lt("used_at", cutoff).then(() => {});
      }
    }

    // Validate target
    let decoded: URL;
    try { decoded = new URL(payload.u); } catch {
      return await rejectToken(ip, ua, "bad_url", cors, payload.s, payload.u);
    }
    if (decoded.protocol !== "http:" && decoded.protocol !== "https:") {
      return await rejectToken(ip, ua, "bad_proto", cors, payload.s, payload.u);
    }
    if (isPrivateHost(decoded.host)) {
      return await rejectToken(ip, ua, "private_host", cors, payload.s, payload.u);
    }

    // ----- segment -----
    if (payload.k === "segment") {
      // Suspicious IP-jump check
      checkSuspiciousIp(payload.s, ip, ua).catch(() => {});

      const mode = payload.m === "stream" ? "stream" : "redirect";

      // Sampled telemetry
      if (Math.random() < 0.05) {
        logEvent(payload.s, "segment_request", ip, ua, payload.u, {
          host: decoded.host, mode,
        }).catch(() => {});
      }

      // Default: 302 to upstream — no bytes through proxy.
      if (mode !== "stream") {
        return new Response(null, {
          status: 302,
          headers: { ...cors, Location: payload.u, "Cache-Control": "no-store" },
        });
      }

      // STREAM mode: pipe bytes through the edge to bypass hotlink/IP blocks.
      const ipKey = payload.i || ip;
      const inFlight = ipInFlight.get(ipKey) ?? 0;
      if (inFlight >= MAX_STREAM_CONCURRENCY_PER_IP) {
        return new Response("Too many concurrent segments", {
          status: 429,
          headers: { ...cors, "Retry-After": "2" },
        });
      }
      ipBump(ipKey, 1);

      // Forward Range header so the player can do partial fetches.
      const upstreamHeaders: Record<string, string> = {
        "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
        Referer: `${decoded.protocol}//${decoded.host}/`,
        Accept: "*/*",
        Connection: "keep-alive",
        "X-Forwarded-For": ip,
        "X-Real-IP": ip,
        "CF-Connecting-IP": ip,
        "True-Client-IP": ip,
      };
      const range = req.headers.get("range");
      if (range) upstreamHeaders["Range"] = range;

      let upstream: Response | null = null;
      let lastError: string = "unknown";

      // Try local fetch first, then fallback to public proxies if it fails
      const targets = [payload.u, ...PUBLIC_PROXIES.map(p => `${p}${encodeURIComponent(payload.u)}`)];
      
      for (const targetUrl of targets) {
        try {
          const fetchInit: RequestInit & { duplex?: string } = {
            method: "GET",
            redirect: "follow",
            headers: upstreamHeaders,
            signal: AbortSignal.timeout(SEGMENT_FETCH_TIMEOUT_MS),
            duplex: "half",
          };
          const res = await fetch(targetUrl, fetchInit);
          if (res.ok) {
            upstream = res;
            break;
          }
          lastError = `Status ${res.status}`;
        } catch (err) {
          lastError = err instanceof Error ? err.message : "fetch_failed";
        }
      }

      if (!upstream) {
        ipBump(ipKey, -1);
        return new Response(`Upstream fetch failed: ${lastError}`, {
          status: 502,
          headers: { ...cors, "Content-Type": "text/plain" },
        });
      }

      // Copy a strict allow-list of headers from upstream.
      const outHeaders: Record<string, string> = { ...cors, "Cache-Control": "no-store" };
      const allowList = ["content-type", "content-length", "content-range", "accept-ranges"];
      for (const name of allowList) {
        const v = upstream.headers.get(name);
        if (v) outHeaders[name] = v;
      }
      if (!outHeaders["content-type"]) outHeaders["content-type"] = "video/mp2t";
      if (!outHeaders["accept-ranges"]) outHeaders["accept-ranges"] = "bytes";

      // Wrap body so we can decrement the in-flight counter when the stream ends.
      const origBody = upstream.body;
      let outBody: ReadableStream<Uint8Array> | null = origBody;
      if (origBody) {
        const reader = origBody.getReader();
        outBody = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                ipBump(ipKey, -1);
                return;
              }
              controller.enqueue(value);
            } catch (e) {
              try { controller.error(e); } catch { /* noop */ }
              ipBump(ipKey, -1);
            }
          },
          cancel() {
            try { reader.cancel(); } catch { /* noop */ }
            ipBump(ipKey, -1);
          },
        });
      } else {
        ipBump(ipKey, -1);
      }

      return new Response(outBody, {
        status: upstream.status, // 200 or 206 (Partial Content)
        headers: outHeaders,
      });
    }

    // ----- playlist: fetch upstream, rewrite, return inline -----
    // Helper para buscar uma playlist do upstream com headers padrão.
    const getUpstreamHeaders = (targetUrl: string, clientIpAddr: string) => {
      const d = new URL(targetUrl);
      return {
        "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
        Referer: `${d.protocol}//${d.host}/`,
        Accept: "*/*",
        Connection: "keep-alive",
        "X-Forwarded-For": clientIpAddr,
        "X-Real-IP": clientIpAddr,
        "CF-Connecting-IP": clientIpAddr,
        "True-Client-IP": clientIpAddr,
      };
    };

    const fetchPlaylist = async (rawUrl: string): Promise<{ text: string; finalUrl: URL } | { error: Response }> => {
      let lastError: string = "unknown";
      const targets = [rawUrl, ...PUBLIC_PROXIES.map(p => `${p}${encodeURIComponent(rawUrl)}`)];

      for (const targetUrl of targets) {
        try {
          const headers = getUpstreamHeaders(targetUrl, ip);
          const r = await fetch(targetUrl, { method: "GET", redirect: "follow", headers });
          if (!r.ok) {
            lastError = `Status ${r.status}`;
            continue;
          }
          const fUrl = new URL(r.url || rawUrl);
          if (isPrivateHost(fUrl.host)) continue;
          
          const t = await r.text();
          if (t.includes("#EXTM3U") || t.includes("#EXT-X")) {
            return { text: t, finalUrl: fUrl };
          }
          lastError = "Not a playlist";
        } catch (err) {
          lastError = err instanceof Error ? err.message : "fetch_failed";
        }
      }

      return {
        error: new Response(`Playlist fetch failed: ${lastError}`, {
          status: 502,
          headers: { ...cors, "Content-Type": "text/plain" },
        }),
      };
    };

    // ===== Pull master =====
    const firstResult = await fetchPlaylist(payload.u);
    if ("error" in firstResult) return firstResult.error;

    let { text, finalUrl } = firstResult;

    // ===== Inline-fold de master de 1 variante (ganho ~1.3s por canal) =====
    // Quando o upstream devolve um master playlist com exatamente um
    // #EXT-X-STREAM-INF, hls.js fará outro round-trip ao stream-proxy só pra
    // pegar a nested. Como não há ABR (1 variante), podemos pegar a nested
    // já agora e devolver direto — o player nunca vê o master.
    const isMaster = /^#EXT-X-STREAM-INF/m.test(text);
    if (isMaster) {
      const baseHrefMaster = finalUrl.toString().substring(0, finalUrl.toString().lastIndexOf("/") + 1);
      const variantLines: string[] = [];
      const masterLines = text.split("\n");
      for (let i = 0; i < masterLines.length; i++) {
        const ln = masterLines[i].trim();
        if (!ln || ln.startsWith("#")) continue;
        // Linha imediatamente após STREAM-INF é a URL da variante.
        const prev = (masterLines[i - 1] || "").trim();
        if (prev.startsWith("#EXT-X-STREAM-INF")) variantLines.push(ln);
      }
      if (variantLines.length === 1) {
        try {
          const variantAbs = new URL(variantLines[0], baseHrefMaster).toString();
          const nested = await fetchPlaylist(variantAbs);
          if (!("error" in nested)) {
            text = nested.text;
            finalUrl = nested.finalUrl;
          }
          // Se nested falhar, segue com master original — não regride
          // comportamento.
        } catch { /* keep master fallback */ }
      }
    }

    const baseHref = finalUrl.toString().substring(0, finalUrl.toString().lastIndexOf("/") + 1);

    // Re-sign each segment URL with a new short-lived segment token bound to
    // the same user/ip/ua. We sign here (not via stream-token call) to avoid
    // round-tripping for every line.
    const childMode = payload.m === "stream" ? "stream" : "redirect";
    const signSegment = async (abs: string): Promise<string> => {
      const exp = Math.floor(Date.now() / 1000) + SEGMENT_TTL_S;
      const tok = await signToken({
        u: abs, e: exp, s: payload.s, i: payload.i, h: payload.h, n: newNonce(), k: "segment", m: childMode,
      });
      return `${PROXY_BASE}?t=${encodeURIComponent(tok)}`;
    };
    const signNestedPlaylist = async (abs: string): Promise<string> => {
      // Aumentado de 60s → 1800s. Mesmo motivo do TTL_PLAYLIST_S em
      // stream-token: hls.js reusa o token da nested playlist em refreshes
      // ao longo da sessão; TTL curto = 403 após ~1min de live.
      const exp = Math.floor(Date.now() / 1000) + 1800;
      const tok = await signToken({
        u: abs, e: exp, s: payload.s, i: payload.i, h: payload.h, n: newNonce(), k: "playlist", m: childMode,
      });
      return `${PROXY_BASE}?t=${encodeURIComponent(tok)}`;
    };

    // ===== Pass 1: parse — collect signing jobs synchronously =====
    type Job = { kind: "segment" | "nested" | "uri-tag"; abs: string; line: string };
    const lines = text.split("\n");
    const jobs: (Job | null)[] = new Array(lines.length).fill(null);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("#")) {
        const m = line.match(/URI="([^"]+)"/);
        if (m) {
          try {
            const abs = new URL(m[1], baseHref).toString();
            jobs[i] = { kind: "uri-tag", abs, line };
          } catch { /* keep line as-is */ }
        }
        continue;
      }
      try {
        const abs = new URL(trimmed, baseHref).toString();
        const isNestedPlaylist = abs.toLowerCase().includes(".m3u8");
        jobs[i] = { kind: isNestedPlaylist ? "nested" : "segment", abs, line };
      } catch { /* keep line as-is */ }
    }

    // ===== Pass 2: sign with bounded concurrency (5 parallel) =====
    const indexedJobs = jobs
      .map((j, idx) => (j ? { idx, job: j } : null))
      .filter((x): x is { idx: number; job: Job } => x !== null);
    const signed: Map<number, string> = new Map();
    const CONCURRENCY = 5;
    let cursor = 0;
    const workers: Promise<void>[] = [];
    for (let w = 0; w < CONCURRENCY; w++) {
      workers.push((async () => {
        while (true) {
          const myIdx = cursor++;
          if (myIdx >= indexedJobs.length) return;
          const { idx, job } = indexedJobs[myIdx];
          try {
            if (job.kind === "nested") {
              signed.set(idx, await signNestedPlaylist(job.abs));
            } else {
              signed.set(idx, await signSegment(job.abs));
            }
          } catch {
            // leave unsigned → original line will be used
          }
        }
      })());
    }
    await Promise.all(workers);

    // ===== Pass 3: assemble output synchronously =====
    const out: string[] = new Array(lines.length);
    for (let i = 0; i < lines.length; i++) {
      const job = jobs[i];
      const line = lines[i];
      const sig = signed.get(i);
      if (!job || !sig) { out[i] = line; continue; }
      if (job.kind === "uri-tag") {
        out[i] = line.replace(/URI="([^"]+)"/, `URI="${sig}"`);
      } else {
        out[i] = sig;
      }
    }

    return new Response(out.join("\n"), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache",
      },
    });
  }

  // ===== LEGACY MODE (raw url) — admin/debug only, allow-listed hosts =====
  const target = url.searchParams.get("url");
  if (!target) return new Response("Missing url/t param", { status: 400, headers: cors });

  let decoded: URL;
  try { decoded = new URL(target); } catch {
    return new Response("Invalid url", { status: 400, headers: cors });
  }
  if (decoded.protocol !== "http:" && decoded.protocol !== "https:") {
    return new Response("Unsupported protocol", { status: 400, headers: cors });
  }
  const targetHost = decoded.host.toLowerCase();
  if (isPrivateHost(targetHost)) {
    return new Response("Forbidden host", { status: 403, headers: cors });
  }
  const allowedHosts = await getAllowedHosts();
  const originalAllowed = allowedHosts.has(targetHost) || allowedHosts.has(targetHost.split(":")[0]);
  if (!originalAllowed) {
    return new Response(`Host not allowed: ${targetHost}`, { status: 403, headers: cors });
  }

  // Legacy: 302 to upstream (no bytes through proxy).
  return new Response(null, {
    status: 302,
    headers: { ...cors, Location: decoded.toString(), "Cache-Control": "no-store" },
  });
});
