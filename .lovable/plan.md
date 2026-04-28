# Corrigir: detalhe do filme some ao fechar o player

## Causa raiz

A mudança anterior já mantém `openMovie` setado ao iniciar a reprodução. Mas o `MovieDetailsDialog` (Radix Dialog modal) ainda está fechando sozinho quando o player é fechado.

Por quê: o `PlayerOverlay` é portalizado para `document.body` como **irmão** do portal do Radix Dialog. Ao desmontar o overlay, o foco volta via `previousFocusRef.current?.focus?.()`, e o Radix Dialog do detalhe interpreta eventos de foco/escape vazados como "fechar" — disparando `onOpenChange(false)`, que executa `setOpenMovie(null)` na linha 328 de `src/pages/Movies.tsx`.

## Mudança

Arquivo único: **`src/pages/Movies.tsx`** (linhas 326-334).

Tornar o `onOpenChange` do `MovieDetailsDialog` resistente a fechamentos enquanto o player estiver aberto:

```tsx
<MovieDetailsDialog
  open={!!openMovie}
  onOpenChange={(o) => {
    // Ignora qualquer pedido de fechar enquanto o player estiver tocando.
    // Evita que eventos de foco/escape do PlayerOverlay (portal irmão)
    // façam o Radix Dialog fechar o detalhe por baixo.
    if (!o && playing) return;
    if (!o) setOpenMovie(null);
  }}
  movie={openMovie}
  ...
/>
```

## Resultado

- Abrir card → detalhe → "Assistir" → player cobre tudo.
- Fechar player → o `setPlaying(null)` é executado; o `MovieDetailsDialog` ignora qualquer `onOpenChange(false)` espúrio e permanece aberto.
- Usuário vê o detalhe do filme novamente; um segundo "X" / Esc fecha o detalhe e volta à grade.

Sem outras mudanças.
