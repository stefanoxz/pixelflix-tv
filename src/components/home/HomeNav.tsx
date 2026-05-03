import { useState, useRef, useEffect } from 'react';
import { Tv, Film, PlayCircle, Search, RefreshCcw, Settings, X } from 'lucide-react';
import vibeLogo from '@/assets/vibe-logo.png';

interface HomeNavProps {
  onNavigate: (view: any, search?: string) => void;
  onLogout: () => void;
}

export const HomeNav = ({ onNavigate }: HomeNavProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchOpen(false);
      setSearchQuery('');
    }
    // Only navigate on Enter to avoid leaving the page while typing
    if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
      onNavigate('search', searchQuery.trim());
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navItems = [
    { id: 'live',     label: 'Canais',   icon: Tv },
    { id: 'movie',    label: 'Filmes',    icon: Film },
    { id: 'series',   label: 'Séries',    icon: PlayCircle },
    { id: 'sync',     label: 'Sync',      icon: RefreshCcw },
    { id: 'settings', label: 'Config',    icon: Settings },
  ];

  return (
    <header className="px-6 md:px-10 py-4 flex items-center justify-between gap-4 bg-black/80 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
      {/* Logo */}
      <div className="shrink-0">
        <img
          src={vibeLogo}
          alt="Vibe"
          className="h-8 w-auto object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
          loading="eager"
        />
      </div>

      {/* Nav buttons + Search - all in one row */}
      <nav className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-1 backdrop-blur-md shadow-inner">
          
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/8 transition-all text-[10px] font-bold whitespace-nowrap active:scale-95"
            >
              <item.icon size={13} className="opacity-70 shrink-0" />
              <span className="hidden sm:inline tracking-wide">{item.label}</span>
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

          {/* Search - inline expandable */}
          {searchOpen ? (
            <div className="flex items-center gap-2 px-3 py-1.5 min-w-[200px] max-w-[280px]">
              <Search size={12} className="text-purple-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar... (Enter)"
                className="flex-1 bg-transparent text-white text-[11px] font-medium placeholder:text-zinc-600 outline-none w-full"
              />
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="text-zinc-600 hover:text-white transition-colors shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/8 transition-all text-[10px] font-bold whitespace-nowrap active:scale-95"
            >
              <Search size={13} className="opacity-70" />
              <span className="hidden sm:inline tracking-wide">Buscar</span>
            </button>
          )}
        </div>
      </nav>

      {/* Version */}
      <div className="shrink-0 hidden md:block">
        <span className="text-[9px] font-bold text-zinc-700 tracking-widest">v1.5.10</span>
      </div>
    </header>
  );
};
