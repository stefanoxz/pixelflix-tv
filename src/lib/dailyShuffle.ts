/**
 * Deterministic shuffle helpers used by the Highlights page to rotate
 * featured items daily without showing the exact same order all day.
 *
 * Same seed → same order; different days → different orders. No `Math.random`,
 * no global state.
 */

/**
 * 32-bit FNV-1a hash. Cheap and good enough for seed material.
 */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * Mulberry32 — fast, good distribution for small N.
 */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a new array with the same elements, shuffled deterministically
 * by seed. Pure: no in-place mutation, no global RNG.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Today's date as a short seed string in the user's local timezone
 * (e.g. "2026-04-26"). Stable for the entire day.
 */
export function todaySeed(salt = ""): number {
  const d = new Date();
  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}:${salt}`;
  return hashSeed(s);
}
