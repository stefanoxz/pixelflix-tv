Refazer o estado "Conectando" do player com base na referência

Visual final do loading (todos os conteúdos: filme, série e live):

```text
┌──────────────────────────────────────────┐
│ [← Pressione Esc]                        │  ← já existe (PlayerOverlay)
│                                          │
│           ┌──────────────┐               │
│           │              │               │
│           │   POSTER     │               │
│           │   (ou logo   │               │
│           │   do canal)  │  ↻ spinner    │
│           │              │  Conectando…  │
│           └──────────────┘               │
│                                          │
└──────────────────────────────────────────┘
        fundo preto sólido, sem blur
```

Mudanças em `src/components/Player.tsx`

1. **Substituir o overlay de loading atual** (`{loading && !error && …}`)
   - Fundo: `bg-black` sólido (sem gradiente, sem halo).
   - Conteúdo central: poster do conteúdo num card com `aspect-[2/3]` (filme/série) ou `aspect-square` (live com logo do canal), `max-h-[70%]`, `rounded-lg`, `shadow-2xl`.
   - Sobre o poster, no centro: spinner branco/discreto + texto "Conectando..." abaixo, usando `text-sm font-medium text-white` (não mais all-caps spaced).
   - Fallback quando `poster` não existir: só o spinner + "Conectando..." centralizados (mantém visual atual minimalista).

2. **Esconder durante o loading** (`loading && !error`):
   - Toolbar superior (skip, speed, flag, X interno).
   - Badge de status "Conectando" inferior direito (redundante com o overlay).
   - Botão "Logs" inferior esquerdo.
   - Título do conteúdo no topo (a referência mostra título, mas o usuário escolheu "só Esc" — fica só o `← Pressione Esc para fechar` que já é desenhado pelo `PlayerOverlay`).

3. **Mantém comportamento**: assim que o vídeo começa (`!loading`), todos os controles voltam normalmente como já estão.

Implementação: ajustar 4 condicionais (`loading && !error` extra) nos blocos de toolbar/badge/logs e reescrever o bloco do overlay de loading. Sem mudança no `PlayerOverlay.tsx` — o "← Pressione Esc" dele já é exatamente o da referência.