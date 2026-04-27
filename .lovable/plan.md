## Diagnóstico

A tela que você vê travada (logo SuperTech + "Uma nova experiência começa agora.") **NÃO é o React** — é o **placeholder estático em `index.html`** que aparece enquanto o bundle JS principal está sendo baixado/avaliado. Se ela fica visível por muito tempo, significa que o entry JS está demorando para chegar ou para executar.

Auditando o entry inicial (`main.tsx` → `App.tsx` → `Login`/`Sync`/`IptvProvider`), encontrei que tudo isto é **carregado de forma síncrona, antes do primeiro render real**:

1. **`src/services/iptv.ts` (1.873 linhas)** entra no bundle inicial via `Login.tsx` (e `IptvProvider`/`Sync`). Esse arquivo concentra ~todo o cliente IPTV (parsers, builders de URL, watchers, helpers de stream) que o `/login` quase não usa.
2. **`@tanstack/react-query-persist-client` + `query-sync-storage-persister`** são executados de forma síncrona em `main.tsx`, antes do `createRoot`, lendo `localStorage` e re-hidratando o cache.
3. **`Sync.tsx` é importado de forma não-lazy** em `App.tsx` (justificado para evitar flash, mas custa no boot do `/login`).
4. **`Sonner`, `Toaster`, `TooltipProvider`, `InstallAppDialog`** entram todos no entry, mesmo na tela de login.
5. O `IptvProvider` chama `fetchAllowedServers()` (uma edge function) já no boot — não bloqueia render, mas adiciona latência inicial percebida.

Como você só publicou recentemente, o navegador ainda não tem cache do bundle, então o problema fica muito visível.

> Importante: as edge functions `admin-api` e `check-server` estão respondendo `200` agora (logs OK). O problema atual é **bundle size / cold start no cliente**, não autenticação ou backend.

## O que vai mudar

Mantém 100% do funcionamento atual. Todas as mudanças são de empacotamento.

### 1. Tornar o `Sync` lazy (com prefetch)
- `App.tsx`: `const Sync = lazy(() => import("./pages/Sync"))`.
- Ao final do `Login` (logo antes do `navigate("/sync")`), disparar `import("./pages/Sync")` em paralelo com o login da edge — quando o usuário chegar em `/sync` o bundle já está pronto, sem flash do Suspense.

### 2. Quebrar o `services/iptv.ts` em módulos
Dividir o arquivo gigante em:
- `services/iptv/login.ts` — `iptvLogin`, `iptvLoginM3u`, `IptvLoginError`, `fetchAllowedServers`, `resolveStreamBase`, `isHostAllowed` (o mínimo que o `/login` precisa).
- `services/iptv/catalog.ts` — `getLiveCategories/Streams`, `getVod*`, `getSeries*`.
- `services/iptv/streams.ts` — `buildLiveStreamUrl`, `buildVodStreamUrl`, `buildSeriesEpisodeUrl`, `requestStreamToken`, watchers.
- `services/iptv/index.ts` — re-exporta tudo (mantém compatibilidade com imports atuais).

Resultado: o `/login` puxa só `login.ts` (~150 linhas) em vez de 1.873.

### 3. Adiar o persist do React Query
Mover o `persistQueryClient` (em `main.tsx`) para dentro de um `requestIdleCallback` (com fallback `setTimeout`). O hidrate é só de cache de catálogo — não bloqueia o /login.

### 4. Adiar Sonner/Toaster/InstallAppDialog
Em `App.tsx`, transformar `Sonner`, `Toaster` e `InstallAppDialog` em `lazy` envoltos em `<Suspense fallback={null}>`. O React renderiza o `/login` antes; eles entram em seguida sem bloquear o LCP.

### 5. Adiar `fetchAllowedServers` no boot
No `IptvProvider`, só rodar a revalidação de DNS quando já houver `session` salva (já é o caso) **e** com `requestIdleCallback`, para não competir com o paint inicial.

### 6. Verificação
- `tsc --noEmit` para garantir tipagem dos imports re-exportados.
- Smoke test mental: `/login` puro → digitar credenciais → `iptvLogin` (carrega `login.ts`) → `navigate('/sync')` → bundle de Sync já preloaded → catálogo carregado.

## Detalhes técnicos (curtos)

- Estratégia "barrel + re-export" mantém `import { iptvLogin, getLiveStreams, buildVodStreamUrl } from "@/services/iptv"` funcionando sem alterar nenhum consumidor.
- O webplayer principal (Index/Live/Movies/Series) já é lazy — não regride.
- O `/admin` é lazy — sem impacto.
- Esperado: redução de ~40–60% no tamanho do JS inicial (entry + chunk do Login). Isso é o que mais ataca o "fica travado no logo após publicar".

## Arquivos a editar

- `src/App.tsx` — Sync lazy; Sonner/Toaster/InstallAppDialog lazy.
- `src/main.tsx` — persist em idle.
- `src/context/IptvContext.tsx` — fetchAllowedServers em idle.
- `src/pages/Login.tsx` — prefetch do bundle de Sync ao iniciar login.
- `src/services/iptv.ts` → dividir em `src/services/iptv/{login,catalog,streams,index}.ts`.

Sem mudanças de UX, sem mudanças no backend, sem migração de dados.
