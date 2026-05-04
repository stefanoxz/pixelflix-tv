import React, { memo, useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon, Play } from 'lucide-react';
import { RowItem } from '@/types';

interface ContentRowProps {
  title: string;
  icon: LucideIcon;
  items: RowItem[];
  onItemClick?: (item: RowItem) => void;
}

const ContentItem = memo(({ item, onClick }: { item: RowItem; onClick?: (item: RowItem) => void }) => (
  <div className="group flex flex-col transition-all duration-500 relative shrink-0 w-[160px] md:w-[180px]">
    <div 
      onClick={() => onClick?.(item)} 
      className="text-left w-full focus:outline-none rounded-[28px] cursor-pointer relative aspect-[2/3] overflow-hidden bg-[#1A1A1A] transition-all duration-500 group-hover:shadow-[0_0_40px_rgba(168,85,247,0.2)] group-hover:-translate-y-2 border border-white/5 group-hover:border-purple-500/50"
    >
      <img 
        src={item.poster} 
        alt={item.title} 
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
      />
      
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
      
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
        <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.5)]">
          <Play size={20} fill="white" className="text-white ml-1" />
        </div>
      </div>

      <div className="absolute bottom-3 left-3 right-3">
        <div className="flex items-center gap-2">
           <span className="px-1.5 py-0.5 rounded bg-purple-600 text-[7px] font-black tracking-widest text-white uppercase">4K UHD</span>
        </div>
      </div>
    </div>
    
    <div className="mt-4 px-2 space-y-1 text-center">
      <h4 className="text-[12px] font-black text-white group-hover:text-purple-400 transition-colors tracking-wide leading-snug line-clamp-2 uppercase italic truncate">
        {item.title}
      </h4>
      <div className="flex items-center justify-center gap-2">
        <span className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">{item.year || '2024'}</span>
        {item.rating && (
          <>
            <div className="w-1 h-1 rounded-full bg-zinc-800" />
            <span className="text-[9px] text-yellow-500 font-black tracking-widest uppercase">★ {item.rating}</span>
          </>
        )}
      </div>
    </div>
  </div>
));

ContentItem.displayName = 'ContentItem';

export const ContentRow = memo(({ title, icon: Icon, items, onItemClick }: ContentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 10);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [items]);

  const handleScroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  if (!items?.length) return null;

  return (
    <section className="mt-10 group/row">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-white">
          <Icon size={18} className="text-purple-500" />
          {title}
          <span className="text-[10px] text-zinc-500 font-normal ml-2 bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-tighter">
            {items.length} itens
          </span>
        </h3>
      </div>

      <div className="relative">
        {showLeft && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-purple-600 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            aria-label="Anterior"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto pb-6 no-scrollbar scroll-smooth"
        >
          {items.map((item) => (
            <ContentItem key={item.id} item={item} onClick={onItemClick} />
          ))}
        </div>

        {showRight && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-purple-600 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            aria-label="Próximo"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </section>
  );
});

ContentRow.displayName = 'ContentRow';
