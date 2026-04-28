import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const [lastError, setLastError] = useState<string | null>(null);

  // If already logged in AND has admin/moderator role, jump straight to /admin
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !active) return;
      const [{ data: isAdmin }, { data: isModerator }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: session.user.id, _role: "moderator" }),
      ]);
      const role = isAdmin ? "admin" : isModerator ? "moderator" : null;
      if (role && active) navigate("/admin", { replace: true });
    })();
    return () => { active = false; };
  }, [navigate]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLastError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) throw new Error("Falha ao obter sessão");

      const [{ data: isAdmin, error: roleErr }, { data: isModerator, error: modErr }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "moderator" }),
      ]);
      if (roleErr || modErr) throw (roleErr ?? modErr)!;
      const role = isAdmin ? "admin" : isModerator ? "moderator" : null;
      if (!role) {
        await supabase.auth.signOut();
        const msg = "Conta autenticou, mas não tem papel admin nem moderador. Peça liberação.";
        setLastError(msg);
        toast.error(msg);
        return;
      }
      toast.success(role === "admin" ? "Bem-vindo ao painel admin" : "Bem-vindo, moderador");
      navigate("/admin", { replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Falha no login";
      const friendly = describeAuthError(raw);
      // Não vazamos o erro bruto na UI (pode conter detalhes internos do
      // backend de auth). Mantemos no console para debug do operador.
      console.warn("[admin-login] signin error:", raw);
      setLastError(friendly);
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLastError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      if (error) throw error;
      // Faz logout: cadastro recente fica pendente até admin aprovar.
      // Sem isso o Supabase já criaria sessão e o usuário cairia na tela
      // de "aguardando aprovação" sem perceber que precisa esperar.
      await supabase.auth.signOut().catch(() => {});
      toast.success(
        "Cadastro recebido! Aguarde a aprovação do administrador para acessar o painel.",
        { duration: 8000 },
      );
      setMode("signin");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Falha no cadastro";
      const friendly = describeAuthError(raw);
      console.warn("[admin-login] signup error:", raw);
      setLastError(friendly);
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLastError(null);
    if (!email) {
      toast.error("Informe seu e-mail no campo acima primeiro");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (error) throw error;
      toast.success("Se a conta existir, um link de recuperação foi enviado.");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Falha ao enviar e-mail";
      const friendly = describeAuthError(raw);
      console.warn("[admin-login] forgot error:", raw);
      setLastError(friendly);
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow opacity-50" />
      <Card className="relative w-full max-w-sm p-8 bg-gradient-card border-border/50 shadow-card animate-scale-in">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao login do webplayer
        </button>
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
      </Card>
    </div>
  );
};

export default AdminLogin;
