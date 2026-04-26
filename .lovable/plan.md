## Objetivo

Limpar dois pontos visuais incômodos na tela inicial, sem afetar performance, sem quebrar desktop e sem alterar nenhuma lógica de dados:

1. **Remover a tira horizontal de capinhas** que aparece embaixo dos botões "Assistir agora / Mais informações" no mobile.
2. **Trocar a "letra/número" do avatar** (o "6" que aparece, que na verdade é o primeiro caractere do username) por um **ícone de pessoa** elegante.

---

## O que muda visualmente

### Hero (mobile)
**Antes:** abaixo dos botões aparece uma tira de até 8 capas pequenas que serve como seletor manual dos destaques rotativos.

**Depois:** a tira some completamente. O carrossel continua rodando automaticamente a cada 8s (sem alteração). O usuário ainda pode trocar de destaque no mobile via swipe? Não — para manter zero risco, removemos o controle manual no mobile, deixando apenas o auto-rotate. Visual mais limpo, foco no título/sinopse/botões.

**Desktop (≥ md):** **nada muda**. Os dots indicadores e a coluna de pôsteres à direita continuam exatamente como estão.

### Avatar (Header — mobile e desktop)
**Antes:** círculo azul com a primeira letra do username (que vira "6" quando o login começa com número, ficando estranho).

**Depois:** mesmo círculo azul gradient, mesmo glow, mesmo tamanho — mas no centro um **ícone de pessoa** (`User` da lucide-react, já importado) em branco. Funciona igual para qualquer username (números, letras, símbolos).

---

## Detalhes técnicos

**Arquivo 1 — `src/pages/Highlights.tsx`**
- Deletar o bloco `{/* MOBILE: tira horizontal de pôsteres */}` (linhas ~280-309), incluindo o container `md:hidden` com o `overflow-x-auto`.
- Não mexer em nada mais: rotação automática, dots desktop, mini-pôsteres laterais e pôster grande permanecem intactos.
- Zero impacto em performance: estamos removendo elementos DOM e imagens (na verdade, melhora levemente o LCP/CLS no mobile porque deixamos de carregar até 8 thumbnails).

**Arquivo 2 — `src/components/Header.tsx`**
- O ícone `User` da lucide-react **já está importado** (linha 2) — sem novo import.
- Substituir o conteúdo `{initial}` em duas ocorrências (linhas ~106 e ~150) por `<User className="h-4 w-4" />` (desktop) e `<User className="h-[18px] w-[18px]" />` (mobile, levemente maior pra acompanhar o `h-9 w-9`).
- Remover as variáveis `username.charAt(0)` / `initial` (linha 42) já que não são mais usadas. Manter `username` (ainda usado no label e dropdown).
- Zero impacto em performance: SVG inline, mesmo bundle, mesmas classes.

**Acessibilidade:** os botões já têm `aria-label="Menu da conta"`, então a troca da inicial pelo ícone (decorativo) está coberta.

---

## O que NÃO muda

- Lógica do carrossel, intervalo de 8s, fila de destaques.
- Layout desktop em todos os aspectos.
- Dropdown do avatar, navegação, rotas, autenticação.
- Cores, gradientes, sombras, tipografia.
- Qualquer comportamento de rede, cache, TMDB, IPTV.
