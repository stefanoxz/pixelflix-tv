import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, KeyRound, UserIcon, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIptv } from "@/context/IptvContext";
import { iptvLogin, iptvLoginM3u, resolveStreamBase, IptvLoginError } from "@/services/iptv";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseM3uUrl } from "@/lib/parseM3uUrl";
const logoSuperTech = "/logo-supertech.webp";

const Login = () => {
  const navigate = useNavigate();
  const { setSession } = useIptv();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [loading, setLoading] = useState(false);

  /** Núcleo do login: recebe creds já parseadas e roda o fluxo padrão. */
  const performLogin = async (
    serverArg: string | undefined,
    user: string,
    pass: string,
  ) => {
    setLoading(true);
    try {
      const data = await iptvLogin({
        server: serverArg,
        username: user,
        password: pass,
      });
      const resolvedServer = data.server_url ?? serverArg ?? "";
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
          username: user,
          password: pass,
          streamBase,
        },
        userInfo: data.user_info,
        serverInfo: data.server_info,
      });
      toast.success(`Bem-vindo, ${data.user_info.username}!`);
      navigate("/sync");
    } catch (err) {
      handleLoginError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCreds = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Preencha usuário e senha");
      return;
    }
    await performLogin(undefined, username.trim(), password);
  };

  const handleSubmitM3u = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseM3uUrl(m3uUrl);
    if (!parsed) {
      toast.error(
        "URL inválida. Use formato get.php ou /playlist/usuario/senha",
      );
      return;
    }
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

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(214_100%_56%/0.15),transparent_50%)]" />

      <Card className="relative w-full max-w-md p-8 bg-gradient-card border-border/50 shadow-card animate-scale-in">
        <div className="text-center mb-6">
          <img
            src={logoSuperTech}
            alt="SuperTech"
            width={96}
            height={96}
            fetchPriority="high"
            decoding="async"
            className="mx-auto h-24 w-24 object-contain mb-4 drop-shadow-[0_0_24px_hsl(var(--primary)/0.45)]"
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
            <form onSubmit={handleSubmitCreds} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs">Usuário</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="seu usuário"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-secondary/50 border-border/50 h-11"
                    autoComplete="username"
                    maxLength={120}
                  />
                </div>
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
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-secondary/50 border-border/50 h-11"
                    autoComplete="current-password"
                    maxLength={200}
                  />
                </div>
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
            <form onSubmit={handleSubmitM3u} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="m3u" className="text-xs">URL M3U</Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="m3u"
                    placeholder="http://servidor.com/get.php?username=...&password=..."
                    value={m3uUrl}
                    onChange={(e) => setM3uUrl(e.target.value.slice(0, 2000))}
                    className="pl-10 bg-secondary/50 border-border/50 min-h-[96px] resize-none text-sm"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={2000}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Aceita links no formato <code className="text-foreground/80">get.php?username=…&amp;password=…</code> ou <code className="text-foreground/80">/playlist/usuario/senha</code>
                </p>
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
