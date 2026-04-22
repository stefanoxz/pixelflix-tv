import { useEffect, useMemo, useRef, useState } from "react";
import Hls, { type ErrorData } from "hls.js";
import { Tv, AlertTriangle, Copy, Check, RefreshCw, X, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getPlaybackStrategy,
  isValidStreamUrl,
  normalizeExt,
  requestStreamToken,
  reportStreamEvent,
  type PlaybackStrategy,
} from "@/services/iptv";
import { useIptv } from "@/context/IptvContext";

interface PlayerProps {
  /** URL bruta do stream (sem proxy). Player se encarrega de obter token. */
  src?: string | null;
  /** Mantido para compat — mesma URL crua copiada/aberta externamente. */
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
  copyUrl: string;
  external?: boolean;
};

const HLS_CONFIG: Partial<Hls["config"]> = {
  lowLatencyMode: true,
  enableWorker: true,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
};

const HEARTBEAT_INTERVAL_MS = 45_000;

export function Player({
  src,
  rawUrl,
  containerExt,
  poster,
  title,
  autoPlay = true,
  onClose,
}: PlayerProps) {
  const { session } = useIptv();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const stallTimeoutRef = useRef<number | null>(null);
  const engagedRef = useRef(false);

  const [error, setError] = useState<PlayerError | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(false);

  const copyTarget = rawUrl || src || "";

  const strategy = useMemo<PlaybackStrategy>(() => {
    if (!src) return { mode: "error", reason: "Nenhum stream selecionado" };
    return getPlaybackStrategy(containerExt, rawUrl || src);
  }, [src, rawUrl, containerExt]);

  const teardown = () => {
    const v = videoRef.current;
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch { /* noop */ }
      hlsRef.current = null;
    }
    if (v) {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch { /* noop */ }
    }
    if (heartbeatRef.current !== null) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  // Setup whenever src/strategy changes — debounced 250ms to absorb fast zapping.
  useEffect(() => {
    let cancelled = false;
    let didSetup = false;

    const debounceMs = 250;
    const debounceTimer = window.setTimeout(() => {
      didSetup = true;
      runSetup();
    }, debounceMs);

    const runSetup = () => {
      teardown();
      setError(null);
      setCopied(false);
      setHidden(false);
      retryCountRef.current = 0;

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

      const start = async () => {
        try {
          const kind = strategy.type === "hls" ? "playlist" : "segment";
          const tokenResp = await requestStreamToken({
            url: src,
            kind,
            iptvUsername: session?.creds.username,
          });
          if (cancelled) return;
          const safeSrc = tokenResp.url;

          // Heartbeat (renew session lifecycle on backend every 45s)
          heartbeatRef.current = window.setInterval(() => {
            reportStreamEvent("session_heartbeat");
          }, HEARTBEAT_INTERVAL_MS);

          if (strategy.type === "hls") {
            if (Hls.isSupported()) {
              const hls = new Hls(HLS_CONFIG);
              hlsRef.current = hls;

              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (cancelled) return;
                setLoading(false);
                reportStreamEvent("stream_started", { url: src, meta: { kind: "hls" } });
                if (autoPlay) video.play().catch(() => {});
              });

              hls.on(Hls.Events.ERROR, (_evt, data: ErrorData) => {
                if (!data.fatal) return;
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCountRef.current < 3) {
                  retryCountRef.current += 1;
                  setTimeout(() => {
                    try { hls.startLoad(); } catch { /* noop */ }
                  }, 2000 * retryCountRef.current);
                  return;
                }
                if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retryCountRef.current < 3) {
                  retryCountRef.current += 1;
                  try { hls.recoverMediaError(); return; } catch { /* fallthrough */ }
                }
                setLoading(false);
                setError({
                  title: "Falha ao carregar o stream",
                  description: "O canal pode estar offline ou instável. Tente novamente em alguns segundos.",
                  copyUrl: copyTarget,
                });
                reportStreamEvent("stream_error", {
                  url: src,
                  meta: { type: data.type, details: data.details },
                });
              });

              hls.loadSource(safeSrc);
              hls.attachMedia(video);
              return;
            }

            if (video.canPlayType("application/vnd.apple.mpegurl")) {
              video.src = safeSrc;
              reportStreamEvent("stream_started", { url: src, meta: { kind: "hls-native" } });
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

          // Native (mp4 / webm)
          video.src = safeSrc;
          reportStreamEvent("stream_started", { url: src, meta: { kind: "native" } });
          if (autoPlay) video.play().catch(() => {});
        } catch (err) {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          setLoading(false);
          const blocked = /blocked|bloque/i.test(msg);
          const ratelimit = /Too many|429/i.test(msg);
          setError({
            title: blocked
              ? "Acesso temporariamente bloqueado"
              : ratelimit
                ? "Limite de uso atingido"
                : "Não foi possível autorizar o stream",
            description: blocked
              ? "Detectamos atividade incomum. Tente novamente em alguns minutos."
              : ratelimit
                ? "Aguarde 1 minuto antes de tentar novamente."
                : msg,
            copyUrl: copyTarget,
          });
        }
      };

      start();
    };

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      if (!didSetup) {
        // Cancelled before materializing — avoid teardown/setup churn during zapping.
        reportStreamEvent("stream_error", {
          url: src ?? undefined,
          meta: { reason: "player_switch_debounced" },
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, strategy, containerExt, autoPlay, copyTarget]);

  // Native <video> listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onCanPlay = () => setLoading(false);
    const onLoadedData = () => setLoading(false);
    const onStalled = () => setLoading(true);
    const onError = () => {
      setError((prev) =>
        prev ? prev : {
          title: "Não foi possível reproduzir",
          description: "Este conteúdo pode estar offline, em formato incompatível ou bloqueado pelo servidor.",
          copyUrl: copyTarget,
        });
      setLoading(false);
    };

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("error", onError);
    };
  }, [copyTarget]);

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
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const handleRetry = () => {
    if (!src) return;
    setError(null);
    retryCountRef.current = 0;
    // Force the setup effect to re-run by quickly toggling teardown.
    setLoading(true);
    teardown();
    // Re-trigger via no-op state change: change "hidden" then back.
    setHidden(true);
    setTimeout(() => setHidden(false), 30);
  };

  const handleClose = () => {
    teardown();
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
            {hidden ? "Escolha outro conteúdo para continuar" : "Escolha um canal, filme ou série para começar a assistir"}
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

      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-xs text-white/80">Conectando…</p>
          </div>
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
