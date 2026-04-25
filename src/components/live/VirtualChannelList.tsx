import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Tv } from "lucide-react";
import type { LiveStream, IptvCredentials } from "@/services/iptv";
import { ChannelListItem } from "./ChannelListItem";

interface Props {
  channels: LiveStream[];
  activeId?: number;
  favorites: Set<number>;
  onSelect: (c: LiveStream) => void;
  onToggleFavorite: (id: number) => void;
  creds: IptvCredentials;
  /** Auto-scroll até o canal ativo quando ele mudar (via teclado etc.). */
  autoScrollToActive?: boolean;
  className?: string;
}

const ITEM_HEIGHT = 80; // ~ logo 40 + padding + 2 linhas de texto + barra

/**
 * Lista virtualizada de canais — renderiza só ~20 itens visíveis mesmo com
 * 2000+ canais. EPG é carregado on-demand pelos itens visíveis.
 */
export function VirtualChannelList({
  channels,
  activeId,
  favorites,
  onSelect,
  onToggleFavorite,
  creds,
  autoScrollToActive,
  className,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 6,
  });

  // Auto-scroll quando o canal ativo muda por teclado / categoria.
  useEffect(() => {
    if (!autoScrollToActive || activeId == null) return;
    const idx = channels.findIndex((c) => c.stream_id === activeId);
    if (idx >= 0) rowVirtualizer.scrollToIndex(idx, { align: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, autoScrollToActive, channels.length]);

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
        <Tv className="h-8 w-8 mb-2 opacity-40" />
        Nenhum canal encontrado
      </div>
    );
  }

  return (
    <div ref={parentRef} className={className} style={{ overflow: "auto" }}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const channel = channels[virtualRow.index];
          return (
            <div
              key={channel.stream_id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ChannelListItem
                channel={channel}
                active={channel.stream_id === activeId}
                favorite={favorites.has(channel.stream_id)}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
                creds={creds}
                loadEpg={true}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
