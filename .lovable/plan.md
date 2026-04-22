

## Resetar a senha do admin `stefanobsilva@gmail.com`

### Diagnóstico (confirmado pelo painel)
- Backend de auth: **OK** (sem mais erro 500 / schema)
- Conta existe: **OK**
- Senha digitada (5 caracteres): **não confere** com o hash salvo

Ou seja, o único bloqueio agora é não saber a senha correta. Duas formas de resolver — escolha uma:

### Opção A — Resetar a senha direto no banco (rápido)
Eu rodo uma migração que sobrescreve a senha do admin com um valor que **você me informar agora** (mínimo 8 caracteres, recomendo algo provisório só para entrar e depois trocar).

Passos:
1. `UPDATE auth.users SET encrypted_password = crypt('<sua_senha>', gen_salt('bf')), updated_at = now() WHERE email = 'stefanobsilva@gmail.com'`
2. Você entra em `/admin/login` com a nova senha.
3. (Opcional) Troca depois pela tela de conta.

**Me responda com a senha provisória que quer usar** (ex.: `Admin@2026`) e eu aplico.

### Opção B — Adicionar fluxo "Esqueci minha senha" na tela `/admin/login`
Implementação:
1. Novo botão **"Esqueci minha senha"** abaixo do formulário de login.
2. Modal pedindo o e-mail → chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/admin/reset-password\` })`.
3. Nova rota pública `/admin/reset-password`:
   - Detecta `type=recovery` no hash da URL.
   - Formulário de nova senha + confirmação.
   - Chama `supabase.auth.updateUser({ password })`.
   - Redireciona para `/admin/login` ao concluir.
4. E-mail de recuperação usa o template padrão do Lovable Cloud (sem precisar configurar domínio).

Vantagem: fica permanente, serve para qualquer admin futuro.
Desvantagem: depende do e-mail chegar (cheque spam).

### Recomendação
- Se quiser **entrar agora**: vá de **Opção A** e me passe a senha provisória.
- Se quiser **solução definitiva**: vá de **Opção B** (posso implementar e você dispara o e-mail logo após).

Pode também pedir **as duas** — reseto agora pra desbloquear e já deixo o fluxo de recuperação pronto.

