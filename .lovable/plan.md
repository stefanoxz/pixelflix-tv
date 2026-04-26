## Contexto

Após adicionar a coluna de pôsteres no hero de `Highlights`, surgiram dois avisos/erros:

1. **Runtime "Failed to execute 'removeChild' on 'Node'"** — causado por handlers `onError` em `<img>` que mutam o DOM diretamente (`e.target.style.display = "none"` ou `style.opacity = "0.2"`). Quando o React desmonta/remonta esses nós (rotação do hero a cada 8s, troca de `key`, cross-fade), o handler já mexeu no nó e o reconciler do React tenta remover um filho que ele não rastreia mais → crash.
2. **Warning "Function components cannot be given refs"** apontando para `MovieDetailsDialog` — o componente é function plain mas o Radix `Dialog`/`DialogPortal` está em alguma situação tentando encaminhar ref. O caminho seguro é envolver com `forwardRef` (mesmo sem usar a ref).

A varredura encontrou **17 ocorrências** do mesmo padrão de mutação direta em `onError` espalhadas pelo projeto — todas potenciais fontes do mesmo bug.

## Mudanças

### 1. Substituir mutação direta do DOM por estado React (raiz do bug)

Trocar todos os `onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}` por um pequeno componente `<SafeImage>` reutilizável que usa `useState` para esconder a imagem que falhou. Assim o React sempre é a única autoridade sobre o DOM, evitando conflito durante reconciliação.

Criar `src/components/SafeImage.tsx`:
- Props: as mesmas de `<img>` + `onErrorMode?: "hide" | "fade"` (default `"hide"`).
- Usa `useState<"ok"|"error">("ok")`.
- No erro: muda estado, e renderiza `null` (modo hide) ou aplica `opacity-20` (modo fade).
- Reseta o estado quando `src` muda (via `useEffect`).

Substituir as 17 ocorrências encontradas nestes arquivos:
- `src/pages/Highlights.tsx` (4 imgs — hero bg, mobile strip, mini-pôsteres, pôster grande)
- `src/components/MovieDetailsDialog.tsx` (2)
- `src/components/SeriesDetailsDialog.tsx` (2)
- `src/components/library/PreviewPanel.tsx` (2)
- `src/components/MediaCard.tsx`, `src/components/ChannelSidebar.tsx`, `src/pages/Account.tsx`, `src/components/live/PlayerInfoBar.tsx`, `src/components/live/ChannelListItem.tsx`, `src/components/library/TitleListItem.tsx`, `src/components/library/SeriesEpisodesPanel.tsx` (1 cada)

### 2. Corrigir warning de ref no MovieDetailsDialog e SeriesDetailsDialog

Envolver os componentes com `React.forwardRef` (a ref pode ser ignorada — só silencia o warning do Radix Dialog que tenta encaminhar ref ao filho).

### 3. Análise complementar (sem alterações neste plano)

Verifiquei rapidamente outros pontos suspeitos enquanto explorava:
- `featuredQueue` no `Highlights.tsx` está OK (não é Promise, é array de itens).
- A lógica de `onTouchStart/onTouchEnd` para pausar o carrossel está correta.
- Não há outros `onError` problemáticos fora do padrão acima.
- O Dialog de filmes/séries está usando `DialogPrimitive` direto — não há vazamento.

Se algo mais aparecer após o fix (ex.: mais runtime errors), trato em uma próxima iteração.

## Arquivos

**Novo**
- `src/components/SafeImage.tsx`

**Modificados**
- `src/pages/Highlights.tsx`
- `src/components/MovieDetailsDialog.tsx`
- `src/components/SeriesDetailsDialog.tsx`
- `src/components/MediaCard.tsx`
- `src/components/ChannelSidebar.tsx`
- `src/components/live/PlayerInfoBar.tsx`
- `src/components/live/ChannelListItem.tsx`
- `src/components/library/PreviewPanel.tsx`
- `src/components/library/TitleListItem.tsx`
- `src/components/library/SeriesEpisodesPanel.tsx`
- `src/pages/Account.tsx`

## Resultado esperado

- Erro `Failed to execute 'removeChild' on 'Node'` desaparece — confirmado pela troca da única causa conhecida (mutação fora do React).
- Warning de ref no `MovieDetailsDialog` desaparece.
- Comportamento visual idêntico (capas continuam escondendo quando falham; capas do dialog continuam com fade quando falham).
- Sem regressão no carrossel do hero, no mobile strip, nem nas demais listas.
