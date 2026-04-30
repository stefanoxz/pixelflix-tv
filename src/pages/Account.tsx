import { useEffect, useMemo, useRef, useState } from "react";
import { useIptv } from "@/context/IptvContext";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Pencil,
  Check,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LibraryTopBar } from "@/components/library/LibraryTopBar";
import { cn } from "@/lib/utils";
import { readFavoriteIds } from "@/hooks/useFavorites";
import {
  getLiveStreams,
  getVodStreams,
  getSeries,
  proxyImageUrl,
} from "@/services/iptv";
import { SafeImage } from "@/components/SafeImage";
import {
  clearDisplayName,
  displayNameSchema,
  setDisplayName,
  useDisplayName,
} from "@/lib/displayName";

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

  // Edição inline do nome de exibição
  const displayName = useDisplayName(creds.username);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startEditName = () => {
    setNameDraft(displayName);
    setNameError(null);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setNameError(null);
  };

  const saveName = () => {
    const result = displayNameSchema.safeParse(nameDraft);
    if (!result.success) {
      setNameError(result.error.issues[0]?.message ?? "Nome inválido");
      return;
    }
    setDisplayName(creds.username, result.data);
    toast.success("Nome atualizado");
    setEditingName(false);
  };

  const removeName = () => {
    clearDisplayName(creds.username);
    toast.success("Nome removido");
    setEditingName(false);
  };

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

      <Card className="p-6 md:p-8 glass-card border-white/5 shadow-2xl overflow-hidden relative">
        {/* Glow decorativo */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center items-center text-center md:text-left gap-5 mb-6">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-gradient-primary blur-xl opacity-60" />
            <div className="relative h-14 w-14 md:h-20 md:w-20 rounded-full bg-gradient-primary text-primary-foreground ring-2 ring-primary/40 flex items-center justify-center shadow-glow">
              <UserIcon className="h-6 w-6 md:h-9 md:w-9" strokeWidth={2.25} />
            </div>
          </div>
          <div className="min-w-0 flex-1 w-full">
            {editingName ? (
              <div className="space-y-2">
                <Input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={(e) => {
                    setNameDraft(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") cancelEditName();
                  }}
                  placeholder="Seu primeiro nome"
                  maxLength={20}
                  className="h-10 text-base md:text-lg font-semibold"
                  aria-invalid={!!nameError}
                />
                {nameError && (
                  <p className="text-xs text-destructive">{nameError}</p>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveName} className="flex-1 md:flex-initial gap-1 h-9">
                    <Check className="h-4 w-4" />
                    <span>Salvar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelEditName}
                    className="flex-1 md:flex-initial h-9"
                  >
                    Cancelar
                  </Button>
                </div>
                {displayName && (
                  <button
                    type="button"
                    onClick={removeName}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Remover nome
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center md:justify-start gap-2 group">
                  <h2 className="text-2xl md:text-3xl font-bold truncate">
                    {displayName || u.username}
                  </h2>
                  <button
                    type="button"
                    onClick={startEditName}
                    aria-label="Editar nome de exibição"
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors tap-feedback"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                {displayName && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Login: {u.username}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
                  <Badge
                    variant="outline"
                    className={isActive
                      ? "border-success/40 bg-success/10 text-success hover:bg-success/15"
                      : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"}
                  >
                    <span className={cn(
                      "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                      isActive ? "bg-success animate-pulse" : "bg-destructive",
                    )} />
                    {isActive ? "Ativo" : "Inativo"}
                  </Badge>
                  {isTrial && (
                    <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                      Trial
                    </Badge>
                  )}
                </div>
              </>
            )}
          </div>
          {mySession && (
            <Button variant="outline" size="sm" onClick={endSession} className="gap-2 self-center md:self-center tap-feedback">
              <X className="h-4 w-4" /> Encerrar sessão
            </Button>
          )}
        </div>

        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3">
          {infoCards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border/40 bg-card/50 p-3 md:p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <c.icon className="h-3.5 w-3.5" />
                <p className="text-[10px] font-semibold uppercase tracking-wider truncate">{c.label}</p>
              </div>
              <p className="text-sm md:text-lg font-bold tabular-nums truncate">{c.value}</p>
            </div>
          ))}
        </div>

        {mySession && (
          <div className="relative mt-4 flex items-center gap-2 text-xs text-muted-foreground border-t border-border/40 pt-4">
            <Monitor className="h-3.5 w-3.5 text-primary" />
            <span>
              Sessão de streaming ativa desde <span className="text-foreground font-medium">{fmtDateTime(mySession.started_at)}</span>
              <span className="opacity-50"> · </span>
              último sinal {fmtDateTime(mySession.last_seen_at)}
            </span>
          </div>
        )}

        {allowedFormats.length > 0 && (
          <div className="relative mt-4 pt-4 border-t border-border/40">
            <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Formatos permitidos</p>
            <div className="flex flex-wrap gap-2">
              {allowedFormats.map((f) => (
                <span key={f} className="px-2.5 py-1 rounded-md bg-secondary/70 text-secondary-foreground text-[11px] font-mono uppercase tracking-wider border border-border/40">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 md:p-8 bg-gradient-card border-border/40 shadow-card">
        <div className="flex items-center gap-2 mb-5">
          <Heart className="h-5 w-5 text-primary fill-primary/30" />
          <h2 className="section-title">Favoritos</h2>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {favLive.length + favVod.length + favSeries.length} no total
          </span>
        </div>

        {/* Seções com header (ícone + count + ver tudo) */}
        <div className="space-y-7">
          {favSections.map((s) => (
            <div key={`list-${s.key}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <s.icon className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-semibold">{s.label}</h3>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {s.count}
                </span>
                {s.count > 0 && (
                  <button
                    onClick={() => navigate(s.route)}
                    className="ml-auto text-[11px] text-primary hover:underline"
                  >
                    Ver todos →
                  </button>
                )}
              </div>
              {s.items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic pl-9">{s.empty}</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {s.items.map((item) => (
                    <button
                      key={`${s.key}-${item.id}`}
                      onClick={() => navigate(s.route, { state: { openId: item.id } })}
                      className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-secondary border border-border/40 transition-all duration-300 hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.5)]"
                      title={item.title}
                    >
                      {item.cover ? (
                        <SafeImage
                          src={proxyImageUrl(item.cover)}
                          alt={item.title}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground p-2 text-center">
                          {item.title}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent p-2 pt-6">
                        <p className="text-[11px] text-white font-medium line-clamp-2 drop-shadow">
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
        <Button
          variant="destructive"
          onClick={() => { logout(); navigate("/login"); }}
          className="w-full md:w-auto tap-feedback"
        >
          Sair da conta
        </Button>
      </div>
    </div>
  );
};

export default Account;
