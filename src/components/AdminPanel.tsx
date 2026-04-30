import { useState, useEffect } from 'react';
import { ChevronLeft, Save, Globe, Lock, Shield, CheckCircle2, Palette, Image as ImageIcon } from 'lucide-react';
import { getSettings, updateSettings } from '../services/supabase';

interface AdminPanelProps {
  onBack: () => void;
}

export const AdminPanel = ({ onBack }: AdminPanelProps) => {
  const [dnsUrl, setDnsUrl] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [siteLogo, setSiteLogo] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#ffffff');
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
        setSiteLogo(data.site_logo || '');
        setPrimaryColor(data.primary_color || '#ffffff');
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
        admin_password: adminPassword,
        site_logo: siteLogo,
        primary_color: primaryColor
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
          <button onClick={onBack} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white border border-white/5">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-widest">Painel Master</h2>
            <p className="text-[10px] font-bold text-zinc-500 tracking-[0.3em] uppercase">Refatoração Pro Ativa</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {success && (
            <div className="flex items-center gap-2 text-green-500 text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-right-4">
              <CheckCircle2 size={16} /> Configurações Salvas
            </div>
          )}
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Tudo'} <Save size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 md:p-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* DNS URL Card */}
          <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-10 space-y-8">
            <div className="w-16 h-16 rounded-[24px] bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20"><Globe size={32} /></div>
            <div className="space-y-4">
              <h3 className="text-xl font-black">Infraestrutura Xtream</h3>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">DNS Principal</label>
                <input type="text" value={dnsUrl} onChange={(e) => setDnsUrl(e.target.value)} className="w-full bg-white/5 border border-white/5 text-white px-6 py-4 rounded-2xl focus:outline-none focus:bg-white/10 transition-all font-bold text-sm" placeholder="http://bkpac.cc" />
              </div>
            </div>
          </div>

          {/* Admin Security Card */}
          <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-10 space-y-8">
            <div className="w-16 h-16 rounded-[24px] bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20"><Shield size={32} /></div>
            <div className="space-y-4">
              <h3 className="text-xl font-black">Segurança do Painel</h3>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Senha Master</label>
                <input type="text" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full bg-white/5 border border-white/5 text-white px-6 py-4 rounded-2xl focus:outline-none focus:bg-white/10 transition-all font-bold text-sm" />
              </div>
            </div>
          </div>

          {/* Branding Card */}
          <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-10 space-y-8">
            <div className="w-16 h-16 rounded-[24px] bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20"><Palette size={32} /></div>
            <div className="space-y-4">
              <h3 className="text-xl font-black">Identidade Visual</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Cor Principal</label>
                  <div className="flex gap-4">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-16 h-12 bg-transparent border-none cursor-pointer" />
                    <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 bg-white/5 border border-white/5 text-white px-6 py-4 rounded-2xl focus:outline-none focus:bg-white/10 transition-all font-bold text-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Logo Card */}
          <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-10 space-y-8">
            <div className="w-16 h-16 rounded-[24px] bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/20"><ImageIcon size={32} /></div>
            <div className="space-y-4">
              <h3 className="text-xl font-black">Logotipo Customizado</h3>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">URL do Logo (PNG/SVG)</label>
                <input type="text" value={siteLogo} onChange={(e) => setSiteLogo(e.target.value)} className="w-full bg-white/5 border border-white/5 text-white px-6 py-4 rounded-2xl focus:outline-none focus:bg-white/10 transition-all font-bold text-sm" placeholder="https://..." />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
