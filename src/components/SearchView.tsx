import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, ArrowLeft, X, Loader2, PlayCircle, Film, Tv, ChevronRight } from 'lucide-react';
import { xtreamService } from '@/services/xtream';

interface SearchViewProps {
  onNavigate: (view: any, search?: string, data?: any) => void;
  onBack: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  icon?: string;
  type: 'live' | 'movie' | 'series';
  raw?: any;
}

const KEYS = [
  'A', 'B', 'C', 'D', 'E', 'F',
  'G', 'H', 'I', 'J', 'K', 'L',
  'M', 'N', 'O', 'P', 'Q', 'R',
  'S', 'T', 'U', 'V', 'W', 'X',
  'Y', 'Z', 'Ç', '1', '2', '3',
  '4', '5', '6', '7', '8', '9',
  '0'
];

export const SearchView = ({ onNavigate, onBack }: SearchViewProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleKeyClick = (key: string) => {
    setQuery(prev => prev + key);
  };

  const handleBackspace = () => {
    setQuery(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setQuery('');
  };

  const handleSpace = () => {
    setQuery(prev => prev + ' ');
  };

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      // Only fetch Movies and Series as requested
      const [movies, series] = await Promise.all([
        xtreamService.getStreams('movie'),
        xtreamService.getStreams('series'),
      ]);

      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const qn = normalize(q);

      const matched: SearchResult[] = [
        ...movies.filter((s: any) => normalize(s.name || '').includes(qn))
          .slice(0, 15).map((s: any) => {
            const id = String(s.stream_id || s.num || Math.random());
            return { id, name: s.name, icon: s.stream_icon || s.cover, type: 'movie' as const, raw: { ...s, id } };
          }),
        ...series.filter((s: any) => normalize(s.name || '').includes(qn))
          .slice(0, 15).map((s: any) => {
            const id = String(s.series_id || s.stream_id || Math.random());
            return { id, name: s.name, icon: s.cover || s.stream_icon, type: 'series' as const, raw: { ...s, id } };
          }),
      ];
      setResults(matched);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 150);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#08060a] text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="px-10 py-8 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3">
            <Search size={24} className="text-purple-500" />
            <h1 className="text-2xl font-black tracking-tighter uppercase italic">Pesquisar Filmes & Séries</h1>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-black tracking-tight">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
            {time.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')}
          </div>
        </div>
      </header>

      <main className="flex-1 flex px-10 pb-10 gap-16 overflow-hidden">
        {/* Keyboard Column */}
        <div className="w-[450px] flex flex-col gap-8 shrink-0 animate-in slide-in-from-left duration-700">
          {/* Search Input Box */}
          <div className="relative group">
            <div className="absolute inset-0 bg-purple-500/20 blur-2xl opacity-0 group-within:opacity-100 transition-opacity duration-500" />
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-5 group-within:border-purple-500 group-within:ring-4 group-within:ring-purple-500/10 transition-all shadow-2xl">
              <Search className="text-zinc-500 group-within:text-purple-400 transition-colors" size={28} />
              <input 
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome do filme ou série..."
                className="bg-transparent flex-1 outline-none text-2xl font-black placeholder:text-zinc-700 tracking-tight"
              />
              {query && (
                <button 
                  onClick={handleClear} 
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                >
                  <X size={24} />
                </button>
              )}
            </div>
          </div>

          {/* Virtual Keyboard */}
          <div className="grid grid-cols-6 gap-3">
            {KEYS.map(key => (
              <button
                key={key}
                onClick={() => handleKeyClick(key)}
                className="h-14 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-lg font-black active:scale-90 active:bg-purple-600 active:border-purple-500 shadow-lg"
              >
                {key}
              </button>
            ))}
            
            {/* Control Keys */}
            <button
              onClick={handleBackspace}
              className="col-span-2 h-14 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center active:scale-90 shadow-lg"
              title="Apagar"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={handleClear}
              className="col-span-2 h-14 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center active:scale-90 shadow-lg"
              title="Limpar"
            >
              <X size={20} />
            </button>
            <button
              onClick={handleSpace}
              className="col-span-2 h-14 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center active:scale-90 shadow-lg"
              title="Espaço"
            >
              <div className="w-8 h-1 border-b-2 border-white/30" />
            </button>
          </div>
        </div>

        {/* Results Column */}
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-1000">
          {!query ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
              <div className="w-32 h-32 rounded-full border-2 border-white/10 flex items-center justify-center mb-8">
                <Film size={48} className="text-zinc-500" />
              </div>
              <h2 className="text-4xl font-black tracking-tight mb-4 uppercase italic">O que vamos ver hoje?</h2>
              <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
                Use o teclado ao lado para buscar seus filmes ou séries favoritos.
              </p>
            </div>
          ) : searching ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar pb-10">
              <h3 className="text-[10px] font-black text-zinc-500 tracking-[0.3em] uppercase mb-8 px-2">Resultados Encontrados ({results.length})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => onNavigate(result.type, undefined, result.raw)}
                    className="flex flex-col group text-left transition-all animate-in fade-in zoom-in duration-500"
                  >
                    <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl group-hover:scale-105 group-hover:ring-4 group-hover:ring-purple-500/50 transition-all relative">
                      {result.icon ? (
                        <img src={result.icon} alt={result.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-800">
                          <Film size={48} />
                        </div>
                      )}
                      {/* Overlay Type Badge */}
                      <div className="absolute top-3 right-3">
                         <span className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[8px] font-black tracking-widest uppercase border border-white/10">
                            {result.type === 'movie' ? 'FILME' : 'SÉRIE'}
                         </span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <h4 className="text-sm font-black text-white group-hover:text-purple-400 transition-colors line-clamp-2 leading-snug">
                        {result.name}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-bold mt-1.5 uppercase tracking-widest opacity-60">Sincronizado via VIBE</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
              <X size={64} className="text-zinc-700 mb-6" />
              <h2 className="text-2xl font-black tracking-tight uppercase italic">Nenhum resultado encontrado</h2>
              <p className="text-zinc-400 mt-2">Tente buscar por outro termo.</p>
            </div>
          )}
        </div>
      </main>

      {/* Subtle Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[150px] rounded-full" />
      </div>
    </div>
  );
};
