## Objetivo

Criar área **"DNS bloqueados"** no admin pra catalogar servidores com bloqueio anti-datacenter (tipo `bkpac.cc`). Inclui **detecção automática conservadora** que sugere candidatos, mas **nada entra na lista oficial sem você confirmar**.

## Fluxo geral

```text
iptv-login falha → classifica erro → se padrão anti-datacenter:
  ↓
incrementa contador no servidor
  ↓
atingiu 5 falhas em 24h de 2+ IPs distintos?
  ↓ sim
cria/atualiza entrada com status = 'suggested'
  ↓
você revisa em "DNS bloqueados → Sugestões"
  ↓
[Confirmar] → vira 'confirmed'   |   [Descartar] → vira 'dismissed' (some pra sempre)
```

## 1. Banco de dados

**Nova tabela `blocked_dns_servers`:**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `server_url` | text UNIQUE | normalizado via `normalize_server_url()` |
| `label` | text | nome amigável (ex: "Black") |
| `provider_name` | text | nome da revenda/fornecedor |
| `block_type` | text | `anti_datacenter`, `geoblock`, `waf`, `dns_error`, `outro` |
| `status` | text | `suggested`, `confirmed`, `dismissed` |
| `notes` | text | observações livres |
| `evidence` | jsonb | último relatório de probe + amostra de falhas |
| `failure_count` | int | total de falhas detectadas |
| `distinct_ip_count` | int | IPs únicos que viram a falha |
| `first_detected_at` | timestamptz | |
| `last_detected_at` | timestamptz | |
| `confirmed_at` | timestamptz | quando você clicou confirmar |
| `dismissed_at` | timestamptz | quando você descartou |
| `created_at`, `updated_at` | timestamptz | |

**Tabela auxiliar `blocked_dns_failures`** (rolling window de 24h pra contar falhas):

| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `server_url` | text |
| `error_kind` | text (`reset`, `timeout`, etc.) |
| `ip_hash` | text (hash do IP, não o IP cru — privacidade) |
| `created_at` | timestamptz |

Função de cleanup `cleanup_blocked_dns_failures()` que apaga registros > 48h (segue padrão das outras `cleanup_*`).

**RLS:** admins ALL, moderadores SELECT.

## 2. Detecção automática no `iptv-login`

Adiciona helper `recordPotentialBlock(serverUrl, errorKind, ipHash)`:

1. Insere linha em `blocked_dns_failures`
2. Conta falhas dos últimos 24h pro `server_url`
3. Se `count >= 5` E `distinct(ip_hash) >= 2`:
   - Verifica se já existe em `blocked_dns_servers`
   - Se existe e status = `dismissed` → **não faz nada** (descarte permanente)
   - Se existe e status = `confirmed` → só atualiza contadores
   - Se existe e status = `suggested` → atualiza `failure_count`, `last_detected_at`
   - Se não existe → cria com `status='suggested'`, preenche `evidence` com amostra dos últimos erros

Chamado **só** quando o erro for classificado como `reset` ou `timeout` em **todas** as variantes testadas (padrão anti-datacenter — não dispara em 401, 5xx genérico ou DNS error puro).

## 3. UI — `BlockedDnsPanel.tsx`

Layout em **abas**:

**🔔 Sugestões** (badge com contador)
- Lista de candidatos detectados automaticamente
- Cada linha mostra: URL, falhas (X em Yh), IPs distintos, último erro, evidência
- Ações: `[Confirmar bloqueio]` (abre dialog pra preencher label/fornecedor) | `[Descartar permanentemente]` (com confirmação tipo "Tem certeza? Esse DNS nunca mais será sugerido.")

**✅ Confirmados**
- Lista oficial de DNS bloqueados
- Filtro/busca por label ou URL
- Editar label, fornecedor, notas
- Remover (volta a poder ser sugerido se voltar a falhar)

**🚫 Descartados** (collapsed por padrão)
- Pra você ver o que descartou e poder **reativar** se mudou de ideia
- Botão `[Reativar]` move de volta pra sugestões

**Botão "Adicionar manualmente"** no topo (caso queira catalogar sem esperar detecção).

## 4. Atalho no `ServerProbeDialog`

Quando o veredito atual for `anti-datacenter`, mostra:
> **📌 Catalogar como DNS bloqueado** → abre dialog pré-preenchido com URL, `block_type='anti_datacenter'`, `evidence` do probe, status já vai direto pra `confirmed`.

## 5. Endpoints no `admin-api`

- `GET /admin/blocked-dns?status=suggested|confirmed|dismissed`
- `POST /admin/blocked-dns` (criação manual ou via probe)
- `PATCH /admin/blocked-dns/:id` (editar campos / mudar status)
- `DELETE /admin/blocked-dns/:id`

Todos exigem role `admin`.

## 6. Item no menu

`adminNav.ts`:
```ts
{ id: "blocked-dns", label: "DNS bloqueados", shortLabel: "Bloq.", icon: Ban, adminOnly: true }
```

Badge com contador de sugestões pendentes aparece ao lado do label quando > 0.

## Arquivos afetados

**Criar:**
- `supabase/migrations/<ts>_blocked_dns_servers.sql` — 2 tabelas + RLS + função cleanup
- `src/components/admin/BlockedDnsPanel.tsx` — painel com abas
- `src/components/admin/BlockedDnsDialog.tsx` — criar/editar/confirmar

**Editar:**
- `src/components/admin/adminNav.ts` — novo item
- `src/pages/Admin.tsx` — registrar seção
- `src/lib/adminApi.ts` — funções list/create/update/delete/dismiss/confirm
- `supabase/functions/admin-api/index.ts` — 4 endpoints novos
- `supabase/functions/iptv-login/index.ts` — chamar `recordPotentialBlock` nos pontos de falha apropriados
- `src/components/admin/ServerProbeDialog.tsx` — botão "Catalogar"
- `src/components/admin/MaintenancePanel.tsx` — adicionar `cleanup_blocked_dns_failures` na lista de jobs (segue padrão)

## O que continua NÃO sendo feito

- Nenhum proxy / Worker / VPS
- Nenhum fallback automático no fluxo do usuário final
- DNS bloqueado **não** impede login automaticamente — usuários afetados continuam vendo o erro normal (decisão sua: se quiser bloquear o login pra esses servidores no futuro, é só ligar uma flag na lista)
