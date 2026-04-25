## Objetivo

Replicar o layout do print (estilo IBO Pro) em Filmes/Séries — rail vertical de categorias + **grid de pôsteres** (não mais lista compacta + preview lateral) — com topbar (voltar, título, relógio/data). Adicionar controles **±10s** e **velocidade de reprodução** no Player, otimizados para **mobile/web**. Adicionar **botão "Reportar problema"** no Player que envia o relato para o painel admin.

---

## 1) Filmes / Séries — layout estilo IBO

### Topbar (novo componente `LibraryTopBar`)
- Esquerda: botão **voltar** (ícone seta) + ícone do app + título da seção (Filmes / Séries).
- Direita: relógio em tempo real (HH:MM) + data abreviada (Sáb., 25/04).
- Mobile: relógio compacto; voltar leva ao Início (`/`).

### Layout principal (substitui o atual 3-col com PreviewPanel)
```text
┌────────────────────────────────────────────────────────────┐
│  ←  [Filmes]                            03:04  Sáb., 25/04 │
├──────────────┬─────────────────────────────────────────────┤
│ ▶ EM ALTA    │ [poster][poster][poster][poster][poster][p] │
│ □ Lançament. │ [poster][poster][poster][poster][poster][p] │
│ □ Netflix  ›│ [poster][poster][poster][poster][poster][p] │
│ □ HBO Max  ›│                                              │
│ □ Prime    ›│                                              │
└──────────────┴─────────────────────────────────────────────┘
```
- **Rail esquerda**: continua usando `CategoryRail` (já existente). Itens com ícone de pasta + chevron à direita; o ativo recebe ícone de "play" / destaque azul. Mostrar contagem só em Favoritos. Largura: 240px desktop; **drawer (Sheet) no mobile**, aberto por botão de filtro na topbar.
- **Conteúdo central**: novo componente `PosterGrid` que troca o `TitleList`+`PreviewPanel` por uma grade responsiva de pôsteres com hover/foco overlay (título + ano embaixo), igual ao print:
  - Mobile: `grid-cols-3` (gap 2)
  - sm: `grid-cols-4`, md: `grid-cols-5`, lg: `grid-cols-6`, xl: `grid-cols-7`
  - Cada card: `aspect-[2/3]`, capa (proxied), gradiente bottom com nome + ano, badge de favorito no canto, foco visível para teclado/TV.
  - Virtualização: usar `useWindowVirtualizer` do `@tanstack/react-virtual` por linhas para listas grandes (>200).
- **Detalhes**: ao clicar em um pôster, abre o `MovieDetailsDialog` existente (já mostra sinopse, elenco, botão "Assistir"). Mantém comportamento de duplo-clique = play direto.
- Busca: input continua no topo do grid, com placeholder "Buscar filme...".

### Componentes a criar
- `src/components/library/LibraryTopBar.tsx`
- `src/components/library/PosterGrid.tsx`
- `src/components/library/PosterCard.tsx`
- `src/components/library/MobileCategoryDrawer.tsx`

### Componentes alterados / removidos do uso em Filmes/Séries
- `LibraryShell` continua existindo, mas Movies/Series passam a usar layout próprio mais simples (rail + grid). `PreviewPanel` e `TitleList` deixam de ser usados nessas duas páginas (mantidos no repo por compat, mas sem importar).
- `Movies.tsx` e `Series.tsx` reescritos para o novo layout (rail + PosterGrid + dialog).
- Para Séries, ao abrir o pôster, exibe um `SeriesDetailsDialog` novo (espelho do `MovieDetailsDialog`, com seleção de temporada/episódio reaproveitando a lógica do `SeriesEpisodesPanel`).

### Navegação por teclado/TV
Continuar usando `useGridKeyboardNav` adaptado para grid 2D:
- ↑/↓ → linha acima/abaixo (n colunas)
- ←/→ → coluna anterior/próxima
- Enter → abre dialog
- `/` → foca busca
- `f` → favorita o card focado

---

## 2) Player — controles ±10s, velocidade e reportar problema

Adicionar **overlay customizado** sobre o `<video>` (mantém `controls` nativo como fallback em fullscreen). Barra inferior translúcida visível em hover/touch:

```text
[⏮ -10s] [▶/⏸] [+10s ⏭]   ───────●───────   1x ▾   🚩 Reportar
```

### Implementação no `Player.tsx`
- Novo estado `playbackRate` (1, persistido em `localStorage` `player.rate`). Aplica via `videoRef.current.playbackRate`. DropdownMenu shadcn com 0.5x, 0.75x, **1x**, 1.25x, 1.5x, 1.75x, 2x.
- Botões `seek(-10)` / `seek(+10)` que ajustam `currentTime`. Desabilitados quando `isLive` (canais ao vivo).
- Atalhos de teclado: `←`/`→` ±10s, `Espaço` play/pause, `>`/`<` velocidade.
- Botão **🚩 Reportar problema** abre `ReportProblemDialog` (novo).
- Mobile: barra com botões maiores (touch ≥44px), gap maior; toggle de visibilidade ao tocar no vídeo (hide após 3s).
- Manter o painel `Logs` e o card de diagnóstico atuais.

### `ReportProblemDialog` (novo componente)
- Campos: título do conteúdo (auto-preenchido), categoria (Select: "Não carrega", "Trava/buffering", "Áudio fora de sincronia", "Sem áudio", "Sem legenda", "Outro"), descrição (Textarea opcional).
- Snapshot técnico anexado automaticamente: `url` (raw), `engine`, `rootCause`, `lastReason`, `loadMethod`, `containerExt`, `userAgent`, último heartbeat, host upstream.
- Envia via `reportStreamEvent` (já existe em `services/iptv.ts`) com `event_type = "user_report"` e `meta = { category, description, snapshot }`. Não exige nova tabela — reaproveita `stream_events` existente.

---

## 3) Painel Admin — aba "Reportes de usuários"

- Nova aba no `Admin.tsx`: **"Reportes"**.
- Lista paginada dos últimos `stream_events` com `event_type = 'user_report'` (consulta via edge `admin-api` — adicionar handler `list_user_reports`).
- Colunas: data, usuário, host upstream, categoria, descrição, ações (ver detalhes em Dialog com snapshot técnico completo + link para abrir o `ServerProbeDialog` daquele host).
- Filtros: período (24h / 7d / 30d), categoria, busca por usuário/host.
- Badge de "novos" no menu lateral: contagem de reports nas últimas 24h.

### Backend (edge `admin-api`)
- Adicionar ação `list_user_reports` (SELECT em `stream_events` filtrando `event_type = 'user_report'`, ordenado por `created_at DESC`, com paginação).
- Adicionar ação `count_user_reports_24h` para o badge.
- Sem migração de schema (usa `stream_events.meta` JSONB existente).

---

## Arquivos

**Criar**
- `src/components/library/LibraryTopBar.tsx`
- `src/components/library/PosterGrid.tsx`
- `src/components/library/PosterCard.tsx`
- `src/components/library/MobileCategoryDrawer.tsx`
- `src/components/SeriesDetailsDialog.tsx`
- `src/components/ReportProblemDialog.tsx`
- `src/components/admin/UserReportsPanel.tsx`
- `src/hooks/useClock.ts` (HH:MM + data ptBR, atualiza a cada 30s)

**Editar**
- `src/pages/Movies.tsx` — novo layout (rail + topbar + PosterGrid + MovieDetailsDialog)
- `src/pages/Series.tsx` — idem com SeriesDetailsDialog
- `src/components/Player.tsx` — overlay com ±10s, velocidade, atalhos, botão reportar
- `src/pages/Admin.tsx` — nova aba "Reportes" + badge
- `supabase/functions/admin-api/index.ts` — handlers `list_user_reports` / `count_user_reports_24h`

**Mantidos sem alteração** (não mais usados em Filmes/Séries, mas seguem disponíveis)
- `src/components/library/PreviewPanel.tsx`
- `src/components/library/TitleList.tsx`, `TitleListItem.tsx`
- `src/components/library/SeriesEpisodesPanel.tsx` (será reusado dentro de `SeriesDetailsDialog`)

---

## Notas de UX mobile-web (prioridade)
- Topbar fixa (sticky top-0, z-30), backdrop blur.
- Rail vira drawer lateral via `Sheet` no mobile, acessível por botão "filtro" na topbar.
- Pôsteres com `aspect-[2/3]` e `loading="lazy"` para economizar dados.
- Player: barra de controles sempre tocável (touch targets ≥44px), gestos: tap-duplo nas laterais = ±10s (estilo YouTube/Netflix).
- Diálogo de reportar problema com botões grandes e categorias rapidamente selecionáveis.

Aguardando sua aprovação para implementar.