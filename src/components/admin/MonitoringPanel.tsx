import { Card } from "@/components/ui/card";
import { UserCheck, Activity, Ban, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatRelative } from "@/lib/adminUtils";
import type { MonitoringOverview, TopConsumer, MonitoringSession, MonitoringBlock } from "@/types/admin";

interface MonitoringPanelProps {
  monitoring: MonitoringOverview | null;
  topConsumers: TopConsumer[];
  onEvictSession: (session: MonitoringSession) => void;
  onUnblockUser: (block: MonitoringBlock) => void;
}

export function MonitoringPanel({ monitoring, topConsumers, onEvictSession, onUnblockUser }: MonitoringPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-success bg-success/10 flex items-center justify-center mb-3">
            <UserCheck className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Usuários online agora</p>
          <p className="text-2xl font-bold mt-1">{monitoring?.online_now ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">heartbeat &lt; 90s</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-primary bg-primary/10 flex items-center justify-center mb-3">
            <Activity className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Streams ativos</p>
          <p className="text-2xl font-bold mt-1">{monitoring?.active_sessions.length ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">com player ativo</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-destructive bg-destructive/10 flex items-center justify-center mb-3">
            <Ban className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Bloqueios ativos</p>
          <p className="text-2xl font-bold mt-1">{monitoring?.active_blocks.length ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">temporários</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-warning bg-warning/10 flex items-center justify-center mb-3">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Erros 24h</p>
          <p className="text-2xl font-bold mt-1">{monitoring?.recent_errors.length ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">rejeições e falhas</p>
        </Card>
      </div>

      <Card className="bg-gradient-card border-border/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sessões em tempo real</h2>
          <span className="flex items-center gap-1.5 text-xs text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Auto-refresh (10s)
          </span>
        </div>
        {!monitoring?.active_sessions.length ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma sessão ativa agora.</p>
        ) : (
          <TooltipProvider delayDuration={150}>
            <div className="divide-y divide-border/50">
              <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-3 px-2 py-2 text-xs font-medium text-muted-foreground bg-secondary/30">
                <div className="col-span-2">Usuário</div>
                <div className="col-span-2">DNS</div>
                <div className="col-span-2">IP</div>
                <div className="col-span-3">Assistindo agora</div>
                <div className="col-span-2">No vídeo</div>
                <div className="col-span-1">Total</div>
                <div className="col-span-2 text-right">Ação</div>
              </div>
              {monitoring.active_sessions.map((s) => {
                const label = s.content_kind === "live" ? "CANAIS" : s.content_kind === "movie" ? "FILMES" : s.content_kind === "episode" ? "SÉRIES" : "IDLE";
                const titleText = !s.content_kind || s.content_kind === "idle" ? "Sem reprodução" : (s.content_title || "Sem título");
                const contentMin = s.content_started_at ? Math.max(0, Math.floor((Date.now() - new Date(s.content_started_at).getTime()) / 60000)) : null;
                let serverHost = s.server_url;
                if (s.server_url) {
                  try { serverHost = new URL(s.server_url).host; } catch { serverHost = s.server_url; }
                }
                return (
                  <div key={s.anon_user_id} className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-3 px-2 py-3 items-center text-sm">
                    <div className="col-span-2 font-medium truncate">{s.iptv_username || "—"}</div>
                    <div className="col-span-2 font-mono text-xs text-muted-foreground truncate" title={s.server_url ?? undefined}>{serverHost ?? "—"}</div>
                    <div className="col-span-2 font-mono text-xs text-muted-foreground">{s.ip_masked}</div>
                    <div className="col-span-3 truncate">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="truncate" title={titleText}>{titleText}</div>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">{contentMin != null ? `${contentMin}min` : "—"}</div>
                    <div className="col-span-1 text-xs text-muted-foreground">{Math.floor(s.duration_s / 60)}min</div>
                    <div className="col-span-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => onEvictSession(s)}>
                        <X className="h-3 w-3 mr-1" />Encerrar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-card border-border/50">
          <h2 className="text-lg font-semibold mb-4">Top consumidores (24h)</h2>
          {!topConsumers.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem consumo registrado.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {topConsumers.map((c) => (
                <div key={c.anon_user_id} className="flex items-center justify-between py-2 text-sm gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{c.iptv_username || `${c.anon_user_id.slice(0, 8)}…`}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.server_host || "servidor desconhecido"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{c.requests} req • {c.segments} seg</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 bg-gradient-card border-border/50">
          <h2 className="text-lg font-semibold mb-4">Bloqueios ativos</h2>
          {!monitoring?.active_blocks.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum bloqueio ativo.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {monitoring.active_blocks.map((b) => (
                <div key={b.anon_user_id} className="flex items-center justify-between py-2 text-sm gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs truncate">{b.anon_user_id.slice(0, 12)}…</p>
                    <p className="text-xs text-muted-foreground">
                      {b.reason || "—"} • até {new Date(b.blocked_until).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onUnblockUser(b)}>Desbloquear</Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="text-lg font-semibold mb-4">Erros recentes (24h)</h2>
        {!monitoring?.recent_errors.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum erro registrado.</p>
        ) : (
          <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
            {monitoring.recent_errors.map((e) => (
              <div key={e.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{e.event_type}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.ip_masked} • {(e.meta as { reason?: string })?.reason || "—"}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">há {formatRelative(e.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
