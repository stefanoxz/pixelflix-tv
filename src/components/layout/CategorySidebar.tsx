import { memo } from 'react';
import { ChevronRight, Clapperboard, Star, Play } from 'lucide-react';

interface CategorySidebarProps {
  categories: any[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}

export const CategorySidebar = memo(({ categories, selectedCategory, onSelectCategory }: CategorySidebarProps) => {
  return (
    <aside className="hidden lg:flex w-72 flex-col border-r border-white/5 bg-[#121212] p-4 gap-2 overflow-y-auto custom-scrollbar">
      {categories.map(cat => {
        const catId = String(cat.category_id);
        const isActive = selectedCategory === catId;
        const isFav = cat.category_name.toLowerCase().includes('favoritos');
        const isLive = cat.category_name.toLowerCase().includes('ao vivo');
        
        return (
          <button
            key={catId}
            onClick={() => onSelectCategory(catId)}
            className={`w-full group flex items-center justify-between px-4 py-4 rounded-xl transition-all relative overflow-hidden border ${
              isActive
              ? 'bg-gradient-to-r from-purple-900/40 to-transparent border-purple-500/30 text-white' 
              : 'bg-[#1A1A1A]/50 border-transparent text-zinc-500 hover:bg-[#1A1A1A] hover:text-zinc-300'
            }`}
          >
            {isActive && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_15px_#3b82f6]" />
            )}
            
            <div className="flex items-center gap-4">
              {isFav ? (
                <Star size={18} className={isActive ? 'text-blue-400' : 'text-zinc-600 group-hover:text-zinc-400'} />
              ) : isLive ? (
                <Play size={18} className={isActive ? 'text-purple-400' : 'text-zinc-600 group-hover:text-zinc-400'} />
              ) : (
                <Clapperboard size={18} className={isActive ? 'text-purple-400' : 'text-zinc-600 group-hover:text-zinc-400'} />
              )}
              <span className={`text-[13px] font-bold tracking-wide truncate ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                {cat.category_name.replace('★', '').trim()}
              </span>
            </div>

            <ChevronRight size={14} className={`transition-all ${isActive ? 'text-blue-400 opacity-100' : 'opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5'}`} />
          </button>
        );
      })}
    </aside>
  );
});

CategorySidebar.displayName = 'CategorySidebar';
