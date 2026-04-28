import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, UserPlus, Trash2, ShieldCheck, Shield, History, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invokeAdminApi, setTeamPassword } from "@/lib/adminApi";
import AuditLogPanel from "@/components/admin/AuditLogPanel";

type TeamRole = "admin" | "moderator";

interface TeamMember {
  id: string;
  user_id: string;
  role: TeamRole;
  email: string | null;
  created_at: string;
  is_self: boolean;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function TeamPanel() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [adminCount, setAdminCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<TeamRole>("moderator");
  const [adding, setAdding] = useState(false);

  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const openPasswordDialog = (member: TeamMember) => {
    setNewPassword("");
    setConfirmPassword("");
    setPasswordTarget(member);
  };

  const submitPassword = async () => {
    if (!passwordTarget) return;
    if (newPassword.length < 8) {
      toast.error("Senha precisa ter ao menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSavingPassword(true);
    try {
      await setTeamPassword(passwordTarget.user_id, newPassword);
      toast.success(
        passwordTarget.is_self
          ? "Sua senha foi atualizada"
          : `Senha de ${passwordTarget.email ?? "usuário"} atualizada`,
      );
      setPasswordTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar senha");
    } finally {
      setSavingPassword(false);
    }
  };

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invokeAdminApi<{ team: TeamMember[]; admin_count: number }>("list_team");
      setTeam(data.team ?? []);
      setAdminCount(data.admin_count ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar equipe");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const addMember = async () => {
    const email = addEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Informe um e-mail válido");
      return;
    }
    setAdding(true);
    try {
      await invokeAdminApi("add_team_member", { email, role: addRole });
      toast.success(`${email} adicionado como ${addRole === "admin" ? "administrador" : "moderador"}`);
      setAddOpen(false);
      setAddEmail("");
      setAddRole("moderator");
      await fetchTeam();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao adicionar membro");
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (member: TeamMember, newRole: TeamRole) => {
    if (member.role === newRole) return;
    setBusyId(member.user_id);
    try {
      await invokeAdminApi("update_team_role", { user_id: member.user_id, role: newRole });
      toast.success(`Papel atualizado para ${newRole}`);
      await fetchTeam();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar papel");
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (member: TeamMember) => {
    setBusyId(member.user_id);
    try {
      await invokeAdminApi("remove_team_member", { user_id: member.user_id });
      toast.success(`${member.email ?? member.user_id.slice(0, 8)} removido da equipe`);
      setConfirmRemove(null);
      await fetchTeam();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover membro");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold">Equipe e permissões</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {team.length} {team.length === 1 ? "membro" : "membros"} •{" "}
              {adminCount} administrador{adminCount === 1 ? "" : "es"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setAuditOpen(true)}>
              <History className="h-4 w-4 mr-2" />
              Histórico de ações
            </Button>
            <Button size="sm" variant="outline" onClick={fetchTeam} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar membro
            </Button>
          </div>
        </div>

        <div className="rounded-md bg-secondary/30 border border-border/40 p-3 text-xs text-muted-foreground mb-4 leading-relaxed">
          <strong className="text-foreground">Admin:</strong> acesso total — gerencia DNS, servidores, equipe, aprova cadastros, troca senhas e vê o audit log.{" "}
          <strong className="text-foreground">Moderador:</strong> vê todo o painel (estatísticas, sessões, reports, diagnósticos, login events) e pode encerrar sessões ao vivo, aplicar bloqueios temporários e atualizar status de reports — mas não mexe em DNS, servidores, equipe nem em aprovações.
        </div>

        {loading && team.length === 0 ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : team.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum membro cadastrado ainda.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            <div className="grid grid-cols-12 gap-3 px-2 py-2 text-xs font-medium text-muted-foreground">
              <div className="col-span-5">E-mail</div>
              <div className="col-span-3">Papel</div>
              <div className="col-span-2">Desde</div>
              <div className="col-span-2 text-right">Ações</div>
            </div>
            {team.map((m) => {
              const shortId = m.user_id.slice(0, 8);
              return (
                <div
                  key={m.id}
                  className="grid grid-cols-12 gap-3 px-2 py-3 items-center text-sm"
                >
                  <div className="col-span-5 truncate flex items-center gap-2">
                    {m.role === "admin" ? (
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate font-medium">
                      {m.email ?? <span className="italic text-muted-foreground">id: {shortId}…</span>}
                    </span>
                    {m.is_self && (
                      <span className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        você
                      </span>
                    )}
                  </div>
                  <div className="col-span-3">
                    <Select
                      value={m.role}
                      onValueChange={(v) => changeRole(m, v as TeamRole)}
                      disabled={busyId === m.user_id}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="moderator">Moderador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground">{formatDate(m.created_at)}</div>
                  <div className="col-span-2 flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openPasswordDialog(m)}
                      disabled={busyId === m.user_id}
                      title={m.is_self ? "Trocar minha senha" : "Trocar senha deste membro"}
                    >
                      <KeyRound className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmRemove(m)}
                      disabled={busyId === m.user_id || m.is_self}
                      title={m.is_self ? "Você não pode remover a si mesmo" : "Remover acesso"}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {busyId === m.user_id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Adicionar membro */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar membro à equipe</DialogTitle>
            <DialogDescription>
              Informe o e-mail. Se o usuário ainda não tem conta, um convite será enviado por e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-email" className="text-xs">E-mail</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="pessoa@exemplo.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Papel</Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as TeamRole)} disabled={adding}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderator">Moderador (recomendado)</SelectItem>
                  <SelectItem value="admin">Administrador (acesso total)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancelar
            </Button>
            <Button onClick={addMember} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar remoção */}
      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmRemove?.email ?? confirmRemove?.user_id.slice(0, 8)}</strong>{" "}
              perderá acesso ao painel admin. A conta de login não é apagada — só os papéis administrativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemove && removeMember(confirmRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trocar senha */}
      <Dialog open={!!passwordTarget} onOpenChange={(o) => !o && !savingPassword && setPasswordTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {passwordTarget?.is_self ? "Trocar minha senha" : "Trocar senha do membro"}
            </DialogTitle>
            <DialogDescription>
              {passwordTarget?.is_self ? (
                <>Defina uma nova senha para a sua conta administrativa.</>
              ) : (
                <>
                  Definir nova senha para{" "}
                  <strong className="text-foreground">{passwordTarget?.email ?? "este membro"}</strong>.
                  Ele(a) precisará usar essa senha no próximo login — comunique por canal seguro.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-xs">Nova senha (mín. 8 caracteres)</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={savingPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={savingPassword}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordTarget(null)} disabled={savingPassword}>
              Cancelar
            </Button>
            <Button onClick={submitPassword} disabled={savingPassword}>
              {savingPassword
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <KeyRound className="h-4 w-4 mr-2" />}
              Salvar senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico de auditoria */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de ações administrativas</DialogTitle>
            <DialogDescription>
              Últimas 100 ações realizadas no painel. Retemos por 180 dias.
            </DialogDescription>
          </DialogHeader>
          <AuditLogPanel />
        </DialogContent>
      </Dialog>
    </div>
  );
}
