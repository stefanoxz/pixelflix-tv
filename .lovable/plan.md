## Objetivo

Eliminar os 36 warnings do linter sem quebrar nada — admins/mods continuam acessando, edge functions continuam funcionando, e o webplayer anônimo (visitantes do `signInAnonymously`) continua usando o app normalmente.

## Diagnóstico dos 36 warnings

| Grupo | Qtd | Tipo |
|---|---|---|
| A. Extensão no schema `public` | 1 | `pg_net` ou `pg_cron` instalada em `public` |
| B. Funções SECURITY DEFINER executáveis por `anon` | 9 | `cleanup_*`, `evict_idle_sessions`, `normalize_server_url`, etc. |
| C. Funções SECURITY DEFINER executáveis por `authenticated` | 9 | Mesmas funções acima — `has_role` precisa continuar |
| D. Políticas RLS aplicadas ao role `anon` (16 tabelas) | 16 | Todas as policies sem `TO authenticated` |
| E. `cron.job` / `cron.job_run_details` com policy para anon | 2 | Schema `cron` — **NÃO MEXER** (reservado) |

## O que vai mudar

### 1. Revogar EXECUTE de `anon` e `authenticated` nas funções de limpeza/manutenção

Funções afetadas (são chamadas apenas por edge functions com `service_role`, nunca pelo cliente):
- `cleanup_client_diagnostics`
- `cleanup_login_events`
- `cleanup_stream_events`
- `cleanup_used_nonces`
- `cleanup_admin_audit_log`
- `cleanup_tmdb_image_cache`
- `cleanup_tmdb_episode_cache`
- `cleanup_blocked_dns_failures`
- `evict_idle_sessions`

```sql
REVOKE EXECUTE ON FUNCTION public.cleanup_xxx() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.cleanup_xxx() TO service_role;
```

### 2. `has_role` — manter acessível a `authenticated` (é usada nas RLS policies)

A função `has_role` PRECISA continuar executável por `authenticated` porque é referenciada em todas as policies. Mas vamos revogar de `anon` e `public`:

```sql
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
-- authenticated mantém acesso (necessário para RLS)
```

### 3. `normalize_server_url` e `update_blocked_dns_updated_at`

- `normalize_server_url`: é IMMUTABLE, sem dados sensíveis, mas não há motivo para anon executar. Revogar de anon.
- `update_blocked_dns_updated_at`: é trigger function, não precisa de EXECUTE para ninguém além do owner.

### 4. `handle_new_admin_signup`

É trigger no `auth.users` — disparada pelo Postgres internamente. Revogar EXECUTE de anon/authenticated/public (mantém só para o owner que dispara o trigger).

### 5. Restringir todas as policies RLS ao role `authenticated`

Hoje as policies não especificam role explicitamente, então o linter as considera aplicáveis a `anon` também. Vamos recriar cada uma com `TO authenticated`.

Tabelas afetadas (14 tabelas em `public`):
`active_sessions`, `admin_audit_log`, `allowed_servers`, `blocked_dns_failures`, `blocked_dns_servers`, `client_diagnostics`, `login_events`, `pending_admin_signups`, `stream_events`, `usage_counters`, `user_blocks`, `user_roles`, `watch_progress`

**Importante sobre o webplayer anônimo**: Os visitantes do webplayer fazem `signInAnonymously()` — isso lhes dá uma sessão com role `authenticated` (não `anon`). Então `TO authenticated` continua cobrindo eles. ✅

### 6. Caches públicos do TMDB — manter público mas explícito

`tmdb_image_cache` e `tmdb_episode_cache` precisam continuar legíveis por todos (são usados antes do login). Vamos:
- Manter a policy SELECT pública
- O warning vai persistir nessas 2 tabelas, mas é **intencional** (decisão de produto, não falha)
- Vou marcar como `ignore` no painel de segurança com justificativa

### 7. Schema `cron` (warnings 20, 21)

NÃO TOCAR. É schema reservado do Supabase para `pg_cron`. Vou marcar como `ignore` com justificativa.

### 8. Extensão em public (warning 1)

É geralmente `pg_net`/`pg_cron` instaladas pela própria Lovable Cloud no `public`. Mover extensões existentes pode quebrar dependências. Vou marcar como `ignore` (informacional) — é prática padrão do Supabase managed.

## Resumo do impacto

| Após a migração | Resultado |
|---|---|
| Admins logados | Continuam acessando tudo via RLS ✅ |
| Moderators logados | Continuam acessando o que já podiam ✅ |
| Webplayer anônimo (`signInAnonymously`) | Continua funcionando — sessão é `authenticated` ✅ |
| Edge functions (service_role) | Continuam executando todas as funções ✅ |
| Visitantes 100% sem auth (anon puro) | Só leem `tmdb_*_cache` (intencional) ✅ |
| Warnings do linter | Cai de **36 → 3** (extensão + 2 cron, todos justificados) ✅ |

## Entregáveis

1. **1 migração SQL** (`supabase/migrations/...security_hardening.sql`):
   - REVOKE EXECUTE em 11 funções de anon/public
   - GRANT EXECUTE em cleanup_* para service_role
   - DROP + CREATE de ~30 policies adicionando `TO authenticated`

2. **3 findings marcadas como ignore** no painel de segurança (cron + extensão + tmdb_cache público) com justificativa.

3. **Sem mudanças em código TypeScript** — nenhuma chamada do cliente precisa mudar.

## Validação pós-deploy

- Rodar `supabase--linter` novamente (esperado: ~3 warnings restantes, todos justificados)
- Testar login admin no painel
- Testar webplayer anônimo (carregar home + abrir um vídeo)
- Verificar que edge function `iptv-login` continua gravando em `login_events`