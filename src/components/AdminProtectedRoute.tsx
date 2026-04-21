import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

interface Props {
  children: React.ReactNode;
}

type State = "loading" | "allowed" | "denied";

const AdminProtectedRoute = ({ children }: Props) => {
  const [state, setState] = useState<State>("loading");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;

    // 1. Set up listener BEFORE getSession (Lovable pattern)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      if (!newSession) {
        setState("denied");
      } else {
        // defer role check to avoid recursive calls inside the listener
        setTimeout(() => verifyRole(newSession), 0);
      }
    });

    // 2. Then read existing session
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
      if (error || !isAdmin) {
        await supabase.auth.signOut();
        toast.error("Acesso negado: sua conta não é administrador.");
        setState("denied");
        return;
      }
      setState("allowed");
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

  if (state === "denied" || !session) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

export default AdminProtectedRoute;
