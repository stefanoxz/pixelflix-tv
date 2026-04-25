import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, Flag, Eye, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserReport {
  id: string;
  anon_user_id: string;
  created_at: string;
  ip: string;
  category: string | null;
  description: string | null;
  title: string | null;
  upstream_host: string | null;
  engine: string | null;
  load_method: string | null;
  root_cause: string | null;
  last_reason: string | null;
  status: string | null;
  user_agent: string | null;
  container_ext: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  no_load: "Não carrega",
  buffering: "Travando",
  audio_sync: "Áudio dessinc.",
  no_audio: "Sem áudio",
  no_subtitle: "Sem legenda",
  wrong_content: "Conteúdo errado",
  codec_incompatible_auto: "Codec incompatível (auto)",
  other: "Outro",
};

const CATEGORY_TONE: Record<string, string> = {
  no_load: "bg-destructive/15 text-destructive border-destructive/30",
  buffering: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  audio_sync: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  no_audio: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  no_subtitle: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  wrong_content: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  codec_incompatible_auto: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

async function callAdmin<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-api", {
    body: { action, payload },
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error!);
  return data as T;
}

export function UserReportsPanel() {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [hours, setHours] = useState<string>("168"); // 7d
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<UserReport | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await callAdmin<{ reports: UserReport[] }>("list_user_reports", {
        hours: Number(hours),
        limit: 200,
      });
      setReports(data.reports || []);
    } catch (e) {
      toast.error("Falha ao carregar reportes", {
        description: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (!q) return true;
      const hay = [
        r.title,
        r.upstream_host,
        r.description,
        r.anon_user_id,
        r.engine,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reports, category, search]);

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-card border-border/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, host, descrição..."
              className="pl-10 h-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={hours} onValueChange={setHours}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">Últimas 24h</SelectItem>
              <SelectItem value="168">Últimos 7 dias</SelectItem>
              <SelectItem value="720">Últimos 30 dias</SelectItem>
              <SelectItem value="2160">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="h-9"
          >
            <RefreshCw className={"h-4 w-4 mr-2 " + (loading ? "animate-spin" : "")} />
            Atualizar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {filtered.length} {filtered.length === 1 ? "reporte" : "reportes"} encontrados
          {category !== "all" || search ? " (filtrados)" : ""}.
        </p>
      </Card>

      <Card className="bg-card border-border/50 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Flag className="h-8 w-8 opacity-40" />
            Nenhum reporte no período selecionado.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((r) => {
              const tone = CATEGORY_TONE[r.category || "other"] ?? CATEGORY_TONE.other;
              return (
                <div
                  key={r.id}
                  className="p-4 hover:bg-secondary/30 transition-colors flex items-start gap-3"
                >
                  <div className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border " +
                          tone
                        }
                      >
                        {CATEGORY_LABELS[r.category || "other"] || r.category || "Outro"}
                      </span>
                      {r.title && (
                        <span className="text-sm font-medium truncate">{r.title}</span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        há {formatRelative(r.created_at)}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-foreground/80 line-clamp-2">
                        {r.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-mono">
                      {r.upstream_host && <span>host: {r.upstream_host}</span>}
                      {r.engine && <span>engine: {r.engine}</span>}
                      {r.root_cause && <span>causa: {r.root_cause}</span>}
                      <span>ip: {r.ip}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setDetail(r)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Detalhes
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-destructive" />
              Detalhes do reporte
            </DialogTitle>
            <DialogDescription>
              {detail && new Date(detail.created_at).toLocaleString("pt-BR")}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <Field label="Categoria">
                {CATEGORY_LABELS[detail.category || "other"] || detail.category || "—"}
              </Field>
              {detail.title && <Field label="Conteúdo">{detail.title}</Field>}
              {detail.description && (
                <Field label="Descrição do usuário">
                  <p className="whitespace-pre-wrap">{detail.description}</p>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Servidor (host)">{detail.upstream_host || "—"}</Field>
                <Field label="Motor de reprodução">{detail.engine || "—"}</Field>
                <Field label="Método de carga">{detail.load_method || "—"}</Field>
                <Field label="Container">{detail.container_ext || "—"}</Field>
                <Field label="Status no momento">{detail.status || "—"}</Field>
                <Field label="Causa raiz detectada">{detail.root_cause || "—"}</Field>
              </div>
              {detail.last_reason && (
                <Field label="Última razão técnica">
                  <code className="text-[11px]">{detail.last_reason}</code>
                </Field>
              )}
              <Field label="ID do usuário (anon)">
                <code className="text-[11px]">{detail.anon_user_id}</code>
              </Field>
              <Field label="IP">{detail.ip}</Field>
              {detail.user_agent && (
                <Field label="Navegador">
                  <code className="text-[10px] break-all">{detail.user_agent}</code>
                </Field>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
