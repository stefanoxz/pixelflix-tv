import { useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  started_at: string;
  last_seen_at: string;
  duration_s: number;
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
  requests: number;
  segments: number;
}

async function callAdmin<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-api", {
    body: { action, payload },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
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

interface HealthStatus {
  state: HealthState;
  online: boolean;
  latency: number | null;
  status: number | null;
  attempts?: number;
  checked_at: string;
  error?: string;
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

const Admin = () => {
  const navigate = useNavigate();

  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allowed, setAllowed] = useState<AllowedServer[]>([]);
  const [pending, setPending] = useState<PendingServer[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringOverview | null>(null);
  const [topConsumers, setTopConsumers] = useState<TopConsumer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [health, setHealth] = useState<Record<string, HealthStatus>>({});
  const [healthLoading, setHealthLoading] = useState(false);

  const checkAllServers = async () => {
    if (!allowed.length) return;
    setHealthLoading(true);
    try {
      const { data } = await supabase.functions.invoke("check-server", {
        body: { urls: allowed.map((s) => s.server_url) },
      });
      const results = (data as { results?: (HealthStatus & { url: string })[] } | null)?.results ?? [];
      const map: Record<string, HealthStatus> = {};
      for (const r of results) {
        map[r.url] = {
          online: r.online,
          latency: r.latency,
          status: r.status ?? null,
          checked_at: r.checked_at,
          error: r.error,
        };
      }
      if (Object.keys(map).length > 0) {
        setHealth((prev) => ({ ...prev, ...map }));
      }
    } catch {
      // silencioso — fallback "Verificando..." permanece
    } finally {
      setHealthLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, u, sv, e, mo, tc] = await Promise.all([
        callAdmin<Stats>("stats"),
        callAdmin<{ users: AdminUser[] }>("list_users"),
        callAdmin<{ allowed: AllowedServer[]; pending: PendingServer[] }>("list_servers"),
        callAdmin<{ events: AdminEvent[] }>("recent_events", { limit: 50 }),
        callAdmin<MonitoringOverview>("monitoring_overview"),
        callAdmin<{ consumers: TopConsumer[] }>("top_consumers"),
      ]);
      setStats(s);
      setUsers(u.users);
      setAllowed(sv.allowed);
      setPending(sv.pending);
      setEvents(e.events);
      setMonitoring(mo);
      setTopConsumers(tc.consumers);
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
    }
  };

  useEffect(() => {
    refresh();
    // Faster refresh while on Monitoring tab
    const interval = tab === "monitoring" ? 10_000 : 30_000;
    const t = setInterval(refresh, interval);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Health check polling — apenas no tab "servers"
  useEffect(() => {
    if (tab !== "servers" || allowed.length === 0) return;
    checkAllServers();
    const t = setInterval(checkAllServers, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, allowed.length]);

  const allowServer = async (server_url: string, label?: string, notes?: string) => {
    try {
      await callAdmin("allow_server", { server_url, label, notes });
      toast.success("DNS autorizada");
      setAddOpen(false);
      setNewUrl("");
      setNewLabel("");
      setNewNotes("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autorizar");
    }
  };

  const removeServer = async (server_url: string) => {
    if (!confirm(`Remover acesso ao servidor "${server_url}"?\nUsuários não conseguirão mais logar nele.`)) return;
    try {
      await callAdmin("remove_server", { server_url });
      toast.success("DNS removida");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    }
  };

  const unblockUser = async (anon_user_id: string) => {
    try {
      await callAdmin("unblock_user", { anon_user_id });
      toast.success("Usuário desbloqueado");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desbloquear");
    }
  };

  const evictSession = async (anon_user_id: string) => {
    try {
      await callAdmin("evict_session", { anon_user_id });
      toast.success("Sessão encerrada");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao encerrar");
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

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-64 lg:shrink-0 bg-card border-b lg:border-b-0 lg:border-r border-border/50 p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-md bg-gradient-primary flex items-center justify-center shadow-glow">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold">Admin Panel</span>
        </div>
        <nav className="space-y-1">
          {[
            { id: "dashboard", label: "Dashboard", icon: TrendingUp },
            { id: "monitoring", label: "Monitoramento", icon: Monitor },
            { id: "users", label: "Usuários", icon: Users },
            { id: "servers", label: "DNS / Servidores", icon: Server },
          ].map((item) => (
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
            onClick={() => navigate("/")}
          >
            ← Voltar ao app
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
            onClick={async () => {
              setSigningOut(true);
              await supabase.auth.signOut();
              navigate("/admin/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">
              {tab === "dashboard" ? "Dashboard"
                : tab === "monitoring" ? "Monitoramento"
                : tab === "users" ? "Usuários"
                : "DNS / Servidores"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tab === "dashboard" ? "Visão geral em tempo real"
                : tab === "monitoring" ? "Sessões ativas, consumo e bloqueios — atualiza a cada 10s"
                : tab === "users" ? "Quem está acessando a plataforma"
                : "Cadastre as DNS autorizadas. Sem cadastro prévio, o cliente não consegue logar."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={"h-4 w-4 mr-2 " + (loading ? "animate-spin" : "")} />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
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
              <h2 className="text-lg font-semibold mb-4">Sessões ativas</h2>
              {!monitoring?.active_sessions.length ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Ninguém online no momento.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  <div className="grid grid-cols-12 gap-3 px-2 py-2 text-xs font-medium text-muted-foreground">
                    <div className="col-span-3">Usuário IPTV</div>
                    <div className="col-span-3">IP</div>
                    <div className="col-span-2">Início</div>
                    <div className="col-span-2">Duração</div>
                    <div className="col-span-2 text-right">Ação</div>
                  </div>
                  {monitoring.active_sessions.map((s) => (
                    <div key={s.anon_user_id} className="grid grid-cols-12 gap-3 px-2 py-3 items-center text-sm">
                      <div className="col-span-3 font-medium truncate">{s.iptv_username || "—"}</div>
                      <div className="col-span-3 font-mono text-xs text-muted-foreground">{s.ip_masked}</div>
                      <div className="col-span-2 text-xs text-muted-foreground">há {formatRelative(s.started_at)}</div>
                      <div className="col-span-2 text-xs">{Math.floor(s.duration_s / 60)}min</div>
                      <div className="col-span-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => evictSession(s.anon_user_id)}>
                          <X className="h-3 w-3 mr-1" />Encerrar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
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
                      <div key={c.anon_user_id} className="flex items-center justify-between py-2 text-sm">
                        <span className="font-medium truncate">{c.iptv_username || c.anon_user_id.slice(0, 8)}</span>
                        <span className="text-xs text-muted-foreground">
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
                        <Button size="sm" variant="outline" onClick={() => unblockUser(b.anon_user_id)}>
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
                    <div
                      key={u.username}
                      className="grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm"
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
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="servers" className="space-y-6 mt-0">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar DNS..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={checkAllServers}
                variant="outline"
                size="sm"
                disabled={healthLoading || allowed.length === 0}
              >
                <RefreshCw className={"h-4 w-4 mr-2 " + (healthLoading ? "animate-spin" : "")} />
                Atualizar pings
              </Button>
              <Button onClick={() => setAddOpen(true)} variant="default" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar DNS
              </Button>
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
                  <div className="divide-y divide-border/50">
                    {filteredAllowed.map((s) => (
                      <div
                        key={s.id}
                        className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <ShieldCheck className="h-4 w-4 text-success shrink-0" />
                            {s.label && (
                              <span className="text-sm font-semibold">{s.label}</span>
                            )}
                            <span className="font-mono text-sm text-muted-foreground truncate">
                              {s.server_url}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{s.unique_users} usuários</span>
                            <span className="text-success">{s.success_count} ok</span>
                            <span className="text-destructive">{s.fail_count} falhas</span>
                            {s.last_seen ? (
                              <span>último uso há {formatRelative(s.last_seen)}</span>
                            ) : (
                              <span className="italic">nunca usado</span>
                            )}
                            {s.notes && <span>• {s.notes}</span>}
                          </div>
                          {(() => {
                            const h = health[s.server_url];
                            if (!h) {
                              return (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Verificando ping…
                                </div>
                              );
                            }
                            return (
                              <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                                <span className={h.online ? "text-success" : "text-destructive"}>
                                  ● {h.online ? "Online" : "Offline"}
                                </span>
                                <span className={latencyClass(h.latency)}>
                                  {h.latency != null ? `${h.latency} ms` : "—"}
                                </span>
                                {h.status != null && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-mono ${statusClass(h.status)}`}
                                    title="Código HTTP da resposta"
                                  >
                                    HTTP {h.status}
                                  </span>
                                )}
                                <span className="text-muted-foreground">
                                  último ping {formatTime(h.checked_at)}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeServer(s.server_url)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
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
                        className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                            <span className="font-mono text-sm truncate">{s.server_url}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{s.unique_users} usuários tentaram</span>
                            <span>{s.total_logins} tentativas</span>
                            <span>última há {formatRelative(s.last_seen)}</span>
                          </div>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar DNS autorizada</DialogTitle>
            <DialogDescription>
              Apenas usuários cuja DNS esteja cadastrada aqui poderão logar na plataforma.
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
              />
              <p className="text-xs text-muted-foreground">
                Pode incluir ou omitir o "http://". Será normalizado.
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
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
