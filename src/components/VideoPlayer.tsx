import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { PlayCircle } from 'lucide-react';

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
      <div className="absolute top-8 right-8 flex items-center gap-3 opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none z-10 bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/10 shadow-2xl">
        <PlayCircle className="text-white" size={24} fill="white" />
        <div className="flex flex-col">
          <span className="text-2xl font-black tracking-tighter text-white uppercase italic leading-none">VIBE</span>
          <span className="text-[8px] font-black tracking-[0.3em] text-blue-500 uppercase">Premium</span>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
