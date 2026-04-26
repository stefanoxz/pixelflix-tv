import { bottomNavItems } from "./adminNav";

interface Props {
  tab: string;
  onTabChange: (id: string) => void;
  isAdmin: boolean;
}

/**
 * Bottom navigation fixa no rodapé em telas < lg.
 * Mostra os atalhos mais usados; o resto fica no drawer da top bar.
 */
export function AdminBottomNav({ tab, onTabChange, isAdmin }: Props) {
  const items = bottomNavItems(isAdmin);
  if (items.length === 0) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border/50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal do painel admin"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = tab === item.id;
          return (
            <li key={item.id}>
              <button
                onClick={() => onTabChange(item.id)}
                className={
                  "w-full flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors " +
                  (active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground")
                }
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium leading-tight">{item.shortLabel ?? item.label}</span>
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 bg-primary rounded-b" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default AdminBottomNav;
