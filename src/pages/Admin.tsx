import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Ban,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Lock,
  Unlock,
} from "lucide-react";

const TOKEN_KEY = "admin_token";

interface Stats {
  totalEvents: number;
  events24h: number;
  success24h: number;
  fail24h: number;
  onlineNow: number;
  totalUsers: number;
  totalServers: number;
  blockedServers: number;
}

interface AdminUser {
  username: string;
  last_server: string;
  last_login: string;
  last_success: boolean;
  total: number;
}

interface AdminServer {
  server_url: string;
  last_seen: string;
  total_logins: number;
  success_count: number;
  fail_count: number;
  unique_users: number;
  blocked: boolean;
  block_reason: string | null;
}

interface AdminEvent {
  id: string;
  username: string;
  server_url: string;
  success: boolean;
  reason: string | null;
  created_at: string;
}

async function callAdmin<T>(token: string, action: string, payload?: any): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-api", {
    body: { token, action, payload },
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

const Admin = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem(TOKEN_KEY);

  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [servers, setServers] = useState<AdminServer[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [blockOpen, setBlockOpen] = useState(false);
  const [blockUrl, setBlockUrl] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [s, u, sv, e] = await Promise.all([
        callAdmin<Stats>(token, "stats"),
        callAdmin<{ users: AdminUser[] }>(token, "list_users"),
        callAdmin<{ servers: AdminServer[] }>(token, "list_servers"),
        callAdmin<{ events: AdminEvent[] }>(token, "recent_events", { limit: 50 }),
      ]);
      setStats(s);
      setUsers(u.users);
      setServers(sv.servers);
      setEvents(e.events);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const blockServer = async (url: string, reason?: string) => {
    if (!token) return;
    try {
      await callAdmin(token, "block_server", { server_url: url, reason });
      toast.success("Servidor bloqueado");
      setBlockOpen(false);
      setBlockUrl("");
      setBlockReason("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao bloquear");
    }
  };

  const unblockServer = async (url: string) => {
    if (!token) return;
    try {
      await callAdmin(token, "unblock_server", { server_url: url });
      toast.success("Servidor desbloqueado");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desbloquear");
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter((u) =>
        search ? u.username.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    [users, search],
  );

  const filteredServers = useMemo(
    () =>
      servers.filter((s) =>
        search ? s.server_url.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    [servers, search],
  );

  if (!token) return <Navigate to="/admin/login" replace />;

  const statCards = [
    {
      icon: Users,
      label: "Usuários únicos",
      value: stats?.totalUsers ?? "—",
      sub: `${stats?.events24h ?? 0} eventos 24h`,
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
      icon: Server,
      label: "Servidores ativos",
      value: stats?.totalServers ?? "—",
      sub: `${stats?.blockedServers ?? 0} bloqueados`,
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
          <button
            onClick={() => setTab("dashboard")}
            className={
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors " +
              (tab === "dashboard"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground")
            }
          >
            <TrendingUp className="h-4 w-4" />
            Dashboard
          </button>
          <button
            onClick={() => setTab("users")}
            className={
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors " +
              (tab === "users"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground")
            }
          >
            <Users className="h-4 w-4" />
            Usuários
          </button>
          <button
            onClick={() => setTab("servers")}
            className={
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors " +
              (tab === "servers"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground")
            }
          >
            <Server className="h-4 w-4" />
            Servidores
          </button>
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
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              navigate("/admin/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-4 md:p-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold capitalize">
              {tab === "dashboard" ? "Dashboard" : tab === "users" ? "Usuários" : "Servidores (DNS)"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tab === "dashboard"
                ? "Visão geral em tempo real"
                : tab === "users"
                  ? "Quem está acessando a plataforma"
                  : "DNS cadastradas pelos usuários — bloqueie acessos indesejados"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={"h-4 w-4 mr-2 " + (loading ? "animate-spin" : "")} />
            Atualizar
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
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

            <Card className="p-6 bg-gradient-card border-border/50">
              <h2 className="text-lg font-semibold mb-4">Eventos recentes</h2>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum evento registrado ainda. Logins futuros aparecerão aqui.
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {events.slice(0, 15).map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-3 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={
                            "h-9 w-9 rounded-full flex items-center justify-center shrink-0 " +
                            (e.success ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")
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
                      <div className="col-span-5 text-muted-foreground truncate text-xs">
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

          <TabsContent value="servers" className="space-y-4 mt-0">
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
              <Button onClick={() => setBlockOpen(true)} variant="default" size="sm">
                <Ban className="h-4 w-4 mr-2" />
                Bloquear DNS
              </Button>
            </div>

            <Card className="bg-gradient-card border-border/50 overflow-hidden">
              {filteredServers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  Nenhum servidor registrado ainda.
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredServers.map((s) => (
                    <div
                      key={s.server_url}
                      className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-mono text-sm truncate">{s.server_url}</span>
                          {s.blocked && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              bloqueado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>{s.unique_users} usuários</span>
                          <span className="text-success">{s.success_count} ok</span>
                          <span className="text-destructive">{s.fail_count} falhas</span>
                          {s.last_seen && <span>visto há {formatRelative(s.last_seen)}</span>}
                          {s.block_reason && (
                            <span className="text-destructive">motivo: {s.block_reason}</span>
                          )}
                        </div>
                      </div>
                      {s.blocked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unblockServer(s.server_url)}
                        >
                          <Unlock className="h-4 w-4 mr-2" />
                          Desbloquear
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setBlockUrl(s.server_url);
                            setBlockOpen(true);
                          }}
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Bloquear
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear DNS</DialogTitle>
            <DialogDescription>
              Usuários que tentarem logar nesse servidor terão o acesso negado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="block-url">URL do servidor</Label>
              <Input
                id="block-url"
                placeholder="http://exemplo.com:8080"
                value={blockUrl}
                onChange={(e) => setBlockUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="block-reason">Motivo (opcional)</Label>
              <Textarea
                id="block-reason"
                placeholder="Ex: pirataria, abuso, etc"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlockOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={() => blockUrl && blockServer(blockUrl, blockReason || undefined)}
              disabled={!blockUrl}
            >
              <Ban className="h-4 w-4 mr-2" />
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
