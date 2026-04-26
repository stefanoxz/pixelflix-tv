## Objetivo

Implementar três blocos no Painel Admin:

1. **Gestão de papéis (admins/moderadores)**
2. **Estatísticas históricas** (gráficos de uso ao longo do tempo)
3. **Polimento geral** da UX

---

## 1. Gestão de papéis

Nova aba **"Equipe / Permissões"** na sidebar (ícone `ShieldCheck`).

**O que mostra:**
- Lista de todos os usuários com papel (`admin` ou `moderator`), com e-mail, data de criação do papel e indicador "você" ao lado da própria conta.
- Botão **"Adicionar membro"** → abre dialog para colar e-mail + escolher papel. Se o e-mail ainda não tem conta, sistema envia magic link/convite e cria papel pendente quando ele se cadastrar.
- Por linha: trocar papel (admin ↔ moderador) e **revogar acesso** (com confirm dialog).

**Diferença entre os papéis:**
- `admin`: acesso total (igual hoje).
- `moderator`: leitura de todas as abas + ações de moderação (banir/kickar usuário, aprovar cadastro), mas **não** pode mexer em DNS/servidores nem gerenciar outros admins.

**Travas de segurança:**
- Não permitir que o último admin se rebaixe ou se remova (validação no backend).
- Admin não pode rebaixar a si mesmo se for o único.
- Toda ação grava em **audit log** (ver abaixo).

### Mudanças técnicas

- Adicionar `'moderator'` ao enum `app_role` (migration).
- Nova tabela `admin_audit_log`: `id, actor_user_id, actor_email, action, target_user_id, target_email, metadata jsonb, created_at`. RLS: só admins leem; inserts via edge function com service role.
- Novas ações na edge function `admin-api`:
  - `list_team` — junta `user_roles` com e-mail (via `auth.admin.getUserById`).
  - `add_team_member` — `{ email, role }` cria papel (e convite se não existir conta).
  - `update_team_role` — `{ user_id, role }`.
  - `remove_team_member` — `{ user_id }`.
  - `list_audit_log` — paginação por cursor.
- RLS de tabelas existentes: ajustar para aceitar `moderator` onde fizer sentido (ex.: `active_sessions` SELECT, `user_blocks` ALL exceto delete permanente).

### Arquivos a criar/editar
- Migration: enum `moderator` + tabela `admin_audit_log` + ajustes de RLS.
- `supabase/functions/admin-api/index.ts` — novas actions + helper `logAudit()`.
- `src/components/admin/TeamPanel.tsx` (novo).
- `src/components/admin/AuditLogPanel.tsx` (novo, dentro da aba Equipe como sub-seção ou modal "Ver histórico").
- `src/pages/Admin.tsx` — registrar a aba.

---

## 2. Estatísticas históricas

Nova aba **"Estatísticas"** na sidebar (ícone `BarChart3`).

**Conteúdo (4 cards de gráficos):**

1. **Logins por dia** (últimos 30 dias) — barras empilhadas: sucesso vs falha. Fonte: `login_events`.
2. **Usuários ativos diários (DAU)** + **mensais (MAU)** — linha. Fonte: `active_sessions` agregado por dia.
3. **Horário de pico** — heatmap dia da semana × hora (últimos 7 dias). Fonte: `active_sessions.last_seen_at`.
4. **Top 10 conteúdos assistidos** — lista com tempo total. Fonte: `active_sessions.content_title` somando `duration_s`.

**Filtros:** seletor de período (7d / 30d / 90d) no topo.

**Botão "Exportar CSV"** ao lado de cada card → gera CSV com os dados brutos da janela atual.

### Mudanças técnicas
- Novas actions na `admin-api`:
  - `stats_logins_daily({ days })`
  - `stats_dau_mau({ days })`
  - `stats_peak_heatmap({ days })`
  - `stats_top_content({ days, limit })`
- Reuso do `recharts` já presente no projeto.

### Arquivos a criar/editar
- `src/components/admin/StatsPanel.tsx` (novo) com sub-componentes para cada gráfico.
- `src/pages/Admin.tsx` — registrar aba.
- `supabase/functions/admin-api/index.ts` — 4 actions novas.

---

## 3. Polimento geral

Aplicar tudo isso de uma vez:

### Sidebar e navegação
- **Sidebar mobile:** trocar a lista vertical longa por **menu hambúrguer** com `Sheet` (shadcn) — em telas <lg, header mostra logo + ícone de menu; ao tocar abre drawer com as abas.
- **Header sticky:** título + botões "Atualizar/Sair" ficam fixos no topo da área principal (com fundo blur).
- **Badges nas abas com pendência:**
  - "Reportes" → contador de reportes não resolvidos das últimas 24h.
  - "Novos cadastros" → contador de pendentes.
  - "Erros por DNS" → bolinha vermelha se há servidor offline.
- **Indicador "online agora"** discreto na sidebar (pulse verde + número), atualizado a cada 10s.

### Estado e feedback
- **"Atualizado há Xs"** ao lado do botão Atualizar (com tick a cada segundo).
- **Estado vazio** com ilustração + dica nas tabelas vazias (Reportes, Diagnóstico, Estatísticas, Equipe).
- **Confirm dialog** em todas as ações destrutivas que ainda vão direto: remover DNS, kickar sessão, rejeitar reporte.

### Ajustes finos
- Padding consistente entre cards (hoje varia entre `p-5` e `p-6`).
- Tooltip explicando o critério de cada métrica do dashboard (já existe em alguns lugares — espalhar).
- Atalho `Ctrl/Cmd+K` opcional → command palette para pular entre abas (usando `cmdk` se já estiver, senão fica para outro momento).

---

## Ordem de implementação

1. Migration (enum `moderator` + tabela `admin_audit_log`) e RLS.
2. Edge function `admin-api`: novas actions de equipe + estatísticas + audit.
3. `TeamPanel` + `AuditLogPanel` + aba na sidebar.
4. `StatsPanel` + aba na sidebar.
5. Polimento (sidebar mobile, header sticky, badges, "atualizado há X", confirms, estados vazios).

---

## Resumo técnico

**Banco:**
```sql
-- Adicionar 'moderator' ao enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'moderator';

-- Audit log
CREATE TABLE admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_email text,
  action text NOT NULL,
  target_user_id uuid,
  target_email text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON admin_audit_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));
```

**Frontend:** dois novos painéis + ajustes em `Admin.tsx` (sidebar + header).

**Edge function:** ~10 novas actions, todas com `requireAdmin()` (e algumas com `requireAdminOrModerator()`).

Tudo respeita RLS via `has_role()` + service role no backend para escritas sensíveis (criar papel, convidar usuário).
