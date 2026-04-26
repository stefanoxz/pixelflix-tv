# Tornar o SuperTech instalável como aplicativo

## O que o usuário vai ter

Depois desta mudança, qualquer pessoa que acessar **pixelflix-tv.lovable.app** (ou seu domínio próprio) no Chrome, Edge, Brave ou Opera vai ver um **ícone de instalação na barra de endereço**. Ao clicar:

- No **Windows/Linux/Mac**: o app aparece no menu iniciar/launchpad com ícone próprio do SuperTech, abre em **janela dedicada sem barra do navegador**, parecendo um app nativo. Atualizações chegam automaticamente.
- No **Android**: opção "Instalar app" no menu do navegador → vira ícone na tela inicial.
- No **iPhone/iPad**: Compartilhar → "Adicionar à Tela de Início".

A janela abre limpa, com a logo do SuperTech como splash, sem URL nem abas — experiência idêntica a um app instalado.

## Abordagem técnica: manifest puro (sem service worker)

Como você não precisa de offline, **não vamos usar `vite-plugin-pwa` nem service workers**. Essa é a abordagem mais simples e segura, recomendada pela própria documentação do Lovable quando o objetivo é só instalabilidade. Evita:

- Problemas de cache desatualizado no preview do Lovable
- Conflitos com o Supabase Auth (`/~oauth` redirects)
- Complexidade desnecessária

A instalabilidade é garantida apenas por um arquivo `manifest.json` válido + meta tags + ícones nos tamanhos certos. Isso é o suficiente para o Chrome/Edge mostrarem o botão de "Instalar".

## Arquivos a criar/editar

### 1. `public/manifest.json` (novo)
Define nome, cores, ícones e modo de exibição:
```json
{
  "name": "SuperTech IPTV",
  "short_name": "SuperTech",
  "description": "Player IPTV web premium...",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "lang": "pt-BR",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 2. Ícones em `public/`
Vou gerar a partir do `logo-supertech.webp` existente (usando a ferramenta de imagem do sandbox):
- `icon-192.png` — 192x192 (Android home screen)
- `icon-512.png` — 512x512 (splash screen e instalação)
- `icon-maskable-512.png` — 512x512 com padding seguro (para ícones adaptativos do Android que cortam em círculo/squircle)
- `apple-touch-icon.png` — 180x180 (iOS home screen)

### 3. `index.html` — adicionar meta tags PWA
No `<head>`, adicionar:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0a0a0a">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="SuperTech">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

## Como o usuário instala (instruções para passar aos clientes)

**No PC (Chrome/Edge):**
1. Acessar pixelflix-tv.lovable.app
2. Clicar no ícone de monitor com seta (📥) que aparece na barra de endereço, à direita
3. Confirmar "Instalar" → o app aparece no menu iniciar e na área de trabalho

**No Android:** menu do Chrome → "Instalar app"
**No iPhone:** Compartilhar (Safari) → "Adicionar à Tela de Início"

## Importante: só funciona na URL publicada

PWA **não funciona no preview do Lovable** (o iframe de preview bloqueia instalação por segurança). Para testar, você precisa **clicar em Publicar** e acessar a URL `pixelflix-tv.lovable.app` diretamente no navegador (fora do editor). O botão de instalação só aparece lá.

## Fora do escopo

- Cache offline / service worker (você confirmou que não precisa)
- Notificações push
- App nativo .exe / .dmg (Electron) — pode ser feito depois se quiser, mas PWA já cobre 99% do caso de uso
- Publicação em lojas (Google Play / Microsoft Store) — possível via Trusted Web Activity, mas é outro projeto
