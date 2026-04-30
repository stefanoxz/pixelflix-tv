import { Tv, Film, PlayCircle, Settings, User, LogOut, Search } from 'lucide-react';

interface DashboardProps {
  onLogout: () => void;
  onNavigate: (view: 'live' | 'movie' | 'series' | 'settings') => void;
}

export const Dashboard = ({ onLogout, onNavigate }: DashboardProps) => {
  const menuItems = [
    { id: 'live', label: 'CANAIS AO VIVO', icon: Tv, color: 'from-blue-600 to-cyan-500', count: '2.500+' },
    { id: 'movie', label: 'FILMES', icon: Film, color: 'from-purple-600 to-pink-500', count: '10.000+' },
    { id: 'series', label: 'SÉRIES', icon: PlayCircle, color: 'from-orange-600 to-red-500', count: '3.000+' },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-black tracking-[0.2em]">BLACK</h1>
          <nav className="hidden md:flex items-center gap-6">
            <button className="text-zinc-400 hover:text-white transition-colors text-sm font-bold tracking-widest uppercase">Home</button>
            <button className="text-zinc-400 hover:text-white transition-colors text-sm font-bold tracking-widest uppercase">Favoritos</button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white">
            <Search size={20} />
          </button>
          <button className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white">
            <Settings size={20} />
          </button>
          <div className="h-8 w-[1px] bg-white/10 mx-2" />
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-xl transition-all font-bold text-xs uppercase tracking-widest border border-red-500/20"
          >
            Sair
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Hero / Welcome */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <div className="mb-12">
          <h2 className="text-zinc-500 text-sm font-bold tracking-[0.3em] uppercase mb-2">Bem-vindo de volta</h2>
          <h3 className="text-4xl font-black">O que vamos assistir hoje?</h3>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as any)}
              className="group relative aspect-[4/5] md:aspect-[3/4] rounded-[40px] overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-white/5 active:scale-[0.98]"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-80`} />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
              
              <div className="absolute inset-0 p-10 flex flex-col justify-between items-start text-left">
                <div className="p-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20">
                  <item.icon size={32} />
                </div>
                
                <div>
                  <span className="text-xs font-bold tracking-[0.3em] opacity-70 mb-2 block">{item.count} TÍTULOS</span>
                  <h4 className="text-3xl font-black leading-tight">{item.label}</h4>
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                    Acessar agora
                    <ArrowRight size={14} className="ml-1" />
                  </div>
                </div>
              </div>

              {/* Decorative light effect */}
              <div className="absolute -top-[20%] -right-[20%] w-[60%] h-[60%] bg-white/10 blur-[60px] rounded-full group-hover:bg-white/20 transition-all" />
            </button>
          ))}
        </div>

        {/* User Info Card */}
        <div className="mt-12 bg-[#0A0A0A] border border-white/5 rounded-[32px] p-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-white/10">
              <User size={32} className="text-zinc-500" />
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Status da Conta</p>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold">Premium User</span>
                <span className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-500 text-[10px] font-bold border border-green-500/20 uppercase tracking-tighter">Ativo</span>
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

      <footer className="p-8 text-center border-t border-white/5">
        <p className="text-[10px] font-bold text-zinc-600 tracking-[0.3em] uppercase">SuperTech WebPlayer &copy; 2026</p>
      </footer>
    </div>
  );
};

const ArrowRight = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M5 12h14m-7-7 7 7-7 7" />
  </svg>
);
