## O que será adicionado

Hoje a aba **Monitoramento** mostra apenas "usuário X está com player aberto há Y minutos", sem indicar **o que** ele está assistindo. Vamos enriquecer essa visão com o conteúdo atual (canal/filme/série), o tempo no mesmo conteúdo, e uma rotina automática que **encerra sessões inativas após 1 hora**.

### 1. Capturar o que o usuário está assistindo

Adicionar 4 colunas opcionais na tabela `active_sessions`:

- `content_kind` (`live` | `movie` | `episode` | `idle`)
- `content_title` (texto, ex: "Globo SP HD" ou "Vingadores")
- `content_id` (texto, id IPTV do stream)
- `content_started_at` (timestamp de quando trocou para esse conteúdo)

O campo `idle` representa "webplayer aberto sem reproduzir nada".

### 2. Frontend — enviar o conteúdo no heartbeat

No `Player.tsx`, o evento `session_heartbeat` já dispara a cada poucos segundos. Vamos incluir no `meta`:

```ts
{ content_kind, content_title, content_id }
```

E na página/contexto que abre o player (Live/Movies/Series), quando o usuário **fecha** o player ou volta ao menu, dispara um heartbeat com `content_kind: "idle"` para indicar "está logado mas não assistindo".

### 3. Backend — `stream-event` grava o conteúdo

A edge function `stream-event` (caminho rápido do heartbeat) passa a também atualizar `content_kind`, `content_title`, `content_id` em `active_sessions`. Se o conteúdo mudou em relação ao último heartbeat, atualiza `content_started_at = now()` (assim conseguimos mostrar "assistindo há X min").

### 4. Backend — `admin-api` retorna o conteúdo

Em `monitoring_overview` e no `bundle`, o campo `active_sessions` passa a expor:

```ts
{
  iptv_username, ip_masked, started_at, last_seen_at,
  content_kind, content_title, content_id, content_started_at
}
```

### 5. UI — Painel "Sessões ativas" enriquecido

Na tabela atual (`Admin.tsx`, "Sessões ativas") trocamos o layout para incluir uma coluna **"Assistindo"**:

```text
Usuário IPTV | IP | Assistindo                          | Há      | Online há | Ação
joaosp       | 1… | 🔴 Globo SP HD (live)               | 12 min  | 1h05      | Encerrar
maria        | 2… | 🎬 Vingadores: Ultimato (movie)     | 47 min  | 47 min    | Encerrar
pedro        | 3… | 💤 Webplayer ocioso                  | 8 min   | 22 min    | Encerrar
```

Ícones: 🔴 live, 🎬 movie, 📺 episode, 💤 idle.

### 6. Auto-kick por inatividade (1 hora)

Critério de "inativo": `content_kind = 'idle'` **OU** `last_seen_at` indica heartbeat parado, e a condição se mantém por **60 minutos** ininterruptos.

Implementação:

- Nova função RPC `evict_idle_sessions()` (security definer) que apaga linhas de `active_sessions` onde:
  - `content_kind = 'idle'` E `content_started_at < now() - interval '60 min'`, **ou**
  - `last_seen_at < now() - interval '60 min'` (sessão zumbi)
- Cron job via `pg_cron` rodando a cada 5 minutos chamando essa função.
- O frontend já reage à perda de sessão via heartbeat retornando "session not found" (já é o fluxo existente de eviction manual), então nada muda no cliente.

### 7. Configuração ajustável (opcional, default 60 min)

Adicionar uma key em uma tabela leve `app_settings(key, value)` (ou usar uma constante na função RPC). Para manter simples no MVP: **constante de 60 min na função RPC**, e botão futuro no admin para alterar.

---

## Detalhes técnicos

**Migração SQL (schema):**
```sql
ALTER TABLE public.active_sessions
  ADD COLUMN content_kind text,
  ADD COLUMN content_title text,
  ADD COLUMN content_id text,
  ADD COLUMN content_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.evict_idle_sessions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE removed integer;
BEGIN
  WITH del AS (
    DELETE FROM public.active_sessions
    WHERE last_seen_at < now() - interval '60 minutes'
       OR (content_kind = 'idle' AND content_started_at < now() - interval '60 minutes')
    RETURNING 1
  )
  SELECT count(*) INTO removed FROM del;
  RETURN removed;
END $$;
```

**Cron** (via insert tool, não migration — contém URL/anon key específicos):
```sql
select cron.schedule('evict-idle-sessions','*/5 * * * *', $$
  select public.evict_idle_sessions();
$$);
```
(Usa chamada SQL direta, não precisa de `pg_net` nem edge function.)

**Edge `stream-event`** — no branch do heartbeat:
```ts
const meta = body.meta ?? {};
const kind = typeof meta.content_kind === 'string' ? meta.content_kind : null;
const title = typeof meta.content_title === 'string' ? meta.content_title.slice(0,200) : null;
const cid = typeof meta.content_id === 'string' ? meta.content_id.slice(0,80) : null;

// Lê o conteúdo atual pra detectar mudança
const { data: cur } = await admin.from('active_sessions')
  .select('content_id, content_kind').eq('anon_user_id', userId).maybeSingle();

const changed = !cur || cur.content_id !== cid || cur.content_kind !== kind;
await admin.from('active_sessions').update({
  last_seen_at: new Date().toISOString(),
  ip, ua_hash: await uaHash(ua),
  content_kind: kind, content_title: title, content_id: cid,
  ...(changed ? { content_started_at: new Date().toISOString() } : {}),
}).eq('anon_user_id', userId);
```

**Player.tsx** — passa `title`, `contentKind`, `streamId` (já existem como props) no meta de cada heartbeat. E disparar um heartbeat `idle` no cleanup do `useEffect` quando o player desmonta.

**Admin.tsx** — atualizar `MonitoringSession` interface + tabela.

---

## Arquivos afetados

- **Nova migração SQL** — colunas + função `evict_idle_sessions`
- **Insert SQL** (cron) — `cron.schedule`
- `supabase/functions/stream-event/index.ts` — gravar conteúdo no heartbeat
- `supabase/functions/admin-api/index.ts` — retornar campos novos
- `src/components/Player.tsx` — incluir conteúdo nos heartbeats + idle no unmount
- `src/pages/Admin.tsx` — nova coluna "Assistindo" + duração no conteúdo
- `src/integrations/supabase/types.ts` — auto-regenerado

---

## Garantias

- **Não quebra nada existente:** colunas novas são nullable, heartbeat continua funcionando se `meta` vier sem os campos.
- **Privacidade:** título do conteúdo já é visível ao admin (mesma sensibilidade do username IPTV).
- **Custo:** zero — usa heartbeats que já acontecem; cron roda 12x/h com uma query leve.
- **Auto-kick:** 60 min é fixo no MVP; fácil ajustar depois.
