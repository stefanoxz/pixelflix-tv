## Análise completa do impacto da remoção do proxy

### ✅ O que está OK

| Área | Status |
|---|---|
| Build do frontend (`vite build`) | **Passa** — 0 erros |
| `iptv-login` type-check | **OK** |
| `iptv-categories` type-check | **OK** |
| `check-server` type-check | **OK** |
| `watch-progress` runtime | **OK** (TS2769 é falso positivo pré-existente do supabase-js no Deno, não bloqueia deploy nem runtime) |
| Banco/RLS/auth | **Intactos** — não foram tocados |
| Deploy das 5 funções | **Sucesso** |

### ⚠️ Quebra real encontrada — `admin-api/index.ts` (linhas 1276–1325)

Quando substituí `proxyOnlyFetch(...)` por `fetch(...)` no bloco "Comparativo direto vs proxy", deixei resíduo: o bloco está dentro de um `if (compareRoutes && false)` (nunca executa), mas o TypeScript ainda valida o conteúdo e dá **6 erros de tipo** (`pRes` possibly null, `route_comparison.direct/proxy` does not exist on type `never`).

**Impacto real:**
- Em **runtime** não quebra nada — o bloco está morto (`&& false`).
- Mas o **próximo deploy** do `admin-api` vai falhar com TS2339/TS18047.
- O endpoint de teste do admin (`/test-endpoint`) sempre devolve `route_comparison: null` (esperado, já que não há proxy).

### Correção proposta

Remover o bloco morto inteiro (linhas 1282–1309) e deixar `route_comparison` declarado direto como `null`. Resultado: código mais limpo, type-check passa, comportamento idêntico (já era sempre null).

```diff
- // 5) Comparativo direto vs proxy (paralelo)
- let route_comparison: {...} | null = null;
- if (compareRoutes && false) {
-   const [dRes, pRes] = await Promise.all([...]);
-   route_comparison = {...};
- }
+ // 5) Comparativo direto vs proxy — desativado (sem proxy configurado).
+ const route_comparison: {...} | null = null;
```

Depois redeployar `admin-api`.

### Outras observações

- Frontend usa `route_comparison?.direct/proxy` em `EndpointTestPanel.tsx` — tudo com optional chaining, então receber `null` continua funcionando.
- Variável `compareRoutes` (input do request) ainda existe mas vira parâmetro inerte. Aceitável manter — clientes que enviarem o flag não quebram, só ignoramos.

### O que NÃO foi quebrado

- Login IPTV: continua funcionando para painéis que não bloqueiam o backend.
- Para `bkpac.cc`: continua bloqueado (esperado — só vai funcionar com VPS no futuro), mas agora mostra mensagem honesta "não é problema de senha".
- `watch-progress`, `iptv-categories`, `check-server`: zero impacto além da troca de import.
- Banco, RLS, auth, storage, secrets (exceto `IPTV_PROXY_URL` que ficou inerte): intocados.