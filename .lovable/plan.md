# Renomear card "Conexão" e adicionar tooltip explicativo

## Contexto

O valor `4g` exibido no painel admin não significa "dados móveis 4G". Ele vem da Web API `navigator.connection.effectiveType`, que classifica qualquer conexão em 4 buckets de qualidade (`slow-2g`, `2g`, `3g`, `4g`). Wi-Fi, fibra, cabo e 5G aparecem todos como `4g`. O label atual induz ao erro.

## O que muda

No painel `ClientDiagnosticsPanel` (admin), onde hoje aparece "Conexão: 4g":

1. **Renomear o label** de "Conexão" para **"Qualidade da rede"**.
2. **Adicionar um ícone de info (`?` ou `ⓘ`)** ao lado do label com um tooltip explicando:
   > "Classificação do navegador baseada em latência e velocidade. '4g' = boa conexão (inclui Wi-Fi e fibra). Não indica o tipo físico do link."
3. **Manter o valor cru** (`4g`, `3g`, etc.) — apenas o rótulo e o tooltip mudam.

Nada de heurística, nada de inferir Wi-Fi/móvel. Mudança puramente cosmética + educativa.

## Arquivos afetados

- `src/components/admin/ClientDiagnosticsPanel.tsx` — trocar label e adicionar `<Tooltip>` (componente já existe em `src/components/ui/tooltip.tsx`).

## Fora do escopo

- Não vamos alterar a coleta no `clientDiagnostics.ts`.
- Não vamos alterar o backend (`client-diagnostic` edge function nem a tabela `client_diagnostics`).
- Não vamos tentar inferir tipo de conexão (Wi-Fi vs móvel) — fica pra uma próxima se você quiser.
