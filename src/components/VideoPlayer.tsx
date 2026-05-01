import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import vibeLogo from '@/assets/vibe-logo.png';

interface VideoPlayerProps {
  options: any;
  onReady?: (player: any) => void;
}

export const VideoPlayer = (props: VideoPlayerProps) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const { options, onReady } = props;

  useEffect(() => {
    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");

      videoElement.classList.add('vjs-big-play-centered');
      videoElement.classList.add('vjs-theme-city');
      videoRef.current?.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, {
        ...options,
        // Ensure HLS is supported (Video.js 7+ has it built-in)
        html5: {
          vhs: {
            overrideNative: true
          },
          nativeAudioTracks: false,
          nativeVideoTracks: false
        }
      }, () => {
        console.log('Video player is ready');
        onReady && onReady(player);
      });

      player.on('error', () => {
        const error = player.error();
        console.error('VideoJS Error:', error);
      });

    } else {
      const player = playerRef.current;
      player.autoplay(options.autoplay);
      player.src(options.sources);
    }
  }, [options, videoRef]);

  useEffect(() => {
    const player = playerRef.current;
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  return (
    <div data-vjs-player className="w-full h-full rounded-[32px] overflow-hidden bg-black relative group">
      <div ref={videoRef} className="w-full h-full" />
      
      {/* Vibe Watermark */}
      <div className="absolute top-6 right-6 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        <img 
          src={vibeLogo} 
          alt="Vibe" 
          className="h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]"
        />
      </div>
    </div>
  );
}

export default VideoPlayer;
