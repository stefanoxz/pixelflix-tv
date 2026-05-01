import { useState, useEffect } from 'react';
import { User, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { xtreamService } from '../services/xtream';
import { getSettings } from '../services/supabase';

interface LoginProps {
  onLogin: () => void;
  onAdminLogin: () => void;
}

export const Login = ({ onLogin, onAdminLogin }: LoginProps) => {
  const [dnsUrl, setDnsUrl] = useState('http://bkpac.cc');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [storedAdminPassword, setStoredAdminPassword] = useState('1234');

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      if (settings) {
        setDnsUrl(settings.dns_url);
        setStoredAdminPassword(settings.admin_password);
      }
    };
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isAdminMode) {
        if (adminPassword === storedAdminPassword) {
          onAdminLogin();
        } else {
          setError('Senha administrativa incorreta');
        }
      } else {
        if (username && password) {
          xtreamService.setCredentials({ url: dnsUrl, username, password });
          
          try {
            await xtreamService.authenticate();
            onLogin();
          } catch (authErr) {
            console.error('Auth error:', authErr);
            setError(authErr instanceof Error ? authErr.message : 'Falha na conexão com o servidor IPTV');
          }
        } else {
          setError('Preencha todos os campos');
        }
      }
    } catch (err) {
      setError('Falha na autenticação. Verifique os dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-purple-500/30 overflow-hidden relative">
      {/* Background Gradient & Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      <main className="relative z-10 w-full max-w-[440px]">
        <div className="bg-[#0A0A0A]/40 border border-white/10 rounded-[48px] p-8 md:p-14 shadow-[0_0_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl ring-1 ring-white/5">
          <div className="flex flex-col items-center mb-12">
            <div className="mb-6 flex items-center gap-3">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-white/20">
                <PlayCircle className="text-black" size={32} fill="currentColor" />
              </div>
              <h1 className="text-5xl font-black tracking-[0.1em] text-white leading-none select-none uppercase">Vibe</h1>
            </div>
            <div className="h-1.5 w-16 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full" />
            <p className="mt-6 text-[11px] font-black text-zinc-400 uppercase tracking-[0.5em] opacity-80">
              {isAdminMode ? 'SISTEMA ADMINISTRATIVO' : 'CINEMA PARTICULAR'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isAdminMode ? (
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
            ) : (
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
            )}

            {error && (
              <p className="text-red-500 text-[10px] font-black text-center bg-red-500/10 py-3 rounded-xl border border-red-500/10 uppercase tracking-wider">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 shadow-2xl shadow-white/5 disabled:opacity-50 disabled:scale-100 uppercase text-xs tracking-[0.2em]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  {isAdminMode ? 'Acessar Painel' : 'Entrar'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-white/5 flex justify-center">
            <button 
              onClick={() => {
                setIsAdminMode(!isAdminMode);
                setError('');
              }}
              className="text-[10px] font-black text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-[0.3em]"
            >
              {isAdminMode ? 'Voltar para o Player' : 'Acesso Restrito'}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] font-black text-zinc-700 tracking-[0.5em] uppercase">V. 1.0.1</p>
        </div>
      </main>
    </div>
  );
};
