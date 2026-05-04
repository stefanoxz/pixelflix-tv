import React, { memo, useState, useEffect } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import vibeLogo from '@/assets/vibe-logo.png';

interface ExplorerHeaderProps {
  title: string;
  itemCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  onBack: () => void;
  children?: React.ReactNode;
}

export const ExplorerHeader = memo(({ 
  title, 
  itemCount, 
  searchQuery, 
  onSearchChange, 
  onBack,
  children
}: ExplorerHeaderProps) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateString = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase();

  return (
    <header className="h-24 px-10 flex items-center justify-between border-b border-white/5 bg-[#080808]/90 backdrop-blur-3xl sticky top-0 z-50">
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
      
      <div className="flex items-center gap-8">
        <button 
          onClick={onBack} 
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:bg-purple-600 hover:border-purple-500 transition-all text-white shadow-lg active:scale-95"
        >
          <ChevronLeft size={24} />
        </button>
        
        <div className="flex items-center gap-6">
          <div className="cursor-pointer hover:opacity-80 transition-all group" onClick={onBack}>
            <div className="absolute inset-0 bg-purple-600/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <img 
              src={vibeLogo} 
              alt="Vibe" 
              className="h-10 w-auto object-contain relative z-10"
            />
          </div>
          <div className="h-8 w-[1px] bg-white/5" />
          <div className="flex flex-col">
            <h2 className="text-2xl font-black tracking-tighter uppercase italic text-white leading-none">{title}</h2>
            <p className="text-[10px] font-bold text-purple-500/80 tracking-[0.2em] uppercase mt-2">{itemCount} Itens Disponíveis</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-10">
        {/* Search */}
        <div className="relative group w-80 hidden md:block">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={18} className="text-zinc-600 group-focus-within:text-purple-400 transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="O que você deseja assistir?" 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all placeholder:text-zinc-700 shadow-inner"
          />
        </div>

        <div className="h-10 w-[1px] bg-white/10" />

        {/* Info badges or extra content */}
        {children || (
          <div className="hidden lg:flex items-center gap-3">
            <div className="px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#a855f7]" />
              <span className="text-[10px] font-black text-purple-300 uppercase tracking-[0.2em]">ULTRA HD 4K</span>
            </div>
          </div>
        )}

        <div className="text-right flex flex-col items-end min-w-[100px]">
          <span className="text-2xl font-black tracking-tight text-white leading-none">{timeString}</span>
          <span className="text-[10px] text-purple-500/80 font-bold uppercase tracking-[0.2em] leading-none mt-2">{dateString}</span>
        </div>
      </div>
    </header>
  );
});

ExplorerHeader.displayName = 'ExplorerHeader';
