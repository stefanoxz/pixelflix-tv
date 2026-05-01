import { memo, useState, useEffect } from 'react';
import { ChevronLeft, Search, Grid, List as ListIcon } from 'lucide-react';
import vibeLogo from '@/assets/vibe-logo.png';

interface ExplorerHeaderProps {
  title: string;
  itemCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onBack: () => void;
}

export const ExplorerHeader = memo(({ 
  title, 
  itemCount, 
  searchQuery, 
  onSearchChange, 
  viewMode, 
  onViewModeChange, 
  onBack 
}: ExplorerHeaderProps) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateString = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase();

  return (
    <header className="px-8 py-4 flex items-center justify-between border-b border-white/5 bg-[#121212]/80 backdrop-blur-2xl sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <button onClick={onBack} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white border border-white/5">
          <ChevronLeft size={22} />
        </button>
        
        <div className="flex items-center gap-4">
          <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={onBack}>
            <img 
              src={vibeLogo} 
              alt="Vibe" 
              className="h-9 w-auto object-contain"
            />
          </div>
          <div className="h-6 w-[1px] bg-white/10" />
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-white tracking-tight leading-none">{title}</h2>
            <p className="text-[10px] font-bold text-zinc-600 tracking-[0.2em] uppercase mt-1">{itemCount} Itens</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="relative group w-80 hidden md:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Pesquisar..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-zinc-600"
          />
        </div>

        <div className="h-8 w-[1px] bg-white/5" />

        <div className="flex flex-col items-end justify-center">
          <span className="text-xl font-black tracking-tighter text-white leading-none">{timeString}</span>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1.5">{dateString}</span>
        </div>
      </div>
    </header>
  );
});

ExplorerHeader.displayName = 'ExplorerHeader';
