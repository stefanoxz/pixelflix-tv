# Diagnóstico de falhas de login com telemetria de rede do cliente

## Problema

Usuário relata travamento na tela de carregamento ao tentar login (M3U ou usuário/senha). Hoje a tabela `login_events` registra apenas `success/reason/server_url/username/ip/user_agent` — **não há registro quando o cliente nunca recebe resposta** (timeout/abort no lado do navegador) e **não temos contexto de rede** (provedor, velocidade, latência, geo).

## Solução

Coletar telemetria do cliente em **toda tentativa de login** (sucesso, erro, ou timeout/abort) e expor no painel admin.

---

## 1) Banco — nova tabela `client_diagnostics`

Migração para criar tabela ligada (opcionalmente) a um `login_events.id`:

```sql
create table public.client_diagnostics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  login_event_id uuid null references public.login_events(id) on delete set null,
  username text null,
  server_url text null,
  outcome text not null,            -- 'success' | 'fail' | 'timeout' | 'abort'
  client_error text null,           -- mensagem do catch no front (timeout, network, etc.)
  duration_ms integer null,         -- tempo do fetch até resposta/erro
  -- Rede / dispositivo
  ip text null,                     -- coletado server-side (x-forwarded-for)
  user_agent text null,
  effective_type text null,         -- 4g, 3g, wifi (Network Information API)
  downlink_mbps numeric null,       -- Mbps estimado pelo navegador
  rtt_ms integer null,              -- RTT estimado pelo navegador
  save_data boolean null,
  device_memory numeric null,       -- GB (Device Memory API)
  hardware_concurrency integer null,
  screen text null,                 -- "1920x1080"
  language text null,
  timezone text null,
  -- Geo (lookup no servidor pelo IP, opcional)
  country text null,
  region text null,
  city text null,
  isp text null,
  -- Speedtest leve opcional (ms, KB/s)
  speed_kbps integer null
);

alter table public.client_diagnostics enable row level security;

create policy "Admins read diagnostics"
  on public.client_diagnostics for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create index client_diagnostics_created_at_idx
  on public.client_diagnostics (created_at desc);
create index client_diagnostics_outcome_idx
  on public.client_diagnostics (outcome);
```

Sem políticas de INSERT — escrita só via Service Role na edge function (igual `login_events`).

---

## 2) Edge function nova: `client-diagnostic` (público, `verify_jwt = false`)

`supabase/functions/client-diagnostic/index.ts`:
- Aceita POST com payload JSON (campos opcionais, validados com Zod).
- Lê `x-forwarded-for` para `ip`.
- Faz lookup gratuito de geolocalização (ex.: `https://ipapi.co/{ip}/json/` com timeout 2s, best-effort — se falhar, grava só o IP).
- Insere com Service Role em `client_diagnostics`.
- Retorna `{ ok: true, id }`.
- CORS igual ao `iptv-login` (lista de sufixos permitidos).

Adicionar bloco em `supabase/config.toml`:
```toml
[functions.client-diagnostic]
verify_jwt = false
```

---

## 3) Frontend — capturar e enviar diagnóstico

### 3.1 Helper `src/lib/clientDiagnostics.ts`
- `collectClientDiagnostic()` — lê de forma segura: `navigator.connection.{effectiveType,downlink,rtt,saveData}`, `navigator.deviceMemory`, `navigator.hardwareConcurrency`, `screen`, `navigator.language`, `Intl.DateTimeFormat().resolvedOptions().timeZone`, `navigator.userAgent`.
- `runQuickSpeedProbe(timeoutMs = 3000)` — opcional, baixa um arquivo pequeno (ex.: `/favicon.ico` com cache-buster) e mede KB/s. Não bloqueia o login (executa em paralelo, com timeout curto).
- `reportDiagnostic(payload)` — envia via `supabase.functions.invoke("client-diagnostic", { body: payload })` com `keepalive` no fetch para sobreviver à navegação. **Best-effort**: nunca lança, nunca atrasa o login.

### 3.2 Integração em `src/services/iptv.ts`
Nas funções `loginM3uRegister` e `loginXtream` (e onde mais houver chamada a `iptv-login`):
1. Marcar `t0 = performance.now()`.
2. Disparar `runQuickSpeedProbe()` em paralelo (não aguardar).
3. Após retorno do `invoke` (ou catch):
   - Calcular `duration_ms`.
   - Determinar `outcome`: `success` / `fail` / `timeout` / `abort` (baseado no error code/mensagem).
   - Aguardar com timeout o resultado da speed probe.
   - Chamar `reportDiagnostic({...client diag, outcome, server_url, username, client_error, duration_ms, speed_kbps})`.

Observação: nada disso pode quebrar o login. Tudo dentro de try/catch silencioso.

### 3.3 (Opcional) Watchdog na tela de login
Em `src/pages/Login.tsx`: se o login estiver "carregando" há mais de 12s, dispara automaticamente um `reportDiagnostic({ outcome: 'timeout', client_error: 'frontend watchdog' })` e mostra ao usuário a opção "Enviar diagnóstico ao admin".

---

## 4) Painel admin — nova aba "Diagnóstico de clientes"

`src/components/admin/ClientDiagnosticsPanel.tsx` + nova entrada em `src/pages/Admin.tsx`:

- Tab `client-diagnostics`, label **"Diagnóstico de clientes"**.
- Action nova em `supabase/functions/admin-api/index.ts`: `client_diagnostics_list` que retorna últimos N registros (default 200) com filtros: `outcome`, `since` (1h/24h/7d), `username`, `server_url`.
- UI:
  - **Cards-resumo** no topo: total tentativas (24h), % timeout, % sucesso, latência média, downlink médio.
  - **Tabela** com: data/hora, usuário, servidor, outcome (badge colorido), duração, provedor (ISP), país/cidade, tipo de conexão (4g/wifi), downlink Mbps, RTT, speed_kbps, navegador (extraído do UA), botão **"Ver detalhes"** abrindo dialog com JSON completo.
  - Filtros no topo (select de outcome, input de username/server, range de tempo).
  - Auto-refresh a cada 15s quando a tab estiver ativa.

---

## 5) Itens NÃO alterados

- Player, stream-proxy, stream-token, stream-event.
- Lógica de fallback HLS↔MPEG-TS, aprendizado por host.
- Autenticação Supabase Auth, RLS existente.
- Tabela `login_events` (continua igual).

---

## Resultado esperado

- Toda tentativa de login (incluindo as que travam no carregamento) gera um registro com IP, ISP, país, tipo de conexão, velocidade estimada e duração.
- Admin vê em uma nova aba quem tentou, de onde, com qual qualidade de internet, e qual foi o desfecho.
- Permite identificar se o problema é (a) DNS/servidor, (b) bloqueio de operadora do amigo, (c) internet lenta/instável, ou (d) timeout do edge runtime.
