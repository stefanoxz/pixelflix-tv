import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { IptvCredentials, ServerInfo, UserInfo } from "@/services/iptv";

interface IptvSession {
  creds: IptvCredentials;
  userInfo: UserInfo;
  serverInfo?: ServerInfo;
}

interface IptvContextValue {
  session: IptvSession | null;
  setSession: (s: IptvSession | null) => void;
  logout: () => void;
}

const IptvContext = createContext<IptvContextValue | undefined>(undefined);

const STORAGE_KEY = "iptv_session";

export function IptvProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<IptvSession | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setSession = (s: IptvSession | null) => {
    setSessionState(s);
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const logout = () => setSession(null);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
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

export function useIptv() {
  const ctx = useContext(IptvContext);
  if (!ctx) throw new Error("useIptv must be used within IptvProvider");
  return ctx;
}
