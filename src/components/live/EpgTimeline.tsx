import { memo } from "react";
import { cn } from "@/lib/utils";
import type { EpgEntry } from "@/services/iptv";
import { useNowTick } from "@/hooks/useEpgNow";

interface Props {
  epg: EpgEntry[] | undefined;
  className?: string;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Linha do tempo horizontal dos próximos programas, com largura proporcional
 * à duração de cada bloco. Programa atual destacado.
 */
export const EpgTimeline = memo(function EpgTimeline({ epg, className }: Props) {
  const nowMs = useNowTick();
  if (!epg || epg.length === 0) return null;

  // Normaliza durações (mínimo 1 unidade pra não sumir blocos curtinhos).
  const durations = epg.map((e) => Math.max(1, e.endMs - e.startMs));
  const total = durations.reduce((a, b) => a + b, 0);

  return (
    <div className={cn("rounded-lg border border-border/50 bg-card/40 p-3", className)}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
        Programação
      </p>
      <div className="flex w-full gap-1 overflow-hidden">
        {epg.map((e, i) => {
          const isNow = e.startMs <= nowMs && e.endMs > nowMs;
          const widthPct = (durations[i] / total) * 100;
          return (
            <div
              key={e.id}
              style={{ width: `${widthPct}%`, minWidth: 64 }}
              className={cn(
                "shrink-0 rounded px-2 py-1.5 text-left transition-colors",
                isNow
                  ? "bg-primary/20 border border-primary/40"
                  : "bg-secondary/60 border border-transparent hover:border-border",
              )}
              title={`${fmtTime(e.startMs)} – ${fmtTime(e.endMs)} · ${e.title}`}
            >
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {fmtTime(e.startMs)}
              </p>
              <p
                className={cn(
                  "text-xs font-medium truncate",
                  isNow ? "text-primary" : "text-foreground",
                )}
              >
                {e.title}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
});
