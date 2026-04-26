## Análise atual (mobile/tablet)

Pontos verificados:
- **Header**: menu hambúrguer ok, mas em mobile a navegação está escondida atrás de um clique extra. Avatar/conta só aparece no desktop.
- **Hero (Highlights)**: `60vh` + texto largo — fica cortado/apertado em telefones pequenos. Botões "Assistir / Mais informações" empilham mas ocupam pouca largura.
- **Live**: FAB "Canais" + drawer ok. Player + EPG funcionam, mas falta `safe-area` (iPhone notch) e o player não respeita a barra inferior em fullscreen do navegador.
- **Account**: cards em `grid-cols-2` no mobile com info densa — `tabular-nums` truncadas. Botão "Sair da conta" perdido no fim sem destaque.
- **Library (Movies/Series)**: `LibraryShell` usa `height: calc(100vh - 11rem)` fixo, o que em mobile com browser chrome dinâmico (Safari/Chrome iOS) **corta conteúdo embaixo**. Drawer de categorias funciona mas só tem 280px (estreito demais em tablets).
- **PosterGrid**: 3 colunas no mobile com gap de 8px — pôsteres ficam minúsculos em telas <360px. Hover scale `1.06` é inútil em touch e atrapalha o tap (delay).
- **Falta**: nenhum padding `env(safe-area-inset-*)`; sem bottom navigation (padrão de apps mobile); inputs de busca sem `autoCapitalize="off"` e `enterKeyHint="search"`; toques sem feedback `active:` claro.

---

## Plano de polimento mobile/tablet (3 fases)

### Fase 1 — Fundamentos mobile (alto impacto)

1. **Safe areas (iPhone/Android)**
   - `index.css`: adicionar utilitário `.safe-bottom`, `.safe-top`, `.safe-x` usando `env(safe-area-inset-*)`.
   - `index.html`: garantir `<meta name="viewport" content="..., viewport-fit=cover">` (verificar/atualizar).
   - Aplicar `.safe-bottom` no FAB de Live, no Header móvel quando colapsado, e no fim das páginas com botões fixos.

2. **Bottom Navigation (mobile-only)**
   - Novo componente `BottomNav.tsx`: barra fixa inferior com 4 itens (Destaques / Ao Vivo / Filmes / Séries) + um quinto "Conta".
   - Visível apenas em `<md` (`md:hidden`), substitui a necessidade de abrir o hambúrguer pra trocar de seção.
   - Header mobile fica mais limpo: só logo + avatar (dropdown).
   - Padding `safe-bottom` integrado.

3. **Header mobile redesign**
   - Avatar com dropdown também no mobile (mesma UX do desktop).
   - Remover lista de nav do menu hambúrguer (agora vive no BottomNav) — sobra só "Minha conta", "Sincronizar", "Sair".
   - Pode até trocar o hambúrguer por um avatar tappável direto.

4. **Altura fluida (LibraryShell)**
   - Trocar `calc(100vh - 11rem)` por `100dvh` (`dynamic viewport height`) com fallback: `min-h-[calc(100svh-11rem)]` + `lg:h-[calc(100dvh-11rem)]`.
   - No mobile, deixar a lista usar altura natural (não fixa), já que o layout vira coluna única.

### Fase 2 — Componentes & Touch

5. **Hero (Highlights) mobile**
   - Diminuir `min-h` para `380px` em telefones; aumentar peso do gradient inferior pra leitura.
   - Botões em `w-full sm:w-auto` no mobile pra ocupar largura total (CTA mais clicável).
   - Reduzir tamanho do título em `<sm` (`text-3xl` em vez de `text-5xl`).

6. **PosterCard / MediaCard touch-friendly**
   - Substituir `hover:scale-1.06` por `hover:scale-1.04 active:scale-95` com `transition-transform`.
   - Adicionar `@media (hover: hover)` no CSS pra desabilitar shadow/lift hover em touch (evita "stuck hover" em mobile).
   - Aumentar área de toque do botão "favorito" para 40x40px mínimo.

7. **PosterGrid mobile**
   - Em telas <360px usar 2 colunas (mais respiro). De 360-639px manter 3.
   - Aumentar gap pra 10px no mobile (mais arejado).

8. **Drawers mais largos em tablets**
   - `MobileCategoryDrawer` e `MobileChannelDrawer`: `w-[280px] sm:w-[360px] md:w-[420px]`.
   - Adicionar safe-area no fundo dos drawers.

### Fase 3 — Detalhes finos

9. **Inputs de busca**
   - Em todos os `<Input>` de busca: `inputMode="search"`, `enterKeyHint="search"`, `autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}`.
   - Botão "X" pra limpar busca quando há texto (mobile-friendly).

10. **Account mobile**
    - Botão "Sair da conta" sticky no rodapé em mobile (com safe-area), variante destrutiva sutil.
    - Cards de info (`Calendar/Clock/Wifi/Shield`) em `grid-cols-2` ok, mas usar `text-sm` em vez de `text-base` no mobile pra evitar truncamento.
    - Avatar centralizado em telas pequenas (já é `flex-col`, só ajustar `items-center md:items-start`).

11. **Player em landscape mobile**
    - Adicionar listener simples de orientação: quando `landscape` em mobile, esconder `LibraryTopBar` para player ocupar mais tela.
    - Garantir que controles do player respeitam safe-area horizontal (notch lateral em iPhone landscape).

12. **Feedback tátil universal**
    - Classe utilitária `.tap-feedback` em `index.css`: `active:scale-[0.97] transition-transform duration-100`.
    - Aplicar em botões principais, cards clicáveis e itens de lista.

---

## Detalhes técnicos

**Arquivos novos:**
- `src/components/BottomNav.tsx`

**Arquivos editados:**
- `index.html` (viewport-fit)
- `src/index.css` (utilitários safe-area + tap-feedback + media hover guard)
- `src/App.tsx` (montar BottomNav globalmente, ocultar em login/admin)
- `src/components/Header.tsx` (mobile redesign)
- `src/components/library/LibraryShell.tsx` (altura dvh)
- `src/components/library/MobileCategoryDrawer.tsx` (largura)
- `src/components/live/MobileChannelDrawer.tsx` (largura, safe-area)
- `src/components/library/PosterGrid.tsx` (cols 2 em <360, gap maior)
- `src/components/library/PosterCard.tsx` + `src/components/MediaCard.tsx` (hover/active)
- `src/pages/Highlights.tsx` (hero mobile)
- `src/pages/Live.tsx` (FAB safe-area, landscape)
- `src/pages/Account.tsx` (botão sticky, cards densidade)

**Padrão de safe-area:**
```css
.safe-bottom { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
.safe-top    { padding-top:    max(0.5rem, env(safe-area-inset-top)); }
.safe-x      { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
```

**Hover guard:**
```css
@media (hover: none) {
  .hover-lift:hover { transform: none !important; box-shadow: none !important; }
}
```

---

## Como entregar

Recomendo as três fases juntas em uma única entrega — são mudanças coesas e o impacto fica completo. Mas se preferir, dá pra fatiar:
- **Só Fase 1** (bottom nav + safe-area + altura fluida) — ganho grande imediato.
- **Fase 1 + 2** (cobre 80% das melhorias visíveis).
- **Tudo** (recomendado).

Qual prefere?