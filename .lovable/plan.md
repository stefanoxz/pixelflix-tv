## Problema

Mesmo depois de mover os logs para um toggle de admin, ainda aparece um **chip flutuante no canto inferior direito do player** (com o ponto pulsante) mostrando coisas como:

- `Reprodução iniciada — mediaError/bufferStalledError`
- `Conectando…`
- `Stall timeout`

Esse chip é o "Diagnostic card" do `src/components/Player.tsx` (linhas 2150–2172) e está renderizado incondicionalmente — ele não é o painel de logs grande, é um segundo elemento de diagnóstico que escapou da limpeza anterior.

## Solução

Tratar o chip de diagnóstico igual ao painel de logs: **só aparece para admins que ativaram o toggle** "Mostrar logs do player" em `/admin → Manutenção`. Usuário comum nunca vê.

A coleta interna do status (`updateStatus`, telemetria, auto-fallback HLS→MPEG-TS) **continua funcionando normalmente** — só a UI do chip é escondida.

## Mudança de código

Arquivo: `src/components/Player.tsx`

No bloco que renderiza o "Diagnostic card" (~linha 2150), trocar:

```tsx
{!loading && !error && (
  <div className={cn("...", statusTone[status])} role="status" ...>
    ...
  </div>
)}
```

Por:

```tsx
{playerLogsAvailable && !loading && !error && (
  <div className={cn("...", statusTone[status])} role="status" ...>
    ...
  </div>
)}
```

(O hook `playerLogsAvailable = usePlayerLogsEnabled()` já está importado e usado na linha 453.)

## Resultado

- **Usuário comum**: player limpo, sem nenhum chip de status no canto. Só vê o conteúdo, a barra de controles (skip, velocidade, report) e o badge de qualidade.
- **Admin com toggle ativo**: continua vendo o chip + o painel de logs como hoje.
- **Toast "Reconectando…"** (linha 1841) é mantido porque é uma mensagem de UX legítima quando há reconexão real, não um log técnico.

Sem mudança de comportamento, sem risco de quebrar player, ESC, fallback automático ou telemetria.
