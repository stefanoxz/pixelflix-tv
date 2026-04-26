// Edge function "watch-progress" — gateway seguro para a tabela watch_progress.
//
// Modelo: ninguém escreve direto na tabela. Cliente:
//   1) chama action="auth" com {server, username, password}. Validamos a
//      credencial fazendo um GET ao player_api.php do servidor IPTV (mesma
//      estratégia do iptv-login). Se ok, devolvemos um token HMAC assinado
//      com STREAM_PROXY_SECRET, válido por 24h, ligado a (server, username).
//   2) chama action="list" | "upsert" | "delete" passando o token em
//      Authorization: Bearer <token>. A função verifica assinatura/exp e
//      executa a operação com service_role (bypass RLS).
//
// O token NÃO contém a senha. Quem o pegar consegue, no máximo, ler/alterar
// o progresso da MESMA conta IPTV — o mesmo nível de exposição que já
// existia quando dois dispositivos compartilhavam a mesma linha. Mas
// elimina o vetor onde QUALQUER anônimo lia/apagava progresso de QUALQUER
// usuário (era o buraco crítico).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

console.log("[watch-progress] boot");

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
    /* ignore */
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

// ---------- HMAC token (server, username, exp) ----------

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cachedKey: CryptoKey | null = null;
async function getHmacKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret = Deno.env.get("STREAM_PROXY_SECRET");
  if (!secret) throw new Error("STREAM_PROXY_SECRET not configured");
  cachedKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return cachedKey;
}

interface ProgressToken {
  /** server_url normalizado */
  s: string;
  /** username */
  u: string;
  /** exp (epoch seconds) */
  e: number;
}

async function signProgressToken(p: ProgressToken): Promise<string> {
  const key = await getHmacKey();
  const head = b64urlEncode(enc.encode(JSON.stringify(p)));
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(`wp.${head}`)),
  );
  return `${head}.${b64urlEncode(sig)}`;
}

function timingSafeEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

async function verifyProgressToken(token: string): Promise<ProgressToken | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const head = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (!head || !sigB64) return null;
  let key: CryptoKey;
  try {
    key = await getHmacKey();
  } catch {
    return null;
  }
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(`wp.${head}`)),
  );
  let sig: Uint8Array;
  try {
    sig = b64urlDecode(sigB64);
  } catch {
    return null;
  }
  if (!timingSafeEq(expected, sig)) return null;
  let payload: ProgressToken;
  try {
    payload = JSON.parse(dec.decode(b64urlDecode(head))) as ProgressToken;
  } catch {
    return null;
  }
  if (!payload || typeof payload.s !== "string" || typeof payload.u !== "string" || typeof payload.e !== "number") {
    return null;
  }
  if (payload.e < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function normalizeServerUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

// ---------- Validação de credencial IPTV ----------

const PRIMARY_UA = "VLC/3.0.20 LibVLC/3.0.20";
const VALIDATE_TIMEOUT_MS = 5_000;

async function validateIptvCredentials(
  server: string,
  username: string,
  password: string,
): Promise<boolean> {
  // Tenta tanto base normalizada quanto :8080/:80 (alguns painéis exigem porta).
  const bases = [server];
  try {
    const u = new URL(server);
    if (!u.port) {
      bases.push(`${u.protocol}//${u.hostname}:80`);
      bases.push(`${u.protocol}//${u.hostname}:8080`);
    }
  } catch {
    return false;
  }

  for (const base of bases) {
    const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), VALIDATE_TIMEOUT_MS);
      const resp = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": PRIMARY_UA, "Accept": "application/json" },
        signal: ctrl.signal,
        redirect: "follow",
      });
      clearTimeout(t);
      if (!resp.ok) continue;
      const text = await resp.text();
      let data: any;
      try { data = JSON.parse(text); } catch { continue; }
      const auth = data?.user_info?.auth;
      // Xtream retorna user_info.auth=1 quando válido.
      if (auth === 1 || auth === "1") return true;
      if (auth === 0 || auth === "0") return false;
    } catch {
      continue;
    }
  }
  return false;
}

// ---------- DB helpers ----------

let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (_admin) return _admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("MISSING_ENV");
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

// Cache do allowlist (60s) — evita hits no DB a cada auth.
let _allowedCache: { at: number; list: string[] } | null = null;
async function getAllowedServers(): Promise<string[]> {
  if (_allowedCache && Date.now() - _allowedCache.at < 60_000) return _allowedCache.list;
  try {
    const { data } = await getAdmin().from("allowed_servers").select("server_url");
    const list = ((data ?? []) as Array<{ server_url: string }>).map(
      (r) => normalizeServerUrl(r.server_url),
    );
    _allowedCache = { at: Date.now(), list };
    return list;
  } catch {
    return _allowedCache?.list ?? [];
  }
}

/**
 * Defesa em profundidade contra SSRF: rejeita hosts privados/loopback/metadata
 * mesmo que entrem na allowlist por engano.
 */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "::" || h === "[::]") return true;
  // IPv4 privados/reservados
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 0) return true;
    if (a >= 224) return true; // multicast/reserved
  }
  // IPv6 loopback / link-local / unique-local
  if (/^\[?(::1|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe80:)/i.test(h)) return true;
  return false;
}

function jsonResp(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ---------- Handler ----------

interface UpsertEntry {
  item_key: string;
  kind: "movie" | "episode";
  content_id: string;
  series_id?: number | null;
  title?: string | null;
  poster_url?: string | null;
  position_seconds: number;
  duration_seconds: number;
  updated_at?: string;
}

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return jsonResp(405, { error: "method_not_allowed" }, cors);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResp(400, { error: "invalid_json" }, cors);
  }

  const action = String(body?.action ?? "");

  // --- AUTH: troca creds por token ---
  if (action === "auth") {
    const server = normalizeServerUrl(body?.server);
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!server || !username || !password) {
      return jsonResp(400, { error: "missing_credentials" }, cors);
    }
    const ok = await validateIptvCredentials(server, username, password);
    if (!ok) {
      return jsonResp(401, { error: "invalid_credentials" }, cors);
    }
    const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const token = await signProgressToken({ s: server, u: username, e: exp });
    return jsonResp(200, { token, expires_at: exp }, cors);
  }

  // --- Demais ações exigem token ---
  const authHeader = req.headers.get("authorization") ?? "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return jsonResp(401, { error: "missing_token" }, cors);
  const payload = await verifyProgressToken(m[1].trim());
  if (!payload) return jsonResp(401, { error: "invalid_or_expired_token" }, cors);

  const server = payload.s;
  const username = payload.u;
  const admin = getAdmin();

  try {
    if (action === "list") {
      const { data, error } = await admin
        .from("watch_progress")
        .select("*")
        .eq("server_url", server)
        .eq("username", username);
      if (error) throw error;
      return jsonResp(200, { entries: data ?? [] }, cors);
    }

    if (action === "upsert") {
      const entries: UpsertEntry[] = Array.isArray(body?.entries) ? body.entries : [];
      if (entries.length === 0) return jsonResp(200, { upserted: 0 }, cors);
      if (entries.length > 200) {
        return jsonResp(400, { error: "too_many_entries" }, cors);
      }
      const rows = entries
        .map((e) => {
          if (!e || typeof e.item_key !== "string" || !e.item_key) return null;
          const kind = e.kind === "movie" || e.kind === "episode" ? e.kind : null;
          if (!kind) return null;
          const pos = Number(e.position_seconds);
          const dur = Number(e.duration_seconds);
          if (!Number.isFinite(pos) || !Number.isFinite(dur) || dur <= 0) return null;
          return {
            server_url: server,
            username,
            item_key: e.item_key.slice(0, 200),
            kind,
            content_id: String(e.content_id ?? "").slice(0, 100),
            series_id: e.series_id != null && Number.isFinite(Number(e.series_id))
              ? Number(e.series_id) : null,
            title: e.title ? String(e.title).slice(0, 500) : null,
            poster_url: e.poster_url ? String(e.poster_url).slice(0, 1000) : null,
            position_seconds: Math.max(0, Math.floor(pos)),
            duration_seconds: Math.max(0, Math.floor(dur)),
            updated_at: e.updated_at ?? new Date().toISOString(),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (rows.length === 0) return jsonResp(400, { error: "no_valid_entries" }, cors);
      const { error } = await admin
        .from("watch_progress")
        .upsert(rows, { onConflict: "server_url,username,item_key" });
      if (error) throw error;
      return jsonResp(200, { upserted: rows.length }, cors);
    }

    if (action === "delete") {
      const itemKey = typeof body?.item_key === "string" ? body.item_key : "";
      if (!itemKey) return jsonResp(400, { error: "missing_item_key" }, cors);
      const { error } = await admin
        .from("watch_progress")
        .delete()
        .match({ server_url: server, username, item_key: itemKey });
      if (error) throw error;
      return jsonResp(200, { deleted: true }, cors);
    }

    return jsonResp(400, { error: "unknown_action" }, cors);
  } catch (err) {
    console.error("[watch-progress] db error", err);
    return jsonResp(500, { error: "internal_error", detail: String((err as Error)?.message ?? err) }, cors);
  }
});
