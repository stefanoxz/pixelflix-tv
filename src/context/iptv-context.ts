import { createContext } from "react";
import type { IptvCredentials, ServerInfo, UserInfo } from "@/services/iptv";

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

export const IptvContext = createContext<IptvContextValue | undefined>(undefined);

export const IPTV_STORAGE_KEY = "iptv_session";
