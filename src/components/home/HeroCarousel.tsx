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
    <section className="relative w-full h-[420px] md:h-[480px] rounded-3xl overflow-hidden border border-white/10 shadow-[0_30px_80px_rgba(168,85,247,0.15)]">
      {SLIDES.map((s, idx) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${idx === active ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden={idx !== active}
        >
          <img src={s.backdrop} alt={s.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        </div>
      ))}

      <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-12 max-w-2xl">
        <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 mb-4 tracking-tighter italic drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">
          {slide.title}
        </h2>

        <div className="flex flex-wrap items-center gap-4 mb-3 text-xs font-semibold text-zinc-300">
          <span className="flex items-center gap-1.5"><Tag size={12} className="text-purple-400" /> {slide.title}</span>
          <span className="flex items-center gap-1.5"><Calendar size={12} className="text-purple-400" /> {slide.date}</span>
          <span className="flex items-center gap-1.5"><Star size={12} className="text-yellow-400 fill-yellow-400" /> {slide.rating}</span>
          <span className="flex items-center gap-1.5"><Tag size={12} className="text-purple-400" /> {slide.genre}</span>
        </div>

        <p className="text-sm text-zinc-300 mb-6 leading-relaxed line-clamp-3 max-w-xl">
          {slide.synopsis}
        </p>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold text-sm hover:bg-purple-200 transition-all shadow-lg active:scale-95">
            <Play size={16} className="fill-black" /> Assistir
          </button>
          <button className="flex items-center gap-2 bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-white/20 transition-all border border-white/20">
            <Info size={16} /> Mais Informações
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-6">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActive(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === active ? 'w-8 bg-purple-500' : 'w-1.5 bg-white/30'}`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
