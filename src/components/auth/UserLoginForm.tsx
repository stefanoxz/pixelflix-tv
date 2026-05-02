import { useState } from 'react';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

interface UserLoginFormProps {
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
}

export const UserLoginForm = ({ username, setUsername, password, setPassword }: UserLoginFormProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-1">Usuário</label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors">
            <User size={18} />
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-500/50 transition-all font-bold text-sm"
            placeholder="Seu usuário"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-1">Senha</label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors">
            <Lock size={18} />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-500/50 transition-all font-bold text-sm"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};
