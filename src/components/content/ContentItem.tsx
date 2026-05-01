import { memo } from 'react';
import { Star, Play, Heart } from 'lucide-react';

interface ContentItemProps {
  item: any;
  isFav: boolean;
  viewMode: 'grid' | 'list';
  onPlay: (item: any) => void;
  onSelect: (item: any) => void;
  onToggleFavorite: (item: any) => void;
}

export const ContentItem = memo(({ item, isFav, viewMode, onPlay, onSelect, onToggleFavorite }: ContentItemProps) => {
  if (viewMode === 'grid') {
    return (
      <div className="group flex flex-col transition-all duration-500 hover:scale-[1.02]">
        <button 
          onClick={() => onSelect(item)} 
          className="text-left w-full focus:outline-none rounded-2xl cursor-pointer relative aspect-[2/3] overflow-hidden bg-zinc-900 border border-white/5 shadow-lg group-hover:shadow-2xl group-hover:border-white/10 transition-all duration-500"
        >
          <img 
            src={item.icon} 
            alt={item.name} 
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = 'https://via.placeholder.com/400x600/111111/FFFFFF?text=SEM+CAPA';
            }}
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
              <Play size={20} fill="white" className="text-white ml-1" />
            </div>
          </div>
        </button>
        
        <div className="mt-3 px-1 space-y-0.5">
          <h4 className="text-[13px] font-bold text-white transition-colors tracking-tight line-clamp-1 group-hover:text-purple-400">
            {item.name}
          </h4>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 font-medium">{item.year}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }} 
              className={`p-1.5 rounded-lg transition-all ${isFav ? 'text-red-500' : 'text-zinc-600 hover:text-white'}`}
            >
              <Heart size={14} fill={isFav ? 'currentColor' : 'none'} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-6 p-5 bg-white/5 hover:bg-white/10 rounded-[32px] border border-white/5 transition-all cursor-pointer" onClick={() => onSelect(item)}>
      <div className="w-20 h-28 rounded-2xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 shadow-xl">
        <img 
          src={item.icon} 
          alt={item.name} 
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" 
          onError={(e) => {(e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x300/111111/FFFFFF?text=S/C';}} 
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h4 className="font-black text-xl truncate">{item.name}</h4>
          <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-black">{item.rating}</span>
        </div>
        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{item.year} • {item.duration}</p>
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }} 
          className={`p-3.5 rounded-2xl bg-white/5 transition-all border border-white/5 ${isFav ? 'text-red-500 border-red-500/20 bg-red-500/5' : 'text-zinc-500 hover:text-white'}`}
        >
          <Heart size={20} fill={isFav ? 'currentColor' : 'none'} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onPlay(item); }} 
          className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl"
        >
          Assistir <Play size={16} fill="currentColor" />
        </button>
      </div>
    </div>
  );
});

ContentItem.displayName = 'ContentItem';
