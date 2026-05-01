import { memo, useMemo } from 'react';
import { Clapperboard, Film, Tv } from 'lucide-react';
import { HomeNav } from './home/HomeNav';
import { HeroCarousel } from './home/HeroCarousel';
import { StreamingRow } from './home/StreamingRow';
import { ContentRow, RowItem } from './home/ContentRow';

interface Profile {
  id: string;
  profile_name: string;
  avatar_url: string;
}

interface DashboardProps {
  onLogout: () => void;
  onNavigate: (view: any) => void;
  profile: Profile | null;
}

const POSTERS = [
  'https://image.tmdb.org/t/p/w300/aosm8NMQ3UyoBVpSxyimorCQykC.jpg',
  'https://image.tmdb.org/t/p/w300/9PFonBhy4cQy7Jz20NpMygczOkv.jpg',
  'https://image.tmdb.org/t/p/w300/8Y43POKjjKDGI9MH89NW0NAzzp8.jpg',
  'https://image.tmdb.org/t/p/w300/xDMIl84Qo5Tsu62c9DGWhmPI67A.jpg',
  'https://image.tmdb.org/t/p/w300/qhb1qOilapbapxWQn9jtRCMwXJF.jpg',
  'https://image.tmdb.org/t/p/w300/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg',
  'https://image.tmdb.org/t/p/w300/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg',
  'https://image.tmdb.org/t/p/w300/k68nPLbIST6NP96JmTxmZijEvCA.jpg',
];

const buildItems = (prefix: string): RowItem[] =>
  POSTERS.map((p, i) => ({
    id: `${prefix}-${i}`,
    title: `${prefix} ${i + 1}`,
    poster: p,
    badge: i % 3 === 0 ? 'LEGENDADO' : i % 3 === 1 ? 'CINEMA' : undefined,
    badgeColor: i % 3 === 0 ? '#7C3AED' : '#9333EA',
  }));

export const Dashboard = memo(({ onLogout, onNavigate }: DashboardProps) => {
  const seriesUpdated = useMemo(() => buildItems('Série'), []);
  const newMovies = useMemo(() => buildItems('Filme'), []);
  const newSeries = useMemo(() => buildItems('Nova'), []);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans selection:bg-purple-500/30">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[60%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[60%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full" />
      </div>

      <HomeNav onNavigate={onNavigate} onLogout={onLogout} />

      <main className="flex-1 px-4 md:px-10 py-6 max-w-[1600px] mx-auto w-full relative">
        <HeroCarousel />
        <StreamingRow />
        <ContentRow title="Últimas Séries Atualizadas" icon={Clapperboard} items={seriesUpdated} />
        <ContentRow title="Novos Filmes" icon={Film} items={newMovies} />
        <ContentRow title="Novas Séries" icon={Tv} items={newSeries} />
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
