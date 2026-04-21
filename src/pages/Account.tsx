import { useIptv } from "@/context/IptvContext";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Calendar, Users, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Account = () => {
  const { session, logout } = useIptv();
  const navigate = useNavigate();
  const u = session!.userInfo;

  const isActive = u.status?.toLowerCase() === "active";
  const expDate = u.exp_date ? new Date(parseInt(u.exp_date) * 1000) : null;
  const createdAt = u.created_at ? new Date(parseInt(u.created_at) * 1000) : null;

  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  const cards = [
    {
      icon: User,
      label: "Usuário",
      value: u.username,
      sub: u.is_trial === "1" ? "Conta de teste" : "Conta padrão",
    },
    {
      icon: isActive ? CheckCircle2 : XCircle,
      label: "Status",
      value: isActive ? "Ativo" : "Inativo",
      sub: isActive ? "Acesso liberado" : "Verifique sua assinatura",
      accent: isActive ? "success" : "destructive",
    },
    {
      icon: Calendar,
      label: "Expira em",
      value: fmt(expDate),
      sub: expDate ? `${Math.ceil((expDate.getTime() - Date.now()) / 86400000)} dias restantes` : "—",
    },
    {
      icon: Users,
      label: "Conexões",
      value: `${u.active_cons} / ${u.max_connections}`,
      sub: "Ativas / máximo",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Minha Conta</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detalhes da sua assinatura e perfil
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const accentClass =
            c.accent === "success"
              ? "text-success bg-success/10"
              : c.accent === "destructive"
                ? "text-destructive bg-destructive/10"
                : "text-primary bg-primary/10";
          return (
            <Card key={c.label} className="p-6 bg-gradient-card border-border/50 shadow-card">
              <div className={`h-10 w-10 rounded-lg ${accentClass} flex items-center justify-center mb-4`}>
                <c.icon className="h-5 w-5" />
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <p className="text-2xl font-bold mt-1 truncate">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Informações da assinatura
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Servidor</dt>
            <dd className="font-mono text-xs mt-1 truncate">{session!.creds.server}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Criado em</dt>
            <dd className="mt-1">{fmt(createdAt)}</dd>
          </div>
        </dl>

        <div className="mt-6 pt-6 border-t border-border/50">
          <Button
            variant="destructive"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Sair da conta
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Account;
