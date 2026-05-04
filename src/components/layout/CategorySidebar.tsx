import { memo } from 'react';
import { ChevronRight, Clapperboard, Star, Play } from 'lucide-react';

interface CategorySidebarProps {
  categories: any[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}

export const CategorySidebar = memo(({ categories, selectedCategory, onSelectCategory }: CategorySidebarProps) => {
  return (
    <aside className="hidden lg:flex w-80 flex-col border-r border-white/5 bg-[#080808] p-6 gap-3 overflow-y-auto custom-scrollbar relative z-20">
      <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-purple-500/10 to-transparent" />
      
      <div className="mb-6 px-4">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Categorias</h3>
      </div>

      {categories.map(cat => {
        const catId = String(cat.category_id);
        const isActive = selectedCategory === catId;
        const isFav = cat.category_name.toLowerCase().includes('favoritos');
        
        return (
          <button
            key={catId}
            onClick={() => onSelectCategory(catId)}
            className={`w-full group flex items-center justify-between px-5 py-4 rounded-2xl transition-all relative overflow-hidden border ${
              isActive
              ? 'bg-purple-600/10 border-purple-500/30 text-white shadow-[0_0_20px_rgba(168,85,247,0.1)]' 
              : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10 hover:text-white hover:border-white/10'
            }`}
          >
            {isActive && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
            )}
            
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-purple-500 text-white' : 'bg-white/5 text-zinc-600 group-hover:text-zinc-400'}`}>
                {isFav ? <Star size={16} weight="fill" /> : <Clapperboard size={16} />}
              </div>
              <span className={`text-xs font-black tracking-wider truncate ${isActive ? 'text-white' : 'text-zinc-400 uppercase'}`}>
                {cat.category_name.replace('★', '').trim()}
              </span>
            </div>

            <ChevronRight size={14} className={`transition-all duration-300 ${isActive ? 'text-purple-400 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />
          </button>
        );
      })}
    </aside>
  );
});

CategorySidebar.displayName = 'CategorySidebar';
