import { User, RefreshCcw } from 'lucide-react';

interface UserInfoCardProps {
  profile: any;
  onNavigate: (view: any) => void;
}

export const UserInfoCard = ({ profile, onNavigate }: UserInfoCardProps) => {
  return (
    <div className="mt-12 bg-[#0A0A0A] border border-white/5 rounded-[32px] p-8 flex flex-col md:flex-row items-center justify-between gap-8">
      <div className="flex items-center gap-6">
        <button 
          onClick={() => onNavigate('profiles')}
          className="relative group w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shadow-lg"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.profile_name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <User size={32} className="text-zinc-500" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <RefreshCcw size={16} className="text-white" />
          </div>
        </button>
        <div>
          <p className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Perfil Ativo</p>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold">{profile?.profile_name || 'Usuário'}</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-bold border border-blue-500/20 uppercase tracking-tighter">Conectado</span>
          </div>
        </div>
      </div>

      <div className="flex gap-12 text-center md:text-left">
        <div>
          <p className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Expira em</p>
          <p className="font-bold">25 de Out, 2026</p>
        </div>
        <div>
          <p className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Conexões</p>
          <p className="font-bold">1 / 3</p>
        </div>
      </div>
    </div>
  );
};
