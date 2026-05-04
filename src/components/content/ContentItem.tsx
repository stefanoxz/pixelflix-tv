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
      <div className="group flex flex-col transition-all duration-500 relative">
        <div 
          onClick={() => onSelect(item)} 
          className="text-left w-full focus:outline-none rounded-[28px] cursor-pointer relative aspect-[2/3] overflow-hidden bg-[#1A1A1A] transition-all duration-500 group-hover:shadow-[0_0_40px_rgba(168,85,247,0.2)] group-hover:-translate-y-2 border border-white/5 group-hover:border-purple-500/50"
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
              target.src = 'https://via.placeholder.com/400x600/080808/333333?text=SEM+IMAGEM';
            }}
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
          
          <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-xl border transition-all ${isFav ? 'bg-red-500 border-red-500/50 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-black/50 border-white/10 text-white hover:bg-white/20'}`}
            >
              <Heart size={18} fill={isFav ? 'white' : 'none'} />
            </button>
          </div>

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
            <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.5)]">
              <Play size={24} fill="white" className="text-white ml-1" />
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2">
               <span className="px-2 py-0.5 rounded-md bg-purple-600 text-[8px] font-black tracking-widest text-white uppercase shadow-lg">4K UHD</span>
               {item.rating && item.rating !== 'N/A' && (
                 <span className="px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md text-[8px] font-black text-white/90 border border-white/10 uppercase tracking-widest">★ {item.rating}</span>
               )}
            </div>
          </div>
        </div>
        
        <div className="mt-4 px-2 space-y-1 text-center">
          <h4 className="text-[13px] md:text-sm font-black text-white group-hover:text-purple-400 transition-colors tracking-wide leading-snug line-clamp-2 uppercase italic">
            {item.name}
          </h4>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">{item.year}</span>
            <div className="w-1 h-1 rounded-full bg-zinc-800" />
            <span className="text-[10px] text-purple-500/60 font-black tracking-widest uppercase">{item.duration}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-8 p-6 bg-[#1A1A1A]/30 hover:bg-[#1A1A1A]/60 rounded-[32px] border border-white/5 transition-all cursor-pointer relative overflow-hidden" onClick={() => onSelect(item)}>
      <div className="absolute inset-y-0 left-0 w-1 bg-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="w-24 h-36 rounded-2xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/10 shadow-2xl transition-transform duration-500 group-hover:scale-105">
        <img 
          src={item.icon} 
          alt={item.name} 
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-opacity" 
          onError={(e) => {(e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x300/080808/333333?text=S/C';}} 
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-4 mb-2">
          <h4 className="text-2xl font-black tracking-tighter text-white uppercase italic truncate">{item.name}</h4>
          <div className="flex gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-purple-600/20 text-purple-400 text-[10px] font-black border border-purple-500/20 uppercase tracking-widest">Ultra HD</span>
            <span className="px-2.5 py-1 rounded-lg bg-white/5 text-zinc-400 text-[10px] font-black border border-white/10 uppercase tracking-widest italic">{item.rating}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-zinc-500 font-black uppercase tracking-[0.2em]">{item.year}</p>
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500/30" />
          <p className="text-xs text-zinc-500 font-black uppercase tracking-[0.2em]">{item.duration}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4 relative z-10">
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }} 
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border ${isFav ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.1)]' : 'bg-white/5 border-white/5 text-zinc-500 hover:text-white hover:bg-white/10'}`}
        >
          <Heart size={22} fill={isFav ? 'currentColor' : 'none'} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onPlay(item); }} 
          className="group/btn flex items-center gap-3 bg-white text-black px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-purple-600 hover:text-white transition-all shadow-2xl hover:scale-105 active:scale-95"
        >
          Reproduzir <Play size={18} fill="currentColor" className="group-hover/btn:animate-pulse" />
        </button>
      </div>
    </div>
  );
});

ContentItem.displayName = 'ContentItem';
