import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ErrorBucket =
  | "refused" | "reset" | "http_404" | "http_444" | "http_5xx"
  | "tls" | "cert_invalid" | "timeout" | "io_timeout"
  | "dns" | "no_route" | "net_unreach" | "protocol" | "other";

export interface SeriesPoint {
  t: string;
  total: number;
  success: number;
  fail: number;
  refused: number; reset: number; http_404: number; http_444: number; http_5xx: number;
  tls: number; cert_invalid: number; timeout: number; io_timeout: number;
  dns: number; no_route: number; net_unreach: number; protocol: number; other: number;
}

interface BucketMeta {
  label: string;
  color: string;
}

interface Props {
  series: SeriesPoint[];
  bucketMeta: Record<ErrorBucket, BucketMeta>;
  perServerSeries?: { server_url: string; points: SeriesPoint[] }[];
  serverPalette: string[];
  stepMs?: number;
}

// Default visible buckets (most informative ones on first render)
const DEFAULT_VISIBLE: ErrorBucket[] = ["refused", "reset", "dns", "tls", "http_404", "timeout"];

const ALL_BUCKETS: ErrorBucket[] = [
  "refused", "reset", "http_404", "http_444", "http_5xx",
  "tls", "cert_invalid", "timeout", "io_timeout",
  "dns", "no_route", "net_unreach", "protocol", "other",
];

function formatTick(iso: string, stepMs?: number) {
  const d = new Date(iso);
  if (!stepMs || stepMs >= 3 * 60 * 60_000) {
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit" }) + "h";
  }
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function shortHost(url: string) {
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/+$/, "").slice(0, 28);
  }
}

export function DnsErrorTrendChart({
  series,
  bucketMeta,
  perServerSeries,
  serverPalette,
  stepMs,
}: Props) {
  const [visible, setVisible] = useState<Set<ErrorBucket>>(new Set(DEFAULT_VISIBLE));
  const [mode, setMode] = useState<"buckets" | "providers">("buckets");

  const toggle = (b: ErrorBucket) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  };

  // Build provider comparison data: total fails per slot, one column per server
  const providerData = useMemo(() => {
    if (!perServerSeries?.length) return [];
    const length = perServerSeries[0]?.points.length ?? 0;
    const out: Record<string, number | string>[] = [];
    for (let i = 0; i < length; i++) {
      const row: Record<string, number | string> = { t: perServerSeries[0].points[i].t };
      for (const s of perServerSeries) {
        row[shortHost(s.server_url)] = s.points[i]?.fail ?? 0;
      }
      out.push(row);
    }
    return out;
  }, [perServerSeries]);

  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    color: "hsl(var(--popover-foreground))",
  } as const;

  return (
    <Card className="p-6 bg-gradient-card border-border/50">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold">Tendência de erros</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "buckets" ? "default" : "outline"}
            onClick={() => setMode("buckets")}
          >
            Por tipo de erro
          </Button>
          <Button
            size="sm"
            variant={mode === "providers" ? "default" : "outline"}
            onClick={() => setMode("providers")}
            disabled={!perServerSeries?.length}
          >
            Comparar provedores
          </Button>
        </div>
      </div>

      {mode === "buckets" && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {ALL_BUCKETS.map((b) => {
              const meta = bucketMeta[b];
              const active = visible.has(b);
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggle(b)}
                  className={`text-[11px] px-2 py-1 rounded-full border transition-all ${
                    active
                      ? "border-transparent text-white"
                      : "border-border/60 text-muted-foreground bg-transparent hover:border-border"
                  }`}
                  style={active ? { background: meta.color } : undefined}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          <div className="h-72 w-full">
            {series.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sem dados na janela selecionada.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis
                    dataKey="t"
                    tickFormatter={(v) => formatTick(v, stepMs)}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    minTickGap={32}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    allowDecimals={false}
                  />
                  <RTooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(v) => formatTick(String(v), stepMs)}
                  />
                  {[...visible].map((b) => (
                    <Line
                      key={b}
                      type="monotone"
                      dataKey={b}
                      name={bucketMeta[b].label}
                      stroke={bucketMeta[b].color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {mode === "providers" && (
        <div className="h-80 w-full">
          {providerData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sem dados por provedor na janela selecionada.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={providerData} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="t"
                  tickFormatter={(v) => formatTick(v, stepMs)}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  minTickGap={32}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  allowDecimals={false}
                  label={{
                    value: "Falhas",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
                  }}
                />
                <RTooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(v) => formatTick(String(v), stepMs)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {(perServerSeries ?? []).map((s, i) => (
                  <Line
                    key={s.server_url}
                    type="monotone"
                    dataKey={shortHost(s.server_url)}
                    stroke={serverPalette[i % serverPalette.length]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </Card>
  );
}
