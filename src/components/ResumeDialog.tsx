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
import { Play, RotateCcw } from "lucide-react";
import { formatProgressTime } from "@/hooks/useWatchProgress";

interface ResumeDialogProps {
  open: boolean;
  /** Chamado quando o usuário fecha o diálogo (sem escolher) */
  onOpenChange: (open: boolean) => void;
  /** Posição salva, em segundos */
  resumeAt: number;
  /** Duração total (para mostrar progresso). Pode ser 0 se desconhecida. */
  duration?: number;
  /** Título do conteúdo (filme ou episódio) */
  title?: string;
  /** Linha extra opcional (ex.: "S02E05 — Nome da série") */
  subtitle?: string;
  /** Tocar a partir de `resumeAt` */
  onResume: () => void;
  /** Tocar do início (e limpar o progresso salvo) */
  onRestart: () => void;
}

/**
 * Pergunta "Continuar de X:XX?" antes de abrir o player. Renderizado
 * pelas páginas Movies/Series quando há progresso salvo válido.
 */
export function ResumeDialog({
  open,
  onOpenChange,
  resumeAt,
  duration,
  title,
  subtitle,
  onResume,
  onRestart,
}: ResumeDialogProps) {
  const time = formatProgressTime(resumeAt);
  const pct = duration && duration > 0 ? Math.min(100, Math.round((resumeAt / duration) * 100)) : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Continuar assistindo?</AlertDialogTitle>
          <AlertDialogDescription>
            {title ? (
              <>
                Você parou <span className="font-semibold text-foreground">{title}</span> em{" "}
                <span className="font-semibold text-foreground tabular-nums">{time}</span>
                {pct != null ? ` (${pct}%)` : ""}.
              </>
            ) : (
              <>
                Você parou em{" "}
                <span className="font-semibold text-foreground tabular-nums">{time}</span>
                {pct != null ? ` (${pct}%)` : ""}.
              </>
            )}
            {subtitle && (
              <span className="block mt-1 text-xs text-muted-foreground">{subtitle}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {pct != null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel onClick={onRestart} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Começar do início
          </AlertDialogCancel>
          <AlertDialogAction onClick={onResume} className="gap-2">
            <Play className="h-4 w-4 fill-current" />
            Continuar de {time}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
