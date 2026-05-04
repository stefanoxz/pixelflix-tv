import { memo, useMemo, useState } from 'react';
import { Loader2, Tv, Clock, Play, Info, AlertTriangle, ChevronRight } from 'lucide-react';
import { ErrorBoundary } from '../layout/ErrorBoundary';
import { PremiumPlayer } from '../PremiumPlayer';
import { xtreamService } from '../../services/xtream';
import vibeLogo from '../../assets/vibe-logo.png';

interface LivePlayerPanelProps {
  channel: any | null;
  epg: any[] | null;
  isLoadingEPG?: boolean;
}

export const LivePlayerPanel = memo(({ channel, epg, isLoadingEPG }: LivePlayerPanelProps) => {
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const isPlaying = !!channel;

  const decodeSafe = (text: string) => {
    if (!text) return '';
    try {
      return atob(text);
    } catch {
      return text;
    }
  };

  const currentProgram = useMemo(() => {
    if (!epg || epg.length === 0) return null;
    const now = xtreamService.getServerTime();
    
    return epg.find((prog: any) => {
      let start = prog.start_timestamp ? parseInt(prog.start_timestamp) : (prog.start ? new Date(prog.start).getTime() / 1000 : 0);
      let end = prog.stop_timestamp ? parseInt(prog.stop_timestamp) : (prog.end ? new Date(prog.end).getTime() / 1000 : 0);
      
      if (start > 2000000000) start /= 1000;
      if (end > 2000000000) end /= 1000;
      
      return now >= start && now < end;
    }) || epg[0];
  }, [epg]);

  const futurePrograms = useMemo(() => {
    if (!epg || epg.length === 0) return [];
    const now = xtreamService.getServerTime();
    
    return epg.filter((prog: any) => {
      let start = prog.start_timestamp ? parseInt(prog.start_timestamp) : (prog.start ? new Date(prog.start).getTime() / 1000 : 0);
      if (start > 2000000000) start /= 1000;
      return start > now;
    }).slice(0, 5);
  }, [epg]);

  const videoOptions = useMemo(() => {
    if (!channel) return null;
    
    // Get the correct stream URL using xtreamService
    const streamUrl = xtreamService.getStreamUrl(String(channel.stream_id), 'm3u8', 'live');
    
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
  }, [channel]);

  if (!channel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#050308] relative overflow-hidden group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.05)_0%,transparent_70%)]" />
        <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-700">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500/20 blur-[60px] rounded-full animate-pulse" />
            <div className="w-32 h-32 rounded-[40px] bg-[#0A0A0A] border border-white/5 flex items-center justify-center shadow-2xl relative z-10">
              <Tv size={48} className="text-zinc-800 group-hover:text-purple-500 transition-colors duration-500" />
            </div>
          </div>
          <div className="text-center space-y-4">
            <img src={vibeLogo} alt="Vibe" className="h-12 w-auto object-contain mx-auto drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]" />
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">Selecione um canal para começar</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 bg-[#050308] overflow-y-auto custom-scrollbar relative">
      {/* Absolute Background Effect (Constrained to this panel) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center scale-110 blur-[100px] opacity-20 transition-all duration-1000"
          style={{ backgroundImage: `url(${channel.icon})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-black to-black opacity-60" />
      </div>

      {/* Video Container */}
      <div className="w-full aspect-video max-h-[50vh] rounded-[32px] overflow-hidden bg-[#0a0a0a] border border-white/5 relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center group shrink-0 z-10">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none" />
        
        <div className="w-full h-full relative z-10 bg-black">
          <ErrorBoundary isLocal>
            <PremiumPlayer 
              options={videoOptions}
              title={channel.name}
              subtitle="TV Ao Vivo"
              onClose={() => isPlayerFullscreen ? setIsPlayerFullscreen(false) : null}
              onToggleFullscreen={() => setIsPlayerFullscreen(!isPlayerFullscreen)}
              isLive={true}
              isFullscreen={isPlayerFullscreen}
              streamId={String(channel.stream_id)}
            />
          </ErrorBoundary>
        </div>
      </div>


      {/* Cinematic EPG Panel */}
      <div className="bg-[#080808]/40 backdrop-blur-3xl border border-white/5 rounded-[32px] p-6 lg:p-8 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-0 z-10">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row gap-8 relative z-10">
          {/* Current Program Info */}
          <div className="lg:w-2/5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                  <Play size={14} fill="currentColor" />
                </div>
                <span className="text-[9px] font-black text-purple-400 uppercase tracking-[0.3em]">Passando Agora</span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl lg:text-2xl font-black text-white tracking-tighter uppercase leading-tight italic">
                  {isLoadingEPG ? (
                    <div className="h-8 w-64 bg-white/5 animate-pulse rounded-lg" />
                  ) : (
                    currentProgram?.title ? decodeSafe(currentProgram.title) : 'Programação indisponível'
                  )}
                </h3>
                <div className="flex items-center gap-4 text-zinc-500 font-bold text-[11px] uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Clock size={12} />
                    {isLoadingEPG ? (
                      <div className="h-3 w-20 bg-white/5 animate-pulse rounded" />
                    ) : (
                      <span>{currentProgram?.start?.split(' ')[1]?.substring(0, 5) || '--:--'} - {currentProgram?.end?.split(' ')[1]?.substring(0, 5) || '--:--'}</span>
                    )}
                  </div>
                  <div className="w-1 h-1 rounded-full bg-zinc-800" />
                  <span>Vibe TV</span>
                </div>
              </div>

              <div className="text-sm text-zinc-400 leading-relaxed font-medium line-clamp-3">
                {isLoadingEPG ? (
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-white/5 animate-pulse rounded" />
                    <div className="h-4 w-3/4 bg-white/5 animate-pulse rounded" />
                  </div>
                ) : (
                  currentProgram?.description ? decodeSafe(currentProgram.description) : 'Sem descrição disponível para este programa no momento.'
                )}
              </div>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <button className="flex-1 py-4 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] hover:bg-purple-500 hover:text-white transition-all duration-500 shadow-xl shadow-white/5 active:scale-95">
                Ver Detalhes
              </button>
              <button className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-95">
                <Info size={20} />
              </button>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="hidden lg:block w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent" />

          {/* Schedule List */}
          <div className="lg:w-3/5">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-zinc-800 text-zinc-400">
                  <Clock size={14} />
                </div>
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.3em]">A Seguir</span>
              </div>
              <button className="text-[9px] font-black text-purple-400 uppercase tracking-widest hover:text-purple-300 transition-colors">Grade Completa</button>
            </div>

            <div className="space-y-3">
              {isLoadingEPG ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-6 p-4 rounded-3xl bg-white/[0.02] border border-white/5 animate-pulse">
                    <div className="h-3 w-12 bg-white/5 rounded" />
                    <div className="h-4 w-full bg-white/5 rounded" />
                  </div>
                ))
              ) : futurePrograms.length > 0 ? futurePrograms.map((prog: any, idx: number) => (
                <div 
                  key={idx}
                  className="flex items-center gap-6 p-4 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all group/item cursor-pointer"
                >
                  <div className="text-[11px] font-black text-zinc-500 group-hover/item:text-purple-400 transition-colors w-12 shrink-0">
                    {prog.start?.split(' ')[1]?.substring(0, 5) || '--:--'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-white truncate group-hover/item:translate-x-1 transition-transform">
                      {decodeSafe(prog.title)}
                    </h4>
                  </div>
                  <ChevronRight size={16} className="text-zinc-700 opacity-0 group-hover/item:opacity-100 transition-all -translate-x-2 group-hover/item:translate-x-0" />
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-600 bg-white/[0.02] rounded-3xl border border-dashed border-white/5">
                  <AlertTriangle size={32} className="mb-4 opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 text-center">Programação não disponível</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

LivePlayerPanel.displayName = 'LivePlayerPanel';
