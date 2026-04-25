// Issues short-lived signed tokens for the stream-proxy. Enforces:
// - JWT (anonymous Supabase auth)
// - active block check
// - per-user rate limit (60 tokens/min, 300 segments/min)
// - active session upsert (kills extra sessions over MAX_SESSIONS)
// - logs token_issued / rate_limited / user_blocked events

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import {
  clientIp,
  ipPrefix,
  newNonce,
  signToken,
  uaHash,
  urlHash,
  type TokenKind,
  type TokenMode,
} from "../_shared/stream-token.ts";

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
  } catch { /* ignore */ }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // Cacheia o preflight por 24h. Sem isso, cada novo canal aberto pagava
    // ~700ms de OPTIONS. Browsers respeitam até 86400s (Chromium teto).
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Singleton: criar client por request causa cold-start frequente e contribui
// para 503 SUPABASE_EDGE_RUNTIME_ERROR sob carga.
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

// Decodifica JWT sem validar criptograficamente (só pega `sub`).
// O Supabase Gateway já valida o JWT antes da requisição chegar aqui (verify_jwt=true).
function extractUserIdFromJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

const MAX_SESSIONS = 2;
const RATE_REQ_PER_MIN = 60;
const RATE_SEG_PER_MIN = 300;
// Aumentado de 60s → 1800s (30min). TTL curto causava 403 em massa após
// ~60s de reprodução: o hls.js refresca a playlist a cada ~target-duration
// segundos em live, mas a URL do <source> mantém o token original. Quando
// o token expira, todos os refreshes seguintes dão 403 e o canal trava.
// O token continua amarrado a sessão+IP+UA — TTL longo apenas alarga a
// janela de uso, sem dar privilégio adicional.
const TTL_PLAYLIST_S = 1800;
// Increased from 30s → 45s. hls.js retries with backoff and may reuse a token
// 20–30s after issuance; 30s caused legitimate "expired" rejections.
const TTL_SEGMENT_S = 45;

const PROXY_BASE = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/stream-proxy`;

// ===== Caches em memória (per-worker) =====
// Bloqueios mudam raramente; SELECT por request adiciona ~150-300ms ao
// caminho crítico. Cache curto (30s) é seguro: usuário bloqueado vê
// rejeição até ~30s depois — bem abaixo do TTL do token (30min).
type BlockCacheEntry = { until: number; blockedUntil: string | null };
const blockCache = new Map<string, BlockCacheEntry>();
const BLOCK_CACHE_TTL_MS = 30_000;

// Counter local (per-worker) com upsert opportunistic. Persiste no DB mas
// não bloqueia o response — perdas em cold-start do worker são aceitáveis
// (rate limit é eventualmente consistente). Resetamos no minuto novo.
type CounterEntry = { winStart: string; req: number; seg: number };
const counterCache = new Map<string, CounterEntry>();

function json(body: unknown, status: number, cors: Record<string, string>, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...extra },
  });
}

// Roda promises em background sem bloquear o response. Em Deno Deploy /
// Supabase Edge isso é suportado via EdgeRuntime.waitUntil quando
// disponível; cai pra .catch silencioso quando não.
// deno-lint-ignore no-explicit-any
const _edge: any = (globalThis as any).EdgeRuntime;
function background(p: Promise<unknown>) {
  if (_edge && typeof _edge.waitUntil === "function") {
    try { _edge.waitUntil(p); return; } catch { /* fallthrough */ }
  }
  // Fallback: deixa rodar; suprime rejeição não-tratada.
  p.catch(() => { /* swallow */ });
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
  } catch {
    // never block on logging
  }
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  try {
    const ua = req.headers.get("user-agent") || "";
    const ip = clientIp(req);

    // 1) Auth
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Missing token" }, 401, cors);

    // Extrai user id direto do JWT — evita roundtrip ao /auth/v1/user.
    const userId = extractUserIdFromJwt(jwt);
    if (!userId) return json({ error: "Invalid session" }, 401, cors);

    // 2) Body
    let body: { url?: string; kind?: TokenKind; iptv_username?: string; mode?: TokenMode };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid body" }, 400, cors);
    }
    const target = (body.url || "").trim();
    const kind: TokenKind = body.kind === "segment" ? "segment" : "playlist";
    const mode: TokenMode = body.mode === "stream" ? "stream" : "redirect";
    if (!target || !/^https?:\/\//i.test(target)) {
      return json({ error: "Invalid url" }, 400, cors);
    }

    const iptvUser = (body.iptv_username || "").slice(0, 120) || null;

    // 3) Janela de rate limit (minuto atual)
    const now = new Date();
    const winStart = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(),
      now.getHours(), now.getMinutes(), 0, 0,
    ).toISOString();

    // 4) Cache hit de bloqueio (TTL 30s)? Caminho rápido, sem I/O.
    const cachedBlock = blockCache.get(userId);
    if (cachedBlock && cachedBlock.until > Date.now()) {
      if (cachedBlock.blockedUntil && new Date(cachedBlock.blockedUntil).getTime() > Date.now()) {
        background(logEvent(userId, "token_rejected", ip, ua, target, { reason: "blocked", cache: true }));
        return json(
          { error: "Acesso temporariamente bloqueado", blocked_until: cachedBlock.blockedUntil },
          403,
          cors,
        );
      }
    }

    // 5) Counter local? Caminho rápido para early rate-limit reject.
    const cachedCounter = counterCache.get(userId);
    if (cachedCounter && cachedCounter.winStart === winStart) {
      const projReq = cachedCounter.req + 1;
      const projSeg = cachedCounter.seg + (kind === "segment" ? 1 : 0);
      if (projReq > RATE_REQ_PER_MIN || projSeg > RATE_SEG_PER_MIN) {
        background(logEvent(userId, "rate_limited", ip, ua, target, { projReq, projSeg, cache: true }));
        return json({ error: "Too many requests" }, 429, cors, { "Retry-After": "60" });
      }
    }

    // 6) Paralelizar todas as leituras restantes + uaHash. Antes era
    // sequencial: 3 SELECTs * ~150ms cada = ~450ms só de I/O.
    const cutoff90 = new Date(Date.now() - 90_000).toISOString();
    const needsBlockFetch = !cachedBlock || cachedBlock.until <= Date.now();
    const needsCounterFetch = !cachedCounter || cachedCounter.winStart !== winStart;

    const [
      blockRes,
      counterRes,
      sessionsRes,
      uahHashed,
    ] = await Promise.all([
      needsBlockFetch
        ? admin.from("user_blocks").select("blocked_until").eq("anon_user_id", userId).maybeSingle()
        : Promise.resolve({ data: null as null | { blocked_until: string } }),
      needsCounterFetch
        ? admin.from("usage_counters").select("request_count, segment_count").eq("anon_user_id", userId).eq("window_start", winStart).maybeSingle()
        : Promise.resolve({ data: { request_count: cachedCounter!.req, segment_count: cachedCounter!.seg } }),
      iptvUser
        ? admin.from("active_sessions").select("anon_user_id").eq("iptv_username", iptvUser).gt("last_seen_at", cutoff90).neq("anon_user_id", userId).order("started_at", { ascending: true })
        : Promise.resolve({ data: [] as { anon_user_id: string }[] }),
      uaHash(ua),
    ]);

    const uah = uahHashed;

    // 7) Update cache de bloqueio com o que veio do DB.
    const dbBlockedUntil = blockRes.data?.blocked_until ?? null;
    blockCache.set(userId, { until: Date.now() + BLOCK_CACHE_TTL_MS, blockedUntil: dbBlockedUntil });
    if (dbBlockedUntil && new Date(dbBlockedUntil).getTime() > Date.now()) {
      background(logEvent(userId, "token_rejected", ip, ua, target, { reason: "blocked" }));
      return json(
        { error: "Acesso temporariamente bloqueado", blocked_until: dbBlockedUntil },
        403,
        cors,
      );
    }

    // 8) Rate limit final com valor do DB.
    const dbReq = counterRes.data?.request_count ?? 0;
    const dbSeg = counterRes.data?.segment_count ?? 0;
    const nextReq = dbReq + 1;
    const nextSeg = dbSeg + (kind === "segment" ? 1 : 0);

    if (nextReq > RATE_REQ_PER_MIN || nextSeg > RATE_SEG_PER_MIN) {
      // Atualiza cache e dispara verificação de escalonamento em background.
      counterCache.set(userId, { winStart, req: dbReq, seg: dbSeg });
      background((async () => {
        await logEvent(userId, "rate_limited", ip, ua, target, { nextReq, nextSeg });
        const since = new Date(Date.now() - 10 * 60_000).toISOString();
        const { count: viol } = await admin
          .from("stream_events")
          .select("id", { count: "exact", head: true })
          .eq("anon_user_id", userId)
          .eq("event_type", "rate_limited")
          .gte("created_at", since);
        if ((viol ?? 0) > 3) {
          const minutes = (viol ?? 0) > 10 ? 60 : (viol ?? 0) > 6 ? 15 : 5;
          const until = new Date(Date.now() + minutes * 60_000).toISOString();
          await admin.from("user_blocks").upsert(
            { anon_user_id: userId, blocked_until: until, reason: `rate_limit_x${viol}` },
            { onConflict: "anon_user_id" },
          );
          // Invalida cache local pra próximo request bloquear sem espera.
          blockCache.set(userId, { until: Date.now() + BLOCK_CACHE_TTL_MS, blockedUntil: until });
          await logEvent(userId, "user_blocked", ip, ua, null, { minutes, reason: "rate_limit" });
        }
      })());
      return json({ error: "Too many requests" }, 429, cors, { "Retry-After": "60" });
    }

    // 9) Atualiza counter local imediatamente.
    counterCache.set(userId, { winStart, req: nextReq, seg: nextSeg });

    // 10) Sign token agora — caminho crítico mínimo.
    const ttl = kind === "segment" ? TTL_SEGMENT_S : TTL_PLAYLIST_S;
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const nonce = newNonce();
    const token = await signToken({
      u: target, e: exp, s: userId, i: ipPrefix(ip), h: uah, n: nonce, k: kind, m: mode,
    });

    const proxied = `${PROXY_BASE}?t=${encodeURIComponent(token)}`;
    const response = json({ url: proxied, expires_at: exp }, 200, cors);

    // 11) Persistência em background — não bloqueia o response. Custos antes:
    // ~300-500ms (counter upsert + sessions select/upsert + log_event).
    background((async () => {
      // Counter upsert com valores autoritativos.
      await admin.from("usage_counters").upsert(
        { anon_user_id: userId, window_start: winStart, request_count: nextReq, segment_count: nextSeg },
        { onConflict: "anon_user_id,window_start" },
      );

      // Cleanup oportunístico.
      if (Math.random() < 0.05) {
        const cutoff = new Date(Date.now() - 60 * 60_000).toISOString();
        await admin.from("usage_counters").delete().lt("window_start", cutoff);
      }

      // MAX_SESSIONS enforcement.
      if (iptvUser) {
        const actives = sessionsRes.data ?? [];
        const total = actives.length + 1;
        if (total > MAX_SESSIONS) {
          const evictCount = total - MAX_SESSIONS;
          const toEvict = actives.slice(0, evictCount).map((r) => r.anon_user_id);
          if (toEvict.length > 0) {
            await admin.from("active_sessions").delete().in("anon_user_id", toEvict);
            await logEvent(userId, "session_evicted", ip, ua, null, { evicted: toEvict, iptv_username: iptvUser });
          }
        }
      }

      // Active session upsert. Guarda também o servidor IPTV (DNS) que o usuário está
      // usando, para o painel admin mostrar de qual provedor vem o stream.
      let serverOrigin: string | null = null;
      try {
        const u = new URL(target);
        serverOrigin = `${u.protocol}//${u.host}`.toLowerCase();
      } catch {
        serverOrigin = null;
      }
      await admin.from("active_sessions").upsert(
        {
          anon_user_id: userId,
          iptv_username: iptvUser,
          ip,
          ua_hash: uah,
          server_url: serverOrigin,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "anon_user_id" },
      );

      await logEvent(userId, "token_issued", ip, ua, target, { kind, mode });
    })());

    return response;
  } catch (e) {
    console.error("[stream-token] unhandled", e);
    return json({ error: "internal_error" }, 500, cors);
  }
});
