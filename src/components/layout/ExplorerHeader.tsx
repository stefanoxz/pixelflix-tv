import { memo, useState, useEffect } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import vibeLogo from '@/assets/vibe-logo.png';

interface ExplorerHeaderProps {
  title: string;
  itemCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
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
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateString = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase();

  return (
    <header className="h-24 px-10 flex items-center justify-between border-b border-white/5 bg-[#080808]/90 backdrop-blur-3xl sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <button 
          onClick={onBack} 
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all hover:scale-110 active:scale-95 group"
        >
          <ChevronLeft size={24} className="group-hover:-translate-x-0.5 transition-transform" />
        </button>
        
        <div className="flex items-center gap-6">
          <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={onBack}>
            <img 
              src={vibeLogo} 
              alt="Vibe" 
              className="h-10 w-auto object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.3)]"
            />
          </div>
          <div className="h-8 w-[1px] bg-white/10" />
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-white tracking-tighter uppercase italic leading-none">{title}</h2>
            <p className="text-[10px] font-bold text-zinc-600 tracking-[0.3em] uppercase mt-1.5">{itemCount} Itens Disponíveis</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-10">
        {children}

        <div className="relative w-80 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-purple-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar canal..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-14 bg-white/[0.03] border border-white/10 rounded-[20px] pl-14 pr-6 text-sm font-medium focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.05] transition-all placeholder:text-zinc-700"
          />
        </div>

        <div className="h-10 w-[1px] bg-white/10" />

        <div className="flex flex-col items-end">
          <span className="text-2xl font-black text-white tracking-tighter leading-none italic">{timeString}</span>
          <span className="text-[10px] text-purple-500/80 font-bold uppercase tracking-[0.2em] leading-none mt-2">{dateString}</span>
        </div>
      </div>
    </header>
  );
});

ExplorerHeader.displayName = 'ExplorerHeader';
