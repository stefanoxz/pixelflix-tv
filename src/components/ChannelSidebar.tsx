import { forwardRef } from "react";
import { Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { proxyImageUrl, type LiveStream } from "@/services/iptv";

interface ChannelSidebarProps {
  channels: LiveStream[];
  activeId?: number;
  onSelect: (channel: LiveStream) => void;
}

export const ChannelSidebar = forwardRef<HTMLElement, ChannelSidebarProps>(
  function ChannelSidebar({ channels, activeId, onSelect }, ref) {
    return (
      <aside
        ref={ref}
        className="w-full lg:w-80 lg:shrink-0 rounded-lg bg-card border border-border/50 overflow-hidden"
      >
        <div className="p-4 border-b border-border/50">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Tv className="h-4 w-4 text-primary" />
            Canais ({channels.length})
          </h2>
        </div>
        <div className="max-h-[60vh] lg:max-h-[70vh] overflow-y-auto">
          {channels.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum canal disponível
            </div>
          ) : (
            channels.map((ch) => (
              <button
                key={ch.stream_id}
                onClick={() => onSelect(ch)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 text-left border-b border-border/30 transition-smooth",
                  activeId === ch.stream_id
                    ? "bg-primary/15 border-l-4 border-l-primary"
                    : "hover:bg-secondary/50"
                )}
              >
                <div className="h-10 w-10 shrink-0 rounded bg-secondary overflow-hidden flex items-center justify-center">
                  {ch.stream_icon ? (
                    <img
                      src={proxyImageUrl(ch.stream_icon)}
                      alt={ch.name}
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Tv className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium truncate",
                      activeId === ch.stream_id ? "text-primary" : "text-foreground"
                    )}
                  >
                    {ch.name}
                  </p>
                  <p className="text-xs text-muted-foreground">Canal {ch.num}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    );
  }
);
