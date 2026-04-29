import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { invokeAdminApi } from "@/lib/adminApi";
import {
  getPlayerLogsEnabled,
  setPlayerLogsEnabled,
} from "@/hooks/usePlayerLogsEnabled";
import { Database, Trash2, RefreshCw, Activity, AlertTriangle, Clock, Terminal } from "lucide-react";

interface TableStat {
  table: string;
  label: string;
  retention_days: number;
  row_count: number;
  oldest_at: string | null;
  expired_count: number;
}
interface LiveStats {
  active_sessions: number;
  user_blocks: number;
}
interface StatsResp {
  tables: TableStat[];
  live: LiveStats;
}

function formatRelativeAge(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (d > 0) return `${d}d atrás`;
  const h = Math.floor(diff / (60 * 60 * 1000));
  if (h > 0) return `${h}h atrás`;
  const m = Math.floor(diff / 60000);
  return m > 0 ? `${m}min atrás` : "agora";
}

export default function MaintenancePanel() {
  const [stats, setStats] = useState<StatsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyTable, setBusyTable] = useState<string | null>(null);
  const [evictBusy, setEvictBusy] = useState(false);
  const [confirm, setConfirm] = useState<TableStat | null>(null);
  const [confirmEvict, setConfirmEvict] = useState(false);
  const [playerLogs, setPlayerLogs] = useState<boolean>(() => getPlayerLogsEnabled());

  const togglePlayerLogs = (next: boolean) => {
    setPlayerLogs(next);
    setPlayerLogsEnabled(next);
    toast.success(
      next
        ? "Painel 'Logs do player' ativado para sua sessão"
        : "Painel 'Logs do player' desativado",
    );
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await invokeAdminApi<StatsResp>("table_stats");
      setStats(data);
    } catch (e) {
      toast.error("Falha ao carregar status", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runCleanup = async (t: TableStat) => {
    setBusyTable(t.table);
    try {
      const res = await invokeAdminApi<{ removed: number }>("cleanup_table", { table: t.table });
      toast.success(`${t.label}: ${res.removed} linha(s) removida(s)`);
      await refresh();
    } catch (e) {
      toast.error("Falha ao limpar", { description: (e as Error).message });
    } finally {
      setBusyTable(null);
      setConfirm(null);
    }
  };

  const runEvict = async () => {
    setEvictBusy(true);
    try {
      const res = await invokeAdminApi<{ removed: number }>("evict_idle_now");
      toast.success(`${res.removed} sessão(ões) ociosa(s) encerrada(s)`);
      await refresh();
    } catch (e) {
      toast.error("Falha ao encerrar sessões", { description: (e as Error).message });
    } finally {
      setEvictBusy(false);
      setConfirmEvict(false);
    }
  };

  const totalExpired = stats?.tables.reduce((acc, t) => acc + t.expired_count, 0) ?? 0;
  const totalRows = stats?.tables.reduce((acc, t) => acc + t.row_count, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Stats topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-primary bg-primary/10 flex items-center justify-center mb-3">
            <Database className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Linhas totais</p>
          <p className="text-2xl font-bold mt-1">{totalRows.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">em tabelas limpáveis</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-warning bg-warning/10 flex items-center justify-center mb-3">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Linhas expiradas</p>
          <p className="text-2xl font-bold mt-1">{totalExpired.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">prontas para limpar</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-success bg-success/10 flex items-center justify-center mb-3">
            <Activity className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Sessões ativas</p>
          <p className="text-2xl font-bold mt-1">{stats?.live.active_sessions ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">incluindo ociosas</p>
        </Card>
        <Card className="p-5 bg-gradient-card border-border/50">
          <div className="h-10 w-10 rounded-lg text-destructive bg-destructive/10 flex items-center justify-center mb-3">
            <Clock className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">Bloqueios totais</p>
          <p className="text-2xl font-bold mt-1">{stats?.live.user_blocks ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">incluindo expirados</p>
        </Card>
      </div>

      {/* Ações rápidas */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Sessões ociosas</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Encerra sessões com último heartbeat &gt; 60min ou em "idle" há mais de 60min.
              Roda automaticamente quando alguém atualiza o painel — use aqui pra forçar.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={evictBusy}
            onClick={() => setConfirmEvict(true)}
          >
            <Activity className={"h-4 w-4 mr-2 " + (evictBusy ? "animate-spin" : "")} />
            Encerrar agora
          </Button>
        </div>
      </Card>

      {/* Tabelas limpáveis */}
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Tabelas com retenção</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Linhas mais velhas que o limite de retenção podem ser apagadas com segurança.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={"h-4 w-4 mr-2 " + (loading ? "animate-spin" : "")} />
            Atualizar
          </Button>
        </div>

        {!stats ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {loading ? "Carregando..." : "Sem dados."}
          </p>
        ) : (
          <div className="divide-y divide-border/50">
            <div className="grid grid-cols-12 gap-3 px-2 py-2 text-xs font-medium text-muted-foreground">
              <div className="col-span-4">Tabela</div>
              <div className="col-span-2 text-center">Total</div>
              <div className="col-span-2 text-center">Retenção</div>
              <div className="col-span-2">Mais antigo</div>
              <div className="col-span-2 text-right">Ação</div>
            </div>
            {stats.tables.map((t) => {
              const hasWork = t.expired_count > 0;
              return (
                <div
                  key={t.table}
                  className="grid grid-cols-12 gap-3 px-2 py-3 items-center text-sm"
                >
                  <div className="col-span-4 min-w-0">
                    <p className="font-medium truncate">{t.label}</p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">{t.table}</p>
                  </div>
                  <div className="col-span-2 text-center">
                    <p className="font-medium">{t.row_count.toLocaleString("pt-BR")}</p>
                    {hasWork && (
                      <Badge variant="outline" className="mt-1 text-warning border-warning/40 bg-warning/5">
                        {t.expired_count} expirado(s)
                      </Badge>
                    )}
                  </div>
                  <div className="col-span-2 text-center text-xs text-muted-foreground">
                    {t.retention_days}d
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground">
                    {formatRelativeAge(t.oldest_at)}
                  </div>
                  <div className="col-span-2 text-right">
                    <Button
                      size="sm"
                      variant={hasWork ? "default" : "outline"}
                      disabled={!hasWork || busyTable === t.table}
                      onClick={() => setConfirm(t)}
                    >
                      <Trash2 className={"h-3 w-3 mr-1 " + (busyTable === t.table ? "animate-spin" : "")} />
                      Limpar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Confirmação cleanup */}
      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar {confirm?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai apagar permanentemente <strong>{confirm?.expired_count.toLocaleString("pt-BR")}</strong>{" "}
              linha(s) com mais de {confirm?.retention_days} dias da tabela{" "}
              <code className="font-mono text-xs">{confirm?.table}</code>. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && runCleanup(confirm)}>
              Limpar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação evict */}
      <AlertDialog open={confirmEvict} onOpenChange={setConfirmEvict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar sessões ociosas?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai encerrar todas as sessões sem heartbeat há mais de 60min. Os usuários
              ainda online não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runEvict}>Encerrar agora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
