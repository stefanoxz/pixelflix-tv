import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { Tv, AlertTriangle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PlayerProps {
  src?: string | null;
  poster?: string;
  title?: string;
  autoPlay?: boolean;
}

type PlayerError = {
  message: string;
  url: string;
};

export function Player({ src, poster, title, autoPlay = true }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const [error, setError] = useState<PlayerError | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setError(null);
    setCopied(false);

    const video = videoRef.current;
    if (!video || !src) return;

    // Cleanup previous players
    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (mpegtsRef.current) {
        try {
          mpegtsRef.current.destroy();
        } catch {
          /* noop */
        }
        mpegtsRef.current = null;
      }
    };
    cleanup();

    const lower = src.toLowerCase();
    const isM3u8 = lower.includes(".m3u8") || lower.includes("mpegurl");
    const isTs = !isM3u8 && (lower.endsWith(".ts") || lower.includes("mpeg-ts"));
    const isMkv = lower.endsWith(".mkv") || lower.includes(".mkv?");
    const isAvi = lower.endsWith(".avi") || lower.includes(".avi?");
    const isMp4 = lower.endsWith(".mp4") || lower.includes(".mp4?");

    const showUnsupported = (reason: string) => {
      setError({ message: reason, url: src });
    };

    // === HLS (live + VOD em m3u8) ===
    if (isM3u8 && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          console.error("HLS fatal error", data);
          showUnsupported("Falha ao carregar o stream HLS.");
        }
      });
      return cleanup;
    }

    // === MPEG-TS / MKV / AVI: tenta mpegts.js (suporta MPEG-TS e em alguns casos containers H.264) ===
    if ((isTs || isMkv || isAvi) && mpegts.getFeatureList().mseLivePlayback) {
      try {
        const player = mpegts.createPlayer(
          {
            type: isTs ? "mpegts" : "mse",
            isLive: false,
            url: src,
          },
          {
            enableWorker: true,
            lazyLoad: false,
            stashInitialSize: 384,
          },
        );
        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();
        if (autoPlay) {
          const p = player.play() as void | Promise<void>;
          if (p && typeof (p as Promise<void>).catch === "function") {
            (p as Promise<void>).catch(() => {});
          }
        }
        let mpegtsFailed = false;
        player.on(mpegts.Events.ERROR, (errType, errDetail) => {
          console.error("mpegts.js error", errType, errDetail);
          if (mpegtsFailed) return;
          mpegtsFailed = true;
          // Fallback: tenta o player nativo
          try {
            player.destroy();
          } catch {
            /* noop */
          }
          mpegtsRef.current = null;
          video.src = src;
          video.play().catch(() => {
            showUnsupported(
              isMkv || isAvi
                ? "Este formato (MKV/AVI) não é suportado pelo navegador."
                : "Não foi possível reproduzir este conteúdo no navegador.",
            );
          });
        });
        return cleanup;
      } catch (e) {
        console.error("mpegts init failed", e);
      }
    }

    // === Player nativo (MP4/WebM ou Safari com HLS nativo) ===
    video.src = src;
    const onErr = () => {
      showUnsupported(
        isMkv || isAvi
          ? "Este formato (MKV/AVI) não é suportado pelo navegador."
          : "Não foi possível reproduzir este conteúdo. Tente abrir em um player externo.",
      );
    };
    video.addEventListener("error", onErr);
    if (autoPlay) {
      video.play().catch(() => {
        if (!isMp4) onErr();
      });
    }

    return () => {
      video.removeEventListener("error", onErr);
      cleanup();
    };
  }, [src, autoPlay]);

  const handleCopy = async () => {
    if (!error) return;
    try {
      await navigator.clipboard.writeText(error.url);
      setCopied(true);
      toast.success("Link copiado! Cole no VLC ou outro player.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

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
      {title && !error && (
        <div className="pointer-events-none absolute left-0 top-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4">
          <h3 className="text-sm font-semibold text-white drop-shadow">{title}</h3>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Não foi possível reproduzir</h3>
              <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Copie o link e abra no VLC, MX Player ou outro player externo.
              </p>
            </div>
            <Button onClick={handleCopy} variant="secondary" size="sm" className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar link"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
