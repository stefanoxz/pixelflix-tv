import { useState, useEffect } from 'react';
import { ChevronLeft, Search, Grid, List as ListIcon, Play, Star, Info, X, Settings } from 'lucide-react';

interface ContentExplorerProps {
  type: 'live' | 'movie' | 'series';
  onBack: () => void;
}

export const ContentExplorer = ({ type, onBack }: ContentExplorerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Mock data for demonstration - in a real app this would come from xtreamService
  const categories = ['Todos', 'Favoritos', 'Documentários', 'Esportes', 'Notícias', 'Infantil', 'Entretenimento', 'Canais 4K'];
  
  const items = Array.from({ length: 24 }).map((_, i) => ({
    id: `${type}-${i}`,
    name: type === 'live' ? `CANAL ${i + 1} HD` : type === 'movie' ? `FILME ${i + 1} (2025)` : `SÉRIE ${i + 1}`,
    icon: `https://picsum.photos/seed/${type}-${i}/400/600`,
    category: categories[Math.floor(Math.random() * (categories.length - 2)) + 2],
    rating: (Math.random() * 2 + 7).toFixed(1),
    year: 2024 - Math.floor(Math.random() * 10),
    duration: type === 'movie' ? '01h 45m' : type === 'live' ? 'AO VIVO' : '2 Temporadas',
    synopsis: "Uma descrição detalhada sobre o conteúdo selecionado. Esta história envolve muita ação, drama e momentos inesquecíveis que prendem a atenção do espectador do início ao fim."
  }));

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (selectedCategory === 'Todos' || item.category === selectedCategory)
  );

  const title = type === 'live' ? 'Canais ao Vivo' : type === 'movie' ? 'Filmes' : 'Séries';

  const handlePlay = (item: any) => {
    setSelectedItem(item);
    setIsPlaying(true);
  };

  const handleInfo = (item: any) => {
    setSelectedItem(item);
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white/10">
      {/* Sub-Header */}
      <header className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 bg-[#050505]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-5">
          <button 
            onClick={onBack}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white border border-white/5"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black uppercase tracking-widest">{title}</h2>
            <div className="h-4 w-[1px] bg-white/10" />
            <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">{filteredItems.length} Itens</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:bg-white/10 transition-all placeholder:text-zinc-600"
            />
          </div>
          <div className="flex bg-white/5 rounded-2xl p-1 border border-white/5">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
            >
              <Grid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Categories */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 bg-[#080808] p-5 gap-1.5 overflow-y-auto custom-scrollbar">
          <h3 className="text-[9px] font-black text-zinc-600 tracking-[0.3em] uppercase px-4 mb-3">Categorias</h3>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === cat 
                ? 'bg-white text-black shadow-lg shadow-white/5' 
                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-gradient-to-br from-black to-[#050505]">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 md:gap-8">
              {filteredItems.map(item => (
                <div key={item.id} className="group flex flex-col">
                  <div 
                    onClick={() => handleInfo(item)}
                    className="cursor-pointer relative aspect-[2/3] rounded-[32px] overflow-hidden bg-[#111] border border-white/5 transition-all duration-500 group-hover:scale-[1.05] group-hover:shadow-2xl group-hover:shadow-white/5 group-hover:border-white/20"
                  >
                    <img 
                      src={item.icon} 
                      alt={item.name}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"
                    />
                    
                    <div className="absolute top-4 right-4 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-1.5">
                      <Star size={10} className="text-yellow-500 fill-yellow-500" />
                      <span className="text-[10px] font-black">{item.rating}</span>
                    </div>

                    {/* Overlay controls */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handlePlay(item); }}
                        className="w-full bg-white text-black h-12 rounded-2xl flex items-center justify-center hover:bg-zinc-200 transition-all transform translate-y-4 group-hover:translate-y-0 duration-500 shadow-2xl"
                      >
                        <Play size={20} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 px-1">
                    <h4 className="text-sm font-bold truncate group-hover:text-white transition-colors">{item.name}</h4>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{item.year}</p>
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-tighter">{item.duration}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 max-w-5xl">
              {filteredItems.map(item => (
                <div 
                  key={item.id} 
                  className="group flex items-center gap-6 p-5 bg-white/5 hover:bg-white/10 rounded-[32px] border border-white/5 transition-all cursor-pointer"
                  onClick={() => handleInfo(item)}
                >
                  <div className="w-20 h-28 rounded-2xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 shadow-xl">
                    <img src={item.icon} alt={item.name} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-black text-xl truncate">{item.name}</h4>
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-black">{item.rating}</span>
                    </div>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{item.category} • {item.year}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="p-3.5 rounded-2xl bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all border border-white/5">
                      <Star size={20} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePlay(item); }}
                      className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl"
                    >
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

      {/* Details Modal */}
      {selectedItem && !isPlaying && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setSelectedItem(null)} />
          <div className="relative w-full max-w-4xl bg-[#0A0A0A] border border-white/10 rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col md:flex-row animate-in zoom-in-95 duration-500">
            <button 
              onClick={() => setSelectedItem(null)}
              className="absolute top-6 right-6 z-10 p-3 rounded-full bg-black/50 hover:bg-white/10 transition-colors border border-white/10"
            >
              <X size={20} />
            </button>

            <div className="w-full md:w-[40%] aspect-[3/4] md:aspect-auto">
              <img src={selectedItem.icon} className="w-full h-full object-cover opacity-80" />
            </div>

            <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black tracking-widest uppercase">{type === 'live' ? 'AO VIVO' : 'FILME'}</span>
                <span className="text-zinc-500 text-[10px] font-black tracking-widest uppercase">{selectedItem.year}</span>
                <div className="flex items-center gap-1.5 text-yellow-500">
                  <Star size={12} fill="currentColor" />
                  <span className="text-xs font-black">{selectedItem.rating}</span>
                </div>
              </div>
              
              <h3 className="text-4xl md:text-5xl font-black mb-6 leading-tight uppercase tracking-tight">{selectedItem.name}</h3>
              
              <div className="space-y-6 mb-10">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-zinc-600 tracking-[0.3em] uppercase">Sinopse</h4>
                  <p className="text-zinc-400 text-sm leading-relaxed">{selectedItem.synopsis}</p>
                </div>
                
                <div className="flex gap-10">
                  <div className="space-y-1">
                    <h4 className="text-[9px] font-black text-zinc-600 tracking-[0.3em] uppercase">Duração</h4>
                    <p className="text-xs font-bold">{selectedItem.duration}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-[9px] font-black text-zinc-600 tracking-[0.3em] uppercase">Gênero</h4>
                    <p className="text-xs font-bold">{selectedItem.category}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setIsPlaying(true)}
                  className="flex-1 bg-white text-black py-5 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all shadow-2xl flex items-center justify-center gap-3"
                >
                  <Play size={18} fill="currentColor" />
                  Assistir Agora
                </button>
                <button className="p-5 rounded-[24px] bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-zinc-400 hover:text-white">
                  <Star size={24} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Mockup */}
      {isPlaying && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in duration-500">
          <header className="p-8 flex items-center justify-between absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent">
            <button 
              onClick={() => setIsPlaying(false)}
              className="p-3 rounded-full bg-black/50 hover:bg-white/10 transition-colors border border-white/10 flex items-center gap-3 px-6"
            >
              <ChevronLeft size={20} />
              <span className="text-xs font-black uppercase tracking-widest">Sair do Player</span>
            </button>
            <div className="text-center">
              <h3 className="text-lg font-black uppercase tracking-widest">{selectedItem?.name}</h3>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.3em] mt-1">{type === 'live' ? 'AO VIVO' : selectedItem?.category}</p>
            </div>
            <div className="w-32" /> {/* Spacer */}
          </header>

          <div className="flex-1 flex flex-col items-center justify-center relative group">
            <div className="w-full max-w-5xl aspect-video rounded-[40px] overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(255,255,255,0.05)] bg-[#050505] flex items-center justify-center relative">
              <div className="flex flex-col items-center gap-6 animate-pulse">
                <div className="w-20 h-20 rounded-full border-4 border-white/5 border-t-white animate-spin" />
                <p className="text-zinc-600 font-black uppercase tracking-[0.4em] text-xs">Carregando Stream...</p>
              </div>
              
              {/* Fake UI Overlay for Player */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-10">
                <div className="w-full space-y-8">
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                      <button className="text-white hover:scale-110 transition-transform"><Play size={28} fill="currentColor" /></button>
                      <div className="flex items-center gap-4 text-xs font-black tracking-widest text-zinc-400">
                        <span>00:45:12</span>
                        <span className="text-zinc-700">/</span>
                        <span>02:28:00</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <button className="text-zinc-400 hover:text-white transition-colors"><Settings size={20} /></button>
                      <button className="text-zinc-400 hover:text-white transition-colors"><Grid size={20} /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Error Message similar to original */}
            <div className="mt-12 text-center space-y-3 opacity-30">
              <p className="text-red-500 font-black uppercase tracking-[0.3em] text-xs">Servidor não respondeu</p>
              <p className="text-[10px] text-zinc-600 font-bold max-w-xs">Tempo esgotado ao tentar carregar o canal. Falha geral do stream.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
