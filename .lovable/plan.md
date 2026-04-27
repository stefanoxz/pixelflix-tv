## Diagnóstico

A tela preta no domínio publicado (`supertechweb.lovable.app`) tem uma causa **clara e específica** — não é cache nem boot lento:

```
TypeError: Cannot read properties of undefined (reading 'createContext')
  at vendor-D9BzRF4i.js
```

Esse erro derruba o React **antes do primeiro paint**, então só aparece o `<body>` escuro vazio. O preview na Lovable funciona porque usa Vite em dev (sem chunking).

### Causa raiz

O `vite.config.ts` define `manualChunks` que separa o React (`vendor-react`) das bibliotecas que dependem dele (`vendor-radix`, `vendor-router`, `vendor-ui`, e o catch-all `vendor`). Em produção, alguma dessas libs (provavelmente `next-themes` dentro do `Sonner`, ou um `@radix-ui` específico) é avaliada **antes** do chunk do React terminar de inicializar — e quando ela faz `React.createContext(...)` no topo do módulo, o `React` ainda é `undefined`.

Esse é um problema clássico de ordem de inicialização entre chunks ESM quando se separa o React manualmente. A solução padrão e segura é deixar o Vite agrupar React + libs que dependem de React no mesmo chunk.

## Correção

**Arquivo: `vite.config.ts`**

Remover o `manualChunks` por completo e deixar o Vite usar a heurística padrão (que respeita ordem de import). O ganho de cache que o chunking trazia é marginal comparado ao custo de quebrar o app.

Antes:
```ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (!id.includes("node_modules")) return;
        if (id.includes("react-dom") || /[\\/]react[\\/]/.test(id) || id.includes("scheduler")) return "vendor-react";
        if (id.includes("react-router")) return "vendor-router";
        if (id.includes("@radix-ui")) return "vendor-radix";
        // ...
      },
    },
  },
},
```

Depois:
```ts
build: {
  // Deixa o Vite decidir o chunking automaticamente.
  // O manualChunks anterior quebrava a ordem de init (React undefined no createContext).
},
```

## Por que isso resolve

1. Sem `manualChunks`, o Vite gera um único `vendor` ou divide automaticamente respeitando o grafo de imports — o React é garantidamente avaliado antes de qualquer lib que o consuma.
2. Os chunks de página (lazy `Index`, `Live`, `Movies`, `Series`, `Sync`, `Admin`, `iptv.ts` dinâmico) **continuam separados** porque vêm de `import()` dinâmicos no código — não dependem do `manualChunks`.
3. O bundle inicial fica um pouco maior, mas a app **carrega**, em vez de falhar silenciosamente.

## Próximos passos depois do deploy

1. Aplicar a mudança e clicar em **Update** no diálogo de publicação (mudança de frontend).
2. Abrir `supertechweb.lovable.app` em aba anônima para evitar SW/cache antigo.
3. Confirmar que a tela de login aparece.

Se quiser reintroduzir chunking depois pra otimizar cache, dá pra fazer com cuidado (agrupando React + Radix + Router no mesmo chunk), mas isso é otimização — não bloqueia o app.
