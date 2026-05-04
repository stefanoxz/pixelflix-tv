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
    <div className="fixed inset-0 z-[100] bg-[#080808] text-white flex flex-col font-sans overflow-hidden selection:bg-purple-500/30">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
      
      {/* Header */}
      <header className="px-12 py-10 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-8">
          <button 
            onClick={onBack}
            className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 group shadow-2xl"
          >
            <ArrowLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <Search size={20} className="text-purple-500" />
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white">Explorar Conteúdo</h1>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mt-1 ml-8">Busca inteligente Vibe</p>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div className="text-3xl font-black tracking-tighter text-white leading-none">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[10px] font-bold text-purple-500 uppercase tracking-[0.4em] mt-2">
            {time.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase()}
          </div>
        </div>
      </header>

      <main className="flex-1 flex px-12 pb-12 gap-20 overflow-hidden relative z-10">
        {/* Keyboard Column */}
        <div className="w-[500px] flex flex-col gap-10 shrink-0 animate-in slide-in-from-left duration-700">
          {/* Search Input Box */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-[32px] blur-xl opacity-0 group-within:opacity-100 transition-opacity duration-700" />
            <div className="relative bg-[#121212]/50 backdrop-blur-3xl border border-white/5 rounded-[32px] p-8 flex items-center gap-6 group-within:border-purple-500/50 group-within:bg-[#121212]/80 transition-all shadow-2xl">
              <Search className="text-zinc-600 group-within:text-purple-400 transition-colors" size={32} />
              <input 
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busque por filmes ou séries..."
                className="bg-transparent flex-1 outline-none text-3xl font-black placeholder:text-zinc-800 tracking-tight text-white uppercase italic"
              />
              {query && (
                <button 
                  onClick={handleClear} 
                  className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all active:scale-90"
                >
                  <X size={24} />
                </button>
              )}
            </div>
          </div>

          {/* Virtual Keyboard */}
          <div className="grid grid-cols-6 gap-4">
            {KEYS.map(key => (
              <button
                key={key}
                onClick={() => handleKeyClick(key)}
                className="h-16 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-purple-500/30 transition-all text-xl font-black active:scale-90 active:bg-purple-600 active:text-white text-zinc-400 hover:text-white shadow-lg"
              >
                {key}
              </button>
            ))}
            
            {/* Control Keys */}
            <button
              onClick={handleBackspace}
              className="col-span-2 h-16 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center active:scale-90 shadow-lg text-zinc-400 hover:text-white"
              title="Apagar"
            >
              <ArrowLeft size={24} />
            </button>
            <button
              onClick={handleClear}
              className="col-span-2 h-16 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center active:scale-90 shadow-lg text-zinc-400 hover:text-white"
              title="Limpar"
            >
              <X size={24} />
            </button>
            <button
              onClick={handleSpace}
              className="col-span-2 h-16 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center active:scale-90 shadow-lg text-zinc-400 hover:text-white"
              title="Espaço"
            >
              <div className="w-10 h-1 border-b-4 border-zinc-700" />
            </button>
          </div>
        </div>

        {/* Results Column */}
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-1000">
          {!query ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-40 h-40 rounded-[40px] bg-white/[0.02] border border-white/5 flex items-center justify-center mb-10 shadow-inner relative group">
                <div className="absolute inset-0 bg-purple-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <Film size={64} className="text-zinc-800 relative z-10" />
              </div>
              <h2 className="text-5xl font-black tracking-tighter mb-4 uppercase italic text-white/80">O que vamos ver hoje?</h2>
              <p className="text-xl text-zinc-600 max-w-md leading-relaxed font-medium">
                Sua biblioteca completa de filmes e séries está a um clique de distância.
              </p>
            </div>
          ) : searching ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="flex-1 overflow-y-auto pr-6 custom-scrollbar pb-10">
              <div className="flex items-center justify-between mb-10 px-2">
                <h3 className="text-[10px] font-black text-purple-500 tracking-[0.5em] uppercase flex items-center gap-3">
                  <div className="w-8 h-[1px] bg-purple-500/30" />
                  Resultados Encontrados ({results.length})
                </h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => onNavigate(result.type, undefined, result.raw)}
                    className="flex flex-col group text-left transition-all animate-in fade-in zoom-in-95 duration-500"
                  >
                    <div className="aspect-[2/3] w-full rounded-[28px] overflow-hidden bg-[#121212] border border-white/5 shadow-2xl group-hover:scale-105 group-hover:border-purple-500/50 transition-all relative">
                      {result.icon ? (
                        <img src={result.icon} alt={result.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-900">
                          <Film size={64} />
                        </div>
                      )}
                      
                      {/* Premium Badge */}
                      <div className="absolute top-4 right-4">
                         <div className="px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-black tracking-widest text-white uppercase">
                            {result.type === 'movie' ? 'FILME' : 'SÉRIE'}
                         </div>
                      </div>

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    
                    <div className="mt-5 px-1">
                      <h4 className="text-lg font-black text-white group-hover:text-purple-400 transition-colors line-clamp-2 leading-none uppercase italic tracking-tight">
                        {result.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-2 opacity-40">
                         <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                         <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em]">Sincronizado VIBE</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-32 h-32 rounded-full bg-white/[0.01] border border-white/5 flex items-center justify-center mb-8">
                <X size={48} className="text-zinc-900" />
              </div>
              <h2 className="text-3xl font-black tracking-tighter uppercase italic text-white/60">Nenhum resultado encontrado</h2>
              <p className="text-zinc-600 mt-2 font-bold uppercase tracking-widest text-[10px]">Tente buscar por outro termo</p>
            </div>
          )}
        </div>
      </main>

      {/* Cinematic Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 blur-[180px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/5 blur-[180px] rounded-full" />
      </div>
    </div>
  );
};
