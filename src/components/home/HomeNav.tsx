import { Tv, Film, PlayCircle, Calendar, Search, RefreshCcw, Settings } from 'lucide-react';
import vibeLogo from '@/assets/vibe-logo.png';

interface HomeNavProps {
  onNavigate: (view: any) => void;
  onLogout: () => void;
}

const navItems = [
  { id: 'live', label: 'Canais', icon: Tv },
  { id: 'movie', label: 'Filmes', icon: Film },
  { id: 'series', label: 'Séries', icon: PlayCircle },
  { id: 'events', label: 'Eventos', icon: Calendar },
  { id: 'search', label: 'Buscar', icon: Search },
  { id: 'reload', label: 'Recarregar', icon: RefreshCcw },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export const HomeNav = ({ onNavigate, onLogout }: HomeNavProps) => {
  const handleClick = (id: string) => {
    if (id === 'reload') return window.location.reload();
    if (id === 'search') return;
    if (id === 'events') return;
    onNavigate(id);
  };

  return (
    <header className="px-6 md:px-10 py-5 flex items-center justify-between gap-6 bg-black/80 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
      <div className="flex items-center gap-3 shrink-0">
        <img
          src={vibeLogo}
          alt="Vibe Premium WebPlayer"
          className="h-9 w-auto object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
          loading="eager"
        />
      </div>

      <nav className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-1.5 backdrop-blur-md overflow-x-auto no-scrollbar shadow-inner">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-[11px] font-bold whitespace-nowrap active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <item.icon size={14} className="opacity-70" />
              <span className="hidden lg:inline tracking-wide">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden md:block text-[10px] font-bold text-zinc-600 tracking-widest">v1.5.10</span>
      </div>
    </header>
  );
};
