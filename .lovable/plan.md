## Revisão — por que tentativas anteriores falharam

Tentei posicionar o badge "ao lado de `0:34 / 1:00`" usando `left-32`. Isso **só funciona em um cenário específico** (Chrome desktop, idioma PT, tempo curto). Em outros dispositivos o resultado é o que você viu na imagem: badge solto no meio do player.

**Causa raiz**: os controles `<video controls>` vivem em **shadow DOM** do browser. Cada engine (Chromium, WebKit/Safari, Gecko/Firefox, navegadores de TV) renderiza o play, tempo, slider, volume, PiP e fullscreen com larguras e ordens **diferentes**. Não existe API nem CSS que permita "ancorar ao lado do display de tempo" de forma confiável cross-device.

## Decisão

Abandonar a tentativa de colar no tempo. Usar **âncora de canto fixo do quadro do vídeo** — esse referencial é igual em todos os dispositivos.

**Posição escolhida**: **canto superior esquerdo, inline ao lado do título** do filme/canal/episódio.

Por quê:
- Já existe ali um gradiente preto + o `<h3>` do título → o badge encaixa visualmente no mesmo bloco.
- Não conflita com os botões já posicionados no topo direito (skip ±10s, velocidade, X, Logs).
- Não cobre nada do vídeo — fica sobre o gradiente que já existe.
- Funciona idêntico em desktop, mobile, tablet, TV — depende só do tamanho do quadro.

Para canais ao vivo onde `title` pode estar vazio, o badge fica num wrapper próprio no mesmo canto (`absolute top-3 left-3`) com o mesmo gradiente fraco.

## Mudanças

**1. `src/components/QualityBadge.tsx`**
- Remover toda a lógica de `absolute`, `bottom-*`, `left-*` e o `useEffect` de visibilidade sincronizada com mouse/pause.
- O componente vira um chip puro: detecta a qualidade e renderiza apenas `<span class="...">1440p</span>` (ou `null` se não há altura).
- Estilo do chip: `inline-flex items-center rounded bg-white/15 px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold tracking-wide text-white/90 backdrop-blur-sm`.

**2. `src/components/Player.tsx`**
- Remover o bloco standalone `{showVideo && !error && <QualityBadge … />}` (linhas 1894–1896).
- Dentro do bloco do título (linha 1898–1902), trocar o `<h3>` por um flex que coloca o título e o badge lado a lado:
  ```tsx
  <div className="pointer-events-none absolute left-0 top-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4">
    <div className="flex items-center gap-2 pr-32">
      <h3 className="text-sm font-semibold text-white drop-shadow truncate">{title}</h3>
      {showVideo && !error && <QualityBadge videoRef={videoRef} hlsRef={hlsRef} />}
    </div>
  </div>
  ```
- Para casos sem `title` (ex: live sem nome carregado), adicionar um wrapper de fallback que renderiza só o badge no mesmo canto:
  ```tsx
  {!title && showVideo && !error && (
    <div className="pointer-events-none absolute left-4 top-4">
      <QualityBadge videoRef={videoRef} hlsRef={hlsRef} />
    </div>
  )}
  ```

## Resultado esperado

- Badge sempre no mesmo lugar — colado ao título, em qualquer dispositivo/browser.
- Aparece junto com o título (sem precisar sincronizar com controles).
- Não cobre o conteúdo do vídeo.
- Sem conflito com os botões do topo direito.

## Arquivos

- Editar: `src/components/QualityBadge.tsx`, `src/components/Player.tsx`.