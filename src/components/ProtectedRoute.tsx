import { Navigate, useLocation } from "react-router-dom";
import { ReactNode, forwardRef, useEffect, useState } from "react";
import { useIptv } from "@/context/IptvContext";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = forwardRef<unknown, ProtectedRouteProps>(function ProtectedRoute(
  { children },
  _ref,
) {
  const { session, logout } = useIptv();
  const location = useLocation();
  const [supabaseChecked, setSupabaseChecked] = useState(false);
  const [supabaseValid, setSupabaseValid] = useState(true);

  // Q10: Sync Supabase auth session with IPTV session.
  // If Supabase session expired, force a clean logout so the user re-authenticates
  // instead of seeing silent 401s on stream-token calls.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const valid = !!data.session;
      setSupabaseValid(valid);
      setSupabaseChecked(true);
      if (!valid && session) {
        // IPTV session is stale relative to Supabase auth — clean it up.
        logout();
      }
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      const valid = !!s;
      setSupabaseValid(valid);
      if (!valid && session) logout();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (supabaseChecked && !supabaseValid) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
});

ProtectedRoute.displayName = "ProtectedRoute";
