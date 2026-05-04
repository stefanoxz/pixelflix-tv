import { memo, useState, useCallback } from 'react';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Radio, X, Trash2 } from 'lucide-react';
import { recentChannelsService, RecentChannel } from '@/services/recentChannels';

interface RecentChannelsRowProps {
  onChannelClick: (channel: RecentChannel) => void;
}

export const RecentChannelsRow = memo(({ onChannelClick }: RecentChannelsRowProps) => {
  const [channels, setChannels] = useState<RecentChannel[]>(() =>
    recentChannelsService.getAll()
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 10);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const handleScroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -scrollRef.current.clientWidth * 0.8 : scrollRef.current.clientWidth * 0.8,
      behavior: 'smooth',
    });
  };

  const handleRemove = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    recentChannelsService.remove(id);
    setChannels((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleClearAll = () => {
    recentChannelsService.clear();
    setChannels([]);
  };

  if (channels.length === 0) return null;

  return (
    <section className="mt-10 group/row">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-white">
          <Radio size={18} className="text-red-500 animate-pulse" />
          Canais Assistidos
          <span className="text-[10px] text-zinc-500 font-normal ml-2 bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-tighter">
            {channels.length} itens
          </span>
        </h3>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-zinc-600 hover:text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all text-[10px] font-bold uppercase tracking-wider"
        >
          <Trash2 size={12} />
          Limpar histórico
        </button>
      </div>

      <div className="relative">
        {showLeft && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-purple-600 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto pb-6 no-scrollbar scroll-smooth"
        >
          {channels.map((ch) => (
            <div
              key={ch.id}
              onClick={() => onChannelClick(ch)}
              className="shrink-0 w-[140px] md:w-[160px] cursor-pointer group/item relative rounded-xl overflow-hidden bg-zinc-900 border border-white/5 hover:border-red-500/40 hover:scale-105 transition-all duration-300"
            >
              {/* Channel icon / poster */}
              <div className="aspect-[2/3] w-full overflow-hidden bg-zinc-800 flex items-center justify-center">
                {ch.icon ? (
                  <img
                    src={ch.icon}
                    alt={ch.name}
                    className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-500"
                    loading="lazy"
                    style={{ opacity: 0, transition: 'opacity 0.3s' }}
                    onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.style.display = 'none';
                    }}
                  />
                ) : (
                  <Radio size={40} className="text-zinc-600" />
                )}
              </div>

              {/* AO VIVO badge */}
              <span className="absolute bottom-2 left-2 right-2 py-1 rounded-md text-[10px] font-black text-white uppercase tracking-wider text-center shadow-lg bg-red-600">
                AO VIVO
              </span>

              {/* Hover overlay with title */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-[10px] font-bold text-white truncate">{ch.name}</p>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => handleRemove(e, ch.id)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all hover:bg-red-600 hover:scale-110 z-10"
                title="Remover dos assistidos"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ))}
        </div>

        {showRight && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-purple-600 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </section>
  );
});

RecentChannelsRow.displayName = 'RecentChannelsRow';
