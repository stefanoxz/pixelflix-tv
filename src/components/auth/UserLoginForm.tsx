import { User, Lock } from 'lucide-react';

interface UserLoginFormProps {
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
}

export const UserLoginForm = ({ username, setUsername, password, setPassword }: UserLoginFormProps) => {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-[11px] font-black text-white uppercase tracking-[0.4em] ml-1">Usuário</label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 group-focus-within:text-purple-400 transition-colors">
            <User size={18} />
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white/[0.08] border border-white/20 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-600/40 focus:border-purple-500/60 transition-all font-black text-[15px]"
            placeholder="Digite seu usuário"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-black text-white uppercase tracking-[0.4em] ml-1">Senha</label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 group-focus-within:text-purple-400 transition-colors">
            <Lock size={18} />
          </div>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/[0.08] border border-white/20 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-600/40 focus:border-purple-500/60 transition-all font-black text-[15px]"
            placeholder="Sua senha"
          />
        </div>
      </div>
    </div>
  );
};
