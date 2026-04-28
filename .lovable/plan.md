# Top consumidores — mostrar usuário + DNS

## Problema

Hoje o card "Top consumidores (24h)" exibe só o início do `anon_user_id` (hash tipo `68155558`), sem contexto de quem é nem de qual servidor. O ideal: **usuário IPTV + DNS que ele está usando**, com a quantidade de requests/segmentos.

## O que vou mudar

### 1. `supabase/functions/admin-api/index.ts` — devolver server_url junto

Na ação `admin_bundle` (linha 271-276), além do `iptv_username` já buscado em `active_sessions`, também buscar `server_url` do mesmo registro. Resolver pra `host` (só o domínio, sem `https://` nem path) e injetar em cada item de `top_consumers`.

```ts
const { data: sess } = await admin
  .from("active_sessions")
  .select("anon_user_id, iptv_username, server_url")
  .in("anon_user_id", ids);
// Mapas separados pra nome e host
// Item final: { anon_user_id, iptv_username, server_host, requests, segments }
```

### 2. `src/pages/Admin.tsx` — atualizar tipo + renderização

- **Tipo `TopConsumer`** (linha 169-174): adicionar `server_host: string`.
- **Card "Top consumidores"** (linha 1041-1048): trocar a renderização de uma linha só para 2 linhas, igual o card "Bloqueios ativos" ao lado:
  - **Linha 1 (forte):** nome IPTV (ou hash de fallback)
  - **Linha 2 (muted, menor):** `host • N req • M seg`

```tsx
{topConsumers.map((c) => (
  <div key={c.anon_user_id} className="flex items-center justify-between py-2 text-sm gap-2">
    <div className="min-w-0 flex-1">
      <p className="font-medium truncate">
        {c.iptv_username || `${c.anon_user_id.slice(0, 8)}…`}
      </p>
      <p className="text-xs text-muted-foreground truncate">
        {c.server_host || "servidor desconhecido"}
      </p>
    </div>
    <span className="text-xs text-muted-foreground shrink-0">
      {c.requests} req • {c.segments} seg
    </span>
  </div>
))}
```

## Edge cases tratados

- **Sem nome IPTV:** continua caindo no hash (`68155558…`) como antes.
- **Sem sessão ativa** (usuário consumiu mas já saiu): `server_host` vira `""`, mostra "servidor desconhecido" em muted.
- **`server_url` mal formado:** `try/catch` no `new URL(...)`, fallback pra string crua.

## Arquivos afetados

- `supabase/functions/admin-api/index.ts` (montagem de `top_consumers`)
- `src/pages/Admin.tsx` (tipo `TopConsumer` + render do card)

## Resultado esperado

Em vez de:
```
68155558
aeb9de9c
68155558
```

Vai aparecer algo como:
```
joao_silva                          320 req • 1.2k seg
servidor1.exemplo.com

maria_p                             180 req • 540 seg
provedor2.com.br
```
