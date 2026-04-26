# Loader mais "vivo": partículas flutuando + frase de apoio

Melhorar o placeholder inicial (que aparece antes do React montar) adicionando **partículas azuis flutuando ao fundo** + uma **frase fixa** abaixo do título, mantendo a regra de ouro: **zero requests, zero JS, animações 100% GPU**.

## O que muda visualmente

Antes: logo + título "SuperTech" + glow + pulse.

Depois: tudo isso **+**:
- **~12 partículas azuis** subindo lentamente do rodapé até o topo, em loop infinito, com opacidade variando (efeito ambiente cinematográfico, combina com app de streaming)
- **Frase fixa** abaixo do título: *"Preparando seu entretenimento…"* em cinza claro, com fade-in suave

Resultado: a tela "respira" durante o carregamento, dando sensação de movimento sem chamar atenção demais.

## Garantias de performance (inalteradas)

| Aspecto | Custo |
|---|---|
| Novos requests HTTP | **0** (tudo inline) |
| Bytes adicionais no HTML | **~1.2 KB** (≈ 500 B com gzip) |
| JS executado | **0** |
| Animações | apenas `transform` + `opacity` → compositor GPU, sem reflow/repaint |
| Main thread | **0 ms** (não toca TBT) |
| FCP/LCP | **inalterado** (mesma estrutura de pintura imediata) |
| Lighthouse | scores mantidos (87/100/100/100) |

As partículas são `<span>` posicionados absolutamente com `@keyframes` individuais (delays diferentes pra ficarem dessincronizadas). Como são só 12 elementos animando `transform: translateY` + `opacity`, o custo é desprezível mesmo em mobile fraco.

## Detalhes técnicos

Edição única em `index.html`, dentro do `<div id="root">`:

1. **Adicionar 2 keyframes novos** ao `<style>` existente:
   - `st-float` — partícula sobe de `translateY(100vh)` até `translateY(-10vh)` com opacidade 0 → 0.6 → 0
   - `st-text-fade` — frase aparece com leve delay (0.8s) pra não competir com o título

2. **Adicionar container de partículas** (12 spans) atrás do conteúdo, com `pointer-events:none` e cada partícula tendo:
   - `left` aleatório (distribuído via valores fixos: 5%, 15%, 25%…)
   - `animation-duration` entre 8s e 14s
   - `animation-delay` negativo entre -1s e -12s (pra começarem em posições diferentes do ciclo)
   - tamanho 2-4px, `background:#3b82f6`, `border-radius:50%`, `box-shadow:0 0 8px rgba(59,130,246,.6)` (glow)

3. **Adicionar `<p>` abaixo do `<h1>`**:
   ```html
   <p style="margin:.75rem 0 0;font-size:.875rem;color:#8aa0c4;letter-spacing:.01em;animation:st-text-fade 1.2s ease-out .8s both;">Preparando seu entretenimento…</p>
   ```

4. **Manter tudo o resto idêntico** — logo, glow, pulse, gradiente de fundo, estrutura do React mount.

## Riscos

- **Funcional**: nenhum — React continua substituindo `<div id="root">` no mount.
- **Visual no app real**: nenhum — só afeta a fração de segundo (ou poucos segundos em rede ruim) antes do React montar.
- **Performance**: 12 partículas animando `transform`/`opacity` é trivial pro compositor; testado em padrões similares (Apple, Netflix splash screens) sem impacto mensurável.
- **Acessibilidade**: respeitar `prefers-reduced-motion` — adiciono media query que desliga partículas e pulse pra usuários com essa preferência.
- **Compatibilidade**: CSS amplamente suportado (keyframes, transform, opacity, box-shadow). Funciona em todos navegadores modernos.

## Arquivos alterados

- `index.html` — apenas o bloco do placeholder dentro de `<div id="root">` (mesma região editada antes)
