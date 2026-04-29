import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  Ban,
  CheckCircle2,
  Plus,
  RefreshCw,
  Trash2,
  Edit3,
  RotateCcw,
  Loader2,
  Search,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  type BlockedDnsItem,
  type BlockedDnsStatus,
  listBlockedDns,
  confirmBlockedDns,
  dismissBlockedDns,
  reactivateBlockedDns,
  deleteBlockedDns,
} from "@/lib/adminApi";
import { BlockedDnsDialog } from "./BlockedDnsDialog";

const BLOCK_TYPE_LABEL: Record<string, string> = {
  anti_datacenter: "Anti-datacenter",
  geoblock: "Geoblock",
  waf: "WAF / DDoS",
  dns_error: "Erro de DNS",
  outro: "Outro",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BlockedDnsPanel() {
  const [items, setItems] = useState<BlockedDnsItem[]>([]);
  const [counts, setCounts] = useState({ suggested: 0, confirmed: 0, dismissed: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BlockedDnsStatus>("suggested");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<BlockedDnsItem | null>(null);
  const [dialogConfirmMode, setDialogConfirmMode] = useState(false);

  const [dismissTarget, setDismissTarget] = useState<BlockedDnsItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlockedDnsItem | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await listBlockedDns();
      setItems(res.items);
      setCounts(res.counts);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // Quando carrega e tem sugestões pendentes, abre na aba de sugestões.
  useEffect(() => {
    if (counts.suggested > 0) setTab("suggested");
    else if (counts.confirmed > 0) setTab("confirmed");
  }, [counts.suggested, counts.confirmed]);

  const filtered = useMemo(() => {
    const byStatus = items.filter((i) => i.status === tab);
    const q = search.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter(
      (i) =>
        i.server_url.toLowerCase().includes(q) ||
        (i.label ?? "").toLowerCase().includes(q) ||
        (i.provider_name ?? "").toLowerCase().includes(q),
    );
  }, [items, tab, search]);

  const handleQuickConfirm = async (item: BlockedDnsItem) => {
    // Se não tem label nem fornecedor, abre dialog pra preencher.
    if (!item.label && !item.provider_name) {
      setDialogItem(item);
      setDialogConfirmMode(true);
      setDialogOpen(true);
      return;
    }
    try {
      await confirmBlockedDns(item.id);
      toast.success("DNS confirmado");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao confirmar");
    }
  };

  const handleDismissConfirmed = async () => {
    if (!dismissTarget) return;
    try {
      await dismissBlockedDns(dismissTarget.id);
      toast.success("DNS descartado permanentemente");
      setDismissTarget(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao descartar");
    }
  };

  const handleReactivate = async (item: BlockedDnsItem) => {
    try {
      await reactivateBlockedDns(item.id);
      toast.success("DNS reativado — voltou pra sugestões");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reativar");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBlockedDns(deleteTarget.id);
      toast.success("DNS removido");
      setDeleteTarget(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 bg-gradient-card border-border/50">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">DNS bloqueados</h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                Catálogo de servidores que bloqueiam IPs de cloud/datacenter. Falhas
                consistentes são detectadas automaticamente e aparecem em "Sugestões"
                pra você revisar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDialogItem(null);
                setDialogConfirmMode(false);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar manualmente
            </Button>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as BlockedDnsStatus)}>
        <TabsList>
          <TabsTrigger value="suggested" className="gap-2">
            🔔 Sugestões
            {counts.suggested > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5">
                {counts.suggested}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="gap-2">
            ✅ Confirmados
            {counts.confirmed > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5">
                {counts.confirmed}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dismissed" className="gap-2">
            🚫 Descartados
            {counts.dismissed > 0 && (
              <Badge variant="outline" className="h-5 px-1.5">
                {counts.dismissed}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 mb-3 relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por URL, nome ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <TabsContent value="suggested" className="mt-0">
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="🎉"
              title="Nenhuma sugestão pendente"
              description="Quando um DNS começar a falhar com padrão anti-datacenter (5+ falhas em 24h de IPs distintos), ele aparece aqui pra você revisar."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <SuggestionCard
                  key={item.id}
                  item={item}
                  onConfirm={() => handleQuickConfirm(item)}
                  onDismiss={() => setDismissTarget(item)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="confirmed" className="mt-0">
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="📭"
              title="Nenhum DNS confirmado"
              description="Quando você confirmar uma sugestão (ou catalogar manualmente), ele aparece aqui."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <ConfirmedCard
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setDialogItem(item);
                    setDialogConfirmMode(false);
                    setDialogOpen(true);
                  }}
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dismissed" className="mt-0">
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="🗑️"
              title="Nenhum DNS descartado"
              description="DNS descartados aqui nunca mais serão sugeridos automaticamente, mas você pode reativá-los se mudar de ideia."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <DismissedCard
                  key={item.id}
                  item={item}
                  onReactivate={() => handleReactivate(item)}
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BlockedDnsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={dialogItem}
        confirmMode={dialogConfirmMode}
        onSaved={refresh}
      />

      <AlertDialog open={!!dismissTarget} onOpenChange={(o) => !o && setDismissTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              O DNS <strong>{dismissTarget?.server_url}</strong> nunca mais será sugerido
              automaticamente, mesmo que volte a falhar. Você ainda poderá reativá-lo
              manualmente na aba "Descartados".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDismissConfirmed}>
              Descartar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar definitivamente do catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              O DNS <strong>{deleteTarget?.server_url}</strong> será removido do catálogo de DNS bloqueados
              e as falhas registradas dessa DNS também serão apagadas. Esta ação é definitiva — para voltar
              a aparecer, a DNS precisaria gerar novas falhas no futuro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed}>Apagar definitivamente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      Carregando...
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <Card className="p-10 text-center bg-gradient-card border-border/50">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
    </Card>
  );
}

function SuggestionCard({
  item,
  onConfirm,
  onDismiss,
}: {
  item: BlockedDnsItem;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className="p-4 bg-gradient-card border-border/50 border-l-4 border-l-destructive">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <code className="font-mono text-sm font-semibold break-all">{item.server_url}</code>
            <Badge variant="destructive" className="text-xs">
              {BLOCK_TYPE_LABEL[item.block_type]}
            </Badge>
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
            <div>
              <div className="text-foreground font-medium">{item.failure_count}</div>
              <div>falhas em 24h</div>
            </div>
            <div>
              <div className="text-foreground font-medium">{item.distinct_ip_count}</div>
              <div>IPs distintos</div>
            </div>
            <div>
              <div className="text-foreground font-medium">{formatDate(item.first_detected_at)}</div>
              <div>1ª detecção</div>
            </div>
            <div>
              <div className="text-foreground font-medium">{formatDate(item.last_detected_at)}</div>
              <div>última falha</div>
            </div>
          </div>
          {item.evidence && typeof item.evidence === "object" && "sample_errors" in item.evidence && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Erros amostrados:</span>{" "}
              {((item.evidence.sample_errors as string[]) ?? []).join(", ")}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={onConfirm}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Confirmar bloqueio
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            <Ban className="h-4 w-4 mr-2" />
            Descartar
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ConfirmedCard({
  item,
  onEdit,
  onDelete,
}: {
  item: BlockedDnsItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="p-4 bg-gradient-card border-border/50">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.label && <span className="font-semibold">{item.label}</span>}
            <code className="font-mono text-sm break-all text-muted-foreground">
              {item.server_url}
            </code>
            <Badge variant="outline" className="text-xs">
              {BLOCK_TYPE_LABEL[item.block_type]}
            </Badge>
          </div>
          {item.provider_name && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium">Fornecedor:</span> {item.provider_name}
            </p>
          )}
          {item.notes && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.notes}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Confirmado em {formatDate(item.confirmed_at)} · Última falha:{" "}
            {formatDate(item.last_detected_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Edit3 className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DismissedCard({
  item,
  onReactivate,
  onDelete,
}: {
  item: BlockedDnsItem;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="p-4 bg-gradient-card border-border/50 opacity-75">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.label && <span className="font-semibold">{item.label}</span>}
            <code className="font-mono text-sm break-all text-muted-foreground">
              {item.server_url}
            </code>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Descartado em {formatDate(item.dismissed_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onReactivate}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reativar
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
