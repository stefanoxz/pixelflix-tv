## Problema

Na tela **Ao Vivo** (mobile), existe uma barra de busca exibida abaixo do player ("Buscar canal..."). Essa barra **não funciona visualmente** porque:

- A lista de canais filtrada (`filtered`) é renderizada apenas na sidebar desktop (`hidden lg:flex`) e dentro do `MobileChannelDrawer`.
- No mobile, com o drawer fechado, digitar nessa barra atualiza o estado `search` mas **não há lista visível** para mostrar resultados — o usuário digita "globo" e nada acontece na tela.
- O `MobileChannelDrawer` já tem sua própria barra de busca interna que funciona corretamente quando o drawer está aberto.

Resultado: barra duplicada e aparentemente quebrada, conforme o screenshot enviado.

## Solução

Remover a barra de busca mobile redundante do `Live.tsx`. A busca continuará disponível através do botão flutuante **"Canais"** (FAB) que abre o drawer — onde já existe um campo de busca funcional no topo.

## Mudança técnica

**Arquivo:** `src/pages/Live.tsx`

Remover o bloco JSX da busca mobile (linhas ~232-247, o `<div className="md:hidden relative">` que contém o `<Input placeholder="Buscar canal...">`).

Nada mais precisa mudar:
- O estado `search` / `debouncedSearch` continua sendo usado pelo drawer.
- O atalho de teclado `/` (`onSearchFocus`) continua válido para desktop (foca o input do `LibraryTopBar`).
- A barra de busca do desktop (dentro do `LibraryTopBar`, `hidden md:block`) permanece intacta.
- A barra de busca dentro do `MobileChannelDrawer` permanece como fonte única de busca no mobile.

## Resultado esperado

- Mobile: usuário toca em **"Canais"** (FAB) → drawer abre → barra de busca no topo do drawer filtra a lista visível ali mesmo.
- Desktop: continua igual (busca no topbar, lista lateral atualiza).
- Sem barra fantasma quebrada na tela principal do mobile.
