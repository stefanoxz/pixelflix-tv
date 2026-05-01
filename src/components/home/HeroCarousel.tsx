import { useEffect, useState } from 'react';
import { Play, Info, Star, Calendar, Tag } from 'lucide-react';

interface HeroSlide {
  id: string;
  title: string;
  type: string;
  date: string;
  rating: string;
  genre: string;
  synopsis: string;
  backdrop: string;
}

const SLIDES: HeroSlide[] = [
  {
    id: '1',
    title: 'MARRIAGETOXIN',
    type: 'Série',
    date: '07/04/2026',
    rating: '4.1',
    genre: 'Animação',
    synopsis:
      'Um assassino de aluguel e uma vigarista de casamentos se lançam na batalha mais difícil do mundo pelo casamento! Gero é um jovem de um clã de assassinos de aluguel que existe há centenas de anos…',
    backdrop:
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1600&h=700&fit=crop',
  },
  {
    id: '2',
    title: 'NEON HORIZON',
    type: 'Filme',
    date: '12/03/2026',
    rating: '4.7',
    genre: 'Ficção',
    synopsis:
      'Em um futuro próximo, dois hackers descobrem uma conspiração que ameaça a realidade tal como conhecemos.',
    backdrop:
      'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1600&h=700&fit=crop',
  },
  {
    id: '3',
    title: 'CRIMSON CODE',
    type: 'Série',
    date: '20/05/2026',
    rating: '4.5',
    genre: 'Suspense',
    synopsis:
      'Uma equipe de investigadores cibernéticos persegue uma organização secreta por toda a Europa.',
    backdrop:
      'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1600&h=700&fit=crop',
  },
];

export const HeroCarousel = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((p) => (p + 1) % SLIDES.length), 6000);
    return () => clearInterval(id);
  }, []);

  const slide = SLIDES[active];

  return (
    <section className="relative w-full h-[420px] md:h-[520px] rounded-[var(--radius)] overflow-hidden border border-white/5 shadow-2xl group">
      {SLIDES.map((s, idx) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${idx === active ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden={idx !== active}
        >
          <img src={s.backdrop} alt={s.title} className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[10s] ease-linear" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
        </div>
      ))}

      <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-16 max-w-3xl">
        <div className="flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-left duration-700">
           <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-full border border-primary/20 uppercase tracking-widest">Destaque da Semana</span>
        </div>
        
        <h2 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-[0.9] drop-shadow-2xl animate-in fade-in slide-in-from-bottom duration-1000">
          {slide.title}
        </h2>

        <div className="flex flex-wrap items-center gap-6 mb-6 text-xs font-bold text-zinc-400 animate-in fade-in slide-in-from-bottom duration-700 delay-200">
          <span className="flex items-center gap-2"><Calendar size={14} className="text-primary" /> {slide.date}</span>
          <span className="flex items-center gap-2"><Star size={14} className="text-yellow-500 fill-yellow-500" /> {slide.rating}</span>
          <span className="flex items-center gap-2"><Tag size={14} className="text-primary" /> {slide.genre}</span>
        </div>

        <p className="text-base text-zinc-400 mb-8 leading-relaxed line-clamp-2 md:line-clamp-3 max-w-2xl animate-in fade-in slide-in-from-bottom duration-700 delay-300">
          {slide.synopsis}
        </p>

        <div className="flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-bottom duration-700 delay-500">
          <button className="flex items-center gap-3 bg-primary text-primary-foreground px-10 py-4 rounded-full font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/30">
            <Play size={20} className="fill-current" /> ASSISTIR AGORA
          </button>
          <button className="flex items-center gap-3 bg-white/5 backdrop-blur-md text-white px-10 py-4 rounded-full font-black text-sm hover:bg-white/10 transition-all border border-white/10 active:scale-95">
            <Info size={20} /> DETALHES
          </button>
        </div>

        <div className="flex items-center gap-2 mt-12">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActive(idx)}
              className={`h-1 rounded-full transition-all duration-500 ${idx === active ? 'w-12 bg-primary shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'w-2 bg-white/20'}`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
