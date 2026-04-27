## Objetivo

Fazer o seu webplayer conseguir acessar painéis IPTV HTTP-only que bloqueiam IP do Supabase Edge (como `bkpac.cc`), sem reescrever o app pra TanStack Start e sem contratar VPS paga.

## Estratégia

Criar um **Cloudflare Worker** (gratuito, 100k requests/dia) que atua como bridge HTTP→HTTPS. Sua edge function `iptv-login` já tem suporte a `IPTV_PROXY_URL` (vimos no código). Basta apontar pro Worker.

```text
[Browser cliente]
      ↓ HTTPS
[supertechweb.lovable.app] (estático Lovable)
      ↓ HTTPS
[iptv-login edge function] (Supabase, IP bloqueado pelo bkpac.cc)
      ↓ HTTPS  ← já existe a integração via IPTV_PROXY_URL
[Cloudflare Worker]  ← NOVO (IP Cloudflare diferente do Supabase)
      ↓ HTTP
[bkpac.cc] (HTTP-only, aceita IP Cloudflare Worker)
```

## Etapas

### 1. Você cria conta Cloudflare (grátis, 5min)
- Acessa https://dash.cloudflare.com/sign-up
- Confirma email
- Vai em **Workers & Pages** → **Create Application** → **Create Worker**
- Dá nome: `iptv-bridge`
- Clica **Deploy**

### 2. Eu te entrego o código do Worker (10 linhas)
```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing url param', { status: 400 });
    const upstream = await fetch(target, {
      method: request.method,
      headers: { 'User-Agent': 'IPTVSmartersPlayer' },
      body: ['GET','HEAD'].includes(request.method) ? null : await request.text(),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  }
};
```
Você cola no editor do Worker e clica **Save & Deploy**. Pronto, fica disponível em `https://iptv-bridge.SEU-USER.workers.dev`.

### 3. Você adiciona o secret `IPTV_PROXY_URL` no Lovable
- Setting do Lovable → Cloud → Secrets
- Nome: `IPTV_PROXY_URL`
- Valor: `https://iptv-bridge.SEU-USER.workers.dev`

### 4. Eu testo (sem alterar código, já está pronto)
- Faço login com `522937712 / 881573355` no seu app
- Se aparecer "Bem-vindo": ✅ Worker passou pelo bloqueio. Problema resolvido pra TODOS painéis assim.
- Se der erro: ❌ admin do bkpac.cc bloqueia Cloudflare em geral. Aí é VPS BR mesmo (te oriento na próxima etapa).

### 5. Bonus (depois que confirmar)
- Adiciono retry/fallback automático no app: se um painel não responde direto, tenta via proxy
- Mensagem clara pro usuário: "Conectando via servidor seguro..."
- Documento como adicionar/trocar VPS no futuro se Worker não bastar

## Backup plan

Se Worker falhar (~30% de chance), próximo passo é VPS BR:
- Hostinger VPS BR R$15/mês (1GB RAM, suficiente)
- Ou Magalu Cloud R$25/mês (BR garantido)
- Mesmo processo: secret `IPTV_PROXY_URL` apontando pra IP da VPS
- Te dou os comandos exatos pra subir Nginx + Caddy proxy

## Custos

| Solução | Custo | Garantia |
|---|---|---|
| Cloudflare Worker | R$0/mês | ~70% (provavelmente passa) |
| VPS BR fallback | R$15-30/mês | 100% |

## Não-objetivos (pra não inflar escopo)

- Não vou reescrever o app pra TanStack Start (semanas de trabalho)
- Não vou consertar agora os 5 outros bugs do app (sw.js 404, theme 401 etc) — depois disso resolvido, voltamos pra esses
- Não vou mexer no design ou em outras features

## Resultado esperado

App `supertechweb.lovable.app` aceitando login com `bkpac.cc` igual o concorrente, sem custo (ou R$15/mês no pior caso).
