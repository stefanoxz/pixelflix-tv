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

  const runDiagnostics = async () => {
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
      </Card>
    </div>
  );
};

export default AdminLogin;
