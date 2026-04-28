# Refinar tela inicial (Destaques) no desktop

## Diagnóstico do que está incomodando
Olhando a captura enviada (1347×853, layout `md+`):
1. **Hero ocupa quase toda a dobra** (`h-[68vh]` no md, `min-h-[460px]`) — em telas widescreen baixas (≈800–900px de altura), só o herói aparece, gerando a sensação de "tela vazia".
2. **Texto descritivo genérico** ("Descubra milhares de filmes...") repete o que o pôster já comunica e empurra os botões pra baixo.
3. **Quick stats (Canais ao Vivo / Filmes / Séries)** ficam abaixo da dobra, com ícones de apenas 40×40px (`h-10 w-10`) e tipografia de stat menor — parecem secundários quando deveriam ser **atalhos primários**.
4. **Mobile e tablet estão bem dimensionados** — qualquer ajuste precisa ser escopado por breakpoint pra não quebrá-los.

## O que vou mudar (somente desktop ≥ md, mobile intocado)

### 1) Hero mais compacto e cheio
Arquivo: `src/pages/Highlights.tsx` — `<section>` do hero (linhas ~201–383)

- **Altura**: trocar `md:h-[68vh] md:min-h-[460px]` por `md:h-[58vh] lg:h-[60vh] md:min-h-[420px] md:max-h-[640px]`. Mantém `h-[55vh] min-h-[380px]` no mobile.
- **Remover o parágrafo genérico** "Descubra milhares de filmes..." apenas no desktop (mantém no mobile, onde ainda preenche bem). Implementação: envolver o `<p>` em `className="... md:hidden"`.
- **Padding inferior** do hero: reduzir `md:pb-12` → `md:pb-8` para aproximar os atalhos rápidos da dobra.

### 2) Atalhos rápidos com mais peso visual no desktop
Arquivo: `src/pages/Highlights.tsx` — `<section className="grid grid-cols-3 ...">` (linhas ~390–419)

Reescrever o card mantendo a mesma estrutura semântica, mas escalando ícone, número e adicionando uma label de ação no md+:

- Ícone container: `h-9 w-9 md:h-14 md:w-14 lg:h-16 lg:w-16` (era `md:h-10 md:w-10`) com `rounded-xl` e ícone interno `h-4 w-4 md:h-7 md:w-7 lg:h-8 lg:w-8`.
- Número: `text-2xl md:text-4xl lg:text-5xl` (era `md:text-3xl`).
- Label: `text-xs md:text-base` + uma micro-label "Explorar →" em `md:` que substitui a setinha do canto superior por um CTA mais explícito.
- Padding do card: `p-4 md:p-7 lg:p-8` (era `md:p-6`).
- Adicionar gap maior entre cards no desktop: `gap-3 md:gap-5`.

Isso deixa cada atalho ≈40% mais "presente" no desktop sem aumentar nada no mobile (mesmo `h-9 w-9`, `text-2xl`, `p-4`, `gap-3`).

### 3) Ajuste fino de respiro
- Reduzir o `space-y-12` do container principal para `space-y-10 md:space-y-8` — fecha o "buraco" entre hero e stats no desktop, mantém respiro confortável no mobile.

## Resumo visual antes/depois (desktop ~1347×853)

```text
ANTES                              DEPOIS
┌──────────────────────────┐      ┌──────────────────────────┐
│  Header                  │      │  Header                  │
├──────────────────────────┤      ├──────────────────────────┤
│                          │      │                          │
│      HERO 68vh           │      │      HERO 58vh           │
│   (texto longo + dots)   │      │   (sem parágrafo extra)  │
│                          │      │                          │
│                          │      ├──────────────────────────┤
└──────────────────────────┘      │ ⬛ 245     ⬛ 12k    ⬛ 8k │
   ↓ (scroll necessário)          │ Canais    Filmes   Séries│
   ⬜ 245  ⬜ 12k  ⬜ 8k            │ Explorar→ Explorar→ ...  │
                                  └──────────────────────────┘
```

## Arquivos afetados
- `src/pages/Highlights.tsx` (único arquivo) — alterações isoladas em três blocos: `<section>` do hero, parágrafo descritivo, `<section>` dos quick stats, e `space-y` do container.

## Garantias de não-regressão mobile/tablet
- Todos os tamanhos novos (`md:h-14`, `md:text-4xl`, `md:p-7`, `md:hidden`, etc.) usam o prefixo `md:` ou maior — nada abaixo de 768px é alterado.
- O hero rotativo, mini-pôsteres laterais, dots e CTAs continuam idênticos em comportamento.
- `ContinueWatchingRail`, `Filmes populares` e `Séries em alta` ficam intactos.
