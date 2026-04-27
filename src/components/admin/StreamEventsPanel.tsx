import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { invokeAdminApi } from "@/lib/adminApi";
import {
  ShieldAlert,
  Play,
  KeyRound,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Activity,
} from "lucide-react";

interface Counts {
  token_issued: number;
  token_rejected: number;
  stream_started: number;
  stream_error: number;
  replay_tolerated: number;
  segment_request: number;
  session_evicted: number;
  user_report: number;
}

interface TokenRejectedRow {
  id: string;
  ip_masked: string;
  ua_hash: string | null;
  reason: string | null;
  created_at: string;
}
interface ReplayRow {
  id: string;
  ip_masked: string;
  anon_user_id: string | null;
  created_at: string;
}
interface ErrorRow {
  host: string | null;
  reason: string | null;
  type: string | null;
  count: number;
  last_at: string;
}
interface SeriesPoint {
  hour: string;
  token_issued: number;
  token_rejected: number;
  stream_started: number;
  stream_error: number;
  replay_tolerated: number;
}
interface Overview {
  hours: number;
  counts: Counts;
  token_rejected: TokenRejectedRow[];
  replay_tolerated: ReplayRow[];
  errors: ErrorRow[];
  series: SeriesPoint[];
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function reasonLabel(reason: string | null): string {
  if (!reason) return "Desconhecido";
  const map: Record<string, string> = {
    invalid_signature: "Assinatura inválida",
    expired: "Expirado",
    nonce_replay: "Replay de nonce",
    nonce_missing: "Nonce ausente",
    bad_format: "Formato inválido",
    user_blocked: "Usuário bloqueado",
    not_found: "Token desconhecido",
    player_switch_debounced: "Troca de player (ignorável)",
    bootstrap_timeout_12s: "Timeout no início (12s)",
    stream_no_data: "Sem dados / sem frames",
  };
  return map[reason] ?? reason;
}

export default function StreamEventsPanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState<number>(24);
  const [includeDebounce, setIncludeDebounce] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await invokeAdminApi<Overview>("stream_events_overview", {
        hours,
        includeDebounce,
      });
      setOverview(data);
    } catch (e) {
      toast.error("Falha ao carregar eventos de stream", {
        description: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, includeDebounce]);

  const totalAttempts = useMemo(() => {
    if (!overview) return 0;
    return overview.counts.token_issued + overview.counts.token_rejected;
  }, [overview]);
  const rejectRate = useMemo(() => {
    if (!overview || totalAttempts === 0) return 0;
    return (overview.counts.token_rejected / totalAttempts) * 100;
  }, [overview, totalAttempts]);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Janela:</span>
        {[1, 6, 24, 72, 168].map((h) => (
          <Button
            key={h}
            size="sm"
            variant={hours === h ? "default" : "outline"}
            onClick={() => setHours(h)}
          >
            {h < 24 ? `${h}h` : h === 24 ? "24h" : `${Math.round(h / 24)}d`}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIncludeDebounce((v) => !v)}
          className="ml-auto"
        >
          {includeDebounce ? <Eye className="h-3 w-3 mr-2" /> : <EyeOff className="h-3 w-3 mr-2" />}
          {includeDebounce ? "Ocultar debounce" : "Mostrar debounce"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={"h-3 w-3 mr-2 " + (loading ? "animate-spin" : "")} />
          Atualizar
        </Button>
      </div>

      {/* Cards topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-success bg-success/10 flex items-center justify-center mb-3">
            <Play className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Streams iniciados</p>
          <p className="text-2xl font-bold mt-1">{overview?.counts.stream_started ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">na janela</p>
        </Card>

        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-primary bg-primary/10 flex items-center justify-center mb-3">
            <KeyRound className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Tokens emitidos</p>
          <p className="text-2xl font-bold mt-1">{overview?.counts.token_issued ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {overview?.counts.segment_request ?? 0} segmentos servidos
          </p>
        </Card>

        <Card className={`p-5 border-border/50 ${
          (overview?.counts.token_rejected ?? 0) > 0
            ? "bg-destructive/5 border-destructive/40"
            : "bg-gradient-card"
        }`}>
          <div className="h-10 w-10 rounded-lg text-destructive bg-destructive/10 flex items-center justify-center mb-3">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Tokens rejeitados</p>
          <p className="text-2xl font-bold mt-1">{overview?.counts.token_rejected ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalAttempts > 0 ? `${rejectRate.toFixed(1)}% das tentativas` : "—"}
          </p>
        </Card>

        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-warning bg-warning/10 flex items-center justify-center mb-3">
            <XCircle className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Erros de player</p>
          <p className="text-2xl font-bold mt-1">{overview?.counts.stream_error ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {overview?.counts.replay_tolerated ?? 0} replays tolerados
          </p>
        </Card>
      </div>

      {/* Alerta forte se rejeições suspeitas */}
      {overview && overview.counts.token_rejected >= 50 && (
        <Card className="p-4 bg-destructive/5 border-destructive/40 border-l-4 border-l-destructive">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Alto volume de tokens rejeitados</p>
              <p className="text-xs text-muted-foreground mt-1">
                {overview.counts.token_rejected} tokens foram rejeitados em {hours}h. Pode indicar
                tentativa de pirataria do stream, bug do cliente após deploy, ou problema de
                relógio em um dispositivo. Revise a lista abaixo.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Tokens rejeitados */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Tokens rejeitados
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Tentativas de acessar o stream-proxy com token inválido, expirado ou já usado.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            Mostrando {overview?.token_rejected.length ?? 0} mais recentes
          </span>
        </div>
        {!overview?.token_rejected.length ? (
          <p className="text-sm text-success py-6 text-center">
            ✓ Nenhuma rejeição na janela. Boa.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="divide-y divide-border/50">
              {overview.token_rejected.map((r) => (
                <div key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-destructive border-destructive/40 bg-destructive/5">
                        {reasonLabel(r.reason)}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">{r.ip_masked}</span>
                    </div>
                    {r.ua_hash && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                        UA hash: {r.ua_hash.slice(0, 16)}…
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">há {formatRelative(r.created_at)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>

      {/* Erros de player */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <XCircle className="h-4 w-4 text-warning" />
              Erros de player
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Agrupado por host + tipo de erro.{" "}
              {!includeDebounce && (
                <span className="text-success">
                  Erros de troca de player (debounce) ocultos — clique acima pra mostrar.
                </span>
              )}
            </p>
          </div>
        </div>
        {!overview?.errors.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Sem erros agrupáveis na janela.
          </p>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="divide-y divide-border/50">
              <div className="grid grid-cols-12 gap-3 px-2 py-2 text-xs font-medium text-muted-foreground">
                <div className="col-span-3">Host</div>
                <div className="col-span-3">Tipo</div>
                <div className="col-span-4">Razão</div>
                <div className="col-span-1 text-center">Vezes</div>
                <div className="col-span-1 text-right">Última</div>
              </div>
              {overview.errors.map((e, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-3 px-2 py-2 items-center text-sm">
                  <div className="col-span-3 font-mono text-xs truncate" title={e.host ?? "—"}>
                    {e.host ?? "—"}
                  </div>
                  <div className="col-span-3">
                    {e.type ? (
                      <Badge variant="outline" className="text-warning border-warning/40 bg-warning/5">
                        {e.type}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="col-span-4 text-xs text-muted-foreground truncate">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{reasonLabel(e.reason)}</span>
                      </TooltipTrigger>
                      <TooltipContent>{e.reason ?? "Sem razão registrada"}</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="col-span-1 text-center font-medium">{e.count}</div>
                  <div className="col-span-1 text-right text-xs text-muted-foreground">
                    {formatRelative(e.last_at)}
                  </div>
                </div>
              ))}
            </div>
          </TooltipProvider>
        )}
      </Card>

      {/* Replays tolerados */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Replays de nonce tolerados
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Quando o anti-replay aceita um nonce duplicado dentro da janela de tolerância
              (rede instável). Volume alto pode indicar problema de rede ou tentativa de uso
              indevido do mesmo token.
            </p>
          </div>
        </div>
        {!overview?.replay_tolerated.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum replay tolerado na janela.
          </p>
        ) : (
          <ScrollArea className="max-h-60">
            <div className="divide-y divide-border/50">
              {overview.replay_tolerated.map((r) => (
                <div key={r.id} className="py-2 flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{r.ip_masked}</span>
                  <span className="text-xs text-muted-foreground">há {formatRelative(r.created_at)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}
