import { useState } from "react";
import { Menu, Shield, LogOut, ArrowLeft } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { visibleAdminNav, findNavItem } from "./adminNav";

interface Props {
  tab: string;
  onTabChange: (id: string) => void;
  isAdmin: boolean;
  isModerator: boolean;
  onSignOut: () => void;
  onBackToApp: () => void;
}

/**
 * Barra fixa no topo do painel admin, visível apenas em telas < lg.
 * Concentra título da seção atual, badge de papel e drawer com a nav completa.
 */
export function AdminMobileTopBar({
  tab,
  onTabChange,
  isAdmin,
  isModerator,
  onSignOut,
  onBackToApp,
}: Props) {
  const [open, setOpen] = useState(false);
  const items = visibleAdminNav(isAdmin);
  const current = findNavItem(tab);

  const handlePick = (id: string) => {
    onTabChange(id);
    setOpen(false);
  };

  return (
    <header className="lg:hidden sticky top-0 z-40 h-12 flex items-center gap-2 px-3 bg-card/95 backdrop-blur border-b border-border/50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 -ml-1">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border/50">
            <SheetTitle className="flex items-center gap-2 text-left">
              <div className="h-8 w-8 rounded-md bg-gradient-primary flex items-center justify-center shadow-glow">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span>Admin Panel</span>
              {(isAdmin || isModerator) && (
                <span
                  className={
                    "ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold " +
                    (isAdmin
                      ? "bg-primary/15 text-primary"
                      : "bg-warning/15 text-warning")
                  }
                >
                  {isAdmin ? "Admin" : "Mod"}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {items.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handlePick(item.id)}
                  className={
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors " +
                    (active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground")
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="text-left">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-border/50 space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => {
                setOpen(false);
                onBackToApp();
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao app
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {current?.icon && <current.icon className="h-4 w-4 text-primary shrink-0" />}
        <h1 className="text-sm font-semibold truncate">{current?.label ?? "Admin"}</h1>
      </div>

      {(isAdmin || isModerator) && (
        <span
          className={
            "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold shrink-0 " +
            (isAdmin
              ? "bg-primary/15 text-primary"
              : "bg-warning/15 text-warning")
          }
        >
          {isAdmin ? "Admin" : "Mod"}
        </span>
      )}
    </header>
  );
}

export default AdminMobileTopBar;
