# Episódios em grade lado a lado, responsiva

## Objetivo

Trocar a lista vertical de episódios (1 por linha, com still horizontal de 36×20) por uma **grade de cards** que se adapta:

- Mobile (<640px): **2 colunas**
- Tablet (≥640px): **2-3 colunas**
- Desktop (≥1024px): **3-4 colunas**

Cada card mantém: still 16:9 no topo, número + título embaixo, sinopse em 2 linhas, badge de formato, botão Play (ou ExternalLink quando externo).

## Mudança

Arquivo único: **`src/components/library/SeriesEpisodesPanel.tsx`** — substituir o `space-y-2.5` (lista vertical) por uma `grid` responsiva e remontar cada item como **card vertical**.

### Novo layout do card

```text
┌────────────────────┐
│                    │  still 16:9 (cobre largura)
│      [▶ play]      │  badge MP4 sobreposto canto sup. dir.
│                    │
├────────────────────┤
│ 1. Título do ep    │  título: 1 linha, truncate
│ Sinopse curta em   │  plot: 2 linhas, line-clamp-2
│ duas linhas no     │
│ máximo aqui...     │
└────────────────────┘
```

- Card inteiro é o botão Play (ou abre o link externo).
- Hover: leve `scale-[1.02]` + borda `primary/40` (transição suave).
- Episódios externos: ícone ExternalLink no canto sup. esquerdo do still em vez do botão flutuante separado.

### Container

```tsx
<div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-h-[55vh] overflow-y-auto pr-1">
  {current.map((ep) => ( ... ))}
</div>
```

### Card

```tsx
<button
  type="button"
  onClick={() => (external ? onCopyExternal(ep) : onPlay(ep))}
  className="group flex flex-col text-left rounded-lg overflow-hidden bg-card border border-border/40 hover:border-primary/40 hover:bg-secondary/40 transition-smooth"
>
  <div className="relative aspect-video w-full bg-secondary overflow-hidden">
    {displayStill ? (
      <SafeImage ... className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
    ) : (
      <div className="h-full w-full flex items-center justify-center">
        <Play className="h-8 w-8 text-muted-foreground" />
      </div>
    )}
    {/* badge formato */}
    <span className={cn("absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded border", toneClasses[badge.tone])}>
      {badge.label}
    </span>
    {/* play / external indicator no canto inferior direito */}
    <div className="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
      {external ? <ExternalLink className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
    </div>
  </div>
  <div className="p-3 space-y-1 min-w-0">
    <p className="text-sm font-semibold text-foreground truncate">
      {ep.episode_num}. {displayTitle}
    </p>
    {displayPlot && (
      <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
        {displayPlot}
      </p>
    )}
  </div>
</button>
```

O `Tooltip` separado para externos some — o botão do card já trata o clique. (Mantém o `TooltipProvider` removido só desse componente, sem outros impactos.)

## Resultado

- No celular o usuário enxerga 2 episódios por linha (em vez de 1), reduzindo scroll.
- Em desktop a grade aproveita melhor o espaço horizontal disponível no diálogo.
- Sem mudança em SeriesDetailsDialog, hooks, dados ou playback.
