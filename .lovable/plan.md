## Objetivo

Remover a exigência de confirmação de e-mail no cadastro do painel admin. Hoje o Supabase Auth bloqueia o login com a mensagem "E-mail ainda não confirmado. Verifique sua caixa de entrada." (vista no print enviado).

## O que fazer

1. **Ativar auto-confirm no Supabase Auth** (`supabase/config.toml` → `[auth.email] enable_confirmations = false`) usando `cloud--configure_auth`. Isso faz com que novos cadastros já fiquem com o e-mail confirmado e possam autenticar imediatamente — sem precisar clicar em link nenhum.

2. **Limpar o frontend de cadastro** (`src/pages/AdminLogin.tsx`):
   - Remover `emailRedirectTo` da chamada `supabase.auth.signUp` (não tem mais para onde redirecionar).
   - Remover o ramo `"email not confirmed"` da função `describeAuthError`, que deixa de ser alcançável.
   - Manter a lógica atual de `signOut()` logo após o cadastro + toast "Aguarde a aprovação do administrador" — esse fluxo não muda. O que muda é que o bloqueio passa a ser só o de aprovação/role (admin/moderator), não mais o de e-mail.

3. **Confirmar contas já existentes que ficaram pendentes** (como a do print): rodar uma migration que marca `email_confirmed_at = now()` em `auth.users` para os usuários ainda não confirmados, para destravar quem já tentou cadastrar antes. Sem isso, contas antigas continuam com o erro mesmo após desligar a flag.

## O que NÃO muda

- Aprovação manual pelo admin (atribuição de role admin/moderator) continua sendo o gate de acesso ao `/admin`.
- Reset de senha por e-mail (`/reset-password`) continua funcionando normalmente — só o passo de "confirmar e-mail no signup" é removido.
- Templates de e-mail / domínio de envio: nada para mexer.