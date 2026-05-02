import { useState } from 'react';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface AdminLoginFormProps {
  adminPassword: string;
  setAdminPassword: (value: string) => void;
}

export const AdminLoginForm = ({ adminPassword, setAdminPassword }: AdminLoginFormProps) => {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black text-white uppercase tracking-[0.4em] ml-1">Senha Master</label>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 group-focus-within:text-purple-400 transition-colors">
          <ShieldCheck size={18} />
        </div>
        <input
          type="text"
          autoFocus
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          className="w-full bg-white/[0.08] border border-white/20 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-600/40 focus:border-purple-500/60 transition-all font-black text-[15px]"
          placeholder="Senha administrativa"
        />
      </div>
    </div>
  );
};
