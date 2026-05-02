import { useState } from 'react';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface AdminLoginFormProps {
  adminPassword: string;
  setAdminPassword: (value: string) => void;
}

export const AdminLoginForm = ({ adminPassword, setAdminPassword }: AdminLoginFormProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-1">Senha Master</label>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors">
          <ShieldCheck size={18} />
        </div>
        <input
          type={showPassword ? 'text' : 'password'}
          autoFocus
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          className="w-full bg-white/[0.05] border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-500/50 transition-all font-bold text-sm"
          placeholder="Senha administrativa"
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
  );
};
