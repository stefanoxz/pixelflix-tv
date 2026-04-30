import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeAdminApi } from "@/lib/adminApi";
import type { 
  AdminBundle, 
  Stats, 
  AdminUser, 
  AllowedServer, 
  PendingServer, 
  AdminEvent, 
  MonitoringOverview, 
  TopConsumer,
  DnsErrorOverview,
  HealthStatus,
  HealthReason,
  HealthState
} from "@/types/admin";

async function callAdmin<T>(action: string, payload?: Record<string, unknown>, retries = 2): Promise<T> {
  return invokeAdminApi<T>(action, payload, retries);
}

export function useAdminData(tab: string, dnsErrorsHours: number) {
  const navigate = useNavigate();
  const refreshInFlight = useRef(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allowed, setAllowed] = useState<AllowedServer[]>([]);
  const [pending, setPending] = useState<PendingServer[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringOverview | null>(null);
  const [topConsumers, setTopConsumers] = useState<TopConsumer[]>([]);
  const [dnsErrors, setDnsErrors] = useState<DnsErrorOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<Record<string, HealthStatus>>({});
  const [healthLoading, setHealthLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const checkAllServers = async (manual = false) => {
    if (!allowed.length) return;
    setHealthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-server", {
        body: { urls: allowed.map((s) => s.server_url) },
      });
      if (error) {
        const status = (error as { context?: Response })?.context?.status;
        if (status === 401 || status === 403) {
          toast.error("Seu usuário não tem permissão para verificar DNS.");
        } else if (manual || status === 503) {
          toast.warning("Verificação de DNS indisponível no momento. Tente novamente em instantes.");
        }
        return;
      }
      const results = (data as { results?: (Partial<HealthStatus> & { url: string; reason?: HealthReason })[] } | null)?.results ?? [];
      const brokenMap = new Map<string, boolean>();
      for (const s of allowed) brokenMap.set(s.server_url, !!s.stream_broken);

      const map: Record<string, HealthStatus> = {};
      for (const r of results) {
        const state: HealthState = r.state ?? (r.online ? "online" : "offline");
        const reason: HealthReason | undefined = brokenMap.get(r.url) ? "stream_broken" : r.reason;
        map[r.url] = {
          state: brokenMap.get(r.url) && state === "online" ? "unstable" : state,
          online: state === "online" || state === "unstable",
          latency: r.latency ?? null,
          status: r.status ?? null,
          attempts: r.attempts,
          checked_at: r.checked_at ?? new Date().toISOString(),
          error: r.error,
          reason,
        };
      }
      if (Object.keys(map).length > 0) {
        setHealth((prev) => ({ ...prev, ...map }));
      }
    } catch {
      if (manual) toast.warning("Não foi possível verificar as DNS agora.");
    } finally {
      setHealthLoading(false);
    }
  };

  const refresh = async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setLoading(true);
    try {
      const bundle = await callAdmin<AdminBundle>("dashboard_bundle", { eventsLimit: 50 });
      setStats(bundle.stats);
      setUsers(bundle.users);
      setAllowed(bundle.servers.allowed);
      setPending(bundle.servers.pending);
      setEvents(bundle.events);
      setMonitoring(bundle.monitoring);
      setTopConsumers(bundle.top_consumers);
    } catch (err) {
      if (signingOut) return;
      const msg = err instanceof Error ? err.message : "Falha ao carregar dados";
      if (/não autorizado|unauthorized|401|sessão/i.test(msg)) {
        await supabase.auth.signOut();
        toast.error("Sessão expirada. Faça login novamente.");
        navigate("/admin/login");
        return;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
      refreshInFlight.current = false;
    }
  };

  const refreshDnsErrors = async (hours: number) => {
    try {
      const data = await callAdmin<DnsErrorOverview>("dns_errors", { hours });
      setDnsErrors(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar erros de DNS";
      toast.error(msg);
    }
  };

  useEffect(() => {
    refresh();
    const interval = tab === "monitoring" || tab === "dns-errors" ? 10_000 : 30_000;
    const t = setInterval(refresh, interval);
    return () => clearInterval(t);
  }, [tab]);

  useEffect(() => {
    if (tab !== "dns-errors") return;
    refreshDnsErrors(dnsErrorsHours);
    const t = setInterval(() => refreshDnsErrors(dnsErrorsHours), 10_000);
    return () => clearInterval(t);
  }, [tab, dnsErrorsHours]);

  useEffect(() => {
    if (tab !== "servers" || allowed.length === 0) return;
    checkAllServers();
    const t = setInterval(checkAllServers, 30_000);
    return () => clearInterval(t);
  }, [tab, allowed.length]);

  return {
    stats,
    users,
    allowed,
    pending,
    events,
    monitoring,
    topConsumers,
    dnsErrors,
    loading,
    health,
    healthLoading,
    refresh,
    refreshDnsErrors,
    setSigningOut,
    checkAllServers,
  };
}
