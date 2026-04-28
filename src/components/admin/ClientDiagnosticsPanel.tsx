import { useEffect, useMemo, useState } from "react";
import { invokeAdminApi } from "@/lib/adminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Wifi, MapPin, Clock, AlertTriangle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NETWORK_QUALITY_HINT =
  "Classificação do navegador baseada em latência e velocidade. '4g' = boa conexão (inclui Wi-Fi e fibra). Não indica o tipo físico do link (móvel vs Wi-Fi).";

interface DiagRow {
  id: string;
  created_at: string;
  username: string | null;
  server_url: string | null;
  outcome: string;
  client_error: string | null;
  duration_ms: number | null;
  ip: string | null;
  user_agent: string | null;
  effective_type: string | null;
  downlink_mbps: number | null;
  rtt_ms: number | null;
  save_data: boolean | null;
  device_memory: number | null;
  hardware_concurrency: number | null;
  screen: string | null;
  language: string | null;
  timezone: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  speed_kbps: number | null;
}

interface Summary {
  total: number;
  by_outcome: Record<string, number>;
  avg_downlink_mbps: number | null;
  avg_rtt_ms: number | null;
  avg_duration_ms: number | null;
}

const OUTCOME_LABEL: Record<string, string> = {
  success: "Sucesso",
  fail: "Falha",
  timeout: "Timeout",
  abort: "Abortado",
  unknown: "Desconhecido",
};

function outcomeBadgeVariant(o: string): "default" | "secondary" | "destructive" | "outline" {
  if (o === "success") return "default";
  if (o === "timeout" || o === "fail") return "destructive";
  return "secondary";
}

function shortBrowser(ua: string | null): string {
  if (!ua) return "—";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  if (/Opera|OPR\//.test(ua)) return "Opera";
  return "Outro";
}

function shortPlatform(ua: string | null): string {
  if (!ua) return "";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iOS/.test(ua)) return "iOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "";
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { hour12: false });
  } catch {
    return iso;
  }
}

export default function ClientDiagnosticsPanel() {
  const [rows, setRows] = useState<DiagRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hours, setHours] = useState<number>(24);
  const [outcome, setOutcome] = useState<string>("all");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [serverFilter, setServerFilter] = useState("");

  const [selected, setSelected] = useState<DiagRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { action: "client_diagnostics_list", hours, limit: 300 };
      if (outcome !== "all") body.outcome = outcome;
      if (usernameFilter.trim()) body.username = usernameFilter.trim();
      if (serverFilter.trim()) body.server_url = serverFilter.trim();
      const data = await invokeAdminApi<{ rows?: DiagRow[]; summary?: Summary }>("client_diagnostics_list", body);
      setRows((data as any)?.rows ?? []);
      setSummary((data as any)?.summary ?? null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, outcome]);

  const successRate = useMemo(() => {
    if (!summary || summary.total === 0) return null;
    const s = summary.by_outcome.success ?? 0;
    return Math.round((s / summary.total) * 100);
  }, [summary]);

  const failRate = useMemo(() => {
    if (!summary || summary.total === 0) return null;
    const f = (summary.by_outcome.fail ?? 0) + (summary.by_outcome.timeout ?? 0) + (summary.by_outcome.abort ?? 0);
    return Math.round((f / summary.total) * 100);
  }, [summary]);

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Tentativas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.total ?? "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">% Sucesso</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-500">{successRate !== null ? `${successRate}%` : "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">% Falha/Timeout</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{failRate !== null ? `${failRate}%` : "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Latência média (login)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.avg_duration_ms != null ? `${summary.avg_duration_ms} ms` : "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Downlink médio</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.avg_downlink_mbps != null ? `${summary.avg_downlink_mbps} Mbps` : "—"}</div></CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Período</label>
            <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Última 1h</SelectItem>
                <SelectItem value="6">Últimas 6h</SelectItem>
                <SelectItem value="24">Últimas 24h</SelectItem>
                <SelectItem value="72">Últimos 3 dias</SelectItem>
                <SelectItem value="168">Últimos 7 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Resultado</label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="fail">Falha</SelectItem>
                <SelectItem value="timeout">Timeout</SelectItem>
                <SelectItem value="abort">Abortado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Usuário</label>
            <Input value={usernameFilter} onChange={(e) => setUsernameFilter(e.target.value)} placeholder="filtrar..." className="w-[180px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Servidor</label>
            <Input value={serverFilter} onChange={(e) => setServerFilter(e.target.value)} placeholder="dns..." className="w-[200px]" />
          </div>
          <Button onClick={load} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={"h-4 w-4 mr-2 " + (loading ? "animate-spin" : "")} />
            Aplicar
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/50">
                <th className="py-2 pr-3 font-medium">Quando</th>
                <th className="py-2 pr-3 font-medium">Usuário</th>
                <th className="py-2 pr-3 font-medium">Servidor</th>
                <th className="py-2 pr-3 font-medium">Resultado</th>
                <th className="py-2 pr-3 font-medium">Duração</th>
                <th className="py-2 pr-3 font-medium">Provedor</th>
                <th className="py-2 pr-3 font-medium">Local</th>
                <th className="py-2 pr-3 font-medium">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 cursor-help">
                          Qualidade da rede
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">{NETWORK_QUALITY_HINT}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </th>
                <th className="py-2 pr-3 font-medium">Veloc.</th>
                <th className="py-2 pr-3 font-medium">RTT</th>
                <th className="py-2 pr-3 font-medium">Speed</th>
                <th className="py-2 pr-3 font-medium">Browser</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={13} className="py-6 text-center text-muted-foreground">Sem registros no período.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/30">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatTime(r.created_at)}</td>
                  <td className="py-2 pr-3">{r.username ?? "—"}</td>
                  <td className="py-2 pr-3 max-w-[180px] truncate" title={r.server_url ?? ""}>{r.server_url ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={outcomeBadgeVariant(r.outcome)}>{OUTCOME_LABEL[r.outcome] ?? r.outcome}</Badge>
                  </td>
                  <td className="py-2 pr-3">{r.duration_ms != null ? `${r.duration_ms} ms` : "—"}</td>
                  <td className="py-2 pr-3 max-w-[160px] truncate" title={r.isp ?? ""}>{r.isp ?? "—"}</td>
                  <td className="py-2 pr-3">{[r.city, r.country].filter(Boolean).join(", ") || "—"}</td>
                  <td className="py-2 pr-3">{r.effective_type ?? "—"}</td>
                  <td className="py-2 pr-3">{r.downlink_mbps != null ? `${r.downlink_mbps} Mbps` : "—"}</td>
                  <td className="py-2 pr-3">{r.rtt_ms != null ? `${r.rtt_ms} ms` : "—"}</td>
                  <td className="py-2 pr-3">{r.speed_kbps != null ? `${r.speed_kbps} KB/s` : "—"}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{shortBrowser(r.user_agent)} {shortPlatform(r.user_agent) && <span className="text-muted-foreground">/ {shortPlatform(r.user_agent)}</span>}</td>
                  <td className="py-2">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>Detalhes</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Diagnóstico completo</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Usuário" value={selected.username} />
                <Field label="Servidor" value={selected.server_url} />
                <Field label="Quando" value={formatTime(selected.created_at)} />
                <Field label="Resultado" value={OUTCOME_LABEL[selected.outcome] ?? selected.outcome} />
                <Field label="IP" value={selected.ip} />
                <Field label="Provedor (ISP)" value={selected.isp} icon={<Wifi className="h-3 w-3" />} />
                <Field label="País" value={selected.country} />
                <Field label="Região" value={selected.region} />
                <Field label="Cidade" value={selected.city} icon={<MapPin className="h-3 w-3" />} />
                <Field label="Fuso" value={selected.timezone} />
                <Field label="Idioma" value={selected.language} />
                <Field label="Tela" value={selected.screen} />
                <Field label="Conexão" value={selected.effective_type} />
                <Field label="Downlink" value={selected.downlink_mbps != null ? `${selected.downlink_mbps} Mbps` : null} />
                <Field label="RTT" value={selected.rtt_ms != null ? `${selected.rtt_ms} ms` : null} />
                <Field label="Speed probe" value={selected.speed_kbps != null ? `${selected.speed_kbps} KB/s` : null} />
                <Field label="Save Data" value={selected.save_data == null ? null : selected.save_data ? "sim" : "não"} />
                <Field label="Memória (GB)" value={selected.device_memory != null ? String(selected.device_memory) : null} />
                <Field label="CPUs" value={selected.hardware_concurrency != null ? String(selected.hardware_concurrency) : null} />
                <Field label="Duração login" value={selected.duration_ms != null ? `${selected.duration_ms} ms` : null} icon={<Clock className="h-3 w-3" />} />
              </div>
              {selected.client_error && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Erro do cliente</div>
                  <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs font-mono break-all">{selected.client_error}</div>
                </div>
              )}
              {selected.user_agent && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">User-Agent</div>
                  <div className="rounded border bg-muted/30 p-2 text-xs font-mono break-all">{selected.user_agent}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}
