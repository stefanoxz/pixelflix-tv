import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { xtreamService } from '../services/xtream';
import { supabase, getSettings } from '../services/supabase';
import vibeLogo from '@/assets/vibe-logo.png';
import { UserLoginForm } from './auth/UserLoginForm';
import { AdminLoginForm } from './auth/AdminLoginForm';

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
    // Initial load
    const loadSettings = async () => {
      const settings = await getSettings();
      if (settings) {
        setDnsUrl(settings.dns_url);
        setStoredAdminPassword(settings.admin_password);
      }
    };
    loadSettings();

    // Subscribe to realtime updates for DNS
    const channel = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'settings'
        },
        (payload) => {
          if (payload.new) {
            console.log('DNS updated in realtime:', payload.new.dns_url);
            setDnsUrl(payload.new.dns_url);
            setStoredAdminPassword(payload.new.admin_password);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isAdminMode) {
        if (!adminPassword) {
          setError('Informe a senha administrativa');
          setLoading(false);
          return;
        }
        if (adminPassword === storedAdminPassword) {
          onAdminLogin();
        } else {
          setError('Senha administrativa incorreta');
        }
      } else {
        if (!username || !password) {
          setError('Preencha usuário e senha');
          setLoading(false);
          return;
        }

        try {
          xtreamService.setCredentials({ url: dnsUrl, username, password });
          await xtreamService.authenticate();
          onLogin();
        } catch (authErr: any) {
          console.error('Login auth error:', authErr);
          // Friendly error mapping
          const msg = authErr.code === 'AUTH_FAILED' 
            ? 'Usuário ou senha incorretos' 
            : authErr.message || 'Erro ao conectar ao servidor';
          setError(msg);
        }
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-purple-500/30 overflow-hidden relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      <main className="relative z-10 w-full max-w-[440px]">
        <div className="bg-[#0A0A0A]/40 border border-white/10 rounded-[48px] p-8 md:p-14 shadow-[0_0_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl ring-1 ring-white/5">
          <div className="flex flex-col items-center mb-12">
            <div className="mb-6 flex flex-col items-center">
              <div className="relative group">
                <div className="absolute inset-0 bg-purple-600/30 blur-3xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-700" />
                <img 
                  src={vibeLogo} 
                  alt="Vibe Logo" 
                  className="relative w-56 h-auto object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.4)]"
                />
              </div>
              <p className="mt-2 text-[10px] font-black tracking-[0.5em] text-purple-400/80 uppercase">Premium WebPlayer</p>
            </div>
            <div className="h-1.5 w-16 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full" />
            <p className="mt-6 text-[11px] font-black text-zinc-400 uppercase tracking-[0.5em] opacity-80">
              {isAdminMode ? 'SISTEMA ADMINISTRATIVO' : 'CINEMA PARTICULAR'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isAdminMode ? (
              <UserLoginForm 
                username={username}
                setUsername={setUsername}
                password={password}
                setPassword={setPassword}
              />
            ) : (
              <AdminLoginForm 
                adminPassword={adminPassword}
                setAdminPassword={setAdminPassword}
              />
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
