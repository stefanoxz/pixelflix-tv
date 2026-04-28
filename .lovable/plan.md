## Objetivo

Mover o badge de qualidade para **junto da barra de tempo** dos controles do player e fazê-lo **aparecer/desaparecer junto com os controles**.

---

## Como funciona

O `<video>` usa controles **nativos** do browser, que não expõem evento de visibilidade. Vamos replicar a heurística padrão para sincronizar o badge:

- **Visível** quando: vídeo pausado, mouse sobre o player, ou houve movimento/touch nos últimos ~2.5s.
- **Oculto** quando: vídeo tocando + sem atividade do mouse há ~2.5s.
- Transição: `opacity` com `transition-opacity duration-200` (mesma sensação dos controles nativos).

**Posição**: canto inferior direito, alinhado verticalmente com a barra de controles nativa (`bottom-12 right-3`) — fica visualmente "do lado" do display de tempo / volume / fullscreen.

---

## Mudanças

**Editar** `src/components/QualityBadge.tsx` (arquivo já criado na rodada anterior):

1. Adicionar estado `visible` (default `true`).
2. Novo `useEffect` que escuta no elemento pai do `<video>`:
   - `mousemove`, `mouseenter`, `touchstart` → mostra + agenda esconder em 2.5s.
   - `mouseleave` → agenda esconder.
   - Eventos do `<video>`: `pause` → mostra e cancela timer; `play`/`playing` → agenda esconder.
3. Aplicar classes via `cn(..., visible ? "opacity-100" : "opacity-0")` com `transition-opacity duration-200`.

Nenhum outro arquivo muda. Sem impacto em layout, controles ou comportamento de reprodução.