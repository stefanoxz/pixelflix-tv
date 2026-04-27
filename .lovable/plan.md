## Análise do painel admin (estado atual)

### O que já existe e está funcionando
O painel tem **11 abas** todas plugadas a 30 ações na `admin-api`:

| Aba | Status | Ações backend |
|---|---|---|
| Dashboard | OK | `dashboard_bundle` |
| Estatísticas | OK | `stats_logins_daily`, `stats_dau_mau`, `stats_peak_heatmap`, `stats_top_content` |
| Monitoramento | OK | `monitoring_overview`, `top_consumers`, `evict_session`, `unblock_user` |
| Reportes | OK | `list_user_reports`, `count_user_reports_24h` |
| Erros por DNS | OK | `dns_errors` (com séries temporais) |
| Usuários | OK | `list_users` |
| DNS / Servidores | OK | `list_servers`, `allow_server`, `remove_server` |
| Testar endpoint | OK | `test_endpoint`, `resolve_endpoint` |
| Diagnóstico de clientes | OK | `client_diagnostics_list` |
| Novos cadastros | OK | `list_pending_signups`, `approve_signup`, `reject_signup` |
| Equipe + Audit log | OK | `list_team`, `add/update/remove_team_member`, `list_audit_log` |

Sondagem manual (`probe_server`) também existe via `ServerProbeDialog`.

**Conclusão:** nenhuma ação está órfã, nenhuma aba está apontando pra endpoint inexistente, nenhum painel está faltando ser montado. O backend e o frontend estão alinhados 1:1.

### Lacunas reais que encontrei

**1. Brecha de segurança ativa (mais crítica):**
- IP `201.71.212.47` fez **118 logins falhos em 24h** sem sofrer nenhuma consequência.
- IP `201.71.212.32` fez 26 falhas. Outros 5 IPs com 1–9 falhas.
- O painel **mostra** "Top IPs com mais rejeições" no Monitoramento, mas **não tem botão pra bloquear o IP dali**. Só dá pra desbloquear `anon_user_id` (perfil), não IP.
- Não existe rate-limit por IP no `iptv-login`.

**2. Bloqueio manual de usuários sem ferramenta:**
- A tabela `user_blocks` aceita inserts via RLS (admin/moderador), mas **não há UI** pra criar bloqueio manual. Só dá pra desbloquear o que já existe.
- Sem um campo "bloquear este IP/usuário por X horas com motivo Y".

**3. Limpeza de dados antigos invisível:**
- Existem 5 funções `cleanup_*` (login_events, stream_events, used_nonces, audit_log, client_diagnostics) e `evict_idle_sessions`, mas **nenhuma roda em cron** e **não há botão no admin** pra disparar manualmente.
- Risco: tabelas crescem sem fim. Hoje o banco está pequeno, mas em 6 meses pode pesar.

**4. Detalhe do usuário muito raso:**
- A aba "Usuários" mostra só último login + total. Não dá pra clicar num usuário e ver: histórico completo de logins, sessões, conteúdos assistidos, IPs usados, reports relacionados.

**5. Secret morto:**
- `IPTV_PROXY_URL` está configurado mas inerte (Cloudflare proxy foi removido). Polui a lista de secrets.

### Pequenos bugs / polimentos
- `setEvents`, `setUsers` etc são populados mas a aba **Usuários** não tem indicador "última vez que veio do servidor X" (a coluna existe no tipo mas não é exibida com timezone correto em alguns lugares).
- Console mostra warning `Unknown message type: RESET_BLANK_CHECK` (vem do iframe do Lovable, não é do código — ignorar).
- Nenhum erro real nos logs do `admin-api`.

---

## Plano proposto

Implementar em **3 frentes**, em ordem de impacto:

### Frente 1 — Segurança (alta prioridade)
1. **Rate-limit por IP no `iptv-login`**: depois de 20 falhas em 1h vindas do mesmo IP, bloqueia esse IP por 15min (resposta 429). Tabela nova `ip_blocks` (separada de `user_blocks` que é por anon_user_id).
2. **Botão "Bloquear este IP" no Monitoramento**, na seção "Top IPs com mais rejeições". Abre dialog: motivo + duração (1h / 6h / 24h / 7d). Insere em `ip_blocks`.
3. **Lista de IPs bloqueados** no Monitoramento, com botão Desbloquear.
4. **Limpar agora os 2 IPs já abusivos** (`201.71.212.47` e `.32`) com bloqueio inicial de 24h via migration.

### Frente 2 — Manutenção (média)
5. **Aba nova "Manutenção"** (admin-only) com:
   - Botões "Limpar logs antigos" pra cada tabela (mostra quantas linhas serão removidas antes).
   - Botão "Encerrar sessões ociosas agora" (`evict_idle_sessions`).
   - Status de cada tabela: tamanho, linhas, linha mais antiga.
6. **Apagar o secret inerte `IPTV_PROXY_URL`** (apenas remoção, não muda código).

### Frente 3 — UX (baixa, opcional)
7. **Detalhe de usuário**: clicar no usuário na aba "Usuários" abre dialog com timeline completa (logins, sessões ativas, watch_progress, reports). Reusa ações já existentes filtradas por username.

### Detalhes técnicos
- Nova migration cria `ip_blocks (ip text, blocked_until, reason, created_at, created_by)` com RLS (admin/moderador).
- Nova ação no `admin-api`: `block_ip`, `unblock_ip`, `list_blocked_ips`, `cleanup_table` (parametrizada por nome de tabela permitida), `user_detail`.
- `iptv-login` consulta `ip_blocks` antes de processar e aplica contador in-memory (bucket de 1h) pra disparar bloqueio automático.
- Tudo registrado em `admin_audit_log`.

### O que fica de fora deste plano
- Rotação automática de logs por cron (`pg_cron`) — fica como follow-up; por enquanto botão manual basta.
- ESLint cleanup dos 20 warnings — cosmético, não muda comportamento.

Quer que eu execute as 3 frentes ou prefere só a Frente 1 (segurança) primeiro?
