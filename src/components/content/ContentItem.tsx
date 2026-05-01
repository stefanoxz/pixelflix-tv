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
      <div className="group flex flex-col animate-in fade-in zoom-in-95 duration-700">
        <button 
          onClick={() => onSelect(item)} 
          className="text-left w-full focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/50 rounded-[40px] cursor-pointer relative aspect-[2/3] overflow-hidden bg-zinc-900 border border-white/5 transition-all duration-700 group-hover:-translate-y-3 group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.8)] group-hover:border-white/20 ring-1 ring-white/0 group-hover:ring-white/10"
        >
          <img 
            src={item.icon} 
            alt={item.name} 
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-transform duration-1000 group-hover:scale-110 will-change-transform" 
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = 'https://via.placeholder.com/400x600/111111/FFFFFF?text=SEM+CAPA';
            }}
          />
          
          <div className="absolute top-5 right-5 px-3 py-1.5 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center gap-2 shadow-2xl">
            <Star size={12} className="text-yellow-500 fill-yellow-500" />
            <span className="text-[11px] font-black tracking-tighter">{item.rating}</span>
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-8">
            <div className="w-full bg-white text-black h-14 rounded-3xl flex items-center justify-center transition-transform transform translate-y-6 group-hover:translate-y-0 duration-500 shadow-[0_20px_40px_rgba(255,255,255,0.1)] will-change-transform">
              <Play size={24} fill="currentColor" className="ml-1" />
            </div>
          </div>
        </button>
        
        <div className="mt-6 px-2 space-y-1">
          <h4 className="text-[14px] leading-tight font-bold truncate text-zinc-300 group-hover:text-white transition-colors tracking-tight capitalize">{item.name?.toLowerCase()}</h4>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-600 font-bold tracking-widest">{item.year}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }} 
              className={`p-2 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${isFav ? 'text-red-500 bg-red-500/10' : 'text-zinc-700 hover:text-white hover:bg-white/5'}`}
            >
              <Heart size={16} fill={isFav ? 'currentColor' : 'none'} strokeWidth={2.5} />
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
