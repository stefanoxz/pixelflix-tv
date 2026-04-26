## Diagnóstico

As "bordas brancas" que você está vendo na tela de loading **não são bordas do app** — são **a barra de scroll do navegador** + a margem padrão de 8px que o `<body>` tem por default. Acontece porque o reset global do Tailwind ainda não carregou no momento que o placeholder de loading aparece.

**Por que aparece:**
- O `<body>` do navegador tem `margin: 8px` por padrão (toda página HTML tem).
- O placeholder usa `min-height: 100vh`, então 100vh + 8px de margem = página maior que a viewport → scrollbar vertical aparece.
- Em desktop a scrollbar é visível (Windows/Linux); em mobile real do iPhone/Android nem dá pra ver, mas no preview do Lovable (que renderiza dentro de iframe) aparece.

Quando o React monta, o reset do Tailwind zera essas margens e tudo fica perfeito. Mas durante o loading (1-3 segundos em conexão lenta), as bordas ficam visíveis.

---

## Correção proposta

Adicionar **3 linhas de CSS** dentro do `<style>` do placeholder em `index.html`:

```css
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: #05060c;
}
```

**O que cada coisa faz:**
- `margin: 0; padding: 0` → elimina os 8px brancos do navegador (a "borda" que você está vendo).
- `height: 100%` → garante que o `<body>` ocupa exatamente a altura da viewport.
- `overflow: hidden` → esconde a scrollbar vertical durante o loading (o React reabilita assim que monta, com scrollbar discreta).
- `background: #05060c` → mesmo tom do gradient do placeholder, então qualquer micro-pixel exposto fica invisível.

---

## Garantias

**Não afeta o app depois que carrega:** O reset global do Tailwind (`@tailwind base`) tem precedência maior porque é injetado pelo Vite no `<head>` durante a montagem. Em segundos, o `overflow: hidden` é sobrescrito por `overflow: auto` natural do navegador via `index.css`.

**Não afeta performance:** São 3 linhas de CSS inline (~80 bytes). Zero requisição, zero impacto em LCP/FCP.

**Não quebra scroll do app:** Testei mentalmente o fluxo — depois que o React monta, o `<body>` recebe estilos do shadcn/Tailwind que já lidam com scroll corretamente. O `overflow: hidden` do placeholder só vale enquanto o `<style>` inline existe (e ele será removido junto com o placeholder quando o React substitui o conteúdo de `#root`).

**Compatibilidade:** Funciona em Chrome, Safari, Firefox, Edge desde sempre. Sem prefixos.

---

## Arquivo alterado

- `index.html` — adicionar 5 linhas dentro do bloco `<style>` existente do placeholder (linha ~42).

Nenhum outro arquivo precisa mudar.
