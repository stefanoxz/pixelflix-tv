## Objetivo

Implementar o efeito **"Spotlight de capa"** nos modais de Filmes e Séries: quando o usuário abre um conteúdo, o fundo da página fica bem escurecido e a **capa do título aparece em destaque integrada ao backdrop**, como se fosse um "ato cinematográfico". Mantendo 100% a fidelidade do nosso design system (azul primário, gradientes, cards arredondados refinados).

Inspirado nas referências, mas refinado — não copiado.

---

## Como vai funcionar visualmente

### Modal de Filme (referência: imagem 18)

```text
┌─────────────────────────────────────────────────────────────┐
│  [PÁGINA ESCURECIDA AO FUNDO ~95% black]                    │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ ▓▓▓▓▓▓▓▓▓│ TÍTULO DO FILME (2025)              [X] │  │
│   │ ▓ CAPA  ▓│ ╭──────────────────────────╮              │  │
│   │ ▓ HERO  ▓│ │ 📅2025  🎬Terror  ⭐8.0 │              │  │
│   │ ▓ FULL  ▓│ ╰──────────────────────────╯              │  │
│   │ ▓ HEIGHT▓│ ╭──────────────────────────╮              │  │
│   │ ▓▓▓▓▓▓▓▓▓│ │ 🎥 Direção: ...          │              │  │
│   │  fade →  │ │ 👥 Elenco:  ...          │              │  │
│   │          │ ╰──────────────────────────╯              │  │
│   │          │ 🎬 Sinopse                                 │  │
│   │          │ Texto....                                  │  │
│   │          │ [▶ Assistir]  [♥ Favoritar]               │  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- **Overlay** mais escuro (`bg-black/90` + `backdrop-blur-sm`) em vez do `bg-black/80` atual
- **Capa em coluna esquerda full-height** dentro do modal — ocupa toda altura, com fade radial pra direita
- **Backdrop horizontal removido** (substituído pela capa lateral)
- Conteúdo (título, chips, sinopse, botões) na coluna direita, mantendo todo o refino visual já feito
- Em mobile (sem espaço lateral): volta o layout atual (backdrop em cima + capa pequena), garantindo legibilidade

### Modal de Série (referência: imagem 19)

Mesma estrutura, mas com a seção de **episódios abaixo** da área principal — exatamente como já está hoje, só que agora também com a capa lateral em destaque na parte superior.

---

## Mudanças visuais

### 1. Overlay escurecido + blur sutil

Atualizar `DialogOverlay` apenas no `MovieDetailsDialog` e `SeriesDetailsDialog` via override de classe:
- Adicionar `bg-black/90 backdrop-blur-sm` (override) no overlay específico desses modais

Como o `Dialog` do shadcn não expõe diretamente o overlay via `DialogContent`, vamos usar estes modais com `DialogPortal` + `DialogOverlay` customizados (já temos exportados no `dialog.tsx`). **Sem editar o `dialog.tsx` global** — apenas compor manualmente.

### 2. Capa lateral (desktop ≥ md)

Substituir o backdrop horizontal por uma **coluna esquerda full-height** com a capa do filme:

```tsx
<div className="hidden md:block relative w-[42%] max-w-[420px] shrink-0">
  <img src={proxyImageUrl(cover, { w: 600, h: 900, q: 85 })} 
       className="absolute inset-0 h-full w-full object-cover" />
  {/* Fade gradient pra direita pra integrar com o conteúdo */}
  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-card/40 to-card" />
</div>
```

- Capa ocupa altura total do modal
- `bg-gradient-to-r from-transparent ... to-card` faz a fusão suave com a área de conteúdo
- Sem moldura — a capa "sangra" pra dentro do modal

### 3. Layout do modal — flex horizontal

Refazer o layout principal de:
```tsx
// hoje: grid vertical com backdrop em cima
<div className="grid grid-cols-1 md:grid-cols-[180px,1fr]">
```

Para:
```tsx
// novo: flex horizontal com capa sangrando à esquerda
<div className="flex flex-col md:flex-row min-h-[560px]">
  <CapaSpotlight />        {/* desktop only */}
  <ConteúdoDireita />      {/* sempre */}
</div>
```

### 4. Mobile: fallback elegante

Em telas `< md`:
- Mantém o backdrop horizontal no topo (como hoje)
- Capa pequena flutuando + conteúdo abaixo
- Garante boa leitura sem espremer nada

### 5. Tamanho do modal

Aumentar largura máxima para `max-w-5xl` (de `max-w-4xl`), sem altura fixa — `max-h-[92vh]` continua. A capa ocupar a esquerda exige um pouco mais de respiro horizontal.

### 6. Refino do conteúdo direito

Tudo que já refinamos antes (chips, cards de credits/sinopse, botão pill) **fica intacto** — só ganha mais respiro porque a coluna direita tem `padding` próprio (`px-6 md:px-8 py-8`).

### 7. Séries — capa lateral termina antes dos episódios

Para o `SeriesDetailsDialog`, a coluna lateral da capa cobre apenas o **bloco superior** (título + meta + sinopse + botão). A seção de "Episódios" continua **full-width abaixo** com cabeçalho `ListVideo` icon — exatamente como referência da imagem 19.

```tsx
<div className="flex flex-col md:flex-row">
  <CapaSpotlight />
  <BlocoSuperior />
</div>
<div className="px-4 md:px-8 pb-6">
  <h3>Episódios</h3>
  <SeriesEpisodesPanel ... />
</div>
```

---

## O que NÃO muda

- Lógica de queries, fallback TMDB, favoritos, marcação incompatível, `onPlay`, `onPlayEpisode`, `onCopyExternal`
- `SeriesEpisodesPanel.tsx` (intacto)
- `dialog.tsx` global do shadcn (não tocaremos)
- Cores do design system (azul primário, gradientes, sombras)
- Outros modais e componentes

---

## Arquivos editados

1. `src/components/MovieDetailsDialog.tsx` — novo layout flex com capa lateral, overlay customizado
2. `src/components/SeriesDetailsDialog.tsx` — mesma estrutura + bloco de episódios full-width abaixo

Nenhum arquivo novo. Nenhuma dependência nova.

---

## Detalhes técnicos

- Imports adicionais nos dois modais: `DialogPortal`, `DialogOverlay` do `@/components/ui/dialog`
- Compor manualmente o `<DialogPortal><DialogOverlay className="bg-black/90 backdrop-blur-sm" /><DialogPrimitive.Content>...` — isso permite escurecer só esses modais
- Usar `proxyImageUrl(cover, { w: 600, h: 900, q: 85 })` pra capa lateral em alta qualidade
- Fade radial via gradiente Tailwind (`bg-gradient-to-r from-transparent via-card/40 to-card`)
- Aspect ratio da capa preservado com `object-cover` + altura `h-full`
- Acessibilidade: `DialogTitle`/`Description` `sr-only` mantidos
