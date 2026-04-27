# Cloudflare Worker — Bridge HTTPS pro IPTV

Este Worker serve como **bridge HTTPS→HTTP** pro seu webplayer. Ele resolve dois problemas de uma vez:

1. **Mixed Content**: navegador HTTPS não consegue chamar painéis HTTP — o Worker traduz.
2. **IP bloqueado**: alguns painéis (ex.: `bkpac.cc`) bloqueiam o IP do Supabase Edge — o Worker sai por outro IP Cloudflare que normalmente passa.

Custo: **R$0/mês** (100k requests/dia grátis).

---

## Passo 1 — Criar conta Cloudflare (5 min)

1. Acessa https://dash.cloudflare.com/sign-up
2. Cadastra email + senha
3. Confirma email no inbox

---

## Passo 2 — Criar o Worker

1. Logado no dashboard, vai em **Workers & Pages** (menu lateral esquerdo)
2. Clica **Create application** → **Create Worker**
3. Nome: `iptv-bridge` (ou outro à sua escolha)
4. Clica **Deploy**
5. Depois clica **Edit code**

---

## Passo 3 — Colar o código abaixo

Apaga TUDO que tiver no editor e cola **exatamente** isto:

```js
// Cloudflare Worker — IPTV HTTPS bridge
// Recebe: GET/POST https://iptv-bridge.SEU.workers.dev/?url=ENCODED_TARGET
// Encaminha pro target (HTTP ou HTTPS), repassa body+headers, devolve resposta crua.

const ALLOWED_TARGET_PROTOCOLS = ['http:', 'https:'];

// CORS aberto — quem chama esse Worker é nossa edge function (server-side),
// mas habilitar CORS facilita debug pelo browser.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('Missing ?url= param', { status: 400, headers: CORS });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid target URL', { status: 400, headers: CORS });
    }
    if (!ALLOWED_TARGET_PROTOCOLS.includes(targetUrl.protocol)) {
      return new Response('Only http/https targets allowed', { status: 400, headers: CORS });
    }

    // Headers que nossa edge function envia prefixados com x-iptv-*
    // são desembrulhados aqui pra ir como header real pro alvo.
    const fwdHeaders = new Headers();
    for (const [k, v] of request.headers.entries()) {
      const lk = k.toLowerCase();
      if (lk.startsWith('x-iptv-')) {
        fwdHeaders.set(lk.slice('x-iptv-'.length), v);
      }
    }
    // User-Agent default — VLC/IPTVSmarters costumam ser aceitos.
    if (!fwdHeaders.has('user-agent')) {
      fwdHeaders.set('user-agent', 'VLC/3.0.20 LibVLC/3.0.20');
    }
    if (!fwdHeaders.has('accept')) {
      fwdHeaders.set('accept', 'application/json, */*');
    }

    let body = null;
    if (!['GET', 'HEAD'].includes(request.method)) {
      body = await request.arrayBuffer();
    }

    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: fwdHeaders,
        body,
        redirect: 'follow',
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ proxy_error: String(err) }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // Repassa status + content-type, descartando headers que confundem o consumer
    // (CORS dele, set-cookie de outro domínio, etc.)
    const respHeaders = new Headers(CORS);
    const ct = upstream.headers.get('content-type');
    if (ct) respHeaders.set('content-type', ct);
    const cl = upstream.headers.get('content-length');
    if (cl) respHeaders.set('content-length', cl);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  }
};
```

Clica **Save and deploy** (botão azul em cima à direita).

---

## Passo 4 — Copiar a URL do Worker

Depois do deploy, em cima do editor aparece a URL pública do tipo:

```
https://iptv-bridge.SEU-USER.workers.dev
```

Copia essa URL. Vamos usar no próximo passo.

---

## Passo 5 — Configurar `IPTV_PROXY_URL` no seu app

Aqui no Lovable, peça pro chat (ou faça você mesmo no Settings → Cloud → Secrets):

- Nome: `IPTV_PROXY_URL`
- Valor: `https://iptv-bridge.SEU-USER.workers.dev` (a URL que você copiou)

⚠️ **Importante**: a URL do Worker é **HTTPS**. Nossa edge function detecta isso automaticamente e usa o modo REST bridge (não tenta conectar como CONNECT proxy). Não precisa prefixo nem nada — só cola a URL crua.

---

## Passo 6 — Testar

No app webplayer, faz login com:
- DNS: `http://bkpac.cc`
- User: `522937712`
- Pass: `881573355`

### O que esperar nos logs (Lovable Cloud → Edge Functions → iptv-login)

**Se Worker funcionou** ✅:
```
[proxied-fetch] proxy REST disponível (fallback): https://iptv-bridge...
[proxied-fetch] route=direct host=bkpac.cc FAIL (...): connection reset by peer
[proxied-fetch] direct falhou — retentando via proxy(rest)
[proxied-fetch] route=proxy(rest) host=bkpac.cc status=200
```
E o usuário entra normalmente.

**Se Worker também foi bloqueado** ❌ (admin do bkpac.cc bloqueia Cloudflare em geral):
```
[proxied-fetch] route=proxy(rest) host=bkpac.cc FAIL: connection reset
```
Aí precisamos partir pra VPS BR. Me chama que te oriento.

---

## Limites do plano grátis Cloudflare

- **100.000 requests/dia** (suficiente pra ~3000 usuários ativos por dia)
- **10ms CPU por request** (sobra muito pra um simples proxy)
- Worker fica **desativado** se passar do limite — volta no dia seguinte
- Pra mais que isso: plano Workers Paid US$5/mês = 10 milhões/mês

---

## Como migrar pra VPS no futuro (se quiser garantia 100%)

A mesma variável `IPTV_PROXY_URL` aceita 3 formatos:

```
# Cloudflare Worker (HTTPS REST bridge)
IPTV_PROXY_URL=https://iptv-bridge.SEU.workers.dev

# VPS com proxy HTTP autenticado (Squid, Tinyproxy, etc.)
IPTV_PROXY_URL=http://usuario:senha@meuservidor.com.br:3128

# Forçar modo manualmente se ambíguo
IPTV_PROXY_URL=rest:https://qualquer-bridge.com
IPTV_PROXY_URL=connect:http://meuserver.com:8080
```

A edge function detecta automaticamente. Trocar de Worker pra VPS é só atualizar o secret — sem alteração de código.
