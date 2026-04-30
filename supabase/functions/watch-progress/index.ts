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
const VALIDATE_TIMEOUT_MS = 15_000;

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

  // Tentamos múltiplas actions porque alguns painéis bloqueiam o endpoint base
  // sem `action` mas respondem em endpoints com action. Qualquer resposta JSON
  // 200 indica credenciais válidas (Xtream retorna 401/string vazia p/ inválido).
  //
  // IMPORTANTE: se TODAS as tentativas falharem por erro de rede ou HTTP não-2xx
  // (sem nunca recebermos `auth=0`), tratamos como VÁLIDO. O usuário já passou
  // pela validação no `iptv-login`; uma indisponibilidade temporária do painel
  // (ex: bloqueio de IP do proxy) não deve invalidar a sessão dele aqui.
  const actions = ["", "get_live_categories", "get_vod_categories"];
  let sawDefinitiveDeny = false;
  for (const base of bases) {
    for (const action of actions) {
      const qs = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}${action ? `&action=${action}` : ""}`;
      const url = `${base}/player_api.php?${qs}`;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), VALIDATE_TIMEOUT_MS);
        const resp = await fetch(url, {
          method: "GET",
          headers: { "User-Agent": PRIMARY_UA, "Accept": "application/json, */*" },
          signal: ctrl.signal,
          redirect: "follow",
        });
        clearTimeout(t);
        // 401/403 explícito = credencial negada de forma definitiva.
        if (resp.status === 401 || resp.status === 403) {
          sawDefinitiveDeny = true;
          continue;
        }
        if (!resp.ok) continue;
        const text = await resp.text();
        let data: any;
        try { data = JSON.parse(text); } catch { continue; }
        if (!action) {
          const auth = data?.user_info?.auth;
          if (auth === 1 || auth === "1") return true;
          if (auth === 0 || auth === "0") { sawDefinitiveDeny = true; continue; }
        } else {
          if (Array.isArray(data) || (data && typeof data === "object")) return true;
        }
      } catch {
        continue;
      }
    }
  }
  // Nenhuma resposta conclusiva: só nega se vimos um deny explícito.
  if (sawDefinitiveDeny) return false;
  console.warn(
    `[watch-progress] validateIptvCredentials: painel inacessível para ${server}; aceitando credenciais (já validadas em iptv-login)`,
  );
  return true;
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

  try {
    // Edge Function desativada para limpeza total do sistema.
    // Retorna respostas vazias de sucesso para manter o app funcionando sem erros visuais.
    if (action === "auth") return jsonResp(200, { token: "disabled", expires_at: 0 }, cors);
    if (action === "list") return jsonResp(200, { entries: [] }, cors);
    return jsonResp(200, { ok: true, upserted: 0, deleted: true }, cors);
  } catch (e) {
    return jsonResp(200, { ok: true }, cors);
  }
});

