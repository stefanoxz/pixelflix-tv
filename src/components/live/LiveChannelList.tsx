import React, { memo, useRef } from 'react';
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
    estimateSize: () => 80,
    overscan: 10,
  });

  // Auto-scroll to selected channel on mount or selection change
  React.useEffect(() => {
    if (selectedChannel && channels.length > 0) {
      const index = channels.findIndex(c => String(c.id) === String(selectedChannel.id));
      if (index !== -1) {
        virtualizer.scrollToIndex(index, { align: 'center' });
      }
    }
  }, [selectedChannel?.id, channels.length, virtualizer]);

  return (
    <div 
      ref={parentRef}
      className="w-96 flex flex-col border-r border-white/5 bg-[#080808] overflow-y-auto custom-scrollbar flex-shrink-0 relative z-10"
    >
      <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-purple-500/10 to-transparent" />
      
      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-zinc-600 text-center space-y-4 px-8">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Nenhum canal encontrado</p>
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
                  className={`flex items-center gap-5 px-5 py-4 rounded-3xl cursor-pointer transition-all duration-300 border group relative overflow-hidden h-20 ${
                    isSelected 
                    ? 'bg-purple-600/10 border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.15)] scale-[1.02]' 
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-white/10'
                  }`}
                >
                  {/* Active Indicator */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500 shadow-[0_0_20px_#a855f7]" />
                  )}

                  <div className="w-14 h-14 rounded-2xl bg-[#121212] overflow-hidden flex items-center justify-center shrink-0 p-2 border border-white/5 group-hover:border-purple-500/30 transition-all group-hover:scale-105">
                    {channel.icon ? (
                      <img loading="lazy" src={channel.icon} alt={channel.name} className="w-full h-full object-contain drop-shadow-lg" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600/50 to-purple-900/50 rounded-xl flex items-center justify-center">
                        <span className="text-[10px] font-black text-white/40">{channel.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
 
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <span className={`text-[13px] font-black tracking-tight truncate leading-none ${isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                      {channel.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-black truncate uppercase tracking-[0.15em] ${isSelected ? 'text-purple-400' : 'text-zinc-500 opacity-60'}`}>
                        {isSelected && currentProgramTitle ? currentProgramTitle : (channel.epg_title || channel.now_playing || channel.category_name || 'AO VIVO')}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full shadow-[0_0_10px_#a855f7] transition-all duration-1000" style={{ width: '65%' }} />
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(channel);
                    }}
                    className={`transition-all duration-300 shrink-0 ${isFav ? 'text-purple-500 scale-110' : 'text-zinc-800 hover:text-purple-400 opacity-0 group-hover:opacity-100'}`}
                  >
                    <Heart size={18} className={isFav ? 'fill-purple-500' : ''} />
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
