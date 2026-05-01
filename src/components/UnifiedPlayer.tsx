import React, { useEffect, useRef, useState, memo } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import hlsjs from 'hls.js';

interface UnifiedPlayerProps {
  url: string;
  type?: 'hls' | 'mp4' | 'mpegts';
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  onError?: (error: any) => void;
}

export const UnifiedPlayer = memo(({ 
  url, 
  type = 'hls', 
  poster, 
  autoPlay = true, 
  className = '',
  onError 
}: UnifiedPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!videoRef.current) return;

    // Use HLS.js for HLS streams if supported and not native
    if (type === 'hls' && hlsjs.isSupported() && !videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      const hls = new hlsjs({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60
      });
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);
      hls.on(hlsjs.Events.ERROR, (event, data) => {
        if (data.fatal) {
          if (retryCount < 3) {
            setRetryCount(prev => prev + 1);
            hls.recoverMediaError();
          } else {
            onError?.(data);
          }
        }
      });
    } else {
      // Use Video.js for everything else or native HLS
      playerRef.current = videojs(videoRef.current, {
        autoplay: autoPlay,
        controls: true,
        responsive: true,
        fluid: true,
        poster: poster,
        sources: [{ src: url, type: type === 'hls' ? 'application/x-mpegURL' : `video/${type}` }],
        playbackRates: [0.5, 1, 1.5, 2],
        userActions: {
          hotkeys: true
        }
      });

      playerRef.current.on('error', () => {
        const error = playerRef.current.error();
        if (retryCount < 3) {
          setRetryCount(prev => prev + 1);
          playerRef.current.src(url);
        } else {
          onError?.(error);
        }
      });
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
      }
    };
  }, [url, type, retryCount]);

  return (
    <div className={`video-container rounded-xl overflow-hidden bg-black shadow-2xl ${className}`}>
      <div data-vjs-player>
        <video 
          ref={videoRef} 
          className="video-js vjs-big-play-centered vjs-theme-city w-full aspect-video"
          playsInline
        />
      </div>
    </div>
  );
});

UnifiedPlayer.displayName = 'UnifiedPlayer';
