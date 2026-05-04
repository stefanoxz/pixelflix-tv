import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Clock, Tv, Loader2, Play } from 'lucide-react';
import { PremiumPlayer } from '../PremiumPlayer';
import { ErrorBoundary } from '../layout/ErrorBoundary';
import { xtreamService } from '../../services/xtream';
import { settingsService } from '../../services/settingsService';
import { recentChannelsService } from '../../services/recentChannels';

interface LivePlayerPanelProps {
  channel: any | null;
  epg: any[] | null;
}

export const LivePlayerPanel = ({ channel, epg }: LivePlayerPanelProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playerError, setPlayerError] = useState<any>(null);
  const [currentFormat, setCurrentFormat] = useState<'m3u8' | 'ts'>(settingsService.getSettings().playerType);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const is404Error = playerError && (
    String(playerError?.message || playerError || '').includes('404') ||
    String(playerError?.code || '') === '4'
  );

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  useEffect(() => {
    if (channel) {
      setIsLoading(true);
      setIsPlaying(false);
      setPlayerError(null);
      setCurrentFormat(settingsService.getSettings().playerType);
      
      // Much faster transition to player
      const timer = setTimeout(() => {
        setIsLoading(false);
        setIsPlaying(true);
        // Save to recently watched
        recentChannelsService.add(channel);
      }, 400); 
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
    }, 300);
  };

  const currentProgram = useMemo(() => {
    if (!epg || epg.length === 0) return null;
    const now = xtreamService.getServerTime();
    
    // Find the program that is currently running
    return epg.find(prog => {
      let start = prog.start_timestamp ? parseInt(prog.start_timestamp) : (prog.start ? new Date(prog.start).getTime() / 1000 : 0);
      let end = prog.stop_timestamp ? parseInt(prog.stop_timestamp) : (prog.end ? new Date(prog.end).getTime() / 1000 : 0);
      
      // Handle MS timestamps
      if (start > 2000000000) start /= 1000;
      if (end > 2000000000) end /= 1000;

      return now >= start && now < end;
    }) || epg[0];
  }, [epg]);

  const futurePrograms = useMemo(() => {
    if (!epg) return [];
    const now = xtreamService.getServerTime();
    
    return epg.filter(prog => {
      let start = prog.start_timestamp ? parseInt(prog.start_timestamp) : (prog.start ? new Date(prog.start).getTime() / 1000 : 0);
      if (start > 2000000000) start /= 1000;
      return start > now;
    }).sort((a, b) => {
      let startA = a.start_timestamp ? parseInt(a.start_timestamp) : (a.start ? new Date(a.start).getTime() / 1000 : 0);
      let startB = b.start_timestamp ? parseInt(b.start_timestamp) : (b.start ? new Date(b.start).getTime() / 1000 : 0);
      if (startA > 2000000000) startA /= 1000;
      if (startB > 2000000000) startB /= 1000;
      return startA - startB;
    });
  }, [epg]);

  const handlePlayerError = useCallback((error: any) => {
    console.warn('[LivePlayer] Playback error:', error);
    
    // Auto-fallback logic: If HLS fails, try TS (and vice-versa)
    const nextFormat = currentFormat === 'm3u8' ? 'ts' : 'm3u8';
    console.log(`[LivePlayer] Attempting auto-fallback to: ${nextFormat.toUpperCase()}`);
    setCurrentFormat(nextFormat);
  }, [currentFormat]);

  const videoOptions = useMemo(() => {
    if (!channel || !isPlaying) return null;
    const streamId = channel.stream_id || channel.id;
    const streamUrl = xtreamService.getStreamUrl(streamId, currentFormat, 'live');
    const mimeType = currentFormat === 'ts' ? 'video/mp2t' : 'application/x-mpegURL';
    
    return {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: true,
      sources: [{
        src: streamUrl,
        type: mimeType
      }],
      onError: handlePlayerError
    };
  }, [channel?.id, isPlaying, currentFormat, handlePlayerError]);

  const progressPercentage = useMemo(() => {
    if (!currentProgram) return 0;
    const now = xtreamService.getServerTime();
    let start = currentProgram.start_timestamp ? parseInt(currentProgram.start_timestamp) : (currentProgram.start ? new Date(currentProgram.start).getTime() / 1000 : 0);
    let end = currentProgram.stop_timestamp ? parseInt(currentProgram.stop_timestamp) : (currentProgram.end ? new Date(currentProgram.end).getTime() / 1000 : 0);
    
    if (start > 2000000000) start /= 1000;
    if (end > 2000000000) end /= 1000;

    const total = end - start;
    const elapsed = now - start;
    if (total <= 0) return 0;
    return Math.min(Math.max(Math.floor((elapsed / total) * 100), 0), 100);
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
    <div className="flex-1 flex flex-col p-8 gap-8 bg-[#050308] overflow-y-auto custom-scrollbar relative">
      {/* Cinematic Grain Texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-0" 
           style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }} />

      {/* Video Container */}
      <div className="w-full aspect-video rounded-[40px] overflow-hidden bg-[#0a0a0a] border border-white/5 relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center group shrink-0 z-10">
        {channel.icon && (
          <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
            <img src={channel.icon} alt="bg" className="w-[80%] h-[80%] object-contain blur-[100px]" />
          </div>
        )}

        {isLoading ? (
          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-600/30 blur-2xl rounded-full animate-pulse" />
              <Loader2 className="w-12 h-12 text-white animate-spin relative z-10" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-black tracking-[0.4em] text-white uppercase drop-shadow-lg">Sincronizando</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        ) : is404Error ? (
          <div className="relative z-10 flex flex-col items-center gap-6 p-12 text-center animate-in fade-in zoom-in duration-500">
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
              <div 
                className="absolute inset-0 bg-cover bg-center scale-110 blur-[100px] opacity-30 transition-all duration-1000"
                style={{ backgroundImage: `url(${channel.icon})` }}
              />
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full animate-pulse" />
              <div className="w-24 h-24 bg-[#08060D] rounded-full flex items-center justify-center border border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.2)] relative z-10 text-5xl">
                📡
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-white tracking-tight">Canal Fora do Ar</h3>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-[300px] mx-auto">
                Este canal está temporariamente indisponível. Por favor, escolha outro canal na lista ao lado.
              </p>
            </div>
          </div>
        ) : playerError ? (
          <div className="relative z-10 flex flex-col items-center gap-8 p-12 text-center max-w-lg animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-red-600/20 blur-3xl rounded-full animate-pulse" />
              <div className="w-24 h-24 bg-[#08060D] rounded-full flex items-center justify-center border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)] relative z-10">
                <Play size={40} className="text-red-500 fill-red-500/20 translate-x-1" />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-white tracking-tight">Falha na Reprodução</h3>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-[320px] mx-auto">
                Este canal não respondeu no formato <span className="text-purple-400 font-bold uppercase">{currentFormat}</span>. Deseja tentar outro formato ou recarregar?
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
              <button 
                onClick={toggleFormat}
                className="group relative px-8 py-4 overflow-hidden rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-90 group-hover:opacity-100" />
                <span className="relative text-white font-black text-[10px] uppercase tracking-[0.2em]">
                  Alternar para {currentFormat === 'm3u8' ? 'TS' : 'HLS'}
                </span>
              </button>
              <button 
                onClick={() => {
                  setPlayerError(null);
                  setIsLoading(true);
                  setIsPlaying(false);
                  setTimeout(() => {
                    setIsLoading(false);
                    setIsPlaying(true);
                  }, 1000);
                }}
                className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all w-full sm:w-auto"
              >
                Tentar Novamente
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
                isLive={true}
                onClose={() => {}} 
                onError={(err) => setPlayerError(err)}
              />
            </ErrorBoundary>
          </div>
        ) : null}
      </div>

      {/* Unified Cinematic EPG Panel */}
      <div className="bg-[#080808]/40 backdrop-blur-3xl border border-white/5 rounded-[48px] p-10 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-0 z-10">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
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

            <div 
              ref={scrollRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              className={`flex gap-5 overflow-x-auto pb-6 custom-scrollbar-horizontal -mx-2 px-2 scroll-smooth select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}
            >
              {futurePrograms.length > 0 ? futurePrograms.map((prog, idx) => (
                <div 
                  key={idx} 
                  className="min-w-[280px] p-6 rounded-[32px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-purple-500/20 transition-all duration-500 group cursor-default hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="px-3 py-1 bg-purple-600/10 border border-purple-500/20 rounded-xl">
                      <span className="text-[10px] font-black text-purple-400 tracking-widest uppercase">
                        {prog.start ? formatTime(prog.start) : '00:00'}
                      </span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-white/10 group-hover:bg-purple-500 group-hover:shadow-[0_0_10px_#a855f7] transition-all duration-500" />
                  </div>
                  <h5 className="text-sm font-black text-white mb-2 line-clamp-1 group-hover:text-purple-300 transition-colors duration-300">
                    {prog.title ? String(decodeBase64(prog.title)) : 'Sem Título'}
                  </h5>
                  <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity duration-500 font-medium">
                    {prog.description ? String(decodeBase64(prog.description)) : 'Acompanhe a continuação deste canal logo após o programa atual.'}
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
