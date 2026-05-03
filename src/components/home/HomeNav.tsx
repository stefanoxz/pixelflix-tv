import { useState, useRef, useEffect, useCallback } from 'react';
import { Tv, Film, PlayCircle, Search, RefreshCcw, Settings, X, Loader2 } from 'lucide-react';
import { xtreamService } from '@/services/xtream';
import vibeLogo from '@/assets/vibe-logo.png';

interface HomeNavProps {
  onNavigate: (view: any, search?: string) => void;
  onLogout: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  icon?: string;
  type: 'live' | 'movie' | 'series';
}

const TYPE_LABEL: Record<string, string> = {
  live: 'Canal',
  movie: 'Filme',
  series: 'Série',
};

const TYPE_ICON: Record<string, React.ElementType> = {
  live: Tv,
  movie: Film,
  series: PlayCircle,
};

const navItems = [
  { id: 'live',     label: 'Canais',        icon: Tv },
  { id: 'movie',    label: 'Filmes',         icon: Film },
  { id: 'series',   label: 'Séries',         icon: PlayCircle },
  { id: 'sync',     label: 'Sincronizar',    icon: RefreshCcw },
  { id: 'settings', label: 'Configurações',  icon: Settings },
];

export const HomeNav = ({ onNavigate }: HomeNavProps) => {
  const [searchOpen, setSearchOpen]     = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [results, setResults]           = useState<SearchResult[]>([]);
  const [searching, setSearching]       = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const [live, movies, series] = await Promise.all([
        xtreamService.getStreams('live'),
        xtreamService.getStreams('movie'),
        xtreamService.getStreams('series'),
      ]);

      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const qn = normalize(q);

      const matched: SearchResult[] = [
        ...live.filter((s: any) => normalize(s.name || '').includes(qn))
          .slice(0, 4).map((s: any) => ({ id: String(s.stream_id), name: s.name, icon: s.stream_icon, type: 'live' as const })),
        ...movies.filter((s: any) => normalize(s.name || '').includes(qn))
          .slice(0, 5).map((s: any) => ({ id: String(s.stream_id), name: s.name, icon: s.stream_icon || s.cover, type: 'movie' as const })),
        ...series.filter((s: any) => normalize(s.name || '').includes(qn))
          .slice(0, 4).map((s: any) => ({ id: String(s.series_id || s.stream_id), name: s.name, icon: s.cover || s.stream_icon, type: 'series' as const })),
      ];
      setResults(matched);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
  };

  const handleSelectResult = (result: SearchResult) => {
    onNavigate(result.type, result.name);
    setSearchOpen(false);
    setSearchQuery('');
    setResults([]);
  };

  const handleClose = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') handleClose();
  };

  return (
    <header className="px-6 md:px-10 py-5 flex items-center justify-between gap-6 bg-black/80 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5" style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}>
      {/* Logo */}
      <div className="shrink-0 transition-transform hover:scale-105 duration-500">
        <img src={vibeLogo} alt="Vibe" className="h-24 w-auto object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.7)]" loading="eager" />
      </div>

      {/* Nav Pills */}
      <nav className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-1.5 backdrop-blur-md shadow-inner">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex items-center gap-3 px-8 py-3.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/8 transition-all text-base font-semibold tracking-wide whitespace-nowrap active:scale-95"
            >
              <item.icon size={20} className="opacity-60 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

          {/* Search trigger */}
          <button
            onClick={() => onNavigate('search')}
            className="flex items-center gap-3 px-8 py-3.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/8 transition-all text-base font-semibold tracking-wide group"
          >
            <Search size={20} className="opacity-60 group-hover:text-purple-400 transition-colors" />
            <span className="hidden lg:inline">Buscar</span>
          </button>
        </div>
      </nav>

      <div className="shrink-0">
        <button
          onClick={onLogout}
          className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 transition-all active:scale-90"
          title="Sair"
        >
          <X size={20} />
        </button>
      </div>
    </header>
  );
};
