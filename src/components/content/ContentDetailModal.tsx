import { memo } from 'react';
import { X, Star, Play } from 'lucide-react';

interface ContentDetailModalProps {
  item: any;
  type: 'live' | 'movie' | 'series';
  onClose: () => void;
  onPlay: (item: any) => void;
}

export const ContentDetailModal = memo(({ item, type, onClose, onPlay }: ContentDetailModalProps) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-[#0A0A0A] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row animate-in zoom-in-95 duration-500">
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 z-10 p-3 rounded-full bg-black/50 hover:bg-white/10 transition-colors border border-white/10"
        >
          <X size={20} />
        </button>
        <div className="w-full md:w-[40%] aspect-[3/4] md:aspect-auto">
          <img 
            src={item.icon} 
            className="w-full h-full object-cover opacity-80" 
            onError={(e) => {(e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x900/111111/FFFFFF?text=SEM+CAPA';}} 
          />
        </div>
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black tracking-widest uppercase">
              {type === 'live' ? 'AO VIVO' : type === 'movie' ? 'FILME' : 'SÉRIE'}
            </span>
            <span className="text-zinc-500 text-[10px] font-black tracking-widest uppercase">{item.year}</span>
            <div className="flex items-center gap-1.5 text-yellow-500">
              <Star size={12} fill="currentColor" />
              <span className="text-xs font-black">{item.rating}</span>
            </div>
          </div>
          <h3 className="text-4xl md:text-5xl font-black mb-6 leading-tight uppercase tracking-tight">{item.name}</h3>
          <div className="space-y-6 mb-10">
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-zinc-600 tracking-[0.3em] uppercase">Sinopse</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">{item.synopsis || "Descrição não disponível."}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => onPlay(item)}
              className="flex-1 bg-white text-black h-16 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl"
            >
              Assistir Agora <Play size={20} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ContentDetailModal.displayName = 'ContentDetailModal';
