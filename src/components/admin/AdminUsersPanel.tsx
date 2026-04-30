import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatRelative } from "@/lib/adminUtils";
import type { AdminUser } from "@/types/admin";

interface AdminUsersPanelProps {
  users: AdminUser[];
  search: string;
  onSearchChange: (s: string) => void;
  onUserDetail: (username: string) => void;
}

export function AdminUsersPanel({ users, search, onSearchChange, onUserDetail }: AdminUsersPanelProps) {
  const filteredUsers = users.filter((u) => search ? u.username.toLowerCase().includes(search.toLowerCase()) : true);

  return (
    <div className="space-y-4 mt-0">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar usuário..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Card className="bg-gradient-card border-border/50 overflow-hidden">
        {filteredUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Nenhum usuário registrado.</p>
        ) : (
          <div className="divide-y divide-border/50">
            <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-medium text-muted-foreground bg-secondary/30">
              <div className="col-span-3">Usuário</div>
              <div className="col-span-5">Último servidor</div>
              <div className="col-span-2">Último login</div>
              <div className="col-span-2 text-right">Total acessos</div>
            </div>
            {filteredUsers.map((u) => (
              <button
                type="button"
                key={u.username}
                onClick={() => onUserDetail(u.username)}
                className="grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm w-full text-left hover:bg-secondary/40 transition-colors"
              >
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium shrink-0">
                    {u.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate font-medium">{u.username}</span>
                </div>
                <div className="col-span-5 text-muted-foreground truncate text-xs font-mono">{u.last_server}</div>
                <div className="col-span-2 text-muted-foreground text-xs">há {formatRelative(u.last_login)}</div>
                <div className="col-span-2 text-right">{u.total}</div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
