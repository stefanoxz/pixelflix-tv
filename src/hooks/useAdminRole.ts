import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminRole = "admin" | "moderator" | null;

interface AdminRoleState {
  role: AdminRole;
  isAdmin: boolean;
  isModerator: boolean;
  loading: boolean;
}

/**
 * Hook que descobre o papel administrativo do usuário logado.
 * Retorna `admin` se for admin (mesmo que também seja moderator),
 * `moderator` se for só moderator, ou null caso contrário.
 *
 * Reage a mudanças de sessão automaticamente.
 */
export function useAdminRole(): AdminRoleState {
  const [state, setState] = useState<AdminRoleState>({
    role: null,
    isAdmin: false,
    isModerator: false,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    const resolve = async (userId: string | null) => {
      if (!userId) {
        if (active) setState({ role: null, isAdmin: false, isModerator: false, loading: false });
        return;
      }
      const [{ data: isAdmin }, { data: isModerator }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "moderator" }),
      ]);
      if (!active) return;
      const role: AdminRole = isAdmin ? "admin" : isModerator ? "moderator" : null;
      setState({
        role,
        isAdmin: !!isAdmin,
        isModerator: !!isModerator,
        loading: false,
      });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer para fora do callback (recomendado pelo Supabase).
      setTimeout(() => resolve(session?.user.id ?? null), 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      resolve(session?.user.id ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
