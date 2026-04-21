import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useIptv } from "@/context/IptvContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session } = useIptv();
  const location = useLocation();
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}
