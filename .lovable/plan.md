## O que muda

A busca atual usa **substring exata** (`name.toLowerCase().includes(q)`), então errar uma letra ("Vingdores" em vez de "Vingadores") retorna zero resultados. Vou trocar por uma **busca tolerante** que entende erros de digitação, acentos faltando e palavras fora de ordem, sem prejudicar performance.

### Estratégia (sem dependência externa)

Implementar um pequeno utilitário de matching em camadas, do mais barato ao mais caro — qualquer item que case em uma camada anterior pula as próximas:

1. **Normalização**: `.toLowerCase()` + `String.prototype.normalize("NFD")` removendo diacríticos (acentos). Resolve "joao" achar "João", "matrix" achar "Matrix".
2. **Substring** (atual): match direto após normalização — barato e fica como caminho rápido.
3. **Tokens AND**: divide query em palavras e exige que **todas** apareçam como substring (em qualquer ordem). Resolve "harry pedra" → "Harry Potter e a Pedra Filosofal".
4. **Fuzzy por similaridade** (só quando query tem ≥3 chars e nada acima casou): distância de Levenshtein limitada, com early-exit para janelas do tamanho da query dentro do nome. Tolera 1 erro até 5 chars, 2 erros até 9 chars, 3 erros acima. Implementação compacta (~40 linhas), sem libs.

Resultado: cada item recebe um **score** (0 = miss, 1 = substring, 2 = tokens, 3 = fuzzy). Itens com score > 0 entram no resultado, ordenados por score crescente (matches exatos primeiro), depois pelo tamanho do nome (mais curto primeiro — costuma ser mais relevante).

### Performance

- A normalização de cada item é feita **uma vez** por catálogo via `useMemo` (cache `id → nameNorm`), recalculado só quando a lista muda.
- Camadas 1-3 são O(n × m) trivial; ainda mantêm `useDebouncedValue(search, 250)` que já existe.
- A camada 4 (fuzzy) só roda no subset que falhou nas anteriores e com early-exit por distância máxima — em catálogos de até ~50k itens ainda fica abaixo de 50ms.
- Se a query é vazia ou muito curta (<2 chars), pula tudo e mantém o filtro só por categoria.

## Arquivos

**Novo**
- `src/lib/fuzzySearch.ts` — exporta:
  - `normalize(str)` — lowercase + remove diacríticos.
  - `scoreMatch(query, target)` — retorna `0..3`.
  - `useFuzzyFilter<T>(items, query, getKey)` — hook que memoiza nomes normalizados e devolve a lista filtrada/ordenada por relevância.

**Modificados** (trocar o filtro por `useFuzzyFilter`)
- `src/pages/Live.tsx`
- `src/pages/Movies.tsx`
- `src/pages/Series.tsx`

A lógica de categoria/favoritos continua separada, aplicada **antes** do fuzzy filter (reduz o conjunto de busca e mantém o comportamento atual de "buscar dentro da categoria selecionada").

## Resultado esperado

- "joao" acha "João Bezerra".
- "vingdores" acha "Vingadores".
- "harry pedra" acha "Harry Potter e a Pedra Filosofal".
- "the rings power" acha "The Lord of the Rings: The Rings of Power".
- Resultados exatos continuam aparecendo primeiro (não vai "esconder" o que você já encontrava).
- Sem mudança de UI, sem nova dependência, debounce de 250ms preservado.

## Observação

Se depois quiser destacar (`<mark>`) os trechos que casaram nos resultados, é uma extensão natural — me avise que adiciono em uma próxima iteração.
