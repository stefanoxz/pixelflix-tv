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
          const userInfo = await xtreamService.authenticate();
      
          if (userInfo) {
            // Bridge Xtream Auth with Supabase Auth for RLS Security
            const supaEmail = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@pixelflix.local`;
            const supaPassword = `Px!${password}#tv`; // Secure derived password
            
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: supaEmail,
              password: supaPassword,
            });

            if (signInError) {
              // If user doesn't exist in Supabase, create it
              await supabase.auth.signUp({
                email: supaEmail,
                password: supaPassword,
              });
            }

            onLogin();
          } else {
             setError('Usuário ou senha incorretos');
          }
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
    <div className="min-h-screen bg-[#050308] text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-purple-500/30 overflow-hidden relative">
      {/* Cinematic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-purple-600/10 blur-[160px] rounded-full animate-pulse opacity-40" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-600/10 blur-[160px] rounded-full animate-pulse opacity-30" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-transparent via-purple-900/5 to-transparent opacity-50" />
      </div>

      <main className="relative z-10 w-full max-w-[420px] animate-in fade-in zoom-in duration-1000">
        <div className="bg-[#08060D]/60 border border-white/5 rounded-[48px] p-8 md:p-12 shadow-[0_0_120px_rgba(0,0,0,0.8)] backdrop-blur-[40px] ring-1 ring-white/5 relative overflow-hidden">
          {/* Subtle reflection effect */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          
          <div className="flex flex-col items-center mb-10 relative z-10">
            <div className="mb-8 flex flex-col items-center">
              <div className="relative group">
                <div className="absolute inset-0 bg-purple-600/20 blur-[40px] rounded-full opacity-40 group-hover:opacity-80 transition-opacity duration-1000" />
                <img 
                  src={vibeLogo} 
                  alt="Vibe Logo" 
                  className="relative w-56 h-auto object-contain drop-shadow-[0_0_40px_rgba(168,85,247,0.3)] transition-transform duration-700 group-hover:scale-105"
                />
              </div>





            </div>
            <p className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.4em] opacity-80 mb-2">
              {isAdminMode ? 'Acesso ao Sistema' : 'Seu Cinema Particular'}
            </p>
            <div className="h-[2px] w-12 bg-purple-600/30 rounded-full" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
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
              <div className="animate-in shake duration-500">
                <p className="text-red-400 text-[10px] font-bold text-center bg-red-500/5 py-4 rounded-2xl border border-red-500/10 uppercase tracking-widest leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-3xl p-[1px] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 mt-2"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-white text-black font-black py-4 rounded-[23px] flex items-center justify-center gap-3 transition-colors group-hover:bg-transparent group-hover:text-white uppercase text-[11px] tracking-[0.3em]">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isAdminMode ? 'Sincronizar' : 'Iniciar Sessão'}</span>
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </div>
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-white/5 flex justify-center relative z-10">
            <button 
              onClick={() => {
                setIsAdminMode(!isAdminMode);
                setError('');
              }}
              className="text-[10px] font-black text-zinc-600 hover:text-purple-400 transition-all uppercase tracking-[0.4em] hover:tracking-[0.5em]"
            >
              {isAdminMode ? 'Voltar ao Player' : 'Gerenciamento Administrativo'}
            </button>
          </div>
        </div>

        <div className="mt-12 text-center relative z-10">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/5 backdrop-blur-md">

            <p className="text-[9px] font-black text-zinc-800 tracking-[0.5em] uppercase">V. 1.0.1</p>
          </div>
        </div>
      </main>
    </div>
  );
};
