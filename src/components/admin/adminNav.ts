import {
  TrendingUp,
  BarChart3,
  Monitor,
  Flag,
  AlertOctagon,
  Users,
  Server,
  FlaskConical,
  Stethoscope,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Wrench,
  Ban,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  id: string;
  label: string;
  /** Rótulo curto pra bottom-nav no celular (≤ 11 chars). */
  shortLabel?: string;
  icon: LucideIcon;
  /** Só admins veem (moderadores ficam fora). */
  adminOnly: boolean;
  /** Aparece como atalho fixo na bottom-nav mobile. */
  primaryMobile?: boolean;
}

/**
 * Fonte única de itens do painel admin.
 * Usado pela sidebar desktop, pelo drawer mobile e pela bottom-nav.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Início", icon: TrendingUp, adminOnly: false, primaryMobile: true },
  { id: "users", label: "Usuários", shortLabel: "Usuários", icon: Users, adminOnly: false, primaryMobile: true },
  { id: "servers", label: "DNS / Servidores", shortLabel: "DNS", icon: Server, adminOnly: true, primaryMobile: true },
  { id: "endpoint-test", label: "Testar endpoint", shortLabel: "Endpoint", icon: FlaskConical, adminOnly: false, primaryMobile: true },
  { id: "team", label: "Equipe e permissões", shortLabel: "Equipe", icon: ShieldCheck, adminOnly: true, primaryMobile: true },
  { id: "maintenance", label: "Manutenção", shortLabel: "Manut.", icon: Wrench, adminOnly: true },
];


export function visibleAdminNav(isAdmin: boolean): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);
}

/** Retorna até 5 atalhos pra bottom-nav, respeitando filtro por papel. */
export function bottomNavItems(isAdmin: boolean): AdminNavItem[] {
  return visibleAdminNav(isAdmin)
    .filter((i) => i.primaryMobile)
    .slice(0, 5);
}

export function findNavItem(id: string): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((i) => i.id === id);
}
