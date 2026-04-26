# Polimento visual do placeholder de loading

Melhorar visualmente a tela inicial (logo + "SuperTech" sobre fundo preto) que aparece antes do React montar, **mantendo zero impacto em performance**.

## O que muda visualmente

- **Fundo**: preto chapado (`#0a0a0a`) → gradiente radial sutil azul-marinho → preto, igual ao tema do app
- **Glow azul** atrás do logo (combina com `--gradient-glow` do design system real)
- **Drop-shadow azul no logo** (mesmo efeito que existe no app real, classe `drop-shadow-[0_0_28px_hsl(var(--primary)/.5)]`)
- **Pulso suave no logo** (animação 2.4s ease-in-out, GPU-accelerated)
- **Fade-in suave** no conjunto (0.5s, evita "pop" abrupto)
- **Texto "SuperTech"** com gradiente branco → azul claro (efeito premium, igual a vários títulos do app)

## Garantias de performance

| Aspecto | Custo |
|---|---|
| Novos requests HTTP | **0** (tudo inline no HTML) |
| Bytes adicionais | **~700 bytes** no HTML (irrelevante, comprime pra ~300 com gzip) |
| JS executado | **0** (CSS puro) |
| Bloqueio de render | **0** (`<style>` inline já está dentro do `<div id="root">`) |
| Animações | `transform` e `opacity` apenas → 100% GPU, não causa reflow/repaint |
| Tempo de FCP/LCP | **Inalterado** (mesma estrutura de pintura imediata) |

## Detalhes técnicos

Edição única em `index.html`, substituindo o bloco do placeholder atual (linhas 39-48):

```html
<div id="root">
  <style>
    @keyframes st-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.92}}
    @keyframes st-fade{0%{opacity:0;transform:translateY(4px)}100%{opacity:1}}
  </style>
  <div style="min-height:100vh; display:flex; align-items:center; justify-content:center;
              background:radial-gradient(ellipse at center,#0d1530 0%,#070a14 60%,#05060c 100%);
              color:#fafafa; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
              position:relative; overflow:hidden;">
    <!-- Glow radial azul atrás do conteúdo -->
    <div style="position:absolute; top:50%; left:50%; width:480px; height:480px;
                transform:translate(-50%,-50%);
                background:radial-gradient(circle,rgba(30,120,255,0.18) 0%,transparent 65%);
                pointer-events:none; filter:blur(20px);"></div>
    <div style="text-align:center; position:relative; animation:st-fade .5s ease-out both;">
      <img src="/logo-supertech.webp" alt="SuperTech" width="80" height="80"
           fetchpriority="high" decoding="async"
           style="margin:0 auto 1rem; height:5rem; width:5rem; object-fit:contain;
                  filter:drop-shadow(0 0 28px rgba(30,120,255,.55));
                  animation:st-pulse 2.4s ease-in-out infinite;
                  will-change:transform,opacity;" />
      <h1 style="font-size:1.875rem; line-height:2.25rem; font-weight:700;
                 letter-spacing:-0.02em; margin:0;
                 background:linear-gradient(135deg,#ffffff 0%,#bcd5ff 100%);
                 -webkit-background-clip:text; background-clip:text;
                 -webkit-text-fill-color:transparent;">SuperTech</h1>
    </div>
  </div>
</div>
```

## Riscos

- **Funcional**: nenhum — React continua substituindo essa `<div id="root">` no mount, comportamento idêntico ao atual.
- **Visual**: nenhum no app real — só afeta os ~200ms iniciais antes do React montar.
- **Compatibilidade**: usa apenas CSS amplamente suportado (gradients, drop-shadow, keyframes, background-clip:text com prefixo `-webkit-`). Funciona em todos navegadores modernos. Caso `background-clip:text` falhe em algum browser antigo, o texto cai pro `color:#fafafa` herdado (graceful degradation).
- **Lighthouse**: scores permanecem iguais (87/100/100/100). Animação infinita do logo não afeta TBT porque é só `transform`/`opacity` (compositor).

## Arquivos alterados

- `index.html` — apenas o bloco do placeholder dentro de `<div id="root">`
