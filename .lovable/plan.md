

## Melhorias de UX para episódios não suportados (MKV/AVI)

Sem transcoding e sem mexer no backend. Apenas detectar antes, sinalizar com clareza e oferecer alternativa (copiar link para player externo).

### 1. Helper reutilizável — `src/services/iptv.ts`

Adicionar funções utilitárias:

```ts
export function normalizeExt(ext?: string) {
  return (ext || "").toLowerCase().replace(/^\./, "");
}

export function isBrowserPlayable(ext?: string): boolean {
  const e = normalizeExt(ext);
  return ["mp4", "m3u8", "webm"].includes(e);
}

export function isExternalOnly(ext?: string): boolean {
  const e = normalizeExt(ext);
  return ["mkv", "avi", "mov"].includes(e);
}

export type FormatBadge = {
  label: string;
  tone: "green" | "blue" | "yellow" | "gray";
  tooltip: string;
};

export function getFormatBadge(ext?: string): FormatBadge {
  const e = normalizeExt(ext);
  if (e === "mp4")  return { label: "MP4",    tone: "green",  tooltip: "Compatível com navegador" };
  if (e === "m3u8") return { label: "STREAM", tone: "blue",   tooltip: "Streaming HLS" };
  if (e === "mkv" || e === "avi" || e === "mov")
                    return { label: "EXTERNO", tone: "yellow", tooltip: "Abrir em player externo" };
  return { label: e.toUpperCase() || "?", tone: "gray", tooltip: "Formato desconhecido" };
}
```

### 2. Lista de episódios — `src/pages/Series.tsx`

Para cada episódio, ao lado do título:
- **Badge de formato** colorido (verde/azul/amarelo/cinza) com `Tooltip` do shadcn usando `getFormatBadge(ep.container_extension)`.
- Se `isExternalOnly(ext)` for `true`:
  - O clique principal **não** abre o player. Em vez disso abre um pequeno painel com:
    - Botão **"Abrir externo"** → copia URL **direta sem proxy** (`buildSeriesEpisodeUrl(creds, ep.id, ep.container_extension)`) e dispara `toast.success("Link copiado — abra no VLC ou MX Player")`.
  - Visual: ícone `ExternalLink` em vez de `Play`.
- Se `isBrowserPlayable` ou desconhecido: mantém comportamento atual (abre `Player`).

Adicionar **toggle** acima da lista de episódios:
- *"Mostrar apenas episódios compatíveis com o navegador"* (`Switch` shadcn).
- Quando ativo, filtra `episodes` por `isBrowserPlayable(ep.container_extension)`.

Mostrar contador discreto: `X episódios · Y só em player externo`.

### 3. Player proativo — `src/components/Player.tsx`

Aceitar nova prop opcional:
```ts
interface PlayerProps {
  src?: string | null;
  rawUrl?: string;          // URL direta sem proxy, para copiar
  containerExt?: string;    // extensão original
  poster?: string;
  title?: string;
  autoPlay?: boolean;
}
```

Antes do `useEffect` de attach:
- Se `isExternalOnly(containerExt)`, **não** tentar carregar nada no `<video>`. Definir imediatamente `error` com:
  - Título: *"Formato não suportado no navegador"*
  - Descrição: *"Este conteúdo usa um container (MKV/AVI/MOV) que não é compatível com reprodução web."*
  - Botões: **"Copiar link para VLC"** (usa `rawUrl` se fornecido, senão `src`) e **"Fechar"** (chama `onClose` opcional ou apenas oculta o overlay parando reprodução).
- Remover o ciclo "tenta → falha → mostra erro" para esses formatos.

Manter o fluxo atual (HLS / native / proxy fallback) para os demais.

### 4. Integração em `Series.tsx` ao montar o player

Passar a extensão e a URL crua:
```tsx
<Player
  src={proxyUrl(buildSeriesEpisodeUrl(creds, playingEp.id, playingEp.container_extension))}
  rawUrl={buildSeriesEpisodeUrl(creds, playingEp.id, playingEp.container_extension)}
  containerExt={playingEp.container_extension}
  title={playingEp.title}
  poster={playingEp.info?.movie_image || openSeries.cover}
/>
```

### Detalhes técnicos

- Tooltips: usar `@/components/ui/tooltip` (já existe).
- Toggle: `@/components/ui/switch` (já existe).
- Toast: `sonner` (já em uso no `Player`).
- Cores das badges via classes Tailwind com tokens semânticos (não hex direto).
- Nenhuma alteração em Edge Functions, contexto ou tipos do Supabase.

### Arquivos alterados

- `src/services/iptv.ts` — adicionar `isBrowserPlayable`, `isExternalOnly`, `getFormatBadge`, `normalizeExt`.
- `src/pages/Series.tsx` — badges, botão "Abrir externo", toggle de filtro, novas props no `<Player>`.
- `src/components/Player.tsx` — props `rawUrl`/`containerExt`, detecção proativa de MKV/AVI/MOV, overlay imediato com "Copiar link para VLC" e "Fechar".

### Fora de escopo

- Transcoding (MKV→MP4/HLS).
- Mudanças em backend / Edge Functions.
- Mudanças em filmes/canais ao vivo (apenas séries por enquanto, conforme pedido).

