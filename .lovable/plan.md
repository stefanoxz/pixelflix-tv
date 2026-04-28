## Objetivo

Mostrar de forma **bem discreta** dentro do player a **qualidade real** que o stream está entregando (ex: `1080p`, `720p`, `4K`, `SD`) — para filmes, episódios e canais ao vivo.

Sem mexer em layout, controles, ou comportamento existente. Apenas um pequeno badge no canto.

---

## Como detectamos a qualidade real

A qualidade não vem confiável dos metadados do servidor IPTV (o nome do canal pode dizer "FHD" mas entregar 540p). Vamos detectar do próprio vídeo em runtime:

1. **Fonte primária — `<video>` nativo**: `video.videoHeight` e `video.videoWidth` são preenchidos pelo browser assim que o primeiro frame decodifica. Funciona para qualquer engine (HLS, MPEG-TS, MP4 nativo).
2. **Fonte secundária (HLS adaptativo)**: quando `hlsRef.current` existe, lemos `hls.levels[hls.currentLevel]` para pegar `height`/`bitrate` do nível ativo — útil quando o ABR troca de nível no meio da reprodução.

Mapeamento de altura → label:
- `≥ 2160` → `4K`
- `≥ 1440` → `1440p`
- `≥ 1080` → `1080p`
- `≥ 720`  → `720p`
- `≥ 480`  → `480p`
- `> 0`    → `SD`

Se `videoHeight` ainda for 0 (antes do primeiro frame), o badge fica oculto.

---

## Onde aparece

Um pequeno chip dentro do `<Player>`, posicionado **absolute** sobre o `<video>`:
- Canto: **superior direito**, dentro do quadro do vídeo.
- Estilo: `text-[10px]` (mobile) / `text-xs` (desktop), `bg-black/50`, `text-white/85`, `rounded`, `px-1.5 py-0.5`, `backdrop-blur-sm`.
- Aparece junto com os controles (mesma lógica de auto-hide já usada no overlay do player) — ou pode ficar sempre visível, bem fraco. **Recomendação: sempre visível mas semi-transparente**, pra não conflitar com o botão X/dropdowns do canto superior direito.
- Para evitar colidir com o botão X já existente no canto superior direito, posicionamos no **canto inferior direito** do vídeo (acima da barra nativa de controles do `<video controls>`, com `bottom-12 right-2`).

---

## Implementação técnica

**1. Novo componente** `src/components/QualityBadge.tsx`
- Recebe `videoRef: RefObject<HTMLVideoElement>` e (opcional) `hlsRef: RefObject<Hls | null>`.
- Estado interno: `{ height: number, label: string } | null`.
- Listeners no `<video>`:
  - `loadedmetadata`, `resize`, `playing` → relê `videoHeight`.
- Listener no `Hls` (se disponível): `Hls.Events.LEVEL_SWITCHED` → relê `levels[data.level].height`.
- Cleanup em todos os listeners no unmount.
- Renderiza `null` se `height === 0`.

**2. Edição mínima em `src/components/Player.tsx`**
- Importar `QualityBadge`.
- Renderizar `<QualityBadge videoRef={videoRef} hlsRef={hlsRef} />` dentro do mesmo wrapper `relative` que já contém o `<video>` (nada mais muda).

**Nada** muda em `PlayerOverlay.tsx`, `Live.tsx`, `Movies.tsx`, `Series.tsx` — o badge vive dentro do Player e funciona automaticamente em todos os contextos.

---

## Arquivos

- **Criar**: `src/components/QualityBadge.tsx` (~60 linhas).
- **Editar**: `src/components/Player.tsx` (1 import + 1 linha de JSX).

Sem mudanças de banco, edge functions, contexto ou hooks globais.