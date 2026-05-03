import { memo } from 'react';
import { Clapperboard, Film } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { HomeNav } from './home/HomeNav';
import { HeroCarousel } from './home/HeroCarousel';
import { ContentRow } from './home/ContentRow';
import { RecentChannelsRow } from './home/RecentChannelsRow';
import { xtreamService } from '@/services/xtream';
import { Profile, RowItem } from '@/types';

interface DashboardProps {
  onLogout: () => void;
  onNavigate: (view: any, search?: string, data?: any) => void;
  profile: Profile | null;
}

function toRowItem(s: any, type: 'movie' | 'series'): RowItem {
  const poster =
    s.stream_icon || s.cover || s.movie_image || s.backdrop_path || '';
  return {
    id: String(s.stream_id || s.series_id || s.num || Math.random()),
    title: s.name || s.title || 'Sem título',
    poster,
    badge: type === 'movie' ? 'FILME' : 'SÉRIE',
    badgeColor: type === 'movie' ? '#7C3AED' : '#9333EA',
    raw: s, // keep original for ContentDetailModal
  };
}

export const Dashboard = memo(({ onLogout, onNavigate }: DashboardProps) => {
  // Pull real data from IPTV cache (loaded during sync – no extra request)
  const { data: movies = [] } = useQuery({
    queryKey: ['streams', 'movie', 'all'],
    queryFn: () => xtreamService.getStreams('movie'),
    staleTime: Infinity,
    select: (data: any[]) =>
      data
        .filter((s) => s.stream_icon || s.cover)
        .slice(0, 30)
        .map((s) => toRowItem(s, 'movie')),
  });

  const { data: series = [] } = useQuery({
    queryKey: ['streams', 'series', 'all'],
    queryFn: () => xtreamService.getStreams('series'),
    staleTime: Infinity,
    select: (data: any[]) =>
      data
        .filter((s) => s.cover || s.stream_icon)
        .slice(0, 30)
        .map((s) => toRowItem(s, 'series')),
  });
  const { data: channels = [] } = useQuery({
    queryKey: ['streams', 'live', 'all'],
    queryFn: () => xtreamService.getStreams('live'),
    staleTime: Infinity,
    select: (data: any[]) =>
      data
        .filter((s) => s.stream_icon)
        .slice(0, 30)
        .map((s) => ({
          id: String(s.stream_id || s.num),
          title: s.name || 'Canal',
          poster: s.stream_icon,
          badge: 'AO VIVO',
          badgeColor: '#DC2626',
        })),
  });

  return (
    <div className="min-h-screen bg-[#08060a] text-white flex flex-col font-sans selection:bg-purple-500/30">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[70%] h-[50%] bg-purple-600/15 blur-[140px] rounded-full animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[70%] h-[50%] bg-violet-900/15 blur-[140px] rounded-full animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-pink-500/5 blur-[120px] rounded-full" />
      </div>

      <HomeNav onNavigate={onNavigate} onLogout={onLogout} />

      <main className="flex-1 px-4 md:px-10 py-6 max-w-[1600px] mx-auto w-full relative">
        <HeroCarousel 
          onAction={(item, type) => onNavigate(type, undefined, item)}
          movies={movies}
          series={series}
        />
        
        {/* Espaçamento extra para layout premium */}
        <div className="h-12" />

        {/* Recently watched channels - click goes directly to that channel */}
        <RecentChannelsRow
          onChannelClick={(ch) => onNavigate('live', undefined, ch)}
        />

        {movies.length > 0 && (
          <ContentRow
            title="Novos Filmes"
            icon={Film}
            items={movies}
            onItemClick={(item) => onNavigate('movie', undefined, item.raw || item)}
          />
        )}

        {series.length > 0 && (
          <ContentRow
            title="Séries em Destaque"
            icon={Clapperboard}
            items={series}
            onItemClick={(item) => onNavigate('series', undefined, item.raw || item)}
          />
        )}
      </main>

      <footer className="p-6 text-center border-t border-white/5 bg-black/40 mt-10">
        <p className="text-[10px] font-bold text-zinc-600 tracking-[0.3em] uppercase">
          Vibe WebPlayer &copy; 2026 &bull; Desenvolvido por SuperTech
        </p>
      </footer>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
