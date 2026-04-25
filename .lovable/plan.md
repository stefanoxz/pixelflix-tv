## Tela de Sincronização Inicial

Criar uma tela de "sincronização" que pré-carrega categorias e listas (Live, Filmes, Séries) logo após o login, alimentando o cache do React Query. Quando o usuário navegar até Filmes/Séries/Live, os dados aparecem instantaneamente, sem o "carregando" atual.

### Fluxo proposto

1. Usuário faz login em `/login` → redireciona para `/sync` (em vez de `/`).
2. Tela `/sync` mostra progresso e dispara em paralelo (controlado):
   - `getLiveCategories` + `getLiveStreams`
   - `getVodCategories` + `getVodStreams`
   - `getSeriesCategories` + `getSeries`
3. Cada chamada bem-sucedida é gravada no cache do React Query usando a **mesma `queryKey`** já usada pelas páginas (`["vod-streams", username]`, etc.) com `setQueryData` + `staleTime` longo (ex.: 30 min).
4. Barra de progresso mostra etapas concluídas (X de 6) com nome amigável ("Carregando filmes…").
5. Tratamento de falha: se uma etapa falhar, a tela mostra o erro com botão "Tentar novamente" e "Pular e continuar" (a página depois fará o fetch sob demanda como hoje — fallback seguro).
6. Ao concluir, navega para `/` (Highlights) automaticamente.

### Onde mexer

- **Nova rota** `/sync` em `src/App.tsx`, protegida por `ProtectedRoute`.
- **Novo arquivo** `src/pages/Sync.tsx` com a UI (logo, barra de progresso, lista de etapas com check/spinner) usando componentes existentes (`Progress`, `Loader2`).
- **`src/pages/Login.tsx`** e **`src/pages/AdminLogin.tsx` (apenas usuário comum)**: após login bem-sucedido, navegar para `/sync` em vez de `/`.
- **Persistência leve do cache** (opcional, recomendado): adicionar `@tanstack/react-query-persist-client` com `localStorage` para que ao recarregar a página em até X horas o conteúdo continue instantâneo. Se preferir manter simples, pulamos esta parte e a sync roda só no login.
- **Botão "Sincronizar novamente"** na página `/account` para reexecutar a sync manualmente quando o catálogo do provedor mudar.

### Detalhes técnicos

- Concorrência: as 6 chamadas já passam pelo `enqueue`/`invokeFn` global de `src/services/iptv.ts`, que limita concorrência (3-4 simultâneas), então não vamos sobrecarregar o painel.
- Chaves de cache devem **bater exatamente** com as páginas (auditar `Live.tsx`, `Movies.tsx`, `Series.tsx`) — caso contrário a sync não tem efeito.
- `staleTime` no `setQueryData` deve ser maior que o padrão (sugestão: 30 min) para evitar refetch imediato ao montar a página.
- Não adicionamos prefetch de capas/posters (seriam centenas de MB); só metadados JSON.
- A primeira sync após instalação pode levar 5-15 s dependendo do servidor IPTV — mostramos isso na UI ("Esta etapa só roda uma vez por sessão").

### O que NÃO entra agora

- Detalhes de filme/série individuais (`getVodInfo`, `getSeriesInfo`) continuam sob demanda (já têm prefetch ao hover).
- EPG completo (muito pesado).
- Capas/imagens.

Resultado: ao entrar em Filmes/Séries/Live, a grade aparece imediatamente, sem o spinner inicial.