# Polir tela de detalhes de Séries (multi-dispositivo)

## Problema
Hoje o modal mostra um pôster gigante (~520px de altura) + sinopse + cards grandes. O usuário **sempre precisa rolar** para ver os episódios. A imagem de referência mostra um layout muito mais enxuto onde poster, infos, abas de temporada e episódios já aparecem juntos na primeira tela.

## Objetivo
Reorganizar o modal para que os **episódios da temporada selecionada já apareçam sem rolar**, em **todos os tamanhos** suportados pelo webplayer:
- Mobile (≤ 640px) — celulares
- Tablet (641–1024px) — iPad e similares
- Desktop pequeno (1025–1366px) — notebooks
- Desktop grande (≥ 1367px) — TVs e monitores

Cada faixa mantém suas particularidades; nada é sacrificado em uma para melhorar outra.

## Mudanças por dispositivo

### Desktop (≥ md, 768px+)
- **Pôster lateral menor**: troca os atuais 42% (~420px) por um pôster fixo `w-44 lg:w-52 xl:w-56` com proporção 2/3, alinhado ao topo. Libera ~250px de espaço horizontal para o conteúdo.
- **Meta-dados em linha única**: substitui o "card pílula" volumoso por uma linha inline com ícone+valor separados por `·` (Tv 8 Temporadas · Layers 20 Episódios · 2018 · Crime, Drama · ★ 9). Estilo da referência.
- **Direção/Elenco**: uma linha cada (label em negrito + valor truncado), sem card com borda.
- **Sinopse**: parágrafo simples com `line-clamp-3` e botão "ver mais" inline para expandir, sem card grande.
- **Botão Favoritar** menor (`h-10`), inline com a linha de ações.
- Altura total do cabeçalho alvo: **~280-320px** (hoje ~520px) — garante a primeira linha de episódios visível em telas a partir de 720px de altura.

### Tablet (md, 768–1024px)
- Mesmo layout horizontal do desktop, mas com pôster `w-40` e grid de episódios em **3 colunas**.
- Tabs de temporada com scroll horizontal se houver muitas temporadas (já natural com `flex-wrap` → trocaremos por `overflow-x-auto` com `whitespace-nowrap` para evitar quebra em duas linhas em tablets).

### Mobile (< 768px) — preservado
- Mantém backdrop horizontal no topo, capa flutuante 2/3 e infos empilhadas.
- Aplica o novo estilo de tabs underline das temporadas (também melhora a usabilidade no celular vs. botões grandes atuais).
- Grid de episódios continua em 2 colunas.

### TV / Desktop muito grande (≥ xl, 1280px+)
- Modal sobe de `max-w-5xl` para `max-w-6xl` para aproveitar a tela.
- Grid de episódios em **4 colunas** (já implementado).
- Pôster até `w-56`, tipografia ligeiramente maior nos títulos.

## Tabs de temporada (todos os dispositivos)
- Trocar os botões grandes "T1" "T2" por **tabs underline** estilo da referência: "Temporada 1 | Temporada 2 | …" com sublinhado amarelo na ativa.
- Container com `overflow-x-auto` e `scroll-snap` para passar o dedo no mobile.
- Remover o título redundante "Temporadas".

## Grid de episódios
- Reduzir `max-h-[55vh]` para `max-h-[45vh]` no desktop (cabeçalho ficou bem menor, então a primeira linha já fica visível) e manter `max-h-[55vh]` no mobile.
- Layout responsivo de cards já existe (2 / 3 / 4 colunas) — preservado.

## Arquivos afetados
- `src/components/SeriesDetailsDialog.tsx` — reestrutura desktop, preserva mobile, ajusta `max-w` e paddings por breakpoint.
- `src/components/library/SeriesEpisodesPanel.tsx` — substitui botões de temporada por tabs underline com scroll horizontal; remove título "Temporadas".

## QA visual antes de entregar
Verificar em quatro viewports (375, 820, 1366, 1920) que:
1. A primeira linha de episódios aparece sem rolar no desktop e tablet em landscape.
2. No mobile, o layout permanece igual ao atual (sem regressão).
3. Tabs de temporada não quebram em duas linhas — usam scroll horizontal quando necessário.
4. Pôster mantém proporção e nitidez em todas as faixas.
