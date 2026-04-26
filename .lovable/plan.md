# Análise: Bugs introduzidos pelas mudanças mobile/PWA

Fiz uma varredura completa do sistema buscando regressões pelas mudanças recentes (BottomNav, safe-areas, dvh, hover guard, Touch Optimization, novas animações). Encontrei **5 bugs reais** + **3 melhorias pendentes**.

---

## 🔴 BUGS CRÍTICOS

### 1. Página inicial (`/`) sem BottomNav e sem padding-bottom
`src/pages/Index.tsx` renderiza `<Header />` direto e **não usa o wrapper `WithChrome`** do `App.tsx`. Resultado:
- No mobile, a tela `/` (Highlights) **não tem barra inferior** — usuário fica sem navegação.
- Conteúdo no rodapé (último carrossel) fica **escondido atrás de onde a barra apareceria** em outras páginas, criando inconsistência visual.
- Header é renderizado duas vezes em rotas que usam Index? Não — só em `/`. Mas o padrão fica quebrado.

**Fix**: Eliminar o `<Header />` interno do `Index.tsx` e envolver `/` com `WithChrome` no `App.tsx`, igual `/live`, `/movies`, etc.

### 2. FAB "Canais" duplicado em `/live`
`Live.tsx` linha 249 tem um FAB próprio, e `MobileChannelDrawer.tsx` linha 189 tem **outro FAB** (`fixed bottom-4 right-4`). Os dois aparecem juntos no mobile, sobrepostos.

**Fix**: Remover o FAB interno do `MobileChannelDrawer` (ele já é só um wrapper de `<Sheet>`); manter apenas o do `Live.tsx` que já está posicionado acima do BottomNav.

### 3. `Movies.tsx` e `Series.tsx` ainda usam `100vh` fixo
```
src/pages/Movies.tsx:215  style={{ height: "calc(100vh - 7rem)", minHeight: 520 }}
src/pages/Series.tsx:319  style={{ height: "calc(100vh - 7rem)", minHeight: 520 }}
src/pages/Live.tsx:180,221  h-[calc(100vh-160px)]
```
A barra dinâmica do Chrome/Safari mobile vai cortar conteúdo. O `LibraryShell` já foi corrigido para `dvh`, mas essas duas páginas ficaram para trás.

**Fix**: Trocar para `calc(100dvh - 7rem)` com fallback `vh`.

### 4. Conflito entre `Header` sticky e `LibraryTopBar` sticky
- `Header`: `sticky top-0 z-40`
- `LibraryTopBar`: `sticky top-0 z-30`

Quando rolagem ocorre dentro de `<main>` (não scroll-container), os dois ficam grudados em `top:0`. O LibraryTopBar deveria começar **abaixo** do header (`top: 4rem`), senão fica escondido atrás dele em viewport pequeno onde o usuário rola a página.

**Fix**: Em `LibraryTopBar`, mudar para `top-16` (= 4rem, altura do header).

### 5. `BottomNav` cobre o último item de listas em rotas que não usam `pb-bottom-nav`
O `WithChrome` do `App.tsx` aplica `pb-bottom-nav` no `<main>`, OK. Mas:
- `Index.tsx` (não usa WithChrome — vide bug #1)
- Os componentes filhos com scroll interno próprio (`PosterGrid`, `VirtualChannelList`) não recebem o padding porque rolam num container interno, **não no body**. No mobile o último pôster da grade fica escondido pela BottomNav.

**Fix**: Em telas mobile (< md), as colunas do `LibraryShell` rolam em altura natural — então o `pb-bottom-nav` do `<main>` resolve. Mas `PosterGrid` no mobile força altura própria? Conferir e adicionar padding-bottom na lista virtualizada quando renderizada em layout mobile.

---

## 🟡 MELHORIAS / RISCOS MENORES

### 6. Animações `blob` e `float` pesadas em mobile
A `Login.tsx` roda 3 `animate-blob` (16s) + 1 `animate-float` (6s) + 2 radial gradients + grid pattern. Em celulares mais antigos isso causa frame drops na tela de login. Considerar:
- Desabilitar `animate-blob` quando `prefers-reduced-motion: reduce`.
- Usar `will-change: transform` apenas no elemento ativo.

### 7. `MobileChannelDrawer` sem padding safe-area no rodapé
Drawer abre de baixo no mobile e o conteúdo final pode ficar atrás da gesture bar do iPhone. O `MobileCategoryDrawer` já tem `pb-[env(safe-area-inset-bottom)]` (linha 26), mas `MobileChannelDrawer` precisa receber o mesmo.

### 8. `Header` mobile não esconde em `/sync`
`Header.tsx` esconde só em `/login` e `/admin`. Já o `BottomNav` esconde em `/login`, `/admin` e `/sync`. Inconsistência: na tela de Sync aparece o avatar dropdown no topo (que pode levar o usuário a navegar antes da sincronização terminar).

**Fix**: adicionar `/sync` à lista do Header também.

---

## 📋 Plano de implementação

```text
Phase A — Fixes críticos (5min)
  1. Index.tsx: remover <Header /> interno + envolver / com WithChrome
  2. Live.tsx: remover FAB interno do MobileChannelDrawer
  3. Movies/Series/Live: trocar 100vh → 100dvh com fallback
  4. LibraryTopBar: top-0 → top-16 em sticky
  5. Header.tsx: esconder também em /sync

Phase B — Polimento (3min)
  6. MobileChannelDrawer: pb-[env(safe-area-inset-bottom)]
  7. Login.tsx: respeitar prefers-reduced-motion
  8. PosterGrid: garantir padding-bottom no scroll mobile
```

## Arquivos afetados

- `src/App.tsx` (envolver `/` com WithChrome)
- `src/pages/Index.tsx` (remover Header)
- `src/pages/Live.tsx` (dvh + remover FAB duplicado)
- `src/pages/Movies.tsx` (dvh)
- `src/pages/Series.tsx` (dvh)
- `src/components/Header.tsx` (esconder em /sync)
- `src/components/library/LibraryTopBar.tsx` (top-16)
- `src/components/live/MobileChannelDrawer.tsx` (remover FAB + safe-area)
- `src/pages/Login.tsx` (reduced-motion guard)
- `src/components/library/PosterGrid.tsx` (padding mobile)

Aprovando, eu aplico todos os fixes em sequência.
