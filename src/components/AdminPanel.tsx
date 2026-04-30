import { useState, useEffect } from 'react';
import { ChevronLeft, Save, Globe, Lock, Shield, CheckCircle2 } from 'lucide-react';
import { getSettings, updateSettings } from '../services/supabase';

interface AdminPanelProps {
  onBack: () => void;
}

export const AdminPanel = ({ onBack }: AdminPanelProps) => {
  const [dnsUrl, setDnsUrl] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [settingsId, setSettingsId] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const data = await getSettings();
      if (data) {
        setDnsUrl(data.dns_url);
        setAdminPassword(data.admin_password);
        setSettingsId(data.id);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      await updateSettings(settingsId, { 
        dns_url: dnsUrl, 
        admin_password: adminPassword 
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-white/5 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/10">
      <header className="px-8 py-8 flex items-center justify-between border-b border-white/5 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white border border-white/5"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-widest">Painel Admin</h2>
            <p className="text-[10px] font-bold text-zinc-500 tracking-[0.3em] uppercase">Gerenciamento do Sistema</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {success && (
            <div className="flex items-center gap-2 text-green-500 text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-right-4">
              <CheckCircle2 size={16} />
              Configurações Salvas
            </div>
          )}
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
            <Save size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-8 md:p-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* DNS URL Card */}
          <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-10 space-y-8">
            <div className="w-16 h-16 rounded-[24px] bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
              <Globe size={32} />
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-black mb-1">Configuração DNS</h3>
                <p className="text-zinc-500 text-xs font-medium">A URL base que o player usará para autenticar todos os clientes.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">DNS Atual</label>
                <input
                  type="text"
                  value={dnsUrl}
                  onChange={(e) => setDnsUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 text-white px-6 py-4 rounded-2xl focus:outline-none focus:bg-white/10 transition-all font-bold text-sm"
                  placeholder="http://exemplo.com:8080"
                />
              </div>
            </div>
          </div>

          {/* Admin Security Card */}
          <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-10 space-y-8">
            <div className="w-16 h-16 rounded-[24px] bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
              <Shield size={32} />
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-black mb-1">Segurança Admin</h3>
                <p className="text-zinc-500 text-xs font-medium">A senha master para acessar este painel de controle.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Senha Master</label>
                <div className="relative">
                  <input
                    type="text"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 text-white px-6 py-4 rounded-2xl focus:outline-none focus:bg-white/10 transition-all font-bold text-sm"
                    placeholder="1234"
                  />
                  <Lock size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-700" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="mt-12 bg-[#0A0A0A] border border-white/5 rounded-[40px] p-10">
          <h3 className="text-xs font-black text-zinc-600 tracking-[0.4em] uppercase mb-8">Informações do Sistema</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Status DNS</p>
              <p className="text-green-500 font-black text-sm uppercase">Ativo</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Versão</p>
              <p className="font-black text-sm">1.0.1 Stable</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Database</p>
              <p className="font-black text-sm uppercase">Cloud</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Uptime</p>
              <p className="font-black text-sm uppercase">99.9%</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
