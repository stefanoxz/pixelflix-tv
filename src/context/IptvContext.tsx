import { useEffect, useState, ReactNode } from "react";
import {
  IptvContext,
  IPTV_STORAGE_KEY,
  type IptvSession,
} from "./iptv-context";

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

  const logout = () => setSession(null);

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
