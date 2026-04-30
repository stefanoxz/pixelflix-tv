import { useState, useEffect } from 'react';
import { ChevronLeft, Search, Grid, List as ListIcon, Play, Star, Info } from 'lucide-react';

interface ContentExplorerProps {
  type: 'live' | 'movie' | 'series';
  onBack: () => void;
}

export const ContentExplorer = ({ type, onBack }: ContentExplorerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Mock data for demonstration
  const categories = ['Todos', 'Favoritos', 'Documentários', 'Esportes', 'Notícias', 'Infantil', 'Entretenimento', 'Canais 4K'];
  const items = Array.from({ length: 24 }).map((_, i) => ({
    id: `${type}-${i}`,
    name: `${type === 'live' ? 'Canal' : type === 'movie' ? 'Filme' : 'Série'} ${i + 1}`,
    icon: `https://picsum.photos/seed/${type}-${i}/400/600`,
    category: categories[Math.floor(Math.random() * (categories.length - 2)) + 2]
  }));

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (selectedCategory === 'Todos' || item.category === selectedCategory)
  );

  const title = type === 'live' ? 'Canais ao Vivo' : type === 'movie' ? 'Filmes' : 'Séries';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* Sub-Header */}
      <header className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 bg-[#050505]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white border border-white/5"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-wider">{title}</h2>
            <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">{filteredItems.length} Itens encontrados</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 transition-all"
            />
          </div>
          <div className="flex bg-white/5 rounded-2xl p-1 border border-white/5">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Grid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <ListIcon size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Categories */}
        <aside className="hidden lg:flex w-72 flex-col border-r border-white/5 bg-[#080808] p-6 gap-2 overflow-y-auto">
          <h3 className="text-[10px] font-black text-zinc-600 tracking-[0.3em] uppercase px-4 mb-4">Categorias</h3>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`w-full text-left px-4 py-3.5 rounded-2xl text-sm font-bold transition-all border ${
                selectedCategory === cat 
                ? 'bg-purple-600/10 border-purple-600/20 text-purple-500 shadow-xl shadow-purple-900/5' 
                : 'border-transparent text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {filteredItems.map(item => (
                <div key={item.id} className="group relative">
                  <div className="aspect-[2/3] rounded-[24px] overflow-hidden bg-[#111] border border-white/5 transition-all group-hover:scale-[1.05] group-hover:shadow-2xl group-hover:shadow-purple-500/10 group-hover:border-purple-500/30">
                    <img 
                      src={item.icon} 
                      alt={item.name}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    
                    {/* Overlay controls */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-5">
                      <div className="flex gap-2">
                        <button className="flex-1 bg-white text-black h-10 rounded-xl flex items-center justify-center hover:bg-zinc-200 transition-colors shadow-xl">
                          <Play size={18} fill="currentColor" />
                        </button>
                        <button className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10">
                          <Star size={18} />
                        </button>
                        <button className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10">
                          <Info size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 px-2">
                    <h4 className="text-sm font-bold truncate group-hover:text-purple-400 transition-colors">{item.name}</h4>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">{item.category}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map(item => (
                <div 
                  key={item.id} 
                  className="group flex items-center gap-6 p-4 bg-[#0A0A0A] hover:bg-[#111] rounded-[24px] border border-white/5 hover:border-purple-500/30 transition-all"
                >
                  <div className="w-16 h-20 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0">
                    <img src={item.icon} alt={item.name} className="w-full h-full object-cover opacity-80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-lg truncate">{item.name}</h4>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="p-3 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all border border-white/5">
                      <Star size={20} />
                    </button>
                    <button className="flex items-center gap-3 bg-white text-black px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-lg">
                      Assistir
                      <Play size={16} fill="currentColor" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
