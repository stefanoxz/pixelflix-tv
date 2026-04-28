# Ordenação de categorias em Canais ao Vivo

## O que muda

Adicionar um pequeno seletor no topo da lista "Categorias" com 3 opções:

- **A → Z** (alfabética crescente, padrão atual)
- **Z → A** (alfabética decrescente)
- **Servidor** (ordem em que o IPTV retornou, sem reordenar)

Favoritos e "Todos os canais" continuam **fixos no topo**, fora da ordenação.

A escolha é **persistida** no `localStorage` por usuário, então fica memorizada entre sessões.

Funciona tanto no **rail desktop** (lateral esquerda) quanto no **drawer mobile** (aba Categorias).

## Como vai aparecer

```text
┌─ Categorias ──────────[A↓ Z↓ ⇅]┐
│  ⭐ Favoritos              (12) │  ← fixos
│  ▦  Todos os canais       (847)│  ← fixos
│  ────────────────────────────  │
│  📁 AMAZON PRIME           (8) │  ← ordenados
│  📁 AMAZON PRIME ALTER     (8) │
│  📁 CINE SKY              (24) │
│  ...                            │
└─────────────────────────────────┘
```

Pequeno grupo de 3 botões/ícones (ToggleGroup) no header de "Categorias", alinhado à direita do título. Visual minimalista pra não poluir.

## Arquivos a alterar

1. **`src/hooks/useCategorySortPreference.ts`** *(novo)*
   - Hook simples que lê/grava `live_category_sort` no `localStorage`
   - Retorna `{ sort, setSort }` com tipo `'az' | 'za' | 'server'`
   - Default: `'az'` (mantém comportamento atual)

2. **`src/components/live/ChannelCategoryRail.tsx`**
   - Adicionar prop `sort` e `onSortChange`
   - Substituir o `sort()` fixo por lógica condicional:
     - `'az'`: `localeCompare(pt-BR)` (atual)
     - `'za'`: `localeCompare` invertido
     - `'server'`: mantém ordem do array recebido
   - Adicionar `ToggleGroup` compacto no header com ícones (`ArrowDownAZ`, `ArrowDownZA`, `ListOrdered` do lucide-react)

3. **`src/components/live/MobileChannelDrawer.tsx`**
   - Mesmo `ToggleGroup` no topo da aba "Categorias"
   - Aplicar a mesma ordenação na lista mobile

4. **`src/pages/Live.tsx`**
   - Usar o hook `useCategorySortPreference()`
   - Passar `sort` e `onSortChange` para `ChannelCategoryRail` e `MobileChannelDrawer`

## Detalhes técnicos

- A ordem "Servidor" usa o array exatamente como vem de `getLiveCategories()` — sem `.sort()`, mantendo a sequência definida no painel do provedor IPTV.
- A ordenação é puramente client-side, em `useMemo`, sem custo de rede.
- Nenhuma mudança no backend, banco, edge functions ou contrato de API.
- Acessibilidade: ToggleGroup com `aria-label` em cada opção ("Ordenar A a Z", etc.) e tooltip no hover.
