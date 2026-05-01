import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { ErrorBoundary } from './layout/ErrorBoundary';

interface PremiumPlayerProps {
  options: any;
  title: string;
  subtitle: string;
  onClose: () => void;
}

export const PremiumPlayer = ({ options, title, subtitle, onClose }: PremiumPlayerProps) => {
  const [isIdle, setIsIdle] = useState(false);
  const idleTimer = useRef<NodeJS.Timeout | null>(null);

  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setIsIdle(true);
    }, 3000);
  }, []);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdleTimer]);

  return (
    <div 
      className={`fixed inset-0 z-[200] bg-black transition-cursor duration-500 ${isIdle ? 'cursor-none' : 'cursor-default'}`}
      onMouseMove={resetIdleTimer}
      onClick={resetIdleTimer}
      onTouchStart={resetIdleTimer}
    >
      <ErrorBoundary isLocal>
        <VideoPlayer options={options} />
      </ErrorBoundary>

      {/* Top Cinematic Bar */}
      <div 
        className={`absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none transition-opacity duration-700 flex items-start p-8 md:p-12 z-[210] ${isIdle ? 'opacity-0' : 'opacity-100'}`}
      >
        <button 
          onClick={onClose}
          className="pointer-events-auto flex items-center gap-6 group focus:outline-none"
        >
          <div className="p-4 rounded-full bg-white/5 backdrop-blur-md border border-white/10 group-hover:bg-white/20 group-hover:scale-110 group-focus-visible:ring-4 group-focus-visible:ring-purple-500 transition-all duration-300">
            <ChevronLeft size={28} className="text-white" />
          </div>
          <div className="flex flex-col items-start">
            <h2 className="text-2xl md:text-3xl font-black text-white drop-shadow-2xl capitalize tracking-tight line-clamp-1">
              {title.toLowerCase()}
            </h2>
            <span className="text-xs md:text-sm font-bold text-zinc-400 tracking-[0.3em] uppercase mt-1">
              {subtitle}
            </span>
          </div>
        </button>
      </div>

      {/* Bottom vignette to make Video.js controls pop */}
      <div 
        className={`absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none transition-opacity duration-700 z-[205] ${isIdle ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
};
