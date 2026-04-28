# Remover painel de depuração do AdminLogin

## O que muda

Em `src/pages/AdminLogin.tsx`:

1. **Remover o card "Painel de depuração"** que aparece embaixo do formulário de login do admin (botão expansível com ícone de bug, log de eventos, e o botão "Rodar diagnóstico").
2. **Remover toda a lógica relacionada**:
   - Tipo `DebugEntry`
   - Funções `maskEmail()` e `runDiagnostics()`
   - Estados `debugOpen` e `debugLog`
   - Função `pushDebug()` e todas as chamadas dela espalhadas em `handleSignIn`, `handleSignUp`, `handleForgotPassword` e no `useEffect` inicial.
3. **Limpar imports** não usados: `Bug`, `ChevronDown`, `ChevronUp`.

## O que NÃO muda

- O `lastError` e o card vermelho de erro detalhado **continuam** — útil pro usuário entender falhas de login.
- `describeAuthError()` continua, traduzindo erros do auth pra mensagens amigáveis.
- `console.warn` em caso de erro continua (silencioso, só pra debug do operador).
- Fluxo de signin/signup/forgot password fica idêntico — só sai a instrumentação visual.

## Arquivo afetado

- `src/pages/AdminLogin.tsx`
