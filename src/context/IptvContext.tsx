import { useEffect, useState, ReactNode } from "react";
import {
  IptvContext,
  IPTV_STORAGE_KEY,
  type IptvSession,
} from "./iptv-context";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/main";
import { toast } from "sonner";

export { useIptv } from "./useIptv";

export function IptvProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<IptvSession | null>(() => {
    try {
      const raw = localStorage.getItem(IPTV_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setSession = (s: IptvSession | null) => {
    setSessionState(s);
    if (s) localStorage.setItem(IPTV_STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(IPTV_STORAGE_KEY);
  };

  const logout = () => {
    setSession(null);
    // Also drop the Supabase anon session so stream-token stops working.
    supabase.auth.signOut().catch(() => {});
  };

  // Boot-time revalidation: só roda quando há sessão salva e em
  // `requestIdleCallback` para não competir com o paint inicial. O
  // `services/iptv.ts` (1.873 linhas) é carregado via dynamic import —
  // fica fora do bundle inicial do /login.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const run = async () => {
      const { fetchAllowedServers, isHostAllowed } = await import(
        "@/services/iptv"
      );
      const allowed = await fetchAllowedServers();
      if (cancelled || allowed.length === 0) return;

      const server = session.creds.server || "";
      const streamBase = session.creds.streamBase || "";
      const serverOk = isHostAllowed(server, allowed);
      const streamBaseOk = streamBase ? isHostAllowed(streamBase, allowed) : true;

      if (!serverOk) {
        toast.info("Sua DNS foi atualizada, faça login novamente.");
        setSession(null);
        supabase.auth.signOut().catch(() => {});
        return;
      }

      if (!streamBaseOk) {
        console.warn("[iptv] streamBase fora da allowlist, reescrevendo", {
          old: streamBase,
          new: server,
        });
        toast.info("DNS de mídia atualizada automaticamente.");
        setSession({
          ...session,
          creds: { ...session.creds, streamBase: server },
        });
      }
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(() => {
        run();
      }, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(run, 800);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === IPTV_STORAGE_KEY) {
        setSessionState(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Não pré-carrega catálogo no boot: alguns painéis IPTV contam cada request
  // como tela ativa e bloqueiam a conta com MAX_CONNECTIONS. O carregamento
  // fica centralizado no /sync e nas páginas abertas pelo usuário.
  useEffect(() => {
    if (!session?.creds) queryClient.clear();
  }, [session?.creds]);

  return (
    <IptvContext.Provider value={{ session, setSession, logout }}>
      {children}
    </IptvContext.Provider>
  );
}
