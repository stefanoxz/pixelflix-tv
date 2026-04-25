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
import { CheckCircle2, XCircle, Loader2, RefreshCw, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProbeResult {
  variant: string;
  ok: boolean;
  status: number | null;
  latency_ms: number;
  is_xtream: boolean;
  auth: number | string | null;
  body_preview: string;
  error: string | null;
}

interface ProbeResponse {
  server_url: string;
  normalized: string;
  tested_variants: number;
  timeout_ms: number;
  best_variant: string | null;
  best_status: number | null;
  results: ProbeResult[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverUrl: string | null;
  serverLabel?: string | null;
}

function classifyError(err: string | null): string {
  if (!err) return "—";
  const r = err.toLowerCase();
  if (/connection refused|os error 111/.test(r)) return "Porta fechada (Connection refused)";
  if (/reset by peer|os error 104/.test(r)) return "Conexão cortada pelo servidor (Reset by peer)";
  if (/timeout|timed out|deadline/.test(r)) return "Tempo esgotado (Timeout)";
  if (/no route to host|os error 113/.test(r)) return "Sem rota até o host";
  if (/network is unreachable/.test(r)) return "Rede inacessível";
  if (/getaddrinfo|name resolution|nxdomain/.test(r)) return "Hostname não resolveu (DNS)";
  if (/unrecognisedname|certificate|tls|ssl|handshake/.test(r)) return "Erro de certificado/TLS";
  if (/protocol|invalid http|wrong version/.test(r)) return "Erro de protocolo HTTP";
  return err.length > 90 ? `${err.slice(0, 90)}…` : err;
}

function statusBadge(r: ProbeResult) {
  if (r.is_xtream) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-success/15 text-success border border-success/30">
        <CheckCircle2 className="h-3 w-3" /> Xtream OK
      </span>
    );
  }
  if (r.status === 401) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-warning/15 text-warning border border-warning/30">
        <CheckCircle2 className="h-3 w-3" /> Vivo (401)
      </span>
    );
  }
  if (r.status && r.status >= 200 && r.status < 400) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-success/15 text-success border border-success/30">
        <CheckCircle2 className="h-3 w-3" /> HTTP {r.status}
      </span>
    );
  }
  if (r.status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-warning/15 text-warning border border-warning/30">
        HTTP {r.status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-destructive/15 text-destructive border border-destructive/30">
      <XCircle className="h-3 w-3" /> Falhou
    </span>
  );
}

export function ServerProbeDialog({ open, onOpenChange, serverUrl, serverLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProbeResponse | null>(null);

  const runProbe = async () => {
    if (!serverUrl) return;
    setLoading(true);
    setData(null);
    try {
      const { data: res, error } = await supabase.functions.invoke<ProbeResponse>("admin-api", {
        body: { action: "probe_server", payload: { server_url: serverUrl } },
      });
      if (error) throw error;
      if (!res) throw new Error("Resposta vazia");
      setData(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao testar conexão";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run quando abre
  useEffect(() => {
    if (open && serverUrl) {
      runProbe();
    } else if (!open) {
      setData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serverUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Testar conexão
          </DialogTitle>
          <DialogDescription>
            {serverLabel && <span className="font-semibold">{serverLabel}</span>}
            {serverLabel && " · "}
            <span className="font-mono">{serverUrl}</span>
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Testando todas as portas e protocolos…
            </p>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="rounded-lg border border-border/50 p-4 bg-muted/30">
              {data.best_variant ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-semibold text-success">Servidor está vivo</span>
                  </div>
                  <p className="text-sm">
                    Melhor variante:{" "}
                    <span className="font-mono text-primary">{data.best_variant}</span>
                  </p>
                  {data.best_status != null && (
                    <p className="text-xs text-muted-foreground">
                      Última resposta: HTTP {data.best_status}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="font-semibold text-destructive">
                      Nenhuma porta respondeu
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Servidor pode estar offline, com firewall bloqueando nosso IP, ou só
                    aceitar conexões geo-localizadas. Confirme com a revenda.
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {data.tested_variants} variantes testadas · timeout {data.timeout_ms}ms
                cada
              </p>
            </div>

            {/* Resultados por variante */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Resultado por porta/protocolo
              </h3>
              <div className="space-y-2">
                {data.results.map((r) => (
                  <div
                    key={r.variant}
                    className={`rounded-md border p-3 ${
                      r.is_xtream || r.status === 401
                        ? "border-success/30 bg-success/5"
                        : r.status && r.status < 500
                          ? "border-warning/30 bg-warning/5"
                          : "border-border/50 bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono text-sm break-all">{r.variant}</span>
                      <div className="flex items-center gap-2">
                        {statusBadge(r)}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {r.latency_ms}ms
                        </span>
                      </div>
                    </div>
                    {r.error && (
                      <p className="text-xs text-destructive/80 mt-1 break-all">
                        {classifyError(r.error)}
                      </p>
                    )}
                    {r.body_preview && r.is_xtream && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Resposta Xtream válida (auth={String(r.auth)})
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={runProbe} disabled={loading || !serverUrl}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Testar novamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
