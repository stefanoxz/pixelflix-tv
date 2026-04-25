# Diagnóstico aprimorado para DNS IPTV inativas

Três camadas **puramente aditivas**: nenhuma quebra, nenhum fluxo existente alterado, apenas campos novos no JSON de resposta.

---

## Camada 1 — Detectar "origin Cloudflare sem backend Xtream" no diagnóstico

**Arquivo:** `supabase/functions/admin-api/index.ts` (action `test_endpoint`)

Após o cálculo do `verdict` atual (linhas ~1136–1192), e antes do `return ok({ ... })` (linha ~1196), inserir uma heurística aditiva que produz um campo novo `extra_warning` **sem alterar `verdict`**:

```ts
// Heurística adicional: Cloudflare na frente + 404 em tudo + nenhum JSON Xtream
// = origin provavelmente desligado/removido. NÃO substitui o verdict.
let extra_warning: { code: string; message: string } | null = null;
const cfMarker = probes.some((p) =>
  (p.headers.server ?? "").toLowerCase().includes("cloudflare") ||
  Boolean(p.headers["cf-ray"])
);
const httpProbes = probes.filter((p) => p.status !== null);
const all404 = httpProbes.length > 0 && httpProbes.every((p) => p.status === 404);
const noXtreamPayload = !xtream && probes.every((p) => !(p.body_preview ?? "").includes("user_info"));
if (cfMarker && all404 && noXtreamPayload) {
  extra_warning = {
    code: "origin_suspect",
    message:
      "Servidor responde via Cloudflare mas todas as rotas Xtream retornam 404. " +
      "O backend IPTV provavelmente foi desligado/removido. Solicite uma DNS atualizada ao provedor.",
  };
}
```

E acrescentar `extra_warning` no objeto retornado:

```ts
return ok({
  // ... todos os campos existentes ...
  extra_warning,   // <- NOVO, pode ser null
});
```

**UI (opcional, mesma camada):** em `src/components/admin/EndpointTestPanel.tsx`, adicionar um pequeno banner abaixo do `VerdictCard` quando `result.extra_warning` existir. Se eu não fizer isso, o campo simplesmente fica disponível no JSON e no relatório copiável.

---

## Camada 2 — Aviso não-bloqueante no `allow_server`

**Arquivo:** `supabase/functions/admin-api/index.ts` (action `allow_server`, linhas ~400–409)

Antes do `upsert`, fazer uma sondagem rápida (HEAD em `/player_api.php`, timeout 4 s, best-effort). O resultado **nunca bloqueia** o cadastro — só anexa um campo `warning` ao retorno:

```ts
let warning: string | null = null;
try {
  const probeUrl = `${url}/player_api.php`;
  const res = await proxiedFetch(probeUrl, {
    method: "HEAD",
    headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
    signal: AbortSignal.timeout(4000),
  });
  const isCf = (res.headers.get("server") ?? "").toLowerCase().includes("cloudflare")
            || !!res.headers.get("cf-ray");
  if (res.status === 404 && isCf) {
    warning = "Servidor responde via Cloudflare mas /player_api.php retorna 404. Pode estar inativo.";
  }
} catch { /* sondagem é best-effort, ignora falhas */ }

const { error } = await admin.from("allowed_servers").upsert(
  { server_url: url, label, notes }, { onConflict: "server_url" });
if (error) { console.error(error.message); return internalError(); }
return ok({ ok: true, server_url: url, warning });
```

Frontend já trata o retorno; campo extra `warning` é opcional para exibir um toast informativo. **Cadastro continua sempre permitido.**

---

## Camada 3 — Hint amigável no `iptv-login`

**Arquivo:** `supabase/functions/iptv-login/index.ts`

Adicionar um helper que detecta o padrão "404 + corpo curto não-JSON" e devolve uma string de hint:

```ts
function maybeOriginSuspectHint(status: number | undefined, body: string | undefined): string | null {
  if (status !== 404) return null;
  const b = (body ?? "").trim();
  if (!b || b.length > 200) return null;
  // 404 com corpo minúsculo / texto puro = típico de Cloudflare sem origin Xtream
  try { JSON.parse(b); return null; } catch { /* não é JSON, segue */ }
  return "O servidor respondeu mas não parece ser um endpoint Xtream válido. " +
         "Sua DNS pode estar desatualizada — peça uma nova ao provedor.";
}
```

E usá-lo nos dois pontos onde já se devolve erro com `reason`/`body` (linha ~593 no `m3u_register` e linha ~780–781 no fluxo default), passando o hint como campo `extra` do `errorResponse`:

```ts
// m3u_register (linha ~592–593)
const { code, message } = classifyReason(r.reason);
const hint = maybeOriginSuspectHint(r.status, r.body);
return errorResponse(code, message, corsHeaders, { reason: r.reason, ...(hint ? { hint } : {}) });

// default mode (linha ~780–781)
const { code, message } = classifyReason(lastReason);
// captura o último body do loop — declarar `let lastBody = ""` e atualizar dentro do for
const hint = maybeOriginSuspectHint(undefined, lastBody);
return errorResponse(code, message, corsHeaders, { reason: lastReason, ...(hint ? { hint } : {}) });
```

Para o fluxo default precisamos preservar `lastBody` no loop (já existe `lastReason`). Adição mínima: declarar `let lastBody = ""` no escopo do loop e setar `lastBody = r.body ?? ""` quando `!r.ok`.

**HTTP status, código de erro e mensagem principal continuam idênticos.** Só ganha um campo opcional `hint` no JSON.

---

## O que NÃO muda

- Fluxo de auth, proxy, fallback de UA, fallback de portas, allowlist
- Banco de dados (sem migration)
- Player, stream-proxy, stream-token
- Qualquer status HTTP de qualquer função
- Qualquer mensagem `error` ou `code` existente

## Detalhes técnicos

- Sondagem do `allow_server` usa `proxiedFetch` (já importado) e tem timeout de 4 s — não trava o cadastro.
- `extra_warning` e `hint` são `null`/`undefined` por padrão — clientes antigos ignoram.
- A heurística `origin_suspect` só dispara quando **todas** as condições batem (Cloudflare + 100% 404 + zero `user_info`), evitando falso positivo em servidores legítimos que retornam 404 esporádico.
- Nenhuma alteração em `supabase/config.toml`. Edge functions reimplantam automaticamente.

## Resultado

- Painel admin mostra **causa real** do problema (DNS sem origin) em vez de "unknown".
- Admin recebe alerta ao cadastrar uma DNS suspeita, mas pode prosseguir.
- Usuário final vê uma dica útil quando a DNS dele virou um 404-Cloudflare.
- Zero risco de regressão.
