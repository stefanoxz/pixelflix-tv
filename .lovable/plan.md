# Reabrir detalhes do filme ao fechar o player

## Problema

Hoje, em `src/pages/Movies.tsx`, ao iniciar a reprodução o código fecha o diálogo de detalhes (`setOpenMovie(null)`) antes de abrir o player. Quando o usuário fecha o player (no fim do filme ou manualmente), o estado `openMovie` já é `null` e o usuário cai direto na grade — perdendo o contexto do título que estava assistindo.

Em `src/pages/Series.tsx` o comportamento já é o correto: o `SeriesDetailsDialog` permanece montado por trás do player, então ao fechar o player o usuário volta para a tela do título. Vamos alinhar Filmes a esse padrão.

## Mudanças

Arquivo único: **`src/pages/Movies.tsx`**

1. **Não fechar o diálogo ao iniciar a reprodução**
   - Em `playMovie` (hoje na linha 190), remover o `setOpenMovie(null)`.
   - O `MovieDetailsDialog` continua montado por trás do `PlayerOverlay` (que é uma camada superior), então visualmente o player cobre tudo enquanto o filme toca.

2. **Mesmo tratamento no fluxo "Continue assistindo" (deep-link com `autoplay`)**
   - O `useEffect` de deep-link (linha ~88) hoje pula o detalhe e chama `playMovieRef.current?.(m)` direto. Para garantir que ao fechar o player o usuário também volte ao detalhe, adicionar `setOpenMovie(m)` antes de chamar o play. Assim, vindo do rail "Continue assistindo", ao fechar o player o detalhe do filme aparece (mesmo comportamento do clique normal no card).

3. **Não alterar nada mais**
   - `setPlaying(null)` no `onClose` do `PlayerOverlay` e do `Player` continuam iguais.
   - O atalho de teclado `Escape` (linha 246-247) já fecha primeiro o player e, num segundo Esc, o detalhe — comportamento desejado preservado.
   - O `ResumeDialog` continua independente.

## Resultado esperado

- Clico no card → abre detalhes → "Assistir" → player cobre a tela.
- Filme termina ou clico em fechar → volto ao **diálogo de detalhes do filme**, não à grade.
- Um segundo fechamento (X do dialog ou Esc) me leva à grade.
- Vindo de "Continue assistindo": ao fechar o player, mesmo comportamento — diálogo do filme aparece.

## Detalhes técnicos

```tsx
// playMovie — antes
setOpenMovie(null);
const saved = getProgress(...);
...

// playMovie — depois
// (remover setOpenMovie(null); o dialog fica aberto por baixo do player)
const saved = getProgress(...);
...
```

```tsx
// deep-link autoplay — antes
if (state?.autoplay) {
  playMovieRef.current?.(m);
} else {
  setOpenMovie(m);
}

// depois
setOpenMovie(m); // sempre abre o detalhe (fica por baixo se autoplay)
if (state?.autoplay) {
  playMovieRef.current?.(m);
}
```

Sem mudanças em outros arquivos, sem migração, sem impacto em Series/Live.
