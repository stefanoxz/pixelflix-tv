## Problema

No mobile (≤640px) a aba **DNS / Servidores** do painel admin fica quebrada:

- Os contadores (`7 usuários`, `1 ok`, `17 falhas`, `último uso há 19h`) entram em `flex-wrap` com `gap-4` e cada item quebra em coluna estreita, virando texto vertical de uma palavra por linha.
- Os 3 botões (**Testar / Editar / Remover**) ficam **sobrepondo** o texto à esquerda, porque o container usa `flex items-center justify-between flex-wrap` mas o bloco de info tem `flex-1` e empurra os botões pra cima do conteúdo no breakpoint estreito.
- A linha de status (`Online · 63ms · HTTP 200 · último ping`) também quebra item por item em vertical.
- A barra superior (busca + “Atualizar pings” + “Cadastrar DNS”) fica apertada — a busca some atrás dos botões.
- O bloco de “Tentativas não autorizadas” logo abaixo tem o mesmo padrão e o mesmo problema.

## Objetivo

Refatorar **apenas o layout responsivo** dos cards de DNS na aba `servers` do `src/pages/Admin.tsx` para que fiquem confortáveis em telas estreitas (≥360px), preservando a aparência atual em desktop (≥768px). Sem mudanças funcionais, sem mudanças de backend, sem mudanças em outras abas.

## Mudanças

### 1. Toolbar superior (busca + ações)
- Em mobile: busca em **linha cheia** no topo; logo abaixo os 2 botões lado a lado, cada um `flex-1`, com texto curto (“Pings” / “Nova DNS”) ou ícone + texto compacto.
- Em ≥sm: comportamento atual (busca à esquerda, botões à direita).

### 2. Card de cada DNS autorizada
Substituir o atual `flex items-center justify-between gap-4 flex-wrap` por um layout em **coluna no mobile, linha no desktop**:

```text
[mobile]                              [desktop ≥md]
┌──────────────────────────────┐      ┌─────────────────────────────────────┐
│ 🛡 umbaplay.site             │      │ 🛡 umbaplay.site   ... [Testar][Editar][Remover]
│ 7 users · 1 ok · 17 falhas   │      │ 7 users · 1 ok · 17 falhas · ...    │
│ último uso há 19h            │      │ ● Online · 63ms · HTTP 200 · 21:03  │
│ ● Online · 63ms · HTTP 200   │      └─────────────────────────────────────┘
│ último ping 21:03            │
│ ┌─────┬───────┬─────────┐    │
│ │Test │Editar │ Remover │    │
│ └─────┴───────┴─────────┘    │
└──────────────────────────────┘
```

Detalhes:
- Container externo: `flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4`.
- Bloco de info: `min-w-0 flex-1 space-y-1`.
- URL: manter `truncate` mas em `block` no mobile e ocupar a largura toda.
- Linha de contadores: trocar `flex flex-wrap gap-4` por `flex flex-wrap gap-x-3 gap-y-0.5` (gap menor) e garantir que cada chip seja `whitespace-nowrap`. Em mobile fica em 1–2 linhas naturais, sem coluna vertical de uma palavra.
- Linha de status (Online / latência / HTTP / último ping): mesmo tratamento — `whitespace-nowrap` em cada chip, `gap-x-2 gap-y-1`.
- Bloco de ações: `flex w-full md:w-auto gap-2`. Em mobile cada botão `flex-1` (preenche a largura igualmente); em ≥md voltam ao tamanho atual.
- Em telas muito estreitas (<400px) os botões mostram só ícone via `hidden xs:inline` no label — manter “Testar/Editar/Remover” visíveis em ≥sm.

### 3. Card de “Tentativas não autorizadas”
Aplicar exatamente o mesmo padrão (coluna no mobile, linha no desktop, ações `w-full md:w-auto`).

### 4. Sem mudanças em
- Lógica de fetch / health / probe / cadastro / remoção.
- Backend, Edge Functions, RLS, migrações.
- Outras abas do admin.

## Detalhes técnicos

- Arquivo único: `src/pages/Admin.tsx`, blocos `<TabsContent value="servers">` (linhas ~1467–1750 aprox.) e os cards `filteredAllowed.map` e `filteredPending.map`.
- Tailwind only — nenhum CSS novo, nenhum componente novo.
- Manter `TooltipProvider` e todos os `Tooltip` existentes intactos.
- Verificar nos breakpoints 360, 411, 640, 768, 1024.

## Fora de escopo

- Nenhuma alteração em outras abas (Stats, Monitor, Stream/Segurança, Manutenção, Usuários, etc.).
- Nenhuma alteração de cores, tema ou copy fora do necessário pra encurtar rótulos no mobile.
- Nenhuma nova feature.
