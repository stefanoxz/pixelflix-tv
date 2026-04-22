import { useEffect, useState } from "react";
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
  AlertTriangle,
  Monitor,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ActiveSessionRow {
  anon_user_id: string;
  ip: string | null;
  started_at: string;
  last_seen_at: string;
}
interface UserBlockRow {
  blocked_until: string;
  reason: string | null;
}

const Account = () => {
  const { session, logout } = useIptv();
  const navigate = useNavigate();
  const u = session!.userInfo;

  const [mySession, setMySession] = useState<ActiveSessionRow | null>(null);
  const [block, setBlock] = useState<UserBlockRow | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const id = auth.session?.user?.id ?? null;
      if (cancelled) return;
      setMeId(id);
      if (!id) return;
      const [{ data: s }, { data: b }] = await Promise.all([
        supabase.from("active_sessions").select("anon_user_id, ip, started_at, last_seen_at").eq("anon_user_id", id).maybeSingle(),
        supabase.from("user_blocks").select("blocked_until, reason").eq("anon_user_id", id).maybeSingle(),
      ]);
      if (cancelled) return;
      setMySession(s as ActiveSessionRow | null);
      if (b && new Date((b as UserBlockRow).blocked_until).getTime() > Date.now()) {
        setBlock(b as UserBlockRow);
      } else {
        setBlock(null);
      }
    };
    load();
    const t = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const endSession = async () => {
    if (!meId) return;
    const { error } = await supabase.from("active_sessions").delete().eq("anon_user_id", meId);
    if (error) {
      toast.error("Não foi possível encerrar a sessão");
      return;
    }
    toast.success("Sessão encerrada");
    setMySession(null);
  };

  const isActive = u.status?.toLowerCase() === "active";
  const isTrial = u.is_trial === "1";
  const expDate = u.exp_date ? new Date(parseInt(u.exp_date) * 1000) : null;
  const createdAt = u.created_at ? new Date(parseInt(u.created_at) * 1000) : null;

  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const allowedFormats: string[] =
    Array.isArray((u as unknown as { allowed_output_formats?: string[] })?.allowed_output_formats)
      ? (u as unknown as { allowed_output_formats: string[] }).allowed_output_formats
      : [];

  const infoCards = [
    { icon: Calendar, label: "Criado em", value: fmt(createdAt) },
    { icon: Clock, label: "Expira em", value: fmt(expDate) },
    { icon: Wifi, label: "Conexões", value: `${u.active_cons ?? 0} / ${u.max_connections ?? 0}` },
    { icon: Shield, label: "Tipo", value: isTrial ? "Trial" : "Padrão" },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-8 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <UserIcon className="h-5 w-5 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Minha Conta</h1>
      </div>

      {block && (
        <Card className="p-5 border-l-4 border-l-destructive bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold">Acesso temporariamente bloqueado</p>
              <p className="text-sm text-muted-foreground mt-1">
                {block.reason ? `Motivo: ${block.reason}. ` : ""}
                Liberação prevista para {fmtDateTime(block.blocked_until)}.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 md:p-8 bg-gradient-card border-border/50 shadow-card">
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
              className={isActive
                ? "mt-2 border-success/40 bg-success/10 text-success hover:bg-success/15"
                : "mt-2 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"}
            >
              {isActive ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {infoCards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border/50 bg-card/40 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <c.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <p className="text-base font-semibold mt-0.5 truncate">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {allowedFormats.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground mb-2">Formatos permitidos</p>
            <div className="flex flex-wrap gap-2">
              {allowedFormats.map((f) => (
                <span key={f} className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-mono uppercase tracking-wider border border-border/50">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 md:p-8 bg-gradient-card border-border/50 shadow-card">
        <div className="flex items-center gap-2 mb-5">
          <Monitor className="h-5 w-5 text-primary" />
          <h2 className="text-lg md:text-xl font-bold">Sessão atual</h2>
        </div>
        {mySession ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-card/40 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Iniciada em {fmtDateTime(mySession.started_at)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Último sinal: {fmtDateTime(mySession.last_seen_at)}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={endSession} className="gap-2">
              <X className="h-4 w-4" /> Encerrar
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma sessão de streaming ativa.</p>
        )}
      </Card>

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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Canais favoritos</p>
              <p className="text-base font-semibold mt-0.5">0</p>
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Filmes favoritos</p>
              <p className="text-base font-semibold mt-0.5">0</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="destructive" onClick={() => { logout(); navigate("/login"); }}>
          Sair da conta
        </Button>
      </div>
    </div>
  );
};

export default Account;
