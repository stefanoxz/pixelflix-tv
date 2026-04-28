# Corrigir heartbeat — Top 10 funcionar de verdade

## Diagnóstico

O ranking "Top 10 conteúdos" lê `active_sessions` filtrando `content_kind <> 'idle'` e `content_title IS NOT NULL`. Hoje **nenhuma linha** chega nesse filtro, mesmo havendo 38 reproduções/dia. Causas confirmadas no código:

1. **`stream-token` cria a linha sem o conteúdo.** O upsert em `supabase/functions/stream-token/index.ts` (linha 326) grava `iptv_username`, `ip`, `server_url` e `last_seen_at`, mas **não envia `content_kind`/`content_title`/`content_id`**. Resultado: linha existe com esses campos `null`.

2. **O primeiro heartbeat com conteúdo só sai depois de 45s.** Em `src/components/Player.tsx` linha 946, o `setInterval` de heartbeat (`HEARTBEAT_INTERVAL_MS = 45_000`) é registrado mas o `setInterval` **só dispara após o primeiro intervalo**, nunca imediatamente. Se o usuário fica menos de 45s no player, a linha nunca recebe `content_kind`.

3. **O cleanup do `useEffect` reescreve para `idle`.** Linha 1745-1750: ao desmontar o Player, é enviado `meta: { content_kind: "idle", content_title: null, content_id: null }`. Como o backend (`stream-event/index.ts` linha 117) aceita `idle` na lista de kinds permitidos e grava — toda sessão termina como `idle`, apagando o conteúdo que estava sendo assistido.

4. **Bonus:** o backend só faz `update` (linha 149 do `stream-event`). Se a linha não existir (ex.: `evict_idle_sessions` rodou no meio), o update afeta 0 rows e o heartbeat se perde silenciosamente.

## O que vou mudar

### 1. `src/components/Player.tsx` — disparar heartbeat imediato com conteúdo

Logo após o `setInterval` ser registrado (linha 946-948), disparar **um heartbeat imediato** com `buildContentMeta()`. Assim, segundos após o play começar, a linha já fica com `content_kind="movie"/"episode"/"live"` e o título preenchido — não dependemos mais dos 45s.

```ts
// Heartbeat imediato (popula content_kind/title já no primeiro segundo)
reportStreamEvent("session_heartbeat", { url: src ?? undefined, meta: buildContentMeta() });
// Renovações a cada 45s
heartbeatRef.current = window.setInterval(() => {
  reportStreamEvent("session_heartbeat", { url: src ?? undefined, meta: buildContentMeta() });
}, HEARTBEAT_INTERVAL_MS);
```

### 2. `src/components/Player.tsx` — não apagar conteúdo no unmount

O cleanup atual (linha 1745-1750) sobrescreve o conteúdo com `idle` toda vez que o player desmonta. Isso destrói qualquer chance de calcular tempo total assistido depois. Remover esse heartbeat de "idle".

A sessão continua sendo limpa naturalmente: `evict_idle_sessions` apaga sessões sem heartbeat há mais de 60min, e `stream-token` só recria a linha se o usuário voltar a dar play. Nada quebra no painel "ativos agora" — sem heartbeat novo, a sessão simplesmente expira.

```ts
useEffect(() => () => {
  teardown();
  // (removido o heartbeat 'idle' — preserva o último conteúdo assistido
  // para o ranking e métricas históricas)
}, []);
```

### 3. `supabase/functions/stream-event/index.ts` — usar upsert em vez de update

Trocar o `.update(...)` da linha 149 por `.upsert(..., { onConflict: "anon_user_id" })`, garantindo que mesmo se a linha tiver sido evicted ou ainda não criada pelo `stream-token`, o heartbeat não some no vazio. Inclui `anon_user_id` no payload do upsert.

### 4. `supabase/functions/admin-api/index.ts` — refinar a query do Top 10

Pequeno ajuste na query do `stats_top_content` (linha 1933): hoje filtra `.neq("content_kind", "idle")`. Vou trocar por `.in("content_kind", ["live", "movie", "episode"])`, deixando explícito quais kinds contam, e mantém `.not("content_title", "is", null)`. Mesmo efeito prático, mas mais claro e blindado contra valores inesperados.

### 5. (Opcional) `supabase/functions/stream-token/index.ts` — não sobrescrever conteúdo no upsert

O upsert do `stream-token` não envia `content_kind`, então **não** vai sobrescrever os campos preenchidos pelo heartbeat (Postgres mantém os valores antigos quando a coluna não está no payload). Não preciso mudar nada aqui — só registrar essa garantia.

## Resultado esperado

- Logo nos primeiros segundos de qualquer reprodução, `active_sessions` passa a ter `content_kind` (movie/episode/live) + `content_title` preenchidos.
- O painel "Top 10 conteúdos" começa a mostrar dados a partir das próximas reproduções.
- O painel "ativos agora" continua funcionando igual — usuários ociosos somem por inatividade (60min sem heartbeat), não por marcação manual `idle`.
- Histórico de tempo assistido por título passa a ser confiável, abrindo caminho para outras métricas no futuro.

## Arquivos afetados

- `src/components/Player.tsx` (heartbeat imediato + remover cleanup `idle`)
- `supabase/functions/stream-event/index.ts` (update → upsert)
- `supabase/functions/admin-api/index.ts` (filtro mais explícito no top_content)

## Observação importante

As 4 sessões `idle` que estão hoje no banco vão continuar lá até serem evicted (60min). O fix começa a popular dados **a partir das próximas reproduções**. Se quiser, depois de aprovar e deploy, posso também limpar as linhas `idle` órfãs.
