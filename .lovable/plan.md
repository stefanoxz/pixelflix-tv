## Objetivo

Posicionar o badge de qualidade **logo ao lado do display de tempo** (ex: `0:34 / 1:00`) na barra nativa de controles, sem cobrir o conteúdo do vídeo.

## Limitação técnica

Os controles `<video controls>` são shadow DOM do browser — **não dá para inserir** elementos dentro deles. A solução é sobrepor o badge sobre a faixa escura dos controles nativos (que já é semi-transparente e não atrapalha a visualização).

## Mudança

Editar **uma única classe CSS** em `src/components/QualityBadge.tsx`:

- **Posição**: `bottom-1.5 left-[7.25rem]` (mobile) e `sm:bottom-2 sm:left-32` (desktop) — coloca o badge na altura da barra de controles, logo após onde o display de tempo termina.
- **Estilo**: `bg-white/15` (em vez de `bg-black/55`) + `text-white/90 font-semibold` — combina com a estética dos controles nativos e fica legível sobre a faixa escura deles.
- **Visibilidade**: mantém o comportamento já implementado (fade junto com os controles via `opacity` + heurística de mouse/pause).

Nenhum outro arquivo muda. Sem impacto no vídeo, controles ou layout.