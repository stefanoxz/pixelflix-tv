import { memo } from "react";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EpgEntry } from "@/services/iptv";
import { pickNowNext, useNowTick } from "@/hooks/useEpgNow";

interface Props {
  epg: EpgEntry[] | undefined;
  variant?: "compact" | "full";
  className?: string;
  /** Mostra "—" quando o canal não tem epg_channel_id. */
  noEpg?: boolean;
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "";
  const min = Math.ceil(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

/**
 * Mostra "Agora: <programa>" + barra de progresso fina.
 * Em variant="full" mostra também "A seguir: <próximo>".
 */
export const EpgNowNext = memo(function EpgNowNext({
  epg,
  variant = "compact",
  className,
  noEpg,
}: Props) {
  const nowMs = useNowTick();
  const { now, next, progress, remainingMs } = pickNowNext(epg, nowMs);

  if (noEpg) {
    return (
      <p className={cn("text-xs text-muted-foreground/60 truncate", className)}>
        Sem programação
      </p>
    );
  }

  if (!now && !next) {
    return (
      <p className={cn("text-xs text-muted-foreground/60 truncate", className)}>
        {epg === undefined ? "Carregando…" : "Sem informação"}
      </p>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("min-w-0 space-y-1", className)}>
        <p className="text-xs text-muted-foreground truncate">
          <span className="text-primary font-medium">Agora:</span>{" "}
          {now?.title ?? "—"}
        </p>
        <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
          <Radio className="h-3 w-3 animate-pulse" />
          Ao vivo
        </span>
        {remainingMs > 0 && (
          <span className="text-xs text-muted-foreground">
            termina em {fmtRemaining(remainingMs)}
          </span>
        )}
      </div>
      <p className="text-base font-semibold text-foreground line-clamp-2">
        {now?.title ?? "—"}
      </p>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      {next && (
        <p className="text-xs text-muted-foreground truncate">
          <span className="font-medium">A seguir:</span> {next.title}
        </p>
      )}
    </div>
  );
});
