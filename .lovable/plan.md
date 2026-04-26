# Análise visual do SuperTech — pontos a polir

Fiz uma varredura nas principais telas (Destaques, Filmes, Séries, Live, Conta, Login, Header). O sistema já está bonito e coeso, mas tem **inconsistências e detalhes** que, se ajustados, dão um salto de "bom" pra "premium estilo Netflix/Apple TV". Abaixo o diagnóstico e o que proponho.

---

## 1. Inconsistências entre páginas (alta prioridade)

**Problema**: cada página tem um header/topbar diferente.
- `Filmes` e `Séries` usam `LibraryTopBar` (relógio + data + voltar).
- `Live` tem header próprio inline (sem relógio, sem botão voltar, layout diferente).
- `Destaques` não tem topbar nenhum — só o `Header` global.
- `Conta` tem só um título solto `<h1>`.

**Proposta**: padronizar — `Live` e `Conta` adotam o mesmo padrão de `LibraryTopBar` (com ícone + título + relógio + data). `Destaques` mantém o hero, mas alinha tipografia.

---

## 2. Header global

**Problemas**:
- Largura `max-w-[1600px]` no header conflita com `max-w-[1800px]` das páginas (desalinha).
- Logo + nome ocupa muito espaço; em telas médias o menu encosta no botão "Sair".
- Hover dos itens de nav é sutil demais (`bg-secondary/50`) — pouco feedback.
- Botão "Sair" no desktop está sempre visível; comum em apps modernos é ficar dentro de um avatar/dropdown.

**Proposta**:
- Unificar largura em `max-w-[1800px]`.
- Aumentar contraste do estado active (barra inferior animada estilo iOS, em vez de fundo).
- Mover "Sair" pra dentro de um menu de avatar (`DropdownMenu`) com inicial do usuário, status da assinatura e atalho pra Conta.
- Adicionar animação suave de underline no hover dos itens.

---

## 3. Hero da página de Destaques

**Problemas**:
- Altura fixa `60vh min-h-420px` — em monitor ultrawide fica esticado horizontalmente com pouca informação.
- Imagem de fundo com `opacity-40` é forte demais e compete com o texto.
- Os 12 indicadores (bolinhas) embaixo poluem em mobile.
- Botão CTA "Assistir agora" usa `bg-gradient-primary` mas não tem hover state diferenciado (só `opacity-90`).
- Falta sinopse real do filme (atualmente texto genérico "Descubra milhares de filmes...").

**Proposta**:
- Reduzir opacidade do background pra `opacity-25` + `blur-sm` em quem não está ativo.
- Aumentar `h-[70vh]` em desktop pra dar mais respiro.
- Indicadores: limitar a 5-7 visíveis com fade nas extremidades em mobile.
- Adicionar metadata real do TMDB embaixo do título (nota, ano, gênero).
- Botão "Assistir agora" ganha micro-interação (scale + glow no hover).
- Adicionar gradient lateral mais forte à esquerda pra texto destacar de qualquer poster.

---

## 4. Quick Stats (Destaques)

**Problema**: 3 cards simples com ícone + número. Funciona, mas é o ponto mais "amador" da home.

**Proposta**:
- Adicionar mini-sparkline ou ícone animado.
- Hover: card eleva (translateY -2px) + brilho na borda.
- Adicionar um 4º card opcional ("Continuar assistindo") quando houver histórico.

---

## 5. Cards de mídia (PosterCard / MediaCard)

**A confirmar lendo os componentes**, mas sintomas observados:
- Cards possivelmente sem skeleton durante load (PosterGrid mostra `isLoading`, mas o estilo do skeleton pode estar genérico).
- Badge de rating TMDB pode estar pesado visualmente.
- Hover poderia ter "peek" estilo Netflix (info expande embaixo da capa).

**Proposta**: revisar `PosterCard.tsx` e `MediaCard.tsx`, padronizar:
- Ratio 2:3 com radius `rounded-lg`.
- Badge TMDB no canto superior direito, semi-transparente, com ícone estrela menor.
- Hover: leve scale (1.03) + sombra colorida + título aparece embaixo (não em overlay).

---

## 6. Tipografia e hierarquia

**Problemas**:
- Títulos `h1` variam: `text-2xl md:text-3xl` (Conta), `text-4xl md:text-6xl` (Hero), `text-lg md:text-2xl` (LibraryTopBar), `text-xl sm:text-2xl` (Live).
- Pesos misturados (`font-bold`, `font-semibold`).
- `tracking-tight` aplicado em alguns lugares e em outros não.

**Proposta**: definir 3 tamanhos canônicos:
- Page title (topbar): `text-xl md:text-2xl font-bold tracking-tight`
- Section title: `text-lg md:text-xl font-semibold`
- Hero title: `text-4xl md:text-6xl font-bold tracking-tight`

---

## 7. Página Live — pequenos ajustes

**Problemas**:
- Header inline diferente das outras páginas (vide #1).
- Search box no desktop tem largura fixa `w-72` — fica isolada.
- FAB mobile "Canais" duplica função do botão "Canais" no header (em viewport médio aparecem os dois).
- Lista de canais: borda `border-border/50` em vez do `border-border/40` usado nas outras páginas.

**Proposta**: aplicar `LibraryTopBar` + remover botão duplicado no mobile + padronizar bordas.

---

## 8. Página Conta — densidade

**Problemas**:
- Vários cards grandes empilhados (info, sessão, favoritos) fazem rolagem longa.
- "Sessão atual" é uma seção inteira pra 1 linha de info.
- Favoritos: contadores + listas separadas duplicam informação.

**Proposta**:
- Combinar info do usuário + sessão atual em **um card único** com 2 colunas.
- Favoritos: remover contadores duplicados (já aparece no header da lista) e usar abas ou seções colapsáveis.
- Adicionar avatar com inicial colorida em vez do ícone genérico de usuário.

---

## 9. Login

**Problemas**:
- Card centralizado mas sem profundidade real (sombra fraca).
- Background com 2 gradientes radiais, mas faltam elementos sutis (partículas, blur orb animado).
- Logo grande (96x96) + título "SuperTech" duplica a marca.

**Proposta**:
- Adicionar 2-3 "blur orbs" animados no fundo (estilo Linear/Vercel).
- Aumentar shadow e backdrop-blur do card.
- Reduzir logo pra 72px ou mover só o gradiente do nome.

---

## 10. Microinterações faltando

Itens que dariam sensação de "vivo":
- Toast loading no botão "Entrar" já existe, bom.
- Faltam: skeleton com shimmer (já tem keyframe `shimmer` no Tailwind mas não aplicado nos posters).
- Transições de página (`fade-in` existe, aplicar no `<main>`).
- Hover dos cards de stats sem animação no ícone.
- Scrollbar customizada já existe — bom.

---

## 11. Mobile — pontos de atenção

- Hero em mobile fica cortado (texto em 1 coluna mas botões ocupam 2 linhas).
- TopBar mobile mostra relógio + data + botão filtro + título — pode espremer demais em 360px.
- Drawer de categorias: revisar se tem search dentro.

---

# Plano de execução (em ordem de impacto visual)

Vou propor implementar em **fases**, cada uma é uma entrega testável:

### Fase 1 — Fundação (consistência)
1. Padronizar tipografia (utilitário `.page-title`, `.section-title` no `index.css`).
2. Unificar `max-w-[1800px]` no header e em todas as páginas.
3. Aplicar `LibraryTopBar` na Live e na Conta.
4. Padronizar bordas `border-border/40` em todos os shells.

### Fase 2 — Header premium
5. Trocar "Sair" por avatar + dropdown menu.
6. Trocar bg-active dos nav items por underline animado.

### Fase 3 — Hero e Destaques
7. Hero: opacity menor + blur nos inativos + gradient lateral mais forte.
8. Adicionar metadata TMDB real abaixo do título.
9. Cards de stats: hover mais rico + ícone animado.

### Fase 4 — Cards e listas
10. Revisar PosterCard/MediaCard: hover scale + badge TMDB elegante.
11. Skeleton com shimmer real.

### Fase 5 — Login + Conta
12. Login: blur orbs animados + sombra mais profunda no card.
13. Conta: combinar info+sessão em 1 card; favoritos em abas.

---

## Como prefere proceder?

Posso fazer **todas as fases de uma vez** (entrega grande) ou **fase por fase** (você aprova cada etapa). Recomendo começar pelas **Fases 1+2+3** num ciclo só — é o que mais transforma a percepção do app e tem baixo risco. Depois fazemos 4 e 5.

Me confirma se quer assim ou se prefere recortar alguma fase específica.