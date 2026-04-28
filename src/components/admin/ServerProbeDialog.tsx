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
import { CheckCircle2, XCircle, Loader2, RefreshCw, Wifi, Copy, Download } from "lucide-react";
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
  headers?: Record<string, string>;
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

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function fmtTimestamp(d: Date) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function diagnoseVariant(r: ProbeResult): string {
  const body = (r.body_preview || "").toLowerCase();
  if (body.includes("account has been suspended") || body.includes("account suspended")) {
    return "Conta suspensa pela hospedagem (Cloudflare 444)";
  }
  if (r.is_xtream && (r.auth === 1 || r.auth === "1")) return "Painel Xtream OK (credenciais válidas)";
  if (r.is_xtream && (r.auth === 0 || r.auth === "0")) return "Painel Xtream OK mas auth=0 (credenciais inválidas)";
  if (r.status === 401) return "Painel vivo, exige autenticação (HTTP 401)";
  if (r.status === 403) return "Acesso proibido — possível bloqueio de IP (HTTP 403)";
  if (r.status === 404) return "Endpoint não encontrado (HTTP 404) — DNS responde mas Xtream não está no caminho esperado, ou IP bloqueado";
  if (r.status === 444) return "Conexão fechada sem resposta (Cloudflare 444 — geralmente conta suspensa ou WAF)";
  if (r.status === 502 || r.status === 503 || r.status === 504) return `Servidor de origem inacessível (HTTP ${r.status})`;
  if (r.status && r.status >= 500) return `Erro no servidor do painel (HTTP ${r.status})`;
  if (r.status && r.status >= 200 && r.status < 400) return `Respondeu HTTP ${r.status} mas não é resposta Xtream válida`;
  if (r.error) return classifyError(r.error);
  return "Sem resposta";
}

function interpretResults(d: ProbeResponse): string {
  const results = d.results;
  const all = (pred: (r: ProbeResult) => boolean) => results.length > 0 && results.every(pred);
  const any = (pred: (r: ProbeResult) => boolean) => results.some(pred);

  if (any((r) => r.is_xtream && (r.auth === 1 || r.auth === "1"))) {
    return "✅ Painel está OK e respondendo como Xtream válido. Credenciais aceitas. Se o app continua sem carregar, o problema é específico do cliente (rede do usuário, codec, ou conta IPTV expirada).";
  }
  if (all((r) => (r.body_preview || "").toLowerCase().includes("account") && (r.body_preview || "").toLowerCase().includes("suspend"))) {
    return "❌ A conta da hospedagem do painel foi SUSPENSA. O servidor retorna 'account suspended' para qualquer requisição, de qualquer IP, em todas as variantes (HTTP/HTTPS, com/sem /c/). Não é problema de bloqueio, firewall ou credencial — é desativação na origem.\n\nAções sugeridas:\n  • Verificar status da conta no datacenter/revenda do painel\n  • Possível takedown por denúncia\n  • Migrar usuários para nova URL/DNS";
  }
  if (all((r) => r.status === 444)) {
    return "❌ Todas as variantes retornaram HTTP 444 (Cloudflare fechou conexão sem resposta). Geralmente indica conta suspensa, WAF bloqueando, ou origin server desligado. O painel não está atendendo ninguém.";
  }
  if (all((r) => r.status === 404)) {
    return "⚠️ Todas as variantes retornaram HTTP 404. Duas leituras possíveis:\n  (a) O painel está vivo mas o endpoint Xtream (/player_api.php) não existe nesse caminho — confirmar URL correta com a revenda.\n  (b) O painel está bloqueando ATIVAMENTE nosso range de IPs (datacenter) e devolvendo 404 como resposta de bloqueio. Se o painel funciona em IPs residenciais brasileiros mas não no nosso, é esse caso.";
  }
  if (all((r) => /reset by peer|os error 104/i.test(r.error || ""))) {
    return "❌ Todas as conexões foram CORTADAS pelo servidor (Reset by peer). Indica filtro anti-datacenter ativo no painel — ele aceita conexões de IPs residenciais mas bloqueia ranges de cloud (Supabase, AWS, GCP, Cloudflare). Painel está vivo, mas inacessível pra qualquer backend serverless.";
  }
  if (all((r) => /timeout|timed out/i.test(r.error || ""))) {
    return "❌ Todas as variantes deram TIMEOUT. Servidor não respondeu no prazo. Pode estar offline, sobrecarregado ou com firewall silencioso (DROP).";
  }
  if (all((r) => /refused|os error 111/i.test(r.error || ""))) {
    return "❌ Conexão recusada em todas as portas. Servidor desligado ou serviço HTTP/HTTPS parado.";
  }
  if (any((r) => r.status === 401 || r.status === 403)) {
    return "⚠️ Painel respondeu mas exige autenticação válida (401/403). O servidor está vivo mas as credenciais testadas não foram aceitas, OU o IP de origem está bloqueado por ACL.";
  }
  if (any((r) => r.status && r.status >= 200 && r.status < 400)) {
    return "⚠️ Painel respondeu com sucesso (2xx/3xx) mas resposta não é um Xtream válido. URL pode estar correta, porém o serviço não é compatível com o protocolo Xtream Codes esperado pelo webplayer.";
  }
  return "⚠️ Resultado misto. Veja o detalhamento por variante acima — algumas portas/protocolos respondem e outras não. Pode indicar painel parcialmente disponível ou bloqueio seletivo.";
}

function buildReport(d: ProbeResponse, label: string | null | undefined): string {
  const now = new Date();
  const tzMin = -now.getTimezoneOffset();
  const tzSign = tzMin >= 0 ? "+" : "-";
  const tzAbs = Math.abs(tzMin);
  const tzStr = `UTC${tzSign}${pad(Math.floor(tzAbs / 60))}:${pad(tzAbs % 60)}`;

  const sep = "═".repeat(55);
  const sub = "─".repeat(55);

  const lines: string[] = [];
  lines.push(sep);
  lines.push("RELATÓRIO DE DIAGNÓSTICO DE SERVIDOR IPTV");
  lines.push(sep);
  lines.push("");
  lines.push(`Data/Hora do teste : ${fmtTimestamp(now)} (${tzStr})`);
  lines.push(`Servidor testado   : ${d.server_url}`);
  if (label) lines.push(`Identificação      : ${label}`);
  lines.push(`URL normalizada    : ${d.normalized}`);
  lines.push(`Origem do teste    : Backend Lovable Cloud (datacenter, IPv4)`);
  lines.push("");
  lines.push(sub);
  lines.push("RESULTADO RESUMIDO");
  lines.push(sub);
  if (d.best_variant) {
    lines.push(`Status geral       : ✅ RESPONDEU`);
    lines.push(`Melhor variante    : ${d.best_variant}`);
    if (d.best_status != null) lines.push(`Melhor HTTP status : ${d.best_status}`);
  } else {
    lines.push(`Status geral       : ❌ NENHUMA VARIANTE RESPONDEU OK`);
  }
  lines.push(`Variantes testadas : ${d.tested_variants}`);
  lines.push(`Timeout por teste  : ${d.timeout_ms}ms`);
  lines.push("");
  lines.push(sub);
  lines.push("DETALHAMENTO POR VARIANTE");
  lines.push(sub);
  d.results.forEach((r, idx) => {
    lines.push("");
    lines.push(`[${idx + 1}] ${r.variant}`);
    lines.push(`    HTTP Status   : ${r.status ?? "—"}`);
    lines.push(`    Latência      : ${r.latency_ms}ms`);
    lines.push(`    Xtream válido : ${r.is_xtream ? "sim" : "não"}`);
    if (r.auth !== null && r.auth !== undefined) lines.push(`    auth=         : ${r.auth}`);
    if (r.error) lines.push(`    Erro técnico  : ${r.error.length > 200 ? r.error.slice(0, 200) + "…" : r.error}`);
    lines.push(`    Diagnóstico   : ${diagnoseVariant(r)}`);
    if (r.body_preview) {
      const preview = r.body_preview.length > 150 ? r.body_preview.slice(0, 150) + "…" : r.body_preview;
      lines.push(`    Resposta      : "${preview.replace(/\n/g, " ")}"`);
    }
  });
  lines.push("");
  lines.push(sub);
  lines.push("INTERPRETAÇÃO");
  lines.push(sub);
  lines.push(interpretResults(d));
  lines.push("");
  lines.push(sep);
  lines.push("Gerado por: Webplayer Admin");
  lines.push(sep);

  return lines.join("\n");
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

  const handleCopyReport = async () => {
    if (!data) return;
    const text = buildReport(data, serverLabel);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Relatório copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar. Use 'Baixar .txt' como alternativa.");
    }
  };

  const handleDownloadReport = () => {
    if (!data) return;
    const text = buildReport(data, serverLabel);
    let host = "servidor";
    try {
      host = new URL(data.normalized).hostname.replace(/[^a-z0-9.-]/gi, "_");
    } catch {
      /* ignore */
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `diagnostico-${host}-${ts}.txt`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Relatório salvo: ${filename}`);
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

        <DialogFooter className="gap-2 flex-wrap sm:flex-nowrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadReport}
            disabled={loading || !data}
            title="Baixar relatório como arquivo .txt"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar .txt
          </Button>
          <Button
            variant="secondary"
            onClick={handleCopyReport}
            disabled={loading || !data}
            title="Copiar relatório para enviar à revenda"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar relatório
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
