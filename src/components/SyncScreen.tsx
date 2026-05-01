import { useState, useEffect } from 'react';
import { Database, CloudDownload, Film, Tv, PlayCircle, CheckCircle2 } from 'lucide-react';

interface SyncScreenProps {
  onComplete: () => void;
  profileName: string;
}

export const SyncScreen = ({ onComplete, profileName }: SyncScreenProps) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Iniciando conexão...');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const steps = [
      { p: 10, s: 'Verificando credenciais...' },
      { p: 30, s: 'Carregando canais ao vivo...' },
      { p: 50, s: 'Sincronizando catálogo de filmes...' },
      { p: 75, s: 'Mapeando séries e episódios...' },
      { p: 90, s: 'Otimizando player de vídeo...' },
      { p: 100, s: 'Tudo pronto!' },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].p);
        setStatus(steps[currentStep].s);
        currentStep++;
      } else {
        clearInterval(interval);
        setCompleted(true);
        setTimeout(onComplete, 1500);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full animate-pulse" />
      
      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
        <div className="mb-12 relative">
          <div className="w-24 h-24 rounded-3xl bg-zinc-900 flex items-center justify-center border border-white/10 shadow-2xl relative overflow-hidden">
             {progress < 100 ? (
               <CloudDownload size={40} className="text-blue-500 animate-bounce" />
             ) : (
               <CheckCircle2 size={40} className="text-green-500 animate-in zoom-in duration-500" />
             )}
          </div>
          <div className="absolute -top-4 -right-4 w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center font-bold text-sm shadow-xl animate-pulse">
            {progress}%
          </div>
        </div>

        <h1 className="text-3xl font-black mb-2 tracking-tight">Sincronizando Conteúdo</h1>
        <p className="text-zinc-500 mb-12">Olá <span className="text-white font-bold">{profileName}</span>, estamos preparando sua experiência premium.</p>

        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden mb-8 border border-white/5">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500 ease-out shadow-[0_0_20px_rgba(37,99,235,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-4 gap-4 w-full mb-12">
          {[
            { icon: Tv, p: 30 },
            { icon: Film, p: 50 },
            { icon: PlayCircle, p: 75 },
            { icon: Database, p: 90 },
          ].map((item, i) => (
            <div key={i} className={`flex flex-col items-center gap-2 transition-all duration-500 ${progress >= item.p ? 'text-blue-500 scale-110' : 'text-zinc-700'}`}>
              <item.icon size={20} />
              <div className={`w-1 h-1 rounded-full ${progress >= item.p ? 'bg-blue-500' : 'bg-zinc-800'}`} />
            </div>
          ))}
        </div>

        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse h-4">
          {status}
        </p>
      </div>

      <div className="absolute bottom-12 text-[10px] font-bold text-zinc-700 tracking-[0.3em] uppercase">
        SuperTech WebPlayer &bull; Versão Estável
      </div>
    </div>
  );
};
