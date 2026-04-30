import { Play, ChevronRight } from 'lucide-react'
import { Category } from '../types/iptv'

interface SidebarProps {
  categories: Category[]
  activeCategory: string
  onSelectCategory: (id: string) => void
}

export const Sidebar = ({ categories, activeCategory, onSelectCategory }: SidebarProps) => {
  return (
    <aside className="w-72 border-r border-white/5 bg-neutral-900/20 backdrop-blur-xl hidden lg:flex flex-col h-screen sticky top-0 overflow-hidden">
      <div className="p-8 border-b border-white/5">
        <div className="flex items-center gap-3 text-white font-black text-2xl tracking-tighter">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-glow">
            <Play className="w-6 h-6 text-white fill-current" />
          </div>
          Super<span className="text-primary">Tech</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1 custom-scrollbar">
        <h3 className="px-4 text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-4">Categorias</h3>
        {categories.map(c => (
          <button 
            key={c.category_id}
            onClick={() => {
              onSelectCategory(c.category_id);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group ${activeCategory === c.category_id ? 'bg-primary text-white shadow-glow' : 'hover:bg-white/5 hover:text-white'}`}
          >
            <span className="text-sm font-bold truncate">{c.category_name}</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${activeCategory === c.category_id ? 'translate-x-0' : '-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'}`} />
          </button>
        ))}
      </div>
    </aside>
  )
}
