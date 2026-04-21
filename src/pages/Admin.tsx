import { Navigate, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCheck,
  Activity,
  TrendingUp,
  LogOut,
  Shield,
  Tv,
  PlayCircle,
} from "lucide-react";

const TOKEN_KEY = "admin_token";

const Admin = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return <Navigate to="/admin/login" replace />;

  const stats = [
    { icon: Users, label: "Total de usuários", value: "1.284", trend: "+12%", accent: "primary" },
    { icon: UserCheck, label: "Usuários online", value: "342", trend: "+5%", accent: "success" },
    { icon: PlayCircle, label: "Streams ativas", value: "287", trend: "+8%", accent: "primary" },
    { icon: Activity, label: "Uptime", value: "99.9%", trend: "estável", accent: "success" },
  ];

  const recent = [
    { user: "joao_silva", status: "online", since: "2h" },
    { user: "maria.s", status: "online", since: "45min" },
    { user: "carlos_m", status: "online", since: "12min" },
    { user: "ana.lima", status: "offline", since: "1d" },
    { user: "pedro_h", status: "online", since: "3h" },
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
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-primary/10 text-primary text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            Dashboard
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-secondary/50 hover:text-foreground text-sm">
            <Users className="h-4 w-4" />
            Usuários
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-secondary/50 hover:text-foreground text-sm">
            <Tv className="h-4 w-4" />
            Streams
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
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => {
            const accent = s.accent === "success" ? "text-success bg-success/10" : "text-primary bg-primary/10";
            return (
              <Card key={s.label} className="p-5 bg-gradient-card border-border/50">
                <div className={`h-10 w-10 rounded-lg ${accent} flex items-center justify-center mb-3`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <span className="text-xs text-success">{s.trend}</span>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-6 bg-gradient-card border-border/50">
          <h2 className="text-lg font-semibold mb-4">Atividade recente</h2>
          <div className="divide-y divide-border/50">
            {recent.map((r) => (
              <div key={r.user} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                    {r.user.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{r.user}</p>
                    <p className="text-xs text-muted-foreground">há {r.since}</p>
                  </div>
                </div>
                <span
                  className={
                    "text-xs px-2 py-1 rounded-full " +
                    (r.status === "online"
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            * Dados ilustrativos. Conecte uma fonte de telemetria para métricas reais.
          </p>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
