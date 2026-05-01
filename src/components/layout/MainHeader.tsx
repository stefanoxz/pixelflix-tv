import { Search, LogOut } from 'lucide-react';
import vibeLogo from '@/assets/vibe-logo.png';

interface MainHeaderProps {
  onNavigate: (view: any) => void;
  onLogout: () => void;
}

export const MainHeader = ({ onNavigate, onLogout }: MainHeaderProps) => {
  return (
    <header className="px-6 md:px-12 py-8 flex items-center justify-between border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-50">
      <div className="flex items-center gap-12">
        <div className="group cursor-pointer flex items-center" onClick={() => onNavigate('dashboard')}>
          <img 
            src={vibeLogo} 
            alt="Vibe" 
            className="h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.4)] group-hover:drop-shadow-[0_0_25px_rgba(168,85,247,0.6)] transition-all"
          />
        </div>
        <nav className="hidden lg:flex items-center gap-10">
          <button className="text-zinc-500 hover:text-white transition-all text-[11px] font-black tracking-[0.3em] uppercase relative after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-0 hover:after:w-full after:h-0.5 after:bg-white after:transition-all">Início</button>
          <button className="text-zinc-500 hover:text-white transition-all text-[11px] font-black tracking-[0.3em] uppercase relative after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-0 hover:after:w-full after:h-0.5 after:bg-white after:transition-all">Minha Lista</button>
          <button className="text-zinc-500 hover:text-white transition-all text-[11px] font-black tracking-[0.3em] uppercase relative after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-0 hover:after:w-full after:h-0.5 after:bg-white after:transition-all">Novidades</button>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center bg-white/5 border border-white/5 rounded-2xl px-4 py-2 group focus-within:border-white/20 transition-all">
          <Search size={18} className="text-zinc-500 group-focus-within:text-white" />
          <input type="text" placeholder="Buscar título..." className="bg-transparent border-none outline-none px-3 text-sm font-medium w-48 placeholder:text-zinc-700" />
        </div>
        <div className="h-8 w-[1px] bg-white/10 hidden md:block" />
        <button 
          onClick={onLogout}
          className="group flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-red-900/20 active:scale-95"
        >
          Sair do Sistema
          <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </header>
  );
};
