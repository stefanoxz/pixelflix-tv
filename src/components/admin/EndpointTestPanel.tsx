import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Globe,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Activity,
  Wrench,
  ArrowRight,
  Lightbulb,
  Link2,
  Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseM3uUrl } from "@/lib/parseM3uUrl";

type Route = "direct" | "proxy" | null;

interface XtreamInfo {
  auth: number | string | null;
  status: string | null;
  exp_date: string | null;
  active_cons: number | null;
  max_connections: number | null;
  created_at: string | null;
  is_trial: string | null;
  username: string | null;
}

interface Probe {
  name: string;
  url: string;
  method: "GET" | "HEAD";
  route: Route;
  status: number | null;
  status_text: string | null;
  latency_ms: number;
  headers: Record<string, string>;
  body_size: number;
  body_preview: string;
  error: string | null;
  meta?: Record<string, unknown>;
}

interface RouteComparison {
  direct: { status: number | null; latency_ms: number; error: string | null };
  proxy: { status: number | null; latency_ms: number; error: string | null } | null;
}

interface Verdict {
  level: "ok" | "warn" | "error";
  code: string;
  message: string;
}

interface TestResult {
  // legados
  target: string;
  method: "GET" | "HEAD";
  route: Route;
  proxy_configured: boolean;
  ok: boolean;
  status: number | null;
  status_text: string | null;
  latency_ms: number;
  is_xtream: boolean;
  auth: number | string | null;
  body_preview: string;
  error: string | null;
  // novos
  mode?: "quick" | "full";
  verdict?: Verdict;
  xtream?: XtreamInfo | null;
  probes?: Probe[];
  route_comparison?: RouteComparison | null;
}

interface Props {
  allowedServers: { server_url: string; label?: string | null }[];
}

const PROBE_LABELS: Record<string, string> = {
  root: "Raiz HTTP",
  auth: "player_api.php (auth)",
  live_categories: "Categorias Live",
  vod_categories: "Categorias VOD",
  series_categories: "Categorias Séries",
  stream_head: "Stream (HEAD)",
};

function RouteBadge({ route }: { route: Route }) {
  if (route === "proxy") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-warning/15 text-warning border border-warning/30">
        <ShieldCheck className="h-3 w-3" /> Proxy
      </span>
    );
  }
  if (route === "direct") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-success/15 text-success border border-success/30">
        <Globe className="h-3 w-3" /> Direto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-destructive/15 text-destructive border border-destructive/30">
      <XCircle className="h-3 w-3" /> —
    </span>
  );
}

function StatusPill({ status, error }: { status: number | null; error: string | null }) {
  if (status === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-destructive/15 text-destructive border border-destructive/30">
        <XCircle className="h-3 w-3" /> {error ? "Falha" : "Sem resposta"}
      </span>
    );
  }
  if (status >= 200 && status < 300) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-success/15 text-success border border-success/30">
        <CheckCircle2 className="h-3 w-3" /> {status}
      </span>
    );
  }
  if (status === 401 || status === 403) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-warning/15 text-warning border border-warning/30">
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-destructive/15 text-destructive border border-destructive/30">
      {status}
    </span>
  );
}

function VerdictCard({ verdict }: { verdict: Verdict }) {
  const cfg =
    verdict.level === "ok"
      ? { icon: CheckCircle2, cls: "bg-success/10 border-success/40 text-success", label: "Saudável" }
      : verdict.level === "warn"
      ? { icon: AlertTriangle, cls: "bg-warning/10 border-warning/40 text-warning", label: "Atenção" }
      : { icon: XCircle, cls: "bg-destructive/10 border-destructive/40 text-destructive", label: "Falha" };
  const Icon = cfg.icon;
  return (
    <div className={cn("rounded-lg border p-4 flex items-start gap-3", cfg.cls)}>
      <Icon className="h-5 w-5 mt-0.5 shrink-0" />
      <div className="space-y-1">
        <div className="text-sm font-semibold">{cfg.label}</div>
        <div className="text-sm">{verdict.message}</div>
        <code className="text-[10px] opacity-70 font-mono">code: {verdict.code}</code>
      </div>
    </div>
  );
}

function ProbeRow({ probe }: { probe: Probe }) {
  const [open, setOpen] = useState(false);
  const meta = probe.meta as Record<string, unknown> | undefined;
  const count = meta?.count as number | undefined;
  return (
    <div className="border border-border/50 rounded-md bg-muted/20">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/30 rounded-md transition-colors cursor-pointer select-none"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-sm font-medium flex-1 truncate">
          {PROBE_LABELS[probe.name] ?? probe.name}
          {count !== undefined && <span className="text-muted-foreground ml-2 text-xs">({count} itens)</span>}
        </span>
        <RouteBadge route={probe.route} />
        <StatusPill status={probe.status} error={probe.error} />
        <span className="text-xs text-muted-foreground tabular-nums w-14 text-right">
          {probe.latency_ms}ms
        </span>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 text-xs border-t border-border/40">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">URL</Label>
            <code className="block font-mono bg-background/60 px-2 py-1 rounded break-all">
              {probe.method} {probe.url}
            </code>
          </div>
          {probe.error && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-destructive">Erro</Label>
              <code className="block font-mono bg-destructive/10 text-destructive px-2 py-1 rounded break-all">
                {probe.error}
              </code>
            </div>
          )}
          {Object.keys(probe.headers).length > 0 && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Headers</Label>
              <div className="font-mono bg-background/60 px-2 py-1 rounded space-y-0.5">
                {Object.entries(probe.headers).map(([k, v]) => (
                  <div key={k} className="break-all">
                    <span className="text-muted-foreground">{k}:</span> {v}
                  </div>
                ))}
              </div>
            </div>
          )}
          {probe.body_size > 0 && (
            <div className="text-muted-foreground">
              Tamanho do corpo: <span className="tabular-nums">{probe.body_size.toLocaleString()} bytes</span>
            </div>
          )}
          {probe.body_preview && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Preview</Label>
              <pre className="font-mono bg-background/60 px-2 py-1 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-32">
                {probe.body_preview}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function XtreamCard({ x }: { x: XtreamInfo }) {
  const expMs = x.exp_date ? Number(x.exp_date) * 1000 : null;
  const expired = expMs !== null && Number.isFinite(expMs) && expMs < Date.now();
  const expDate = expMs && Number.isFinite(expMs) ? new Date(expMs).toLocaleDateString("pt-BR") : "—";
  const createdMs = x.created_at ? Number(x.created_at) * 1000 : null;
  const createdDate = createdMs && Number.isFinite(createdMs)
    ? new Date(createdMs).toLocaleDateString("pt-BR")
    : "—";
  const conns = x.max_connections != null
    ? `${x.active_cons ?? 0} / ${x.max_connections}`
    : x.active_cons != null ? String(x.active_cons) : "—";
  return (
    <Card className="p-4 bg-gradient-card border-border/50 space-y-2">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm">Conta Xtream</h4>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">Usuário</dt>
        <dd className="font-mono truncate">{x.username ?? "—"}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <span className={cn(
            "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border",
            (x.status ?? "").toLowerCase() === "active"
              ? "bg-success/15 text-success border-success/30"
              : "bg-destructive/15 text-destructive border-destructive/30",
          )}>
            {x.status ?? "—"}
          </span>
        </dd>
        <dt className="text-muted-foreground">Auth</dt>
        <dd className="font-mono">{String(x.auth ?? "—")}</dd>
        <dt className="text-muted-foreground">Trial</dt>
        <dd className="font-mono">{x.is_trial ?? "—"}</dd>
        <dt className="text-muted-foreground">Conexões</dt>
        <dd className="font-mono tabular-nums">{conns}</dd>
        <dt className="text-muted-foreground">Criada em</dt>
        <dd className="font-mono">{createdDate}</dd>
        <dt className="text-muted-foreground">Expira em</dt>
        <dd className={cn("font-mono", expired && "text-destructive font-semibold")}>
          {expDate}{expired && " (expirada)"}
        </dd>
      </dl>
    </Card>
  );
}

function RouteComparisonCard({ rc }: { rc: RouteComparison }) {
  const cell = (label: string, data: { status: number | null; latency_ms: number; error: string | null } | null) => (
    <div className="flex-1 p-3 rounded-md bg-background/40 border border-border/40 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <StatusPill status={data?.status ?? null} error={data?.error ?? null} />
      </div>
      <div className="text-2xl font-bold tabular-nums">
        {data ? `${data.latency_ms}` : "—"}
        <span className="text-xs text-muted-foreground font-normal ml-1">ms</span>
      </div>
      {data?.error && (
        <div className="text-[10px] text-destructive font-mono break-all line-clamp-2">{data.error}</div>
      )}
    </div>
  );
  return (
    <Card className="p-4 bg-gradient-card border-border/50 space-y-3">
      <h4 className="font-semibold text-sm">Comparativo Direto vs Proxy</h4>
      <div className="flex gap-2">
        {cell("Direto", rc.direct)}
        {cell("Proxy", rc.proxy)}
      </div>
      <p className="text-[10px] text-muted-foreground">
        HEAD em paralelo no mesmo endpoint. Se direto falhou e proxy passou, é forte indício de bloqueio geográfico.
      </p>
    </Card>
  );
}

function buildReport(r: TestResult): string {
  const lines: string[] = [];
  lines.push(`=== Diagnóstico de Endpoint IPTV ===`);
  lines.push(`URL: ${r.target}`);
  lines.push(`Modo: ${r.mode ?? "—"}`);
  if (r.verdict) lines.push(`Veredito: [${r.verdict.level.toUpperCase()}] ${r.verdict.code} — ${r.verdict.message}`);
  lines.push("");
  if (r.xtream) {
    lines.push(`-- Conta Xtream --`);
    lines.push(`  user=${r.xtream.username} status=${r.xtream.status} auth=${r.xtream.auth}`);
    lines.push(`  conexões=${r.xtream.active_cons ?? "?"}/${r.xtream.max_connections ?? "?"}`);
    if (r.xtream.exp_date) {
      const ms = Number(r.xtream.exp_date) * 1000;
      lines.push(`  expira=${Number.isFinite(ms) ? new Date(ms).toISOString() : r.xtream.exp_date}`);
    }
    lines.push("");
  }
  if (r.probes) {
    lines.push(`-- Sondas --`);
    for (const p of r.probes) {
      lines.push(`  [${p.name}] ${p.method} ${p.route ?? "fail"} ${p.status ?? "ERR"} ${p.latency_ms}ms${p.error ? " err=" + p.error : ""}`);
    }
    lines.push("");
  }
  if (r.route_comparison) {
    const d = r.route_comparison.direct;
    const p = r.route_comparison.proxy;
    lines.push(`-- Comparativo --`);
    lines.push(`  direto: ${d.status ?? "ERR"} ${d.latency_ms}ms${d.error ? " err=" + d.error : ""}`);
    if (p) lines.push(`  proxy:  ${p.status ?? "ERR"} ${p.latency_ms}ms${p.error ? " err=" + p.error : ""}`);
  }
  return lines.join("\n");
}

interface ResolveCandidate {
  base: string;
  scheme: "http" | "https";
  port: string;
  label: string;
  status: number | null;
  latency_ms: number;
  route: "direct" | "proxy" | null;
  is_xtream: boolean;
  xtream_auth: number | string | null;
  xtream_status: string | null;
  error: string | null;
  score: number;
}

interface ResolveResult {
  original: { scheme: string; port: string; base: string };
  variants_tested: number;
  candidates: ResolveCandidate[];
  best: { base: string; scheme: string; port: string; score: number } | null;
  suggestions: string[];
  proxy_configured: boolean;
}

export function EndpointTestPanel({ allowedServers }: Props) {
  const [pasteUrl, setPasteUrl] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [path, setPath] = useState("/player_api.php");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"GET" | "HEAD">("GET");
  const [mode, setMode] = useState<"quick" | "full">("full");
  const [testStream, setTestStream] = useState(true);
  const [compareRoutes, setCompareRoutes] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveResult, setResolveResult] = useState<ResolveResult | null>(null);

  const applyPastedUrl = (raw?: string) => {
    const input = (raw ?? pasteUrl).trim();
    if (!input) {
      toast.error("Cole uma URL primeiro");
      return;
    }
    if (input.length > 2000) {
      toast.error("URL muito longa");
      return;
    }
    const parsed = parseM3uUrl(input);
    if (!parsed) {
      toast.error("Formato não reconhecido (esperado get.php, player_api.php, /playlist/u/p ou /live/u/p/id)");
      return;
    }
    setServerUrl(parsed.server);
    setUsername(parsed.username);
    setPassword(parsed.password);
    if (parsed.path) setPath(parsed.path);
    setPasteUrl("");
    toast.success(`Extraído: ${parsed.server} (user: ${parsed.username})`);
  };

  const pasteFromClipboard = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (!txt) {
        toast.error("Área de transferência vazia");
        return;
      }
      setPasteUrl(txt);
      applyPastedUrl(txt);
    } catch {
      toast.error("Sem permissão para ler a área de transferência");
    }
  };

  const run = async () => {
    if (!serverUrl.trim()) {
      toast.error("Informe a URL do servidor");
      return;
    }
    setLoading(true);
    setResult(null);
    setResolveResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<TestResult>("admin-api", {
        body: {
          action: "test_endpoint",
          payload: {
            server_url: serverUrl.trim(),
            path: path.trim() || "/player_api.php",
            username: username.trim(),
            password: password.trim(),
            method,
            mode,
            test_stream: testStream && Boolean(username.trim() && password.trim()),
            compare_routes: compareRoutes,
            timeout_ms: 8000,
          },
        },
      });
      if (error) throw error;
      if (!data) throw new Error("Resposta vazia");
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao testar endpoint";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resolve = async () => {
    if (!serverUrl.trim()) return;
    setResolving(true);
    setResolveResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<ResolveResult>("admin-api", {
        body: {
          action: "resolve_endpoint",
          payload: {
            server_url: serverUrl.trim(),
            username: username.trim(),
            password: password.trim(),
            failure_code: result?.verdict?.code ?? "",
          },
        },
      });
      if (error) throw error;
      if (!data) throw new Error("Resposta vazia");
      setResolveResult(data);
      if (data.best) {
        toast.success(`Encontrada alternativa funcional: ${data.best.base}`);
      } else if (data.candidates.length > 0) {
        toast.info(`${data.candidates.length} variantes responderam — verifique os candidatos.`);
      } else {
        toast.warning("Nenhuma variante respondeu.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao tentar resolver";
      toast.error(msg);
    } finally {
      setResolving(false);
    }
  };

  const applyCandidate = (base: string) => {
    setServerUrl(base);
    setResolveResult(null);
    toast.success("URL aplicada — clique em 'Executar diagnóstico' para revalidar.");
  };

  const copyReport = async () => {
    if (!result) return;
    try {
      const base = buildReport(result);
      const extra = resolveResult
        ? "\n\n-- Tentativa de resolução --\n" +
          `Variantes testadas: ${resolveResult.variants_tested}\n` +
          (resolveResult.best ? `Melhor: ${resolveResult.best.base} (score ${resolveResult.best.score})\n` : "Nenhum candidato funcional.\n") +
          resolveResult.suggestions.map((s) => `• ${s}`).join("\n")
        : "";
      await navigator.clipboard.writeText(base + extra);
      toast.success("Relatório copiado");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
        <div>
          <h3 className="font-semibold text-base">Diagnóstico de endpoint IPTV</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Roda múltiplas sondas (raiz, auth Xtream, categorias, stream e comparativo direto vs proxy)
            e gera um veredito sobre a saúde do servidor.
          </p>
        </div>

        <div className="space-y-1.5 p-3 rounded-md bg-primary/5 border border-primary/20">
          <Label htmlFor="paste-url" className="flex items-center gap-1.5 text-xs">
            <Link2 className="h-3.5 w-3.5 text-primary" />
            Colar URL M3U / Xtream (opcional)
          </Label>
          <div className="flex gap-2">
            <Input
              id="paste-url"
              placeholder="http://servidor.com/get.php?username=...&password=..."
              value={pasteUrl}
              maxLength={2000}
              onChange={(e) => setPasteUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyPastedUrl();
                }
              }}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => applyPastedUrl()}
              disabled={!pasteUrl.trim()}
            >
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              Extrair
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pasteFromClipboard}
              title="Colar da área de transferência"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Aceita: <code>get.php</code>, <code>player_api.php</code>, <code>/playlist/u/p</code>, <code>/live/u/p/id.ts</code>. Servidor, usuário, senha e caminho serão preenchidos automaticamente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="test-server">Servidor</Label>
            {allowedServers.length > 0 ? (
              <Select value={serverUrl} onValueChange={(v) => setServerUrl(v)}>
                <SelectTrigger id="test-server">
                  <SelectValue placeholder="Selecione uma DNS cadastrada…" />
                </SelectTrigger>
                <SelectContent>
                  {allowedServers.map((s) => (
                    <SelectItem key={s.server_url} value={s.server_url}>
                      {s.label ? `${s.label} — ` : ""}
                      {s.server_url}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="test-server"
                placeholder="http://exemplo.com:8080"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="test-path">Caminho (sonda principal)</Label>
            <Input
              id="test-path"
              placeholder="/player_api.php"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="test-user">Usuário (opcional)</Label>
            <Input
              id="test-user"
              placeholder="user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="test-pass">Senha (opcional)</Label>
            <Input
              id="test-pass"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="test-method">Método (sonda principal)</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as "GET" | "HEAD")}>
              <SelectTrigger id="test-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="HEAD">HEAD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="test-mode">Profundidade</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "quick" | "full")}>
              <SelectTrigger id="test-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quick">Rápido (apenas auth)</SelectItem>
                <SelectItem value="full">Completo (auth + categorias + stream)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
          <label className="flex items-center justify-between gap-3 p-2 rounded bg-muted/20">
            <div>
              <div className="text-sm font-medium">Testar entrega de stream</div>
              <div className="text-xs text-muted-foreground">HEAD no 1º canal — requer usuário/senha</div>
            </div>
            <Switch
              checked={testStream}
              onCheckedChange={setTestStream}
              disabled={!username.trim() || !password.trim()}
            />
          </label>
          <label className="flex items-center justify-between gap-3 p-2 rounded bg-muted/20">
            <div>
              <div className="text-sm font-medium">Comparar direto vs proxy</div>
              <div className="text-xs text-muted-foreground">
                Roda os dois em paralelo para detectar geo-block
              </div>
            </div>
            <Switch checked={compareRoutes} onCheckedChange={setCompareRoutes} />
          </label>
        </div>

        <Button onClick={run} disabled={loading} className="w-full">
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Diagnosticando…</>
          ) : (
            <><Send className="h-4 w-4 mr-2" />Executar diagnóstico</>
          )}
        </Button>

        {result && !result.proxy_configured && (
          <p className="text-xs text-muted-foreground">
            ⓘ Sem proxy configurado. Diagnóstico mostra apenas a rota direta.
          </p>
        )}
      </Card>

      {result && (
        <div className="space-y-3">
          {result.verdict && <VerdictCard verdict={result.verdict} />}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {result.proxy_configured ? "Proxy configurado ✓" : "Sem proxy configurado"}
              <span>•</span>
              <span>modo: <code>{result.mode ?? "—"}</code></span>
            </div>
            <div className="flex items-center gap-2">
              {result.verdict && result.verdict.level !== "ok" && (
                <Button size="sm" variant="default" onClick={resolve} disabled={resolving}>
                  {resolving ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Investigando…</>
                  ) : (
                    <><Wrench className="h-3.5 w-3.5 mr-1.5" />Tentar resolver</>
                  )}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={copyReport}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copiar relatório
              </Button>
            </div>
          </div>

          {resolveResult && (
            <Card className="p-4 bg-gradient-card border-border/50 space-y-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Resolução automática</h4>
                <span className="text-xs text-muted-foreground ml-auto">
                  {resolveResult.variants_tested} variantes testadas
                </span>
              </div>

              {resolveResult.suggestions.length > 0 && (
                <div className="space-y-1.5">
                  {resolveResult.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/30">
                      <Lightbulb className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {resolveResult.candidates.length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Candidatos funcionais (ordenados por qualidade)
                  </Label>
                  {resolveResult.candidates.slice(0, 8).map((c, i) => {
                    const isBest = i === 0;
                    const isAuthOk = c.is_xtream && (c.xtream_auth === 1 || c.xtream_auth === "1");
                    return (
                      <div
                        key={`${c.base}-${i}`}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded border text-xs",
                          isBest
                            ? "border-success/40 bg-success/5"
                            : "border-border/40 bg-muted/20",
                        )}
                      >
                        <code className="font-mono flex-1 truncate">{c.base}</code>
                        <RouteBadge route={c.route} />
                        <StatusPill status={c.status} error={c.error} />
                        {isAuthOk && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-success/15 text-success border border-success/30">
                            Xtream ✓
                          </span>
                        )}
                        <span className="text-muted-foreground tabular-nums w-12 text-right">
                          {c.latency_ms}ms
                        </span>
                        <Button
                          size="sm"
                          variant={isBest ? "default" : "outline"}
                          className="h-6 px-2 text-[10px]"
                          onClick={() => applyCandidate(c.base)}
                        >
                          Aplicar
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-3 rounded bg-muted/20 text-center">
                  Nenhuma variante respondeu. Servidor parece totalmente offline para esta região.
                </div>
              )}
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {result.xtream && <XtreamCard x={result.xtream} />}
            {result.route_comparison && <RouteComparisonCard rc={result.route_comparison} />}
          </div>

          {result.probes && result.probes.length > 0 && (
            <Card className="p-4 bg-gradient-card border-border/50 space-y-2">
              <h4 className="font-semibold text-sm">Sondas executadas</h4>
              <div className="space-y-1.5">
                {result.probes.map((p, i) => (
                  <ProbeRow key={`${p.name}-${i}`} probe={p} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
