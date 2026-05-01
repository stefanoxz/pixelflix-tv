import { memo } from 'react';
import { Tv, Star } from 'lucide-react';

interface LiveCategorySidebarProps {
  categories: any[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}

export const LiveCategorySidebar = memo(({ categories, selectedCategory, onSelectCategory }: LiveCategorySidebarProps) => {
  return (
    <aside className="w-64 flex flex-col border-r border-white/5 bg-[#0A0A0A] p-4 gap-1.5 overflow-y-auto custom-scrollbar flex-shrink-0">
      {categories.map(cat => {
        const catId = String(cat.category_id);
        const isActive = selectedCategory === catId;
        const isFav = cat.category_name.includes('Favoritos');
        
        return (
          <button
            key={catId}
            onClick={() => onSelectCategory(catId)}
            className={`w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-xl transition-all ${
              isActive
              ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/10' 
              : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300 border border-transparent'
            }`}
          >
            {isFav ? (
              <Star size={14} className={isActive ? 'text-white' : 'text-zinc-600'} />
            ) : (
              <Tv size={14} className={isActive ? 'text-white' : 'text-zinc-600'} />
            )}
            <span className="uppercase tracking-[0.15em] text-[10px] font-bold truncate">
              {cat.category_name.replace('★', '').trim()}
            </span>
          </button>
        );
      })}
    </aside>
  );
});

LiveCategorySidebar.displayName = 'LiveCategorySidebar';
