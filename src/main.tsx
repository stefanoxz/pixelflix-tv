import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import App from "./App.tsx";
import { toast } from "sonner";
import { MaxConnectionsError } from "./services/iptv";
import "./index.css";

// Toast deduplicado: se várias queries falharem ao mesmo tempo com
// MAX_CONNECTIONS, o usuário vê uma única notificação por janela curta.
let lastMaxConnToastAt = 0;
function notifyMaxConnections(message: string) {
  const now = Date.now();
  if (now - lastMaxConnToastAt < 5_000) return;
  lastMaxConnToastAt = now;
  toast.error("Limite de telas atingido", {
    description: message,
    duration: 6000,
  });
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => {
      if (err instanceof MaxConnectionsError) {
        notifyMaxConnections(err.message);
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: (failureCount, error) => {
        // Não retentar erros lógicos do servidor.
        if (error instanceof MaxConnectionsError) return false;
        return failureCount < 1;
      },
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
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: "pixelflix-rq-cache",
    throttleTime: 1000,
  });

  // Hidratação imperativa — não envolve Suspense, evitando races de mount
  // que causavam "Failed to execute 'removeChild' on 'Node'" durante o
  // primeiro commit da rota /login.
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
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
