import React, { memo, useRef } from 'react';
import { Heart } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Stream } from '../../../types';

interface LiveChannelListProps {
  channels: any[];
  selectedChannel: any | null;
  favorites: string[];
  onSelectChannel: (channel: any) => void;
  onToggleFavorite: (channel: any) => void;
}

export const LiveChannelList = memo(({ channels, selectedChannel, favorites, onSelectChannel, onToggleFavorite }: LiveChannelListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // 64px card + 8px gap approx
    overscan: 10,
  });

  return (
    <div 
      ref={parentRef}
      className="w-80 flex flex-col border-r border-white/5 bg-[#0D0D0D] overflow-y-auto custom-scrollbar flex-shrink-0 relative"
    >
      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-zinc-600 text-center space-y-4">
          <p className="text-[10px] uppercase tracking-widest">Nenhum canal encontrado</p>
        </div>
      ) : (
        <div
          style={{
            height: `${virtualizer.getTotalSize() + 32}px`, // +32 for top/bottom padding
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const channel = channels[virtualItem.index];
            const isSelected = selectedChannel?.id === channel.id;
            const isFav = favorites.includes(String(channel.id));

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start + 16}px)`, // +16 for top padding
                  padding: '0 16px',
                  paddingBottom: '8px'
                }}
              >
                <div 
                  onClick={() => onSelectChannel(channel)}
                  className={`flex items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer transition-all border h-[64px] ${
                    isSelected 
                    ? 'bg-blue-600/10 border-blue-500/20 shadow-[0_0_20px_rgba(37,99,235,0.1)]' 
                    : 'bg-transparent border-transparent hover:bg-white/5'
                  }`}
                >
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(channel);
                    }}
                    className="text-zinc-600 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                  </button>

                  <div className="w-10 h-10 rounded-full bg-white/5 overflow-hidden flex items-center justify-center shrink-0 p-1 border border-white/5">
                    {channel.icon ? (
                      <img loading="lazy" src={channel.icon} alt={channel.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 rounded-full" />
                    )}
                  </div>

                  <span className={`text-[11px] font-black tracking-wider truncate uppercase ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                    {channel.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

LiveChannelList.displayName = 'LiveChannelList';
