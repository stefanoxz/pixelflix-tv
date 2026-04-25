## Adicionar botão "Voltar ao login do webplayer" na tela de login do admin

### Mudança
Adicionar um link/botão discreto no topo (ou rodapé) do `Card` em `src/pages/AdminLogin.tsx` que navega para `/login` (a tela de login do webplayer/IPTV).

### Detalhes técnicos
- Arquivo: `src/pages/AdminLogin.tsx`
- Adicionar um `<button>` (ou `<Link>`) usando o `useNavigate` que já existe, com ícone `ArrowLeft` da `lucide-react`.
- Posição: pequeno link acima do cabeçalho "Painel Admin", alinhado à esquerda do `Card`, com estilo discreto (`text-xs text-muted-foreground hover:text-foreground`), para não competir visualmente com o formulário de login.
- Texto: `← Voltar ao login do webplayer`
- Ao clicar: `navigate("/login")`.

Sem alterações em rotas, contexto ou backend.