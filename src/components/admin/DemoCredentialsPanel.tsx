import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { invokeAdminApi } from "@/lib/adminApi";
import { Eye, EyeOff, Loader2, Save, FlaskConical } from "lucide-react";

interface DemoCreds {
  server_url: string;
  username: string;
  password: string;
  enabled: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export default function DemoCredentialsPanel() {
  const [data, setData] = useState<DemoCreds | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await invokeAdminApi<DemoCreds>("demo_credentials_get");
        if (active) setData(res);
      } catch (e) {
        toast.error("Falha ao carregar credenciais", {
          description: (e as Error).message,
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const update = (patch: Partial<DemoCreds>) => {
    setData((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const save = async () => {
    if (!data) return;
    if (data.enabled && (!data.username.trim() || !data.password)) {
      toast.error("Para ativar, preencha usuário e senha");
      return;
    }
    setSaving(true);
    try {
      const res = await invokeAdminApi<DemoCreds>("demo_credentials_update", {
        server_url: data.server_url,
        username: data.username,
        password: data.password,
        enabled: data.enabled,
      });
      setData(res);
      toast.success(
        res.enabled
          ? "Acesso teste ativado e visível na tela de login"
          : "Credenciais salvas (acesso teste desativado)",
      );
    } catch (e) {
      toast.error("Falha ao salvar", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </Card>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Acesso teste
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Cadastre aqui uma credencial IPTV de teste. Quando ativada, um
              botão <span className="font-medium text-foreground">"Testar grátis"</span>
              {" "}aparece na tela de login do webplayer e qualquer visitante
              pode entrar com 1 clique, sem digitar nada.
            </p>
          </div>
          <Badge variant={data.enabled ? "default" : "secondary"}>
            {data.enabled ? "Ativo" : "Desativado"}
          </Badge>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3">
          <Switch
            id="demo-enabled"
            checked={data.enabled}
            onCheckedChange={(v) => update({ enabled: v })}
          />
          <Label htmlFor="demo-enabled" className="cursor-pointer">
            Mostrar botão "Testar grátis" na tela de login
          </Label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="demo-server" className="text-xs">
              Servidor (opcional)
            </Label>
            <Input
              id="demo-server"
              placeholder="http://meudns.com (deixe vazio para usar o padrão)"
              value={data.server_url}
              onChange={(e) => update({ server_url: e.target.value.slice(0, 500) })}
              maxLength={500}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="demo-user" className="text-xs">Usuário</Label>
            <Input
              id="demo-user"
              placeholder="usuario_teste"
              value={data.username}
              onChange={(e) => update({ username: e.target.value.slice(0, 200) })}
              maxLength={200}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="demo-pass" className="text-xs">Senha</Label>
            <div className="relative">
              <Input
                id="demo-pass"
                type={showPass ? "text" : "password"}
                placeholder="senha_teste"
                value={data.password}
                onChange={(e) => update({ password: e.target.value.slice(0, 400) })}
                maxLength={400}
                autoComplete="off"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-4">
          <p className="text-xs text-muted-foreground">
            {data.updated_at
              ? `Última atualização: ${new Date(data.updated_at).toLocaleString("pt-BR")}`
              : "Nunca configurado"}
          </p>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Salvar
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card className="p-4 text-xs text-muted-foreground space-y-1.5 bg-amber-500/5 border-amber-500/30">
        <p className="font-medium text-amber-700 dark:text-amber-400">⚠ Atenção</p>
        <p>
          A senha fica armazenada em texto puro e é entregue ao navegador de
          quem clicar no botão "Testar grátis". Use uma conta dedicada de
          demonstração com poucas conexões — nunca uma credencial pessoal.
        </p>
      </Card>
    </div>
  );
}
