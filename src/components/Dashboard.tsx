import { memo, useMemo } from 'react';
import { Tv, Film, PlayCircle } from 'lucide-react';
import { MainHeader } from './layout/MainHeader';
import { MenuCard } from './layout/MenuCard';
import { UserInfoCard } from './layout/UserInfoCard';

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

export const Dashboard = memo(({ onLogout, onNavigate, profile }: DashboardProps) => {
  const menuItems = useMemo(() => [
    { id: 'live', label: 'CANAIS AO VIVO', icon: Tv, color: 'from-blue-600 to-cyan-500', count: '2.500+' },
    { id: 'movie', label: 'FILMES', icon: Film, color: 'from-purple-600 to-pink-500', count: '10.000+' },
    { id: 'series', label: 'SÉRIES', icon: PlayCircle, color: 'from-orange-600 to-red-500', count: '3.000+' },
  ], []);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans selection:bg-white/10">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[60%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[60%] h-[40%] bg-purple-600/5 blur-[120px] rounded-full" />
      </div>

      <MainHeader onNavigate={onNavigate} onLogout={onLogout} />

      <main className="flex-1 p-6 md:p-12 max-w-[1600px] mx-auto w-full relative">
        <div className="mb-16">
          <p className="text-zinc-600 text-[11px] font-black tracking-[0.5em] uppercase mb-4 animate-in fade-in slide-in-from-left duration-700">Explorar catálogo</p>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none animate-in fade-in slide-in-from-bottom duration-1000">Sua jornada premium começa aqui.</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {menuItems.map((item, idx) => (
            <MenuCard 
              key={item.id} 
              item={item} 
              idx={idx} 
              onNavigate={onNavigate} 
            />
          ))}
        </div>

        <UserInfoCard profile={profile} onNavigate={onNavigate} />
      </main>

      <footer className="p-8 text-center border-t border-white/5 bg-black/40">
        <p className="text-[10px] font-bold text-zinc-600 tracking-[0.3em] uppercase">Vibe WebPlayer &copy; 2026 &bull; Desenvolvido por SuperTech</p>
      </footer>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
