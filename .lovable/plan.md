## Objetivo

Deixar `/admin` confortável de usar no celular sem alterar nada do webplayer (rotas `/`, `/login`, conteúdo etc.). Todas as mudanças ficam dentro de `src/pages/Admin.tsx` e arquivos novos sob `src/components/admin/`.

## Problema atual no mobile

A "sidebar" no mobile vira um bloco vertical com 11 botões empilhados acima do conteúdo. Pra trocar de aba o usuário rola pra cima, encontra o item, clica e rola pra baixo de novo. O header da página também quebra, e ações rápidas (logout, voltar) ficam escondidas.

## Solução

Manter o desktop exatamente como está (sidebar fixa à esquerda) e introduzir um shell mobile dedicado:

### 1. Top bar mobile fixa
- Altura compacta (`h-12`), aparece só em `< lg`.
- Esquerda: botão "menu" (hamburger) que abre um Sheet/Drawer com a navegação completa.
- Centro: título da seção atual (Dashboard, Estatísticas, etc.).
- Direita: badge de papel (Admin/Moderador) e menu de overflow com "Voltar ao app" e "Sair".

### 2. Bottom navigation mobile
- Barra fixa no rodapé (`< lg`), 5 atalhos para as seções mais usadas: Dashboard, Estatísticas, Monitoramento, Reportes, Usuários.
- Item ativo destacado com `text-primary` + indicador.
- As outras 6 seções (DNS errors, Endpoint, Diagnóstico, Servidores, Cadastros, Equipe) ficam acessíveis pelo Drawer do hamburger — incluindo as `adminOnly` que continuam filtradas por papel.

### 3. Drawer (Sheet lateral) com nav completa
- Reaproveita a lista atual de itens (`navItems`) e o filtro `adminOnly`.
- Fecha automaticamente ao escolher uma aba.
- Inclui "Voltar ao app" e "Sair" dentro do próprio drawer.

### 4. Ajustes de conteúdo pra caber no celular
- `<main>` ganha `pb-20 lg:pb-8` pra não esconder conteúdo atrás da bottom-nav.
- Header da página: título reduz pra `text-2xl` em mobile, badges/ações empilham.
- Cartões de stats: grid `grid-cols-2 lg:grid-cols-4` (já tá perto disso, conferir).
- Tabelas largas (login_events, sessions): wrapper `overflow-x-auto` com hint visual de "deslize".

### 5. Webplayer intacto
- Nada fora de `src/pages/Admin.tsx`, `src/components/admin/*`, `src/components/AdminProtectedRoute.tsx` é tocado.
- Sem mudar `App.tsx`, rotas, theme, tokens globais, ou componentes compartilhados (`Button`, `Sheet`, etc.).

## Detalhes técnicos

- Extrair os `navItems` (hoje inline) pra constante exportada num arquivo novo `src/components/admin/adminNav.ts` pra reuso entre sidebar desktop, drawer e bottom-nav.
- Criar `src/components/admin/AdminMobileTopBar.tsx` (Sheet com nav completa).
- Criar `src/components/admin/AdminBottomNav.tsx` (5 atalhos fixos).
- A sidebar desktop atual (`<aside class="lg:w-64 …">`) ganha `hidden lg:flex` pra sumir no mobile (em vez de virar bloco empilhado).
- Bottom-nav usa `fixed bottom-0 inset-x-0 lg:hidden border-t bg-card/95 backdrop-blur z-40`.
- Seleção da aba ativa continua via `setTab(id)` e `searchParams` — sem mudar a lógica de estado existente.
- Sem novos pacotes; usa `Sheet` shadcn já instalado.

## Fora do escopo

- Refatorar painéis individuais (StatsPanel, MonitoringPanel etc.). Só envolvemos eles num shell mobile melhor.
- Mudar tema, cores ou tokens globais.
- Tocar em `/login`, `/`, ou qualquer rota do webplayer.
