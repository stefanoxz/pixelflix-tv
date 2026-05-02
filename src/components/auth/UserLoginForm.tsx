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
        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Usuário</label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-purple-500 transition-colors">
            <User size={18} />
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-500/30 transition-all font-medium text-sm"
            placeholder="Seu usuário"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Senha</label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-purple-500 transition-colors">
            <Lock size={18} />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-500/30 transition-all font-medium text-sm"
            placeholder="••••••••"
          />
        </div>
      </div>
    </div>
  );
};
