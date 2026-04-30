import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/main";
import { toast } from "sonner";
import type { IptvCredentials, ServerInfo, UserInfo } from "@/types/iptv";

export interface IptvSession {
  creds: IptvCredentials;
  userInfo: UserInfo;
  serverInfo?: ServerInfo;
}

export interface IptvContextValue {
  session: IptvSession | null;
  setSession: (s: IptvSession | null) => void;
  logout: () => void;
}

const IPTV_STORAGE_KEY = "iptv_session";
const IptvContext = createContext<IptvContextValue | undefined>(undefined);

export function useIptv() {
  const ctx = useContext(IptvContext);
  if (!ctx) throw new Error("useIptv must be used within IptvProvider");
  return ctx;
}

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
    supabase.auth.signOut().catch(() => {});
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const run = async () => {
      const { fetchAllowedServers, isHostAllowed } = await import("@/services/iptv");
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
        toast.info("DNS de mídia atualizada automaticamente.");
        setSession({
          ...session,
          creds: { ...session.creds, streamBase: server },
        });
      }
    };

    const w = window as any;
    if (w.requestIdleCallback) {
      w.requestIdleCallback(() => run(), { timeout: 2500 });
    } else {
      setTimeout(run, 800);
    }

    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === IPTV_STORAGE_KEY) {
        setSessionState(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!session?.creds) queryClient.clear();
  }, [session?.creds]);

  return (
    <IptvContext.Provider value={{ session, setSession, logout }}>
      {children}
    </IptvContext.Provider>
  );
}
