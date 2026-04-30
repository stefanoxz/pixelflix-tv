import { useState } from 'react';
import { User, Lock, ArrowRight } from 'lucide-react';

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login attempt:', { username, password });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-purple-500/30">
      {/* Background Gradient Effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-900/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 w-full max-w-[440px]">
        <div className="bg-[#0A0A0A] border border-white/5 rounded-[32px] p-8 md:p-12 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center mb-10">
            <h1 className="text-4xl font-bold tracking-[0.2em] text-white mb-2">BLACK</h1>
            <div className="h-1 w-8 bg-purple-600 rounded-full" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="w-full bg-[#111111] border border-white/5 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-zinc-700"
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
                  className="w-full bg-[#111111] border border-white/5 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-zinc-700"
                  placeholder="Sua senha"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
            >
              Entrar
              <ArrowRight size={18} />
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] font-medium text-zinc-600 tracking-[0.2em] uppercase">VER. 1.0.1</p>
        </div>
      </main>
    </div>
  );
}

export default App;
