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
    <header className="px-6 md:px-10 py-4 flex items-center justify-between gap-6 bg-black/80 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
      {/* Logo */}
      <div className="shrink-0">
        <img src={vibeLogo} alt="Vibe" className="h-9 w-auto object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" loading="eager" />
      </div>

      {/* Nav Pills */}
      <nav className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-1.5 backdrop-blur-md shadow-inner">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full text-zinc-400 hover:text-white hover:bg-white/8 transition-all text-sm font-bold whitespace-nowrap active:scale-95"
            >
              <item.icon size={17} className="opacity-70 shrink-0" />
              <span className="hidden lg:inline tracking-wide">{item.label}</span>
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

          {/* Search trigger or inline input */}
          {!searchOpen ? (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full text-zinc-400 hover:text-white hover:bg-white/8 transition-all text-sm font-bold"
            >
              <Search size={17} className="opacity-70" />
              <span className="hidden lg:inline tracking-wide">Buscar</span>
            </button>
          ) : (
            <div ref={wrapRef} className="relative flex items-center gap-2 px-4 py-2 min-w-[240px]">
              <Search size={13} className="text-purple-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Canais, filmes, séries..."
                className="flex-1 bg-transparent text-white text-xs font-medium placeholder:text-zinc-600 outline-none"
              />
              {searching
                ? <Loader2 size={13} className="text-purple-400 animate-spin shrink-0" />
                : searchQuery
                  ? <button onClick={() => { setSearchQuery(''); setResults([]); }} className="text-zinc-600 hover:text-white transition-colors"><X size={13} /></button>
                  : null
              }
              <button onClick={handleClose} className="text-zinc-600 hover:text-white transition-colors ml-1 text-[9px] font-black uppercase tracking-widest">ESC</button>

              {/* Dropdown results */}
              {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-[#0c0a12] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden z-[200] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                    {(['live', 'movie', 'series'] as const).map((type) => {
                      const group = results.filter(r => r.type === type);
                      if (group.length === 0) return null;
                      const Icon = TYPE_ICON[type];
                      return (
                        <div key={type} className="mb-1">
                          <div className="flex items-center gap-2 px-3 py-2">
                            <Icon size={11} className="text-purple-500" />
                            <span className="text-[9px] font-black text-purple-500 uppercase tracking-[0.2em]">{TYPE_LABEL[type]}s</span>
                          </div>
                          {group.map((result) => (
                            <button
                              key={result.id}
                              onClick={() => handleSelectResult(result)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5 transition-all text-left group"
                            >
                              {result.icon
                                ? <img src={result.icon} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0 opacity-80 group-hover:opacity-100" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                                : <div className="w-8 h-8 rounded-xl bg-white/5 shrink-0 flex items-center justify-center"><Icon size={14} className="text-zinc-600" /></div>
                              }
                              <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors line-clamp-1">{result.name}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No results */}
              {!searching && searchQuery.length >= 2 && results.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-[#0c0a12] border border-white/10 rounded-[24px] shadow-2xl p-6 text-center z-[200]">
                  <p className="text-zinc-600 text-xs font-medium">Nenhum resultado para "<span className="text-zinc-400">{searchQuery}</span>"</p>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      <div className="shrink-0 hidden md:block">
        <span className="text-[9px] font-bold text-zinc-700 tracking-widest">v1.5.10</span>
      </div>
    </header>
  );
};
