import React, { memo, useRef, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface LiveChannelListProps {
  channels: any[];
  selectedChannel: any | null;
  favorites: string[];
  currentProgramTitle?: string | null;
  onSelectChannel: (channel: any) => void;
  onToggleFavorite: (channel: any) => void;
}

export const LiveChannelList = memo(({ 
  channels, 
  selectedChannel, 
  favorites, 
  currentProgramTitle,
  onSelectChannel, 
  onToggleFavorite 
}: LiveChannelListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92, // Accurate height including padding
    overscan: 15,
  });

  // Safe scroll to selected channel
  React.useEffect(() => {
    if (selectedChannel && channels.length > 0) {
      const index = channels.findIndex(c => String(c.id) === String(selectedChannel.id));
      if (index !== -1) {
        // Use a small timeout to ensure the DOM is ready
        const timer = setTimeout(() => {
          virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedChannel?.id, channels.length, virtualizer]);

  return (
    <div 
      ref={parentRef}
      className="w-96 min-w-[384px] flex flex-col border-r border-white/5 bg-[#080808] overflow-y-auto custom-scrollbar flex-shrink-0 relative z-30"
    >
      {/* Decorative vertical line */}
      <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-purple-500/20 to-transparent z-20" />
      
      {channels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-center space-y-4 px-8">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 italic">Nenhum canal encontrado</p>
        </div>
      ) : (
        <div
          style={{
            height: `${virtualizer.getTotalSize() + 48}px`,
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
                  transform: `translateY(${virtualItem.start + 24}px)`,
                  padding: '0 24px',
                  paddingBottom: '12px'
                }}
              >
                <div 
                  onClick={() => onSelectChannel(channel)}
                  className={`flex items-center gap-5 px-5 py-4 rounded-[32px] cursor-pointer transition-all duration-500 border group relative overflow-hidden h-[80px] ${
                    isSelected 
                    ? 'bg-purple-600/15 border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.2)] scale-[1.02] z-10' 
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                  }`}
                >
                  {/* Glassmorphism Flare */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-transparent animate-pulse" />
                  )}

                  <div className="w-14 h-14 rounded-2xl bg-[#0F0F0F] overflow-hidden flex items-center justify-center shrink-0 p-2.5 border border-white/5 group-hover:border-purple-500/40 transition-all group-hover:scale-105 shadow-xl">
                    {channel.icon ? (
                      <img loading="lazy" src={channel.icon} alt={channel.name} className="w-full h-full object-contain drop-shadow-2xl" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600/30 to-purple-900/30 rounded-xl flex items-center justify-center">
                        <span className="text-[10px] font-black text-white/30">{channel.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
 
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5 relative z-10">
                    <span className={`text-[14px] font-black tracking-tight truncate leading-none ${isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                      {channel.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#a855f7]" />}
                      <span className={`text-[9px] font-black truncate uppercase tracking-[0.2em] ${isSelected ? 'text-purple-400' : 'text-zinc-500 opacity-70'}`}>
                        {isSelected && currentProgramTitle ? currentProgramTitle : (channel.epg_title || channel.now_playing || 'AO VIVO')}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(channel);
                    }}
                    className={`transition-all duration-300 shrink-0 relative z-20 ${isFav ? 'text-purple-500 scale-125' : 'text-zinc-800 hover:text-purple-400 opacity-0 group-hover:opacity-100'}`}
                  >
                    <Heart size={20} className={isFav ? 'fill-purple-500' : ''} />
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
