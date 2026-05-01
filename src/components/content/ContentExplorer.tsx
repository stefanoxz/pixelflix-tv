import { useState, useMemo, useCallback } from 'react';
import { Loader2, AlertCircle, Search, ChevronLeft } from 'lucide-react';
import { xtreamService } from '../../services/xtream';
import { contentActions } from '../../services/content';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VideoPlayer } from '../VideoPlayer';
import { ContentItem } from './ContentItem';
import { ContentDetailModal } from './ContentDetailModal';
import { ExplorerHeader } from '../layout/ExplorerHeader';
import { CategorySidebar } from '../layout/CategorySidebar';

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

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', type],
    queryFn: () => xtreamService.getCategories(type),
    select: (data) => [
      { category_id: 'Todos', category_name: 'Todos' }, 
      { category_id: 'Favoritos', category_name: '★ Meus Favoritos' }, 
      ...data
    ],
  });

  const { data: items = [], isLoading: itemsLoading, error, refetch } = useQuery({
    queryKey: ['streams', type, selectedCategory === 'Favoritos' ? 'all' : selectedCategory],
    queryFn: () => {
      const catId = (selectedCategory === 'Todos' || selectedCategory === 'Favoritos') ? undefined : selectedCategory;
      return xtreamService.getStreams(type, catId);
    },
    select: (data) => {
      if (!Array.isArray(data)) return [];
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
    }
    if (searchQuery) {
      list = list.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [items, selectedCategory, searchQuery, favorites]);

  const title = type === 'live' ? 'Canais ao Vivo' : type === 'movie' ? 'Filmes' : 'Séries';

  const handlePlay = useCallback((item: any) => {
    setSelectedItem(item);
    setIsPlaying(true);
  }, []);

  const handleToggleFavorite = useCallback((item: any) => {
    toggleFavoriteMutation.mutate(item);
  }, [toggleFavoriteMutation]);

  const handleSelectItem = useCallback((item: any) => {
    setSelectedItem(item);
  }, []);

  const videoOptions = useMemo(() => {
    if (!selectedItem) return null;
    
    // Determine the best extension based on type
    const ext = type === 'live' ? 'm3u8' : 'mp4';
    const streamUrl = xtreamService.getStreamUrl(selectedItem.id, ext, type);
    
    return {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: true,
      sources: [{
        src: streamUrl,
        type: type === 'live' ? 'application/x-mpegURL' : 'video/mp4'
      }]
    };
  }, [selectedItem, type]);

  if (itemsLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <div className="absolute inset-0 blur-lg bg-blue-500/20 animate-pulse" />
        </div>
        <p className="text-zinc-600 font-black uppercase tracking-[0.4em] text-[10px]">Carregando conteúdo...</p>
      </div>
    );
  }

  if (isPlaying && selectedItem) {
    return (
      <div className="fixed inset-0 z-[200] bg-black">
        <VideoPlayer options={videoOptions} onReady={() => console.log('Player ready')} />
        <button 
          onClick={() => setIsPlaying(false)}
          className="absolute top-8 left-8 z-[210] p-4 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all"
        >
          <ChevronLeft size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white/10">
      <ExplorerHeader 
        title={title}
        itemCount={filteredItems.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onBack={onBack}
      />

      <div className="flex flex-1 overflow-hidden">
        <CategorySidebar 
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar bg-gradient-to-br from-black to-[#080808] relative scroll-smooth">
          <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')] opacity-[0.05] pointer-events-none" />

          {error ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6 w-full col-span-full">
              <div className="p-6 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mb-4 animate-pulse">
                <AlertCircle size={48} strokeWidth={1} />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-widest">Erro ao carregar conteúdo</h3>
              <p className="text-zinc-500 text-sm max-w-md mx-auto">Não foi possível conectar ao servidor IPTV.</p>
              <button 
                onClick={() => refetch()}
                className="mt-6 px-10 py-4 bg-white text-black font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl"
              >
                Tentar Novamente
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4 w-full col-span-full">
              <div className="p-6 rounded-full bg-white/5 border border-white/10 text-zinc-600 mb-4">
                <Search size={48} strokeWidth={1} />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-widest">Nenhum conteúdo encontrado</h3>
              <button 
                onClick={() => { setSearchQuery(''); setSelectedCategory('Todos'); }}
                className="mt-6 px-8 py-3 bg-white text-black font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-all"
              >
                Limpar Filtros
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8 md:gap-10" : "space-y-6 max-w-6xl mx-auto"}>
              {filteredItems.map(item => (
                <ContentItem 
                  key={item.id}
                  item={item}
                  isFav={favorites.some((f: any) => String(f.stream_id) === item.id)}
                  viewMode={viewMode}
                  onPlay={handlePlay}
                  onSelect={handleSelectItem}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <ContentDetailModal 
        item={selectedItem}
        type={type}
        onClose={() => setSelectedItem(null)}
        onPlay={handlePlay}
      />
    </div>
  );
};
