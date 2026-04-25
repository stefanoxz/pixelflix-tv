import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TestResult {
  target: string;
  method: "GET" | "HEAD";
  route: "direct" | "proxy" | null;
  proxy_configured: boolean;
  ok: boolean;
  status: number | null;
  status_text: string | null;
  latency_ms: number;
  is_xtream: boolean;
  auth: number | string | null;
  body_preview: string;
  error: string | null;
}

interface Props {
  /** Lista de DNS cadastradas para sugerir no campo. */
  allowedServers: { server_url: string; label?: string | null }[];
}

function RouteBadge({ route }: { route: "direct" | "proxy" | null }) {
  if (route === "proxy") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-warning/15 text-warning border border-warning/30">
        <ShieldCheck className="h-3.5 w-3.5" />
        Via PROXY
      </span>
    );
  }
  if (route === "direct") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-success/15 text-success border border-success/30">
        <Globe className="h-3.5 w-3.5" />
        DIRETO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-destructive/15 text-destructive border border-destructive/30">
      <XCircle className="h-3.5 w-3.5" />
      Sem rota
    </span>
  );
}

function StatusBadge({ result }: { result: TestResult }) {
  if (result.is_xtream) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-success/15 text-success border border-success/30">
        <CheckCircle2 className="h-3 w-3" /> Xtream OK
      </span>
    );
  }
  if (result.status == null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-destructive/15 text-destructive border border-destructive/30">
        <XCircle className="h-3 w-3" /> Falhou
      </span>
    );
  }
  if (result.status >= 200 && result.status < 300) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-success/15 text-success border border-success/30">
        HTTP {result.status}
      </span>
    );
  }
  if (result.status === 401) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-warning/15 text-warning border border-warning/30">
        HTTP 401 (vivo, sem auth)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-warning/15 text-warning border border-warning/30">
      HTTP {result.status}
    </span>
  );
}

export function EndpointTestPanel({ allowedServers }: Props) {
  const [serverUrl, setServerUrl] = useState("");
  const [path, setPath] = useState("/player_api.php");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"GET" | "HEAD">("GET");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const run = async () => {
    if (!serverUrl.trim()) {
      toast.error("Informe a URL do servidor");
      return;
    }
    setLoading(true);
    setResult(null);
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

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
        <div>
          <h3 className="font-semibold text-base">Testar endpoint IPTV</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Faz uma requisição real usando o pipeline do app (proxiedFetch). Mostra qual rota foi
            usada — <strong>direto</strong> (IP do Supabase) ou <strong>proxy</strong> (fallback
            geo-localizado).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="test-server">Servidor</Label>
            {allowedServers.length > 0 ? (
              <Select
                value={serverUrl}
                onValueChange={(v) => setServerUrl(v)}
              >
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
            <Label htmlFor="test-path">Caminho</Label>
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
            <Label htmlFor="test-method">Método</Label>
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

          <div className="flex items-end">
            <Button onClick={run} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testando…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar requisição
                </>
              )}
            </Button>
          </div>
        </div>

        {!result?.proxy_configured && (
          <p className="text-xs text-muted-foreground">
            ⓘ Nenhum proxy configurado (<code>IPTV_PROXY_URL</code>). Todas as requisições saem
            diretamente do IP do Supabase. Para habilitar fallback automático, configure o secret.
          </p>
        )}
      </Card>

      {result && (
        <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <RouteBadge route={result.route} />
              <StatusBadge result={result} />
              <span className="text-xs text-muted-foreground tabular-nums">
                {result.latency_ms}ms
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {result.proxy_configured ? "Proxy configurado ✓" : "Sem proxy configurado"}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">URL chamada</Label>
            <code className="block text-xs font-mono bg-muted/40 px-3 py-2 rounded border border-border/50 break-all">
              {result.method} {result.target}
            </code>
          </div>

          {result.error && (
            <div className="space-y-1">
              <Label className="text-xs text-destructive">Erro</Label>
              <code className="block text-xs font-mono bg-destructive/10 text-destructive px-3 py-2 rounded border border-destructive/30 break-all">
                {result.error}
              </code>
            </div>
          )}

          {result.is_xtream && (
            <p className="text-xs text-success">
              Resposta Xtream válida (auth = {String(result.auth)})
            </p>
          )}

          {result.body_preview && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Preview do corpo (primeiros 500 chars)
              </Label>
              <pre className="text-xs font-mono bg-muted/40 px-3 py-2 rounded border border-border/50 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
                {result.body_preview}
              </pre>
            </div>
          )}

          <div className="text-xs text-muted-foreground border-t border-border/50 pt-3">
            <strong>Como interpretar a rota:</strong>{" "}
            <span className="text-success font-medium">DIRETO</span> = chegou pelo IP do Supabase
            (servidor não bloqueia geo). <span className="text-warning font-medium">PROXY</span>{" "}
            = direto falhou e o fallback resolveu (servidor estava bloqueando geo).
          </div>
        </Card>
      )}
    </div>
  );
}
