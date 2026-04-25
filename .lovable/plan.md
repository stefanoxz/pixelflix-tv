## Problema

Hoje, ao clicar em "Assistir" num filme ou episódio de série, o player aparece como um modal centralizado com algumas asperezas:

- **Botão X flutua acima do player (`-top-12 right-0`)** — em telas mais baixas ele fica fora da viewport, e visualmente parece desconectado do conteúdo.
- **Largura fixa `max-w-5xl` + `p-4`** — em telas grandes (ex: 1685×1080 atual) o vídeo ocupa pouco mais da metade da tela; em telas pequenas ainda há padding sobrando nas laterais.
- **Sem ESC global, sem clique no backdrop** para fechar — só funciona pelo X.
- **Sem bloqueio de scroll do body** — o conteúdo de trás ainda rola se houver gestos.
- **Sem animação de saída** e o fade-in atual é o mesmo do diálogo de detalhes (parece "outro modal" em vez de uma transição cinema).
- A mesma marcação está duplicada em `Movies.tsx` e `Series.tsx`.

## Solução proposta

Criar um único componente `PlayerOverlay` reutilizável, com comportamento "cinema mode" mais natural — semelhante ao Netflix/Prime: fundo preto preenchendo a tela, vídeo centralizado e responsivo (até 16:9 limitado pela altura da janela), controles integrados.

### Comportamento

1. **Backdrop preto puro** ocupando toda a tela, sem padding externo.
2. **Vídeo dimensionado pela altura disponível** (`max-h-[calc(100vh-4rem)]`) mantendo proporção 16:9 — em monitores widescreen isso enche melhor a tela; em mobile ainda cabe sem cortar.
3. **Botão fechar dentro do quadro do player**, no canto superior direito, sobre o gradiente que já existe no Player (junto dos controles de velocidade/rewind). O X "extra" do overlay some — o Player já tem espaço próprio para essa ação.
4. **ESC fecha** (handler global no overlay).
5. **Clique no backdrop fora do vídeo fecha** (com guard pra não fechar quando clicar no próprio vídeo/controles).
6. **Body scroll lock** enquanto o overlay está aberto.
7. **Animação**: fade-in do backdrop + leve scale-in do vídeo (já existe `animate-scale-in`/`animate-fade-in` no projeto).
8. **Foco**: trap simples — ao abrir, foca no container; ao fechar, devolve foco ao gatilho anterior.

### Mudanças técnicas

| Arquivo | Mudança |
|---|---|
| `src/components/PlayerOverlay.tsx` (novo) | Componente que recebe as mesmas props do `<Player>` + `onClose`. Renderiza backdrop fullscreen, intercepta ESC e clique externo, faz body scroll lock, e injeta um botão X interno via prop nova no Player. |
| `src/components/Player.tsx` | Aceitar prop opcional `onClose` já existe. Adicionar um botão X discreto no cluster superior direito (junto de Rewind/Forward/Speed/Report) quando `onClose` for fornecido — assim o close fica dentro do quadro do vídeo, sem precisar do X externo. |
| `src/pages/Movies.tsx` | Remover a função local `PlayerOverlay` e o JSX duplicado. Passar a usar `<PlayerOverlay … />`. |
| `src/pages/Series.tsx` | Substituir o bloco `{playingEp && epUrl && (<div … Player />)}` pelo `<PlayerOverlay … />`. |

### Detalhes de layout

```text
┌────────────────────────────────────────────┐
│  backdrop  bg-black/95  (clique = fecha)   │
│                                            │
│      ┌──────────────────────────────┐      │
│      │                          [X] │      │
│      │                              │      │
│      │      <video> 16:9            │      │
│      │      max-h: 100vh - 4rem     │      │
│      │      max-w: 100vw - 4rem     │      │
│      │                              │      │
│      └──────────────────────────────┘      │
│                                            │
└────────────────────────────────────────────┘
```

Wrapper interno vira `relative w-auto h-auto max-h-[calc(100vh-4rem)] max-w-[min(100vw-2rem,1600px)] aspect-video` — usa `aspect-video` + `max-h` pra deixar o navegador escolher se o limite é a largura ou a altura, sempre mantendo 16:9.

### O que NÃO muda

- Toda a lógica interna do Player (HLS, hls.js, mpegts, watchdogs, reportes, painéis de diagnóstico) permanece intacta.
- Telas de Live (canais ao vivo) continuam com o player inline na coluna direita — não usa overlay.
- Comportamento de favoritos, navegação por teclado nas grids etc. não muda.

### Riscos / pontos de atenção

- O painel de logs do Player abre como overlay próprio — vou conferir que ele continua funcional dentro do novo wrapper (z-index, max-height).
- O botão "Reportar problema" e o dialog dele não devem fechar o overlay ao clicar fora — guard de clique outside vai checar se o alvo está dentro de qualquer portal `[role="dialog"]`.

## Resultado esperado

Player abre tipo "cinema": preto edge-to-edge, vídeo grande e centralizado, X dentro do quadro, fecha com ESC ou clique fora. Mesma experiência em Filmes e Séries, sem código duplicado.