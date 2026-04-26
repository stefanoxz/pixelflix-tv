import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Tv, Film, Clapperboard, User, LogOut, Sparkles, Menu, X, Settings } from "lucide-react";
const logoSuperTech = "/logo-supertech.webp";
import { useState } from "react";
import { useIptv } from "@/context/IptvContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Destaques", icon: Sparkles },
  { to: "/live", label: "Canais ao Vivo", icon: Tv },
  { to: "/movies", label: "Filmes", icon: Film },
  { to: "/series", label: "Séries", icon: Clapperboard },
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

  const username = session?.userInfo?.username ?? "";
  const initial = username.charAt(0).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src={logoSuperTech}
              alt="SuperTech"
              width={36}
              height={36}
              decoding="async"
              className="h-9 w-9 object-contain drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)] transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-bold tracking-tight">
              Super<span className="text-gradient">Tech</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors group",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-primary origin-center transition-transform duration-300",
                        isActive
                          ? "scale-x-100"
                          : "scale-x-0 group-hover:scale-x-100",
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Avatar menu (desktop) */}
        <div className="hidden md:flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-full pl-2 pr-3 py-1 hover:bg-secondary/60 transition-colors group"
                aria-label="Menu da conta"
              >
                <span className="h-8 w-8 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shadow-glow ring-2 ring-primary/30 group-hover:ring-primary/60 transition-all">
                  {initial}
                </span>
                <span className="text-xs text-muted-foreground max-w-[120px] truncate">
                  {username}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold truncate">{username}</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Conta SuperTech
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/account")} className="gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                Minha conta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/sync")} className="gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Sincronizar catálogo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile: avatar dropdown direto (nav vive no BottomNav) */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-secondary/60 transition-colors group tap-feedback"
                aria-label="Menu da conta"
              >
                <span className="h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shadow-glow ring-2 ring-primary/30">
                  {initial}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mr-2">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold truncate">{username}</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Conta SuperTech
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/account")} className="gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                Minha conta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/sync")} className="gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Sincronizar catálogo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
