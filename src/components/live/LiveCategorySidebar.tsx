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
            className={`w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-xl transition-all border group ${
              isActive
              ? 'bg-purple-600/10 text-white shadow-[0_0_20px_rgba(168,85,247,0.1)] border-purple-500/30' 
              : 'text-zinc-500 bg-transparent border-transparent hover:bg-white/5 hover:text-zinc-300'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-zinc-600 group-hover:text-zinc-400'}`}>
              {isFav ? <Star size={14} /> : <Tv size={14} />}
            </div>
            <span className={`uppercase tracking-[0.2em] text-[9px] font-black truncate transition-colors ${isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
              {cat.category_name.replace('★', '').trim()}
            </span>
          </button>
        );
      })}
    </aside>
  );
});

LiveCategorySidebar.displayName = 'LiveCategorySidebar';
