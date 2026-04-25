## Objetivo

Refinar visualmente os modais de **Detalhes do Filme** (`MovieDetailsDialog.tsx`) e **Detalhes da Série** (`SeriesDetailsDialog.tsx`) inspirado nas referências enviadas, mantendo **100% do design system atual** do webplayer (cores HSL existentes, gradiente primário azul→roxo, dark theme, raios e sombras já definidos).

Sem alterar nenhuma lógica funcional (queries, fallback TMDB, favoritos, player, episódios). Apenas a camada visual.

---

## Mudanças visuais

### 1. Barra de metadados em "chips" (linha única arredondada)

Substituir a linha solta de `rating · ano · duração · gênero` por uma barra única estilo pill com divisões internas e ícones grandes:

```text
┌────────────────────────────────────────────────────────┐
│  📅 2025   🎬 Terror, Thriller   🕐 1h 50m   ⭐ 8.0    │
└────────────────────────────────────────────────────────┘
```

- Container: `bg-secondary/60 border border-border/60 rounded-2xl px-5 py-3`
- Cada item: `flex items-center gap-2 text-sm font-medium`
- Ícones `lucide-react` em **18px** (`h-[18px] w-[18px]`) com cor `text-primary` (azul do tema)
- Separadores verticais sutis `divide-x divide-border/40` entre os blocos
- Filmes: `Calendar` (ano), `Film` (gênero), `Clock` (duração), `Star` (rating amarelo)
- Séries: `Calendar` (data), `Tv` (temporadas), `Layers` (episódios), `Film` (gênero), `Star` (rating)

### 2. Bloco de Direção / Elenco em card destacado

Substituir o texto inline por um card com ícones grandes na lateral esquerda:

```text
┌─────────────────────────────────────────────────────────┐
│  🎥  Direção:   Jason Blum, C. Robert Cargill...        │
│  👥  Elenco:    Ethan Hawke, Mason Thames, Madeleine... │
└─────────────────────────────────────────────────────────┘
```

- Container: `bg-secondary/40 border border-border/50 rounded-2xl p-4 space-y-3`
- Layout grid `[auto,1fr] gap-3 items-start`
- Ícones `Video` e `Users` em **20px**, cor `text-muted-foreground`
- Labels em `font-semibold text-foreground/90`
- Conteúdo em `text-foreground/75 leading-relaxed`

### 3. Sinopse com título iconado

Adicionar cabeçalho "Sinopse" com ícone de claquete (`Clapperboard` ou `Film`):

```text
🎬 Sinopse
Quatro anos após escapar de The Grabber...
```

- `flex items-center gap-2` + `Clapperboard` 20px em `text-primary`
- Título: `text-base font-bold`
- Texto da sinopse com `text-base leading-relaxed text-foreground/85` (sem `line-clamp` no modal — já que tem espaço)

### 4. Botão "Assistir" maior e com ícone destacado

Trocar o botão atual por uma versão mais polida:
- `size="lg"` com `h-12 px-8 text-base font-semibold`
- Ícone `Play` em **20px** com `fill-current`
- Mantém `bg-gradient-primary shadow-glow` (já no design system)
- Adicionar `rounded-full` pra match com a referência

### 5. Botão fechar maior e mais visível

- O `X` do `DialogContent` continua existindo (vem do shadcn), mas vamos garantir tamanho maior via override local: `[&>button]:h-10 [&>button]:w-10 [&>button]:rounded-full [&>button]:bg-black/60 [&>button]:backdrop-blur`
- Ícone interno do `X` herdado fica em ~20px

### 6. Tipografia do título

- Aumentar para `text-3xl md:text-4xl font-extrabold uppercase tracking-tight`
- Cor sólida `text-foreground` (sem gradiente — mantém legibilidade)
- Mantém quebra natural

### 7. Séries — seção "Temporadas / Episódios"

Refinar somente o cabeçalho da seção de episódios:
- Título "Episódios" vira `flex items-center gap-2` com ícone `ListVideo` em 22px (cor `text-primary`)
- Mantém o `SeriesEpisodesPanel` existente intacto (não tocar em sua lógica de tabs/temporadas)

---

## O que NÃO muda

- Lógica de `useQuery`, fallback TMDB, favoritos, marcação incompatível, `onPlay`, `onPlayEpisode`, `onCopyExternal`
- `SeriesEpisodesPanel.tsx` (apenas o título acima dele)
- `PreviewPanel.tsx`, `MediaCard.tsx`, `PosterGrid.tsx` e qualquer outro componente
- Cores do tema (`--primary` azul continua), gradientes (`bg-gradient-primary`), sombras, raios
- Estrutura de rotas, contexto, autenticação
- Aviso de "conteúdo incompatível" (mesmo visual atual, apenas reposicionado dentro do novo layout)

---

## Arquivos editados

1. `src/components/MovieDetailsDialog.tsx` — refinar layout (chips, card credits, botões, título)
2. `src/components/SeriesDetailsDialog.tsx` — mesmo refino + chip extra de temporadas/episódios e cabeçalho "Episódios" com ícone

Nenhum arquivo novo. Nenhuma dependência nova (todos os ícones já existem em `lucide-react`).

---

## Detalhes técnicos

- Ícones novos importados de `lucide-react`: `Calendar`, `Film`, `Clock`, `Tv`, `Layers`, `Video`, `Users`, `Clapperboard`, `ListVideo`
- Tudo via classes Tailwind usando tokens semânticos (`bg-secondary`, `border-border`, `text-primary`, `text-foreground`) — zero cores hardcoded
- Responsivo mantido: chips quebram em múltiplas linhas no mobile (`flex flex-wrap gap-3`)
- Acessibilidade preservada: `DialogTitle` e `DialogDescription` `sr-only` continuam
