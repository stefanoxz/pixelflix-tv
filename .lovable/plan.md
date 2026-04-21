

## Proteção real para `/admin` com Supabase Auth + roles no backend

Substituir o esquema atual (usuário/senha hardcoded `admin/admin` + token estático no localStorage) por **autenticação real** com Supabase Auth e **checagem de role no servidor** usando uma tabela `user_roles` separada e função `has_role()` security-definer. O frontend deixa de decidir quem é admin — apenas exibe o que o backend autoriza.

### 1. Banco — migração

Criar enum + tabela de roles + função security-definer (padrão recomendado, evita recursão de RLS):

```sql
-- Enum de roles
create type public.app_role as enum ('admin', 'user');

-- Tabela de roles (NUNCA na profiles)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Função security-definer (evita recursão)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Policies em user_roles
create policy "Users can read own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

create policy "Admins can read all roles"
  on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Proteger as tabelas administrativas (hoje sem RLS)
alter table public.allowed_servers enable row level security;
alter table public.login_events enable row level security;

create policy "Admins manage allowed_servers"
  on public.allowed_servers for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins read login_events"
  on public.login_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
```

Depois da migração, o usuário vai precisar:
1. Criar a conta admin pelo novo `/admin/login` (signup).
2. Receber um SQL pronto para rodar (vou exibir no chat) que insere `('admin', user_id)` em `user_roles` para o e-mail dele.

### 2. Edge Function `admin-api` — validar JWT + role no servidor

Reescrever a autorização da função:

- Remover `ADMIN_TOKEN` estático e o fallback base64 legacy.
- Ler `Authorization: Bearer <jwt>` do header.
- Criar dois clients: um **anon** com o JWT do usuário (`getUser()`), e o `admin` (service role) só para queries administrativas.
- Chamar `admin.rpc('has_role', { _user_id: user.id, _role: 'admin' })`.
- Se falhar qualquer etapa → `401`.
- Manter `verify_jwt = false` no `config.toml` (validação feita em código, padrão Lovable Cloud) — mas a função agora exige JWT válido **na prática**.

```ts
const authHeader = req.headers.get("Authorization") ?? "";
const jwt = authHeader.replace(/^Bearer\s+/i, "");
if (!jwt) return unauthorized();

const userClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: `Bearer ${jwt}` } },
  auth: { persistSession: false },
});
const { data: { user }, error } = await userClient.auth.getUser();
if (error || !user) return unauthorized();

const { data: isAdmin } = await admin.rpc("has_role", {
  _user_id: user.id, _role: "admin",
});
if (!isAdmin) return unauthorized();
```

Remover o campo `token` do body em todas as chamadas — ele não existe mais.

### 3. Frontend — `AdminLogin.tsx` reescrito

Trocar o form fake (`admin/admin` + `localStorage.setItem("admin_token", ...)`) por um form real de Supabase Auth com **Login** e **Cadastro** (tabs):

- `supabase.auth.signInWithPassword({ email, password })` para login.
- `supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } })` para cadastro.
- Após login, chamar `supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })` no client.
  - Se `true` → navega para `/admin`.
  - Se `false` → faz `signOut`, mostra toast: *"Sua conta não tem permissão de admin. Peça ao administrador para liberar."*
- Remover constantes `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_API_TOKEN`, `TOKEN_KEY`.

### 4. Frontend — `AdminProtectedRoute.tsx` (novo)

Componente que protege a rota `/admin`:

- Hook que escuta `supabase.auth.onAuthStateChange` (setup ANTES de `getSession`, padrão Lovable).
- Se sem sessão → redireciona `/admin/login`.
- Com sessão → chama `supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })`.
- Enquanto verifica → tela de loading.
- Se não-admin → redireciona `/admin/login` com toast de "acesso negado" e faz signOut.

Em `App.tsx`:
```tsx
<Route path="/admin" element={
  <AdminProtectedRoute><Admin /></AdminProtectedRoute>
} />
```

### 5. `Admin.tsx` — usar JWT em vez de token

- Apagar `const TOKEN_KEY` e toda referência a `localStorage.getItem(TOKEN_KEY)`.
- Reescrever `callAdmin` para **não enviar `token`** no body — o `supabase.functions.invoke` já anexa o JWT do usuário automaticamente via Authorization header.
- Botão "Sair" → `supabase.auth.signOut()` + redireciona para `/admin/login`.
- Sessão expirada (401 do edge) → `signOut` + redireciona.

### 6. Limpeza

- Remover variável de ambiente `ADMIN_PASSWORD` da edge function (não é mais usada).
- Não mexer em `IptvContext` / login de IPTV — escopo é só `/admin`.

---

### Diagrama de fluxo

```text
[Browser] /admin/login
   │ supabase.auth.signInWithPassword()
   ▼
[Supabase Auth] → JWT
   │
   ▼
[Browser] supabase.rpc('has_role', admin)
   │ false → signOut + erro
   │ true  → navega /admin
   ▼
[AdminProtectedRoute] revalida role a cada montagem
   │
   ▼
[Admin.tsx] supabase.functions.invoke('admin-api', { body: { action, payload } })
   │  (Authorization: Bearer <jwt> automático)
   ▼
[admin-api edge]
   1. Lê JWT do header
   2. getUser() → user.id
   3. rpc('has_role', user.id, 'admin')
   4. Se ok → executa ação com service role
```

### Arquivos alterados

- **Migração nova**: cria `app_role`, `user_roles`, `has_role()`, RLS em `allowed_servers` e `login_events`.
- `supabase/functions/admin-api/index.ts` — autorização por JWT + `has_role()`, remove token estático.
- `src/pages/AdminLogin.tsx` — reescrito com Supabase Auth (login + signup).
- `src/components/AdminProtectedRoute.tsx` — novo, valida sessão e role.
- `src/pages/Admin.tsx` — remove `TOKEN_KEY`, `callAdmin` sem `token`, logout via `signOut`.
- `src/App.tsx` — envolve `/admin` com `AdminProtectedRoute`.

### Após implementar — passo manual do usuário

1. Acessa `/admin/login`, clica em "Cadastrar", cria conta com e-mail/senha.
2. Eu vou mostrar no chat o SQL para executar e promover essa conta a admin:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'SEU_EMAIL_AQUI';
   ```
3. Recarrega `/admin` → entra normalmente.

### Fora de escopo

- Migrar login do IPTV (usuários comuns) para Supabase Auth.
- UI para promover/rebaixar admins (fica para uma segunda etapa).
- Rate limiting em `iptv-login`.

