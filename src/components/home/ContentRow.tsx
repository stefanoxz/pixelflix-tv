import React, { memo, useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';
import { RowItem } from '@/types';

interface ContentRowProps {
  title: string;
  icon: LucideIcon;
  items: RowItem[];
}

const ContentItem = memo(({ item }: { item: RowItem }) => (
  <button
    className="shrink-0 w-[140px] md:w-[160px] group/item relative rounded-xl overflow-hidden bg-zinc-900 border border-white/5 hover:border-purple-500/60 hover:scale-105 transition-all duration-300"
  >
    <div className="aspect-[2/3] w-full overflow-hidden bg-zinc-800">
      <img
        src={item.poster}
        alt={item.title}
        className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-500"
        loading="lazy"
        onLoad={(e) => (e.currentTarget.style.opacity = '1')}
        style={{ opacity: 0, transition: 'opacity 0.3s' }}
      />
    </div>
    {item.badge && (
      <span
        className="absolute bottom-2 left-2 right-2 py-1 rounded-md text-[10px] font-black text-white uppercase tracking-wider text-center shadow-lg"
        style={{ backgroundColor: item.badgeColor || '#7C3AED' }}
      >
        {item.badge}
      </span>
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity flex flex-col justify-end p-3">
      <p className="text-[10px] font-bold text-white truncate">{item.title}</p>
    </div>
  </button>
));

ContentItem.displayName = 'ContentItem';

export const ContentRow = memo(({ title, icon: Icon, items }: ContentRowProps) => {
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
            <ContentItem key={item.id} item={item} />
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
