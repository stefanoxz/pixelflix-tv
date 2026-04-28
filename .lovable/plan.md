## Parte 1 — Edição de senha (admin e equipe)

Adicionar capacidade do admin trocar a senha de qualquer membro da equipe (incluindo a própria), via painel **Equipe e permissões**.

### Backend (`supabase/functions/admin-api/index.ts`)

Nova action `set_team_password` (somente admin — entra em `ADMIN_ONLY_ACTIONS`):
- Payload: `{ user_id: string, new_password: string }`.
- Valida senha (mín. 8 caracteres).
- Se `user_id === user.id` → admin trocando a própria senha (permitido).
- Se for outro membro: confirma que o alvo está em `user_roles` (admin ou moderator). Não permite trocar senha de usuário que não é da equipe.
- Trava: não permite trocar senha do **último admin** se quem está trocando não é o próprio (evita lockout acidental).
- Usa `admin.auth.admin.updateUserById(targetId, { password })` (service role).
- Registra em `admin_audit_log` (action `set_team_password`, sem gravar a senha — só `user_id` e email do alvo).

### Frontend

**`src/lib/adminApi.ts`** — adicionar helper `setTeamPassword(userId, newPassword)`.

**`src/components/admin/TeamPanel.tsx`**:
- Novo ícone `KeyRound` ao lado do botão de remover, em cada linha da equipe (inclusive na própria conta).
- Ao clicar abre `Dialog` com:
  - Campo "Nova senha" (type=password, mín. 8).
  - Campo "Confirmar nova senha".
  - Aviso destacado quando o alvo é outro membro: *"O usuário precisará usar essa senha no próximo login. Comunique-o por canal seguro."*
  - Quando é a própria conta: copy adaptada *"Trocar minha senha"*.
- Botão confirma → chama `setTeamPassword`, exibe toast, fecha dialog.
- Sem mostrar/ler a senha antiga (admin opera com privilégio total via service role).

### Observação de segurança
Apenas admins veem/usam essa ação. Moderadores não conseguem (gate `ADMIN_ONLY_ACTIONS` + UI escondida via `useAdminRole().isAdmin`).

---

## Parte 2 — O que o cargo **Moderador** acessa hoje

Levantamento real do código (RLS + `admin-api`):

### Pode VER (leitura)
- Dashboard, estatísticas, gráficos (DAU/MAU, heatmap, top conteúdo).
- Lista de usuários ativos, sessões ao vivo, eventos de stream.
- Login events (tentativas de login no IPTV).
- Diagnóstico de cliente (rede, ISP, geolocalização).
- Reports de problema enviados pelos usuários.
- Lista de servidores liberados (`allowed_servers`) — só leitura.
- Lista de DNS bloqueados (`blocked_dns_servers`) — só leitura.
- Cadastros pendentes de admin (`pending_admin_signups`).
- Equipe e papéis (lê `user_roles`).
- Watch progress de qualquer usuário.

### Pode FAZER (escrita operacional)
- **Encerrar sessão ao vivo** de um usuário (`evict_session`).
- **Aplicar bloqueio temporário** em `user_blocks` (INSERT permitido por RLS).
- Atualizar status de reports (`update_report_status`).

### NÃO pode (restrito a admin — `ADMIN_ONLY_ACTIONS`)
- Liberar/remover servidor (`allow_server`, `remove_server`, `clear_server_quarantine`).
- Aprovar/rejeitar cadastros pendentes (`approve_signup`, `reject_signup`).
- Desbloquear usuários permanentemente (`unblock_user`).
- Gerenciar a equipe: adicionar, remover, mudar papel (`add/update/remove_team_member`).
- Ler audit log (`list_audit_log`).
- Limpar tabelas / despejar sessões em massa (`cleanup_table`, `evict_idle_now`).
- Criar/editar/confirmar/dispensar/reativar DNS bloqueados (todas as ações `blocked_dns_*` de escrita).
- **Trocar senha de membros** (nova ação desta entrega — fica admin-only).

### Resumo curto pra UI
> **Moderador** = leitura completa do painel + ações operacionais rápidas (encerrar sessão, bloqueio temporário, atualizar reports). Tudo que altera infra (DNS, servidores), governança (equipe, aprovações) ou histórico de auditoria continua exclusivo do admin.

---

## Arquivos alterados

- `supabase/functions/admin-api/index.ts` — nova action `set_team_password`.
- `src/lib/adminApi.ts` — helper `setTeamPassword`.
- `src/components/admin/TeamPanel.tsx` — botão + dialog de troca de senha.
