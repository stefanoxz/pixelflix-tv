import { useState, useEffect } from "react";
import { proxyImageUrl } from "@/services/iptv";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface IPTVImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | null | undefined;
  width?: number;
  height?: number;
  quality?: number;
  fallbackIcon?: React.ReactNode;
}

export function IPTVImage({
  src,
  width,
  height,
  quality,
  className,
  fallbackIcon,
  ...props
}: IPTVImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const proxiedSrc = src ? proxyImageUrl(src, { w: width, h: height, q: quality }) : "";

  useEffect(() => {
    if (!src) {
      setError(true);
      return;
    }
    setLoaded(false);
    setError(false);
  }, [src]);

  if (error || !src) {
    return (
      <div className={cn("flex items-center justify-center bg-secondary/30", className)} style={{ width, height }}>
        {fallbackIcon || <span className="text-muted-foreground opacity-20">No Image</span>}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" style={{ width, height }}>
      {!loaded && !error && <Skeleton className={cn("absolute inset-0 z-0", className)} />}
      <img
        src={proxiedSrc}
        className={cn(
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
        {...props}
      />
    </div>
  );
}
