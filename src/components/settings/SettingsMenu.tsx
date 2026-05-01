import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  PlayCircle, 
  ShieldAlert, 
  Info, 
  Database, 
  RefreshCw, 
  LogOut, 
  ArrowLeft,
  ChevronRight,
  Lock,
  Zap,
  CheckCircle2,
  AlertCircle,
  HardDrive
} from 'lucide-react';
import { settingsService, AppSettings, PlayerType } from '../../services/settingsService';
import { xtreamService } from '../../services/xtream';
import { contentActions } from '../../services/content';

interface SettingsMenuProps {
  onBack: () => void;
  onLogout: () => void;
}

type SettingsSection = 'player' | 'adult' | 'app' | 'info' | 'data';

export const SettingsMenu = ({ onBack, onLogout }: SettingsMenuProps) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('player');
  const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());
  const [userInfo, setUserInfo] = useState<any>(null);
  const [storageInfo, setStorageInfo] = useState({ used: '0 B', total: '0 B', percent: 0 });
  const [stats, setStats] = useState({ favChannels: 0, favMovies: 0, favSeries: 0, contMovies: 0, contSeries: 0 });
  
  // PIN change state
  const [pinState, setPinState] = useState({ current: '', new: '' });
  const [pinMessage, setPinMessage] = useState({ text: '', type: 'info' as 'info' | 'success' | 'error' });

  useEffect(() => {
    // Load user info for Information section
    const loadInfo = async () => {
      try {
        const data = await xtreamService.authenticate();
        setUserInfo(data.user_info);
      } catch (err) {
        console.error('Failed to load user info:', err);
      }
    };
    
    // Load storage info and stats for Data section
    const loadDataStats = async () => {
      // Mock storage info based on image
      setStorageInfo({ used: '1.36 MB', total: '571.82 GB', percent: 0.01 });
      
      const username = xtreamService.getCredentials()?.username || 'user';
      const favorites = await contentActions.getFavorites(username);
      setStats({
        favChannels: favorites.filter((f: any) => f.type === 'live').length,
        favMovies: favorites.filter((f: any) => f.type === 'movie').length,
        favSeries: favorites.filter((f: any) => f.type === 'series').length,
        contMovies: 0, // Placeholder as we don't have this service yet
        contSeries: 0
      });
    };

    loadInfo();
    loadDataStats();
  }, []);

  const handleUpdateSetting = (update: Partial<AppSettings>) => {
    const updated = { ...settings, ...update };
    setSettings(updated);
    settingsService.updateSettings(update);
  };

  const handleSavePin = () => {
    if (pinState.current !== settings.adultPin) {
      setPinMessage({ text: 'PIN atual incorreto', type: 'error' });
      return;
    }
    if (pinState.new.length < 4) {
      setPinMessage({ text: 'Novo PIN deve ter no mínimo 4 dígitos', type: 'error' });
      return;
    }
    handleUpdateSetting({ adultPin: pinState.new });
    setPinState({ current: '', new: '' });
    setPinMessage({ text: 'PIN alterado com sucesso', type: 'success' });
    setTimeout(() => setPinMessage({ text: '', type: 'info' }), 3000);
  };

  const handleClearFavorites = async () => {
    if (window.confirm('Deseja realmente limpar todos os favoritos?')) {
      try {
        const username = xtreamService.getCredentials()?.username || 'user';
        await contentActions.clearFavorites(username);
        setStats(prev => ({ ...prev, favChannels: 0, favMovies: 0, favSeries: 0 }));
        alert('Favoritos limpos com sucesso!');
      } catch (err) {
        console.error('Failed to clear favorites:', err);
        alert('Erro ao limpar favoritos.');
      }
    }
  };

  const menuItems = [
    { id: 'player', label: 'Player', icon: PlayCircle },
    { id: 'adult', label: 'Adulto', icon: ShieldAlert },
    { id: 'app', label: 'Aplicativo', icon: Settings },
    { id: 'info', label: 'Informações', icon: Info },
    { id: 'data', label: 'Dados', icon: Database },
  ];

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/5 bg-[#080808]/50 flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10 px-4">
          <Settings className="text-purple-500" size={24} />
          <h1 className="text-xl font-black uppercase tracking-widest">Configurações</h1>
        </div>

        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as SettingsSection)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
                activeSection === item.id 
                  ? 'bg-purple-600 text-white shadow-[0_10px_20px_rgba(147,51,234,0.3)]' 
                  : 'text-zinc-500 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-4">
                <item.icon size={20} className={activeSection === item.id ? 'text-white' : 'group-hover:text-purple-500 transition-colors'} />
                <span className="font-bold tracking-wide">{item.label}</span>
              </div>
              <ChevronRight size={16} className={activeSection === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} />
            </button>
          ))}
        </nav>

        <div className="space-y-2 mt-auto pt-6 border-t border-white/5">
          <button onClick={() => window.location.reload()} className="w-full flex items-center gap-4 p-4 rounded-2xl text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
            <RefreshCw size={20} />
            <span className="font-bold tracking-wide">Recarregar</span>
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-4 p-4 rounded-2xl text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-all">
            <LogOut size={20} />
            <span className="font-bold tracking-wide">Deslogar</span>
          </button>
          <button onClick={onBack} className="w-full flex items-center gap-4 p-4 rounded-2xl text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
            <ArrowLeft size={20} />
            <span className="font-bold tracking-wide">Retornar</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-12 custom-scrollbar relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        
        <div className="max-w-4xl mx-auto space-y-10 relative z-10">
          
          {activeSection === 'player' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 mb-2">
                <PlayCircle size={28} className="text-purple-500" />
                <h2 className="text-2xl font-black uppercase tracking-widest">Player</h2>
              </div>
              
              <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-8 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-zinc-400 mb-2">
                    <RefreshCw size={18} />
                    <span className="text-sm font-bold uppercase tracking-widest">Tipo de Player</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => handleUpdateSetting({ playerType: 'm3u8' })}
                      className={`p-5 rounded-2xl border transition-all flex items-center justify-center gap-3 ${
                        settings.playerType === 'm3u8' 
                          ? 'bg-purple-600/10 border-purple-500 text-white' 
                          : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20'
                      }`}
                    >
                      <PlayCircle size={20} />
                      <span className="font-black tracking-widest uppercase">HLS (M3U8)</span>
                    </button>
                    <button 
                      onClick={() => handleUpdateSetting({ playerType: 'ts' })}
                      className={`p-5 rounded-2xl border transition-all flex items-center justify-center gap-3 ${
                        settings.playerType === 'ts' 
                          ? 'bg-purple-600/10 border-purple-500 text-white' 
                          : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20'
                      }`}
                    >
                      <Zap size={20} />
                      <span className="font-black tracking-widest uppercase">MPEGTS (TS)</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${settings.p2pEnabled ? 'bg-green-500' : 'bg-zinc-700'}`} onClick={() => handleUpdateSetting({ p2pEnabled: !settings.p2pEnabled })}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.p2pEnabled ? 'left-7' : 'left-1'}`} />
                    </div>
                    <span className="font-bold tracking-widest uppercase">P2P: {settings.p2pEnabled ? 'Ligado' : 'Desligado'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'adult' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 mb-2">
                <ShieldAlert size={28} className="text-purple-500" />
                <h2 className="text-2xl font-black uppercase tracking-widest">Adulto</h2>
              </div>
              
              <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-8 space-y-8">
                <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${settings.adultLockEnabled ? 'bg-green-500' : 'bg-zinc-700'}`} onClick={() => handleUpdateSetting({ adultLockEnabled: !settings.adultLockEnabled })}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.adultLockEnabled ? 'left-7' : 'left-1'}`} />
                    </div>
                    <span className="font-bold tracking-widest uppercase">Bloqueio Adulto: {settings.adultLockEnabled ? 'Ligado' : 'Desligado'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-zinc-400">
                      <Lock size={18} />
                      <span className="text-sm font-bold uppercase tracking-widest">PIN Atual</span>
                    </div>
                    <input 
                      type="password" 
                      maxLength={4}
                      value={pinState.current}
                      onChange={(e) => setPinState({...pinState, current: e.target.value})}
                      placeholder="****"
                      className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl focus:border-purple-500 outline-none transition-all font-mono text-xl tracking-[1em]"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-zinc-400">
                      <Lock size={18} />
                      <span className="text-sm font-bold uppercase tracking-widest">Novo PIN (mín. 4)</span>
                    </div>
                    <input 
                      type="password" 
                      maxLength={4}
                      value={pinState.new}
                      onChange={(e) => setPinState({...pinState, new: e.target.value})}
                      placeholder="****"
                      className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl focus:border-purple-500 outline-none transition-all font-mono text-xl tracking-[1em]"
                    />
                  </div>
                </div>

                {pinMessage.text && (
                  <div className={`flex items-center gap-3 p-4 rounded-xl text-sm font-bold ${pinMessage.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                    {pinMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    {pinMessage.text}
                  </div>
                )}

                <button onClick={handleSavePin} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all">
                  Mudar PIN
                </button>
              </div>
            </div>
          )}

          {activeSection === 'info' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 mb-2">
                <Info size={28} className="text-purple-500" />
                <h2 className="text-2xl font-black uppercase tracking-widest">Informações da Assinatura</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <InfoBox label="Usuário" value={userInfo?.username || '—'} />
                <InfoBox label="Status" value={userInfo?.status === 'Active' ? 'Active' : 'Inativo'} isStatus />
                <InfoBox label="Expiração" value={userInfo?.exp_date ? new Date(parseInt(userInfo.exp_date) * 1000).toLocaleString() : '—'} />
                <InfoBox label="Telas Contratadas" value={userInfo?.max_connections || '1'} />
                <InfoBox label="Formatos Permitidos" value="M3U8, TS" fullWidth />
              </div>
            </div>
          )}

          {activeSection === 'app' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 mb-2">
                <Settings size={28} className="text-purple-500" />
                <h2 className="text-2xl font-black uppercase tracking-widest">Aplicativo</h2>
              </div>
              
              <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <span className="font-bold text-zinc-400">Versão do App</span>
                    <span className="font-black text-purple-500">v1.5.10</span>
                  </div>
                  <div className="p-6 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <span className="font-bold text-zinc-400">Ambiente</span>
                    <span className="font-black text-green-500">Produção</span>
                  </div>
                </div>
                
                <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                  <h3 className="font-black uppercase tracking-widest text-xs text-zinc-500">Sobre o App</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    O Pixelflix TV é o webplayer definitivo para streaming de conteúdos IPTV, focado em performance, design premium e facilidade de uso. Desenvolvido com as tecnologias mais modernas do mercado.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'data' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 mb-2">
                <Database size={28} className="text-purple-500" />
                <h2 className="text-2xl font-black uppercase tracking-widest">Dados</h2>
              </div>
              
              <div className="grid grid-cols-5 gap-6">
                <div className="col-span-3 space-y-6">
                  <div className="p-6 bg-[#0A0A0A] border border-white/5 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3 text-zinc-500">
                      <RefreshCw size={18} />
                      <span className="text-xs font-black uppercase tracking-widest">Dados de mídia</span>
                    </div>
                    <span className="text-2xl font-black">0 B</span>
                  </div>
                  
                  <div className="p-6 bg-[#0A0A0A] border border-white/5 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3 text-zinc-500">
                      <HardDrive size={18} />
                      <span className="text-xs font-black uppercase tracking-widest">Quota de armazenamento do app</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-black">
                        <span>{storageInfo.used} de {storageInfo.total}</span>
                        <span className="text-purple-500">({Math.round(storageInfo.percent * 100)}%)</span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: `${storageInfo.percent * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={handleClearFavorites} className="flex-1 p-5 bg-white/5 border border-white/5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all">
                      Limpar Favoritos
                    </button>
                    <button 
                      onClick={() => {
                        localStorage.removeItem('pixelflix_continue_watching');
                        setStats(prev => ({ ...prev, contMovies: 0, contSeries: 0 }));
                        alert('Histórico de reprodução limpo!');
                      }}
                      className="flex-1 p-5 bg-white/5 border border-white/5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Limpar Continue Assistindo
                    </button>
                    <button 
                      onClick={async () => {
                        const username = xtreamService.getCredentials()?.username || 'user';
                        const favorites = await contentActions.getFavorites(username);
                        setStats(prev => ({
                          ...prev,
                          favChannels: favorites.filter((f: any) => f.type === 'live').length,
                          favMovies: favorites.filter((f: any) => f.type === 'movie').length,
                          favSeries: favorites.filter((f: any) => f.type === 'series').length,
                        }));
                        alert('Estatísticas atualizadas!');
                      }}
                      className="p-5 bg-purple-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition-all"
                    >
                      Atualizar
                    </button>
                  </div>
                </div>

                <div className="col-span-2 p-8 bg-[#0A0A0A] border border-white/5 rounded-3xl space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Categorias</h3>
                  <StatRow label="Canais Favoritos" value={stats.favChannels} />
                  <StatRow label="Filmes Favoritos" value={stats.favMovies} />
                  <StatRow label="Séries Favoritas" value={stats.favSeries} />
                  <StatRow label="Continue - Filmes" value={stats.contMovies} />
                  <StatRow label="Continue - Séries" value={stats.contSeries} />
                </div>
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex gap-4 pt-10 border-t border-white/5">
            <button 
              onClick={() => alert('Configurações aplicadas com sucesso!')}
              className="px-10 py-5 bg-white text-black font-black uppercase tracking-widest hover:bg-zinc-200 transition-all rounded-2xl"
            >
              Salvar
            </button>
            <button onClick={() => { settingsService.reset(); setSettings(settingsService.getSettings()); }} className="px-10 py-5 bg-white/5 border border-white/5 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all">
              Restaurar padrão
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

const InfoBox = ({ label, value, isStatus, fullWidth }: { label: string, value: string, isStatus?: boolean, fullWidth?: boolean }) => (
  <div className={`p-8 bg-[#0A0A0A] border border-white/5 rounded-3xl space-y-3 ${fullWidth ? 'col-span-2' : ''}`}>
    <div className="flex items-center gap-3 text-zinc-500">
      {label === 'Usuário' && <Database size={16} />}
      {label === 'Status' && <CheckCircle2 size={16} />}
      {label === 'Expiração' && <RefreshCw size={16} />}
      {label === 'Telas Contratadas' && <Info size={16} />}
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <div className={`text-xl font-black ${isStatus ? 'text-green-500' : 'text-white'}`}>
      {value}
    </div>
  </div>
);

const StatRow = ({ label, value }: { label: string, value: number }) => (
  <div className="flex items-center justify-between group">
    <span className="text-xs font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-sm font-black">{value}</span>
      <span className="text-[10px] text-zinc-600">(0 B)</span>
    </div>
  </div>
);
