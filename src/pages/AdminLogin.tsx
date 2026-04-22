import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2, Bug, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type DebugEntry = {
  ts: string;
  step: string;
  ok: boolean;
  detail: string;
};

function maskEmail(email: string) {
  if (!email || !email.includes("@")) return email || "(vazio)";
  const [user, domain] = email.split("@");
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function describeAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "E-mail ou senha incorretos. A conta existe, mas a senha não bateu.";
  if (m.includes("email not confirmed"))
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  if (m.includes("database error querying schema"))
    return "Erro de schema no banco de auth (linhas com NULL em colunas de token).";
  if (m.includes("user not found"))
    return "Nenhuma conta encontrada com esse e-mail.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns segundos.";
  if (m.includes("password should be") || m.includes("weak password"))
    return "Senha fraca ou não atende aos requisitos.";
  if (m.includes("already registered") || m.includes("user already"))
    return "Já existe uma conta com esse e-mail.";
  return msg;
}

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const pushDebug = (step: string, ok: boolean, detail: string) => {
    setDebugLog((prev) =>
      [...prev, { ts: new Date().toLocaleTimeString(), step, ok, detail }].slice(-30),
    );
  };

  // If already logged in AND admin, jump straight to /admin
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !active) return;
      pushDebug("session", true, `sessão ativa: ${maskEmail(session.user.email ?? "")}`);
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      pushDebug("has_role", !!isAdmin, isAdmin ? "admin confirmado" : "não é admin");
      if (isAdmin && active) navigate("/admin", { replace: true });
    })();
    return () => { active = false; };
  }, [navigate]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLastError(null);
    pushDebug("signin:start", true, `email=${maskEmail(email)} senha=${password.length} chars`);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        pushDebug("signin:auth", false, `${error.status ?? "?"} ${error.message}`);
        throw error;
      }
      const userId = data.user?.id;
      if (!userId) throw new Error("Falha ao obter sessão");
      pushDebug("signin:auth", true, `user_id=${userId.slice(0, 8)}…`);

      const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (roleErr) {
        pushDebug("has_role", false, roleErr.message);
        throw roleErr;
      }
      pushDebug("has_role", !!isAdmin, isAdmin ? "admin OK" : "sem papel admin");
      if (!isAdmin) {
        await supabase.auth.signOut();
        const msg = "Conta autenticou, mas não tem papel admin. Peça liberação.";
        setLastError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Bem-vindo ao painel admin");
      navigate("/admin", { replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Falha no login";
      const friendly = describeAuthError(raw);
      setLastError(`${friendly} — raw: ${raw}`);
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLastError(null);
    pushDebug("signup:start", true, `email=${maskEmail(email)} senha=${password.length} chars`);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      if (error) {
        pushDebug("signup", false, `${error.status ?? "?"} ${error.message}`);
        throw error;
      }
      pushDebug("signup", true, "conta criada (verifique e-mail se exigido)");
      toast.success("Conta criada. Peça ao admin atual para liberar permissão.");
      setMode("signin");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Falha no cadastro";
      const friendly = describeAuthError(raw);
      setLastError(`${friendly} — raw: ${raw}`);
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLastError(null);
    if (!email) {
      toast.error("Informe seu e-mail no campo acima primeiro");
      pushDebug("forgot", false, "e-mail vazio");
      return;
    }
    setLoading(true);
    pushDebug("forgot:start", true, `email=${maskEmail(email)}`);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (error) throw error;
      pushDebug("forgot", true, "e-mail de recuperação enviado (se a conta existir)");
      toast.success("Se a conta existir, um link de recuperação foi enviado.");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Falha ao enviar e-mail";
      const friendly = describeAuthError(raw);
      pushDebug("forgot", false, raw);
      setLastError(`${friendly} — raw: ${raw}`);
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

    setLastError(null);
    pushDebug("diag:start", true, `email=${maskEmail(email) || "(vazio)"}`);
    if (!email) {
      pushDebug("diag", false, "informe um e-mail antes de diagnosticar");
      toast.error("Informe o e-mail primeiro");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/login`,
    });
    if (error) {
      pushDebug("diag:reset", false, `${error.status ?? "?"} ${error.message}`);
    } else {
      pushDebug("diag:reset", true, "backend respondeu sem 500 (e-mail enviado se conta existir)");
    }
    const { data: { session } } = await supabase.auth.getSession();
    pushDebug(
      "diag:session",
      !!session,
      session ? `logado: ${maskEmail(session.user.email ?? "")}` : "sem sessão ativa",
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow opacity-50" />
      <Card className="relative w-full max-w-sm p-8 bg-gradient-card border-border/50 shadow-card animate-scale-in">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Painel Admin</h1>
          <p className="text-xs text-muted-foreground mt-1">Acesso restrito por papel</p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Cadastrar</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-xs">E-mail</Label>
                <Input
                  id="signin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                  placeholder="voce@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-pass" className="text-xs">Senha</Label>
                <Input
                  id="signin-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Esqueci minha senha
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-xs">E-mail</Label>
                <Input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                  placeholder="voce@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-pass" className="text-xs">Senha (mín. 6)</Label>
                <Input
                  id="signup-pass"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Após criar a conta, um admin precisa liberar sua permissão.
              </p>
            </form>
          </TabsContent>
        </Tabs>

        {lastError && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <strong className="block mb-1">Erro detalhado</strong>
            <span className="break-words">{lastError}</span>
          </div>
        )}

        <div className="mt-4 border-t border-border/40 pt-3">
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Bug className="h-3.5 w-3.5" />
              Painel de depuração
            </span>
            {debugOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {debugOpen && (
            <div className="mt-3 space-y-3">
              <div className="rounded-md bg-secondary/40 p-2 text-[11px] font-mono space-y-1">
                <div>
                  <span className="text-muted-foreground">e-mail:</span>{" "}
                  <span>{maskEmail(email) || "(vazio)"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">senha:</span>{" "}
                  <span>{password ? `${password.length} caracteres` : "(vazia)"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">modo:</span> <span>{mode}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runDiagnostics}
                className="w-full text-xs"
              >
                Rodar diagnóstico (ping no auth)
              </Button>

              <div className="max-h-48 overflow-y-auto rounded-md bg-secondary/40 p-2 text-[11px] font-mono space-y-1">
                {debugLog.length === 0 ? (
                  <div className="text-muted-foreground">
                    Sem eventos ainda. Tente entrar ou rode o diagnóstico.
                  </div>
                ) : (
                  debugLog.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">{l.ts}</span>
                      <span
                        className={
                          l.ok ? "text-emerald-400 shrink-0" : "text-destructive shrink-0"
                        }
                      >
                        {l.ok ? "✓" : "✗"}
                      </span>
                      <span className="font-semibold shrink-0">{l.step}</span>
                      <span className="text-muted-foreground break-all">{l.detail}</span>
                    </div>
                  ))
                )}
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                A senha nunca aparece — só o tamanho. O e-mail é mascarado. Use isso pra
                confirmar quais credenciais o backend aceita.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdminLogin;
