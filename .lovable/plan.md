# Retry transparente para 503 transientes do Edge Runtime

## Problema
Erros esporádicos `503 SUPABASE_EDGE_RUNTIME_ERROR / "Service is temporarily unavailable"` aparecem no client quando o runtime do Supabase Edge tem cold start ou throttling momentâneo. O código backend está correto — o erro é da plataforma.

## Solução (puramente aditiva no client)
Adicionar retry **automático e silencioso** dentro de `invokeSafe` em `src/services/iptv.ts`, ativado **apenas** para esse erro específico.

### Detecção restrita
```ts
function isEdgeRuntimeTransient(status, code, error) {
  if (status !== 503) return false;
  return /SUPABASE_EDGE_RUNTIME_ERROR|TEMPORARILY UNAVAILABLE|BOOT_ERROR/i
    .test(`${code} ${error}`);
}
```

### Política de retry
- Máximo **2 retentativas** (3 tentativas no total).
- Backoff fixo: **500ms → 1500ms**.
- Pior caso: ~2s extras antes do erro chegar ao usuário.
- `console.warn` para rastrear no devtools.

## Garantias de não-regressão
- 4xx (BAD_REQUEST, INVALID_CREDENTIALS, NOT_ALLOWED, etc.) → **não retenta**.
- TIMEOUT, NETWORK_ERROR, OFFLINE → **não retenta**.
- Erro 5xx que NÃO seja `SUPABASE_EDGE_RUNTIME_ERROR` → **não retenta**.
- Sucesso na 1ª tentativa → comportamento idêntico ao atual (zero overhead).
- Backend, RLS, edge functions, fallback HLS↔TS, proxy, autenticação: **zero alterações**.
- Toda a lógica fica dentro de `invokeSafe`, então beneficia automaticamente login (M3U e usuário/senha), categorias, admin-api, stream-token, etc.

## Arquivo alterado
- `src/services/iptv.ts` — apenas a função `invokeSafe` (mesmo retorno, mesma assinatura).
