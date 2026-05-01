import { User, Lock } from 'lucide-react';

interface UserLoginFormProps {
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
}

export const UserLoginForm = ({ username, setUsername, password, setPassword }: UserLoginFormProps) => {
  return (
    <>
      <div className="space-y-2">
        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Usuário</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors group-focus-within:text-white text-zinc-600">
            <User size={18} />
          </div>
          <input
            type="text"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white/5 border border-white/5 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:bg-white/10 transition-all placeholder:text-zinc-700 font-bold"
            placeholder="958457249"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Senha</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors group-focus-within:text-white text-zinc-600">
            <Lock size={18} />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/5 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:bg-white/10 transition-all placeholder:text-zinc-700 font-bold"
            placeholder="••••••••"
          />
        </div>
      </div>
    </>
  );
};
