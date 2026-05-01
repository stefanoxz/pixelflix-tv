import { memo } from 'react';
import { Database, Film, Tv, PlayCircle } from 'lucide-react';

interface SyncProgressBarProps {
  progress: number;
}

export const SyncProgressBar = memo(({ progress }: SyncProgressBarProps) => {
  return (
    <>
      <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden mb-8 border border-white/5">
        <div 
          className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500 ease-out shadow-[0_0_20px_rgba(37,99,235,0.5)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-4 w-full mb-12">
        {[
          { icon: Tv, p: 35 },
          { icon: Film, p: 55 },
          { icon: PlayCircle, p: 75 },
          { icon: Database, p: 90 },
        ].map((item, i) => (
          <div key={i} className={`flex flex-col items-center gap-2 transition-all duration-500 ${progress >= item.p ? 'text-blue-500 scale-110' : 'text-zinc-700'}`}>
            <item.icon size={20} />
            <div className={`w-1 h-1 rounded-full ${progress >= item.p ? 'bg-blue-500' : 'bg-zinc-800'}`} />
          </div>
        ))}
      </div>
    </>
  );
});

SyncProgressBar.displayName = 'SyncProgressBar';
