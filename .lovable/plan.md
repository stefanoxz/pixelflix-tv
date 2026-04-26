## Problema confirmado

A tabela `pending_admin_signups` tem **22 linhas**, todas com `email` em branco (`''`). Por isso o painel "Cadastros pendentes" mostra a contagem mas nenhum e-mail aparece.

**Causa raiz:** o trigger `handle_new_admin_signup()` roda em `AFTER INSERT ON auth.users` e tenta ler `NEW.email`. Em vários fluxos do Supabase (especialmente com confirmação de e-mail ligada, ou quando o usuário entra por outro caminho), `NEW.email` chega `NULL` no momento exato do INSERT — o e-mail é gravado em outra coluna/etapa. O `COALESCE(NEW.email, '')` cai para string vazia e o e-mail é perdido para sempre.

## O que vai ser corrigido

### 1. Trigger mais robusto (migração SQL)

Reescrever `handle_new_admin_signup()` para tentar múltiplas fontes do e-mail, em ordem:

1. `NEW.email`
2. `NEW.raw_user_meta_data->>'email'`
3. `NEW.raw_app_meta_data->>'email'`
4. Se mesmo assim vier vazio → ainda insere, mas com `email = NULL` (não `''`), para que possamos fazer backfill depois

### 2. Backfill dos 22 registros existentes

Migração SQL que atualiza `pending_admin_signups.email` lendo de `auth.users.email` (e dos `raw_*_meta_data` como fallback) para todos os `user_id` que hoje estão com email vazio. O service role tem acesso à `auth.users`, então isso é seguro fazer numa migração.

### 3. Edge function `list_pending_signups` com fallback

Atualizar `supabase/functions/admin-api/index.ts` (handler `list_pending_signups`) para, quando uma linha vier com `email` vazio/NULL, buscar via `admin.auth.admin.getUserById(user_id)` e preencher o e-mail na resposta. Assim, mesmo que algum registro escape do trigger no futuro, o painel sempre exibe o e-mail real.

### 4. UI defensiva (`PendingSignupsPanel.tsx`)

- Quando `email` vier vazio ainda assim, mostrar `(e-mail indisponível — user_id: <8 primeiros chars>)` em itálico, em vez de uma célula em branco que parece um bug.
- Mostrar `user_id` curto como tooltip em todas as linhas, pra debug futuro.

### 5. (NÃO escopo)

- Fluxo de aprovação/rejeição continua igual.
- Login admin, RLS, roles — sem mudanças.

## Resultado esperado

- ✔ Os 22 cadastros pendentes existentes passam a exibir o e-mail real no painel
- ✔ Novos cadastros sempre gravam o e-mail correto
- ✔ Mesmo em caso raro de e-mail ainda faltar, o painel busca direto da `auth.users` antes de exibir
- ✔ Admin consegue identificar quem é cada cadastro e aprovar/recusar com confiança

## Detalhes técnicos

**Migração SQL (resumo):**
```sql
-- 1) Trigger robusto
CREATE OR REPLACE FUNCTION public.handle_new_admin_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  resolved_email text;
BEGIN
  resolved_email := COALESCE(
    NULLIF(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data->>'email', ''),
    NULLIF(NEW.raw_app_meta_data->>'email', '')
  );

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.pending_admin_signups(user_id, email)
    VALUES (NEW.id, resolved_email)
    ON CONFLICT (user_id) DO UPDATE
      SET email = COALESCE(NULLIF(EXCLUDED.email, ''), pending_admin_signups.email);
  END IF;
  RETURN NEW;
END $$;

-- 2) Backfill dos 22 órfãos
UPDATE public.pending_admin_signups p
SET email = COALESCE(
  NULLIF(u.email, ''),
  NULLIF(u.raw_user_meta_data->>'email', ''),
  NULLIF(u.raw_app_meta_data->>'email', ''),
  p.email
)
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email = '');
```

**Edge function (handler `list_pending_signups`):** após o `select`, para cada linha sem email, chamar `admin.auth.admin.getUserById(row.user_id)` em paralelo (`Promise.all`) e usar o e-mail retornado.

**Frontend (`PendingSignupsPanel.tsx`):** ajustar a célula de e-mail para exibir um placeholder identificável quando vier vazio, em vez de string vazia silenciosa.
