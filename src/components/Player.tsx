import { useEffect, useRef } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { Tv } from "lucide-react";

interface PlayerProps {
  src?: string | null;
  poster?: string;
  title?: string;
  autoPlay?: boolean;
}

export function Player({ src, poster, title, autoPlay = true }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Cleanup previous players
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      mpegtsRef.current.destroy();
      mpegtsRef.current = null;
    }

    // Detect stream type by URL/extension
    const lower = src.toLowerCase();
    const isM3u8 = lower.includes(".m3u8") || lower.includes("mpegurl");
    // Bare .ts (mpegts), but NOT segments inside an m3u8 — those are handled by hls.js
    const isTs = !isM3u8 && (lower.includes(".ts") || lower.includes("mpeg-ts"));

    if (isM3u8 && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) console.error("HLS fatal error", data);
      });
    } else if (isTs && mpegts.getFeatureList().mseLivePlayback) {
      const player = mpegts.createPlayer(
        {
          type: "mpegts",
          isLive: true,
          url: src,
        },
        {
          enableWorker: true,
          lazyLoad: false,
          liveBufferLatencyChasing: true,
          stashInitialSize: 128,
        }
      );
      mpegtsRef.current = player;
      player.attachMediaElement(video);
      player.load();
      if (autoPlay) {
        player.play().catch(() => {});
      }
      player.on(mpegts.Events.ERROR, (errType, errDetail) => {
        console.error("mpegts.js error", errType, errDetail);
      });
    } else {
      // Native playback (MP4/WebM, or Safari with native HLS)
      video.src = src;
      if (autoPlay) video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (mpegtsRef.current) {
        mpegtsRef.current.destroy();
        mpegtsRef.current = null;
      }
    };
  }, [src, autoPlay]);

  if (!src) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-card flex items-center justify-center shadow-card">
        <div className="absolute inset-0 bg-gradient-glow opacity-50" />
        <div className="relative z-10 text-center p-8">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Tv className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Selecione um canal</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha um canal, filme ou série para começar a assistir
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-card animate-scale-in">
      <video
        ref={videoRef}
        className="h-full w-full"
        controls
        playsInline
        poster={poster}
      />
      {title && (
        <div className="pointer-events-none absolute left-0 top-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4">
          <h3 className="text-sm font-semibold text-white drop-shadow">{title}</h3>
        </div>
      )}
    </div>
  );
}
