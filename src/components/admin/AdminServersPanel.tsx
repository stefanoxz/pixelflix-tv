import { Card } from "@/components/ui/card";
import { Search, ShieldCheck, RefreshCw, Plus, Server, Wifi, Pencil, Trash2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRelative, formatTime, stateBadge, stateTooltip, reasonInfo, latencyClass, statusClass, httpTooltip } from "@/lib/adminUtils";
import type { AllowedServer, PendingServer, HealthStatus } from "@/types/admin";

interface AdminServersPanelProps {
  allowed: AllowedServer[];
  pending: PendingServer[];
  health: Record<string, HealthStatus>;
  search: string;
  onSearchChange: (s: string) => void;
  onCheckAll: () => void;
  onAdd: () => void;
  onProbe: (s: AllowedServer) => void;
  onEdit: (s: AllowedServer) => void;
  onRemove: (url: string) => void;
  onAuthorizePending: (url: string) => void;
  healthLoading: boolean;
}

export function AdminServersPanel({ 
  allowed, pending, health, search, onSearchChange, onCheckAll, onAdd, onProbe, onEdit, onRemove, onAuthorizePending, healthLoading 
}: AdminServersPanelProps) {
  const filteredAllowed = allowed.filter((s) => search ? s.server_url.toLowerCase().includes(search.toLowerCase()) || (s.label ?? "").toLowerCase().includes(search.toLowerCase()) : true);
  const filteredPending = pending.filter((s) => search ? s.server_url.toLowerCase().includes(search.toLowerCase()) : true);

  return (
    <div className="space-y-6 mt-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar DNS..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Button onClick={onCheckAll} variant="outline" size="sm" disabled={healthLoading || allowed.length === 0} className="flex-1 sm:flex-none">
            <RefreshCw className={"h-4 w-4 mr-2 " + (healthLoading ? "animate-spin" : "")} />
            <span className="hidden sm:inline">Atualizar pings</span>
          </Button>
          <Button onClick={onAdd} variant="default" size="sm" className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Cadastrar DNS</span>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <h2 className="font-semibold">DNS autorizadas ({filteredAllowed.length})</h2>
        </div>
        <Card className="bg-gradient-card border-border/50 overflow-hidden">
          {!filteredAllowed.length ? (
            <div className="py-12 text-center px-4">
              <Server className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhuma DNS cadastrada ainda.</p>
            </div>
          ) : (
            <TooltipProvider delayDuration={200}>
              <div className="divide-y divide-border/50">
                {filteredAllowed.map((s) => {
                  const h = health[s.server_url];
                  return (
                    <div key={s.id} className="px-4 py-4 sm:px-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <ShieldCheck className="h-4 w-4 text-success shrink-0" />
                          {s.label && <span className="text-sm font-semibold">{s.label}</span>}
                          <span className="font-mono text-sm text-muted-foreground truncate min-w-0">{s.server_url}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="whitespace-nowrap">{s.unique_users} usuários</span>
                          <span className="whitespace-nowrap text-success">{s.success_count} ok</span>
                          <span className="whitespace-nowrap text-destructive">{s.fail_count} falhas</span>
                          {s.last_seen && <span className="whitespace-nowrap">último uso há {formatRelative(s.last_seen)}</span>}
                        </div>
                        {!h ? <div className="text-xs text-muted-foreground">Verificando ping…</div> : (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            {(() => {
                              const b = stateBadge(h.state);
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild><span className={`${b.cls} cursor-help whitespace-nowrap`}>{b.dot} {b.label}</span></TooltipTrigger>
                                  <TooltipContent className="max-w-xs">{stateTooltip(h.state)}</TooltipContent>
                                </Tooltip>
                              );
                            })()}
                            {(() => {
                              const info = reasonInfo(h.reason);
                              if (!info || h.reason === "online") return null;
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild><span className={`px-1.5 py-0.5 rounded border border-border/50 cursor-help whitespace-nowrap ${info.cls}`}>{info.label}</span></TooltipTrigger>
                                  <TooltipContent className="max-w-xs">{info.tooltip}</TooltipContent>
                                </Tooltip>
                              );
                            })()}
                            <Tooltip>
                              <TooltipTrigger asChild><span className={`${latencyClass(h.latency)} cursor-help whitespace-nowrap`}>{h.latency != null ? `${h.latency} ms` : "—"}</span></TooltipTrigger>
                              <TooltipContent className="max-w-xs">Tempo de resposta.</TooltipContent>
                            </Tooltip>
                            {h.status != null ? (
                              <Tooltip>
                                <TooltipTrigger asChild><span className={`px-1.5 py-0.5 rounded font-mono cursor-help whitespace-nowrap ${statusClass(h.status)}`}>HTTP {h.status}</span></TooltipTrigger>
                                <TooltipContent className="max-w-xs">{httpTooltip(h.status)}</TooltipContent>
                              </Tooltip>
                            ) : h.error ? (
                              <Tooltip>
                                <TooltipTrigger asChild><span className="px-1.5 py-0.5 rounded font-mono text-warning bg-warning/10 cursor-help whitespace-nowrap">{h.error === "timeout" ? "timeout" : "rede"}</span></TooltipTrigger>
                                <TooltipContent className="max-w-xs">{h.error === "timeout" ? "Servidor não respondeu em 5s." : "Erro de rede."}</TooltipContent>
                              </Tooltip>
                            ) : null}
                            <span className="text-muted-foreground whitespace-nowrap">último ping {formatTime(h.checked_at)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto md:shrink-0">
                        <Button variant="outline" size="sm" onClick={() => onProbe(s)} className="flex-1 md:flex-none"><Wifi className="h-4 w-4 mr-2" />Testar</Button>
                        <Button variant="outline" size="sm" onClick={() => onEdit(s)} className="flex-1 md:flex-none"><Pencil className="h-4 w-4 mr-2" />Editar</Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive flex-1 md:flex-none" onClick={() => onRemove(s.server_url)}><Trash2 className="h-4 w-4 mr-2" />Apagar</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </Card>
      </div>

      {filteredPending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h2 className="font-semibold">Tentativas não autorizadas ({filteredPending.length})</h2>
          </div>
          <Card className="bg-gradient-card border-border/50 overflow-hidden">
            <div className="divide-y divide-border/50">
              {filteredPending.map((s) => (
                <div key={s.server_url} className="px-4 py-4 sm:px-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      <span className="font-mono text-sm truncate min-w-0">{s.server_url}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="whitespace-nowrap">{s.unique_users} usuários tentaram</span>
                      <span className="whitespace-nowrap">última há {formatRelative(s.last_seen)}</span>
                    </div>
                  </div>
                  <Button variant="default" size="sm" className="w-full md:w-auto md:shrink-0" onClick={() => onAuthorizePending(s.server_url)}><Plus className="h-4 w-4 mr-2" />Autorizar</Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
