import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Loader2, RefreshCw, Calendar, TrendingUp, Users, Server, ShieldCheck } from "lucide-react";
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

export default function StatsPanel() {
  const [range, setRange] = useState<RangeDays>(30);
  const [logins, setLogins] = useState<LoginPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a] = await Promise.all([
        invokeAdminApi<{ series: LoginPoint[] }>("stats_logins_daily", { days: range }),
      ]);
      setLogins(a.series ?? []);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Logins no período</p>
          </div>
          <p className="text-2xl font-bold">{totalLogins.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">{successRate}% de sucesso operacional</p>
        </Card>
        
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-success" />
            </div>
            <p className="text-xs text-muted-foreground">Sucessos</p>
          </div>
          <p className="text-2xl font-bold">{totalSuccess.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">Conexões estabelecidas</p>
        </Card>

        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Server className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-xs text-muted-foreground">Falhas</p>
          </div>
          <p className="text-2xl font-bold">{(totalLogins - totalSuccess).toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">Erros de DNS ou autenticação</p>
        </Card>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-lg">Histórico de Atividade</h3>
            <p className="text-sm text-muted-foreground">Volume diário de requisições — últimos {range} dias</p>
          </div>
        </div>
        {loading && logins.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
          </div>
        ) : logins.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg">
            Sem dados de atividade no período selecionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={logins}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }} 
                stroke="hsl(var(--muted-foreground))"
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis 
                tick={{ fontSize: 10 }} 
                stroke="hsl(var(--muted-foreground))"
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.1)' }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                }}
              />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: "11px", paddingBottom: "20px" }} />
              <Bar dataKey="success" stackId="a" fill="hsl(var(--success))" name="Sucesso" radius={[0, 0, 0, 0]} />
              <Bar dataKey="fail" stackId="a" fill="hsl(var(--destructive))" name="Falha" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
