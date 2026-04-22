

## Botão "Sair do Admin" → tela de login do webplayer

### O que fazer
Adicionar um botão no header da página `/admin` que:
1. Faz `supabase.auth.signOut()` (encerra a sessão admin).
2. Redireciona para `/login` (tela de login do webplayer).

### Onde
Arquivo: `src/pages/Admin.tsx` — no topo da página, ao lado do título/cabeçalho existente do painel admin.

### Como (técnico)
- Importar `supabase` de `@/integrations/supabase/client` e `useNavigate` de `react-router-dom`.
- Importar `LogOut` de `lucide-react` e `Button` de `@/components/ui/button`.
- Handler:
  ```ts
  const handleExitAdmin = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };
  ```
- Botão `variant="outline"` com ícone `LogOut` e label **"Sair do Admin"**, posicionado no canto superior direito do header da página.

### Observações
- O `AdminProtectedRoute` já bloqueia acesso a `/admin` sem sessão admin, então após o `signOut` qualquer tentativa de voltar cai em `/admin/login` automaticamente — mas o redirect explícito para `/login` garante que o usuário vá direto pro webplayer, como pedido.
- Nenhuma mudança de rota, schema ou backend necessária.

