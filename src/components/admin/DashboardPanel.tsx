import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, UserCheck, Users, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/adminUtils";
import type { Stats, AdminEvent, PendingServer } from "@/types/admin";

interface DashboardPanelProps {
  stats: Stats | null;
  events: AdminEvent[];
  pending: PendingServer[];
  setTab: (tab: string) => void;
}

export function DashboardPanel({ stats, events, pending, setTab }: DashboardPanelProps) {
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
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const accent = s.accent === "success" ? "text-success bg-success/10" : "text-primary bg-primary/10";
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
    </div>
  );
}
