import { Tv, Film, PlayCircle, Settings, User, LogOut, Search, ArrowRight, UserCircle, RefreshCcw } from 'lucide-react';
import vibeLogo from '@/assets/vibe-logo.png';

interface Profile {
  id: string;
  profile_name: string;
  avatar_url: string;
}

interface DashboardProps {
  onLogout: () => void;
  onNavigate: (view: 'live' | 'movie' | 'series' | 'settings' | 'profiles' | 'sync') => void;
  profile: Profile | null;
}

export const Dashboard = ({ onLogout, onNavigate, profile }: DashboardProps) => {
  const menuItems = [
    { id: 'live', label: 'CANAIS AO VIVO', icon: Tv, color: 'from-blue-600 to-cyan-500', count: '2.500+' },
    { id: 'movie', label: 'FILMES', icon: Film, color: 'from-purple-600 to-pink-500', count: '10.000+' },
    { id: 'series', label: 'SÉRIES', icon: PlayCircle, color: 'from-orange-600 to-red-500', count: '3.000+' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans selection:bg-white/10">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[60%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[60%] h-[40%] bg-purple-600/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="px-6 md:px-12 py-8 flex items-center justify-between border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-12">
          <div className="group cursor-pointer flex items-center" onClick={() => onNavigate('dashboard' as any)}>
            <img 
              src={vibeLogo} 
              alt="Vibe" 
              className="h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.4)] group-hover:drop-shadow-[0_0_25px_rgba(168,85,247,0.6)] transition-all"
            />
          </div>
          <nav className="hidden lg:flex items-center gap-10">
            <button className="text-zinc-500 hover:text-white transition-all text-[11px] font-black tracking-[0.3em] uppercase relative after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-0 hover:after:w-full after:h-0.5 after:bg-white after:transition-all">Início</button>
            <button className="text-zinc-500 hover:text-white transition-all text-[11px] font-black tracking-[0.3em] uppercase relative after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-0 hover:after:w-full after:h-0.5 after:bg-white after:transition-all">Minha Lista</button>
            <button className="text-zinc-500 hover:text-white transition-all text-[11px] font-black tracking-[0.3em] uppercase relative after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-0 hover:after:w-full after:h-0.5 after:bg-white after:transition-all">Novidades</button>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center bg-white/5 border border-white/5 rounded-2xl px-4 py-2 group focus-within:border-white/20 transition-all">
            <Search size={18} className="text-zinc-500 group-focus-within:text-white" />
            <input type="text" placeholder="Buscar título..." className="bg-transparent border-none outline-none px-3 text-sm font-medium w-48 placeholder:text-zinc-700" />
          </div>
          <div className="h-8 w-[1px] bg-white/10 hidden md:block" />
          <button 
            onClick={onLogout}
            className="group flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-red-900/20 active:scale-95"
          >
            Sair do Sistema
            <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </header>

      {/* Hero / Welcome */}
      <main className="flex-1 p-6 md:p-12 max-w-[1600px] mx-auto w-full relative">
        <div className="mb-16">
          <h2 className="text-zinc-600 text-[11px] font-black tracking-[0.5em] uppercase mb-4 animate-in fade-in slide-in-from-left duration-700">Explorar catálogo</h2>
          <h3 className="text-5xl md:text-7xl font-black tracking-tighter leading-none animate-in fade-in slide-in-from-bottom duration-1000">Sua jornada começa aqui.</h3>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {menuItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as any)}
              className="group relative aspect-[16/10] lg:aspect-[3/4] rounded-[56px] overflow-hidden transition-all duration-700 hover:scale-[1.03] hover:shadow-[0_40px_80px_rgba(0,0,0,0.5)] active:scale-95"
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-90 transition-transform duration-700 group-hover:scale-110`} />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors duration-500" />
              
              <div className="absolute inset-0 p-12 flex flex-col justify-between items-start text-left z-10">
                <div className="p-5 rounded-[28px] bg-white/10 backdrop-blur-2xl border border-white/20 shadow-xl group-hover:rotate-12 transition-transform duration-500">
                  <item.icon size={36} strokeWidth={2.5} />
                </div>
                
                <div className="space-y-4">
                  <span className="text-[10px] font-black tracking-[0.5em] opacity-60 mb-2 block animate-pulse">{item.count} DISPONÍVEIS</span>
                  <h4 className="text-4xl font-black leading-none tracking-tight">{item.label}</h4>
                  <div className="flex items-center gap-3 text-[10px] font-black tracking-[0.3em] uppercase opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 duration-500">
                    <span className="bg-white text-black px-4 py-2 rounded-full shadow-lg">Entrar agora</span>
                    <div className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center">
                      <ArrowRight size={14} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced glass effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 blur-[80px] rounded-full group-hover:bg-white/20 transition-all duration-1000" />
            </button>
          ))}
        </div>

        {/* User Info Card */}
        <div className="mt-12 bg-[#0A0A0A] border border-white/5 rounded-[32px] p-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => onNavigate('profiles')}
              className="relative group w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shadow-lg"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.profile_name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                  <User size={32} className="text-zinc-500" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <RefreshCcw size={16} className="text-white" />
              </div>
            </button>
            <div>
              <p className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Perfil Ativo</p>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold">{profile?.profile_name || 'Usuário'}</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-bold border border-blue-500/20 uppercase tracking-tighter">Conectado</span>
              </div>
            </div>
          </div>

          <div className="flex gap-12 text-center md:text-left">
            <div>
              <p className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Expira em</p>
              <p className="font-bold">25 de Out, 2026</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Conexões</p>
              <p className="font-bold">1 / 3</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="p-8 text-center border-t border-white/5 bg-black/40">
        <p className="text-[10px] font-bold text-zinc-600 tracking-[0.3em] uppercase">Vibe WebPlayer &copy; 2026 &bull; Desenvolvido por SuperTech</p>
      </footer>
    </div>
  );
};

// Redundant local ArrowRight removed, using lucide-react version
