## Diagnóstico confirmado

O servidor **Black** (`http://bkpac.cc`) está retornando **"Connection refused" em 100% das tentativas (16x em 24h)** porque:

1. **Cadastrado como HTTP, mas o probing está tentando HTTPS** — o servidor recusa TCP na porta 443.
2. **Sem porta explícita** — provavelmente responde em `:80` ou `:8080`, não na default HTTPS.
3. **Cooldown não dispara** — `consecutive_failures = 0` mesmo após dezenas de falhas, então o sistema fica martelando o servidor indefinidamente.
4. **Erro de SNI no `assistz.top`** (`UnrecognisedName`) — não cai pra HTTP automaticamente.

---

## O que vai mudar

### 1. Respeitar o protocolo cadastrado (`iptv-login/index.ts`)
- Se admin cadastrou `http://`, **não promover para HTTPS** sem necessidade.
- HTTPS só é tentado se: (a) admin cadastrou `https://`, ou (b) HTTP falhou em todas as portas.
- Hoje fazemos o oposto e isso quebra provedores como `bkpac.cc`.

### 2. Ordem de probing mais inteligente
Para `http://bkpac.cc` (sem porta), **fase 1** vira:
```
http://bkpac.cc:80
http://bkpac.cc:8080
http://bkpac.cc       (default)
```
HTTPS e portas exóticas (2052/2082/2095/8880) só na **fase 2**, se fase 1 falhar 100%.

### 3. Corrigir o contador de cooldown
- Garantir que `consecutive_failures` **incrementa em TODOS os caminhos de erro** (refused, reset, timeout, 444, TLS).
- Hoje há um caminho onde o erro retorna sem atualizar a tabela — por isso o Black tem `failures = 0`.
- Após 5 falhas → cooldown progressivo (1, 2, 3, 5 min) já implementado, só precisa do incremento funcionar.

### 4. Tratar erro de SNI (TLS UnrecognisedName)
- Detectar `UnrecognisedName`, `certificate verify failed`, `SSL handshake` no catch.
- Quando ocorrer em HTTPS → tentar automaticamente HTTP no fallback.
- Classificar como bucket próprio "TLS/Certificate" no dashboard de erros.

### 5. Melhorar classificação no admin
Adicionar regex para distinguir:
- `Connection refused` (porta fechada / serviço offline)
- `Reset by peer` (UA bloqueado / firewall ativo)
- `Connection timeout` / `i/o timeout`
- `TLS handshake fail` / `UnrecognisedName` / `certificate verify`
- `No route to host` (DNS resolveu mas roteamento falha)
- `HTTP 404` / `HTTP 444` (separados)

### 6. Mensagem de erro mais clara para o usuário final
Quando o admin abrir o card do Black, em vez de só "Connection refused", mostrar:
> "Servidor recusou conexão na porta 443 (HTTPS). Verifique se o cadastro deve ser HTTP ou se há porta específica (ex: `:8080`)."

---

## Detalhes técnicos

**Arquivo `supabase/functions/iptv-login/index.ts`**
- Refatorar `buildVariants(serverBase, phase)` para preservar o esquema (`http`/`https`) original do cadastro.
- Adicionar função `classifyError(rawMessage)` que retorna bucket + mensagem amigável.
- Garantir que `await supabase.from('allowed_servers').update({ consecutive_failures: failures + 1, unreachable_until: ... })` é chamado em **todos** os `catch` antes do `return`.
- Adicionar 4s timeout via `AbortSignal.timeout(4000)` em todas as variantes (já existe, validar).

**Arquivo `src/pages/Admin.tsx`**
- Adicionar buckets novos no `DnsErrorTrendChart`: `tls_error`, `no_route`, `connection_refused` (separado de `reset`), `timeout`.
- Mostrar dica contextual no card de cada provedor com erro recorrente (ex: sugerir trocar protocolo).

**Migração SQL**
- Não precisa de schema change. Apenas um UPDATE pontual para resetar o estado do Black:
  ```sql
  UPDATE allowed_servers 
  SET consecutive_failures = 0, unreachable_until = NULL, last_working_variant = NULL 
  WHERE label = 'BLACK';
  ```

**Backend de logs**
- Edge function `admin-api`: estender o switch de buckets de classificação (já existe a estrutura).

---

## O que vai acontecer com o Black depois disso

1. Próximo login tenta `http://bkpac.cc:80` primeiro (não `https`).
2. Se funcionar → salva em `last_working_variant`, próximas conexões vão direto para essa URL.
3. Se falhar → tenta `:8080`, `:443` https etc.
4. Após 5 falhas reais → cooldown de 1 min, dashboard mostra "Em cooldown" em vez de spam de erros.

---

## Arquivos que serão modificados

- `supabase/functions/iptv-login/index.ts` (lógica de probing + classificação + contador)
- `supabase/functions/admin-api/index.ts` (novos buckets de classificação)
- `src/pages/Admin.tsx` (novos buckets na UI + dica contextual)
- `src/components/admin/DnsErrorTrendChart.tsx` (cores/labels dos novos buckets)
- 1 migração SQL para resetar estado do Black

Sem mudanças em UI de usuário final, sem mudanças em login, sem mudanças em outros provedores que estão funcionando.