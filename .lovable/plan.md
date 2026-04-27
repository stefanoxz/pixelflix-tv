## Objetivo

Duas melhorias de usabilidade no mobile:

1. **Botão de categorias** (em Filmes/Séries): hoje aparece como um pequeno ícone de funil sem rótulo no mobile (`<span className="hidden xs:inline">`), o que confunde o cliente. Vamos torná-lo mais visível e identificável.
2. **Nome do cliente no header mobile**: hoje o avatar aparece sozinho. Vamos adicionar o primeiro nome ao lado do avatar, com abreviação automática para nomes longos preservando a harmonia do layout.

---

## 1. Botão "Categorias" mais identificável (mobile)

Arquivo: `src/components/library/LibraryTopBar.tsx`

**Como está hoje:**
- Botão `outline` pequeno, com ícone de funil + texto "Categorias" escondido em telas muito estreitas (`xs:inline`).
- Visualmente compete com o relógio/data e passa despercebido.

**Mudança:**
- Sempre mostrar o texto "Categorias" no mobile (remover o `hidden xs:inline`).
- Tornar o botão mais proeminente:
  - Variante `default` (preenchido com cor primária suave) ou `secondary` com leve `ring`/`shadow-glow`, em vez de `outline`.
  - Tamanho um pouco maior (`h-9`, padding horizontal maior).
  - Trocar o ícone `Filter` por `LayoutGrid` (mais associado a "categorias/listas") e manter o rótulo visível.
- No desktop (`lg:`+), o botão continua oculto (a sidebar de categorias já está visível).

Resultado esperado no mobile: um botão claro com `[grid] Categorias` destacado à direita do título, fácil de identificar.

---

## 2. Nome do cliente ao lado do avatar (header mobile)

Arquivo: `src/components/Header.tsx`

**Como está hoje:**
- No desktop o nome aparece truncado com `max-w-[120px]`.
- No mobile só aparece o avatar (sem nome).

**Mudança:**
- No bloco mobile (`<div className="md:hidden">`), adicionar um `<span>` com o nome ao lado do avatar.
- Aplicar uma função utilitária de abreviação para preservar a harmonia:
  - Se o nome inteiro couber em ~12 caracteres → mostra inteiro.
  - Se tiver múltiplas palavras → mostra "Primeiro Ú." (primeiro nome + inicial do último).
  - Se ainda for grande → mostra apenas o primeiro nome, e se este for muito longo, trunca em ~10 caracteres + "…".
- Adicionar fallback: se `displayName`/`username` estiverem vazios, não renderiza o span (mantém só o avatar).
- Tipografia: `text-xs font-medium text-foreground/90`, `max-w-[110px]`, `truncate` como cinto de segurança.

**Local da nova função utilitária:** `src/lib/displayName.ts` — adicionar `abbreviateName(name: string, maxLen = 12): string` exportada e reutilizável (também útil futuramente em saudações).

Exemplos:
- "Ana" → "Ana"
- "Maria Silva" → "Maria Silva"
- "Ricardo Albuquerque" → "Ricardo A."
- "Joaozinhodasilva" → "Joaozinho…"

---

## Arquivos modificados

- `src/lib/displayName.ts` — adicionar export `abbreviateName`.
- `src/components/Header.tsx` — exibir nome abreviado ao lado do avatar no bloco mobile.
- `src/components/library/LibraryTopBar.tsx` — botão de categorias mais visível (rótulo sempre visível no mobile, novo ícone `LayoutGrid`, estilo destacado).

Sem mudanças em backend, rotas ou contratos.

---

## Validação visual

Após aplicar, conferir no viewport mobile (~411px) em `/movies` e `/series`:
- Header mostra: `[logo] SuperTech … [avatar] Nome` (alinhados, sem quebra).
- Topbar da página mostra: `← [ícone] Filmes … [grid Categorias] [hora]` (botão Categorias claramente identificável).
- Em `/` (Destaques) o botão de categorias não aparece (não é passado prop), comportamento mantido.
