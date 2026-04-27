## Análise nova do painel admin

### Lacunas funcionais reais que encontrei

**1. 🔥 Eventos de stream invisíveis no painel**
A tabela `stream_events` tem **8 tipos de evento** sendo gravados, mas **só `user_report` é exposto na UI**. Em 7 dias temos:

| Tipo | Volume 7d | O que é | Exposto? |
|---|---|---|---|
| `token_issued` | 243 | Token de stream emitido | ❌ |
| `token_rejected` | 237 | Token forjado/expirado bloqueado | ❌ **(crítico — sinal de ataque)** |
| `segment_request` | 124 | Segmento HLS servido | ❌ |
| `stream_error` | 85 | Player falhou (real ou debounce) | ❌ |
| `stream_started` | 47 | Reprodução começou | ❌ |
| `nonce_replay_tolerated` | 39 | Anti-replay aceitou (latência) | ❌ |
| `user_report` | 7 | Reporte manual | ✅ |
| `session_evicted` | 1 | Sessão derrubada | ❌ |

**Por que importa:** 237 `token_rejected` em 7 dias é alto demais. Pode ser bug do cliente ou tentativa de pirataria do stream (alguém tentando usar tokens vazados). Sem visualização, ninguém percebe. Os 85 `stream_error` mostram quais hosts/conteúdos estão quebrando — daria pra destacar antes do usuário reportar.

**2. ⚠️ Reportes de usuário sem workflow de resolução**
A coluna `meta->>'status'` existe mas todos os 7 reportes estão com status `null`. Não há botão "marcar como resolvido / ignorar / em análise" no `UserReportsPanel`. O admin lê e esquece — sem rastro do que foi tratado.

**3. ⚠️ Bloqueio manual de usuário ainda sem UI**
Confirmei via SQL: `user_blocks` está vazia (0 bloqueios já existiram). O painel só tem botão "Desbloquear" (que nunca aparece, porque nunca há bloqueio). **Não existe "Bloquear usuário X por Y horas"** em nenhum lugar do painel.

**4. ⚠️ Servidores marcados como `unreachable_until` sem visibilidade**
A tabela `allowed_servers` tem coluna `unreachable_until` (servidor em quarentena automática) e `consecutive_failures`. Hoje 0 servidores estão em quarentena, mas se algum entrar, o admin não vê isso na lista de DNS — só vê o estado "atual" via ping manual. Deveria mostrar "🚫 Em quarentena até HH:MM (N falhas seguidas)" e ter botão "Limpar quarentena".

**5. ⚪ Tela em branco no Dashboard quando há `pending` servers**
O dashboard avisa "X servidores tentaram logar e foram bloqueados" e leva pra aba Servers — mas a aba Servers (admin-only) **não existe pra moderador**, então moderador vê o aviso e clica em vazio. Pequeno bug de UX.

**6. ⚪ Cache TMDB nunca limpo**
`tmdb_image_cache` (37 linhas) e `tmdb_episode_cache` (18 linhas) crescem sem limite e sem TTL. Tabelas de cache deveriam estar na aba Manutenção pra limpeza manual e mostrar idade.

### O que está OK (sem necessidade de mudança)
- Aba Manutenção (recém-criada) cobre as 5 tabelas operacionais.
- Aba Detalhe de usuário cobre histórico individual.
- Estatísticas (DAU/MAU, heatmap, top conteúdo) já existem.
- Endpoint test, Diagnóstico de clientes, Audit log, Equipe — completos.

---

## Plano

Vou implementar as **3 mais impactantes** (#1, #2, #4). Os itens #3, #5, #6 deixo pra um próximo turno se você quiser — eles são menores.

### 1) Nova aba "Stream / Segurança"
Painel novo (`StreamEventsPanel.tsx`) com 4 cards no topo + 3 listas:

- **Cards 24h**: Streams iniciados • Tokens emitidos • **Tokens rejeitados** (destacado se > 0) • Erros de player
- **Lista "Tokens rejeitados"** — quando aparecer, mostra IP + UA hash + motivo (nonce inválido, expirado, replay). Filtro por janela (1h/24h/7d).
- **Lista "Erros de player"** — agrupa por host + tipo de erro (`stream_no_data`, `bootstrap_timeout_12s`, etc), com contagem e último ocorrido. Filtro pra ocultar `player_switch_debounced` (ruído).
- **Lista "Replays tolerados"** — contagem por hora, alerta se passar de threshold (sinal de problema de rede ou ataque).

Backend nova ação: `stream_events_overview` no `admin-api`.

### 2) Workflow de resolução em reportes
- Adicionar botões "Marcar como resolvido" / "Ignorar" / "Reabrir" no `UserReportsPanel`.
- Filtro por status (Aberto / Resolvido / Ignorado / Todos), default = Aberto.
- Backend: nova ação `update_report_status` que dá `UPDATE stream_events SET meta = jsonb_set(meta, '{status}', '"resolved"')` por id.
- Auditoria automática (admin_audit_log).

### 3) Quarentena visível no painel de DNS
- No card de cada DNS na aba "DNS / Servidores", mostrar badge "🚫 Em quarentena até HH:MM" + tooltip explicando "{N} falhas consecutivas detectadas".
- Botão "Limpar quarentena" (admin-only) que reseta `unreachable_until = null` e `consecutive_failures = 0`.
- Backend: nova ação `clear_server_quarantine`.
- `list_servers` já retorna `consecutive_failures` e `unreachable_until` — só falta usar.

### Detalhes técnicos
- `stream_events_overview` retorna: contadores agregados 24h, top hosts com erro, lista de token_rejected + nonce_replay (últimas 50, mascarando IP), série temporal por hora.
- `update_report_status` aceita `id` e `status` ∈ {open, resolved, ignored, investigating}, faz UPDATE em `stream_events.meta` via service-role (RLS bloqueia anon).
- `clear_server_quarantine` aceita `server_url`, atualiza `allowed_servers` via service-role, registra audit log.
- Adicionar `Shield` (ou `ShieldAlert`) no `adminNav.ts` como ícone da aba Stream.
- Aba Stream visível pra admin **e** moderador (igual Reportes).
- Atualização automática a cada 30s (igual aos outros painéis em tempo real).

### O que fica de fora
- Item #3 (UI de bloqueio manual de usuário) — esbarra no debate de rate-limit. Pode ser próximo passo.
- Item #5 (esconder aviso "Pendentes" pra moderador) — um if simples, mas pequeno.
- Item #6 (TMDB cache na Manutenção) — vou estender a Manutenção pra incluir, é trivial.

Confirma essas 3 + extensão da Manutenção pra incluir TMDB cache?
