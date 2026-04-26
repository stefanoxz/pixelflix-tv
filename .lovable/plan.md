## Resposta curta

**Hoje não existe.** O player não salva onde você parou e não pergunta se quer continuar. A única automação parecida é o autoplay do próximo episódio em séries.

## O que vou implementar

1. **Salvar progresso automaticamente** enquanto você assiste a filmes e episódios (não faz sentido em canais ao vivo).
2. **Perguntar "Continuar de X:XX?"** ao reabrir um filme/episódio que você não terminou, com opção de **Continuar** ou **Começar do início**.
3. **Marcar como assistido** quando o vídeo chega ao fim (ou >95% do tempo) — assim some o prompt e o item não fica eternamente "em andamento".
4. **Indicador visual** (barra de progresso fina embaixo do poster) nos cards de filmes/episódios já iniciados, igual à estética do app.

Tudo armazenado **localmente no navegador** (mesmo padrão dos favoritos, escopado por usuário IPTV). Nada vai pro servidor — é privado e não consome backend.

## Como vai funcionar (UX)

- Você abre um filme → clica em **Assistir** → começa do início. O player salva sua posição a cada ~5s.
- Você fecha o player no meio → posição fica gravada.
- Mais tarde, abre o mesmo filme → aparece um diálogo simples:
  > **Continuar de 23:14?**  
  > [Continuar]  [Começar do início]
- Mesmo fluxo para episódios de série (cada episódio com seu próprio progresso).
- Cards de filmes/episódios em andamento ganham uma barrinha vermelha embaixo do poster.

Regras:
- Só salva se assistiu mais de **30s** (evita lixo de cliques acidentais).
- Considera **terminado** acima de **95%** da duração → some da lista de "em andamento".
- Limite de **200 itens** salvos (descarta o mais antigo) pra não estourar o localStorage.

## Detalhes técnicos

**Novo hook `src/hooks/useWatchProgress.ts`**
- API: `getProgress(key)`, `saveProgress(key, currentTime, duration)`, `clearProgress(key)`, `listInProgress()`.
- Chave: `movie:<stream_id>` ou `episode:<id>`.
- Storage: `pixelflix:progress:<user>` → `Record<key, { t: number; d: number; updatedAt: number }>`.
- Mesmo padrão de `useFavorites` (escopo por `creds.username`).

**`src/components/Player.tsx`**
- Novas props opcionais: `progressKey?: string`, `initialTime?: number`, `onProgress?: (t, d) => void`.
- No `loadedmetadata`, se `initialTime > 0`, faz `video.currentTime = initialTime`.
- Listener `timeupdate` com throttle de 5s chamando `onProgress`.
- No evento `ended` (já existe `onEnded`), chama também `onProgress` com `t = duration` para marcar como concluído.

**Novo componente `src/components/ResumeDialog.tsx`**
- Dialog simples (shadcn) com título "Continuar assistindo?", tempo formatado (`mm:ss` ou `hh:mm:ss`), e dois botões.
- Usado dentro de `Movies.tsx` e `Series.tsx` antes de abrir o `PlayerOverlay`.

**`src/pages/Movies.tsx` e `src/pages/Series.tsx`**
- Antes de chamar `setPlaying(...)`/`setPlayingEp(...)`, consultar `getProgress`. Se houver progresso > 30s e < 95%, abrir `ResumeDialog`. Senão, tocar do início direto.
- Passar `progressKey` e `initialTime` para `<Player>`, e `onProgress` ligado a `saveProgress`.

**Indicador no card (`src/components/MediaCard.tsx`)**
- Nova prop opcional `progressPct?: number` (0-100). Quando definida, renderiza uma `<div>` de 3px embaixo do poster com largura `${progressPct}%` e cor primária.
- Em `Movies.tsx`/`Series.tsx`, ler `listInProgress()` uma vez no mount e mapear pct por `stream_id`.

**Sem mudanças de backend.** Sem migrações. Sem novas dependências.

## Arquivos afetados

- **novo**: `src/hooks/useWatchProgress.ts`
- **novo**: `src/components/ResumeDialog.tsx`
- **edit**: `src/components/Player.tsx` (props + listeners)
- **edit**: `src/components/MediaCard.tsx` (barra de progresso)
- **edit**: `src/pages/Movies.tsx` (integração)
- **edit**: `src/pages/Series.tsx` (integração, por episódio)

## Fora de escopo (posso fazer depois se quiser)

- Sincronizar progresso entre dispositivos via Lovable Cloud (exigiria tabela + RLS + login real).
- Página/seção dedicada "Continuar assistindo" na Home/Highlights.
- Progresso para canais ao vivo (não faz sentido).
