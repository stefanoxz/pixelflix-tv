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
      icon: Users,
      label: "Equipe",
      value: "Ativa",
      sub: "permissões admin",
      accent: "primary",
    },
  ];


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Últimos eventos</h3>
          </div>
          <div className="space-y-3">
            {!events.length ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhum evento recente.</p>
            ) : (
              events.slice(0, 5).map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-xs border-b border-border/30 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{e.event_type}</p>
                    <p className="text-muted-foreground truncate">{e.username || "Sistema"}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatRelative(e.created_at)}</span>
                </div>
              ))
            )}
          </div>
          <Button variant="link" size="sm" className="w-full mt-2 text-xs h-auto py-0" onClick={() => setTab("users")}>Ver usuários</Button>
        </Card>

        {pending.length > 0 && (
          <Card className="p-5 bg-gradient-card border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h3 className="font-semibold text-sm">DNS aguardando</h3>
            </div>
            <div className="space-y-3">
              {pending.slice(0, 3).map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs border-b border-border/30 pb-2 last:border-0 last:pb-0">
                  <span className="font-mono truncate flex-1">{p.server_url}</span>
                  <Button variant="outline" size="xs" className="h-6 text-[10px]" onClick={() => setTab("servers")}>Revisar</Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>

  );
}
