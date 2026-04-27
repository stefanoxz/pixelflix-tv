import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import App from "./App.tsx";
import "./index.css";

// Limite de telas não é mais tratado como erro global: o login passa mesmo
// com telas cheias (auth=1) e falhas de stream individual são exibidas pelo
// próprio Player. Mantemos o QueryClient enxuto.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: () => {
      /* noop */
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: (failureCount) => failureCount < 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Persistir somente queries de catálogo (chaves estáveis e seguras).
const PERSISTED_KEYS = new Set([
  "vod-cats",
  "vod-streams",
  "series-cats",
  "series",
  "live-cats",
  "live-streams",
]);

if (typeof window !== "undefined") {
  // Adia a hidratação do cache persistido para idle: o /login não depende
  // dele e o trabalho de ler+desserializar o localStorage estava competindo
  // com o paint inicial, deixando o app "travado" no splash do index.html
  // logo depois de publicar (sem cache de bundle no navegador).
  const hydrate = () => {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "pixelflix-rq-cache",
      throttleTime: 1000,
    });
    persistQueryClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient: queryClient as any,
      persister,
      maxAge: 12 * 60 * 60 * 1000,
      buster: "v1",
      dehydrateOptions: {
        shouldDehydrateQuery: (q) => {
          const k = q.queryKey?.[0];
          return typeof k === "string" && PERSISTED_KEYS.has(k);
        },
      },
    });
  };

  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(hydrate, { timeout: 1500 });
  } else {
    setTimeout(hydrate, 200);
  }
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
