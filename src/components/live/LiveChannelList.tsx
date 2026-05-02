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
                  className={`flex items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer transition-all border h-[72px] group relative overflow-hidden ${
                    isSelected 
                    ? 'bg-purple-600/10 border-purple-500/30 shadow-[0_0_25px_rgba(168,85,247,0.15)]' 
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                  }`}
                >
                  {/* Active Indicator Glow */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 shadow-[0_0_15px_#a855f7]" />
                  )}

                  <div className="w-12 h-12 rounded-xl bg-[#151515] overflow-hidden flex items-center justify-center shrink-0 p-1.5 border border-white/5 group-hover:border-purple-500/30 transition-colors">
                    {channel.icon ? (
                      <img loading="lazy" src={channel.icon} alt={channel.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg opacity-80" />
                    )}
                  </div>
 
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className={`text-[12px] font-bold tracking-wide truncate ${isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                      {channel.name}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-medium truncate uppercase tracking-widest opacity-60">
                      {channel.category_name || 'Canais ao Vivo'}
                    </span>
                    <div className="w-full h-0.5 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                      <div className={`h-full ${isSelected ? 'bg-purple-500' : 'bg-zinc-700'} rounded-full`} style={{ width: '45%' }} />
                    </div>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(channel);
                    }}
                    className={`transition-all shrink-0 ${isFav ? 'text-purple-500' : 'text-zinc-700 hover:text-purple-400 opacity-0 group-hover:opacity-100'}`}
                  >
                    <Heart size={16} className={isFav ? 'fill-purple-500' : ''} />
                  </button>
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
