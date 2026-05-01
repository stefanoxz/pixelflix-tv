import { ArrowRight } from 'lucide-react';

interface MenuCardProps {
  item: {
    id: string;
    label: string;
    icon: any;
    color: string;
    count: string;
  };
  idx: number;
  onNavigate: (view: any) => void;
}

export const MenuCard = ({ item, idx, onNavigate }: MenuCardProps) => {
  return (
    <button
      onClick={() => onNavigate(item.id)}
      className="group relative aspect-[16/10] lg:aspect-[3/4] rounded-[56px] overflow-hidden transition-all duration-700 hover:scale-[1.03] hover:shadow-[0_40px_80px_rgba(0,0,0,0.5)] active:scale-95"
      style={{ animationDelay: `${idx * 150}ms` }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-90 transition-transform duration-700 group-hover:scale-110`} />
      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors duration-500" />
      
      <div className="absolute inset-0 p-12 flex flex-col justify-between items-start text-left z-10">
        <div className="p-5 rounded-[28px] bg-white/10 backdrop-blur-2xl border border-white/20 shadow-xl group-hover:rotate-12 transition-transform duration-500">
          <item.icon size={36} strokeWidth={2.5} />
        </div>
        
        <div className="space-y-4">
          <span className="text-[10px] font-black tracking-[0.5em] opacity-60 mb-2 block animate-pulse">{item.count} DISPONÍVEIS</span>
          <h4 className="text-4xl font-black leading-none tracking-tight">{item.label}</h4>
          <div className="flex items-center gap-3 text-[10px] font-black tracking-[0.3em] uppercase opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 duration-500">
            <span className="bg-white text-black px-4 py-2 rounded-full shadow-lg">Entrar agora</span>
            <div className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center">
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 blur-[80px] rounded-full group-hover:bg-white/20 transition-all duration-1000" />
    </button>
  );
};
