## Diagnóstico

Três problemas independentes no fluxo de **abrir série → tocar episódio → fechar player**:

1. **Letras pequenas no diálogo da série** (`SeriesDetailsDialog.tsx`):
   - Título: `text-xl md:text-2xl`
   - Sinopse: `text-sm`
   - Elenco/Direção: `text-xs`
   - Cabeçalho "Episódios": `text-sm`
   - Mensagens auxiliares ("Carregando", "Sem sinopse"): `text-xs/text-sm`

2. **Botão de fechar (X) muito pequeno** no `Dialog` shadcn (`src/components/ui/dialog.tsx` linha 45-48):
   - Ícone `h-4 w-4` (~16px) sem padding nem fundo, hit-area minúscula.

3. **Ao fechar o player, a série some**: em `src/pages/Series.tsx` linhas 262-265, quando o usuário toca um episódio, o código faz `setPlayingEp(...)` **e** `setOpenSeries(null)` simultaneamente. Resultado: ao sair do player, o diálogo da série não está mais aberto e o usuário cai direto na grade de pôsteres, perdendo o contexto de qual episódio queria assistir em seguida.

## O que fazer

### 1. Aumentar a tipografia do `SeriesDetailsDialog`

Editar `src/components/SeriesDetailsDialog.tsx`:

- Título: `text-2xl md:text-3xl`
- Metadados (rating/ano/gênero) e estrela: `text-base` + `Star h-5 w-5`
- Sinopse: `text-base leading-relaxed`
- Elenco/Direção: `text-sm` (era `text-xs`)
- Cabeçalho "Episódios": `text-lg font-semibold`
- Mensagens "Carregando…" / "Sem episódios": `text-sm`
- Botão Favoritar: `size="default"` (era `sm`)
- Espaçamento da coluna de texto: `space-y-3 md:space-y-4`

### 2. Botão de fechar do `Dialog` maior e com hit-area decente

Editar `src/components/ui/dialog.tsx` (afeta todos os diálogos do app — Movie, Series, etc.):

```tsx
<DialogPrimitive.Close
  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center
             rounded-md bg-background/60 backdrop-blur-sm text-foreground/80
             ring-offset-background transition-all
             hover:bg-background hover:text-foreground hover:scale-105
             focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
>
  <X className="h-5 w-5" />
  <span className="sr-only">Fechar</span>
</DialogPrimitive.Close>
```

Botão de 36×36px com fundo translúcido (visível mesmo sobre o backdrop hero da série) e ícone 20px.

### 3. Restaurar o diálogo da série ao fechar o player

Editar `src/pages/Series.tsx` (linhas 257-269):

- **Não** zerar `openSeries` ao tocar episódio.
- Tornar o diálogo invisível enquanto o player está aberto (para não competir com o overlay), reabrindo automaticamente quando o player fecha.

```tsx
<SeriesDetailsDialog
  open={!!openSeries && !playingEp}   // ← esconde quando o player toca
  onOpenChange={(o) => !o && setOpenSeries(null)}
  series={openSeries}
  ...
  onPlayEpisode={(ep) => {
    // Mantém openSeries para o player voltar pra cá no fechamento.
    setPlayingEp({ ep, coverFallback: openSeries?.cover });
  }}
  ...
/>
```

Fluxo resultante:
1. Usuário abre série → diálogo aparece.
2. Clica em episódio → `playingEp` é setado, `openSeries` continua → condição `!playingEp` esconde o diálogo, o `PlayerOverlay` cobre tudo.
3. Fecha o player (`X`, ESC ou clique fora) → `playingEp = null` → condição `!playingEp` reabre o diálogo da série exatamente onde estava, na mesma temporada/lista de episódios.

## Arquivos a editar

- `src/components/ui/dialog.tsx` — botão de fechar maior (afeta o app inteiro positivamente).
- `src/components/SeriesDetailsDialog.tsx` — escala de tipografia.
- `src/pages/Series.tsx` — manter `openSeries` ativo enquanto o player toca.

## Notas

- O `MovieDetailsDialog` já tem tipografia maior (`text-2xl md:text-3xl` no título, `text-sm` na sinopse) e não precisa de mudança nesta rodada — mas o filme **fecha** ao tocar (comportamento esperado, sem lista de episódios para retornar).
- O fix do botão X melhora também todos os outros diálogos do app (Movie, Admin, etc.) sem regressões.