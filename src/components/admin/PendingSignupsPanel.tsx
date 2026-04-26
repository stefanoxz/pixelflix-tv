import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, Trash2, RefreshCw, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { invokeAdminApi } from "@/lib/adminApi";

interface PendingSignup {
  user_id: string;
  email: string | null;
  created_at: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function PendingSignupsPanel() {
  const [pending, setPending] = useState<PendingSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<PendingSignup | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invokeAdminApi<{ pending: PendingSignup[] }>("list_pending_signups");
      setPending(data.pending ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar lista";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const approve = async (s: PendingSignup) => {
    setBusyId(s.user_id);
    try {
      await invokeAdminApi("approve_signup", { user_id: s.user_id });
      toast.success(`${s.email ?? s.user_id.slice(0, 8)} aprovado como administrador`);
      setPending((prev) => prev.filter((p) => p.user_id !== s.user_id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao aprovar");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (s: PendingSignup) => {
    setBusyId(s.user_id);
    try {
      await invokeAdminApi("reject_signup", { user_id: s.user_id });
      toast.success(`Cadastro de ${s.email ?? s.user_id.slice(0, 8)} recusado e conta removida`);
      setPending((prev) => prev.filter((p) => p.user_id !== s.user_id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao recusar");
    } finally {
      setBusyId(null);
      setConfirmReject(null);
    }
  };

  return (
    <Card className="p-6 bg-gradient-card border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Cadastros pendentes</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {pending.length} cadastro{pending.length === 1 ? "" : "s"} aguardando aprovação
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchPending} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {loading && pending.length === 0 ? (
        <div className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pending.length === 0 ? (
        <div className="py-12 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum cadastro pendente.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          <div className="grid grid-cols-12 gap-3 px-2 py-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-5">E-mail</div>
            <div className="col-span-3">Data do cadastro</div>
            <div className="col-span-4 text-right">Ações</div>
          </div>
          {pending.map((s) => {
            const shortId = s.user_id.slice(0, 8);
            const hasEmail = !!s.email && s.email.trim() !== "";
            return (
            <div key={s.user_id} className="grid grid-cols-12 gap-3 px-2 py-3 items-center text-sm">
              <div className="col-span-5 truncate" title={`${s.email ?? "(sem e-mail)"} • id: ${s.user_id}`}>
                {hasEmail ? (
                  <span className="font-medium">{s.email}</span>
                ) : (
                  <span className="italic text-muted-foreground">
                    (e-mail indisponível — id: {shortId}…)
                  </span>
                )}
              </div>
              <div className="col-span-3 text-xs text-muted-foreground">{formatDate(s.created_at)}</div>
              <div className="col-span-4 flex justify-end gap-2">
                <Button
                  size="sm"
                  onClick={() => approve(s)}
                  disabled={busyId === s.user_id}
                >
                  {busyId === s.user_id
                    ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    : <Check className="h-3 w-3 mr-1" />}
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmReject(s)}
                  disabled={busyId === s.user_id}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Recusar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmReject} onOpenChange={(o) => !o && setConfirmReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar cadastro?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta de <strong>{confirmReject?.email}</strong> será permanentemente apagada.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmReject && reject(confirmReject)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Recusar e apagar conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
