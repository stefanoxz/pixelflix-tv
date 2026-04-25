# Redesign da página /live com EPG e navegação responsiva

## Diagnóstico do layout atual

A `/live` hoje empilha tudo verticalmente: título → busca → categorias em pílulas horizontais → player + sidebar de canais simples (só nome + número). **Não há EPG**. No mobile a sidebar de canais cai abaixo do player, então o usuário rola muito antes de trocar de canal. Em desktop, ~30% do viewport vertical é gasto em chrome (header, busca, categorias) antes do vídeo aparecer.

## Layout novo

### Desktop (≥1024px) — três colunas
```text
┌──────────┬──────────────────────────┬──────────────┐
│Categorias│   Player + EPG do canal  │   Lista de   │
│ (rail    │                          │   canais     │
│  vertical│   ┌────────────────────┐ │  com EPG     │
│  com     │   │                    │ │  agora/       │
│  contagem│   │      Player        │ │  próximo +   │
│  por cat)│   │                    │ │  progresso   │
│          │   └────────────────────┘ │              │
│ ★ Favs   │   "Agora: Jornal Nac."  │  [busca]     │
│ # Todos  │   "Próx: Globo Repórter" │  ◉ Globo     │
│ ▸ Abertos│   ▓▓▓▓▓░░░░ 60%         │     Jornal..│
│ ▸ Filmes │                          │  ○ SBT       │
│ ▸ Esporte│   ─────EPG timeline──── │     Novela.. │
│ ▸ Notícia│   06h ┃ 07h ┃ 08h ┃     │  ○ Record    │
└──────────┴──────────────────────────┴──────────────┘
```

- **Coluna esquerda (rail de categorias)**: lista vertical scrollável, com ★ Favoritos no topo, contador de canais por categoria, ícone por tipo. Recolhível para versão "icon-only" via toggle.
- **Coluna central (player + EPG)**: player no topo, abaixo dele o **EPG do canal ativo** mostrando programa atual com barra de progresso (calculada de `start`/`stop` do `get_short_epg`) e os próximos 4-5 programas em linha do tempo horizontal.
- **Coluna direita (lista de canais)**: cada item agora mostra logo + nome + **"Agora: <programa>"** + barra de progresso fininha + duração restante. Busca persistente no topo.

### Tablet (768-1023px) — duas colunas
- Categorias viram dropdown no topo (mantém o componente `CategoryFilter` atual mas como `Select`).
- Player + lista lado a lado.

### Mobile (<768px) — player full + drawer
- Player ocupa 100% da largura no topo, com info compacta: "Agora: <programa> · 80% concluído".
- Botão flutuante "Canais" abre **Sheet/Drawer lateral** (shadcn `Sheet`) com busca + categorias accordion + lista. Fecha após selecionar.
- Botão de **favoritar** (★) na barra de info do player — toggle persistido em `localStorage`.
- Tabs no drawer: "Todos", "Favoritos", "Categorias".

## Funcionalidades EPG

### Backend (sem mudanças)
A edge function `iptv-categories` já aceita qualquer `action`. Adicionamos no client:

```ts
// src/services/iptv.ts
export interface EpgEntry {
  id: string;
  title: string;        // base64 — decodificamos no client
  description: string;  // base64 — decodificamos no client
  start: string;        // "2025-04-25 12:00:00"
  end: string;
  start_timestamp: string;
  stop_timestamp: string;
}

export const getShortEpg = (c: IptvCredentials, streamId: number, limit = 6) =>
  iptvFetch<{ epg_listings: EpgEntry[] }>(c, "get_short_epg", { stream_id: streamId, limit });
```

Cache react-query agressivo:
- `staleTime: 5 min` por canal
- Pré-fetch do canal ativo no `useEffect` quando `activeChannel` muda
- Pré-fetch dos primeiros 10 canais visíveis na sidebar (debounced 500ms ao terminar de scrollar)
- `gcTime: 30 min` para reaproveitar quando o usuário volta a um canal

### Componentes novos

1. **`EpgNowNext`** — usado na lista de canais e no header do player. Mostra programa atual + barra de progresso baseada em `Date.now()` vs `start_timestamp`/`stop_timestamp`. Atualiza a cada 30s via `useEffect` + `setInterval`. Fallback gracioso se o canal não tiver `epg_channel_id` ou se vier vazio.

2. **`EpgTimeline`** — lista horizontal scrollável dos próximos 4-5 programas do canal ativo, cada bloco com largura proporcional à duração. Inclui horário de início, título, e badge "AO VIVO" no programa atual.

3. **`ChannelCategoryRail`** — substitui `CategoryFilter` em desktop. Lista vertical com:
   - ★ Favoritos (separador)
   - # Todos os canais (contador)
   - Categorias retornadas pela API (contador por categoria, calculado em memória)
   - Suporte a colapsar/expandir grupos
   - Variant `icon-only` (w-14) quando sidebar do shadcn está colapsada

4. **`ChannelListItem`** — item rico da lista direita: logo, nome, "Agora: X" + progresso. Memoizado (`React.memo`) por `stream_id` + `epg_now_id` para evitar re-render.

### Favoritos (localStorage)
- Chave: `pixelflix:favorites:${username}` (escopado por usuário IPTV)
- Toggle no item da lista (★ ao passar mouse) e no header do player
- Categoria virtual "★ Favoritos" no topo da rail

### Navegação por teclado
- `↑` / `↓` na lista de canais: muda canal ativo (com scroll-into-view)
- `/`: foca o input de busca
- `Esc`: limpa busca / fecha drawer mobile
- `f`: favoritar canal atual
- Implementado via `useEffect` global na página `/live` com `keydown` e ignora quando o foco está num `input/textarea`.

## Performance

- **Virtualização da lista de canais**: já que há provedores com 1000+ canais, usar `@tanstack/react-virtual` (ou solução manual com `IntersectionObserver`) para renderizar só os ~20 itens visíveis. Sem isso, render inicial trava com 2000 botões + imagens.
- **`proxyImageUrl` com lazy loading**: `loading="lazy"` + `decoding="async"` + `width/height` definidos.
- **`useDeferredValue`** no input de busca para não bloquear digitação.
- **Memoização do filtro** (`useMemo`) já existe — manter, mas mover o sort de favoritos pra fora.

## Arquivos a alterar

```text
src/services/iptv.ts                          # + EpgEntry, getShortEpg, decodeBase64Epg
src/hooks/useEpgNow.ts                        # NOVO — hook react-query + tick 30s
src/hooks/useFavorites.ts                     # NOVO — localStorage scoped por user
src/hooks/useLiveKeyboardNav.ts               # NOVO — atalhos de teclado
src/components/live/EpgNowNext.tsx            # NOVO
src/components/live/EpgTimeline.tsx           # NOVO
src/components/live/ChannelCategoryRail.tsx   # NOVO (substitui CategoryFilter no desktop)
src/components/live/ChannelListItem.tsx       # NOVO (memoizado)
src/components/live/VirtualChannelList.tsx    # NOVO (wrapper com virtualização)
src/components/live/MobileChannelDrawer.tsx   # NOVO (Sheet do shadcn)
src/components/live/PlayerInfoBar.tsx         # NOVO (info do canal + favoritar + Agora)
src/pages/Live.tsx                            # reescrito com novo grid responsivo
src/components/ChannelSidebar.tsx             # mantido como fallback / removido após migração
src/components/CategoryFilter.tsx             # mantido para uso em /vod /series
```

## Não muda

- **Player.tsx**: nenhuma alteração — só recebe novos props existentes.
- **Edge functions**: `iptv-categories` já aceita `get_short_epg`, sem deploy necessário.
- **Banco**: nenhuma migração.
- **Restantes das rotas (`/vod`, `/series`)**: intocadas.

## Resultado esperado

| Antes | Depois |
|---|---|
| Sem EPG | EPG agora/próximo na lista + timeline no player |
| Sidebar única empilhando 1000 canais | Lista virtualizada (60fps mesmo com 2000 canais) |
| Categorias em pílulas horizontais | Rail vertical desktop + dropdown tablet + tabs mobile |
| Mobile: scroll abaixo do player | Sheet/Drawer com botão flutuante |
| Sem favoritos nem teclado | ★ favs + ↑↓ / Esc f atalhos |
| ~30% viewport gasto em chrome | Player domina o viewport, info contextual |
