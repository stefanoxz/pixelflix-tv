import { NavLink, useLocation } from "react-router-dom";
import { Sparkles, Tv, Film, Clapperboard, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Início", icon: Sparkles, end: true },
  { to: "/live", label: "Ao Vivo", icon: Tv },
  { to: "/movies", label: "Filmes", icon: Film },
  { to: "/series", label: "Séries", icon: Clapperboard },
  { to: "/account", label: "Conta", icon: User },
];

/**
 * Barra de navegação inferior — mobile only (md:hidden).
 * Padrão de apps nativos: 5 destinos principais sempre acessíveis com 1 toque.
 * Inclui safe-area para iPhone (home indicator) e Android (gesture bar).
 */
export function BottomNav() {
  const location = useLocation();
  const hidden =
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/sync");

  if (hidden) return null;

  return (
    <nav
      role="navigation"
      aria-label="Navegação principal"
      className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-40",
        "bg-background/90 backdrop-blur-xl border-t border-border/50",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="grid grid-cols-5 h-16">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "h-full w-full flex flex-col items-center justify-center gap-1 text-[10px] font-medium",
                  "transition-colors tap-feedback select-none",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "relative flex items-center justify-center h-7 w-12 rounded-full transition-all duration-300",
                      isActive && "bg-primary/15",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5 transition-transform",
                        isActive && "scale-110",
                      )}
                    />
                  </span>
                  <span className="leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
