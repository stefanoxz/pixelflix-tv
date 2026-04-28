## Ação 4 — Recomendação automática + email pronto no relatório

Hoje o relatório copiável traz diagnóstico técnico, mas o admin/revendedor ainda precisa **interpretar** e **redigir manualmente** o que cobrar do fornecedor. Vou adicionar uma seção final pronta-pra-colar com:

1. **Veredito de ação** (1 linha): o que fazer agora
2. **Para quem reclamar**: fornecedor do painel, revenda, ou usuário final
3. **Email/mensagem pronta** em português, adaptado ao tipo de bloqueio detectado
4. **Aviso interno pros revendedores** quando o servidor é incompatível com apps web

Tudo gerado a partir do que o sistema já detecta (`detectBlockKind`, `buildComparisonVerdict`). Zero mudança no backend.

### Como vai aparecer no relatório (.txt e copiar)

Adicionado **depois** do "VEREDITO COMPARATIVO" atual, uma nova seção:

```text
───────────────────────────────────────────────────────
RECOMENDAÇÃO AUTOMÁTICA
───────────────────────────────────────────────────────

Ação sugerida    : Contatar fornecedor do painel para liberar whitelist
Responsável      : Dono/admin do painel bkpac.cc
Prioridade       : Alta — painel inacessível para todos os usuários web
Aviso revendas   : ⚠️ Este servidor NÃO funciona em apps web (datacenter blocked).
                   Recomende aos revendedores que o substituam ou aguardem
                   liberação do whitelist antes de cadastrar novos clientes.

─── MENSAGEM PRONTA PARA O FORNECEDOR ───

Olá,

Identificamos que o servidor http://bkpac.cc está bloqueando ativamente
conexões originadas de IPs de datacenter/cloud, mas aceita conexões de
IPs residenciais brasileiros normalmente.

Evidência técnica:
  • Backend (cloud): TCP RST imediato em ~219ms na porta 80
  • Navegador residencial: pacote completo aceito em ~224ms na mesma porta
  • Demais portas (443, 2052, 2082, 2095, 8080, 8880): fechadas

Isso impede que o painel funcione em qualquer aplicativo web hospedado
em nuvem (Vercel, AWS, Cloudflare, Supabase, etc.).

Solicitamos uma das opções:
  1. Adicionar nosso range de IPs à whitelist do firewall
  2. Desativar a regra anti-datacenter para o endpoint /player_api.php
  3. Confirmar se há um endpoint/proxy alternativo para integrações

Relatório técnico completo em anexo.

Atenciosamente,
[Seu nome]
═══════════════════════════════════════════════════════
```

### Como o sistema decide o conteúdo

A função nova `buildRecommendation(backend, client)` retorna `{action, target, priority, resellerWarning, message}` baseado em:

| Cenário detectado | Ação sugerida | Para quem | Tem email? |
|---|---|---|---|
| `🎯 Bloqueio anti-datacenter confirmado` | Pedir whitelist do range cloud | Fornecedor do painel | Sim, com latência comparativa |
| `waf_block` / `ddos_protection` (CF Challenge) | Desativar challenge no /player_api.php | Fornecedor do painel | Sim |
| `ip_block_403` / `ip_block_404_nginx` unânime | Whitelist de IP | Fornecedor | Sim |
| `geoblock` unânime | Liberar país do datacenter | Fornecedor | Sim |
| `rate_limit` unânime | Aumentar limite por IP | Fornecedor | Sim |
| `suspended` unânime | Hospedagem caiu, migrar URL | Revenda (não tem como o cliente resolver) | Mensagem interna |
| `expired_account` unânime | Renovar assinatura | Usuário final / revenda | Mensagem ao usuário |
| `xtream_invalid_creds` unânime | Conferir login/senha | Usuário final | Mensagem ao usuário |
| `dns_error` unânime | Domínio expirado/removido | Fornecedor (provavelmente offline definitivo) | Mensagem informativa |
| `default_landing` unânime | DNS apontando errado | Fornecedor | Sim |
| `xtream_ok` em alguma variante | Usar URL correta detectada | Nenhum — é só configurar | Sem email |
| Qualquer outro / misto | "Diagnóstico inconclusivo, ver detalhamento" | — | Sem email |

### UI no diálogo

Acima dos botões "Copiar relatório" / "Baixar .txt", aparece um **card destacado** com:

- Ícone + título da ação (ex: "🎯 Pedir whitelist ao fornecedor")
- Linha resumo (1 frase)
- Botão **"Copiar mensagem para fornecedor"** que copia só o email pronto (sem o relatório técnico) — útil quando o admin quer mandar pelo WhatsApp/Telegram do dono do painel
- Aviso laranja se `resellerWarning` existir (alertando pra não cadastrar mais clientes nesse painel)

O card só aparece quando há recomendação acionável (não aparece pra `xtream_ok`).

### Detalhes técnicos

- Tudo client-side em `src/components/admin/ServerProbeDialog.tsx` — sem migração, sem edge function nova
- Nova função pura `buildRecommendation(d: ProbeResponse, c: ClientProbeResult | null)` retornando `RecommendationResult | null`
- Email template usa `serverLabel`, `serverUrl`, latências do backend e (se disponível) do client probe — tudo já no estado do componente
- `handleCopyReport` e `handleDownloadReport` passam a anexar a seção "RECOMENDAÇÃO AUTOMÁTICA" quando aplicável
- Novo handler `handleCopyMessageOnly` pra copiar só o email
- Pra `🎯 Bloqueio anti-datacenter confirmado` o template usa as latências reais (`backend.results[0].latency_ms` vs `client.attempts[0].latency_ms`) pra dar evidência concreta no email

### Fora do escopo (para próximas iterações)

- Buscar IP de saída do backend dinamicamente para incluir no email (Ação D da conversa anterior — pode ser separada)
- Salvar histórico (Ação 3) — escopo separado
- Marcar servidor como bloqueado na tabela (Ação 2) — escopo separado