# Ajustes no Player (4 itens)

## 1) Logs do player → só admin, com toggle

**Hoje:** o painel "Logs do player" (Causa / Método / Upstream / Motor / HLS-MPEG-TS-EXTERNO / tempos) aparece pra qualquer usuário, controlado por `localStorage["player.logsPanel.open"]`. O botão de abrir o painel fica nos controles do player (`Player.tsx` linhas 2291-2330).

**Mudança:**
- O botão de abrir o painel só renderiza se `useAdminRole()` retornar admin **E** o admin tiver ativado o toggle "Mostrar logs do player na minha sessão".
- Toggle novo na página `/admin` (no `MaintenancePanel.tsx` ou um cartão novo "Diagnóstico pessoal"): switch que grava `localStorage["admin.playerLogs.enabled"] = "1"`.
- Usuário comum: botão e painel **somem completamente** da UI. A coleta interna de logs continua funcionando (alimenta `stream_events` pra telemetria) — só o overlay deixa de aparecer.
- Limpa também `localStorage["player.logsPanel.open"]` na primeira carga em sessões não-admin (pra quem já tinha ativado antes).

**Arquivos:** `src/components/Player.tsx`, `src/components/admin/MaintenancePanel.tsx` (ou novo `AdminDiagnosticsToggle.tsx`), `src/pages/Admin.tsx`.

## 2) Auto-fallback HLS → MPEG-TS

**Hoje:** já existe um auto-switch (`engineAutoSwitchedRef` em `Player.tsx:366` e `:788-811`), mas **só dispara em canais ao vivo Xtream** e numa janela específica (após bootstrap_timeout). Pra filmes/séries não roda.

**Mudança (modo "primeira falha apenas"):**
- Generalizar o auto-switch pra qualquer kind (live + vod + series), **ainda guardado por `engineAutoSwitchedRef`** pra rodar no máximo uma vez por sessão de play.
- Triggers de fallback HLS→MPEG-TS:
  - Erro fatal de manifesto HLS (já capturado em `HLS.Events.ERROR` com `type === networkError` e `details === manifestLoadError/manifestParsingError`)
  - Stall longo (>20s sem frames novos — já existe `HLS_STALL_LIMIT_MS`)
  - Bootstrap timeout (já existe, 12s)
- Após troca pra MPEG-TS, se ele também falhar (já tem watchdog de 8s e fallback interno `.ts → .m3u8`), mostra erro definitivo "Não foi possível reproduzir. Tente outro motor ou abra externamente." e **para** — sem ficar trocando em loop.
- Persistir a preferência só por sessão (não em `localStorage` global) pra não comprometer o próximo play se foi um erro pontual.

**Arquivo:** `src/components/Player.tsx`.

## 3) ESC fechar player em Filmes

**Causa raiz:** Em Filmes, o `MovieDetailsDialog` (Radix Dialog) **continua aberto atrás** do `PlayerOverlay` (comentário em `Movies.tsx:190` confirma). O Radix captura o ESC primeiro e tenta fechar a si mesmo — mas o `PlayerOverlay` tem um guard que **não** fecha se houver outro dialog `[data-state="open"]` aberto (`PlayerOverlay.tsx:50-55`). Em Séries, o details dialog fecha antes do play, então não tem conflito.

**Mudança:** Em `Movies.tsx`, fechar o `MovieDetailsDialog` ao disparar play (igual Séries faz). O dialog reabre quando o player fecha (já tem essa lógica de manter o item selecionado pra continuar exibindo).

**Arquivo:** `src/pages/Movies.tsx`.

## 4) Clique fora do player NÃO deve fechar (em Séries e Filmes)

**Causa raiz:** O `PlayerOverlay` fecha no `mouseDown` do backdrop (`PlayerOverlay.tsx:65-68`). Em Filmes isso não acontece porque o `MovieDetailsDialog` cobre o backdrop — mas isso vai mudar com o item 3, então o clique-fora começaria a fechar em Filmes também.

**Mudança:** Remover o `handleBackdropMouseDown` do `PlayerOverlay`. Fechar passa a ser apenas via:
- Tecla **ESC**
- Botão **X** dentro dos controles do Player
- Botão "Pressione Esc para fechar" no canto superior esquerdo (que já existe)

Isso resolve o pedido em Séries e mantém consistência com Filmes.

**Arquivo:** `src/components/PlayerOverlay.tsx`.

---

## Resumo dos arquivos editados
- `src/components/Player.tsx` — gating do painel de logs por admin+toggle, auto-fallback generalizado
- `src/components/PlayerOverlay.tsx` — remover fechamento por clique-fora
- `src/pages/Movies.tsx` — fechar `MovieDetailsDialog` ao iniciar play (corrige ESC)
- `src/pages/Admin.tsx` + `src/components/admin/MaintenancePanel.tsx` — toggle "Mostrar logs do player na minha sessão"

## Compatibilidade
- Sem mudanças de banco, sem edge function, sem migração.
- Telemetria (`stream_events`) continua funcionando idêntica — só some o overlay visual.
- Usuários que tinham o painel aberto: ele simplesmente some no próximo play (ou na próxima carga, se não-admin).
