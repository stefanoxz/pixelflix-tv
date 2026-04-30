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

      {/* Painéis de eventos desativados */}
    </div>

  );
}
