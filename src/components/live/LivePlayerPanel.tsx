import { memo, useMemo } from 'react';
import { Loader2, Tv, Clock, Play, Info, AlertTriangle, ChevronRight } from 'lucide-react';
import { ErrorBoundary } from '../layout/ErrorBoundary';
import { PremiumPlayer } from '../PremiumPlayer';
import { xtreamService } from '../../services/xtream';

interface LivePlayerPanelProps {
  channel: any | null;
  epg: any[] | null;
}

export const LivePlayerPanel = memo(({ channel, epg }: LivePlayerPanelProps) => {
  const isPlaying = !!channel;

  const currentProgram = useMemo(() => {
    if (!epg || epg.length === 0) return null;
    const now = Math.floor(Date.now() / 1000);
    return epg.find((prog: any) => {
      let start = parseInt(prog.start_timestamp);
      let end = parseInt(prog.stop_timestamp);
      return now >= start && now < end;
    }) || epg[0];
  }, [epg]);

  const futurePrograms = useMemo(() => {
    if (!epg || epg.length === 0) return [];
    const now = Math.floor(Date.now() / 1000);
    return epg.filter((prog: any) => parseInt(prog.start_timestamp) > now).slice(0, 5);
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
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white uppercase tracking-widest italic">PixelFlix Live</h2>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">Selecione um canal para começar</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-8 gap-8 bg-[#050308] overflow-y-auto custom-scrollbar relative">
      {/* Absolute Background Effect (Constrained to this panel) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center scale-110 blur-[100px] opacity-20 transition-all duration-1000"
          style={{ backgroundImage: `url(${channel.icon})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-black to-black opacity-60" />
      </div>

      {/* Video Container */}
      <div className="w-full aspect-video rounded-[40px] overflow-hidden bg-[#0a0a0a] border border-white/5 relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center group shrink-0 z-10">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none" />
        
        <div className="w-full h-full relative z-10 bg-black">
          <ErrorBoundary isLocal>
            <PremiumPlayer 
              options={videoOptions}
              title={channel.name}
              subtitle="TV Ao Vivo"
              onClose={() => {}}
              isLive={true}
              isFullscreen={false}
              streamId={String(channel.stream_id)}
            />
          </ErrorBoundary>
        </div>


        <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
          <div className="px-4 py-1.5 rounded-full bg-red-600 flex items-center gap-2 shadow-lg shadow-red-600/20">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">AO VIVO</span>
          </div>
          <div className="px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-black text-white uppercase tracking-widest">
            {channel.name}
          </div>
        </div>
      </div>

      {/* Cinematic EPG Panel */}
      <div className="bg-[#080808]/40 backdrop-blur-3xl border border-white/5 rounded-[48px] p-10 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-0 z-10">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row gap-10 relative z-10">
          {/* Current Program Info */}
          <div className="lg:w-2/5 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                  <Play size={16} fill="currentColor" />
                </div>
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em]">Passando Agora</span>
              </div>

              <div className="space-y-3">
                <h3 className="text-3xl font-black text-white tracking-tighter uppercase leading-tight italic">
                  {currentProgram?.title ? (
                    (() => {
                      try { return atob(currentProgram.title); } catch { return currentProgram.title; }
                    })()
                  ) : 'Programa Atual'}
                </h3>
                <div className="flex items-center gap-4 text-zinc-500 font-bold text-[11px] uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Clock size={12} />
                    <span>{currentProgram?.start?.split(' ')[1]?.substring(0, 5) || '--:--'} - {currentProgram?.end?.split(' ')[1]?.substring(0, 5) || '--:--'}</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-zinc-800" />
                  <span>Canais PixelFlix</span>
                </div>
              </div>

              <p className="text-sm text-zinc-400 leading-relaxed font-medium line-clamp-3">
                {currentProgram?.description ? (
                  (() => {
                    try { return atob(currentProgram.description); } catch { return currentProgram.description; }
                  })()
                ) : 'Acompanhe a programação ao vivo com a melhor qualidade de imagem e som.'}
              </p>
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
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-zinc-800 text-zinc-400">
                  <Clock size={16} />
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">A Seguir</span>
              </div>
              <button className="text-[10px] font-black text-purple-400 uppercase tracking-widest hover:text-purple-300 transition-colors">Grade Completa</button>
            </div>

            <div className="space-y-3">
              {futurePrograms.length > 0 ? futurePrograms.map((prog: any, idx: number) => (
                <div 
                  key={idx}
                  className="flex items-center gap-6 p-4 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all group/item cursor-pointer"
                >
                  <div className="text-[11px] font-black text-zinc-500 group-hover/item:text-purple-400 transition-colors w-12 shrink-0">
                    {prog.start?.split(' ')[1]?.substring(0, 5) || '--:--'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-white truncate group-hover/item:translate-x-1 transition-transform">
                      {(() => {
                        try { return atob(prog.title); } catch { return prog.title; }
                      })()}
                    </h4>
                  </div>
                  <ChevronRight size={16} className="text-zinc-700 opacity-0 group-hover/item:opacity-100 transition-all -translate-x-2 group-hover/item:translate-x-0" />
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-600 bg-white/[0.02] rounded-3xl border border-dashed border-white/5">
                  <AlertTriangle size={32} className="mb-4 opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 text-center">Programação não disponível para este canal</p>
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
