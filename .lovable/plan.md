

## Corrigir erro "Database error querying schema" no login admin

### Problema
A conta admin `stefanobsilva@gmail.com` foi criada diretamente via SQL e ficou com colunas de token (`confirmation_token`, `email_change`, `email_change_token_new`, `recovery_token`, etc.) com valor `NULL`. O serviço de autenticação espera string vazia (`''`) nessas colunas e quebra com erro `500: converting NULL to string is unsupported` ao tentar logar.

### Solução

**1. Migração SQL** para normalizar todos os usuários afetados em `auth.users`, trocando `NULL` por `''` nas colunas de token:
- `confirmation_token`
- `email_change`
- `email_change_token_new`
- `email_change_token_current`
- `recovery_token`
- `reauthentication_token`
- `phone_change`
- `phone_change_token`

A migração roda apenas em linhas onde a coluna está `NULL`, é idempotente e não afeta usuários saudáveis.

**2. Verificação pós-migração**: confirmar que `stefanobsilva@gmail.com` tem `email_confirmed_at` preenchido (já está) e nenhum token mais como `NULL`.

### Resultado esperado
- Login admin volta a funcionar normalmente em `/admin/login`.
- Novos usuários criados via fluxo padrão de signup já não sofrem disso (apenas inserts SQL diretos causam o problema).

### Detalhes técnicos
- **Causa raiz**: GoTrue (serviço de auth) usa `sql.Scan` em `string` (não `sql.NullString`) para essas colunas. Inserts SQL manuais em `auth.users` sem fornecer valor default `''` deixam `NULL` e quebram o scan.
- **Escopo da migração**: somente `UPDATE` em `auth.users` — schema reservado, mas a operação é uma normalização de dados segura, sem alterar estrutura nem triggers.
- **Sem mudanças de código frontend**: o erro é 100% no banco/auth, não em React.

### Recomendação adicional
Se você não lembra a senha, posso (em modo padrão, após sua aprovação) também:
- Resetar a senha via `crypt()` para um valor que você forneça, **ou**
- Adicionar um fluxo "Esqueci minha senha" na tela `/admin/login`.

Me diga se quer incluir alguma dessas opções junto com a correção.

