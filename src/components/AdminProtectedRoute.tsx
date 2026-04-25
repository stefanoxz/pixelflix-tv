import { forwardRef, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Clock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: React.ReactNode;
}

type State = "loading" | "allowed" | "denied" | "pending";

const AdminProtectedRoute = forwardRef<unknown, Props>(function AdminProtectedRoute(
  { children },
  _ref,
) {
  const [state, setState] = useState<State>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      if (!newSession) {
        setState("denied");
      } else {
        setTimeout(() => verifyRole(newSession), 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (!active) return;
      setSession(existing);
      if (!existing) {
        setState("denied");
      } else {
        verifyRole(existing);
      }
    });

    async function verifyRole(s: Session) {
      const { data: isAdmin, error } = await supabase.rpc("has_role", {
        _user_id: s.user.id,
        _role: "admin",
      });
      if (!active) return;
      if (error) {
        await supabase.auth.signOut();
        toast.error("Erro ao verificar permissões.");
        setState("denied");
        return;
      }
      if (isAdmin) {
        setState("allowed");
        return;
      }
      // Sem role admin — verifica se está na fila de aprovação.
      const { data: pending } = await supabase
        .from("pending_admin_signups")
        .select("email")
        .eq("user_id", s.user.id)
        .maybeSingle();
      if (!active) return;
      if (pending) {
        setPendingEmail(pending.email ?? s.user.email ?? null);
        setState("pending");
      } else {
        await supabase.auth.signOut();
        toast.error("Acesso negado: sua conta não é administrador.");
        setState("denied");
      }
    }

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full p-8 bg-gradient-card border-border/50 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto">
            <Clock className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">Aguardando aprovação</h1>
          <p className="text-sm text-muted-foreground">
            Seu cadastro {pendingEmail ? <strong className="text-foreground">({pendingEmail})</strong> : null} foi recebido com sucesso e está aguardando aprovação do administrador.
          </p>
          <p className="text-xs text-muted-foreground">
            Você terá acesso ao painel assim que sua conta for liberada.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/admin/login";
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </Card>
      </div>
    );
  }

  if (state === "denied" || !session) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
});

AdminProtectedRoute.displayName = "AdminProtectedRoute";

export default AdminProtectedRoute;
