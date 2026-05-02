import { useState, useEffect, useMemo } from 'react';
import { Clock, Tv, Loader2 } from 'lucide-react';
import { PremiumPlayer } from '../PremiumPlayer';
import { ErrorBoundary } from '../layout/ErrorBoundary';
import { xtreamService } from '../../services/xtream';

interface LivePlayerPanelProps {
  channel: any | null;
  epg: any | null;
}

export const LivePlayerPanel = ({ channel, epg }: LivePlayerPanelProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (channel) {
      setIsLoading(true);
      setIsPlaying(false);
      // Simulate connection time to show the beautiful "CONECTANDO..." overlay
      const timer = setTimeout(() => {
        setIsLoading(false);
        setIsPlaying(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [channel?.id]);

  const videoOptions = useMemo(() => {
    if (!channel || !isPlaying) return null;
    const streamUrl = xtreamService.getStreamUrl(channel.id, 'm3u8', 'live');
    
    return {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: true,
      sources: [{
        src: streamUrl,
        type: 'application/x-mpegURL'
      }]
    };
  }, [channel?.id, isPlaying]);

  // Calculate EPG progress
  const progressPercentage = useMemo(() => {
    if (!epg) return 0;
    
    // Attempt to get timestamps (Xtream usually provides start_timestamp or raw strings)
    const start = epg.start_timestamp ? parseInt(epg.start_timestamp) : (epg.start ? new Date(epg.start).getTime() / 1000 : null);
    const end = epg.stop_timestamp ? parseInt(epg.stop_timestamp) : (epg.end ? new Date(epg.end).getTime() / 1000 : null);
    
    if (!start || !end) return 0;

    const now = Math.floor(Date.now() / 1000);
    const total = end - start;
    const current = now - start;
    
    if (total <= 0) return 0;
    
    const percentage = Math.round((current / total) * 100);
    return Math.min(Math.max(percentage, 0), 100);
  }, [epg]);

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const match = timeStr.match(/\d{2}:\d{2}/);
    return match ? match[0] : timeStr;
  };

  if (!channel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-black">
        <Tv size={64} className="text-white/10 mb-4" />
        <p className="text-zinc-600 font-black tracking-[0.3em] text-xs uppercase">Selecione um canal</p>
      </div>
    );
  }

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

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 bg-black overflow-y-auto custom-scrollbar">
      {/* Video Container */}
      <div className="flex-1 min-h-[400px] rounded-3xl overflow-hidden bg-[#0A0A0A] border border-white/5 relative shadow-2xl flex items-center justify-center group">
        
        {/* Blurred Background Logo */}
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
        ) : isPlaying && videoOptions ? (
          <div className="w-full h-full relative z-10 bg-black">
            <ErrorBoundary isLocal>
              <PremiumPlayer 
                options={videoOptions} 
                title={channel.name} 
                subtitle="Canais ao Vivo"
                isFullscreen={false}
                onClose={() => {}} 
              />
            </ErrorBoundary>
          </div>
        ) : null}
      </div>

      {/* EPG Panel */}
      <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-10 relative overflow-hidden shrink-0 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-white/10 to-white/[0.02] rounded-[24px] border border-white/10 flex items-center justify-center shadow-2xl">
              <Tv size={28} className="text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-4 mb-3">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  {epg?.title ? String(decodeBase64(epg.title)).replace(/[^a-zA-Z0-9 \-]/g, '') : 'Programa Atual'}
                </h3>
                <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]" />
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">AO VIVO</span>
                </div>
              </div>
              
              <div className="flex items-center gap-8 text-xs font-bold tracking-widest uppercase">
                <div className="flex items-center gap-2.5 text-zinc-400">
                  <Clock size={16} className="text-purple-500" />
                  <span className="text-zinc-300">{epg?.start ? formatTime(epg.start) : '00:00'} — {epg?.end ? formatTime(epg.end) : '00:00'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-purple-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]" />
                  <span>{progressPercentage}% concluído</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">A SEGUIR</span>
            <span className="text-sm font-bold text-zinc-300">Próximo Programa • 22:00</span>
          </div>
        </div>

        <p className="text-sm text-zinc-400 font-medium leading-relaxed max-w-5xl mb-10 opacity-90 line-clamp-2">
          {epg?.description 
            ? String(decodeBase64(epg.description))
            : 'Acompanhe a programação completa em tempo real com a melhor qualidade de imagem e som.'}
        </p>

        {/* Progress Bar Container */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Progresso da Transmissão</span>
             <span className="text-xs font-black text-purple-400 tracking-wider">{progressPercentage}%</span>
          </div>
          <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-[1px] relative">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 via-purple-400 to-pink-500 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-1000 ease-out relative z-10" 
              style={{ width: `${progressPercentage}%` }} 
            />
            {/* Subtle background glow for the bar */}
            <div 
              className="absolute inset-0 bg-purple-500/5 blur-sm"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
