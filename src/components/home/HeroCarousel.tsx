import { useEffect, useState, useMemo } from 'react';
import { Play, Info, Star, Calendar, Tag, Loader2 } from 'lucide-react';
import { enrichFromTmdb } from '@/services/tmdb';
import { RowItem } from '@/types';

interface HeroSlide {
  id: string;
  title: string;
  type: string;
  date: string;
  rating: string;
  genre: string;
  synopsis: string;
  backdrop: string;
  raw: any;
}

const FALLBACK: HeroSlide[] = [
  {
    id: '1', title: 'SINNERS', type: 'Filme', date: '2025',
    rating: '7.8', genre: 'Terror',
    synopsis: 'Dois irmãos gêmeos tentam deixar seu passado violento para trás ao retornar à sua cidade natal no Deep South, mas acabam encontrando um mal ainda maior.',
    backdrop: 'https://image.tmdb.org/t/p/original/b9EkFmHd9XxF9qDJGlHcPnTQ1y4.jpg',
  },
  {
    id: '2', title: 'THUNDERBOLTS*', type: 'Filme', date: '2025',
    rating: '7.4', genre: 'Ação',
    synopsis: 'Um grupo de anti-heróis Marvel é recrutado para uma missão que pode salvar ou destruir o mundo.',
    backdrop: 'https://image.tmdb.org/t/p/original/qlXLQ5Dn8JQIKaEMkRp3VDQxeUb.jpg',
  }
];

interface HeroCarouselProps {
  onAction: (item: any, type: 'movie' | 'series') => void;
  movies: RowItem[];
  series: RowItem[];
}

export const HeroCarousel = ({ onAction, movies, series }: HeroCarouselProps) => {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prepareSlides = async () => {
      // If we don't have enough data yet, don't stop loading
      if (movies.length === 0 && series.length === 0) return;

      setLoading(true);
      try {
        // Take top 4 movies and 4 series (latest)
        const candidates = [
          ...movies.slice(0, 4).map(m => ({ ...m, category: 'movie' as const })),
          ...series.slice(0, 4).map(s => ({ ...s, category: 'series' as const }))
        ].sort(() => 0.5 - Math.random()); // Shuffle for variety

        const enriched = await Promise.all(
          candidates.map(async (item) => {
            const tmdb = await enrichFromTmdb(item.title, item.category);
            return {
              id: item.id,
              title: (tmdb?.title || item.title).toUpperCase(),
              type: item.category === 'movie' ? 'Filme' : 'Série',
              date: tmdb?.year || '2024',
              rating: tmdb?.rating || '7.5',
              genre: tmdb?.genres?.[0] || 'Destaque',
              synopsis: tmdb?.synopsis || 'Assista a esta super produção disponível agora no seu webplayer VIBE.',
              backdrop: tmdb?.backdrop || item.poster || '',
              raw: item.raw || item,
            };
          })
        );

        // Filter out those without backdrop if possible, or use fallback
        const validSlides = enriched.filter(s => s.backdrop);
        setSlides(validSlides.length > 0 ? validSlides : FALLBACK);
      } catch (err) {
        console.error('Failed to enrich hero slides:', err);
        setSlides(FALLBACK);
      } finally {
        setLoading(false);
      }
    };

    prepareSlides();
  }, [movies, series]);

  useEffect(() => {
    if (slides.length === 0) return;
    const id = setInterval(() => setActive((p) => (p + 1) % slides.length), 8000);
    return () => clearInterval(id);
  }, [slides.length]);

  if (loading || slides.length === 0) {
    return (
      <section className="relative w-full h-[420px] md:h-[520px] rounded-[var(--radius)] overflow-hidden border border-white/5 bg-[#08060D] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </section>
    );
  }

  const slide = slides[active];

  return (
    <section className="relative w-full h-[420px] md:h-[520px] rounded-[var(--radius)] overflow-hidden border border-white/5 shadow-2xl group">
      {slides.map((s, idx) => (
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

      <div className="relative z-10 h-full flex flex-col justify-center p-8 md:p-20 max-w-4xl">
        <div className="flex items-center gap-3 mb-6 animate-in fade-in slide-in-from-left duration-700">
          <span className="bg-purple-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.3)] uppercase tracking-[0.2em]">
            🔥 Adicionado Recentemente
          </span>
          <span className="bg-white/10 backdrop-blur-md text-zinc-300 text-[10px] font-bold px-4 py-1.5 rounded-full border border-white/10 uppercase tracking-[0.2em]">
            {slide.type}
          </span>
        </div>

        <h2 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter leading-[0.9] drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom duration-1000 max-w-3xl uppercase italic">
          {slide.title}
        </h2>

        <div className="flex flex-wrap items-center gap-8 mb-8 text-xs font-black text-zinc-400 animate-in fade-in slide-in-from-bottom duration-700 delay-200 uppercase tracking-widest">
          <span className="flex items-center gap-2.5"><Calendar size={16} className="text-purple-500" /> {slide.date}</span>
          <span className="flex items-center gap-2.5"><Star size={16} className="text-yellow-500 fill-yellow-500" /> {slide.rating}</span>
          <span className="flex items-center gap-2.5"><Tag size={16} className="text-purple-500" /> {slide.genre}</span>
        </div>

        <p className="text-lg text-zinc-400 mb-10 leading-relaxed line-clamp-2 md:line-clamp-3 max-w-2xl animate-in fade-in slide-in-from-bottom duration-700 delay-300 font-medium">
          {slide.synopsis}
        </p>

        <div className="flex flex-wrap items-center gap-6 animate-in fade-in slide-in-from-bottom duration-700 delay-500">
          <button 
            onClick={() => onAction(slide.raw, slide.type === 'Filme' ? 'movie' : 'series')}
            className="flex items-center gap-4 bg-purple-600 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-purple-500 hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(168,85,247,0.3)]"
          >
            <Play size={20} fill="currentColor" /> ASSISTIR AGORA
          </button>
          <button 
            onClick={() => onAction(slide.raw, slide.type === 'Filme' ? 'movie' : 'series')}
            className="flex items-center gap-4 bg-white/5 backdrop-blur-xl text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-white/10 transition-all border border-white/10 hover:scale-105 active:scale-95"
          >
            <Info size={20} /> DETALHES
          </button>
        </div>

        <div className="flex items-center gap-3 mt-16">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActive(idx)}
              className={`h-1.5 rounded-full transition-all duration-700 ${idx === active ? 'w-16 bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.6)]' : 'w-3 bg-white/10 hover:bg-white/20'}`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
