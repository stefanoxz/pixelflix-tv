import { useState } from 'react';
import { User, Lock, ArrowRight, Globe } from 'lucide-react';
import { xtreamService } from '../services/xtream';

interface LoginProps {
  onLogin: () => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [url, setUrl] = useState('http://161.97.105.5:3000'); // Default or remembered
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // For the demo, we'll just simulate a successful login if fields are filled
      // In a real app, we'd use xtreamService.authenticate()
      if (username && password) {
        xtreamService.setCredentials({ url, username, password });
        // Simulating network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        onLogin();
      } else {
        setError('Preencha todos os campos');
      }
    } catch (err) {
      setError('Falha na autenticação. Verifique os dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-purple-500/30 overflow-hidden">
      {/* Background Gradient Effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute -top-[10%] -right-[10%] w-[400px] h-[400px] bg-blue-900/5 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 w-full max-w-[440px]">
        <div className="bg-[#0A0A0A]/80 border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl backdrop-blur-2xl">
          <div className="flex flex-col items-center mb-10">
            <h1 className="text-5xl font-black tracking-[0.25em] text-white mb-3">BLACK</h1>
            <div className="h-1.5 w-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">SERVIDOR URL</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors group-focus-within:text-purple-500 text-zinc-600">
                  <Globe size={18} />
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-zinc-700"
                  placeholder="http://servidor.com:8080"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">USUÁRIO</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors group-focus-within:text-purple-500 text-zinc-600">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-zinc-700"
                  placeholder="Seu usuário"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">SENHA</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors group-focus-within:text-purple-500 text-zinc-600">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-zinc-700"
                  placeholder="Sua senha"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs font-medium text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 shadow-xl shadow-white/5 disabled:opacity-50 disabled:scale-100"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] font-bold text-zinc-600 tracking-[0.3em] uppercase opacity-50">VER. 1.0.1</p>
        </div>
      </main>
    </div>
  );
};
