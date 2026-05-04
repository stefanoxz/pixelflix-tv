import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ChevronLeft, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Play,
  Pause,
  CheckCircle2
} from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { ErrorBoundary } from './layout/ErrorBoundary';
import { historyService } from '../services/historyService';

interface PremiumPlayerProps {
  options: any;
  title: string;
  subtitle: string;
  onClose: () => void;
  onToggleFullscreen?: () => void;
  onError?: (error: any) => void;
  isFullscreen?: boolean;
  isLive?: boolean;
  streamId?: string;
}

export const PremiumPlayer = ({ 
  options, 
  title, 
  subtitle, 
  onClose, 
  onToggleFullscreen,
  onError, 
  isFullscreen = true, 
  isLive = false, 
  streamId 
}: PremiumPlayerProps) => {
  const [isIdle, setIsIdle] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<NodeJS.Timeout | null>(null);
  const lastVolume = useRef(80);

  const toggleFullscreen = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      if (!isFullscreen) onToggleFullscreen?.();
    } else {
      document.exitFullscreen();
      if (isFullscreen) onToggleFullscreen?.();
    }
  }, [isFullscreen, onToggleFullscreen]);

  // Sync state when browser fullscreen changes (e.g. Esc key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isActuallyFullscreen = !!document.fullscreenElement;
      if (isActuallyFullscreen !== isFullscreen) {
        onToggleFullscreen?.();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isFullscreen, onToggleFullscreen]);

  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setIsIdle(true);
    }, 4000);
  }, []);

  const handlePlayerReady = useCallback((player: any) => {
    playerRef.current = player;
    player.on('play', () => setIsPlaying(true));
    player.on('pause', () => setIsPlaying(false));
    player.on('volumechange', () => {
      const currentVol = player.volume() * 100;
      const muted = player.muted();
      setIsMuted(muted);
      if (!muted && currentVol > 0) {
        setVolume(currentVol);
        lastVolume.current = currentVol;
      } else if (muted) {
        setVolume(0);
      }
    });
    player.on('timeupdate', () => {
      const time = player.currentTime();
      const dur = player.duration();
      setCurrentTime(time);
      
      if (streamId && !isLive && dur > 0) {
        historyService.saveProgress(streamId, time, dur);
      }
    });
    player.on('loadedmetadata', () => {
      const dur = player.duration();
      setDuration(dur);
      
      if (streamId && !isLive) {
        const progress = historyService.getProgress(streamId);
        if (progress && progress.currentTime > 10 && (progress.currentTime < dur - 30)) {
          player.currentTime(progress.currentTime);
        }
      }
    });
  }, [streamId, isLive]);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (playerRef.current) {
      if (playerRef.current.paused()) {
        playerRef.current.play();
      } else {
        playerRef.current.pause();
      }
    }
  };

  const handleVolumeChange = (newVol: number) => {
    if (playerRef.current) {
      playerRef.current.volume(newVol / 100);
      playerRef.current.muted(newVol === 0);
      if (newVol > 0) {
        lastVolume.current = newVol;
        setVolume(newVol);
      }
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playerRef.current) {
      const isMutedNow = playerRef.current.muted();
      if (isMutedNow) {
        playerRef.current.muted(false);
        playerRef.current.volume(lastVolume.current / 100);
      } else {
        playerRef.current.muted(true);
      }
    }
  };

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdleTimer]);

  const memoizedOptions = useMemo(() => ({
    ...options,
    controls: false,
    autoplay: true
  }), [options.sources[0]?.src]);

  return (
    <div 
      ref={containerRef}
      className={`${isFullscreen ? 'fixed inset-0 z-[200]' : 'relative w-full h-full'} bg-black transition-cursor duration-500 overflow-hidden ${isIdle ? 'cursor-none' : 'cursor-default'}`}
      onMouseMove={resetIdleTimer}
      onClick={() => togglePlay()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        toggleFullscreen();
      }}
    >
      <ErrorBoundary isLocal>
        <VideoPlayer 
          options={memoizedOptions} 
          onReady={handlePlayerReady} 
          onError={onError}
        />
      </ErrorBoundary>

      {/* Center Play/Pause Overlay */}
      <div 
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 pointer-events-none ${isIdle ? 'opacity-0' : 'opacity-100'}`}
      >
        {!isPlaying && (
          <div className="p-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 animate-in zoom-in duration-300 pointer-events-auto cursor-pointer" onClick={(e) => togglePlay(e)}>
            <Play size={48} className="text-white fill-white ml-2" />
          </div>
        )}
      </div>

      {/* Top Cinematic Bar */}
      <div 
        className={`absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none transition-all duration-700 flex items-start p-8 md:p-12 z-[210] ${isIdle ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'}`}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="pointer-events-auto flex items-center gap-6 group focus:outline-none"
        >
          <div className="p-4 rounded-full bg-white/5 backdrop-blur-md border border-white/10 group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
            <ChevronLeft size={28} className="text-white" />
          </div>
          <div className="flex flex-col items-start text-left">
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight line-clamp-1 uppercase italic">
              {title}
            </h2>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs md:text-sm font-bold text-zinc-400 tracking-[0.3em] uppercase">
                {subtitle}
              </span>
              {isLive && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded-lg animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white italic">AO VIVO</span>
                </div>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Custom Bottom Bar */}
      <div 
        className={`absolute bottom-8 inset-x-0 px-8 z-[210] transition-all duration-700 ${isIdle ? 'opacity-0 translate-y-full' : 'opacity-100 translate-y-0'}`}
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          className="max-w-6xl mx-auto flex flex-col gap-4"
        >
          {/* Progress Bar */}
          {!isLive && duration > 0 && (
            <div 
              className="w-full h-1.5 bg-white/10 rounded-full relative overflow-hidden cursor-pointer group/progress mb-2"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                if (playerRef.current) playerRef.current.currentTime((x / rect.width) * duration);
              }}
            >
              <div 
                className="absolute top-0 left-0 h-full bg-purple-500 rounded-full shadow-[0_0_10px_#a855f7]" 
                style={{ width: `${(currentTime / duration) * 100}%` }} 
              />
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-black/40 backdrop-blur-3xl border border-white/5 rounded-[28px] shadow-2xl relative">
            <div className="flex items-center gap-6">
              {/* Volume Control */}
              <div className="flex items-center gap-4 group/vol">
                <button 
                  onClick={toggleMute} 
                  className="text-white hover:text-purple-400 transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <div 
                  className="w-32 md:w-48 h-1.5 bg-white/10 rounded-full relative overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    handleVolumeChange((x / rect.width) * 100);
                  }}
                >
                  <div className="absolute top-0 left-0 h-full bg-white rounded-full" style={{ width: `${volume}%` }} />
                </div>
              </div>
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4">
              <button 
                onClick={(e) => togglePlay(e)}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-all shadow-inner"
              >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
              </button>
            </div>

            <div className="flex items-center gap-6">
              {!isLive && (
                <span className="text-[10px] font-black text-white/50 tracking-widest tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              )}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                className="text-white hover:text-purple-400 transition-colors"
              >
                <Maximize size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds === Infinity) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};
