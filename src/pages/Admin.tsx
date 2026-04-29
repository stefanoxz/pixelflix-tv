import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeAdminApi } from "@/lib/adminApi";
import { useAdminRole } from "@/hooks/useAdminRole";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DnsErrorTrendChart } from "@/components/admin/DnsErrorTrendChart";
import { ServerProbeDialog } from "@/components/admin/ServerProbeDialog";
import { EndpointTestPanel } from "@/components/admin/EndpointTestPanel";
import { UserReportsPanel } from "@/components/admin/UserReportsPanel";
import ClientDiagnosticsPanel from "@/components/admin/ClientDiagnosticsPanel";
import PendingSignupsPanel from "@/components/admin/PendingSignupsPanel";
import TeamPanel from "@/components/admin/TeamPanel";
import StatsPanel from "@/components/admin/StatsPanel";
import MaintenancePanel from "@/components/admin/MaintenancePanel";
import BlockedDnsPanel from "@/components/admin/BlockedDnsPanel";
import UserDetailDialog from "@/components/admin/UserDetailDialog";
import StreamEventsPanel from "@/components/admin/StreamEventsPanel";
import { visibleAdminNav, findNavItem } from "@/components/admin/adminNav";
import AdminMobileTopBar from "@/components/admin/AdminMobileTopBar";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import {
  Users,
  UserCheck,
  Activity,
  TrendingUp,
  LogOut,
  Shield,
  Server,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Monitor,
  Activity as ActivityIcon,
  Ban,
  X,
  Pencil,
  AlertOctagon,
  FlaskConical,
  Wifi,
  Flag,
  Stethoscope,
  UserPlus,
  HelpCircle,
  BarChart3,
} from "lucide-react";

// Auth handled by AdminProtectedRoute + Supabase session

interface Stats {
  totalEvents: number;
  events24h: number;
  success24h: number;
  fail24h: number;
  onlineNow: number;
  totalUsers: number;
  totalServers: number;
  allowedServers: number;
}

interface AdminUser {
  username: string;
  last_server: string;
  last_login: string;
  last_success: boolean;
  total: number;
}

interface AllowedServer {
  id: string;
  server_url: string;
  label: string | null;
  notes: string | null;
  created_at: string;
  last_seen: string | null;
  total_logins: number;
  success_count: number;
  fail_count: number;
  unique_users: number;
  stream_broken?: boolean;
}

interface PendingServer {
  server_url: string;
  last_seen: string;
  total_logins: number;
  fail_count: number;
  unique_users: number;
}

interface AdminEvent {
  id: string;
  username: string;
  server_url: string;
  success: boolean;
  reason: string | null;
  created_at: string;
}

interface MonitoringSession {
  anon_user_id: string;
  iptv_username: string | null;
  ip_masked: string;
  server_url: string | null;
  started_at: string;
  last_seen_at: string;
  duration_s: number;
  content_kind: "live" | "movie" | "episode" | "idle" | null;
  content_title: string | null;
  content_id: string | null;
  content_started_at: string | null;
}
interface MonitoringBlock {
  anon_user_id: string;
  blocked_until: string;
  reason: string | null;
  created_at: string;
}
interface MonitoringErrorEvent {
  id: string;
  anon_user_id: string | null;
  event_type: string;
  ip_masked: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}
interface MonitoringOverview {
  online_now: number;
  active_sessions: MonitoringSession[];
  active_blocks: MonitoringBlock[];
  recent_errors: MonitoringErrorEvent[];
  top_rejected_ips: { ip_masked: string; count: number }[];
}
interface TopConsumer {
  anon_user_id: string;
  iptv_username: string;
  server_host: string;
  requests: number;
  segments: number;
}

interface AdminBundle {
  stats: Stats;
  users: AdminUser[];
  servers: { allowed: AllowedServer[]; pending: PendingServer[] };
  events: AdminEvent[];
  monitoring: MonitoringOverview;
  top_consumers: TopConsumer[];
}

type ErrorBucket =
  | "refused"
  | "reset"
  | "http_404"
  | "http_444"
  | "http_5xx"
  | "tls"
  | "cert_invalid"
  | "timeout"
  | "io_timeout"
  | "dns"
  | "no_route"
  | "net_unreach"
  | "protocol"
  | "other";

interface DnsErrorServer {
  server_url: string;
  total: number;
  success: number;
  fail: number;
  last_seen: string | null;
  last_error: string | null;
  last_error_at: string | null;
  buckets: Record<ErrorBucket, number>;
}

interface DnsErrorSeriesPoint {
  t: string;
  total: number;
  success: number;
  fail: number;
  refused: number; reset: number; http_404: number; http_444: number; http_5xx: number;
  tls: number; cert_invalid: number; timeout: number; io_timeout: number;
  dns: number; no_route: number; net_unreach: number; protocol: number; other: number;
}

interface DnsErrorOverview {
  since: string;
  hours: number;
  step_ms?: number;
  totals: {
    total: number;
    success: number;
    fail: number;
    buckets: Record<ErrorBucket, number>;
  };
  servers: DnsErrorServer[];
  series?: DnsErrorSeriesPoint[];
  per_server_series?: { server_url: string; points: DnsErrorSeriesPoint[] }[];
}

const ERROR_BUCKET_META: Record<ErrorBucket, { label: string; cls: string; tip: string; color: string }> = {
  refused: {
    label: "Connection refused",
    cls: "text-destructive bg-destructive/10",
    tip: "Servidor recusou a conexão TCP (porta fechada / serviço parado).",
    color: "hsl(0 84% 60%)",
  },
  reset: {
    label: "Reset by peer",
    cls: "text-destructive bg-destructive/10",
    tip: "Servidor derrubou a conexão durante o handshake (firewall / anti-bot).",
    color: "hsl(14 90% 55%)",
  },
  http_404: {
    label: "HTTP 404",
    cls: "text-warning bg-warning/10",
    tip: "Endpoint /player_api.php não encontrado nessa DNS.",
    color: "hsl(38 92% 50%)",
  },
  http_444: {
    label: "HTTP 444",
    cls: "text-warning bg-warning/10",
    tip: "Servidor encerrou sem resposta (anti-scraping nginx).",
    color: "hsl(28 90% 55%)",
  },
  http_5xx: {
    label: "HTTP 5xx",
    cls: "text-warning bg-warning/10",
    tip: "Erro interno do servidor (sobrecarga, 502/503/504).",
    color: "hsl(48 95% 55%)",
  },
  tls: {
    label: "TLS / SSL",
    cls: "text-warning bg-warning/10",
    tip: "Falha de TLS/SSL (handshake, UnrecognisedName, alert).",
    color: "hsl(280 70% 60%)",
  },
  cert_invalid: {
    label: "Certificado inválido",
    cls: "text-destructive bg-destructive/10",
    tip: "Certificate verify failed: expirado, autoassinado ou hostname inválido.",
    color: "hsl(320 75% 55%)",
  },
  timeout: {
    label: "Timeout",
    cls: "text-warning bg-warning/10",
    tip: "Servidor não respondeu no tempo limite.",
    color: "hsl(60 80% 50%)",
  },
  io_timeout: {
    label: "I/O timeout",
    cls: "text-warning bg-warning/10",
    tip: "Tempo limite em leitura/escrita do socket (read/write timeout).",
    color: "hsl(80 70% 50%)",
  },
  dns: {
    label: "DNS off",
    cls: "text-destructive bg-destructive/10",
    tip: "Domínio não resolveu (DNS inválido ou removido).",
    color: "hsl(340 80% 55%)",
  },
  no_route: {
    label: "No route to host",
    cls: "text-destructive bg-destructive/10",
    tip: "Sem rota até o host (EHOSTUNREACH). IP inválido ou bloqueado.",
    color: "hsl(200 80% 55%)",
  },
  net_unreach: {
    label: "Rede inacessível",
    cls: "text-destructive bg-destructive/10",
    tip: "Network is unreachable (ENETUNREACH). Problema de roteamento.",
    color: "hsl(220 75% 60%)",
  },
  protocol: {
    label: "Protocolo inválido",
    cls: "text-warning bg-warning/10",
    tip: "Resposta HTTP malformada (parse error, EOF inesperado).",
    color: "hsl(160 65% 50%)",
  },
  other: {
    label: "Outros",
    cls: "text-muted-foreground bg-muted/40",
    tip: "Outras falhas (incluindo credenciais inválidas).",
    color: "hsl(220 10% 55%)",
  },
};

const SERVER_PALETTE = [
  "hsl(214 100% 56%)",
  "hsl(0 84% 60%)",
  "hsl(38 92% 50%)",
  "hsl(142 71% 45%)",
  "hsl(280 70% 60%)",
  "hsl(180 70% 50%)",
];

async function callAdmin<T>(action: string, payload?: Record<string, unknown>, retries = 2): Promise<T> {
  return invokeAdminApi<T>(action, payload, retries);
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function latencyClass(ms: number | null): string {
  if (ms == null) return "text-muted-foreground";
  if (ms < 200) return "text-success";
  if (ms < 500) return "text-warning";
  return "text-destructive";
}

type HealthState = "online" | "unstable" | "offline";

type HealthReason =
  | "online"
  | "auth_required"
  | "blocked"
  | "not_found"
  | "http_error"
  | "timeout"
  | "rst"
  | "network"
  | "stream_broken"
  | "unknown";

interface HealthStatus {
  state: HealthState;
  online: boolean;
  latency: number | null;
  status: number | null;
  attempts?: number;
  checked_at: string;
  error?: string;
  reason?: HealthReason;
}

function statusClass(status: number | null): string {
  if (status == null) return "text-muted-foreground bg-muted/40";
  if (status >= 200 && status < 300) return "text-success bg-success/10";
  if (status === 401) return "text-success bg-success/10";
  if (status === 403 || (status >= 500 && status < 600)) return "text-warning bg-warning/10";
  return "text-warning bg-warning/10";
}

function stateBadge(state: HealthState): { dot: string; label: string; cls: string } {
  switch (state) {
    case "online":
      return { dot: "🟢", label: "Online", cls: "text-success" };
    case "unstable":
      return { dot: "🟡", label: "Instável", cls: "text-warning" };
    case "offline":
      return { dot: "🔴", label: "Offline", cls: "text-destructive" };
  }
}

function stateTooltip(state: HealthState): string {
  switch (state) {
    case "online":
      return "Servidor respondeu OK (HTTP 2xx ou 401). Disponível para login.";
    case "unstable":
      return "Respondeu com aviso (HTTP 403, 5xx ou 1 timeout). Pode estar sob Cloudflare ou sobrecarregado.";
    case "offline":
      return "Sem resposta (erro de rede ou 2 timeouts seguidos). Login bloqueado.";
  }
}

function httpTooltip(status: number): string {
  if (status >= 200 && status < 300) return `HTTP ${status} OK — servidor respondeu normalmente.`;
  if (status === 401) return "401 — autenticação requerida. Servidor está vivo (considerado online).";
  if (status === 403) return "403 — bloqueado (geralmente Cloudflare). Servidor pode estar OK para o cliente.";
  if (status === 404) return "404 — endpoint não encontrado nesse servidor.";
  if (status >= 500 && status < 600) return `${status} — erro interno do servidor (sobrecarga ou falha).`;
  return `HTTP ${status} — resposta inesperada do servidor.`;
}

function reasonInfo(reason: HealthReason | undefined): { label: string; tooltip: string; cls: string } | null {
  switch (reason) {
    case "online":
      return { label: "Online", tooltip: "Servidor respondeu normalmente (HTTP 2xx).", cls: "text-success" };
    case "auth_required":
      return { label: "Online (auth)", tooltip: "Servidor vivo, exige autenticação (HTTP 401). Considerado disponível.", cls: "text-success" };
    case "blocked":
      return { label: "Bloqueado", tooltip: "Servidor bloqueou a requisição (HTTP 403 — Cloudflare/WAF).", cls: "text-warning" };
    case "http_error":
      return { label: "Erro no servidor", tooltip: "Servidor respondeu com erro 5xx (sobrecarga ou falha interna).", cls: "text-warning" };
    case "not_found":
      return { label: "Endpoint ausente", tooltip: "HTTP 404 — /player_api.php não encontrado nessa DNS.", cls: "text-warning" };
    case "timeout":
      return { label: "Lento / timeout", tooltip: "Sem resposta em 5s. Servidor lento ou sobrecarregado.", cls: "text-warning" };
    case "rst":
      return { label: "Conexão recusada", tooltip: "Servidor derrubou a conexão (RST). Aplicação parada ou domínio migrado.", cls: "text-destructive" };
    case "network":
      return { label: "Sem conexão", tooltip: "Erro de rede (DNS, TLS ou recusa). Servidor inacessível.", cls: "text-destructive" };
    case "stream_broken":
      return { label: "Sem stream", tooltip: "Servidor responde ao ping, mas usuários reportaram falha ao reproduzir vídeo (≥3 reports em 5min).", cls: "text-destructive" };
    case "unknown":
    default:
      return null;
  }
}



const Admin = () => {
  const navigate = useNavigate();
  const refreshInFlight = useRef(false);
  const { isAdmin, isModerator, role, loading: roleLoading } = useAdminRole();

  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allowed, setAllowed] = useState<AllowedServer[]>([]);
  const [pending, setPending] = useState<PendingServer[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringOverview | null>(null);
  const [topConsumers, setTopConsumers] = useState<TopConsumer[]>([]);
  const [dnsErrors, setDnsErrors] = useState<DnsErrorOverview | null>(null);
  const [dnsErrorsHours, setDnsErrorsHours] = useState<number>(24);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editingServer, setEditingServer] = useState<AllowedServer | null>(null);
  const [probeServer, setProbeServer] = useState<AllowedServer | null>(null);

  // AlertDialog state — substitui confirm() nativo em ações destrutivas.
  const [confirmRemoveServer, setConfirmRemoveServer] = useState<string | null>(null);
  const [confirmEvictSession, setConfirmEvictSession] = useState<MonitoringSession | null>(null);
  const [confirmUnblockUser, setConfirmUnblockUser] = useState<MonitoringBlock | null>(null);

  const [health, setHealth] = useState<Record<string, HealthStatus>>({});
  const [healthLoading, setHealthLoading] = useState(false);
  const [detailUsername, setDetailUsername] = useState<string | null>(null);

  // Se o moderador cair em uma aba admin-only, manda pro dashboard.
  useEffect(() => {
    if (roleLoading) return;
    const adminOnlyTabs = new Set(["servers", "pending-signups", "team", "maintenance"]);
    if (isModerator && !isAdmin && adminOnlyTabs.has(tab)) {
      setTab("dashboard");
    }
  }, [tab, isAdmin, isModerator, roleLoading]);

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
      // Mapa server_url -> stream_broken (vindo do list_servers / admin-api)
      const brokenMap = new Map<string, boolean>();
      for (const s of allowed) brokenMap.set(s.server_url, !!s.stream_broken);

      const map: Record<string, HealthStatus> = {};
      for (const r of results) {
        const state: HealthState =
          r.state ?? (r.online ? "online" : "offline");
        // Se admin-api sinalizou stream_broken, sobrepõe o reason (mesmo se ping deu online)
        const reason: HealthReason | undefined = brokenMap.get(r.url)
          ? "stream_broken"
          : r.reason;
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

      // Resumo do ping
      const values = Object.values(map);
      const total = values.length;
      if (total > 0) {
        const online = values.filter((h) => h.state === "online").length;
        const unstable = values.filter((h) => h.state === "unstable").length;
        const offline = values.filter((h) => h.state === "offline").length;
        const hasIssues = unstable > 0 || offline > 0;
        if (manual || hasIssues) {
          if (!hasIssues) {
            toast.success(`Ping concluído: ${online}/${total} servidores online`);
          } else {
            const parts = [`${online} online`];
            if (unstable) parts.push(`${unstable} instáveis`);
            if (offline) parts.push(`${offline} offline`);
            const msg = `Ping concluído: ${parts.join(" · ")}`;
            if (offline > 0) toast.error(msg);
            else toast.warning(msg);
          }
        }
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

  const refreshDnsErrors = async (hours: number = dnsErrorsHours) => {
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
    // Faster refresh while on Monitoring/DNS Errors tab
    const interval = tab === "monitoring" || tab === "dns-errors" ? 10_000 : 30_000;
    const t = setInterval(refresh, interval);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Refresh DNS errors when tab is active (real-time)
  useEffect(() => {
    if (tab !== "dns-errors") return;
    refreshDnsErrors(dnsErrorsHours);
    const t = setInterval(() => refreshDnsErrors(dnsErrorsHours), 10_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, dnsErrorsHours]);

  // Health check polling — apenas no tab "servers"
  useEffect(() => {
    if (tab !== "servers" || allowed.length === 0) return;
    checkAllServers();
    const t = setInterval(checkAllServers, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, allowed.length]);

  const allowServer = async (server_url: string, label?: string, notes?: string) => {
    const isEdit = !!editingServer;
    try {
      await callAdmin("allow_server", { server_url, label, notes });
      toast.success(isEdit ? "DNS atualizada" : "DNS autorizada");
      setAddOpen(false);
      setEditingServer(null);
      setNewUrl("");
      setNewLabel("");
      setNewNotes("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : isEdit ? "Erro ao atualizar" : "Erro ao autorizar");
    }
  };

  const removeServer = async (server_url: string) => {
    try {
      await callAdmin("remove_server", { server_url });
      toast.success("DNS apagada definitivamente");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar");
    } finally {
      setConfirmRemoveServer(null);
    }
  };

  const unblockUser = async (anon_user_id: string) => {
    try {
      await callAdmin("unblock_user", { anon_user_id });
      toast.success("Usuário desbloqueado");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desbloquear");
    } finally {
      setConfirmUnblockUser(null);
    }
  };

  const evictSession = async (anon_user_id: string) => {
    try {
      await callAdmin("evict_session", { anon_user_id });
      toast.success("Sessão encerrada");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao encerrar");
    } finally {
      setConfirmEvictSession(null);
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter((u) =>
        search ? u.username.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    [users, search],
  );

  const filteredAllowed = useMemo(
    () =>
      allowed.filter((s) =>
        search
          ? s.server_url.toLowerCase().includes(search.toLowerCase()) ||
            (s.label ?? "").toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    [allowed, search],
  );

  const filteredPending = useMemo(
    () =>
      pending.filter((s) =>
        search ? s.server_url.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    [pending, search],
  );

  // Route is wrapped by AdminProtectedRoute — no client-side token check needed

  const statCards = [
    {
      icon: ShieldCheck,
      label: "DNS autorizadas",
      value: stats?.allowedServers ?? "—",
      sub: "servidores liberados",
      accent: "primary",
    },
    {
      icon: UserCheck,
      label: "Online agora",
      value: stats?.onlineNow ?? "—",
      sub: "última 1h",
      accent: "success",
    },
    {
      icon: Users,
      label: "Usuários únicos",
      value: stats?.totalUsers ?? "—",
      sub: `${stats?.events24h ?? 0} eventos 24h`,
      accent: "primary",
    },
    {
      icon: Activity,
      label: "Sucesso 24h",
      value: stats
        ? stats.events24h > 0
          ? `${Math.round((stats.success24h / stats.events24h) * 100)}%`
          : "—"
        : "—",
      sub: `${stats?.fail24h ?? 0} falhas`,
      accent: "success",
    },
  ];

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate("/admin/login");
  };
  const handleBackToApp = () => navigate("/");
  const navItems = visibleAdminNav(isAdmin);
  const currentNav = findNavItem(tab);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile top bar (drawer + título) */}
      <AdminMobileTopBar
        tab={tab}
        onTabChange={setTab}
        isAdmin={isAdmin}
        isModerator={isModerator}
        onSignOut={handleSignOut}
        onBackToApp={handleBackToApp}
      />

      {/* Sidebar desktop (oculta no mobile) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-card border-r border-border/50 p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-md bg-gradient-primary flex items-center justify-center shadow-glow">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold">Admin Panel</span>
          {role && (
            <span
              className={
                "ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold " +
                (isAdmin
                  ? "bg-primary/15 text-primary"
                  : "bg-warning/15 text-warning")
              }
              title={isAdmin ? "Acesso total" : "Acesso de moderador (sem editar DNS/equipe)"}
            >
              {isAdmin ? "Admin" : "Moderador"}
            </span>
          )}
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors " +
                (tab === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground")
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-8 pt-6 border-t border-border/50 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleBackToApp}
          >
            ← Voltar ao app
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-4 md:p-8 pb-24 lg:pb-8 space-y-4 lg:space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/* Header textual: oculto no mobile (topbar já mostra título) */}
          <div className="hidden lg:block">
            <h1 className="text-3xl font-bold">{currentNav?.label ?? "Admin"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tab === "dashboard" ? "Visão geral em tempo real"
                : tab === "stats" ? "Histórico de logins, usuários ativos e conteúdos mais assistidos"
                : tab === "monitoring" ? "Sessões ativas, consumo e bloqueios — atualiza a cada 10s"
                : tab === "reports" ? "Problemas relatados pelos usuários direto do player"
                : tab === "dns-errors" ? "Distribuição de falhas por servidor — atualiza a cada 10s"
                : tab === "stream-events" ? "Tokens, segmentos e erros do player — atualiza a cada 30s"
                : tab === "users" ? "Quem está acessando a plataforma"
                : tab === "endpoint-test" ? "Diagnóstico de uma DNS específica — exibe se a resposta veio direto ou via proxy"
                : tab === "client-diagnostics" ? "Tentativas de login dos usuários com provedor, velocidade e localização — atualiza a cada 15s"
                : tab === "pending-signups" ? "Cadastros aguardando sua aprovação para acessar o painel admin"
                : tab === "team" ? "Gerencie quem tem acesso ao painel e veja o histórico de ações"
                : tab === "maintenance" ? "Limpeza de logs antigos, encerramento de sessões ociosas e status das tabelas"
                : "Cadastre as DNS autorizadas. Sem cadastro prévio, o cliente não consegue logar."}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={"h-4 w-4 mr-2 " + (loading ? "animate-spin" : "")} />
              Atualizar
            </Button>
            {/* "Sair do Admin" só no desktop — no mobile o drawer já tem Sair */}
            <Button
              variant="outline"
              size="sm"
              className="hidden lg:inline-flex"
              onClick={async () => {
                setSigningOut(true);
                await supabase.auth.signOut();
                navigate("/login", { replace: true });
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair do Admin
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="reports" className="space-y-6 mt-0">
            <UserReportsPanel />
          </TabsContent>

          <TabsContent value="team" className="space-y-6 mt-0">
            <TeamPanel />
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-6 mt-0">
            <MaintenancePanel />
          </TabsContent>

          <TabsContent value="stats" className="space-y-6 mt-0">
            <StatsPanel />
          </TabsContent>

          <TabsContent value="endpoint-test" className="space-y-6 mt-0">
            <EndpointTestPanel
              allowedServers={allowed.map((s) => ({
                server_url: s.server_url,
                label: s.label,
              }))}
              onServerApplied={() => { void refresh(); }}
            />
          </TabsContent>

          <TabsContent value="client-diagnostics" className="space-y-6 mt-0">
            <ClientDiagnosticsPanel />
          </TabsContent>

          <TabsContent value="pending-signups" className="space-y-6 mt-0">
            <PendingSignupsPanel />
          </TabsContent>

          <TabsContent value="blocked-dns" className="space-y-6 mt-0">
            <BlockedDnsPanel />
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6 mt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 bg-gradient-card border-border/50">
                <div className="h-10 w-10 rounded-lg text-success bg-success/10 flex items-center justify-center mb-3">
                  <UserCheck className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">Usuários online agora</p>
                <p className="text-2xl font-bold mt-1">{monitoring?.online_now ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">heartbeat &lt; 90s</p>
              </Card>
              <Card className="p-5 bg-gradient-card border-border/50">
                <div className="h-10 w-10 rounded-lg text-primary bg-primary/10 flex items-center justify-center mb-3">
                  <ActivityIcon className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">Streams ativos</p>
                <p className="text-2xl font-bold mt-1">{monitoring?.active_sessions.length ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">com player ativo</p>
              </Card>
              <Card className="p-5 bg-gradient-card border-border/50">
                <div className="h-10 w-10 rounded-lg text-destructive bg-destructive/10 flex items-center justify-center mb-3">
                  <Ban className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">Bloqueios ativos</p>
                <p className="text-2xl font-bold mt-1">{monitoring?.active_blocks.length ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">temporários</p>
              </Card>
              <Card className="p-5 bg-gradient-card border-border/50">
                <div className="h-10 w-10 rounded-lg text-warning bg-warning/10 flex items-center justify-center mb-3">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">Erros 24h</p>
                <p className="text-2xl font-bold mt-1">{monitoring?.recent_errors.length ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">últimos 50</p>
              </Card>
            </div>

            <Card className="p-6 bg-gradient-card border-border/50">
              <h2 className="text-lg font-semibold mb-1">Sessões ativas</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Mostra quem está online agora, qual servidor IPTV está usando e o
                que está assistindo (atualizado a cada 45s pelo player). Sessões
                ociosas há mais de 60min são encerradas automaticamente.
              </p>
              {!monitoring?.active_sessions.length ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Ninguém online no momento.</p>
              ) : (
                <TooltipProvider delayDuration={150}>
                  <div className="divide-y divide-border/50">
                    <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-3 px-2 py-2 text-xs font-medium text-muted-foreground">
                      <div className="col-span-2">Usuário IPTV</div>
                      <div className="col-span-2">Servidor (DNS)</div>
                      <div className="col-span-2">IP</div>
                      <div className="col-span-3">Assistindo</div>
                      <div className="col-span-2 flex items-center gap-1">
                        Tempo no conteúdo
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground/70 hover:text-muted-foreground">
                              <HelpCircle className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            Há quanto tempo o usuário está assistindo a este
                            conteúdo específico (zera quando ele troca de
                            canal/filme/episódio).
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="col-span-1">Online</div>
                      <div className="col-span-2 text-right">Ação</div>
                    </div>
                    {monitoring.active_sessions.map((s) => {
                      const kindLabel: Record<string, string> = {
                        live: "🔴 Ao vivo",
                        movie: "🎬 Filme",
                        episode: "📺 Série",
                        idle: "💤 Webplayer ocioso",
                      };
                      const label = s.content_kind
                        ? kindLabel[s.content_kind] ?? s.content_kind
                        : "🕒 Navegando no app";
                      const titleText = !s.content_kind
                        ? "Ainda não iniciou nenhuma reprodução"
                        : s.content_kind === "idle"
                          ? "Sem reprodução"
                          : (s.content_title || "Sem título");
                      const contentMin = s.content_started_at
                        ? Math.max(0, Math.floor((Date.now() - new Date(s.content_started_at).getTime()) / 60000))
                        : null;
                      let serverHost: string | null = null;
                      if (s.server_url) {
                        try { serverHost = new URL(s.server_url).host; } catch { serverHost = s.server_url; }
                      }
                      return (
                        <div key={s.anon_user_id} className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-3 px-2 py-3 items-center text-sm">
                          <div className="col-span-2 font-medium truncate">{s.iptv_username || "—"}</div>
                          <div className="col-span-2 font-mono text-xs text-muted-foreground truncate" title={s.server_url ?? undefined}>
                            {serverHost ?? "—"}
                          </div>
                          <div className="col-span-2 font-mono text-xs text-muted-foreground">{s.ip_masked}</div>
                          <div className="col-span-3 truncate">
                            <div className="text-xs text-muted-foreground">{label}</div>
                            <div className="truncate" title={titleText}>{titleText}</div>
                          </div>
                          <div className="col-span-2 text-xs text-muted-foreground">
                            {contentMin != null ? `${contentMin}min` : "—"}
                          </div>
                          <div className="col-span-1 text-xs text-muted-foreground">
                            {Math.floor(s.duration_s / 60)}min
                          </div>
                          <div className="col-span-2 text-right">
                            <Button size="sm" variant="outline" onClick={() => setConfirmEvictSession(s)}>
                              <X className="h-3 w-3 mr-1" />Encerrar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TooltipProvider>
              )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-gradient-card border-border/50">
                <h2 className="text-lg font-semibold mb-4">Top consumidores (24h)</h2>
                {!topConsumers.length ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Sem consumo registrado.</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {topConsumers.map((c) => (
                      <div key={c.anon_user_id} className="flex items-center justify-between py-2 text-sm gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {c.iptv_username || `${c.anon_user_id.slice(0, 8)}…`}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.server_host || "servidor desconhecido"}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {c.requests} req • {c.segments} seg
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6 bg-gradient-card border-border/50">
                <h2 className="text-lg font-semibold mb-4">Bloqueios ativos</h2>
                {!monitoring?.active_blocks.length ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum bloqueio ativo.</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {monitoring.active_blocks.map((b) => (
                      <div key={b.anon_user_id} className="flex items-center justify-between py-2 text-sm gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs truncate">{b.anon_user_id.slice(0, 12)}…</p>
                          <p className="text-xs text-muted-foreground">
                            {b.reason || "—"} • até {new Date(b.blocked_until).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setConfirmUnblockUser(b)}>
                          Desbloquear
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card className="p-6 bg-gradient-card border-border/50">
              <h2 className="text-lg font-semibold mb-4">Erros recentes (24h)</h2>
              {!monitoring?.recent_errors.length ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum erro registrado.</p>
              ) : (
                <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
                  {monitoring.recent_errors.map((e) => (
                    <div key={e.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{e.event_type}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {e.ip_masked} • {(e.meta as { reason?: string })?.reason || "—"}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">há {formatRelative(e.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6 bg-gradient-card border-border/50">
              <h2 className="text-lg font-semibold mb-4">Top IPs com mais rejeições (24h)</h2>
              {!monitoring?.top_rejected_ips.length ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem rejeições.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {monitoring.top_rejected_ips.map((r) => (
                    <div key={r.ip_masked} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-mono text-xs">{r.ip_masked}</span>
                      <span className="text-xs text-muted-foreground">{r.count} rejeições</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="dns-errors" className="space-y-6 mt-0">
            {(() => {
              const buckets: ErrorBucket[] = ["refused", "reset", "http_404", "http_444", "http_5xx", "tls", "cert_invalid", "timeout", "io_timeout", "dns", "no_route", "net_unreach", "protocol", "other"];
              const totals = dnsErrors?.totals;
              const failRate = totals && totals.total > 0
                ? Math.round((totals.fail / totals.total) * 100)
                : 0;
              return (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-muted-foreground">Janela:</span>
                    {[1, 6, 24, 72, 168].map((h) => (
                      <Button
                        key={h}
                        size="sm"
                        variant={dnsErrorsHours === h ? "default" : "outline"}
                        onClick={() => setDnsErrorsHours(h)}
                      >
                        {h < 24 ? `${h}h` : h === 24 ? "24h" : `${Math.round(h / 24)}d`}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refreshDnsErrors(dnsErrorsHours)}
                      className="ml-auto"
                    >
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Atualizar agora
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-5 bg-gradient-card border-border/50">
                      <div className="h-10 w-10 rounded-lg text-primary bg-primary/10 flex items-center justify-center mb-3">
                        <Activity className="h-5 w-5" />
                      </div>
                      <p className="text-xs text-muted-foreground">Tentativas</p>
                      <p className="text-2xl font-bold mt-1">{totals?.total ?? "—"}</p>
                      <p className="text-xs text-muted-foreground mt-1">na janela</p>
                    </Card>
                    <Card className="p-5 bg-gradient-card border-border/50">
                      <div className="h-10 w-10 rounded-lg text-success bg-success/10 flex items-center justify-center mb-3">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <p className="text-xs text-muted-foreground">Sucessos</p>
                      <p className="text-2xl font-bold mt-1">{totals?.success ?? "—"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {totals && totals.total > 0
                          ? `${Math.round((totals.success / totals.total) * 100)}%`
                          : "—"}
                      </p>
                    </Card>
                    <Card className="p-5 bg-gradient-card border-border/50">
                      <div className="h-10 w-10 rounded-lg text-destructive bg-destructive/10 flex items-center justify-center mb-3">
                        <XCircle className="h-5 w-5" />
                      </div>
                      <p className="text-xs text-muted-foreground">Falhas</p>
                      <p className="text-2xl font-bold mt-1">{totals?.fail ?? "—"}</p>
                      <p className="text-xs text-muted-foreground mt-1">{failRate}% do total</p>
                    </Card>
                    <Card className="p-5 bg-gradient-card border-border/50">
                      <div className="h-10 w-10 rounded-lg text-warning bg-warning/10 flex items-center justify-center mb-3">
                        <Server className="h-5 w-5" />
                      </div>
                      <p className="text-xs text-muted-foreground">Servidores afetados</p>
                      <p className="text-2xl font-bold mt-1">
                        {dnsErrors?.servers.filter((s) => s.fail > 0).length ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">com ≥1 falha</p>
                    </Card>
                  </div>

                  <Card className="p-6 bg-gradient-card border-border/50">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Distribuição global de erros</h2>
                      <span className="flex items-center gap-1.5 text-xs text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                        Tempo real (10s)
                      </span>
                    </div>
                    {!totals || totals.fail === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        Sem falhas registradas na janela selecionada.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {buckets.map((b) => {
                          const count = totals.buckets[b];
                          if (count === 0) return null;
                          const pct = (count / totals.fail) * 100;
                          const meta = ERROR_BUCKET_META[b];
                          return (
                            <TooltipProvider key={b} delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="space-y-1 cursor-help">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="font-medium">{meta.label}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {count} ({pct.toFixed(1)}%)
                                      </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${meta.cls.split(" ")[0].replace("text-", "bg-")}`}
                                        style={{ width: `${Math.max(pct, 2)}%` }}
                                      />
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{meta.tip}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    )}
                  </Card>

                  <DnsErrorTrendChart
                    series={dnsErrors?.series ?? []}
                    perServerSeries={dnsErrors?.per_server_series}
                    bucketMeta={ERROR_BUCKET_META}
                    serverPalette={SERVER_PALETTE}
                    stepMs={dnsErrors?.step_ms}
                  />

                  <Card className="p-6 bg-gradient-card border-border/50">
                    <h2 className="text-lg font-semibold mb-4">Por servidor (DNS)</h2>
                    {!dnsErrors?.servers.length ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        Sem dados na janela selecionada.
                      </p>
                    ) : (
                      <div className="divide-y divide-border/50">
                        <div className="grid grid-cols-12 gap-3 px-2 py-2 text-xs font-medium text-muted-foreground">
                          <div className="col-span-4">DNS</div>
                          <div className="col-span-2 text-center">Tentativas</div>
                          <div className="col-span-2 text-center">% falhas</div>
                          <div className="col-span-4">Tipos de erro</div>
                        </div>
                        {dnsErrors.servers.map((s) => {
                          const failPct = s.total > 0 ? (s.fail / s.total) * 100 : 0;
                          const status: { label: string; cls: string; tip: string } =
                            s.fail === 0 && s.success > 0
                              ? { label: "OK", cls: "text-success bg-success/10", tip: "Sem falhas registradas." }
                              : failPct >= 80
                                ? { label: "Crítico", cls: "text-destructive bg-destructive/10", tip: "≥80% das tentativas falharam." }
                                : failPct >= 30
                                  ? { label: "Instável", cls: "text-warning bg-warning/10", tip: "Entre 30% e 80% de falhas." }
                                  : { label: "OK", cls: "text-success bg-success/10", tip: "<30% de falhas." };
                          const topBuckets = (Object.entries(s.buckets) as [ErrorBucket, number][])
                            .filter(([, n]) => n > 0)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 4);
                          return (
                            <div key={s.server_url} className="grid grid-cols-12 gap-3 px-2 py-3 items-center text-sm">
                              <div className="col-span-4 min-w-0">
                                <div className="flex items-center gap-2">
                                  <TooltipProvider delayDuration={150}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${status.cls}`}>
                                          {status.label}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>{status.tip}</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <span className="font-mono text-xs truncate">{s.server_url}</span>
                                </div>
                                {s.last_error && (
                                  <p className="text-[11px] text-muted-foreground truncate mt-1">
                                    Último: {s.last_error.slice(0, 90)}
                                  </p>
                                )}
                              </div>
                              <div className="col-span-2 text-center">
                                <p className="font-medium">{s.total}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {s.success} ok · {s.fail} fail
                                </p>
                              </div>
                              <div className="col-span-2 text-center">
                                <p className={`font-bold ${failPct >= 80 ? "text-destructive" : failPct >= 30 ? "text-warning" : "text-success"}`}>
                                  {failPct.toFixed(0)}%
                                </p>
                                <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden mt-1">
                                  <div
                                    className={failPct >= 80 ? "h-full bg-destructive" : failPct >= 30 ? "h-full bg-warning" : "h-full bg-success"}
                                    style={{ width: `${failPct}%` }}
                                  />
                                </div>
                              </div>
                              <div className="col-span-4 flex flex-wrap gap-1">
                                {topBuckets.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : topBuckets.map(([b, n]) => {
                                  const meta = ERROR_BUCKET_META[b];
                                  return (
                                    <TooltipProvider key={b} delayDuration={150}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${meta.cls} cursor-help`}>
                                            {meta.label} · {n}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>{meta.tip}</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="stream-events" className="space-y-6 mt-0">
            <StreamEventsPanel />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6 mt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((s) => {
                const accent =
                  s.accent === "success" ? "text-success bg-success/10" : "text-primary bg-primary/10";
                return (
                  <Card key={s.label} className="p-5 bg-gradient-card border-border/50">
                    <div className={`h-10 w-10 rounded-lg ${accent} flex items-center justify-center mb-3`}>
                      <s.icon className="h-5 w-5" />
                    </div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                  </Card>
                );
              })}
            </div>

            {pending.length > 0 && (
              <Card className="p-5 bg-gradient-card border-border/50 border-l-4 border-l-warning">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">Tentativas de DNS não autorizadas</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      {pending.length} servidor(es) tentou logar e foi bloqueado por não estar cadastrado.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => setTab("servers")}>
                      Ver pendentes
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-6 bg-gradient-card border-border/50">
              <h2 className="text-lg font-semibold mb-4">Eventos recentes</h2>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum evento ainda. Logins futuros aparecerão aqui.
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {events.slice(0, 15).map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-3 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={
                            "h-9 w-9 rounded-full flex items-center justify-center shrink-0 " +
                            (e.success
                              ? "bg-success/15 text-success"
                              : "bg-destructive/15 text-destructive")
                          }
                        >
                          {e.success ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.username}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {e.server_url}
                            {e.reason ? ` • ${e.reason}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        há {formatRelative(e.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4 mt-0">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Card className="bg-gradient-card border-border/50 overflow-hidden">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  Nenhum usuário registrado.
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-medium text-muted-foreground bg-secondary/30">
                    <div className="col-span-3">Usuário</div>
                    <div className="col-span-5">Último servidor</div>
                    <div className="col-span-2">Último login</div>
                    <div className="col-span-2 text-right">Total acessos</div>
                  </div>
                  {filteredUsers.map((u) => (
                    <button
                      type="button"
                      key={u.username}
                      onClick={() => setDetailUsername(u.username)}
                      className="grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm w-full text-left hover:bg-secondary/40 transition-colors"
                    >
                      <div className="col-span-3 flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium shrink-0">
                          {u.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate font-medium">{u.username}</span>
                      </div>
                      <div className="col-span-5 text-muted-foreground truncate text-xs font-mono">
                        {u.last_server}
                      </div>
                      <div className="col-span-2 text-muted-foreground text-xs">
                        há {formatRelative(u.last_login)}
                      </div>
                      <div className="col-span-2 text-right">{u.total}</div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="servers" className="space-y-6 mt-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
              <div className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar DNS..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 sm:gap-3">
                <Button
                  onClick={() => checkAllServers(true)}
                  variant="outline"
                  size="sm"
                  disabled={healthLoading || allowed.length === 0}
                  className="flex-1 sm:flex-none"
                >
                  <RefreshCw className={"h-4 w-4 mr-2 " + (healthLoading ? "animate-spin" : "")} />
                  <span className="sm:hidden">Pings</span>
                  <span className="hidden sm:inline">Atualizar pings</span>
                </Button>
                <Button
                  onClick={() => setAddOpen(true)}
                  variant="default"
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="sm:hidden">Nova DNS</span>
                  <span className="hidden sm:inline">Cadastrar DNS</span>
                </Button>
              </div>
            </div>

            {/* Allowed servers */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" />
                <h2 className="font-semibold">DNS autorizadas ({filteredAllowed.length})</h2>
              </div>
              <Card className="bg-gradient-card border-border/50 overflow-hidden">
                {filteredAllowed.length === 0 ? (
                  <div className="py-12 text-center px-4">
                    <Server className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma DNS cadastrada ainda. Cadastre uma para liberar acessos.
                    </p>
                  </div>
                ) : (
                  <TooltipProvider delayDuration={200}>
                    <div className="divide-y divide-border/50">
                      {filteredAllowed.map((s) => (
                        <div
                          key={s.id}
                          className="px-4 py-4 sm:px-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <ShieldCheck className="h-4 w-4 text-success shrink-0" />
                              {s.label && (
                                <span className="text-sm font-semibold">{s.label}</span>
                              )}
                              <span className="font-mono text-sm text-muted-foreground truncate min-w-0">
                                {s.server_url}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              <span className="whitespace-nowrap">{s.unique_users} usuários</span>
                              <span className="whitespace-nowrap text-success">{s.success_count} ok</span>
                              <span className="whitespace-nowrap text-destructive">{s.fail_count} falhas</span>
                              {s.last_seen ? (
                                <span className="whitespace-nowrap">último uso há {formatRelative(s.last_seen)}</span>
                              ) : (
                                <span className="italic whitespace-nowrap">nunca usado</span>
                              )}
                              {s.notes && <span className="whitespace-nowrap">• {s.notes}</span>}
                            </div>
                            {(() => {
                              const h = health[s.server_url];
                              if (!h) {
                                return (
                                  <div className="text-xs text-muted-foreground">
                                    Verificando ping…
                                  </div>
                                );
                              }
                              return (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                  {(() => {
                                    const b = stateBadge(h.state);
                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className={`${b.cls} cursor-help whitespace-nowrap`}>
                                            {b.dot} {b.label}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          {stateTooltip(h.state)}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })()}
                                  {(() => {
                                    const info = reasonInfo(h.reason);
                                    // Só mostra o chip de causa quando agrega info além do "Online" simples
                                    if (!info || h.reason === "online") return null;
                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className={`px-1.5 py-0.5 rounded border border-border/50 cursor-help whitespace-nowrap ${info.cls}`}>
                                            {info.label}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          {info.tooltip}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })()}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={`${latencyClass(h.latency)} cursor-help whitespace-nowrap`}>
                                        {h.latency != null ? `${h.latency} ms` : "—"}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      Tempo de resposta. &lt;200ms ótimo · &lt;500ms aceitável · &gt;500ms lento.
                                    </TooltipContent>
                                  </Tooltip>
                                  {h.status != null ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          className={`px-1.5 py-0.5 rounded font-mono cursor-help whitespace-nowrap ${statusClass(h.status)}`}
                                        >
                                          HTTP {h.status}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        {httpTooltip(h.status)}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : h.error ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="px-1.5 py-0.5 rounded font-mono text-warning bg-warning/10 cursor-help whitespace-nowrap">
                                          {h.error === "timeout" ? "timeout" : "rede"}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        {h.error === "timeout"
                                          ? "Servidor não respondeu em 5s. Pode estar lento ou inacessível."
                                          : "Erro de rede (DNS, conexão recusada ou TLS). Servidor inacessível."}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : null}
                                  {h.attempts === 2 && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-muted-foreground cursor-help">×2</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        Resultado confirmado em 2 tentativas (retry automático).
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-muted-foreground cursor-help whitespace-nowrap">
                                        último ping {formatTime(h.checked_at)}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      Horário da última verificação. Auto-refresh a cada 30s.
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2 w-full md:w-auto md:shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setProbeServer(s)}
                              className="flex-1 md:flex-none"
                            >
                              <Wifi className="h-4 w-4 mr-2" />
                              Testar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingServer(s);
                                setNewUrl(s.server_url);
                                setNewLabel(s.label ?? "");
                                setNewNotes(s.notes ?? "");
                                setAddOpen(true);
                              }}
                              className="flex-1 md:flex-none"
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive flex-1 md:flex-none"
                              onClick={() => setConfirmRemoveServer(s.server_url)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Apagar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TooltipProvider>
                )}
              </Card>
            </div>

            {/* Pending / rejected */}
            {filteredPending.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <h2 className="font-semibold">
                    Tentativas não autorizadas ({filteredPending.length})
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Servidores que clientes tentaram usar mas estão bloqueados. Autorize se forem legítimos.
                </p>
                <Card className="bg-gradient-card border-border/50 overflow-hidden">
                  <div className="divide-y divide-border/50">
                    {filteredPending.map((s) => (
                      <div
                        key={s.server_url}
                        className="px-4 py-4 sm:px-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                            <span className="font-mono text-sm truncate min-w-0">{s.server_url}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="whitespace-nowrap">{s.unique_users} usuários tentaram</span>
                            <span className="whitespace-nowrap">{s.total_logins} tentativas</span>
                            <span className="whitespace-nowrap">última há {formatRelative(s.last_seen)}</span>
                          </div>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full md:w-auto md:shrink-0"
                          onClick={() => {
                            setNewUrl(s.server_url);
                            setAddOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Autorizar
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setEditingServer(null);
            setNewUrl("");
            setNewLabel("");
            setNewNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingServer ? "Editar DNS autorizada" : "Cadastrar DNS autorizada"}
            </DialogTitle>
            <DialogDescription>
              {editingServer
                ? "Atualize o nome e as observações desta DNS. A URL não pode ser alterada."
                : "Apenas usuários cuja DNS esteja cadastrada aqui poderão logar na plataforma."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="add-url">URL do servidor *</Label>
              <Input
                id="add-url"
                placeholder="http://exemplo.com:8080"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                disabled={!!editingServer}
              />
              <p className="text-xs text-muted-foreground">
                {editingServer
                  ? "URL não editável. Para mudar, remova e recadastre."
                  : 'Pode incluir ou omitir o "http://". Será normalizado.'}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-label">Nome / Revenda (opcional)</Label>
              <Input
                id="add-label"
                placeholder="Ex: Revenda João"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-notes">Observações (opcional)</Label>
              <Textarea
                id="add-notes"
                placeholder="Ex: contato, validade, plano..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={() => newUrl && allowServer(newUrl, newLabel || undefined, newNotes || undefined)}
              disabled={!newUrl}
            >
              {editingServer ? (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  Salvar alterações
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ServerProbeDialog
        open={!!probeServer}
        onOpenChange={(o) => !o && setProbeServer(null)}
        serverUrl={probeServer?.server_url ?? null}
        serverLabel={probeServer?.label ?? null}
      />

      {/* Confirmações destrutivas */}
      <AlertDialog
        open={!!confirmRemoveServer}
        onOpenChange={(o) => !o && setConfirmRemoveServer(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar esta DNS definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              A DNS <strong className="font-mono">{confirmRemoveServer}</strong> será removida da allowlist e
              também serão apagados os registros associados (tentativas de login, sugestões de bloqueio,
              falhas e diagnósticos dessa DNS). Os usuários que usavam essa DNS não conseguirão mais entrar
              e a DNS deixará de aparecer em listas de pendência ou erro.
              <span className="block mt-2 text-xs text-muted-foreground">
                Esta ação é definitiva. Para usar a DNS novamente, é preciso cadastrá-la de novo.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemoveServer && removeServer(confirmRemoveServer)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Apagar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!confirmEvictSession}
        onOpenChange={(o) => !o && setConfirmEvictSession(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmEvictSession?.iptv_username ? (
                <>O usuário <strong>{confirmEvictSession.iptv_username}</strong> será desconectado imediatamente. </>
              ) : (
                <>Esta sessão será desconectada imediatamente. </>
              )}
              Ele pode logar de novo em seguida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmEvictSession && evictSession(confirmEvictSession.anon_user_id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Encerrar sessão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!confirmUnblockUser}
        onOpenChange={(o) => !o && setConfirmUnblockUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O bloqueio temporário será removido e o usuário poderá voltar a acessar a plataforma agora mesmo.
              {confirmUnblockUser?.reason ? (
                <span className="block mt-2 text-xs">Motivo do bloqueio: <em>{confirmUnblockUser.reason}</em></span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter bloqueio</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmUnblockUser && unblockUser(confirmUnblockUser.anon_user_id)}
            >
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bottom nav fixa no mobile */}
      <AdminBottomNav tab={tab} onTabChange={setTab} isAdmin={isAdmin} />

      {/* Detalhe completo do usuário (clicar na lista de Usuários) */}
      <UserDetailDialog username={detailUsername} onClose={() => setDetailUsername(null)} />
    </div>
  );
};

export default Admin;
