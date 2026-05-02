import { useState, useEffect, useMemo } from 'react';
import { Clock, Tv, Loader2 } from 'lucide-react';
import { PremiumPlayer } from '../PremiumPlayer';
import { ErrorBoundary } from '../layout/ErrorBoundary';
import { xtreamService } from '../../services/xtream';
import { settingsService } from '../../services/settingsService';

interface LivePlayerPanelProps {
  channel: any | null;
  epg: any[] | null;
}

export const LivePlayerPanel = ({ channel, epg }: LivePlayerPanelProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playerError, setPlayerError] = useState<any>(null);
  const [currentFormat, setCurrentFormat] = useState<'m3u8' | 'ts'>(settingsService.getSettings().playerType);

  useEffect(() => {
    if (channel) {
      setIsLoading(true);
      setIsPlaying(false);
      setPlayerError(null);
      setCurrentFormat(settingsService.getSettings().playerType);
      const timer = setTimeout(() => {
        setIsLoading(false);
        setIsPlaying(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [channel?.id]);

  const toggleFormat = () => {
    const newFormat = currentFormat === 'm3u8' ? 'ts' : 'm3u8';
    setCurrentFormat(newFormat);
    setPlayerError(null);
    setIsLoading(true);
    setIsPlaying(false);
    setTimeout(() => {
      setIsLoading(false);
      setIsPlaying(true);
    }, 1000);
  };

  const currentProgram = useMemo(() => {
    if (!epg || epg.length === 0) return null;
    const now = Math.floor(Date.now() / 1000);
    // Find the program that is currently running
    return epg.find(prog => {
      const start = prog.start_timestamp ? parseInt(prog.start_timestamp) : (prog.start ? new Date(prog.start).getTime() / 1000 : 0);
      const end = prog.stop_timestamp ? parseInt(prog.stop_timestamp) : (prog.end ? new Date(prog.end).getTime() / 1000 : 0);
      return now >= start && now < end;
    }) || epg[0];
  }, [epg]);

  const futurePrograms = useMemo(() => {
    if (!epg) return [];
    const now = Math.floor(Date.now() / 1000);
    return epg.filter(prog => {
      const start = prog.start_timestamp ? parseInt(prog.start_timestamp) : (prog.start ? new Date(prog.start).getTime() / 1000 : 0);
      return start > now;
    }).sort((a, b) => {
      const startA = a.start_timestamp ? parseInt(a.start_timestamp) : (a.start ? new Date(a.start).getTime() / 1000 : 0);
      const startB = b.start_timestamp ? parseInt(b.start_timestamp) : (b.start ? new Date(b.start).getTime() / 1000 : 0);
      return startA - startB;
    });
  }, [epg]);

  const videoOptions = useMemo(() => {
    if (!channel || !isPlaying) return null;
    const streamUrl = xtreamService.getStreamUrl(channel.id, currentFormat, 'live');
    const mimeType = currentFormat === 'ts' ? 'video/mp2t' : 'application/x-mpegURL';
    
    return {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: true,
      sources: [{
        src: streamUrl,
        type: mimeType
      }]
    };
  }, [channel?.id, isPlaying, currentFormat]);

  const progressPercentage = useMemo(() => {
    if (!currentProgram) return 0;
    const start = currentProgram.start_timestamp ? parseInt(currentProgram.start_timestamp) : (currentProgram.start ? new Date(currentProgram.start).getTime() / 1000 : null);
    const end = currentProgram.stop_timestamp ? parseInt(currentProgram.stop_timestamp) : (currentProgram.end ? new Date(currentProgram.end).getTime() / 1000 : null);
    if (!start || !end) return 0;
    const now = Math.floor(Date.now() / 1000);
    const total = end - start;
    const current = now - start;
    if (total <= 0) return 0;
    const percentage = Math.round((current / total) * 100);
    return Math.min(Math.max(percentage, 0), 100);
  }, [currentProgram]);

  const formatTime = (time: any) => {
    if (!time) return '00:00';
    
    // Handle Unix Timestamp (seconds)
    if (typeof time === 'number' || (!isNaN(Number(time)) && String(time).length >= 10)) {
      const date = new Date(Number(time) * 1000);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    // Handle String like "2024-05-01 22:00:00"
    if (typeof time === 'string') {
      const match = time.match(/\d{2}:\d{2}/);
      if (match) return match[0];
      
      const date = new Date(time);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    }
    
    return String(time);
  };

  const decodeBase64 = (str: string) => {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch {
      try {
        return atob(str);
      } catch {
        return str;
      }
    }
  };

  if (!channel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-black">
        <Tv size={64} className="text-white/10 mb-4" />
        <p className="text-zinc-600 font-black tracking-[0.3em] text-xs uppercase">Selecione um canal</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 bg-black overflow-y-auto custom-scrollbar">
      {/* Video Container */}
      <div className="flex-1 min-h-[400px] rounded-3xl overflow-hidden bg-[#0A0A0A] border border-white/5 relative shadow-2xl flex items-center justify-center group">
        {channel.icon && (
          <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
            <img src={channel.icon} alt="bg" className="w-[80%] h-[80%] object-contain blur-[100px]" />
          </div>
        )}

        {isLoading ? (
          <div className="relative z-10 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-white animate-spin opacity-80" />
            <span className="text-[10px] font-black tracking-[0.3em] text-white uppercase drop-shadow-md">Conectando...</span>
          </div>
        ) : playerError ? (
          <div className="relative z-10 flex flex-col items-center gap-6 p-10 text-center max-w-md">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 mb-2">
              <Play size={32} className="text-red-500 opacity-50" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Erro de Reprodução</h3>
              <p className="text-sm text-zinc-500 leading-relaxed mb-6">
                Não foi possível carregar este canal no formato <span className="text-purple-400 font-bold uppercase">{currentFormat}</span>. Tente alternar o formato abaixo.
              </p>
              <button 
                onClick={toggleFormat}
                className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 active:scale-95"
              >
                Alternar para {currentFormat === 'm3u8' ? 'MPEGTS (TS)' : 'HLS (M3U8)'}
              </button>
            </div>
          </div>
        ) : isPlaying && videoOptions ? (
          <div className="w-full h-full relative z-10 bg-black">
            <ErrorBoundary isLocal>
              <PremiumPlayer 
                options={videoOptions} 
                title={channel.name} 
                subtitle="Canais ao Vivo"
                isFullscreen={false}
                onClose={() => {}} 
                onError={(err) => setPlayerError(err)}
              />
            </ErrorBoundary>
          </div>
        ) : null}
      </div>

      {/* Unified Cinematic EPG Panel */}
      <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-8 relative overflow-hidden shadow-2xl shrink-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row gap-10 relative z-10">
          {/* Current Program - Left Side */}
          <div className="lg:w-2/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-600/10 rounded-2xl flex items-center justify-center border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                  <Tv size={24} className="text-purple-500" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-white tracking-tight leading-tight line-clamp-1">
                      {currentProgram?.title ? String(decodeBase64(currentProgram.title)) : 'Programa Atual'}
                    </h3>
                    <div className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-1.5 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">LIVE</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      {currentProgram?.start ? formatTime(currentProgram.start) : '00:00'} — {currentProgram?.end ? formatTime(currentProgram.end) : '00:00'}
                    </span>
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{progressPercentage}%</span>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-6 opacity-80">
                {currentProgram?.description 
                  ? String(decodeBase64(currentProgram.description))
                  : 'Acompanhe a programação completa em tempo real com a melhor qualidade de imagem e som.'}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-0.5">
                 <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Progresso</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all duration-1000" 
                  style={{ width: `${progressPercentage}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent self-stretch" />

          {/* Future Timeline - Right Side */}
          <div className="lg:w-3/5">
            <div className="flex items-center justify-between mb-5 px-1">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-zinc-500" />
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">A Seguir na Programação</span>
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-horizontal -mx-1 px-1">
              {futurePrograms.length > 0 ? futurePrograms.map((prog, idx) => (
                <div 
                  key={idx} 
                  className="min-w-[240px] p-5 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all group cursor-default"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-black text-purple-500 tracking-widest uppercase">
                      {prog.start ? formatTime(prog.start) : '00:00'}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover:bg-purple-500/50 transition-colors" />
                  </div>
                  <h5 className="text-[13px] font-bold text-white mb-1.5 line-clamp-1 group-hover:text-purple-300 transition-colors">
                    {prog.title ? String(decodeBase64(prog.title)) : 'Sem Título'}
                  </h5>
                  <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
                    {prog.description ? String(decodeBase64(prog.description)) : 'Nenhuma descrição disponível.'}
                  </p>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center w-full py-6 text-center opacity-30">
                  <Clock size={24} className="text-zinc-700 mb-2" />
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Sem guia disponível</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
