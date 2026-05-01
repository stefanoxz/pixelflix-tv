import { memo } from 'react';
import { Heart } from 'lucide-react';
import { Stream } from '../../../types';

interface LiveChannelListProps {
  channels: any[];
  selectedChannel: any | null;
  favorites: string[];
  onSelectChannel: (channel: any) => void;
  onToggleFavorite: (channel: any) => void;
}

export const LiveChannelList = memo(({ channels, selectedChannel, favorites, onSelectChannel, onToggleFavorite }: LiveChannelListProps) => {
  return (
    <div className="w-80 flex flex-col border-r border-white/5 bg-[#0D0D0D] p-4 gap-2 overflow-y-auto custom-scrollbar flex-shrink-0">
      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-center space-y-4">
          <p className="text-[10px] uppercase tracking-widest">Nenhum canal encontrado</p>
        </div>
      ) : (
        channels.map((channel) => {
          const isSelected = selectedChannel?.id === channel.id;
          const isFav = favorites.includes(String(channel.id));

          return (
            <div 
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={`flex items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer transition-all border ${
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
                  <img src={channel.icon} alt={channel.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 rounded-full" />
                )}
              </div>

              <span className={`text-[11px] font-black tracking-wider truncate uppercase ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                {channel.name}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
});

LiveChannelList.displayName = 'LiveChannelList';
