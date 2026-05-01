import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { xtreamService } from '../../services/xtream';
import { contentActions } from '../../services/content';
import { settingsService } from '../../services/settingsService';
import { LiveCategorySidebar } from './LiveCategorySidebar';
import { LiveChannelList } from './LiveChannelList';
import { LivePlayerPanel } from './LivePlayerPanel';
import { ChevronLeft } from 'lucide-react';

interface LiveExplorerProps {
  onBack: () => void;
}

export const LiveExplorer = ({ onBack }: LiveExplorerProps) => {
  const queryClient = useQueryClient();
  const username = xtreamService.getCredentials()?.username || 'user';

  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedChannel, setSelectedChannel] = useState<any | null>(null);

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'live'],
    queryFn: () => xtreamService.getCategories('live'),
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

  // Fetch Channels (100% Sync strategy - relies on cache from SyncScreen)
  const { data: allChannels = [] } = useQuery({
    queryKey: ['streams', 'live', 'all'],
    queryFn: () => xtreamService.getStreams('live'),
    staleTime: Infinity, // keep in cache indefinitely
    select: (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(s => ({
        ...s,
        id: String(s.stream_id),
        name: s.name || 'Sem Nome',
        icon: s.stream_icon
      }));
    },
  });

  // Fetch Favorites
  const { data: favoritesData = [] } = useQuery({
    queryKey: ['favorites', username],
    queryFn: () => contentActions.getFavorites(username),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: (item: any) => contentActions.toggleFavorite(username, item, 'live'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', username] });
    },
  });

  // Fetch EPG for selected channel
  const { data: epgData } = useQuery({
    queryKey: ['epg', selectedChannel?.id],
    queryFn: () => selectedChannel ? xtreamService.getShortEPG(selectedChannel.id) : null,
    enabled: !!selectedChannel,
  });

  // Filter channels locally based on selected category (e.g. Favoritos)
  const filteredChannels = useMemo(() => {
    let list = allChannels;
    if (selectedCategory === 'Favoritos') {
      const favIds = favoritesData.map((f: any) => String(f.stream_id));
      list = allChannels.filter(item => favIds.includes(item.id));
    } else if (selectedCategory !== 'Todos') {
      list = allChannels.filter(item => String(item.category_id) === selectedCategory);
    }
    return list;
  }, [allChannels, selectedCategory, favoritesData]);

  // Set default category when categories load if not set
  useEffect(() => {
    if (categories.length > 0 && selectedCategory === 'Todos') {
      // Find a category to select, maybe the first actual category
      // For now, keeping 'Todos' is fine, or default to the first one after Favoritos
      // Let's keep 'Todos'
    }
  }, [categories]);

  const favoritesList = useMemo(() => favoritesData.map((f: any) => String(f.stream_id)), [favoritesData]);

  // Formatted date and time for header
  const now = new Date();
  const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateString = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase();

  return (
    <div className="h-screen bg-black text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-[#050505] shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-black tracking-widest uppercase">Canais</h1>
          </div>
        </div>
        <div className="flex flex-col items-end justify-center">
          <span className="text-sm font-black tracking-wider leading-none">{timeString}</span>
          <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">{dateString}</span>
        </div>
      </header>

      {/* Main Content: 3 Columns */}
      <div className="flex-1 flex overflow-hidden">
        <LiveCategorySidebar 
          categories={categories} 
          selectedCategory={selectedCategory} 
          onSelectCategory={(id) => {
            setSelectedCategory(id);
            setSelectedChannel(null); // Optional: clear selected channel when changing category
          }} 
        />
        
        <LiveChannelList 
          channels={filteredChannels} 
          selectedChannel={selectedChannel}
          favorites={favoritesList}
          onSelectChannel={setSelectedChannel}
          onToggleFavorite={(ch) => toggleFavoriteMutation.mutate(ch)}
        />
        
        <LivePlayerPanel 
          channel={selectedChannel} 
          epg={epgData} 
        />
      </div>
    </div>
  );
};
