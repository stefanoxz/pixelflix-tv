import { useState, useEffect } from 'react';
import { CloudDownload, CheckCircle2, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { xtreamService } from '../../services/xtream';
import { SyncProgressBar } from './SyncProgressBar';

interface SyncScreenProps {
  onComplete: () => void;
  profileName: string;
  avatarUrl: string;
}

export const SyncScreen = ({ onComplete, profileName, avatarUrl }: SyncScreenProps) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Iniciando conexão...');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const syncData = async () => {
      try {
        const creds = xtreamService.getCredentials();
        
        setStatus('Verificando credenciais...');
        setProgress(15);
        try {
          await xtreamService.authenticate();
        } catch (authErr: any) {
          setDebugInfo(`Erro no servidor IPTV (${creds?.url}): ${authErr.message}`);
          throw authErr;
        }
        
        setStatus('Sincronizando canais ao vivo...');
        setProgress(35);
        await queryClient.fetchQuery({
          queryKey: ['categories', 'live'],
          queryFn: () => xtreamService.getCategories('live'),
        });

        setStatus('Sincronizando catálogo de filmes...');
        setProgress(55);
        await queryClient.fetchQuery({
          queryKey: ['categories', 'movie'],
          queryFn: () => xtreamService.getCategories('movie'),
        });

        setStatus('Mapeando séries e episódios...');
        setProgress(75);
        await queryClient.fetchQuery({
          queryKey: ['categories', 'series'],
          queryFn: () => xtreamService.getCategories('series'),
        });

        setStatus('Otimizando player de vídeo...');
        setProgress(90);
        await new Promise(r => setTimeout(r, 500));

        setProgress(100);
        setStatus('Tudo pronto!');
        setTimeout(onComplete, 1000);
      } catch (err: any) {
        setError(err.message || 'Erro ao sincronizar dados.');
      }
    };

    syncData();
  }, [onComplete, queryClient]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full animate-pulse" />
      
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
        <p className="text-zinc-500 mb-6 text-sm">
          {error ? 'Ocorreu um problema ao tentar carregar seus dados.' : <>Olá <span className="text-white font-bold">{profileName}</span>, estamos preparando sua experiência premium.</>}
        </p>

        {debugInfo && (
          <div className="mb-8 p-3 bg-white/5 border border-white/10 rounded-xl text-[10px] text-zinc-400 font-mono text-left w-full break-all">
            <span className="text-purple-400 font-bold block mb-1 uppercase tracking-widest text-[9px]">Detalhes Técnicos:</span>
            {debugInfo}
          </div>
        )}

        {!error ? (
          <>
            <SyncProgressBar progress={progress} />
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
        Vibe WebPlayer &bull; Versão Estável
      </div>
    </div>
  );
};
