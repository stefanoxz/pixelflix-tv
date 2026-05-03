import { useState, useRef, useEffect } from 'react';
import { Tv, Film, PlayCircle, Search, RefreshCcw, Settings, X } from 'lucide-react';
import vibeLogo from '@/assets/vibe-logo.png';

interface HomeNavProps {
  onNavigate: (view: any, search?: string) => void;
  onLogout: () => void;
}

const navItems = [
  { id: 'live',     label: 'Canais',        icon: Tv },
  { id: 'movie',    label: 'Filmes',         icon: Film },
  { id: 'series',   label: 'Séries',         icon: PlayCircle },
  { id: 'sync',     label: 'Sincronizar',    icon: RefreshCcw },
  { id: 'settings', label: 'Configurações',  icon: Settings },
];

export const HomeNav = ({ onNavigate, onLogout }: HomeNavProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
    }
  }, [searchOpen]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    // Navigate to the content type based on current view — default to 'movie' for global search
    // The search query will be picked up by ContentExplorer via the searchQuery prop
    if (q.length >= 2) {
      onNavigate('search', q);
    }
  };

  const handleCloseSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleCloseSearch();
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

      {searchOpen ? (
        // Search bar expanded
        <div className="flex-1 flex items-center gap-3 bg-white/5 border border-purple-500/40 rounded-full px-5 py-2.5 backdrop-blur-md shadow-inner transition-all">
          <Search size={16} className="text-purple-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            onKeyDown={handleKeyDown}
            placeholder="Buscar canais, filmes ou séries..."
            className="flex-1 bg-transparent text-white text-sm font-medium placeholder:text-zinc-500 outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
          <button
            onClick={handleCloseSearch}
            className="text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest ml-2 transition-colors"
          >
            Fechar
          </button>
        </div>
      ) : (
        // Normal nav
        <nav className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-1.5 backdrop-blur-md overflow-x-auto no-scrollbar shadow-inner">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-[11px] font-bold whitespace-nowrap active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <item.icon size={14} className="opacity-70" />
                <span className="hidden lg:inline tracking-wide">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      <div className="flex items-center gap-3 shrink-0">
        {!searchOpen && (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-purple-500/20 hover:border-purple-500/30 transition-all text-[11px] font-bold"
          >
            <Search size={14} />
            <span className="hidden lg:inline tracking-wide">Buscar</span>
          </button>
        )}
        <span className="hidden md:block text-[10px] font-bold text-zinc-600 tracking-widest">v1.5.10</span>
      </div>
    </header>
  );
};
