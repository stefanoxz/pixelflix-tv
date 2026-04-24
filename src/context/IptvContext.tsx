import { useEffect, useState, ReactNode } from "react";
import {
  IptvContext,
  IPTV_STORAGE_KEY,
  type IptvSession,
} from "./iptv-context";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllowedServers, isHostAllowed } from "@/services/iptv";
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

  // Boot-time revalidation: if the saved session points to a DNS that is no
  // longer in `allowed_servers`, drop it and force a fresh login. Prevents
  // "ghost host" stuck in localStorage after the panel rotated DNS.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const allowed = await fetchAllowedServers();
      if (cancelled || allowed.length === 0) return;
      const base = session.creds.streamBase || session.creds.server || "";
      if (!isHostAllowed(base, allowed)) {
        toast.info("Sua DNS foi atualizada, faça login novamente.");
        setSession(null);
        supabase.auth.signOut().catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
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

  return (
    <IptvContext.Provider value={{ session, setSession, logout }}>
      {children}
    </IptvContext.Provider>
  );
}
