import { Play } from 'lucide-react';

const STREAMINGS = [
  { name: 'Netflix', bg: '#FFFFFF', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg' },
  { name: 'Prime Video', bg: '#FFFFFF', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png' },
  { name: 'Apple TV+', bg: '#000000', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg' },
  { name: 'Crunchyroll', bg: '#F47521', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Crunchyroll_Logo.svg' },
  { name: 'Disney+', bg: '#0E47A1', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg' },
  { name: 'Globoplay', bg: '#000000', logo: 'https://logodownload.org/wp-content/uploads/2018/12/globoplay-logo-2.png' },
  { name: 'HBO Max', bg: '#000000', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg' },
  { name: 'Paramount+', bg: '#0064FF', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus.svg' },
];

export const StreamingRow = () => {
  return (
    <section className="mt-10">
      <h3 className="flex items-center gap-2 text-base font-bold text-white mb-4">
        <Play size={16} className="text-purple-500 fill-purple-500" />
        Escolha seu Streaming
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {STREAMINGS.map((s) => (
          <button
            key={s.name}
            className="shrink-0 w-32 h-16 rounded-xl flex items-center justify-center border border-white/10 hover:border-purple-500/50 hover:scale-105 transition-all overflow-hidden p-3"
            style={{ backgroundColor: s.bg }}
            aria-label={s.name}
          >
            <img
              src={s.logo}
              alt={s.name}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </section>
  );
};
