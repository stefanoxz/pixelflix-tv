import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, Search, ChevronLeft } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { xtreamService } from '../../services/xtream';
import { contentActions } from '../../services/content';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VideoPlayer } from '../VideoPlayer';
import { ErrorBoundary } from '../layout/ErrorBoundary';
import { ContentItem } from './ContentItem';
import { ContentDetailModal } from './ContentDetailModal';
import { ExplorerHeader } from '../layout/ExplorerHeader';
import { CategorySidebar } from '../layout/CategorySidebar';
import { PremiumPlayer } from '../PremiumPlayer';
import { settingsService } from '../../services/settingsService';

interface ContentExplorerProps {
  type: 'live' | 'movie' | 'series';
  onBack: () => void;
}

export const ContentExplorer = ({ type, onBack }: ContentExplorerProps) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const username = xtreamService.getCredentials()?.username || 'user';

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', type],
    queryFn: () => xtreamService.getCategories(type),
    select: (data) => {
      const { adultLockEnabled } = settingsService.getSettings();
      let filtered = data;
      
      if (adultLockEnabled) {
        filtered = data.filter(c => 
          !c.category_name.toLowerCase().includes('adult') && 
          !c.category_name.toLowerCase().includes('🔞') &&
          !c.category_name.toLowerCase().includes('18+') &&
          !c.category_name.toLowerCase().includes('xxx')
        );
      }

      return [
        { category_id: 'Todos', category_name: 'Todos' }, 
        { category_id: 'Favoritos', category_name: '★ Meus Favoritos' }, 
        ...filtered
      ];
    },
  });

  // Fetch All Items (100% Sync strategy - relies on cache from SyncScreen)
  const { data: items = [], isLoading: itemsLoading, error, refetch } = useQuery({
    queryKey: ['streams', type, 'all'],
    queryFn: () => xtreamService.getStreams(type),
    staleTime: Infinity, // keep in cache indefinitely
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

  // Filter items locally based on selected category (e.g. Favoritos)
  const filteredItems = useMemo(() => {
    let list = items;
    if (selectedCategory === 'Favoritos') {
      const favIds = favorites.map((f: any) => String(f.stream_id));
      list = items.filter(item => favIds.includes(item.id));
    } else if (selectedCategory !== 'Todos') {
      list = items.filter(item => String(item.category_id) === selectedCategory);
    }
    
    if (debouncedSearchQuery) {
      list = list.filter(item => item.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()));
    }
    return list;
  }, [items, selectedCategory, debouncedSearchQuery, favorites]);

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

  const parentRef = React.useRef<HTMLDivElement>(null);
  
  // Calculate dynamic columns based on window width to match tailwind classes
  const [columns, setColumns] = useState(6); // default to 2xl
  
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (viewMode === 'list') {
        setColumns(1);
      } else {
        if (width >= 1536) setColumns(6); // 2xl
        else if (width >= 1280) setColumns(5); // xl
        else if (width >= 1024) setColumns(4); // lg
        else if (width >= 640) setColumns(3); // sm
        else setColumns(2); // default
      }
    };
    
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [viewMode]);

  const rowCount = Math.ceil(filteredItems.length / columns);
  const favoriteIds = useMemo(() => new Set(favorites.map((f: any) => String(f.stream_id))), [favorites]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => viewMode === 'grid' ? 350 : 150, // rough estimate of row height
    overscan: 5,
  });

  if (itemsLoading) {
    return (
      <div className="h-screen bg-[#08060a] text-white flex flex-col font-sans overflow-hidden">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-purple-600/5 blur-[120px] opacity-50" />
        </div>
        <ExplorerHeader 
          title={title}
          itemCount={0}
          searchQuery={searchQuery}
          onSearchChange={() => {}}
          viewMode={viewMode}
          onViewModeChange={() => {}}
          onBack={onBack}
        />
        <div className="flex flex-1 overflow-hidden">
          <CategorySidebar 
            categories={[]}
            selectedCategory={selectedCategory}
            onSelectCategory={() => {}}
          />
          <main className="flex-1 overflow-hidden p-6 md:p-12 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
            <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5" : "space-y-6 max-w-6xl mx-auto"}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="animate-pulse flex flex-col">
                  {viewMode === 'grid' ? (
                    <>
                      <div className="aspect-[2/3] rounded-[12px] bg-zinc-900 border border-white/5" />
                      <div className="mt-2 space-y-1.5">
                        <div className="h-3.5 bg-zinc-900 rounded-md w-3/4" />
                        <div className="h-2.5 bg-zinc-900 rounded-md w-1/4" />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-6 p-5 bg-white/5 rounded-[32px] border border-white/5">
                      <div className="w-20 h-28 rounded-2xl bg-zinc-900 flex-shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="h-5 bg-zinc-900 rounded-md w-1/3" />
                        <div className="h-3 bg-zinc-900 rounded-md w-1/4" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (isPlaying && selectedItem) {
    return (
      <PremiumPlayer 
        options={videoOptions}
        title={selectedItem.name}
        subtitle={type === 'movie' ? 'Filme' : 'Série'}
        onClose={() => setIsPlaying(false)}
      />
    );
  }

  return (
    <div className="h-screen bg-[#08060a] text-white flex flex-col font-sans selection:bg-white/10 overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-purple-600/5 blur-[120px] opacity-30" />
      </div>
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

        <main 
          ref={parentRef}
          className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar bg-gradient-to-br from-black to-[#080808] relative scroll-smooth"
        >
          <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')] opacity-[0.05] pointer-events-none" />

          {error ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6 w-full col-span-full relative z-10">
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
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4 w-full col-span-full relative z-10">
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
            <div 
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const startIndex = virtualRow.index * columns;
                const rowItems = filteredItems.slice(startIndex, startIndex + columns);

                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: viewMode === 'grid' ? '40px' : '24px',
                    }}
                  >
                    <div className={viewMode === 'grid' ? `grid grid-cols-${columns} gap-8 md:gap-10` : "space-y-6 max-w-6xl mx-auto"}>
                      {rowItems.map(item => (
                        <ContentItem 
                          key={item.id}
                          item={item}
                          isFav={favoriteIds.has(String(item.id))}
                          viewMode={viewMode}
                          onPlay={handlePlay}
                          onSelect={handleSelectItem}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
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
