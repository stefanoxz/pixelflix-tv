import { useState, useEffect } from 'react';
import { Database, CloudDownload, Film, Tv, PlayCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { xtreamService } from '../services/xtream';

interface SyncScreenProps {
  onComplete: () => void;
  profileName: string;
}

export const SyncScreen = ({ onComplete, profileName }: SyncScreenProps) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Iniciando conexão...');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const syncData = async () => {
      try {
        // Step 1: Auth check
        setStatus('Verificando credenciais...');
        setProgress(15);
        await xtreamService.authenticate();
        
        // Step 2: Live Categories
        setStatus('Sincronizando canais ao vivo...');
        setProgress(35);
        await queryClient.prefetchQuery({
          queryKey: ['categories', 'live'],
          queryFn: () => xtreamService.getCategories('live'),
        });

        // Step 3: Movie Categories
        setStatus('Sincronizando catálogo de filmes...');
        setProgress(55);
        await queryClient.prefetchQuery({
          queryKey: ['categories', 'movie'],
          queryFn: () => xtreamService.getCategories('movie'),
        });

        // Step 4: Series Categories
        setStatus('Mapeando séries e episódios...');
        setProgress(75);
        await queryClient.prefetchQuery({
          queryKey: ['categories', 'series'],
          queryFn: () => xtreamService.getCategories('series'),
        });

        // Step 5: Optimization
        setStatus('Otimizando player de vídeo...');
        setProgress(90);
        await new Promise(r => setTimeout(r, 500));

        setProgress(100);
        setStatus('Tudo pronto!');
        setTimeout(onComplete, 1000);
      } catch (err: any) {
        console.error('Sync failed:', err);
        setError(err.message || 'Erro ao sincronizar dados. Verifique sua conexão.');
      }
    };

    syncData();
  }, [onComplete, queryClient]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full animate-pulse" />
      
      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
        <div className="mb-12 relative">
          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl relative overflow-hidden transition-colors ${error ? 'bg-red-500/20' : 'bg-zinc-900'}`}>
             {error ? (
               <AlertCircle size={40} className="text-red-500 animate-pulse" />
             ) : progress < 100 ? (
               <CloudDownload size={40} className="text-blue-500 animate-bounce" />
             ) : (
               <CheckCircle2 size={40} className="text-green-500 animate-in zoom-in duration-500" />
             )}
          </div>
          {!error && (
            <div className="absolute -top-4 -right-4 w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center font-bold text-sm shadow-xl animate-pulse">
              {progress}%
            </div>
          )}
        </div>

        <h1 className="text-3xl font-black mb-2 tracking-tight">
          {error ? 'Falha na Sincronização' : 'Sincronizando Conteúdo'}
        </h1>
        <p className="text-zinc-500 mb-12">
          {error ? 'Ocorreu um problema ao tentar carregar seus dados.' : <>Olá <span className="text-white font-bold">{profileName}</span>, estamos preparando sua experiência premium.</>}
        </p>

        {!error ? (
          <>
            <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden mb-8 border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500 ease-out shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-4 w-full mb-12">
              {[
                { icon: Tv, p: 35 },
                { icon: Film, p: 55 },
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
          </>
        ) : (
          <div className="space-y-6 w-full">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium">
              {error}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-white text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl"
            >
              Tentar Novamente
            </button>
          </div>
        )}
      </div>

      <div className="absolute bottom-12 text-[10px] font-bold text-zinc-700 tracking-[0.3em] uppercase">
        SuperTech WebPlayer &bull; Versão Estável
      </div>
    </div>
  );
};
