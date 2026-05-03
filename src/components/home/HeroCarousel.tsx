import { useEffect, useState } from 'react';
import { Play, Info, Star, Calendar, Tag, Loader2 } from 'lucide-react';

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

// Genre map (TMDB IDs → PT-BR names)
const GENRE_MAP: Record<number, string> = {
  28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia',
  80: 'Crime', 99: 'Documentário', 18: 'Drama', 10751: 'Família',
  14: 'Fantasia', 36: 'História', 27: 'Terror', 10402: 'Música',
  9648: 'Mistério', 10749: 'Romance', 878: 'Ficção Científica',
  10770: 'TV Movie', 53: 'Suspense', 10752: 'Guerra', 37: 'Faroeste',
  10759: 'Ação & Aventura', 10762: 'Kids', 10763: 'Notícias',
  10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
  10767: 'Talk', 10768: 'War & Politics',
};

// Static fallback
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
  },
  {
    id: '3', title: 'THE LAST OF US', type: 'Série', date: '2025',
    rating: '8.8', genre: 'Drama',
    synopsis: 'Após uma pandemia devastadora, um sobrevivente endurece viaja pelos EUA com uma adolescente imune ao fungo mutante.',
    backdrop: 'https://image.tmdb.org/t/p/original/uDgy6hyPd7qToEdBkYo4dUKLqJB.jpg',
  },
];

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY as string | undefined;

async function fetchTrending(): Promise<HeroSlide[]> {
  if (!TMDB_KEY) return FALLBACK;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`
    );
    const json = await res.json();
    return (json.results || [])
      .filter((item: any) => item.backdrop_path)
      .slice(0, 6)
      .map((item: any) => ({
        id: String(item.id),
        title: (item.title || item.name || '').toUpperCase(),
        type: item.media_type === 'movie' ? 'Filme' : 'Série',
        date: (item.release_date || item.first_air_date || '').substring(0, 4),
        rating: item.vote_average?.toFixed(1) || 'N/A',
        genre: GENRE_MAP[item.genre_ids?.[0]] || 'Entretenimento',
        synopsis: item.overview || 'Sem sinopse disponível.',
        backdrop: `https://image.tmdb.org/t/p/original${item.backdrop_path}`,
      }));
  } catch {
    return FALLBACK;
  }
}

export const HeroCarousel = () => {
  const [slides, setSlides] = useState<HeroSlide[]>(FALLBACK);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(!!TMDB_KEY);

  useEffect(() => {
    fetchTrending().then((data) => {
      setSlides(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setActive((p) => (p + 1) % slides.length), 7000);
    return () => clearInterval(id);
  }, [slides.length]);

  if (loading) {
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

      <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-16 max-w-3xl">
        <div className="flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-left duration-700">
          <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-full border border-primary/20 uppercase tracking-widest">
            {TMDB_KEY ? '🔥 Em Alta Agora' : 'Destaque da Semana'}
          </span>
          <span className="bg-white/5 text-zinc-400 text-[10px] font-bold px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest">
            {slide.type}
          </span>
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
          {slides.map((_, idx) => (
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
