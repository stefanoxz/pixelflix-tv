import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invokeAdminApi } from "@/lib/adminApi";
import { toast } from "sonner";

interface AuditEntry {
  id: string;
  actor_user_id: string;
  actor_email: string | null;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  allow_server: "Cadastrou DNS",
  remove_server: "Removeu DNS",
  unblock_user: "Liberou bloqueio",
  evict_session: "Encerrou sessão",
  approve_signup: "Aprovou cadastro",
  reject_signup: "Recusou cadastro",
  add_team_member: "Adicionou membro",
  update_team_role: "Mudou papel",
  remove_team_member: "Removeu membro",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function describeMetadata(action: string, metadata: Record<string, unknown> | null, target_email: string | null): string {
  if (!metadata && !target_email) return "";
  if (action === "allow_server" || action === "remove_server") {
    return String(metadata?.server_url ?? "");
  }
  if (action === "update_team_role") {
    return `→ ${String(metadata?.new_role ?? "")}`;
  }
  if (action === "add_team_member") {
    return `${String(metadata?.role ?? "")} • ${target_email ?? ""}`;
  }
  if (target_email) return target_email;
  if (metadata) {
    try { return JSON.stringify(metadata); } catch { return ""; }
  }
  return "";
}

export default function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invokeAdminApi<{ entries: AuditEntry[] }>("list_audit_log", { limit: 100 });
      setEntries(data.entries ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={fetchLog} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>
      {loading && entries.length === 0 ? (
        <div className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma ação registrada ainda.
        </div>
      ) : (
        <div className="divide-y divide-border/40 text-xs font-mono">
          {entries.map((e) => (
            <div key={e.id} className="py-2 grid grid-cols-12 gap-3 items-start">
              <div className="col-span-3 text-muted-foreground">{formatDate(e.created_at)}</div>
              <div className="col-span-3 truncate">{e.actor_email ?? e.actor_user_id.slice(0, 8)}</div>
              <div className="col-span-3 font-medium font-sans">
                {ACTION_LABEL[e.action] ?? e.action}
              </div>
              <div className="col-span-3 truncate text-muted-foreground" title={describeMetadata(e.action, e.metadata, e.target_email)}>
                {describeMetadata(e.action, e.metadata, e.target_email)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
