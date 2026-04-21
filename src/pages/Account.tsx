import { useIptv } from "@/context/IptvContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  Wifi,
  Shield,
  User as UserIcon,
  Heart,
  Radio,
  Film,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Account = () => {
  const { session, logout } = useIptv();
  const navigate = useNavigate();
  const u = session!.userInfo;

  const isActive = u.status?.toLowerCase() === "active";
  const isTrial = u.is_trial === "1";
  const expDate = u.exp_date ? new Date(parseInt(u.exp_date) * 1000) : null;
  const createdAt = u.created_at ? new Date(parseInt(u.created_at) * 1000) : null;

  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  // Allowed output formats — Xtream API may return these on user_info as array
  const allowedFormats: string[] =
    Array.isArray((u as any)?.allowed_output_formats)
      ? (u as any).allowed_output_formats
      : [];

  const infoCards = [
    { icon: Calendar, label: "Criado em", value: fmt(createdAt) },
    { icon: Clock, label: "Expira em", value: fmt(expDate) },
    {
      icon: Wifi,
      label: "Conexões",
      value: `${u.active_cons ?? 0} / ${u.max_connections ?? 0}`,
    },
    {
      icon: Shield,
      label: "Tipo",
      value: isTrial ? "Trial" : "Padrão",
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-8 py-8 space-y-6">
      {/* Page title */}
      <div className="flex items-center gap-2">
        <UserIcon className="h-5 w-5 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Minha Conta</h1>
      </div>

      {/* Profile card */}
      <Card className="p-6 md:p-8 bg-gradient-card border-border/50 shadow-card">
        {/* Header: avatar + username + status */}
        <div className="flex items-center gap-5 mb-6">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl" />
            <div className="relative h-16 w-16 rounded-full bg-primary/10 ring-2 ring-primary/40 flex items-center justify-center">
              <UserIcon className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold truncate">{u.username}</h2>
            <Badge
              variant="outline"
              className={
                isActive
                  ? "mt-2 border-success/40 bg-success/10 text-success hover:bg-success/15"
                  : "mt-2 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
              }
            >
              {isActive ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>

        {/* Info grid 2x2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {infoCards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-border/50 bg-card/40 p-4 flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <c.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </p>
                <p className="text-base font-semibold mt-0.5 truncate">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Allowed formats */}
        {allowedFormats.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground mb-2">Formatos permitidos</p>
            <div className="flex flex-wrap gap-2">
              {allowedFormats.map((f) => (
                <span
                  key={f}
                  className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-mono uppercase tracking-wider border border-border/50"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Favorites card */}
      <Card className="p-6 md:p-8 bg-gradient-card border-border/50 shadow-card">
        <div className="flex items-center gap-2 mb-5">
          <Heart className="h-5 w-5 text-primary fill-primary/30" />
          <h2 className="text-lg md:text-xl font-bold">Favoritos</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/50 bg-card/40 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Canais favoritos
              </p>
              <p className="text-base font-semibold mt-0.5">0</p>
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Filmes favoritos
              </p>
              <p className="text-base font-semibold mt-0.5">0</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Logout */}
      <div className="flex justify-end">
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
    </div>
  );
};

export default Account;
