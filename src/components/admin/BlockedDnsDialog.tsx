import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  type BlockedDnsItem,
  type BlockedDnsType,
  createBlockedDns,
  updateBlockedDns,
  confirmBlockedDns,
} from "@/lib/adminApi";

interface BlockedDnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Item existente (modo editar/confirmar). Quando ausente, é criação. */
  item?: BlockedDnsItem | null;
  /** Pré-preenchimentos pra criação (vindo do ServerProbeDialog). */
  defaults?: {
    server_url?: string;
    block_type?: BlockedDnsType;
    evidence?: Record<string, unknown> | null;
    notes?: string;
  };
  /** Quando true e o item está em 'suggested', a ação principal é "Confirmar bloqueio". */
  confirmMode?: boolean;
  onSaved?: () => void;
}

const BLOCK_TYPE_LABELS: Record<BlockedDnsType, string> = {
  anti_datacenter: "Anti-datacenter (bloqueia IPs de cloud)",
  geoblock: "Geoblock (bloqueia por país/região)",
  waf: "WAF / DDoS challenge (exige browser real)",
  dns_error: "Erro de DNS (hostname não resolve)",
  outro: "Outro",
};

export function BlockedDnsDialog({
  open,
  onOpenChange,
  item,
  defaults,
  confirmMode,
  onSaved,
}: BlockedDnsDialogProps) {
  const [serverUrl, setServerUrl] = useState("");
  const [label, setLabel] = useState("");
  const [providerName, setProviderName] = useState("");
  const [blockType, setBlockType] = useState<BlockedDnsType>("anti_datacenter");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = !!item && !confirmMode;
  const isConfirming = !!item && confirmMode;

  useEffect(() => {
    if (!open) return;
    if (item) {
      setServerUrl(item.server_url);
      setLabel(item.label ?? "");
      setProviderName(item.provider_name ?? "");
      setBlockType(item.block_type);
      setNotes(item.notes ?? "");
    } else {
      setServerUrl(defaults?.server_url ?? "");
      setLabel("");
      setProviderName("");
      setBlockType(defaults?.block_type ?? "anti_datacenter");
      setNotes(defaults?.notes ?? "");
    }
  }, [open, item, defaults]);

  const handleSave = async () => {
    if (!serverUrl.trim()) {
      toast.error("Informe a URL do servidor");
      return;
    }
    setSaving(true);
    try {
      if (isConfirming && item) {
        await confirmBlockedDns(item.id, {
          label: label.trim() || null,
          provider_name: providerName.trim() || null,
          notes: notes.trim() || null,
        });
        toast.success("DNS confirmado como bloqueado");
      } else if (isEditing && item) {
        await updateBlockedDns(item.id, {
          label: label.trim() || null,
          provider_name: providerName.trim() || null,
          notes: notes.trim() || null,
          block_type: blockType,
        });
        toast.success("DNS atualizado");
      } else {
        await createBlockedDns({
          server_url: serverUrl.trim(),
          label: label.trim() || null,
          provider_name: providerName.trim() || null,
          block_type: blockType,
          notes: notes.trim() || null,
          status: "confirmed",
          evidence: defaults?.evidence ?? null,
        });
        toast.success("DNS catalogado como bloqueado");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const title = isConfirming
    ? "Confirmar DNS bloqueado"
    : isEditing
      ? "Editar DNS bloqueado"
      : "Catalogar DNS bloqueado";

  const description = isConfirming
    ? "Preencha um nome amigável e o fornecedor pra identificar esse DNS na lista oficial."
    : isEditing
      ? "Atualize as informações desse DNS."
      : "Adicione manualmente um DNS que você confirmou estar bloqueando IPs de cloud/datacenter.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bdns-url">URL do servidor</Label>
            <Input
              id="bdns-url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://exemplo.cc"
              disabled={!!item}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bdns-label">
              Nome amigável <span className="text-muted-foreground text-xs">(pra identificar)</span>
            </Label>
            <Input
              id="bdns-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex: Black, Painel do João"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bdns-provider">
              Fornecedor / revenda <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <Input
              id="bdns-provider"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="ex: Revenda XYZ"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bdns-type">Tipo de bloqueio</Label>
            <Select
              value={blockType}
              onValueChange={(v) => setBlockType(v as BlockedDnsType)}
              disabled={isConfirming}
            >
              <SelectTrigger id="bdns-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BLOCK_TYPE_LABELS) as BlockedDnsType[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {BLOCK_TYPE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bdns-notes">Observações</Label>
            <Textarea
              id="bdns-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex: Fornecedor recusou whitelist em 27/04"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isConfirming ? "Confirmar bloqueio" : isEditing ? "Salvar" : "Catalogar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
