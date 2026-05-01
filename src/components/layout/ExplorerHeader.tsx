import { memo } from 'react';
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
  return (
    <header className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 bg-[#050505]/95 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-5">
        <button onClick={onBack} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white border border-white/5">
          <ChevronLeft size={22} />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="cursor-pointer hover:opacity-80 transition-opacity mr-2" onClick={onBack}>
            <img 
              src={vibeLogo} 
              alt="Vibe" 
              className="h-10 w-auto object-contain drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]"
            />
          </div>
          <div className="h-6 w-[1px] bg-white/10" />
          <h2 className="text-xl font-black uppercase tracking-widest ml-2">{title}</h2>
          <div className="h-4 w-[1px] bg-white/10" />
          <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">{itemCount} Itens</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative group flex-1 md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Pesquisar..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:bg-white/10 transition-all placeholder:text-zinc-600"
          />
        </div>
        <div className="flex bg-white/5 rounded-2xl p-1 border border-white/5">
          <button 
            onClick={() => onViewModeChange('grid')} 
            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
          >
            <Grid size={18} />
          </button>
          <button 
            onClick={() => onViewModeChange('list')} 
            className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
          >
            <ListIcon size={18} />
          </button>
        </div>
      </div>
    </header>
  );
});

ExplorerHeader.displayName = 'ExplorerHeader';
