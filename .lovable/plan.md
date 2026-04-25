## Aprovação manual de novos cadastros admin

Hoje qualquer pessoa pode se cadastrar pelo `/admin/login` e — se virar admin — acessar tudo. Vamos travar isso: novos cadastros ficam **pendentes** até você aprovar, e aparecem numa aba dedicada dentro de `/admin`.

### Como vai funcionar

1. Pessoa cria conta em `/admin/login` (aba "Cadastrar") → recebe mensagem "Cadastro recebido. Aguarde aprovação do administrador."
2. Conta é criada, mas **não consegue logar no painel** — qualquer tentativa de login redireciona para uma tela "Aguardando aprovação".
3. Você (admin existente) abre `/admin` → nova aba **"Novos cadastros"** mostra a lista de pendentes com:
   - E-mail
   - Data do cadastro
   - IP do cadastro
   - Botões **Aprovar como admin** / **Recusar (apagar conta)**
4. Ao aprovar, a conta vira admin (entra em `user_roles`) e pode logar normalmente.
5. Ao recusar, a conta é apagada de `auth.users`.

### Tela "Aguardando aprovação"

Quando uma conta sem role tenta entrar em `/admin`, em vez de mostrar a tela em branco/erro, mostra:
> "Sua conta foi criada e está aguardando aprovação do administrador. Você receberá acesso assim que stefanobsilva@gmail.com aprovar seu cadastro."

Com botão "Sair" para fazer logout.

---

## Detalhes técnicos

### Banco

Nova tabela `pending_admin_signups`:
```sql
CREATE TABLE public.pending_admin_signups (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  ip text
);
```
RLS: só admins leem; inserção/delete via edge function (service role).

Trigger em `auth.users` na inserção: se for o **primeiro** usuário (nenhum admin existe ainda), cria role automaticamente; caso contrário, insere em `pending_admin_signups`.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_admin_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Se ainda não existe nenhum admin, primeiro user vira admin (bootstrap).
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.pending_admin_signups(user_id, email)
    VALUES (NEW.id, NEW.email);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_signup();
```

### Backend (admin-api)

Três novas actions:
- `list_pending_signups` → retorna a lista
- `approve_signup(user_id)` → insere em `user_roles` + remove de pending
- `reject_signup(user_id)` → `auth.admin.deleteUser(user_id)` + remove de pending

Adicionar essas três no array `MUTATING_ACTIONS` (exceto a list).

### Frontend

- `Admin.tsx`: nova aba "Novos cadastros" com tabela + botões Aprovar/Recusar.
- `AdminProtectedRoute.tsx`: quando usuário logado não tem role admin nem está em pending, mostra tela "Aguardando aprovação" em vez de redirect/erro.
- `AdminLogin.tsx`: na resposta de signup bem-sucedido, trocar mensagem para "Cadastro recebido. Aguarde a aprovação do administrador para acessar o painel" + fazer logout automático.

### Bootstrap

Você (`stefanobsilva@gmail.com`) já é admin, então o trigger não te afeta. O `IF NOT EXISTS` cobre o caso de o banco ser resetado: o primeiro a se cadastrar vira admin automaticamente.

---

## Arquivos afetados

- Nova migração SQL (tabela + trigger + RLS)
- `supabase/functions/admin-api/index.ts` (3 actions)
- `src/pages/Admin.tsx` (nova aba)
- `src/components/AdminProtectedRoute.tsx` (tela "aguardando")
- `src/pages/AdminLogin.tsx` (mensagem pós-cadastro + logout)
- `src/integrations/supabase/types.ts` (auto)

## Garantias

- **Quem já é admin** (você) não é afetado.
- **Cadastros antigos sem role** ficam de fora da fila de pending (a tabela é alimentada apenas por novos signups via trigger). Se quiser migrá-los, dá pra rodar um insert manual depois.
- Sem alteração no fluxo de IPTV (que é separado do auth do admin).