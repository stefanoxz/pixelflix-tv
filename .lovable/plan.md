# Correções na home, detalhes, favoritos e conta

Cinco mudanças relacionadas para melhorar navegação, descoberta e personalização.

## 1. Destaques da home: clique abre o item correto, com detalhes

**Problema atual:** em `src/pages/Highlights.tsx`, todos os cards (Filmes populares e Séries em alta) chamam `navigate("/movies")` ou `navigate("/series")` — ignorando qual item foi clicado. Além disso, ao abrir filmes/séries, não aparece nenhuma tela de detalhes; o player abre direto.

**Solução:**
- Passar o item clicado para a rota destino via `navigate("/movies", { state: { openId: m.stream_id } })` (e análogo para séries).
- Em `src/pages/Movies.tsx` e `src/pages/Series.tsx`, ler `useLocation().state?.openId` no mount e abrir automaticamente o modal correspondente.
- Criar uma **tela de detalhes do filme** antes do player: novo componente `MovieDetailsDialog` que mostra capa, título, sinopse, gênero, ano, duração, nota e botão "Assistir". Para isso, adicionar `getVodInfo(creds, vodId)` em `src/services/iptv.ts` (action `get_vod_info` da API Xtream — já suportada pelo edge function genérico `iptv-categories`).
- Em Filmes, o clique no card abre o `MovieDetailsDialog`; o botão "Assistir" do diálogo é que dispara o `Player` em tela cheia (mesmo padrão já usado em Séries).

## 2. Remover toggle "Apenas conteúdos compatíveis com navegador"

Remover o `Switch`+`Label` de `src/pages/Movies.tsx` (linhas 75-87) e de `src/pages/Series.tsx` (linhas 251-262). Remover o estado `onlyCompatible` e o filtro associado em ambas as páginas. Episódios continuam mostrando o badge de formato e o botão "Abrir externo" quando aplicável — só some o filtro global.

## 3. Favoritos para Filmes e Séries

Hoje só existe favorito de canal ao vivo (`useFavorites` em `src/pages/Live.tsx`). Vamos generalizar:

- Estender `src/hooks/useFavorites.ts` aceitando um `kind`: `"live" | "vod" | "series"`, persistindo em chaves separadas (`pixelflix:favorites:{kind}:{user}`).
- Em `MediaCard` adicionar prop opcional `isFavorite` + `onToggleFavorite`, exibindo um botão de coração no canto superior direito (visível em hover/sempre no mobile).
- Em `Movies.tsx` e `Series.tsx`: usar o hook, passar handlers ao `MediaCard`, adicionar tab/filtro "Favoritos" junto do filtro de categorias (botão extra antes da lista de categorias).
- Em `MovieDetailsDialog` e no modal de série, incluir botão "Favoritar" no cabeçalho.

## 4. Aba "Conta" mostra favoritos reais

Hoje a página `src/pages/Account.tsx` exibe contadores hardcoded em `0` e só lista canais e filmes. Vamos:

- Ler favoritos persistidos do `localStorage` para os três tipos (`live`, `vod`, `series`) usando o hook `useFavorites`.
- Substituir os 2 cards estáticos por uma seção com 3 cards (Canais, Filmes, Séries) mostrando contagem real.
- Abaixo dos contadores, listar miniaturas (até 6 por tipo) com link para abrir o item — ao clicar, navegar para `/live`, `/movies` ou `/series` com `state.openId` (mesma mecânica do passo 1). Para resolver nome/capa, reaproveitar as queries `getLiveStreams` / `getVodStreams` / `getSeries` (já cacheadas pelo React Query).
- Estado vazio amigável ("Você ainda não favoritou nenhum filme") em cada seção sem itens.

## 5. Hero de Destaques rotacionando automaticamente

Em `src/pages/Highlights.tsx` o hero mostra apenas `movies[0]`. Vamos:

- Misturar top 8 filmes + top 4 séries para formar uma fila de destaques.
- Usar `useState` + `useEffect` com `setInterval` de **8s** para alternar o destaque ativo (com `clearInterval` no unmount).
- Adicionar transição suave (fade) no título/imagem de fundo, indicadores (dots) clicáveis abaixo do CTA e pausa ao passar o mouse (`onMouseEnter`/`Leave`).
- Botão "Assistir agora" passa a abrir o item atual via `navigate` com `state.openId` (consistente com o passo 1) em vez de levar para a listagem genérica.

## Detalhes técnicos

**Arquivos a editar:**
- `src/services/iptv.ts` — adicionar `getVodInfo(creds, vodId)` e tipos `VodInfo`.
- `src/hooks/useFavorites.ts` — aceitar parâmetro `kind`.
- `src/components/MediaCard.tsx` — botão de favorito opcional.
- `src/pages/Highlights.tsx` — rotação do hero, navegação com `state.openId`.
- `src/pages/Movies.tsx` — abrir via `state.openId`, detalhes antes do player, remover toggle, favoritos + filtro favoritos.
- `src/pages/Series.tsx` — abrir via `state.openId`, remover toggle, favoritos + filtro favoritos.
- `src/pages/Account.tsx` — substituir cards estáticos por contagem + miniaturas reais.

**Novos arquivos:**
- `src/components/MovieDetailsDialog.tsx` — modal de detalhes (capa, sinopse, metadados, botão Assistir + Favoritar).

**Sem mudanças necessárias** em edge functions, banco de dados, autenticação ou na página `/live` (a não ser ajustar a chamada de `useFavorites` para o novo kind `"live"`).
