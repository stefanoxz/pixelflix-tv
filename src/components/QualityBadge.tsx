import { useEffect, useState, type RefObject } from "react";
import type Hls from "hls.js";
import { cn } from "@/lib/utils";

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  hlsRef?: RefObject<Hls | null>;
}

function labelFor(height: number): string | null {
  if (!height || height <= 0) return null;
  if (height >= 2160) return "4K";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return "SD";
}

/**
 * Mini chip discreto que mostra a qualidade REAL entregue ao player
 * (4K / 1080p / 720p / 480p / SD), detectada via `videoHeight` do
 * `<video>` com fallback para o nível ativo do hls.js.
 *
 * Posicionado no canto inferior direito (alinhado com a barra nativa
 * de controles). Aparece/some junto com os controles: visível enquanto
 * pausado, em hover, ou em até ~2.5s após movimento do mouse durante
 * a reprodução.
 */
export function QualityBadge({ videoRef, hlsRef }: Props) {
  const [height, setHeight] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(true);

  // Detecta qualidade real
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const read = () => {
      const h = v.videoHeight || 0;
      let hlsHeight = 0;
      try {
        const hls = hlsRef?.current ?? null;
        if (hls && hls.currentLevel >= 0 && hls.levels?.[hls.currentLevel]) {
          hlsHeight = hls.levels[hls.currentLevel].height ?? 0;
        }
      } catch {
        /* noop */
      }
      const next = Math.max(h, hlsHeight);
      setHeight((prev) => (prev === next ? prev : next));
    };

    read();
    v.addEventListener("loadedmetadata", read);
    v.addEventListener("resize", read);
    v.addEventListener("playing", read);

    let hlsBound: Hls | null = null;
    let hlsListener: (() => void) | null = null;
    const tryBindHls = () => {
      const current = hlsRef?.current ?? null;
      if (!current || hlsBound === current) return;
      hlsBound = current;
      hlsListener = () => read();
      current.on("hlsLevelSwitched" as never, hlsListener as never);
    };
    tryBindHls();
    const poll = window.setInterval(() => {
      tryBindHls();
      read();
    }, 1000);
    const stopPoll = window.setTimeout(() => window.clearInterval(poll), 10_000);

    return () => {
      v.removeEventListener("loadedmetadata", read);
      v.removeEventListener("resize", read);
      v.removeEventListener("playing", read);
      window.clearInterval(poll);
      window.clearTimeout(stopPoll);
      if (hlsBound && hlsListener) {
        try {
          hlsBound.off("hlsLevelSwitched" as never, hlsListener as never);
        } catch {
          /* noop */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza visibilidade com a atividade do usuário (imita controles nativos)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const HIDE_AFTER_MS = 2500;
    let hideTimer: number | null = null;

    const clearHide = () => {
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
    };
    const scheduleHide = () => {
      clearHide();
      if (v.paused) return;
      hideTimer = window.setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    };
    const show = () => {
      setVisible(true);
      scheduleHide();
    };
    const onPause = () => {
      clearHide();
      setVisible(true);
    };
    const onPlay = () => {
      setVisible(true);
      scheduleHide();
    };

    const host = v.parentElement ?? v;

    host.addEventListener("mousemove", show);
    host.addEventListener("mouseenter", show);
    host.addEventListener("mouseleave", scheduleHide);
    host.addEventListener("touchstart", show, { passive: true });
    v.addEventListener("pause", onPause);
    v.addEventListener("play", onPlay);
    v.addEventListener("playing", onPlay);

    if (v.paused) {
      setVisible(true);
    } else {
      scheduleHide();
    }

    return () => {
      clearHide();
      host.removeEventListener("mousemove", show);
      host.removeEventListener("mouseenter", show);
      host.removeEventListener("mouseleave", scheduleHide);
      host.removeEventListener("touchstart", show);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("playing", onPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = labelFor(height);
  if (!label) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-12 right-3 z-10 select-none rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white/85 backdrop-blur-sm transition-opacity duration-200 sm:text-xs",
        visible ? "opacity-100" : "opacity-0",
      )}
      aria-label={`Qualidade atual: ${label}`}
    >
      {label}
    </div>
  );
}
