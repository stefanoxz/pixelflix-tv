## Reset completo de DNS + remover cooldown

Você vai recadastrar todas as DNS do zero. Vou apagar tudo relacionado a DNS/sessões/telemetria e remover o cooldown automático no mesmo passo.

### O que SERÁ apagado (reset total)

| Tabela | Linhas | O que é |
|---|---|---|
| `allowed_servers` | 3 | Todas as DNS cadastradas (autorizadas). Após isso o admin fica vazio. |
| `login_events` | 154 | Histórico completo de tentativas de login (sucesso + falha + DNS não autorizadas). |
| `stream_events` | 380 | Telemetria do player (play, frag_load_error, stream_no_data etc). |
| `active_sessions` | 16 | Presença de usuários online. |
| `usage_counters` | 21 | Contadores de rate-limit por usuário. |
| `used_nonces` | 127 | Cache de nonces consumidos pelo stream-token. |
| `user_blocks` | 0 | Já está vazia (nada a fazer). |

**Não apagado:** `user_roles` (mantém seu acesso de admin) e `auth.users` (sua conta de login no painel continua).

### Efeito imediato no app

- Qualquer usuário M3U logado vai cair no próximo refresh com erro de DNS não autorizada (esperado — a allowlist está vazia).
- Você entra em `/admin`, cadastra as DNS novas e elas começam a funcionar imediatamente.
- Dashboard de erros, sessões e telemetria zerados.

### Remoção do cooldown automático

**`supabase/functions/iptv-login/index.ts`** — alterações cirúrgicas:

1. Remover constantes `COOLDOWN_THRESHOLD = 5` e `COOLDOWN_STEPS_MS`.
2. Remover função `cooldownMs()`.
3. Em `attemptLogin()`: remover bloco que checa `serverRow.unreachable_until` e retorna `cooldown ativo até ...` (linhas 378–390).
4. Em `markServerFailure()`: manter incremento de `consecutive_failures` (estatística), remover trecho que seta `unreachable_until`.
5. Em `markServerHealthy()`: manter `unreachable_until: null` como limpeza defensiva.
6. Ajustar comentários ("Em cooldown: NÃO loga" etc).

Resultado: nenhuma DNS recém-cadastrada vai entrar em "cooldown ativo até..." novamente, independente de quantas falhas tiver.

### Trade-off (já aceito por você)

Sem cooldown, servidores realmente offline serão martelados a cada login e poluirão `login_events`. Em troca, BLACK e qualquer DNS nova nunca mais ficam travadas por X minutos.

### O que NÃO muda

- Schema do banco (coluna `unreachable_until` permanece, só não é mais escrita).
- Login/auth/RLS/admin/UI.
- Edge functions de stream (`stream-proxy`, `stream-token`, `stream-event`).
- Lógica de probing de variantes (HTTP/HTTPS, portas, cache de `last_working_variant`).
- `Player.tsx` e auto-fallback de proxy por host.

### Ordem de execução

1. Migração SQL `TRUNCATE` em `allowed_servers`, `login_events`, `stream_events`, `active_sessions`, `usage_counters`, `used_nonces`.
2. Edição de `supabase/functions/iptv-login/index.ts` (deploy automático).
3. Você abre `/admin` → cadastra as DNS novas → testa login.
