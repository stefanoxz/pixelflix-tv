import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Search, Grid, List as ListIcon, Play, Star, Info, X, Settings, Loader2, Heart } from 'lucide-react';
import { xtreamService } from '../services/xtream';
import { contentActions } from '../services/content';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VideoPlayer } from './VideoPlayer';

interface ContentExplorerProps {
  type: 'live' | 'movie' | 'series';
  onBack: () => void;
}

export const ContentExplorer = ({ type, onBack }: ContentExplorerProps) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const username = xtreamService.getCredentials()?.username || 'user';

  // React Query for categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', type],
    queryFn: () => xtreamService.getCategories(type),
    select: (data) => [{ category_id: 'Todos', category_name: 'Todos' }, { category_id: 'Favoritos', category_name: '★ Meus Favoritos' }, ...data],
  });

  // React Query for streams
  const { data: items = [], isLoading: itemsLoading, error } = useQuery({
    queryKey: ['streams', type],
    queryFn: () => xtreamService.getStreams(type),
    select: (data) => {
      if (!Array.isArray(data)) {
        console.warn('Streams data is not an array:', data);
        return [];
      }
      return data.map(s => ({
        ...s,
        id: String(s.stream_id || s.series_id || (s as any).id),
        name: s.name || (s as any).title || 'Sem Nome',
        icon: s.stream_icon || s.cover || (s as any).stream_icon,
        rating: s.rating || 'N/A',
        year: s.year || '2024',
        duration: type === 'live' ? 'AO VIVO' : s.duration || 'N/A'
      }));
    },
  });

  // React Query for favorites from DB
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', username],
    queryFn: () => contentActions.getFavorites(username),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: (item: any) => contentActions.toggleFavorite(username, item, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', username] });
    },
  });

  const filteredItems = useMemo(() => {
    let list = items;
    
    if (selectedCategory === 'Favoritos') {
      const favIds = favorites.map((f: any) => String(f.stream_id));
      list = items.filter(item => favIds.includes(item.id));
    } else if (selectedCategory !== 'Todos') {
      list = items.filter(item => String(item.category_id) === String(selectedCategory));
    }

    if (searchQuery) {
      list = list.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return list;
  }, [items, selectedCategory, searchQuery, favorites]);

  const title = type === 'live' ? 'Canais ao Vivo' : type === 'movie' ? 'Filmes' : 'Séries';

  const handlePlay = (item: any) => {
    setSelectedItem(item);
    setIsPlaying(true);
  };

  const videoOptions = useMemo(() => {
    if (!selectedItem) return null;
    return {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: true,
      sources: [{
        src: xtreamService.getStreamUrl(selectedItem.id, type === 'live' ? 'm3u8' : 'mp4', type),
        type: type === 'live' ? 'application/x-mpegURL' : 'video/mp4'
      }]
    };
  }, [selectedItem, type]);

  if (itemsLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
        <p className="text-zinc-600 font-black uppercase tracking-[0.4em] text-[10px]">Sincronizando Conteúdo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white/10">
      <header className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 bg-[#050505]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-5">
          <button onClick={onBack} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white border border-white/5">
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
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}><Grid size={18} /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}><ListIcon size={18} /></button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 bg-[#080808] p-5 gap-1.5 overflow-y-auto custom-scrollbar">
          <h3 className="text-[9px] font-black text-zinc-600 tracking-[0.3em] uppercase px-4 mb-3">Categorias</h3>
          {categories.map(cat => (
            <button
              key={cat.category_id}
              onClick={() => setSelectedCategory(cat.category_id)}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === String(cat.category_id)
                ? 'bg-white text-black shadow-lg shadow-white/5' 
                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
              }`}
            >
              {cat.category_name}
            </button>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar bg-gradient-to-br from-black to-[#080808] relative">
          {/* Subtle noise pattern */}
          <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')] opacity-[0.05] pointer-events-none" />

          <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8 md:gap-10" : "space-y-6 max-w-6xl mx-auto"}>
            {filteredItems.map(item => {
              const isFav = favorites.some((f: any) => String(f.stream_id) === item.id);
              return viewMode === 'grid' ? (
                <div key={item.id} className="group flex flex-col animate-in fade-in zoom-in-95 duration-700">
                  <div onClick={() => setSelectedItem(item)} className="cursor-pointer relative aspect-[2/3] rounded-[40px] overflow-hidden bg-zinc-900 border border-white/5 transition-all duration-700 group-hover:-translate-y-3 group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.8)] group-hover:border-white/20 ring-1 ring-white/0 group-hover:ring-white/10">
                    <img src={item.icon} alt={item.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-110" onError={(e) => {(e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x600/111111/FFFFFF?text=SEM+CAPA';}} />
                    
                    {/* Badge Rating */}
                    <div className="absolute top-5 right-5 px-3 py-1.5 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center gap-2 shadow-2xl">
                      <Star size={12} className="text-yellow-500 fill-yellow-500" />
                      <span className="text-[11px] font-black tracking-tighter">{item.rating}</span>
                    </div>

                    {/* Overlay Action */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-8">
                      <button onClick={(e) => { e.stopPropagation(); handlePlay(item); }} className="w-full bg-white text-black h-14 rounded-3xl flex items-center justify-center hover:bg-zinc-200 transition-all transform translate-y-6 group-hover:translate-y-0 duration-500 shadow-[0_20px_40px_rgba(255,255,255,0.1)]">
                        <Play size={24} fill="currentColor" className="ml-1" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-6 px-2 space-y-1">
                    <h4 className="text-[13px] font-black truncate text-zinc-300 group-hover:text-white transition-colors tracking-tight uppercase">{item.name}</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-600 font-black tracking-[0.2em]">{item.year}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleFavoriteMutation.mutate(item); }} 
                        className={`p-2 rounded-xl transition-all ${isFav ? 'text-red-500 bg-red-500/10' : 'text-zinc-700 hover:text-white hover:bg-white/5'}`}
                      >
                        <Heart size={16} fill={isFav ? 'currentColor' : 'none'} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={item.id} className="group flex items-center gap-6 p-5 bg-white/5 hover:bg-white/10 rounded-[32px] border border-white/5 transition-all cursor-pointer" onClick={() => setSelectedItem(item)}>
                  <div className="w-20 h-28 rounded-2xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5 shadow-xl">
                    <img src={item.icon} alt={item.name} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all" onError={(e) => {(e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x300/111111/FFFFFF?text=S/C';}} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-black text-xl truncate">{item.name}</h4>
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-black">{item.rating}</span>
                    </div>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{item.year} • {item.duration}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); toggleFavoriteMutation.mutate(item); }} className={`p-3.5 rounded-2xl bg-white/5 transition-all border border-white/5 ${isFav ? 'text-red-500 border-red-500/20 bg-red-500/5' : 'text-zinc-500 hover:text-white'}`}>
                      <Heart size={20} fill={isFav ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handlePlay(item); }} className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl">
                      Assistir <Play size={16} fill="currentColor" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {selectedItem && !isPlaying && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setSelectedItem(null)} />
          <div className="relative w-full max-w-4xl bg-[#0A0A0A] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row animate-in zoom-in-95 duration-500">
            <button onClick={() => setSelectedItem(null)} className="absolute top-6 right-6 z-10 p-3 rounded-full bg-black/50 hover:bg-white/10 transition-colors border border-white/10"><X size={20} /></button>
            <div className="w-full md:w-[40%] aspect-[3/4] md:aspect-auto">
              <img src={selectedItem.icon} className="w-full h-full object-cover opacity-80" onError={(e) => {(e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x900/111111/FFFFFF?text=SEM+CAPA';}} />
            </div>
            <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black tracking-widest uppercase">{type === 'live' ? 'AO VIVO' : 'FILME'}</span>
                <span className="text-zinc-500 text-[10px] font-black tracking-widest uppercase">{selectedItem.year}</span>
                <div className="flex items-center gap-1.5 text-yellow-500"><Star size={12} fill="currentColor" /><span className="text-xs font-black">{selectedItem.rating}</span></div>
              </div>
              <h3 className="text-4xl md:text-5xl font-black mb-6 leading-tight uppercase tracking-tight">{selectedItem.name}</h3>
              <div className="space-y-6 mb-10">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-zinc-600 tracking-[0.3em] uppercase">Sinopse</h4>
                  <p className="text-zinc-400 text-sm leading-relaxed">{selectedItem.synopsis || "Descrição não disponível."}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setIsPlaying(true)} className="flex-1 bg-white text-black py-5 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all shadow-2xl flex items-center justify-center gap-3"><Play size={18} fill="currentColor" /> Assistir Agora</button>
                <button onClick={() => toggleFavoriteMutation.mutate(selectedItem)} className={`p-5 rounded-[24px] bg-white/5 border border-white/10 transition-all ${favorites.some((f: any) => String(f.stream_id) === selectedItem.id) ? 'text-red-500 border-red-500/20' : 'text-zinc-400 hover:text-white'}`}><Heart size={24} fill={favorites.some((f: any) => String(f.stream_id) === selectedItem.id) ? 'currentColor' : 'none'} /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPlaying && selectedItem && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in duration-500">
          <header className="p-8 flex items-center justify-between absolute top-0 left-0 right-0 z-[210] bg-gradient-to-b from-black/80 to-transparent">
            <button onClick={() => setIsPlaying(false)} className="p-3 rounded-full bg-black/50 hover:bg-white/10 transition-colors border border-white/10 flex items-center gap-3 px-6">
              <ChevronLeft size={20} /><span className="text-xs font-black uppercase tracking-widest">Sair do Player</span>
            </button>
            <div className="text-center">
              <h3 className="text-lg font-black uppercase tracking-widest">{selectedItem.name}</h3>
            </div>
            <div className="w-32" />
          </header>
          <div className="flex-1 relative group">
            <VideoPlayer options={videoOptions} onReady={(player) => { console.log('Player Ready', player); }} />
          </div>
        </div>
      )}
    </div>
  );
};
