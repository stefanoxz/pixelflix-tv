import { Card } from "@/components/ui/card";
import { Activity, CheckCircle2, XCircle, Server, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DnsErrorTrendChart } from "./DnsErrorTrendChart";
import { statusClass, failPctClass } from "@/lib/adminUtils";
import type { DnsErrorOverview, ErrorBucket } from "@/types/admin";

interface DnsErrorsPanelProps {
  dnsErrors: DnsErrorOverview | null;
  hours: number;
  setHours: (h: number) => void;
  onRefresh: (h: number) => void;
}

const ERROR_BUCKET_META: Record<ErrorBucket, { label: string; cls: string; tip: string; color: string }> = {
  refused: { label: "Connection refused", cls: "text-destructive bg-destructive/10", tip: "Servidor recusou a conexão TCP.", color: "hsl(0 84% 60%)" },
  reset: { label: "Reset by peer", cls: "text-destructive bg-destructive/10", tip: "Servidor derrubou a conexão durante o handshake.", color: "hsl(14 90% 55%)" },
  http_404: { label: "HTTP 404", cls: "text-warning bg-warning/10", tip: "Endpoint /player_api.php não encontrado.", color: "hsl(38 92% 50%)" },
  http_444: { label: "HTTP 444", cls: "text-warning bg-warning/10", tip: "Servidor encerrou sem resposta (anti-scraping).", color: "hsl(28 90% 55%)" },
  http_5xx: { label: "HTTP 5xx", cls: "text-warning bg-warning/10", tip: "Erro interno do servidor (502/503/504).", color: "hsl(48 95% 55%)" },
  tls: { label: "TLS / SSL", cls: "text-warning bg-warning/10", tip: "Falha de TLS/SSL.", color: "hsl(280 70% 60%)" },
  cert_invalid: { label: "Certificado inválido", cls: "text-destructive bg-destructive/10", tip: "Certificado expirado ou hostname inválido.", color: "hsl(320 75% 55%)" },
  timeout: { label: "Timeout", cls: "text-warning bg-warning/10", tip: "Servidor não respondeu no tempo limite.", color: "hsl(60 80% 50%)" },
  io_timeout: { label: "I/O timeout", cls: "text-warning bg-warning/10", tip: "Tempo limite em leitura/escrita do socket.", color: "hsl(80 70% 50%)" },
  dns: { label: "DNS off", cls: "text-destructive bg-destructive/10", tip: "Domínio não resolveu.", color: "hsl(340 80% 55%)" },
  no_route: { label: "No route to host", cls: "text-destructive bg-destructive/10", tip: "Sem rota até o host.", color: "hsl(200 80% 55%)" },
  net_unreach: { label: "Rede inacessível", cls: "text-destructive bg-destructive/10", tip: "Network is unreachable.", color: "hsl(220 75% 60%)" },
  protocol: { label: "Protocolo inválido", cls: "text-warning bg-warning/10", tip: "Resposta HTTP malformada.", color: "hsl(160 65% 50%)" },
  other: { label: "Outros", cls: "text-muted-foreground bg-muted/40", tip: "Outras falhas (incluindo credenciais inválidas).", color: "hsl(220 10% 55%)" },
};

const SERVER_PALETTE = ["hsl(214 100% 56%)", "hsl(0 84% 60%)", "hsl(38 92% 50%)", "hsl(142 71% 45%)", "hsl(280 70% 60%)", "hsl(180 70% 50%)"];

export function DnsErrorsPanel({ dnsErrors, hours, setHours, onRefresh }: DnsErrorsPanelProps) {
  const buckets: ErrorBucket[] = ["refused", "reset", "http_404", "http_444", "http_5xx", "tls", "cert_invalid", "timeout", "io_timeout", "dns", "no_route", "net_unreach", "protocol", "other"];
  const totals = dnsErrors?.totals;
  const failRate = totals && totals.total > 0 ? Math.round((totals.fail / totals.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Janela:</span>
        {[1, 6, 24, 72, 168].map((h) => (
          <Button key={h} size="sm" variant={hours === h ? "default" : "outline"} onClick={() => setHours(h)}>
            {h < 24 ? `${h}h` : h === 24 ? "24h" : `${Math.round(h / 24)}d`}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => onRefresh(hours)} className="ml-auto">
          <RefreshCw className="h-3 w-3 mr-2" />Atualizar agora
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-primary bg-primary/10 flex items-center justify-center mb-3">
            <Activity className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Tentativas</p>
          <p className="text-2xl font-bold mt-1">{totals?.total ?? "—"}</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-success bg-success/10 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Sucessos</p>
          <p className="text-2xl font-bold mt-1">{totals?.success ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">{totals && totals.total > 0 ? `${Math.round((totals.success / totals.total) * 100)}%` : "—"}</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-destructive bg-destructive/10 flex items-center justify-center mb-3">
            <XCircle className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Falhas</p>
          <p className="text-2xl font-bold mt-1">{totals?.fail ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">{failRate}% do total</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-warning bg-warning/10 flex items-center justify-center mb-3">
            <Server className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Servidores afetados</p>
          <p className="text-2xl font-bold mt-1">{dnsErrors?.servers.filter((s) => s.fail > 0).length ?? "—"}</p>
        </Card>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Distribuição global de erros</h2>
          <span className="flex items-center gap-1.5 text-xs text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />Tempo real (10s)
          </span>
        </div>
        {!totals || totals.fail === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sem falhas registradas na janela selecionada.</p>
        ) : (
          <div className="space-y-3">
            {buckets.map((b) => {
              const count = totals.buckets[b];
              if (count === 0) return null;
              const pct = (count / totals.fail) * 100;
              const meta = ERROR_BUCKET_META[b];
              return (
                <TooltipProvider key={b} delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="space-y-1 cursor-help">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{meta.label}</span>
                          <span className="text-xs text-muted-foreground">{count} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
                          <div className={`h-full rounded-full ${meta.cls.split(" ")[0].replace("text-", "bg-")}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{meta.tip}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        )}
      </Card>

      <DnsErrorTrendChart series={dnsErrors?.series ?? []} perServerSeries={dnsErrors?.per_server_series} bucketMeta={ERROR_BUCKET_META} serverPalette={SERVER_PALETTE} stepMs={dnsErrors?.step_ms} />

      <Card className="p-6 bg-gradient-card border-border/50">
        <h2 className="text-lg font-semibold mb-4">Por servidor (DNS)</h2>
        {!dnsErrors?.servers.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sem dados na janela selecionada.</p>
        ) : (
          <div className="divide-y divide-border/50">
            <div className="grid grid-cols-12 gap-3 px-2 py-2 text-xs font-medium text-muted-foreground">
              <div className="col-span-4">DNS</div>
              <div className="col-span-2 text-center">Tentativas</div>
              <div className="col-span-2 text-center">% falhas</div>
              <div className="col-span-4">Tipos de erro</div>
            </div>
            {dnsErrors.servers.map((s) => {
              const failPct = s.total > 0 ? (s.fail / s.total) * 100 : 0;
              const status = failPct >= 80 ? { label: "Crítico", cls: "text-destructive bg-destructive/10" } : failPct >= 30 ? { label: "Instável", cls: "text-warning bg-warning/10" } : { label: "OK", cls: "text-success bg-success/10" };
              const topBuckets = (Object.entries(s.buckets) as [ErrorBucket, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
              return (
                <div key={s.server_url} className="grid grid-cols-12 gap-3 px-2 py-3 items-center text-sm">
                  <div className="col-span-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${status.cls}`}>{status.label}</span>
                      <span className="font-mono text-xs truncate">{s.server_url}</span>
                    </div>
                    {s.last_error && <p className="text-[11px] text-muted-foreground truncate mt-1">Último: {s.last_error.slice(0, 90)}</p>}
                  </div>
                  <div className="col-span-2 text-center">
                    <p className="font-medium">{s.total}</p>
                    <p className="text-[11px] text-muted-foreground">{s.success} ok · {s.fail} fail</p>
                  </div>
                  <div className="col-span-2 text-center">
                    <p className={`font-bold ${failPct >= 80 ? "text-destructive" : failPct >= 30 ? "text-warning" : "text-success"}`}>{failPct.toFixed(0)}%</p>
                    <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden mt-1">
                      <div className={failPct >= 80 ? "h-full bg-destructive" : failPct >= 30 ? "h-full bg-warning" : "h-full bg-success"} style={{ width: `${failPct}%` }} />
                    </div>
                  </div>
                  <div className="col-span-4 flex flex-wrap gap-1">
                    {topBuckets.map(([b, n]) => (
                      <TooltipProvider key={b}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ERROR_BUCKET_META[b].cls} cursor-help`}>{ERROR_BUCKET_META[b].label} · {n}</span>
                          </TooltipTrigger>
                          <TooltipContent>{ERROR_BUCKET_META[b].tip}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
