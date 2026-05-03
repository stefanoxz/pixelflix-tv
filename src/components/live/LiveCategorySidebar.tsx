import React, { memo, useRef, useEffect } from 'react';
import { Tv, Star, ChevronRight } from 'lucide-react';

interface LiveCategorySidebarProps {
  categories: any[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}

export const LiveCategorySidebar = memo(({ categories, selectedCategory, onSelectCategory }: LiveCategorySidebarProps) => {
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to active category
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedCategory]);

  return (
    <aside className="w-72 flex flex-col border-r border-white/5 bg-[#121212] p-4 gap-2 overflow-y-auto custom-scrollbar flex-shrink-0">
      {categories.map(cat => {
        const catId = String(cat.category_id);
        const isActive = selectedCategory === catId;
        const isFav = cat.category_name.toLowerCase().includes('favoritos');
        
        return (
          <button
            key={catId}
            ref={isActive ? activeRef : null}
            onClick={() => onSelectCategory(catId)}
            className={`w-full group flex items-center justify-between px-4 py-4 rounded-xl transition-all relative overflow-hidden border ${
              isActive
              ? 'bg-gradient-to-r from-purple-600/20 to-transparent border-purple-500/30 text-white' 
              : 'bg-[#1A1A1A]/50 border-transparent text-zinc-500 hover:bg-[#1A1A1A] hover:text-zinc-300'
            }`}
          >
            {isActive && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 shadow-[0_0_15px_#a855f7]" />
            )}

            <div className="flex items-center gap-4">
              <div className={`transition-colors ${isActive ? 'text-purple-400' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                {isFav ? <Star size={18} /> : <Tv size={18} />}
              </div>
              <span className={`text-[13px] font-bold tracking-wide truncate transition-colors ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                {cat.category_name.replace('★', '').trim()}
              </span>
            </div>

            <ChevronRight size={14} className={`transition-all ${isActive ? 'text-purple-400 opacity-100' : 'opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5'}`} />
          </button>
        );
      })}
    </aside>
  );
});

LiveCategorySidebar.displayName = 'LiveCategorySidebar';
