import React, { useEffect, useRef, useState, memo } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import vibeLogo from '@/assets/vibe-logo.png';
import { Volume2, Sun, Loader2 } from 'lucide-react';

interface VideoPlayerProps {
  options: any;
  onReady?: (player: any) => void;
  onError?: (error: any) => void;
}

export const VideoPlayer = (props: VideoPlayerProps) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const touchStartRef = useRef<{ x: number, y: number } | null>(null);
  const initialValueRef = useRef<number>(0);
  const [gestureInfo, setGestureInfo] = useState<{ type: 'volume' | 'brightness', value: number } | null>(null);
  
  const { options, onReady, onError } = props;

  useEffect(() => {
    let isMounted = true;

    if (!playerRef.current) {
        if (!isMounted) return;

        const videoElement = document.createElement("video-js");
        videoElement.classList.add('vjs-big-play-centered');
        videoElement.classList.add('vjs-theme-city');
        
        if (videoRef.current) {
          videoRef.current.appendChild(videoElement);

          const player = playerRef.current = videojs(videoElement, {
            ...options,
            fill: true,
            responsive: true,
            controlBar: {
              children: [
                'playToggle',
                'volumePanel',
                'currentTimeDisplay',
                'timeDivider',
                'durationDisplay',
                'progressControl',
                'fullscreenToggle',
              ],
            },
            html5: {
              vhs: { 
                overrideNative: true,
                fastQualityChange: true
              },
              nativeAudioTracks: false,
              nativeVideoTracks: false
            }
          }, () => {
            if (!isMounted) {
              player.dispose();
              playerRef.current = null;
              return;
            }
            // Force contain to avoid cropping
            const videoTag = videoElement.querySelector('video');
            if (videoTag) {
              videoTag.style.objectFit = 'contain';
            }
            onReady && onReady(player);
          });

          player.on('error', () => {
            const error = player.error();
            console.error('VideoJS Error:', error);
            if (onError) onError(error);
          });
        }
    } else {
      const player = playerRef.current;
      const currentSrc = player.src();
      const newSrc = options.sources[0]?.src;
      
      if (newSrc && currentSrc !== newSrc) {
        player.autoplay(options.autoplay);
        player.src(options.sources);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [options, videoRef]);

  // Touch Gesture Handling
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    
    const player = playerRef.current;
    if (!player) return;

    const { width } = videoRef.current!.getBoundingClientRect();
    if (touch.clientX > width / 2) {
      initialValueRef.current = player.volume() * 100;
    } else {
      // In a real app, brightness is managed via a full-screen overlay or CSS filter
      initialValueRef.current = 100; // Mock current brightness
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !playerRef.current) return;
    
    const touch = e.touches[0];
    const deltaY = touchStartRef.current.y - touch.clientY;
    const { width, height } = videoRef.current!.getBoundingClientRect();
    
    // Sensitivity factor
    const change = (deltaY / height) * 100;
    let newValue = Math.min(100, Math.max(0, initialValueRef.current + change));

    if (touchStartRef.current.x > width / 2) {
      // Volume Control (Right side)
      playerRef.current.volume(newValue / 100);
      setGestureInfo({ type: 'volume', value: Math.round(newValue) });
    } else {
      // Brightness Control (Left side) - Using CSS Filter as mock
      const videoEl = videoRef.current?.querySelector('video');
      if (videoEl) {
        videoEl.style.filter = `brightness(${newValue}%)`;
      }
      setGestureInfo({ type: 'brightness', value: Math.round(newValue) });
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    setTimeout(() => setGestureInfo(null), 1000);
  };

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      data-vjs-player 
      className="w-full h-full rounded-[32px] overflow-hidden bg-black relative group select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div ref={videoRef} className="w-full h-full" />
      
      {/* Gesture UI Indicator */}
      {gestureInfo && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none animate-in fade-in zoom-in duration-200">
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-[32px] flex flex-col items-center gap-4 min-w-[120px]">
            {gestureInfo.type === 'volume' ? (
              <Volume2 className="text-white" size={32} />
            ) : (
              <Sun className="text-white" size={32} />
            )}
            <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-100" 
                style={{ width: `${gestureInfo.value}%` }}
              />
            </div>
            <span className="text-xs font-black text-white">{gestureInfo.value}%</span>
          </div>
        </div>
      )}

      {/* Vibe Watermark */}
      <div className="absolute top-6 right-6 opacity-30 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        <img 
          src={vibeLogo} 
          alt="Vibe" 
          className="h-10 w-auto object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]"
        />
      </div>
    </div>
  );
}

export default VideoPlayer;
