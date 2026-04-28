import { useMemo } from "react";

/**
 * Busca tolerante a erros de digitação, acentos e ordem de palavras.
 *
 * Estratégia em camadas (mais barata → mais cara). Cada item recebe um score:
 *   3 = substring direto (melhor)
 *   2 = todos os tokens da query aparecem (em qualquer ordem)
 *   1 = aproximação fuzzy (Levenshtein limitado)
 *   0 = não casa
 *
 * Importante: scores maiores aparecem primeiro (não confundir com a ordem
 * mencionada no plano — aqui maior = mais relevante).
 */

/** lowercase + remove diacríticos. "João" → "joao". */
export function normalize(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Distância de Levenshtein limitada por `maxDist`. Retorna `maxDist + 1`
 * assim que ultrapassa o limite (early-exit), para não pagar o custo de
 * comparações que de qualquer forma já não casariam.
 */
function boundedLevenshtein(a: string, b: string, maxDist: number): number {
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > maxDist) return maxDist + 1;
  if (al === 0) return bl;
  if (bl === 0) return al;

  // Matriz reutilizando 2 linhas (footprint mínimo).
  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deleção
        curr[j - 1] + 1,    // inserção
        prev[j - 1] + cost, // substituição
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

/**
 * Procura `query` em `target` permitindo `maxDist` erros, deslizando uma
 * janela do tamanho da query pelo target. Mais barato que comparar a
 * string inteira — bom pra achar termos curtos dentro de títulos longos.
 */
function fuzzyContains(query: string, target: string, maxDist: number): boolean {
  const ql = query.length;
  const tl = target.length;
  if (ql > tl + maxDist) return false;
  // Janelas de tamanho ql, com folga de maxDist em cada ponta.
  const windowLen = ql;
  const last = tl - windowLen + maxDist;
  for (let start = -maxDist; start <= last; start++) {
    const s = Math.max(0, start);
    const e = Math.min(tl, start + windowLen + maxDist);
    const slice = target.slice(s, e);
    if (boundedLevenshtein(query, slice, maxDist) <= maxDist) return true;
  }
  return false;
}

/** Tolerância de erros baseada no tamanho da query. */
function maxDistFor(len: number): number {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

/**
 * Calcula o score de match entre uma query já normalizada e um target
 * já normalizado. Retorna 0 se não casa.
 */
export function scoreMatch(qNorm: string, targetNorm: string): number {
  if (!qNorm) return 0;

  // Camada 1: substring direto (mais comum, caminho rápido).
  if (targetNorm.includes(qNorm)) return 3;

  // Camada 2: tokens AND (palavras em qualquer ordem).
  const tokens = qNorm.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => targetNorm.includes(t))) {
    return 2;
  }

  // Camada 3: fuzzy (só se query for razoavelmente longa).
  if (qNorm.length >= 3) {
    const maxD = maxDistFor(qNorm.length);
    // Tenta a query inteira contra o target.
    if (fuzzyContains(qNorm, targetNorm, maxD)) return 1;
    // E também token a token (cada palavra precisa fuzzy-casar em algum lugar).
    if (
      tokens.length > 1 &&
      tokens.every((t) => {
        if (t.length < 3) return targetNorm.includes(t);
        return fuzzyContains(t, targetNorm, maxDistFor(t.length));
      })
    ) {
      return 1;
    }
  }

  return 0;
}

/**
 * Hook que devolve `items` filtrado e reordenado por relevância em relação
 * a `query`. `getName` extrai o texto pesquisável de cada item.
 *
 * Memoiza os nomes normalizados — recalcula só quando `items` muda. A
 * filtragem em si reage também a `query`.
 */
export function useFuzzyFilter<T>(
  items: T[],
  query: string,
  getName: (item: T) => string,
): T[] {
  // Cache de normalização: array paralelo na mesma ordem de `items`.
  const normalized = useMemo(
    () => items.map((it) => normalize(getName(it))),
    // getName é estável na prática (definido inline em cada página, mas
    // nunca usado pra controlar dependências); só depende de items.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  );

  return useMemo(() => {
    const qNorm = normalize(query);
    if (!qNorm || qNorm.length < 2) return items;

    const scored: { item: T; score: number; len: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const score = scoreMatch(qNorm, normalized[i]);
      if (score > 0) {
        scored.push({ item: items[i], score, len: normalized[i].length });
      }
    }

    // Score decrescente; em empate, nome mais curto primeiro (geralmente
    // mais relevante).
    scored.sort((a, b) => b.score - a.score || a.len - b.len);
    return scored.map((x) => x.item);
  }, [items, normalized, query]);
}
