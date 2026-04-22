// Shared HMAC token helpers used by stream-token and stream-proxy.
// Token format (URL-safe base64):
//   payloadJSON.base64 + "." + signature.base64
// Payload fields: u (url), e (exp epoch s), s (sub uuid),
// i (ip prefix), h (uaHash), n (nonce), k (kind)

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
async function getKey(): Promise<CryptoKey> {
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

export type TokenKind = "playlist" | "segment";

export interface TokenPayload {
  u: string; // url
  e: number; // exp epoch (seconds)
  s: string; // sub (anon_user_id)
  i: string; // ip prefix
  h: string; // ua hash
  n: string; // nonce
  k: TokenKind; // kind
}

export async function signToken(p: TokenPayload): Promise<string> {
  const key = await getKey();
  const head = b64urlEncode(enc.encode(JSON.stringify(p)));
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(head)),
  );
  return `${head}.${b64urlEncode(sig)}`;
}

function timingSafeEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const head = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (!head || !sigB64) return null;
  let key: CryptoKey;
  try {
    key = await getKey();
  } catch {
    return null;
  }
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(head)),
  );
  let sig: Uint8Array;
  try {
    sig = b64urlDecode(sigB64);
  } catch {
    return null;
  }
  if (!timingSafeEq(expected, sig)) return null;
  try {
    return JSON.parse(dec.decode(b64urlDecode(head))) as TokenPayload;
  } catch {
    return null;
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Truncated SHA-256 hex (first 16 chars) — used for UA fingerprint. */
export async function uaHash(ua: string | null | undefined): Promise<string> {
  return (await sha256Hex(ua || "")).slice(0, 16);
}

/** Truncated SHA-256 hex (first 24 chars) — used for URL fingerprint in logs. */
export async function urlHash(url: string): Promise<string> {
  return (await sha256Hex(url)).slice(0, 24);
}

/** /24 IPv4 prefix or /64 IPv6 prefix. Tolerates IP roaming on mobile. */
export function ipPrefix(ip: string | null | undefined): string {
  if (!ip) return "";
  const trimmed = ip.trim();
  // IPv4
  const m4 = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (m4) return `${m4[1]}.${m4[2]}.${m4[3]}.0/24`;
  // IPv6: take first 4 hex groups (64 bits)
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    return parts.slice(0, 4).join(":") + "::/64";
  }
  return trimmed;
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    ""
  );
}

export function newNonce(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return b64urlEncode(bytes);
}
