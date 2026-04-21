import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Tv, AlertTriangle, Copy, Check, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isExternalOnly, normalizeExt } from "@/services/iptv";

interface PlayerProps {
  src?: string | null;
  rawUrl?: string;
  containerExt?: string;
  poster?: string;
  title?: string;
  autoPlay?: boolean;
  onClose?: () => void;
}

type PlayerMode = "idle" | "hls" | "native" | "proxy";

type PlayerError = {
  message: string;
  url: string;
  title?: string;
  description?: string;
  external?: boolean;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROXY_BASE = `${SUPABASE_URL}/functions/v1/stream-proxy?url=`;

function detectType(url = "") {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".m3u8") || clean.includes("mpegurl")) return "hls";
  if (clean.endsWith(".mp4")) return "mp4";
  if (clean.endsWith(".webm")) return "webm";
  if (
    clean.endsWith(".mkv") ||
    clean.endsWith(".avi") ||
    clean.endsWith(".mov") ||
    clean.endsWith(".ts")
  ) {
    return "unsupported-container";
  }
  return "unknown";
}

const buildProxyUrl = (u: string) => `${PROXY_BASE}${encodeURIComponent(u)}`;

export function Player({
  src,
  rawUrl,
  containerExt,
  poster,
  title,
  autoPlay = true,
  onClose,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [mode, setMode] = useState<PlayerMode>("idle");
  const [finalUrl, setFinalUrl] = useState<string>("");
  const [error, setError] = useState<PlayerError | null>(null);
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Proactive detection: skip loading entirely for MKV/AVI/MOV
  const externalOnly = useMemo(() => isExternalOnly(containerExt), [containerExt]);
  const copyTarget = rawUrl || src || "";

  // Step 1: decide mode + finalUrl based on source URL
  useEffect(() => {
    if (!src) {
      setMode("idle");
      setFinalUrl("");
      return;
    }

    setError(null);
    setCopied(false);
    setHidden(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Proactive: incompatible container — show overlay immediately, do not attach
    if (externalOnly) {
      const ext = normalizeExt(containerExt).toUpperCase();
      console.log(`⛔ Container ${ext} não suportado — mostrando opção externa direto`);
      setMode("idle");
      setFinalUrl("");
      setError({
        title: "Formato não suportado no navegador",
        description: `Este conteúdo usa um container (${ext}) que não é compatível com reprodução web.`,
        message: "",
        url: copyTarget,
        external: true,
      });
      return;
    }

    const type = detectType(src);
    console.log("🎬 URL:", src);
    console.log("📦 Tipo detectado:", type);

    if (type === "hls") {
      console.log("✅ Usando HLS (hls.js) via proxy");
      setMode("hls");
      setFinalUrl(buildProxyUrl(src));
    } else if (type === "mp4" || type === "webm") {
      console.log("✅ Usando player nativo via proxy");
      setMode("native");
      setFinalUrl(buildProxyUrl(src));
    } else {
      console.log("⚠️ Container possivelmente não suportado → tentando via proxy");
      setMode("proxy");
      setFinalUrl(buildProxyUrl(src));
    }
  }, [src, externalOnly, containerExt, copyTarget]);

  // Step 2: attach the source to the <video> when finalUrl/mode change
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !finalUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const showUnsupported = (reason: string) => {
      setError({ message: reason, url: src ?? finalUrl });
    };

    if (mode === "hls") {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.loadSource(finalUrl);
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
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = finalUrl;
        if (autoPlay) video.play().catch(() => {});
      } else {
        showUnsupported("Seu navegador não suporta HLS.");
      }
      return;
    }

    // native / proxy: just set src and let the browser try
    video.src = finalUrl;
    const onErr = () => {
      const isUnsupported = mode === "proxy";
      showUnsupported(
        isUnsupported
          ? "Este formato não é suportado pelo navegador. Abra em um player externo."
          : "Não foi possível reproduzir este conteúdo.",
      );
    };
    video.addEventListener("error", onErr);
    if (autoPlay) {
      video.play().catch(() => {
        // ignore — error event will fire if truly unsupported
      });
    }

    return () => {
      video.removeEventListener("error", onErr);
    };
  }, [finalUrl, mode, autoPlay, src]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  const handleCopy = async () => {
    const target = error?.url || copyTarget;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      toast.success("Link copiado — abra no VLC ou MX Player");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const handleRetry = () => {
    if (!src || externalOnly) return;
    console.log("🔁 Tentando novamente via proxy");
    setError(null);
    setMode("proxy");
    setFinalUrl(buildProxyUrl(src) + `&_t=${Date.now()}`);
  };

  const handleClose = () => {
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {
        /* noop */
      }
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (onClose) onClose();
    else setHidden(true);
  };

  if (!src || hidden) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-card flex items-center justify-center shadow-card">
        <div className="absolute inset-0 bg-gradient-glow opacity-50" />
        <div className="relative z-10 text-center p-8">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Tv className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            {hidden ? "Reprodução encerrada" : "Selecione um canal"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {hidden
              ? "Escolha outro conteúdo para continuar"
              : "Escolha um canal, filme ou série para começar a assistir"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-card animate-scale-in">
      {!externalOnly && (
        <video
          ref={videoRef}
          className="h-full w-full"
          controls
          playsInline
          poster={poster}
        />
      )}
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
              <h3 className="text-lg font-semibold text-foreground">
                {error.title || "Não foi possível reproduzir"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {error.description || error.message}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Copie o link e abra no VLC, MX Player ou outro player externo.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {error.external ? (
                <>
                  <Button onClick={handleCopy} variant="default" size="sm" className="gap-2">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar link para VLC"}
                  </Button>
                  <Button onClick={handleClose} variant="outline" size="sm" className="gap-2">
                    <X className="h-4 w-4" />
                    Fechar
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleRetry} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Tentar novamente
                  </Button>
                  <Button onClick={handleCopy} variant="secondary" size="sm" className="gap-2">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar link"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
