

## O que falta antes de subir pra VPS

Já está OK: admin protegido por role no backend, RLS em `allowed_servers` / `login_events` / `user_roles`, conta admin criada. Mas tem **3 bloqueadores reais** e **3 melhorias fortemente recomendadas**.

### BLOQUEADORES (resolver antes de subir)

#### 1. `iptv-categories` aceita qualquer servidor (sem allowlist)
**Risco:** atacante usa sua função como **proxy aberto** pra qualquer Xtream API no mundo. Banda sua, IP seu queimando, possível abuso pra ataques DDoS contra terceiros.

**Fix:** validar `server` contra `allowed_servers` na própria função, igual `iptv-login` já faz.

#### 2. `stream-proxy` é proxy 100% aberto
**Risco crítico:** qualquer um descobre sua URL e usa pra proxiar **qualquer URL da internet** — vídeos pirata, sites bloqueados, ataques. Sua VPS vira intermediário em tudo.

**Fix:** validar que o host de destino bate com algum servidor da `allowed_servers`. Bloqueia IPs internos (`127.0.0.1`, `10.x`, `192.168.x`, `169.254.x`) pra evitar SSRF contra a própria infra.

#### 3. Rate limiting no `iptv-login`
**Risco:** brute-force trivial nas credenciais IPTV dos usuários. Sem limite, dá pra testar milhares de senhas/min.

**Fix:** tabela `login_rate_limit (ip, window_start, attempts)` + bloqueio simples (ex: 10 tentativas/min por IP, 20/min por usuário). Reaproveita o cliente admin já existente.

### RECOMENDADAS (não bloqueia mas é bom resolver)

#### 4. Credenciais IPTV em localStorage (XSS surface)
Hoje `IptvContext` salva `username/password/server` em texto puro no `localStorage`. Se um dia entrar XSS, vaza tudo. Refactor médio (cookie HttpOnly + tabela de sessões + endpoint de troca). **Sugestão:** marcar como tarefa pra primeira semana, não bloquear deploy.

#### 5. CORS aberto (`*`) em todas as edge functions
Em produção, restringir o `Access-Control-Allow-Origin` ao domínio da VPS. Hoje qualquer site pode chamar suas funções a partir do navegador. Não é catastrófico (rate limit + allowlist mitigam), mas é higiene básica.

**Fix:** `ALLOWED_ORIGIN` como secret + helper `corsFor(req)` nas 4 funções.

#### 6. Leaked Password Protection (HIBP)
Hoje senha mínima do admin é 6 caracteres e aceita "123456". Ativar HIBP check pelo Cloud bloqueia senhas vazadas.

### Detalhes técnicos das mudanças

```text
supabase/functions/iptv-categories/index.ts
  + carregar allowed_servers (service role)
  + validar normalizeServer(server) ∈ allowedList
  + 403 NO_ACCESS_MSG se não autorizado

supabase/functions/stream-proxy/index.ts
  + carregar allowed_servers (service role, com cache 60s em memória)
  + extrair host de decoded.url, comparar com hostKey de cada allowed
  + bloquear ranges privados (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7)
  + 403 se host não autorizado

supabase/functions/iptv-login/index.ts
  + checar rate limit antes de tudo
  + tabela nova: login_rate_limit
      ip text, window_start timestamptz, attempts int
      RLS: nenhuma policy (só service role acessa)

supabase/config.toml
  (sem mudança — já estão com verify_jwt = false e é necessário)
```

### O que NÃO vou mexer agora

- Migrar login do IPTV pra Supabase Auth (refactor enorme, fora do escopo).
- UI pra gerenciar admins (continua via SQL).
- Trocar localStorage por cookie HttpOnly (item 4 — fica pra depois do deploy).

### Plano de ação que recomendo

**Antes de subir** (1 sessão de trabalho):
- Itens 1, 2, 3 (bloqueadores) + item 5 (CORS).

**Primeiro dia no ar:**
- Item 6 (HIBP — botão no Cloud, 30 segundos).

**Primeira semana:**
- Item 4 (cookie HttpOnly).

Confirma se quer que eu faça **tudo (1+2+3+5)** numa tacada só, ou só os 3 bloqueadores (1+2+3) e CORS depois?

