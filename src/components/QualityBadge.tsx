import { useEffect, useState, type RefObject } from "react";
import type Hls from "hls.js";

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
 * Chip discreto com a qualidade REAL entregue ao player
 * (4K / 1080p / 720p / 480p / SD), detectada via `videoHeight` do
 * `<video>` com fallback para o nível ativo do hls.js.
 *
 * Componente "puro": renderiza apenas o chip inline; o pai cuida do
 * posicionamento. Isso garante consistência cross-device (desktop,
 * mobile, tablet, TV) sem depender do shadow DOM dos controles nativos.
 *
 * Renderiza `null` enquanto não houver primeiro frame decodificado.
 */
export function QualityBadge({ videoRef, hlsRef }: Props) {
  const [height, setHeight] = useState<number>(0);

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

  const label = labelFor(height);
  if (!label) return null;

  return (
    <span
      className="inline-flex shrink-0 items-center rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/90 backdrop-blur-sm sm:text-xs"
      aria-label={`Qualidade atual: ${label}`}
    >
      {label}
    </span>
  );
}
