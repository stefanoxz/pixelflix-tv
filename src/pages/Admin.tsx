import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeAdminApi } from "@/lib/adminApi";
import { useAdminRole } from "@/hooks/useAdminRole";
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
import { ServerProbeDialog } from "@/components/admin/ServerProbeDialog";
import { EndpointTestPanel } from "@/components/admin/EndpointTestPanel";
import { UserReportsPanel } from "@/components/admin/UserReportsPanel";
import ClientDiagnosticsPanel from "@/components/admin/ClientDiagnosticsPanel";
import PendingSignupsPanel from "@/components/admin/PendingSignupsPanel";
import TeamPanel from "@/components/admin/TeamPanel";
import StatsPanel from "@/components/admin/StatsPanel";
import MaintenancePanel from "@/components/admin/MaintenancePanel";
import DemoCredentialsPanel from "@/components/admin/DemoCredentialsPanel";
import BlockedDnsPanel from "@/components/admin/BlockedDnsPanel";
import UserDetailDialog from "@/components/admin/UserDetailDialog";
import StreamEventsPanel from "@/components/admin/StreamEventsPanel";
import { visibleAdminNav, findNavItem } from "@/components/admin/adminNav";
import AdminMobileTopBar from "@/components/admin/AdminMobileTopBar";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import { LogOut, Shield, RefreshCw, X, Pencil, Trash2 } from "lucide-react";
import { useAdminData } from "@/hooks/useAdminData";
import { DashboardPanel } from "@/components/admin/DashboardPanel";
import { MonitoringPanel } from "@/components/admin/MonitoringPanel";
import { DnsErrorsPanel } from "@/components/admin/DnsErrorsPanel";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { AdminServersPanel } from "@/components/admin/AdminServersPanel";
import type { AllowedServer, MonitoringSession, MonitoringBlock } from "@/types/admin";

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, isModerator, role, loading: roleLoading } = useAdminRole();
  const [tab, setTab] = useState("dashboard");
  const [dnsErrorsHours, setDnsErrorsHours] = useState<number>(24);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editingServer, setEditingServer] = useState<AllowedServer | null>(null);
  const [probeServer, setProbeServer] = useState<AllowedServer | null>(null);
  const [detailUsername, setDetailUsername] = useState<string | null>(null);
  const [confirmRemoveServer, setConfirmRemoveServer] = useState<string | null>(null);
  const [confirmEvictSession, setConfirmEvictSession] = useState<MonitoringSession | null>(null);
  const [confirmUnblockUser, setConfirmUnblockUser] = useState<MonitoringBlock | null>(null);

  const {
    stats, users, allowed, pending, events, monitoring, topConsumers,
    dnsErrors, loading, health, healthLoading, refresh, refreshDnsErrors,
    setSigningOut, checkAllServers
  } = useAdminData(tab, dnsErrorsHours);

  const allowServer = async (server_url: string, label?: string, notes?: string) => {
    try {
      await invokeAdminApi("allow_server", { server_url, label, notes });
      toast.success(editingServer ? "DNS atualizada" : "DNS autorizada");
      setAddOpen(false);
      setEditingServer(null);
      setNewUrl("");
      setNewLabel("");
      setNewNotes("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar");
    }
  };

  const removeServer = async (server_url: string) => {
    try {
      await invokeAdminApi("remove_server", { server_url });
      toast.success("DNS apagada definitivamente");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar");
    } finally {
      setConfirmRemoveServer(null);
    }
  };

  const unblockUser = async (anon_user_id: string) => {
    try {
      await invokeAdminApi("unblock_user", { anon_user_id });
      toast.success("Usuário desbloqueado");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desbloquear");
    } finally {
      setConfirmUnblockUser(null);
    }
  };

  const evictSession = async (anon_user_id: string) => {
    try {
      await invokeAdminApi("evict_session", { anon_user_id });
      toast.success("Sessão encerrada");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao encerrar");
    } finally {
      setConfirmEvictSession(null);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const navItems = visibleAdminNav(isAdmin);
  const currentNav = findNavItem(tab);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <AdminMobileTopBar tab={tab} onTabChange={setTab} isAdmin={isAdmin} isModerator={isModerator} onSignOut={handleSignOut} onBackToApp={() => navigate("/")} />

      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-card border-r border-border/50 p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-md bg-gradient-primary flex items-center justify-center shadow-glow">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold">Admin Panel</span>
          {role && <span className={`ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${isAdmin ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"}`}>{isAdmin ? "Admin" : "Moderador"}</span>}
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${tab === item.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-8 pt-6 border-t border-border/50 space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => navigate("/")}>← Voltar ao app</Button>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive hover:text-destructive" onClick={handleSignOut}><LogOut className="h-4 w-4" />Sair</Button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 pb-24 lg:pb-8 space-y-4 lg:space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="hidden lg:block">
            <h1 className="text-3xl font-bold">{currentNav?.label ?? "Admin"}</h1>
            <p className="text-sm text-muted-foreground mt-1">{currentNav?.id === "dashboard" ? "Visão geral" : "Gerenciamento do sistema"}</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="dashboard"><DashboardPanel stats={stats} events={events} pending={pending} setTab={setTab} /></TabsContent>
          <TabsContent value="monitoring"><MonitoringPanel monitoring={monitoring} topConsumers={topConsumers} onEvictSession={setConfirmEvictSession} onUnblockUser={setConfirmUnblockUser} /></TabsContent>
          <TabsContent value="dns-errors"><DnsErrorsPanel dnsErrors={dnsErrors} hours={dnsErrorsHours} setHours={setDnsErrorsHours} onRefresh={refreshDnsErrors} /></TabsContent>
          <TabsContent value="users"><AdminUsersPanel users={users} search={search} onSearchChange={setSearch} onUserDetail={setDetailUsername} /></TabsContent>
          <TabsContent value="servers">
            <AdminServersPanel 
              allowed={allowed} pending={pending} health={health} search={search} onSearchChange={setSearch} 
              onCheckAll={() => checkAllServers(true)} onAdd={() => setAddOpen(true)} onProbe={setProbeServer} 
              onEdit={(s) => { setEditingServer(s); setNewUrl(s.server_url); setNewLabel(s.label ?? ""); setNewNotes(s.notes ?? ""); setAddOpen(true); }} 
              onRemove={setConfirmRemoveServer} onAuthorizePending={(url) => { setNewUrl(url); setAddOpen(true); }} healthLoading={healthLoading} 
            />
          </TabsContent>
          
          <TabsContent value="reports"><UserReportsPanel /></TabsContent>
          <TabsContent value="team"><TeamPanel /></TabsContent>
          <TabsContent value="maintenance"><MaintenancePanel /></TabsContent>
          <TabsContent value="demo-creds"><DemoCredentialsPanel /></TabsContent>
          <TabsContent value="stats"><StatsPanel /></TabsContent>
          <TabsContent value="endpoint-test"><EndpointTestPanel allowedServers={allowed.map((s) => ({ server_url: s.server_url, label: s.label }))} onServerApplied={refresh} /></TabsContent>
          <TabsContent value="client-diagnostics"><ClientDiagnosticsPanel /></TabsContent>
          <TabsContent value="pending-signups"><PendingSignupsPanel /></TabsContent>
          <TabsContent value="blocked-dns"><BlockedDnsPanel /></TabsContent>
          <TabsContent value="stream-events"><StreamEventsPanel /></TabsContent>
        </Tabs>
      </main>

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setEditingServer(null); setNewUrl(""); setNewLabel(""); setNewNotes(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingServer ? "Editar DNS" : "Cadastrar DNS"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>URL do servidor *</Label><Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} disabled={!!editingServer} /></div>
            <div className="space-y-1"><Label>Nome / Revenda</Label><Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} /></div>
            <div className="space-y-1"><Label>Observações</Label><Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={() => allowServer(newUrl, newLabel, newNotes)} disabled={!newUrl}>{editingServer ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ServerProbeDialog open={!!probeServer} onOpenChange={(o) => !o && setProbeServer(null)} serverUrl={probeServer?.server_url ?? null} serverLabel={probeServer?.label ?? null} />
      <UserDetailDialog username={detailUsername} onClose={() => setDetailUsername(null)} />

      <AlertDialog open={!!confirmRemoveServer} onOpenChange={(o) => !o && setConfirmRemoveServer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Apagar DNS?</AlertDialogTitle><AlertDialogDescription>A DNS {confirmRemoveServer} será removida.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => confirmRemoveServer && removeServer(confirmRemoveServer)}>Apagar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmEvictSession} onOpenChange={(o) => !o && setConfirmEvictSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Encerrar sessão?</AlertDialogTitle><AlertDialogDescription>O usuário será desconectado.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => confirmEvictSession && evictSession(confirmEvictSession.anon_user_id)}>Encerrar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmUnblockUser} onOpenChange={(o) => !o && setConfirmUnblockUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Desbloquear usuário?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => confirmUnblockUser && unblockUser(confirmUnblockUser.anon_user_id)}>Desbloquear</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminBottomNav tab={tab} onTabChange={setTab} isAdmin={isAdmin} />
    </div>
  );
};

export default Admin;
