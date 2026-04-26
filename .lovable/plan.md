## Objetivo

Tornar o hero de destaques mais visual mostrando os **pôsteres reais** dos títulos em rotação, mantendo a leitura do texto e sem quebrar mobile.

## Conceito visual

No layout atual, o título ocupa a esquerda e o fundo é apenas a capa esmaecida (30% opacidade) — fica "vazio" no lado direito. A proposta é:

**Desktop / tablet (≥ md):**
- Coluna esquerda: bloco atual (badge, título, rating, sinopse, botões, indicadores) — sem mudança de copy.
- Coluna direita: **pôster do destaque ativo em destaque grande** (aspect 2:3, ~280px de largura) com sombra/glow, levemente flutuando, ladeado por uma **fileira vertical de 3-4 mini-pôsteres** dos próximos títulos da fila (clicáveis para pular direto ao destaque).
- O background mantém a capa esmaecida + gradientes (já existe), só ajustamos o gradient lateral pra não escurecer demais o lado da capa.

**Mobile (< md):**
- Mantém o layout vertical atual (texto sobre background esmaecido) — **não adiciona pôster grande à direita** porque competiria com o texto em telas estreitas.
- Adiciona uma **tira horizontal compacta** abaixo dos botões com 4-5 mini-pôsteres (≈ 56×84px) representando os próximos da fila, com scroll horizontal suave. Substitui visualmente os "dots" indicadores por algo mais informativo, sem aumentar muito a altura do hero.
- O dot indicator atual fica oculto no mobile (a tira de pôsteres já cumpre o papel) e permanece no desktop.

## Comportamento

- Clicar em qualquer mini-pôster → `setActiveIdx(i)` (mesma ação dos dots hoje).
- Clicar no pôster grande → mesma ação do "Assistir agora" (`openFeatured`).
- Hover/foco em mini-pôster pausa a rotação (reaproveita `pausedRef`).
- Transição entre pôster grande ativo: cross-fade rápido (200ms) sincronizado com o cross-fade do background.
- Mini-pôsteres usam `loading="lazy"` e `proxyImageUrl` (já existe).
- Fallback: se `cover` falha (`onError`), esconde o `<img>` e mostra placeholder neutro — não quebra a coluna.

## Responsividade — pontos de cuidado

| Breakpoint | Mostra pôster grande? | Mini-pôsteres |
|---|---|---|
| < 640px (mobile) | Não | Tira horizontal (4-5 itens, scroll-x) |
| 640-767px (sm) | Não | Tira horizontal |
| 768-1023px (md) | Sim (180px) | 3 mini verticais ao lado |
| ≥ 1024px (lg+) | Sim (240-280px) | 4 mini verticais ao lado |

- Hero atual: `h-[55vh] md:h-[68vh]` — **não muda**. Coluna direita é absolutamente posicionada dentro do mesmo container, sem aumentar altura.
- Texto continua em `max-w-2xl` no desktop; com a coluna de pôsteres ocupando ~360px à direita, a área de leitura ainda fica confortável em telas ≥ 1024px. Em md (768-1023px) reduzimos `max-w-2xl` → `max-w-md` pra evitar sobreposição.
- Em mobile a coluna de pôsteres não é renderizada (`hidden md:flex`), então zero risco de quebrar o layout atual.

## Arquivos afetados

- **`src/pages/Highlights.tsx`** — único arquivo modificado. Adiciona:
  - Subcomponente local `FeaturedPosterColumn` (desktop) com pôster grande + mini-pôsteres laterais.
  - Subcomponente local `FeaturedPosterStrip` (mobile) com tira horizontal.
  - Ajuste no `<div className="max-w-2xl ...">` pra `max-w-2xl lg:max-w-xl` quando a coluna de pôsteres está presente.
  - Os dots indicadores ganham `hidden md:flex` (já que mobile usa a tira).

Sem mudanças em CSS global, hooks, queries ou serviços. Sem novas dependências.

## Riscos e mitigações

- **Imagens TMDB lentas no 3G:** mini-pôsteres ficam com `loading="lazy"` e `decoding="async"`; pôster grande tem `fetchpriority="high"` só pro ativo.
- **Layout shift:** containers com aspect-ratio fixo (2:3) — sem CLS.
- **Telas muito largas (>1600px):** o `mx-auto max-w-[1800px]` já existente evita estiramento; coluna de pôsteres alinha à direita do container.
- **Quando `featuredQueue` tem só 1 item:** pôster grande aparece sozinho, mini-pôsteres laterais não renderizam (mesma lógica do dot indicator).
- **Quando `featuredQueue` está vazio (loading):** coluna de pôsteres não renderiza — comportamento atual do hero "Bem-vindo ao SuperTech" preservado.

Erro de runtime "promise.then is not a function" detectado no preview — não relacionado a este escopo, deixarei pra investigar separadamente se persistir após esta mudança.