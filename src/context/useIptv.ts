import { useContext } from "react";
import { IptvContext } from "./iptv-context";

export function useIptv() {
  const ctx = useContext(IptvContext);
  if (!ctx) throw new Error("useIptv must be used within IptvProvider");
  return ctx;
}
