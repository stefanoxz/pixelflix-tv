Vou eliminar essa pequena tela de carregamento que aparece antes da tela de sincronização.

Plano:
1. Tornar a página `/sync` carregada diretamente, sem `lazy()`/`Suspense`.
   - Hoje o `App.tsx` importa a tela de sincronização de forma lazy.
   - Isso faz o React mostrar o fallback com spinner enquanto baixa o bundle da rota.
   - Esse fallback é exatamente a tela escura com spinner azul da imagem.

2. Manter o carregamento preguiçoso nas outras páginas pesadas.
   - Home, TV ao vivo, filmes, séries e conta continuam com preload/lazy load.
   - A mudança fica focada apenas na tela de sincronização para evitar o flash antes dela.

3. Simplificar o fallback global de rota.
   - Se ainda houver algum fallback rápido entre rotas, ele será menos perceptível e não competirá com a tela de sincronização.
   - A sincronização deve aparecer imediatamente após o login.

Detalhe técnico:
- Em `src/App.tsx`, trocar:
  ```ts
  const Sync = lazy(() => import("./pages/Sync"));
  ```
  por importação direta:
  ```ts
  import Sync from "./pages/Sync";
  ```
- Remover a tela `/sync` da parte lazy, mantendo as demais rotas como estão.

Resultado esperado:
- Depois do login, o usuário vai direto para a tela “Sincronizando seu conteúdo”.
- A tela pequena com apenas o spinner azul não deve mais aparecer antes da sincronização.