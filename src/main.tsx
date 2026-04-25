import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
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

const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "pixelflix-rq-cache",
  throttleTime: 1000,
});

createRoot(document.getElementById("root")!).render(
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 12 * 60 * 60 * 1000,
      buster: "v1",
      dehydrateOptions: {
        shouldDehydrateQuery: (q) => {
          const k = q.queryKey?.[0];
          return typeof k === "string" && PERSISTED_KEYS.has(k);
        },
      },
    }}
  >
    <App />
  </PersistQueryClientProvider>,
);
