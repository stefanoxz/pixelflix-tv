import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Tv, Loader2, ServerIcon, KeyRound, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useIptv } from "@/context/IptvContext";
import { iptvLogin } from "@/services/iptv";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const { setSession } = useIptv();
  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!server || !username || !password) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    try {
      const data = await iptvLogin({ server: server.trim(), username: username.trim(), password });
      setSession({
        creds: { server: server.trim(), username: username.trim(), password },
        userInfo: data.user_info,
      });
      toast.success(`Bem-vindo, ${data.user_info.username}!`);
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Falha no login: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(214_100%_56%/0.15),transparent_50%)]" />

      <Card className="relative w-full max-w-md p-8 bg-gradient-card border-border/50 shadow-card animate-scale-in">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
            <Tv className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Flix<span className="text-gradient">Play</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Entre com suas credenciais Xtream Codes
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server" className="text-xs">Servidor (URL)</Label>
            <div className="relative">
              <ServerIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="server"
                placeholder="http://servidor.com:8080"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                className="pl-10 bg-secondary/50 border-border/50 h-11"
                autoComplete="url"
              />
            </div>
          </div>

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
