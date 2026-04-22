

## Plano — Hardening completo de `supabase/functions/iptv-login/index.ts`

### Refator do arquivo

**Topo do módulo (apenas o seguro)**
- Mantém `import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0"`.
- Mantém constantes puras: `ALLOWED_SUFFIXES`, `USER_AGENTS`, `NO_ACCESS_MSG`.
- Mantém funções puras: `corsFor`, `normalizeServer`, `hostKey`, `buildVariants`, `tryFetch`, `attemptLogin` (não tocam env, não instanciam client).
- Adiciona `console.log("[iptv-login] boot")` como única chamada com efeito no top-level.
- **Remove** `supabaseUrl`, `serviceKey`, `admin` globais e os `!` em `Deno.env.get`.

**Lazy `getAdminClient()`**
```ts
let _admin: ReturnType<typeof createClient> | null = null;
function getAdminClient() {
  try {
    if (_admin) return _admin;
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log("[iptv-login] env", { hasUrl: !!url, hasKey: !!key });
    if (!url || !key) throw new Error("MISSING_ENV");
    _admin = createClient(url, key, { auth: { persistSession: false } });
    return _admin;
  } catch (err) {
    console.error("[iptv-login] getAdminClient error", err);
    throw err;
  }
}
```

**`logEvent` blindado**
- Envolver `getAdminClient()` + `.insert(...)` em try/catch único.
- Em qualquer falha: `console.warn("[iptv-login] logEvent failed", err)` e `return`. Nunca propaga.

**Helper de resposta**
```ts
function jsonResponse(status: number, body: unknown, cors: Record<string,string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
```
- Substituir todos os `new Response(JSON.stringify(...), {...})` do handler por `jsonResponse(...)`.

**`Deno.serve` com try/catch global**
- `corsHeaders` resolvido em try/catch interno com fallback `{ "Access-Control-Allow-Origin": "*" }`.
- `OPTIONS` → `new Response("ok", { headers: corsHeaders })`.
- `console.log("[iptv-login] start request")`.
- `req.json()` em try/catch dedicado → 400 `Body inválido` em falha.
- Validação `username`/`password` ausentes → 400 `Informe usuário e senha`.
- `getAdminClient()` chamado dentro do try global. `MISSING_ENV` cai no catch externo → 500 `Configuração do servidor ausente`.
- Query `allowed_servers` envolvida em try/catch local → 503 `Serviço temporariamente indisponível` em falha de DB.
- Mantém lógica atual de validação de allowlist + iteração `attemptLogin` + sucesso/erro 401 (todas as respostas via `jsonResponse`).
- Catch externo loga `console.error("[iptv-login] fatal", err)` e retorna 500 `Erro interno do servidor`.

**Garantias auditadas**
- Zero `!` em `Deno.env.get`.
- Zero `createClient` no top-level.
- Toda branch termina com `return`.
- `logEvent` nunca propaga.
- `tryFetch` já é não-lançante (retorna objeto de erro).

### Validação pós-deploy
Via `curl_edge_functions` (POST `/iptv-login`):
1. Sem body → espera 400 JSON `Body inválido`.
2. Credencial inválida (`{username:"x",password:"y"}`) → espera 401 JSON.
3. Inspecionar `edge_function_logs` por `[iptv-login] boot`, `start request`, `env`.

(Cenários "sem env" e "DB indisponível" não são reproduzíveis em produção sem quebrar o ambiente; ficam cobertos pela auditoria de código que garante os retornos 500/503 corretos.)

### Arquivos tocados
- `supabase/functions/iptv-login/index.ts` (único arquivo).

### Sem mudanças em
- Frontend, schema, demais edge functions, `supabase/config.toml`, secrets.

