import { Tv, Play, Search } from 'lucide-react'
import { Stream } from '../types/iptv'

interface ChannelGridProps {
  channels: Stream[]
  onSelectChannel: (channel: Stream) => void
  activeCategory: string
}

export const ChannelGrid = ({ channels, onSelectChannel, activeCategory }: ChannelGridProps) => {
  if (channels.length === 0) {
    return (
      <div className="py-32 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
          <Search className="w-8 h-8 text-neutral-600" />
        </div>
        <h3 className="text-xl font-bold text-white tracking-tight">Nenhum canal encontrado</h3>
        <p className="text-neutral-600 max-w-xs">Tente ajustar sua busca ou mudar de categoria.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 gap-6 pb-20">
      {channels.map(s => (
        <button 
          key={s.stream_id} 
          onClick={() => onSelectChannel(s)} 
          className="group flex flex-col gap-3 text-left transition-all duration-500"
        >
          <div className="aspect-video bg-neutral-900 rounded-3xl border border-white/5 group-hover:border-primary group-hover:shadow-glow transition-all overflow-hidden relative shadow-2xl">
            <div className="absolute inset-0 bg-neutral-800 animate-pulse z-0" />
            {s.stream_icon && (
              <img 
                src={s.stream_icon} 
                className="w-full h-full object-contain p-6 relative z-10 group-hover:scale-110 transition-transform duration-500" 
                loading="lazy" 
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center z-[5] text-neutral-700">
              <Tv className="w-12 h-12" />
            </div>
            <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 z-20">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-glow animate-in zoom-in duration-300">
                <Play className="fill-current w-6 h-6 text-white ml-1" />
              </div>
            </div>
          </div>
          <div className="px-2">
            <div className="text-sm font-black text-neutral-400 group-hover:text-white truncate transition-colors">{s.name}</div>
            <div className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mt-1">{s.category_id}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
