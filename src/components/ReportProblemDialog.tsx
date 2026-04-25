import { forwardRef, useState } from "react";
import { Flag, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { reportStreamEvent } from "@/services/iptv";

export type ReportCategory =
  | "no_load"
  | "buffering"
  | "audio_sync"
  | "no_audio"
  | "no_subtitle"
  | "wrong_content"
  | "other";

const CATEGORY_OPTIONS: { value: ReportCategory; label: string }[] = [
  { value: "no_load", label: "Não carrega / não inicia" },
  { value: "buffering", label: "Trava / fica buffering" },
  { value: "audio_sync", label: "Áudio fora de sincronia" },
  { value: "no_audio", label: "Sem áudio" },
  { value: "no_subtitle", label: "Sem legenda" },
  { value: "wrong_content", label: "Conteúdo errado / incompatível" },
  { value: "other", label: "Outro" },
];

export interface ReportSnapshot {
  title?: string;
  url?: string;
  containerExt?: string;
  engine?: string;
  loadMethod?: string;
  rootCause?: string;
  lastReason?: string | null;
  upstreamHost?: string | null;
  status?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: ReportSnapshot;
}

export const ReportProblemDialog = forwardRef<HTMLDivElement, Props>(function ReportProblemDialog({ open, onOpenChange, snapshot }, _ref) {
  const [category, setCategory] = useState<ReportCategory>("buffering");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategory("buffering");
    setDescription("");
  };

  const handleSubmit = () => {
    setSubmitting(true);
    try {
      reportStreamEvent("user_report", {
        url: snapshot.url,
        meta: {
          category,
          description: description.trim() || null,
          title: snapshot.title ?? null,
          container_ext: snapshot.containerExt ?? null,
          engine: snapshot.engine ?? null,
          load_method: snapshot.loadMethod ?? null,
          root_cause: snapshot.rootCause ?? null,
          last_reason: snapshot.lastReason ?? null,
          upstream_host: snapshot.upstreamHost ?? null,
          status: snapshot.status ?? null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          reported_at: new Date().toISOString(),
        },
      });
      toast.success("Relato enviado", {
        description: "Obrigado! Nossa equipe vai analisar.",
      });
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível enviar o relato. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" />
            Reportar problema
          </DialogTitle>
          <DialogDescription>
            {snapshot.title
              ? `Sobre "${snapshot.title}"`
              : "Conte o que está acontecendo. Anexamos automaticamente as informações técnicas."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="report-category">O que está acontecendo?</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as ReportCategory)}
            >
              <SelectTrigger id="report-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="report-description">Descrição (opcional)</Label>
            <Textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Ex: trava após uns 30 segundos, áudio fica adiantado..."
              className="min-h-[90px] resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {description.length}/500
            </p>
          </div>

          <div className="rounded-md bg-muted/40 border border-border/40 p-2 text-[10px] text-muted-foreground space-y-0.5">
            <p>
              <span className="font-medium text-foreground/80">Motor:</span>{" "}
              {snapshot.engine || "—"} ·{" "}
              <span className="font-medium text-foreground/80">Status:</span>{" "}
              {snapshot.status || "—"}
            </p>
            {snapshot.upstreamHost && (
              <p>
                <span className="font-medium text-foreground/80">Servidor:</span>{" "}
                {snapshot.upstreamHost}
              </p>
            )}
            {snapshot.lastReason && (
              <p className="truncate">
                <span className="font-medium text-foreground/80">Última razão:</span>{" "}
                {snapshot.lastReason}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
