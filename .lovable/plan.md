

## Corrigir CORS do login do webplayer (e demais edge functions)

### Causa raiz (confirmada por logs)
- O browser envia o preflight `OPTIONS` → edge function responde 200 ✅
- O browser envia o `POST` → falha com **"Failed to fetch"** antes de chegar à função (não aparece nos logs do Supabase) ❌
- Origin do preview: `https://1c24e52c-d430-494c-8e08-55923434b0dd.lovableproject.com`
- A função `iptv-login` (e as outras) montam o header `Access-Control-Allow-Origin` a partir da env `ALLOWED_ORIGIN`. Quando essa env está setada para um domínio diferente (provável valor antigo: `https://*.lovable.app` ou outro), o browser rejeita a resposta real e exibe a mensagem genérica "Failed to send a request to the Edge Function".

### Solução
Remover a dependência de `ALLOWED_ORIGIN` e refletir o origin do request (com lista de domínios Lovable confiáveis), em todas as edge functions chamadas pelo webplayer.

### Arquivos a alterar
1. `supabase/functions/iptv-login/index.ts`
2. `supabase/functions/iptv-categories/index.ts`
3. `supabase/functions/stream-proxy/index.ts`
4. `supabase/functions/admin-api/index.ts`

### Mudança técnica em cada função
Substituir o helper `corsFor(req)` por uma versão que:
- Aceita qualquer origin que termine em `.lovable.app`, `.lovableproject.com`, `.lovable.dev` ou seja `http://localhost:*`.
- Reflete esse origin no header `Access-Control-Allow-Origin`.
- Mantém `Vary: Origin`.
- Mantém os mesmos `Access-Control-Allow-Headers` (incluindo `authorization, apikey, content-type, x-client-info, x-supabase-client-*`).
- Adiciona `Access-Control-Allow-Methods: POST, GET, OPTIONS`.

Pseudocódigo:
```ts
const ALLOWED_SUFFIXES = [".lovable.app", ".lovableproject.com", ".lovable.dev"];
function corsFor(req: Request) {
  const origin = req.headers.get("origin") || "";
  let allow = "*";
  try {
    const u = new URL(origin);
    if (
      ALLOWED_SUFFIXES.some(s => u.hostname.endsWith(s)) ||
      u.hostname === "localhost"
    ) allow = origin;
  } catch {}
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}
```

### Não faz parte
- Não mexer em `supabase/config.toml` (já está correto: `verify_jwt = false` para as funções públicas).
- Não mexer no frontend (`src/services/iptv.ts`, `Login.tsx`) — o problema é 100% no header de resposta da edge function.
- Não mexer em schema/banco/RLS.

### Resultado esperado
Após o redeploy automático, o POST para `/functions/v1/iptv-login` passa pelo browser, a função recebe `username`/`password`, valida contra a allowlist de DNS e retorna a sessão IPTV normalmente. Os outros endpoints (categorias, streams, admin) também voltam a funcionar do preview.

