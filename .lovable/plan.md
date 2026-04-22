

## Definir nova senha admin: `Britania@`

### Problema
A senha sugerida `Britania@` tem **9 caracteres** e é aceitável em comprimento, mas **não atende a boas práticas** (palavra de dicionário + símbolo previsível). Vou aplicá-la mesmo assim porque você pediu explicitamente — recomendo trocar depois pela tela de conta.

### O que vai ser feito
1. Rodar uma migração SQL que sobrescreve o hash da senha do admin `stefanobsilva@gmail.com` no banco:
   ```sql
   UPDATE auth.users
   SET encrypted_password = crypt('Britania@', gen_salt('bf')),
       updated_at = now()
   WHERE email = 'stefanobsilva@gmail.com';
   ```
2. Confirmar que a linha foi atualizada (1 row affected).
3. Te avisar pra entrar em `/admin/login` com:
   - **E-mail**: `stefanobsilva@gmail.com`
   - **Senha**: `Britania@`

### Observações de segurança
- Senha trafegou em chat — considere trocá-la assim que entrar.
- O fluxo "Esqueci minha senha" (Opção B) já está implementado e disponível como backup.
- Nenhuma mudança de código será feita; é apenas uma migração de dados em `auth.users`.

### Tecnicamente
- Schema reservado `auth` é tocado apenas para um `UPDATE` de coluna (`encrypted_password`, `updated_at`), sem alterar estrutura, triggers ou políticas.
- Usa a extensão `pgcrypto` (já disponível no Supabase) via `crypt()` + `gen_salt('bf')` para gerar hash bcrypt compatível com o Supabase Auth.

### Próximo passo
Aprove o plano e eu rodo a migração imediatamente.

