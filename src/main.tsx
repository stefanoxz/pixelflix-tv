import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import App from "./App.tsx";
import "./index.css";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
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
    queryClient,
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
