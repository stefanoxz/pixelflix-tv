# Correções no painel admin

Após a análise, agrupei as correções por prioridade. Tudo é em código existente — sem novas tabelas nem novas dependências.

---

## 1. Crítico — moderador não consegue entrar no painel

Hoje o backend aceita `admin` ou `moderator`, mas o front ainda só deixa entrar `admin`. Resultado: o papel "moderador" criado na rodada anterior está inativo.

**Arquivos:**
- `src/components/AdminProtectedRoute.tsx` — verificar `admin` **OU** `moderator` (chamar `has_role` para os dois e liberar se qualquer um for verdadeiro). Manter o fluxo "pendente" só quando nenhum dos dois retornar true.
- `src/pages/AdminLogin.tsx` — após login, redirecionar para `/admin` quando o usuário tiver qualquer um dos dois papéis. Mensagem de erro continua a mesma quando não tiver nenhum.

**Bonus:** expor o papel atual via um hook simples (`useAdminRole`) para os componentes saberem se quem está olhando é admin ou moderador — isso é a base do item 2.

---

## 2. Crítico — UI mostra controles que moderador não pode usar

Mesmo após corrigir o item 1, moderador veria botões "Adicionar DNS", "Remover DNS", "Aprovar cadastro", aba "Equipe e permissões" etc., e tomaria 401 ao clicar.

**Arquivos:**
- `src/pages/Admin.tsx` — usar o hook `useAdminRole`:
  - Esconder a aba **"Equipe e permissões"** para moderador.
  - Esconder a aba **"Novos cadastros"** para moderador (aprovar/recusar é admin-only).
  - Em **"DNS / Servidores"**: esconder botões "Adicionar DNS", "Remover", "Editar" e o ícone de lixeira; manter visualização e ping.
- `src/components/admin/PendingSignupsPanel.tsx` — se entrar mesmo assim, mostrar mensagem de "somente admin".
- `src/components/admin/TeamPanel.tsx` — idem (defesa em profundidade — backend já bloqueia).

**Faixa visual no header:** mostrar um badge sutil "Moderador" ao lado do título quando o papel não for admin, para o usuário entender por que algumas opções somem.

---

## 3. Métrica enviesada — Top 10 conteúdos

`stats_top_content` usa `last_seen_at - started_at` (duração da sessão inteira), o que infla o tempo quando o usuário abriu o app antes de tocar no conteúdo.

**Arquivo:** `supabase/functions/admin-api/index.ts` (action `stats_top_content`)
- Trocar para `last_seen_at - content_started_at`, com fallback para `started_at` se `content_started_at` estiver nulo.
- Descartar entradas com duração > 12h (sessões zumbis ou heartbeat travado).

---

## 4. Heatmap em horário local

Hoje usa UTC, então pico real às 21h aparece à meia-noite para um usuário BR.

**Arquivo:** `src/components/admin/StatsPanel.tsx`
- O backend já devolve o grid em UTC. Deslocar no front pelo offset local (`new Date().getTimezoneOffset()`) — rotaciona a coluna da hora; muito mais simples que mudar o backend.
- Atualizar legenda para "horário local".

---

## 5. Convite via e-mail funciona só até 200 contas

`add_team_member` chama `listUsers({ perPage: 200 })`. Se a base passar disso, pessoas existentes são tratadas como novas e recebem convite duplicado.

**Arquivo:** `supabase/functions/admin-api/index.ts` (action `add_team_member`)
- Paginar o `listUsers` em loop (até 5 páginas / 1000 contas) parando quando achar o e-mail.
- Quando ainda não encontrar, seguir para o convite como hoje.

---

## 6. Polimento — confirmações destrutivas

Substituir os `confirm()` nativos por `AlertDialog` (mesma biblioteca já usada no `TeamPanel`).

**Arquivos:**
- `src/pages/Admin.tsx` — `removeServer`, `unblockUser`, `evictSession`.
- Já fica consistente com a remoção de membro da equipe.

---

## Detalhes técnicos resumidos

```text
front:
  AdminProtectedRoute  →  has_role(admin) || has_role(moderator)
  AdminLogin           →  redireciona se for admin OU moderator
  hooks/useAdminRole   →  novo hook exporta { role, isAdmin, isModerator, loading }
  Admin.tsx            →  filtra abas + esconde CTAs admin-only
  StatsPanel           →  rotaciona heatmap por offset local
  AlertDialog          →  troca confirm() em ações destrutivas

backend (admin-api):
  stats_top_content    →  duração = last_seen_at - COALESCE(content_started_at, started_at)
                          descarta > 12h
  add_team_member      →  paginação até 5 páginas no listUsers
```

Sem migrations novas — só código de função/edge.

---

## O que NÃO entra nesta rodada

- Notas/label do servidor no log de auditoria (item menor, dá para incluir se quiser).
- Botão "Sair" duplicado no header (cosmético).
- Mostrar `notes`/`label` no `AuditLogPanel` (decisão sua).

Se quiser eu já adiciono esses três no escopo, é só dizer.
