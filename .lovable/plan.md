## Diagnóstico do "tela preta agora"

A cor exata da tela preta no print (`#0a0d18` aproximado) é o `background` definido no `<style>` do placeholder em `index.html`. O React até montou (os logs mostram `Toaster` e `InstallAppDialog` renderizando) mas **algo no boot está atrasando ou bloqueando o render do `<Login />`**, deixando a tela só com o fundo do body enquanto a UI ainda não pintou.

A causa provável é o `Suspense fallback={null}` que **embrulhou Sonner+Toaster+InstallAppDialog** na minha última mudança. O `Sonner` importa `next-themes`, que é avaliado de forma síncrona na primeira render — quando colocado dentro de um lazy boundary com `fallback={null}`, isso introduz **uma suspensão extra na árvore raiz** que adia o commit do `<BrowserRouter>` (e portanto do `<Login />`) até que o chunk lazy resolva. Em redes lentas ou no primeiro acesso após publicar, a tela fica preta nesse intervalo.

Os warnings `Function components cannot be given refs` no `Toaster`/`InstallAppDialog` são pré-existentes — vieram dos componentes shadcn padrão (`Toaster` recebe ref do Sonner; `Dialog` do Radix). Não são a causa, mas vamos ignorá-los por ora.

## Correção (mínima e segura)

### 1. Reverter o lazy de Sonner/Toaster/InstallAppDialog
Voltar a importar `Toaster`, `Sonner` e `InstallAppDialog` de forma estática em `App.tsx`. Eles são pequenos comparados ao bundle, e o ganho não vale o risco de bloquear o primeiro paint.

### 2. Manter o que comprovadamente ajudou
- `Sync` continua lazy (com `preloadSync()` no `Login` para evitar flash).
- `services/iptv.ts` (1.873 linhas) continua dynamic-imported pelo `Login` e pelo `IptvProvider` — esse é o ganho real de bundle.
- `persistQueryClient` continua em `requestIdleCallback` no `main.tsx`.
- `fetchAllowedServers` continua em `requestIdleCallback` no `IptvProvider`.

### 3. Remover o `Suspense fallback={null}` extra no App
Sem o lazy dos toasters, o Suspense raiz não é mais necessário — só o do `<Routes>` permanece.

## Arquivos a editar

- `src/App.tsx` — reverter imports de `Toaster`/`Sonner`/`InstallAppDialog` para estáticos; remover o `<Suspense fallback={null}>` em volta deles.

Nada mais muda. O ganho de boot (dynamic import do `services/iptv.ts` + idle persist) continua intacto, sem o efeito colateral da tela preta.
