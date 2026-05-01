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
    <section className="mt-16">
      <div className="flex items-center justify-between mb-6">
        <h3 className="flex items-center gap-3 text-lg font-black text-white uppercase tracking-tighter italic">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          Escolha seu Streaming
        </h3>
        <div className="h-[1px] flex-1 bg-white/5 ml-6" />
      </div>
      
      <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar scroll-smooth">
        {STREAMINGS.map((s) => (
          <button
            key={s.name}
            className="group relative shrink-0 w-40 h-24 rounded-2xl flex items-center justify-center border border-white/5 hover:border-primary/50 transition-all duration-500 overflow-hidden p-6 bg-[#0A0A0A] shadow-lg hover:shadow-primary/10"
            aria-label={s.name}
          >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} style={{ backgroundColor: s.bg }} />
            <img
              src={s.logo}
              alt={s.name}
              className="relative z-10 max-h-full max-w-full object-contain filter brightness-100 group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </section>
  );
};
