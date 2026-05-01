import { memo } from 'react';

interface CategorySidebarProps {
  categories: any[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}

export const CategorySidebar = memo(({ categories, selectedCategory, onSelectCategory }: CategorySidebarProps) => {
  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 bg-[#080808] p-5 gap-1.5 overflow-y-auto custom-scrollbar">
      <h3 className="text-[9px] font-black text-zinc-600 tracking-[0.3em] uppercase px-4 mb-3">Categorias</h3>
      {categories.map(cat => {
        const catId = String(cat.category_id);
        const isActive = selectedCategory === catId;
        
        return (
          <button
            key={catId}
            onClick={() => onSelectCategory(catId)}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${
              isActive
              ? 'bg-white text-black shadow-lg shadow-white/5' 
              : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
            }`}
          >
            {cat.category_name}
          </button>
        );
      })}
    </aside>
  );
});

CategorySidebar.displayName = 'CategorySidebar';
