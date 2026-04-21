import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ADMIN_USER = "admin";
const ADMIN_PASS = "admin";
const TOKEN_KEY = "admin_token";
// Must match ADMIN_PASSWORD env in admin-api edge function (default fallback)
const ADMIN_API_TOKEN = "admin-panel-2024";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (user === ADMIN_USER && pass === ADMIN_PASS) {
        localStorage.setItem(TOKEN_KEY, ADMIN_API_TOKEN);
        toast.success("Bem-vindo ao painel admin");
        navigate("/admin");
      } else {
        toast.error("Credenciais inválidas");
      }
      setLoading(false);
    }, 400);
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
          <p className="text-xs text-muted-foreground mt-1">Acesso restrito</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adm-user" className="text-xs">Usuário</Label>
            <Input
              id="adm-user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="bg-secondary/50 border-border/50"
              placeholder="admin"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-pass" className="text-xs">Senha</Label>
            <Input
              id="adm-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="bg-secondary/50 border-border/50"
              placeholder="admin"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Demo: <code>admin</code> / <code>admin</code>
          </p>
        </form>
      </Card>
    </div>
  );
};

export default AdminLogin;
