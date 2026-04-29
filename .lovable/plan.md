## Mudanças no `src/pages/Login.tsx`

### 1. Remover o campo "DNS / Servidor (opcional)"
Apagar todo o bloco `<div className="space-y-2">` que contém o `<Label htmlFor="server">` e o input com ícone `Server` (linhas 333-368 da aba "Usuário e senha").

O backend (`iptv-login` edge function) já aceita `server` vazio e resolve a DNS automaticamente pela lista de servidores autorizados (`allowed_servers`) e pelo histórico do usuário, então remover o campo não quebra o login.

### 2. Tornar a senha visível
No input de senha (linha ~406), trocar:
```tsx
type="password"
```
por:
```tsx
type="text"
```

E remover o `autoComplete="current-password"` para o navegador não tentar tratar como senha (ou trocar para `autoComplete="off"`).

### 3. Limpeza de código não usado
Após remover o campo DNS:
- Remover o state `serverDns` / `setServerDns`
- Remover o import do ícone `Server` do `lucide-react`
- Remover o campo `server` do `credsSchema` (zod) e do `FieldErrors`
- Em `handleSubmitCreds`, simplificar para passar `undefined` como server: `await performLogin(undefined, result.data.username, result.data.password);`

### Observação sobre a aba M3U
A aba "URL M3U" continua igual — ela extrai o servidor a partir da URL colada, então não tem campo DNS separado para remover.

### Nada de backend muda
Nenhuma migração ou alteração de edge function é necessária. O `iptv-login` já lida com `server` ausente desde o início (usa o histórico do usuário e a allowlist).
