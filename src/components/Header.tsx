import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Tv, Film, Clapperboard, User, LogOut, Sparkles, Menu, X } from "lucide-react";
import logoSuperTech from "@/assets/logo-supertech.png";
import { useState } from "react";
import { useIptv } from "@/context/IptvContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Destaques", icon: Sparkles },
  { to: "/live", label: "Canais ao Vivo", icon: Tv },
  { to: "/movies", label: "Filmes", icon: Film },
  { to: "/series", label: "Séries", icon: Clapperboard },
  { to: "/account", label: "Conta", icon: User },
];

export function Header() {
  const { session, logout } = useIptv();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // hide on login & admin routes
  if (location.pathname.startsWith("/login") || location.pathname.startsWith("/admin")) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={logoSuperTech}
              alt="SuperTech"
              className="h-9 w-9 object-contain drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
            />
            <span className="text-xl font-bold tracking-tight">
              Super<span className="text-gradient">Tech</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-smooth",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {session && (
            <span className="text-xs text-muted-foreground">
              {session.userInfo.username}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>

        <button
          className="md:hidden p-2 rounded-md hover:bg-secondary"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-border/40 bg-background animate-fade-in">
          <div className="flex flex-col p-3 gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-smooth",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
