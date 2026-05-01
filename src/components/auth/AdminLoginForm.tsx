import { ShieldCheck } from 'lucide-react';

interface AdminLoginFormProps {
  adminPassword: string;
  setAdminPassword: (value: string) => void;
}

export const AdminLoginForm = ({ adminPassword, setAdminPassword }: AdminLoginFormProps) => {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Senha de Admin</label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors group-focus-within:text-white text-zinc-600">
          <ShieldCheck size={18} />
        </div>
        <input
          type="password"
          autoFocus
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/5 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:bg-white/10 transition-all placeholder:text-zinc-700 font-bold"
          placeholder="Sua senha master"
        />
      </div>
    </div>
  );
};
