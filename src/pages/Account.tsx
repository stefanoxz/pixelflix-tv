import { useEffect, useMemo, useState } from "react";
import { useIptv } from "@/context/IptvContext";
import { useQuery } from "@tanstack/react-query";
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
  Clapperboard,
  AlertTriangle,
  Monitor,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { readFavoriteIds } from "@/hooks/useFavorites";
import {
  getLiveStreams,
  getVodStreams,
  getSeries,
  proxyImageUrl,
} from "@/services/iptv";

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
  const creds = session!.creds;

  const [mySession, setMySession] = useState<ActiveSessionRow | null>(null);
  const [block, setBlock] = useState<UserBlockRow | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  // Lê IDs favoritos do localStorage (sem reagir a outras abas — recarrega no mount)
  const favLive = useMemo(() => readFavoriteIds(creds.username, "live"), [creds.username]);
  const favVod = useMemo(() => readFavoriteIds(creds.username, "vod"), [creds.username]);
  const favSeries = useMemo(() => readFavoriteIds(creds.username, "series"), [creds.username]);

  // Reaproveita os caches já carregados em outras telas (mesmo queryKey)
  const { data: liveAll = [] } = useQuery({
    queryKey: ["live-streams", creds.username],
    queryFn: () => getLiveStreams(creds),
    enabled: favLive.length > 0,
  });
  const { data: moviesAll = [] } = useQuery({
    queryKey: ["vod-streams", creds.username],
    queryFn: () => getVodStreams(creds),
    enabled: favVod.length > 0,
  });
  const { data: seriesAll = [] } = useQuery({
    queryKey: ["series", creds.username],
    queryFn: () => getSeries(creds),
    enabled: favSeries.length > 0,
  });

  const liveItems = useMemo(
    () => favLive.map((id) => liveAll.find((x) => x.stream_id === id)).filter(Boolean),
    [favLive, liveAll],
  );
  const vodItems = useMemo(
    () => favVod.map((id) => moviesAll.find((x) => x.stream_id === id)).filter(Boolean),
    [favVod, moviesAll],
  );
  const seriesItems = useMemo(
    () => favSeries.map((id) => seriesAll.find((x) => x.series_id === id)).filter(Boolean),
    [favSeries, seriesAll],
  );

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

  const favSections = [
    {
      key: "live",
      icon: Radio,
      label: "Canais favoritos",
      count: favLive.length,
      items: liveItems.slice(0, 6).map((x) => ({
        id: x!.stream_id,
        title: x!.name,
        cover: x!.stream_icon,
        to: "/live" as const,
      })),
      route: "/live" as const,
      empty: "Você ainda não favoritou nenhum canal.",
    },
    {
      key: "vod",
      icon: Film,
      label: "Filmes favoritos",
      count: favVod.length,
      items: vodItems.slice(0, 6).map((x) => ({
        id: x!.stream_id,
        title: x!.name,
        cover: x!.stream_icon,
        to: "/movies" as const,
      })),
      route: "/movies" as const,
      empty: "Você ainda não favoritou nenhum filme.",
    },
    {
      key: "series",
      icon: Clapperboard,
      label: "Séries favoritas",
      count: favSeries.length,
      items: seriesItems.slice(0, 6).map((x) => ({
        id: x!.series_id,
        title: x!.name,
        cover: x!.cover,
        to: "/series" as const,
      })),
      route: "/series" as const,
      empty: "Você ainda não favoritou nenhuma série.",
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-3 md:px-6 py-2 md:py-3 space-y-6 pb-10">
      <LibraryTopBar
        title="Minha Conta"
        icon={<UserIcon className="h-4 w-4" />}
        subtitle={isActive ? `Conta ativa · expira em ${fmt(expDate)}` : "Conta inativa"}
      />

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

        {/* Contadores */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {favSections.map((s) => (
            <button
              key={s.key}
              onClick={() => navigate(s.route)}
              className="text-left rounded-xl border border-border/50 bg-card/40 p-4 flex items-center gap-3 transition-smooth hover:border-primary/50"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
                <p className="text-base font-semibold mt-0.5">{s.count}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Listas com miniaturas */}
        <div className="mt-6 space-y-6">
          {favSections.map((s) => (
            <div key={`list-${s.key}`}>
              <div className="flex items-center gap-2 mb-3">
                <s.icon className="h-4 w-4 text-primary/80" />
                <h3 className="text-sm font-semibold">{s.label}</h3>
                {s.count > 6 && (
                  <span className="text-xs text-muted-foreground">
                    (mostrando 6 de {s.count})
                  </span>
                )}
              </div>
              {s.items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{s.empty}</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {s.items.map((item) => (
                    <button
                      key={`${s.key}-${item.id}`}
                      onClick={() => navigate(s.route, { state: { openId: item.id } })}
                      className="group relative aspect-[2/3] overflow-hidden rounded-md bg-secondary border border-border/50 transition-smooth hover:border-primary/50 hover:shadow-glow"
                      title={item.title}
                    >
                      {item.cover ? (
                        <img
                          src={proxyImageUrl(item.cover)}
                          alt={item.title}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition-smooth group-hover:scale-105"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground p-2 text-center">
                          {item.title}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                        <p className="text-[11px] text-white font-medium line-clamp-2">
                          {item.title}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
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
