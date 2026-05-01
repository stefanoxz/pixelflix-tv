import { useRef } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';

export interface RowItem {
  id: string;
  title: string;
  poster: string;
  badge?: string;
  badgeColor?: string;
}

interface ContentRowProps {
  title: string;
  icon: LucideIcon;
  items: RowItem[];
}

export const ContentRow = ({ title, icon: Icon, items }: ContentRowProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === 'left' ? -600 : 600, behavior: 'smooth' });
  };

  return (
    <section className="mt-10 group/row">
      <h3 className="flex items-center gap-2 text-base font-bold text-white mb-4">
        <Icon size={16} className="text-purple-500" />
        {title}
      </h3>

      <div className="relative">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 hover:bg-purple-600 transition-all -translate-x-2"
          aria-label="Anterior"
        >
          <ChevronLeft size={20} />
        </button>

        <div
          ref={ref}
          className="flex gap-3 overflow-x-auto pb-2 no-scrollbar scroll-smooth"
        >
          {items.map((item) => (
            <button
              key={item.id}
              className="shrink-0 w-[140px] md:w-[160px] group/item relative rounded-xl overflow-hidden bg-zinc-900 border border-white/5 hover:border-purple-500/60 hover:scale-105 transition-all"
            >
              <div className="aspect-[2/3] w-full overflow-hidden">
                <img
                  src={item.poster}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              {item.badge && (
                <span
                  className="absolute bottom-2 left-2 right-2 py-1 rounded-md text-[10px] font-black text-white uppercase tracking-wider text-center"
                  style={{ backgroundColor: item.badgeColor || '#7C3AED' }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 hover:bg-purple-600 transition-all translate-x-2"
          aria-label="Próximo"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
};
