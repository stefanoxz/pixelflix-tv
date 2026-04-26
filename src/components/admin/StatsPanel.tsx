import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Loader2, RefreshCw, Download, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invokeAdminApi } from "@/lib/adminApi";
import { toast } from "sonner";

type RangeDays = 7 | 30 | 90;

interface LoginPoint { date: string; success: number; fail: number; total: number; }
interface DauMauPoint { date: string; dau: number; mau_rolling: number; }
interface TopContentItem { title: string; kind: string; total_s: number; views: number; }

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) {
    toast.error("Sem dados para exportar");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => {
      const v = r[h];
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return `${h}h${m ? ` ${m}min` : ""}`;
}

const KIND_LABEL: Record<string, string> = {
  live: "TV ao vivo",
  movie: "Filme",
  episode: "Episódio",
};

const HEATMAP_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Converte um grid 7x24 de UTC para horário local rotacionando as colunas
 * pelo offset (em horas) do navegador. Quando a hora local "vira" o dia,
 * realoca para o dia anterior/posterior.
 */
function rotateHeatmapToLocal(utcGrid: number[][], offsetHours: number): number[][] {
  const off = Math.round(offsetHours); // 1h de granularidade — suficiente para BR
  const out: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const v = utcGrid[day]?.[hour] ?? 0;
      if (v === 0) continue;
      let localHour = hour + off;
      let localDay = day;
      while (localHour < 0) { localHour += 24; localDay = (localDay + 6) % 7; }
      while (localHour >= 24) { localHour -= 24; localDay = (localDay + 1) % 7; }
      out[localDay][localHour] += v;
    }
  }
  return out;
}

function HeatmapCell({ value, max }: { value: number; max: number }) {
  const intensity = max === 0 ? 0 : value / max;
  return (
    <div
      className="aspect-square rounded-sm border border-border/30"
      style={{
        backgroundColor: value === 0
          ? "hsl(var(--muted) / 0.2)"
          : `hsl(var(--primary) / ${0.15 + intensity * 0.85})`,
      }}
      title={`${value} sessão${value === 1 ? "" : "ões"}`}
    />
  );
}

export default function StatsPanel() {
  const [range, setRange] = useState<RangeDays>(30);
  const [logins, setLogins] = useState<LoginPoint[]>([]);
  const [dauMau, setDauMau] = useState<DauMauPoint[]>([]);
  const [heatmap, setHeatmap] = useState<{ grid: number[][]; max: number } | null>(null);
  const [topContent, setTopContent] = useState<TopContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const heatmapDays = Math.min(range, 30);
      const [a, b, c, d] = await Promise.all([
        invokeAdminApi<{ series: LoginPoint[] }>("stats_logins_daily", { days: range }),
        invokeAdminApi<{ series: DauMauPoint[] }>("stats_dau_mau", { days: range }),
        invokeAdminApi<{ grid: number[][]; max: number }>("stats_peak_heatmap", { days: heatmapDays }),
        invokeAdminApi<{ items: TopContentItem[] }>("stats_top_content", { days: range, limit: 10 }),
      ]);
      setLogins(a.series ?? []);
      setDauMau(b.series ?? []);
      // Backend devolve grid em UTC. Converte para horário local rotacionando
      // as colunas pelo offset do navegador (em horas inteiras — boa o suficiente
      // para os fusos do Brasil; meio-fusos como NL/IN ficam com erro de 30min
      // no rótulo, mas o pico continua claro).
      const utcGrid = c.grid ?? [];
      const offsetHours = -new Date().getTimezoneOffset() / 60; // BR = -3 → offset = -3
      const localGrid = utcGrid.length === 7
        ? rotateHeatmapToLocal(utcGrid, offsetHours)
        : utcGrid;
      setHeatmap({ grid: localGrid, max: c.max ?? 0 });
      setTopContent(d.items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalLogins = useMemo(() => logins.reduce((s, p) => s + p.total, 0), [logins]);
  const totalSuccess = useMemo(() => logins.reduce((s, p) => s + p.success, 0), [logins]);
  const successRate = totalLogins ? Math.round((totalSuccess / totalLogins) * 100) : 0;
  const peakDau = useMemo(() => dauMau.reduce((m, p) => Math.max(m, p.dau), 0), [dauMau]);
  const lastMau = dauMau[dauMau.length - 1]?.mau_rolling ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={String(range)} onValueChange={(v) => setRange(Number(v) as RangeDays)}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-gradient-card border-border/50">
          <p className="text-xs text-muted-foreground">Logins no período</p>
          <p className="text-2xl font-bold mt-1">{totalLogins.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">{successRate}% sucesso</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <p className="text-xs text-muted-foreground">Pico DAU</p>
          <p className="text-2xl font-bold mt-1">{peakDau}</p>
          <p className="text-xs text-muted-foreground mt-1">maior usuários únicos/dia</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <p className="text-xs text-muted-foreground">MAU (rolling 30d)</p>
          <p className="text-2xl font-bold mt-1">{lastMau}</p>
          <p className="text-xs text-muted-foreground mt-1">usuários únicos no último mês</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <p className="text-xs text-muted-foreground">Conteúdos únicos</p>
          <p className="text-2xl font-bold mt-1">{topContent.length}</p>
          <p className="text-xs text-muted-foreground mt-1">no top 10</p>
        </Card>
      </div>

      {/* Logins por dia */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Logins por dia</h3>
            <p className="text-xs text-muted-foreground mt-1">Sucesso vs falha — últimos {range} dias</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => downloadCsv(
            `logins-${range}d.csv`,
            logins.map((p) => ({ date: p.date, success: p.success, fail: p.fail, total: p.total })),
          )}>
            <Download className="h-3 w-3 mr-2" /> CSV
          </Button>
        </div>
        {loading && logins.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={logins}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="success" stackId="a" fill="hsl(var(--success))" name="Sucesso" />
              <Bar dataKey="fail" stackId="a" fill="hsl(var(--destructive))" name="Falha" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* DAU/MAU */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Usuários ativos</h3>
            <p className="text-xs text-muted-foreground mt-1">DAU diário e MAU rolling 30 dias</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => downloadCsv(
            `dau-mau-${range}d.csv`,
            dauMau.map((p) => ({ date: p.date, dau: p.dau, mau_rolling: p.mau_rolling })),
          )}>
            <Download className="h-3 w-3 mr-2" /> CSV
          </Button>
        </div>
        {loading && dauMau.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dauMau}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey="dau" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="DAU" />
              <Line type="monotone" dataKey="mau_rolling" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} name="MAU 30d" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heatmap horário de pico */}
        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="mb-4">
            <h3 className="font-semibold">Horário de pico</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Sessões por dia da semana × hora (horário local) — últimos {Math.min(range, 30)} dias
            </p>
          </div>
          {loading && !heatmap ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !heatmap || heatmap.max === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Sem dados suficientes no período.
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 text-[9px] text-muted-foreground">
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center">{h % 3 === 0 ? h : ""}</div>
                ))}
              </div>
              {heatmap.grid.map((row, dayIdx) => (
                <div key={dayIdx} className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 items-center">
                  <div className="text-[10px] text-muted-foreground text-right pr-1">{HEATMAP_DAYS[dayIdx]}</div>
                  {row.map((v, h) => <HeatmapCell key={h} value={v} max={heatmap.max} />)}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top conteúdos */}
        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Top 10 conteúdos</h3>
              <p className="text-xs text-muted-foreground mt-1">Por tempo total assistido — últimos {range} dias</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => downloadCsv(
              `top-content-${range}d.csv`,
              topContent.map((c) => ({ kind: c.kind, title: c.title, total_seconds: c.total_s, views: c.views })),
            )}>
              <Download className="h-3 w-3 mr-2" /> CSV
            </Button>
          </div>
          {loading && topContent.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : topContent.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Nenhuma reprodução registrada no período.
            </div>
          ) : (
            <div className="space-y-2">
              {topContent.map((item, idx) => (
                <div key={`${item.kind}-${item.title}`} className="flex items-center gap-3 text-sm">
                  <div className="w-6 text-xs font-bold text-muted-foreground">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {KIND_LABEL[item.kind] ?? item.kind} • {item.views} sessã{item.views === 1 ? "o" : "ões"}
                    </div>
                  </div>
                  <div className="text-xs text-primary font-mono shrink-0">{formatDuration(item.total_s)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
