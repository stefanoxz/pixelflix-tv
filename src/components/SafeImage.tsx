import { ImgHTMLAttributes, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * <SafeImage> — wrapper de <img> que trata `onError` via estado React
 * em vez de mutar o DOM diretamente. Isso evita o erro
 * "Failed to execute 'removeChild' on 'Node'" durante reconciliação
 * (especialmente em listas com `key` que mudam ou em cross-fades).
 *
 * Modos:
 * - `hide` (padrão): some quando falha (não renderiza nada).
 * - `fade`: aplica opacidade reduzida quando falha (mantém layout).
 */
type Props = ImgHTMLAttributes<HTMLImageElement> & {
  onErrorMode?: "hide" | "fade";
};

export function SafeImage({
  onErrorMode = "hide",
  className,
  src,
  onError,
  ...rest
}: Props) {
  const [errored, setErrored] = useState(false);

  // Reseta o estado se a `src` mudar (ex.: novo item no carrossel).
  useEffect(() => {
    setErrored(false);
  }, [src]);

  if (errored && onErrorMode === "hide") return null;

  return (
    <img
      {...rest}
      src={src}
      className={cn(className, errored && onErrorMode === "fade" && "opacity-20")}
      onError={(e) => {
        setErrored(true);
        onError?.(e);
      }}
    />
  );
}
