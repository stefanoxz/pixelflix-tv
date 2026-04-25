# Ajustes de UI: Hero e Dialogs

## Problemas identificados

**1. Botão "Canais ao vivo" no hero "Em destaque"**
- Local: `src/pages/Highlights.tsx`, linhas 161-164
- É o terceiro botão ao lado de "Assistir agora" e "Mais informações".

**2. Dois botões de fechar (X) nos dialogs de detalhes**
- O componente base `src/components/ui/dialog.tsx` (linhas 44-48) já renderiza automaticamente um botão X no canto superior direito (padrão shadcn/Radix).
- Os componentes `MovieDetailsDialog.tsx` (linha 88-93) e `SeriesDetailsDialog.tsx` (linha 82-87) adicionam um **segundo** botão X manualmente sobre o backdrop do poster.
- Isso causa o aparecimento de 2 X's sobrepostos visíveis na imagem enviada.

## Mudanças

### 1. `src/pages/Highlights.tsx`
- Remover o `<Button>` "Canais ao vivo" (linhas 161-164).
- Manter os indicadores e os outros 2 CTAs intactos.
- A estatística "Canais ao vivo" no grid de cards abaixo (linha 191) **permanece** — não é botão duplicado, é card informativo.

### 2. `src/components/MovieDetailsDialog.tsx`
- Remover o botão X manual (bloco aproximado linhas 88-93) e o import `X` se ficar não-utilizado.
- Manter apenas o X automático do `DialogContent`.

### 3. `src/components/SeriesDetailsDialog.tsx`
- Remover o botão X manual (bloco aproximado linhas 82-87) e o import `X` se ficar não-utilizado.
- Manter apenas o X automático do `DialogContent`.

## Não alterado
- Lógica do player, proxy, autenticação, backend.
- Estilo visual dos dialogs (apenas o botão X duplicado é removido).
- Estatísticas/cards informativos no Highlights.
