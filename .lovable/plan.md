## Análise dos erros restantes

Após o último fix, **não há mais runtime errors** (`removeChild` está resolvido). Restaram apenas **2 warnings** no console, ambos vindos da página de Login:

### 1. `React does not recognize the fetchPriority prop on a DOM element`

Em `src/pages/Login.tsx` linha 281, o `<img>` do logo usa `fetchPriority="high"` (camelCase). No React 18, a forma correta para esse atributo HTML5 é **lowercase** (`fetchpriority`). O React não converte automaticamente.

### 2. `Function components cannot be given refs` em `Login`

Esse warning é um efeito colateral do anterior. Quando o React detecta uma prop desconhecida em um componente "indeterminate", o validador (`validateFunctionComponentInDev`) também emite o aviso de ref como falso positivo no mesmo ciclo. Stack confirma: ambos os warnings vêm da mesma `<img>` em Login dentro do `<Card>`. Ao corrigir #1, #2 desaparece junto.

## Mudança

Trocar uma única linha em `src/pages/Login.tsx` pelo mesmo padrão usado em `Highlights.tsx`:

```tsx
// antes
fetchPriority="high"

// depois
{...({ fetchpriority: "high" } as Record<string, string>)}
```

Esse cast burla a checagem de tipos do React (que não conhece o atributo) e emite o nome correto em lowercase no DOM.

## Arquivo

- `src/pages/Login.tsx` (linha 281)

## Resultado esperado

- Console limpo (zero warnings, zero errors).
- Logo continua sendo carregado com prioridade alta pelo navegador (atributo HTML válido).
- Sem mudança visual ou comportamental.
