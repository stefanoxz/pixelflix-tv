import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invokeAdminApi } from "@/lib/adminApi";
import { CheckCircle2, XCircle, Server, Globe, Wifi, Activity } from "lucide-react";
import { toast } from "sonner";

interface LoginRow {
  id: string;
  server_url: string;
  success: boolean;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
interface WatchRow {
  kind: string;
  content_id: string;
  title: string | null;
  poster_url: string | null;
  server_url: string;
  position_seconds: number;
  duration_seconds: number;
  updated_at: string;
}
interface SessionRow {
  anon_user_id: string;
  server_url: string | null;
  ip: string | null;
  started_at: string;
  last_seen_at: string;
  content_kind: string | null;
  content_title: string | null;
  content_started_at: string | null;
}
interface DiagRow {
  id: string;
  server_url: string | null;
  outcome: string;
  client_error: string | null;
  duration_ms: number | null;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  speed_kbps: number | null;
  effective_type: string | null;
  downlink_mbps: number | null;
  created_at: string;
}
interface Detail {
  username: string;
  summary: {
    total_logins: number;
    success_count: number;
    fail_count: number;
    unique_ips: number;
    unique_servers: number;
    last_login_at: string | null;
  };
  logins: LoginRow[];
  watch_progress: WatchRow[];
  sessions: SessionRow[];
  diagnostics: DiagRow[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatProgress(pos: number, dur: number): string {
  if (!dur) return `${Math.floor(pos / 60)}min`;
  const pct = Math.round((pos / dur) * 100);
  return `${pct}% (${Math.floor(pos / 60)}/${Math.floor(dur / 60)}min)`;
}

interface Props {
  username: string | null;
  onClose: () => void;
}

export default function UserDetailDialog({ username, onClose }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!username) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    invokeAdminApi<Detail>("user_detail", { username })
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) toast.error("Falha ao carregar detalhes", { description: (e as Error).message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  return (
    <Dialog open={!!username} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
              {username?.slice(0, 2).toUpperCase()}
            </div>
            {username}
          </DialogTitle>
          <DialogDescription>
            Histórico completo de logins, sessões, conteúdos e diagnósticos.
          </DialogDescription>
        </DialogHeader>

        {loading && !detail ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : !detail ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Sem dados.</div>
        ) : (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="p-3">
                <p className="text-[11px] text-muted-foreground">Logins (90d)</p>
                <p className="text-xl font-bold">{detail.summary.total_logins}</p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] text-muted-foreground">Sucessos</p>
                <p className="text-xl font-bold text-success">{detail.summary.success_count}</p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] text-muted-foreground">Falhas</p>
                <p className="text-xl font-bold text-destructive">{detail.summary.fail_count}</p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] text-muted-foreground">IPs únicos</p>
                <p className="text-xl font-bold">{detail.summary.unique_ips}</p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] text-muted-foreground">Servidores</p>
                <p className="text-xl font-bold">{detail.summary.unique_servers}</p>
              </Card>
            </div>

            <Tabs defaultValue="logins" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="logins">
                  Logins ({detail.logins.length})
                </TabsTrigger>
                <TabsTrigger value="watch">
                  Assistindo ({detail.watch_progress.length})
                </TabsTrigger>
                <TabsTrigger value="sessions">
                  Sessões ({detail.sessions.length})
                </TabsTrigger>
                <TabsTrigger value="diag">
                  Diagnóstico ({detail.diagnostics.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="logins" className="flex-1 overflow-hidden mt-3">
                <ScrollArea className="h-[50vh] pr-3">
                  {detail.logins.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sem logins.</p>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {detail.logins.map((l) => (
                        <div key={l.id} className="py-2 flex items-start gap-3 text-sm">
                          {l.success ? (
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs truncate">{l.server_url}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDate(l.created_at)} • IP {l.ip_address ?? "—"}
                              {l.reason ? ` • ${l.reason}` : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="watch" className="flex-1 overflow-hidden mt-3">
                <ScrollArea className="h-[50vh] pr-3">
                  {detail.watch_progress.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sem progresso.</p>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {detail.watch_progress.map((w) => (
                        <div key={`${w.kind}-${w.content_id}-${w.updated_at}`} className="py-2 flex items-start gap-3 text-sm">
                          {w.poster_url ? (
                            <img src={w.poster_url} alt="" className="h-12 w-8 object-cover rounded shrink-0" />
                          ) : (
                            <div className="h-12 w-8 rounded bg-secondary shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase">{w.kind}</Badge>
                              <p className="font-medium truncate">{w.title || "Sem título"}</p>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {formatProgress(w.position_seconds, w.duration_seconds)} • {formatDate(w.updated_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="sessions" className="flex-1 overflow-hidden mt-3">
                <ScrollArea className="h-[50vh] pr-3">
                  {detail.sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sem sessões.</p>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {detail.sessions.map((s) => (
                        <div key={s.anon_user_id + s.started_at} className="py-2 flex items-start gap-3 text-sm">
                          <Activity className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">
                              {s.content_title || "—"}{" "}
                              {s.content_kind && (
                                <Badge variant="outline" className="ml-1 text-[10px]">{s.content_kind}</Badge>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDate(s.started_at)} → {formatDate(s.last_seen_at)} • IP {s.ip ?? "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">
                              {s.server_url ?? "—"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="diag" className="flex-1 overflow-hidden mt-3">
                <ScrollArea className="h-[50vh] pr-3">
                  {detail.diagnostics.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sem diagnósticos.</p>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {detail.diagnostics.map((d) => {
                        const ok = d.outcome === "success";
                        return (
                          <div key={d.id} className="py-2 flex items-start gap-3 text-sm">
                            {ok ? (
                              <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px]">{d.outcome}</Badge>
                                {d.duration_ms != null && (
                                  <span className="text-[11px] text-muted-foreground">{d.duration_ms}ms</span>
                                )}
                                {d.effective_type && (
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Wifi className="h-3 w-3" />{d.effective_type}
                                    {d.downlink_mbps && ` ${d.downlink_mbps}Mbps`}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground font-mono truncate">
                                <Server className="h-3 w-3 inline mr-1" />{d.server_url ?? "—"}
                              </p>
                              {(d.city || d.country) && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {[d.city, d.region, d.country].filter(Boolean).join(", ")}
                                  {d.isp ? ` • ${d.isp}` : ""}
                                </p>
                              )}
                              {d.client_error && (
                                <p className="text-[11px] text-destructive truncate">{d.client_error}</p>
                              )}
                              <p className="text-[11px] text-muted-foreground">{formatDate(d.created_at)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
