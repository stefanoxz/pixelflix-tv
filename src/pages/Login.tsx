import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, KeyRound, UserIcon, Link2, AlertCircle } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIptv } from "@/context/IptvContext";
// O cliente IPTV (~1.873 linhas) é carregado sob demanda quando o usuário
// envia o formulário — fora do bundle inicial do /login.
import { preloadSync } from "@/App";
const loadIptvClient = () => import("@/services/iptv");
type IptvClient = typeof import("@/services/iptv");
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseM3uUrl } from "@/lib/parseM3uUrl";
import { cn } from "@/lib/utils";
const logoSuperTech = "/logo-supertech.webp";

// ---------------------------------------------------------------------------
// Schemas de validação (zod). Aplicados client-side antes de chamar a edge.
// Limites alinhados com os `maxLength` dos inputs. A edge `iptv-login` ainda
// valida do lado servidor (defense-in-depth).
// ---------------------------------------------------------------------------
const credsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, { message: "Informe o usuário" })
    .max(120, { message: "Usuário muito longo (máx. 120)" })
    .regex(/^\S+$/, { message: "Usuário não pode conter espaços" }),
  password: z
    .string()
    .min(1, { message: "Informe a senha" })
    .max(200, { message: "Senha muito longa (máx. 200)" }),
});

const m3uSchema = z
  .string()
  .trim()
  .min(1, { message: "Cole a URL M3U" })
  .max(2000, { message: "URL muito longa (máx. 2000 caracteres)" })
  .refine(
    (v) => /^https?:\/\//i.test(v) || /[a-z0-9.-]+\.[a-z]{2,}/i.test(v),
    { message: "URL precisa conter um endereço (ex.: http://servidor.com/...)" },
  );

type FieldErrors = {
  username?: string;
  password?: string;
  m3u?: string;
};

const Login = () => {
  const navigate = useNavigate();
  const { setSession } = useIptv();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  /** Núcleo do login: recebe creds já parseadas e roda o fluxo padrão. */
  const performLogin = async (
    serverArg: string | undefined,
    user: string,
    pass: string,
  ) => {
    setLoading(true);
    try {
      // Carrega cliente IPTV e prefetch do bundle de Sync em paralelo —
      // quando navegar para /sync o chunk já estará pronto.
      preloadSync();
      const iptv = await loadIptvClient();
      const data = await iptv.iptvLogin({
        server: serverArg,
        username: user,
        password: pass,
      });
      const resolvedServer = data.server_url ?? serverArg ?? "";
      const streamBase = iptv.resolveStreamBase(
        data.server_info,
        resolvedServer,
        data.allowed_servers,
      );

      const { data: cur } = await supabase.auth.getSession();
      if (!cur.session) {
        const { error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr) throw new Error("Falha ao iniciar sessão segura");
      }

      setSession({
        creds: {
          server: resolvedServer,
          username: user,
          password: pass,
          streamBase,
        },
        userInfo: data.user_info,
        serverInfo: data.server_info,
      });
      toast.success(`Bem-vindo, ${data.user_info.username}!`);
      maybeWarnConnectionLimit(data);
      navigate("/sync");
    } catch (err) {
      handleLoginError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCreds = async (e: FormEvent) => {
    e.preventDefault();
    const result = credsSchema.safeParse({ username, password });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      // Foca o primeiro campo inválido pra acessibilidade.
      const firstInvalid = (fieldErrors.username && "username") || (fieldErrors.password && "password");
      if (firstInvalid) {
        document.getElementById(firstInvalid)?.focus();
      }
      return;
    }
    setErrors({});
    await performLogin(undefined, result.data.username, result.data.password);
  };

  const handleSubmitM3u = async (e: FormEvent) => {
    e.preventDefault();
    const basic = m3uSchema.safeParse(m3uUrl);
    if (!basic.success) {
      setErrors({ m3u: basic.error.issues[0]?.message ?? "URL inválida" });
      document.getElementById("m3u")?.focus();
      return;
    }
    const parsed = parseM3uUrl(basic.data);
    if (!parsed) {
      setErrors({
        m3u: "Não foi possível extrair usuário/senha. Use o formato get.php?username=…&password=… ou /playlist/usuario/senha",
      });
      document.getElementById("m3u")?.focus();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const data = await iptvLoginM3u({
        server: parsed.server,
        username: parsed.username,
        password: parsed.password,
      });
      const resolvedServer = data.server_url ?? parsed.server;
      const streamBase = resolveStreamBase(
        data.server_info,
        resolvedServer,
        data.allowed_servers,
      );

      const { data: cur } = await supabase.auth.getSession();
      if (!cur.session) {
        const { error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr) throw new Error("Falha ao iniciar sessão segura");
      }

      setSession({
        creds: {
          server: resolvedServer,
          username: parsed.username,
          password: parsed.password,
          streamBase,
        },
        userInfo: data.user_info,
        serverInfo: data.server_info,
      });
      if (data.auto_registered) {
        toast.success(`Bem-vindo, ${data.user_info.username}! Servidor cadastrado automaticamente.`);
      } else {
        toast.success(`Bem-vindo, ${data.user_info.username}!`);
      }
      maybeWarnConnectionLimit(data);
      navigate("/sync");
    } catch (err) {
      handleLoginError(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mostra erro do login. Se for `IptvLoginError` com `debug` (vindo da edge),
   * inclui um botão "Detalhes técnicos" no toast que copia/loga o body recebido
   * do painel IPTV — facilita diagnosticar DNS que respondem mas em formato
   * inesperado (HTML, M3U cru, JSON sem user_info).
   */
  function handleLoginError(err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    if (err instanceof IptvLoginError && err.debug) {
      const dbg = err.debug as {
        httpStatus?: number;
        contentType?: string | null;
        variant?: string;
        bodyPreview?: string;
        looksLikeHtml?: boolean;
        looksLikeM3u?: boolean;
      };
      console.warn("[Login] erro com debug do painel IPTV:", dbg);
      toast.error(msg, {
        description: `HTTP ${dbg.httpStatus ?? "?"} · ${dbg.contentType ?? "sem content-type"}${
          dbg.looksLikeHtml ? " · HTML" : ""
        }${dbg.looksLikeM3u ? " · M3U" : ""}`,
        duration: 12_000,
        action: {
          label: "Copiar detalhes",
          onClick: () => {
            const txt = JSON.stringify(dbg, null, 2);
            navigator.clipboard?.writeText(txt).catch(() => {});
            toast.success("Detalhes copiados para a área de transferência");
          },
        },
      });
      return;
    }
    toast.error(msg);
  }

  /**
   * Após login bem-sucedido, avisa (sem bloquear) quando a conta está com
   * todas as telas em uso. O painel deixa autenticar mesmo nesse estado, mas
   * tentar abrir streams vai falhar até liberar uma conexão.
   */
  function maybeWarnConnectionLimit(data: {
    at_connection_limit?: boolean;
    user_info?: { active_cons?: string | number; max_connections?: string | number };
  }) {
    if (!data?.at_connection_limit) return;
    const act = data.user_info?.active_cons ?? "?";
    const max = data.user_info?.max_connections ?? "?";
    toast.warning(`Conta com todas as telas em uso (${act}/${max}).`, {
      description:
        "Você pode navegar pelo catálogo, mas streams só vão abrir quando uma conexão liberar. Aguarde alguns minutos ou feche outras telas.",
      duration: 10_000,
    });
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-background">
      {/* Camadas de fundo */}
      <div className="absolute inset-0 bg-gradient-glow opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(214_100%_56%/0.18),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(232_100%_65%/0.12),transparent_55%)]" />

      {/* Blur orbs animados */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-primary/25 blur-3xl animate-blob" />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-[26rem] w-[26rem] rounded-full bg-violet-500/20 blur-3xl animate-blob"
        style={{ animationDelay: "5s" }}
      />
      <div
        className="pointer-events-none absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-rose-500/15 blur-3xl animate-blob"
        style={{ animationDelay: "10s" }}
      />

      {/* Grid sutil de fundo */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <Card className="relative w-full max-w-md p-8 bg-card/70 backdrop-blur-xl border-border/40 shadow-[0_24px_80px_-12px_hsl(222_50%_2%/0.9)] ring-1 ring-white/5 animate-scale-in">
        <div className="text-center mb-6">
          <img
            src={logoSuperTech}
            alt="SuperTech"
            width={80}
            height={80}
            {...({ fetchpriority: "high" } as Record<string, string>)}
            decoding="async"
            className="mx-auto h-20 w-20 object-contain mb-3 drop-shadow-[0_0_28px_hsl(var(--primary)/0.55)] animate-float"
          />
          <h1 className="text-3xl font-bold tracking-tight">
            Super<span className="text-gradient">Tech</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Entre com seu usuário ou cole a URL M3U
          </p>
        </div>

        <Tabs defaultValue="creds" className="w-full">
          <TabsList className="grid grid-cols-2 mb-6 bg-secondary/50">
            <TabsTrigger value="creds" disabled={loading}>
              Usuário e senha
            </TabsTrigger>
            <TabsTrigger value="m3u" disabled={loading}>
              URL M3U
            </TabsTrigger>
          </TabsList>

          <TabsContent value="creds">
            <form onSubmit={handleSubmitCreds} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs">Usuário</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="seu usuário"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errors.username) setErrors((p) => ({ ...p, username: undefined }));
                    }}
                    className={cn(
                      "pl-10 bg-secondary/50 border-border/50 h-11",
                      errors.username && "border-destructive focus-visible:ring-destructive",
                    )}
                    autoComplete="username"
                    maxLength={120}
                    aria-invalid={!!errors.username}
                    aria-describedby={errors.username ? "username-error" : undefined}
                  />
                </div>
                {errors.username && (
                  <p id="username-error" className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.username}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs">Senha</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                    }}
                    className={cn(
                      "pl-10 bg-secondary/50 border-border/50 h-11",
                      errors.password && "border-destructive focus-visible:ring-destructive",
                    )}
                    autoComplete="current-password"
                    maxLength={200}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                  />
                </div>
                {errors.password && (
                  <p id="password-error" className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.password}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-primary hover:opacity-90 shadow-glow font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Conectando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="m3u">
            <form onSubmit={handleSubmitM3u} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="m3u" className="text-xs">URL M3U</Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="m3u"
                    placeholder="http://servidor.com/get.php?username=...&password=..."
                    value={m3uUrl}
                    onChange={(e) => {
                      setM3uUrl(e.target.value.slice(0, 2000));
                      if (errors.m3u) setErrors((p) => ({ ...p, m3u: undefined }));
                    }}
                    className={cn(
                      "pl-10 bg-secondary/50 border-border/50 min-h-[96px] resize-none text-sm",
                      errors.m3u && "border-destructive focus-visible:ring-destructive",
                    )}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={2000}
                    aria-invalid={!!errors.m3u}
                    aria-describedby={errors.m3u ? "m3u-error" : "m3u-hint"}
                  />
                </div>
                {errors.m3u ? (
                  <p id="m3u-error" className="text-xs text-destructive flex items-start gap-1 leading-relaxed">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    {errors.m3u}
                  </p>
                ) : (
                  <p id="m3u-hint" className="text-[11px] text-muted-foreground leading-relaxed">
                    Aceita links no formato <code className="text-foreground/80">get.php?username=…&amp;password=…</code> ou <code className="text-foreground/80">/playlist/usuario/senha</code>
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-primary hover:opacity-90 shadow-glow font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Conectando...
                  </>
                ) : (
                  "Entrar com M3U"
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 pt-6 border-t border-border/50 text-center">
          <button
            onClick={() => navigate("/admin/login")}
            className="text-xs text-muted-foreground hover:text-primary transition-smooth"
          >
            Acesso administrador →
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Login;
