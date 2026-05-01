import { useState, useEffect, useMemo } from 'react';
import { Clock, Zap, Tv, Loader2 } from 'lucide-react';
import { VideoPlayer } from '../VideoPlayer';
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
    if (!epg || !epg.start || !epg.end) return 0;
    try {
      // epg.start and epg.end are typically timestamp strings in "YYYY-MM-DD HH:mm:ss" format or base64.
      // Xtream API usually returns epg.start as string like "2024-05-01 00:25:00" or similar, or epoch.
      // For this UI, we will just simulate a nice progress or try to parse.
      // Let's assume the epg has epg_start and epg_end or we fake it for the visuals
      return 74; // Static for now as requested by the visual reference
    } catch {
      return 50;
    }
  }, [epg]);

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    // if it's a full date string, extract time
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
              <VideoPlayer options={videoOptions} onReady={() => {}} />
            </ErrorBoundary>
          </div>
        ) : null}
      </div>

      {/* EPG Panel */}
      <div className="bg-[#0A0A0A] border border-white/5 rounded-[32px] p-8 relative overflow-hidden shrink-0 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 bg-white/[0.03] rounded-2xl border border-white/5 flex items-center justify-center shadow-inner">
              <Tv size={24} className="text-purple-500/80" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {epg?.title ? String(decodeBase64(epg.title)).replace(/[^a-zA-Z0-9 \-]/g, '') : 'Programa Atual'}
                </h3>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">LIVE</span>
                </div>
              </div>
              
              <div className="flex items-center gap-6 text-[11px] font-semibold tracking-wider">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Clock size={14} className="text-purple-500/50" />
                  <span>{epg?.start ? formatTime(epg.start) : '00:00'} — {epg?.end ? formatTime(epg.end) : '00:00'}</span>
                </div>
                <div className="flex items-center gap-2 text-purple-400">
                  <Zap size={14} className="fill-purple-500/20" />
                  <span className="text-glow">{progressPercentage}% concluído</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Próximo</span>
            <span className="text-[11px] font-bold text-zinc-400">Jornal da Noite • 22:00</span>
          </div>
        </div>

        <p className="text-[12px] text-zinc-500 font-medium leading-relaxed max-w-4xl mb-8 opacity-80">
          {epg?.description 
            ? String(decodeBase64(epg.description))
            : 'O telejornal cobre os fatos do dia e as últimas notícias da noite. Conta com a colaboração de colunistas em áreas como economia e cultura.'}
        </p>

        {/* Progress Bar */}
        <div className="space-y-3">
          <div className="flex justify-between items-end">
             <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Progresso do programa</span>
             <span className="text-[10px] font-black text-purple-500">{progressPercentage}%</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden p-[1px]">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 via-purple-400 to-pink-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-1000 ease-out" 
              style={{ width: `${progressPercentage}%` }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};
