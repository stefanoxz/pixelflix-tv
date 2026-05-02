import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ChevronLeft, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Zap, 
  Play
} from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { ErrorBoundary } from './layout/ErrorBoundary';

interface PremiumPlayerProps {
  options: any;
  title: string;
  subtitle: string;
  onClose: () => void;
  isFullscreen?: boolean;
}

export const PremiumPlayer = ({ options, title, subtitle, onClose, isFullscreen = true }: PremiumPlayerProps) => {
  const [isIdle, setIsIdle] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<any>(null);
  const idleTimer = useRef<NodeJS.Timeout | null>(null);

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
      setVolume(player.volume() * 100);
      setIsMuted(player.muted());
    });
    player.on('timeupdate', () => {
      setCurrentTime(player.currentTime());
    });
    player.on('loadedmetadata', () => {
      setDuration(player.duration());
    });
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playerRef.current) {
      if (isPlaying) playerRef.current.pause();
      else playerRef.current.play();
    }
  };

  const handleVolumeChange = (newVol: number) => {
    if (playerRef.current) {
      playerRef.current.volume(newVol / 100);
      playerRef.current.muted(newVol === 0);
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
      className={`${isFullscreen ? 'fixed inset-0 z-[200]' : 'relative w-full h-full'} bg-black transition-cursor duration-500 overflow-hidden ${isIdle ? 'cursor-none' : 'cursor-default'}`}
      onMouseMove={resetIdleTimer}
    >
      <ErrorBoundary isLocal>
        <VideoPlayer 
          options={memoizedOptions} 
          onReady={handlePlayerReady} 
        />
      </ErrorBoundary>

      {/* Center Play/Pause Overlay */}
      <div 
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${isIdle ? 'opacity-0' : 'opacity-100'}`}
      >
        {!isPlaying && (
          <div className="p-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 animate-in zoom-in duration-300">
            <Play size={48} className="text-white fill-white ml-2" />
          </div>
        )}
      </div>

      {/* Top Cinematic Bar */}
      {isFullscreen && (
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
            <div className="flex flex-col items-start">
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight line-clamp-1">
                {title}
              </h2>
              <span className="text-xs md:text-sm font-bold text-zinc-400 tracking-[0.3em] uppercase mt-1">
                {subtitle}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Custom Bottom Bar */}
      <div 
        className={`absolute bottom-8 inset-x-0 px-8 z-[210] transition-all duration-700 ${isIdle ? 'opacity-0 translate-y-full' : 'opacity-100 translate-y-0'}`}
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          className="max-w-6xl mx-auto flex flex-col gap-4"
        >
          {/* Progress Bar */}
          {duration > 0 && duration !== Infinity && (
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
              {/* Live Badge */}
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]" />
                <span className="text-[10px] font-black text-red-500 tracking-[0.2em] uppercase">AO VIVO</span>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-4 group/vol">
                <button 
                  onClick={() => handleVolumeChange(isMuted ? volume : 0)} 
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
                onClick={togglePlay}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-all shadow-inner"
              >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
              </button>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <span className="hidden sm:inline text-[10px] font-black text-zinc-300 uppercase tracking-widest">Auto</span>
                <button 
                  onClick={() => {
                    if (playerRef.current) {
                      if (playerRef.current.isFullscreen()) playerRef.current.exitFullscreen();
                      else playerRef.current.requestFullscreen();
                    }
                  }}
                  className="text-zinc-400 hover:text-white transition-all hover:scale-110"
                >
                  <Maximize size={20} />
                </button>
              </div>
            </div>

            {/* Bitrate indicator */}
            <div className="absolute -bottom-7 right-4">
              <span className="text-[9px] font-black text-zinc-600 tracking-widest uppercase">3347 kbps</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
