# Plano: Botão "Exportar Relatório de Diagnóstico"

## Objetivo

Permitir que, após sondar uma DNS no painel admin (Servidores → ícone de "probe"), você gere um **relatório formatado** com timestamp, endpoint, status HTTP e diagnóstico legível, e envie pra revenda em 1 clique (copiar pra área de transferência ou baixar `.txt`).

## Onde fica

No diálogo **`ServerProbeDialog`** que já existe em `src/components/admin/ServerProbeDialog.tsx`. Aproveitamos a sondagem que ele já faz (testa 4 variantes da URL: HTTP/HTTPS, com/sem `/c/`) e formatamos o resultado.

## Como o relatório vai ficar

Texto puro (Markdown leve), pronto pra colar em WhatsApp/Telegram/email:

```text
═══════════════════════════════════════════════
RELATÓRIO DE DIAGNÓSTICO DE SERVIDOR IPTV
═══════════════════════════════════════════════

Data/Hora do teste : 28/04/2026 00:45:12 (UTC-3)
Servidor testado   : http://fogwekl.top
Origem do teste    : Backend Lovable Cloud
                     (datacenter, IPv4)

─── RESULTADO RESUMIDO ────────────────────────
Status geral       : ❌ FORA DO AR
Variantes testadas : 4
Melhor resposta    : nenhuma respondeu OK

─── DETALHAMENTO POR VARIANTE ─────────────────

[1] http://fogwekl.top/player_api.php
    HTTP Status   : 444
    Latência      : 308 ms
    Xtream válido : não
    Erro          : —
    Diagnóstico   : Conta suspensa (Cloudflare 444)
    Resposta      : "This account has been suspended"

[2] http://fogwekl.top/c/player_api.php
    HTTP Status   : 444
    Latência      : 295 ms
    ...

[3] https://fogwekl.top/player_api.php
    HTTP Status   : 444
    ...

[4] https://fogwekl.top/c/player_api.php
    HTTP Status   : 444
    ...

─── INTERPRETAÇÃO ─────────────────────────────
O painel respondeu com HTTP 444 ("account suspended")
em todas as variantes. Isso indica que a conta na
hospedagem do painel foi suspensa/desativada na
origem. Não é problema de bloqueio de IP, firewall
ou credencial — o servidor está retornando essa
mensagem para qualquer requisição de qualquer IP.

Por favor verificar:
  • Status da conta de hospedagem do painel
  • Possível bloqueio por denúncia/abuso
  • Necessidade de migrar para nova URL/DNS

═══════════════════════════════════════════════
Gerado por: Webplayer Admin
ID do teste: 7f3c2a91-...
═══════════════════════════════════════════════
```

## Mudanças no código

### 1. `src/components/admin/ServerProbeDialog.tsx`
- Adicionar 2 botões no rodapé do diálogo, ao lado do "Testar novamente":
  - **"Copiar relatório"** → copia o texto formatado pro clipboard, mostra toast "Relatório copiado"
  - **"Baixar .txt"** → baixa arquivo `diagnostico-{host}-{timestamp}.txt`
- Criar função `buildReport(response: ProbeResponse)` que gera o texto acima
- Criar função `interpretResults(response)` que escreve o parágrafo de "Interpretação" baseado nos status HTTP encontrados:
  - Todos `444` + body "account suspended" → "Conta suspensa na origem"
  - Todos `404` → "Painel respondeu mas endpoint Xtream não existe / DNS bloqueando nosso IP"
  - Todos `Connection reset` → "Servidor cortando conexão (provável bloqueio de IP de datacenter)"
  - Todos `timeout` → "Servidor não respondeu no prazo (offline ou rede sobrecarregada)"
  - Algum `auth=1` → "Servidor OK, credenciais válidas"
  - Algum `200` mas sem `auth` → "Servidor OK mas resposta não-Xtream (não é um painel IPTV padrão)"
  - Misto → lista cada caso

### 2. Sem mudanças no backend
A função `check-server` (Edge) já retorna tudo que precisamos. Não vou tocar nela.

## O que NÃO vou fazer

- Não vou criar nova tabela no banco — relatório é gerado on-the-fly, não fica salvo
- Não vou criar nova edge function
- Não vou mexer nas outras abas do admin
- Não vou adicionar envio automático por email/WhatsApp (você copia e cola onde quiser)

## Resultado esperado

Você abre **Admin → Servidores**, clica no ícone "Sondar" da DNS problemática (`bkpac.cc`, `fogwekl.top`, etc.), espera o teste rodar (~3-8s), e clica em **"Copiar relatório"**. Cola direto no chat com a revenda. Eles veem timestamp + status HTTP + interpretação técnica em português, sem precisar abrir DevTools ou explicar nada.
