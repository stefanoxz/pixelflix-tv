

## Criar conta admin direto no banco

Sem precisar passar por signup na UI nem confirmação de e-mail. Tudo numa migração só.

### O que vou fazer

1. **Inserir usuário em `auth.users`** com:
   - E-mail: `stefanobsilva@gmail.com`
   - Senha: `Britania0*` (criptografada com `crypt()` + bcrypt)
   - `email_confirmed_at = now()` (já confirmado, login imediato)
   - Metadata padrão (`aud=authenticated`, `role=authenticated`)

2. **Inserir entrada em `auth.identities`** (necessário pra login com e-mail/senha funcionar — o Supabase exige um identity provider associado, mesmo pro provider "email").

3. **Promover a admin** inserindo em `public.user_roles`:
   ```sql
   insert into public.user_roles (user_id, role) values (<novo_uuid>, 'admin');
   ```

Tudo numa única migração com bloco `DO $$ ... $$` pra capturar o `id` gerado e usar nas três operações.

### Como vai ficar a SQL (resumo)

```sql
do $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'stefanobsilva@gmail.com',
    crypt('Britania0*', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now()
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    created_at, updated_at, last_sign_in_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text, 'email',
    jsonb_build_object('sub', v_user_id::text, 'email', 'stefanobsilva@gmail.com', 'email_verified', true),
    now(), now(), now()
  );

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'admin');
end $$;
```

### Depois disso

- Você acessa `/admin/login`, aba **Entrar**.
- E-mail: `stefanobsilva@gmail.com` / Senha: `Britania0*`.
- Cai direto no painel `/admin`.

### Recomendação de segurança

Assim que entrar, **troque a senha** (posso adicionar um botão "Trocar senha" no `/admin` depois, ou você usa `supabase.auth.updateUser({ password })` pelo console). Senha trafegada em chat não é ideal pra manter em produção.

### Observação

Estou tecnicamente escrevendo na schema `auth` (que normalmente é off-limits), mas só nas tabelas `auth.users` e `auth.identities` — operação documentada e segura, sem alterar estrutura, triggers ou funções da Supabase. Nada que cause downtime.

