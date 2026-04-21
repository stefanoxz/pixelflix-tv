import { useEffect, useMemo, useRef, useState } from "react";
import Hls, { type ErrorData } from "hls.js";
import { Tv, AlertTriangle, Copy, Check, RefreshCw, X, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getPlaybackStrategy,
  isValidStreamUrl,
  normalizeExt,
  proxyUrl,
  type PlaybackStrategy,
} from "@/services/iptv";

interface PlayerProps {
  /**
   * URL do stream. Pode vir crua ou já proxiada — o Player garante
   * internamente que SEMPRE passe pelo proxy antes de tocar.
   */
  src?: string | null;
  /** URL "crua" do stream — usada pra copiar pro VLC / abrir externo. */
  rawUrl?: string;
  /** Extensão do container (mp4, m3u8, mkv, etc). */
  containerExt?: string;
  poster?: string;
  title?: string;
  autoPlay?: boolean;
  onClose?: () => void;
}

type PlayerError = {
  title?: string;
  description?: string;
  /** URL pra copiar (sempre a rawUrl quando disponível). */
  copyUrl: string;
  /** Se true, é um caso de "abrir em player externo" (não erro real). */
  external?: boolean;
};

const HLS_CONFIG: Partial<Hls["config"]> = {
  lowLatencyMode: true,
  enableWorker: true,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
};

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

  const [error, setError] = useState<PlayerError | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(false);

  const copyTarget = rawUrl || src || "";

  // Garante que TODA reprodução passe pelo proxy da VPS.
  // Se já vier proxiada (contém "/stream-proxy/"), reaproveita pra evitar duplo-proxy.
  const safeSrc = useMemo(() => {
    if (!src) return null;
    return src.includes("/stream-proxy/") ? src : proxyUrl(src);
  }, [src]);

  // Decide a estratégia de reprodução com base na extensão + URL crua
  const strategy = useMemo<PlaybackStrategy>(() => {
    if (!src) return { mode: "error", reason: "Nenhum stream selecionado" };
    return getPlaybackStrategy(containerExt, rawUrl || src);
  }, [src, rawUrl, containerExt]);

  // Cleanup central — destrói HLS e libera o <video>
  const teardown = () => {
    const v = videoRef.current;
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        /* noop */
      }
      hlsRef.current = null;
    }
    if (v) {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {
        /* noop */
      }
    }
  };

  // Setup do player sempre que muda src/strategy
  useEffect(() => {
    teardown();
    setError(null);
    setCopied(false);
    setHidden(false);

    if (!src) {
      setLoading(false);
      return;
    }

    if (!isValidStreamUrl(src)) {
      setError({
        title: "URL inválida",
        description: "Não foi possível reproduzir este conteúdo (URL malformada).",
        copyUrl: copyTarget,
      });
      setLoading(false);
      return;
    }

    // Container que o navegador não toca → atalho direto pra player externo
    if (strategy.mode === "external") {
      const ext = normalizeExt(containerExt).toUpperCase() || "?";
      setError({
        title: "Formato não suportado no navegador",
        description: `Este conteúdo usa um container (${ext}) que não é compatível com reprodução web.`,
        copyUrl: copyTarget,
        external: true,
      });
      setLoading(false);
      return;
    }

    if (strategy.mode === "error") {
      setError({
        title: "Não foi possível reproduzir",
        description: strategy.reason,
        copyUrl: copyTarget,
      });
      setLoading(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    setLoading(true);

    // Estratégia HLS: usa hls.js, ou Safari nativo
    if (strategy.type === "hls") {
      if (Hls.isSupported()) {
        const hls = new Hls(HLS_CONFIG);
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          if (autoPlay) video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_evt, data: ErrorData) => {
          if (!data.fatal) return;
          // Tenta recuperar erros não-fatais de rede/mídia antes de desistir
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            try {
              hls.startLoad();
              return;
            } catch {
              /* fallthrough */
            }
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            try {
              hls.recoverMediaError();
              return;
            } catch {
              /* fallthrough */
            }
          }
          setLoading(false);
          setError({
            title: "Falha ao carregar o stream",
            description: "O canal pode estar offline ou instável. Tente novamente em alguns segundos.",
            copyUrl: copyTarget,
          });
        });

        try {
          hls.loadSource(src);
          hls.attachMedia(video);
        } catch {
          setLoading(false);
          setError({
            title: "Erro ao iniciar player",
            description: "Não foi possível inicializar o stream HLS.",
            copyUrl: copyTarget,
          });
        }
        return;
      }

      // Safari / iOS: HLS nativo
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        if (autoPlay) video.play().catch(() => {});
        return;
      }

      setLoading(false);
      setError({
        title: "Navegador incompatível",
        description: "Seu navegador não suporta HLS. Use Chrome, Firefox, Edge ou Safari.",
        copyUrl: copyTarget,
      });
      return;
    }

    // Player nativo (mp4/webm/desconhecido)
    video.src = src;
    if (autoPlay) {
      video.play().catch(() => {
        // Erro de play será capturado pelo listener 'error' abaixo
      });
    }
  }, [src, strategy, containerExt, autoPlay, copyTarget]);

  // Listeners do <video> pra loading + erro nativo
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onCanPlay = () => setLoading(false);
    const onLoadedData = () => setLoading(false);
    const onError = () => {
      // Se já tem erro definido (HLS / inválido), não sobrescreve
      setError((prev) =>
        prev
          ? prev
          : {
              title: "Não foi possível reproduzir",
              description:
                "Este conteúdo pode estar offline, em formato incompatível ou bloqueado pelo servidor.",
              copyUrl: copyTarget,
            },
      );
      setLoading(false);
    };

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("error", onError);
    };
  }, [copyTarget]);

  // Cleanup final ao desmontar
  useEffect(() => () => teardown(), []);

  const handleCopy = async () => {
    const target = error?.copyUrl || copyTarget;
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

  const handleOpenExternal = () => {
    const target = error?.copyUrl || copyTarget;
    if (!target) return;
    // Tenta abrir num player externo via protocol handler do sistema
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const handleRetry = () => {
    if (!src) return;
    setError(null);
    setLoading(true);
    // Força reload mantendo a mesma estratégia
    const video = videoRef.current;
    teardown();
    if (!video) return;
    setTimeout(() => {
      // Re-aciona o effect ajustando uma key implícita via reload do src
      if (strategy.mode === "internal" && strategy.type === "hls" && Hls.isSupported()) {
        const hls = new Hls(HLS_CONFIG);
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          video.play().catch(() => {});
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        video.src = src;
        video.play().catch(() => {});
      }
    }, 100);
  };

  const handleClose = () => {
    teardown();
    if (onClose) onClose();
    else setHidden(true);
  };

  // Estado vazio (nenhum stream selecionado)
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

  const showVideo = strategy.mode === "internal" && (!error || !error.external);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-card animate-scale-in">
      {showVideo && (
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

      {/* Loading overlay (não bloqueia controles) */}
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-xs text-white/80">Carregando stream...</p>
          </div>
        </div>
      )}

      {/* Erro / formato externo */}
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
              {error.description && (
                <p className="mt-1 text-sm text-muted-foreground">{error.description}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Copie o link e abra no VLC, MX Player ou outro player externo.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {error.external ? (
                <>
                  <Button onClick={handleOpenExternal} variant="default" size="sm" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Abrir em player externo
                  </Button>
                  <Button onClick={handleCopy} variant="secondary" size="sm" className="gap-2">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar link"}
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
