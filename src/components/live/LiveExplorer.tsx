import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { xtreamService } from '../../services/xtream';
import { contentActions } from '../../services/content';
import { settingsService } from '../../services/settingsService';
import { LiveCategorySidebar } from './LiveCategorySidebar';
import { LiveChannelList } from './LiveChannelList';
import { LivePlayerPanel } from './LivePlayerPanel';
import { ExplorerHeader } from '../layout/ExplorerHeader';

interface LiveExplorerProps {
  onBack: () => void;
  preselectedChannel?: any;
  initialCategoryId?: string | null;
}

export const LiveExplorer = ({ onBack, preselectedChannel, initialCategoryId }: LiveExplorerProps) => {
  const queryClient = useQueryClient();
  const username = xtreamService.getCredentials()?.username || 'user';

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategoryId || 'Todos');
  const [selectedChannel, setSelectedChannel] = useState<any | null>(preselectedChannel ?? null);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Fetch Channels
  const { data: allChannels = [] } = useQuery({
    queryKey: ['streams', 'live', 'all'],
    queryFn: () => xtreamService.getStreams('live'),
    staleTime: Infinity, 
    select: (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(s => ({
        ...s,
        id: String(s.stream_id || (s as any).id || s.num || Math.random()),
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
  const { data: epgData, isLoading: isLoadingEPG } = useQuery({
    queryKey: ['epg', selectedChannel?.id],
    queryFn: () => selectedChannel ? xtreamService.getShortEPG(selectedChannel.id) : null,
    enabled: !!selectedChannel,
  });

  // Filter channels
  const filteredChannels = useMemo(() => {
    let list = allChannels;
    if (selectedCategory === 'Favoritos') {
      const favIds = favoritesData.map((f: any) => String(f.stream_id));
      list = allChannels.filter(item => favIds.includes(item.id));
    } else if (selectedCategory !== 'Todos') {
      list = allChannels.filter(item => String(item.category_id) === selectedCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(item => item.name.toLowerCase().includes(query));
    }
    return list;
  }, [allChannels, selectedCategory, favoritesData, searchQuery]);

  const favoritesList = useMemo(() => favoritesData.map((f: any) => String(f.stream_id)), [favoritesData]);

  const currentProgramTitle = useMemo(() => {
    if (!epgData || epgData.length === 0) return null;
    const now = xtreamService.getServerTime();
    const current = epgData.find((prog: any) => {
      let start = prog.start_timestamp ? parseInt(prog.start_timestamp) : (prog.start ? new Date(prog.start).getTime() / 1000 : 0);
      let end = prog.stop_timestamp ? parseInt(prog.stop_timestamp) : (prog.end ? new Date(prog.end).getTime() / 1000 : 0);
      if (start > 2000000000) start /= 1000;
      if (end > 2000000000) end /= 1000;
      return now >= start && now < end;
    }) || epgData[0];
    if (!current || !current.title) return null;
    try {
      return atob(current.title);
    } catch {
      return current.title;
    }
  }, [epgData]);

  return (
    <div className="h-screen bg-[#080808] text-white flex flex-col font-sans overflow-hidden">
      <ExplorerHeader 
        title="Canais ao Vivo"
        itemCount={filteredChannels.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onBack={onBack}
      >
        <div className="hidden lg:flex items-center gap-3">
          <div className="px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest">
              {selectedChannel ? 'Reproduzindo Agora' : 'Auto Qualidade'}
            </span>
          </div>
        </div>
      </ExplorerHeader>

      <div className="flex-1 flex overflow-hidden relative z-10 bg-[#050308]">
        <LiveCategorySidebar 
          categories={categories} 
          selectedCategory={selectedCategory} 
          onSelectCategory={(id) => setSelectedCategory(id)} 
        />
        
        <LiveChannelList 
          channels={filteredChannels} 
          selectedChannel={selectedChannel}
          favorites={favoritesList}
          currentProgramTitle={currentProgramTitle}
          onSelectChannel={setSelectedChannel}
          onToggleFavorite={(ch) => toggleFavoriteMutation.mutate(ch)}
        />
        
        <LivePlayerPanel 
          channel={selectedChannel} 
          epg={epgData}
          isLoadingEPG={isLoadingEPG}
        />
      </div>
    </div>
  );
};
