import { memo, useState, useEffect } from 'react';
import { X, Star, Play, ChevronRight, Loader2, Clock, Film, Tag, CheckCircle2 } from 'lucide-react';
import { xtreamService } from '../../services/xtream';
import { enrichFromTmdb, TmdbMeta } from '../../services/tmdb';
import { historyService } from '../../services/historyService';

interface ContentDetailModalProps {
  item: any;
  type: 'live' | 'movie' | 'series';
  onClose: () => void;
  onPlay: (item: any) => void;
}

export const ContentDetailModal = memo(({ item, type, onClose, onPlay }: ContentDetailModalProps) => {
  const [seriesInfo, setSeriesInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [tmdb, setTmdb] = useState<TmdbMeta | null>(null);
  const [tmdbLoading, setTmdbLoading] = useState(false);

  // Normalize IPTV field names (safe with optional chaining when item is null)
  const norm = {
    name:     item?.name || item?.title || 'Sem título',
    icon:     item?.stream_icon || item?.cover || item?.icon || item?.poster || item?.movie_image || '',
    seriesId: item?.series_id || item?.stream_id || item?.id,
    year:     item?.year || item?.added?.substring(0, 4) || '',
    rating:   item?.rating || item?.vote_average || '',
    synopsis: item?.synopsis || item?.plot || item?.description || item?.overview || '',
  };

  // Final display values: TMDB enriches when available
  const display = {
    name:     norm.name,
    icon:     tmdb?.poster     || norm.icon,
    backdrop: tmdb?.backdrop   || '',
    year:     tmdb?.year       || norm.year,
    rating:   tmdb?.rating     || norm.rating,
    synopsis: tmdb?.synopsis   || norm.synopsis || 'Descrição não disponível.',
    genres:   tmdb?.genres     || [],
    runtime:  tmdb?.runtime    || '',
    tagline:  tmdb?.tagline    || '',
    director: tmdb?.director   || '',
    cast:     tmdb?.cast       || [],
  };

  const seasonsMetadata = seriesInfo?.seasons
    ? (Array.isArray(seriesInfo.seasons) ? seriesInfo.seasons : Object.values(seriesInfo.seasons))
    : [];

  const rawEpisodes = seriesInfo?.episodes || {};
  const episodeKeys = Object.keys(rawEpisodes).sort((a, b) => parseInt(a) - parseInt(b));

  // If seasons metadata is missing but we have episodes, generate seasons from keys
  const seasons = seasonsMetadata.length > 0 
    ? seasonsMetadata 
    : episodeKeys.map(key => ({ season_number: parseInt(key), name: `Temporada ${key}` }));

  const episodes = rawEpisodes[selectedSeason || '']
    ? (Array.isArray(rawEpisodes[selectedSeason || '']) ? rawEpisodes[selectedSeason || ''] : Object.values(rawEpisodes[selectedSeason || '']))
    : [];

  // Deduplicate and sort episodes by number
  const uniqueEpisodes = episodes
    .filter((ep: any, idx: number, arr: any[]) =>
      arr.findIndex((e: any) => e.episode_num === ep.episode_num) === idx
    )
    .sort((a: any, b: any) => (parseInt(a.episode_num) || 0) - (parseInt(b.episode_num) || 0));

  // Fetch TMDB metadata when item changes
  useEffect(() => {
    if (!item || type === 'live') return;
    setTmdb(null);
    setTmdbLoading(true);
    const tmdbType = type === 'movie' ? 'movie' : 'series';
    enrichFromTmdb(norm.name, tmdbType).then((meta) => {
      setTmdb(meta);
      setTmdbLoading(false);
    });
  }, [item, type]);

  // Fetch series episodes
  useEffect(() => {
    if (type === 'series' && item) {
      const fetchInfo = async () => {
        setLoading(true);
        try {
          const data = await xtreamService.fetchAction('get_series_info', { series_id: String(norm.seriesId) });
          setSeriesInfo(data);
          
          const keys = Object.keys(data?.episodes || {}).sort((a, b) => parseInt(a) - parseInt(b));
          if (keys.length > 0) {
            // Priority: select season 1 if it exists, otherwise the first available
            const firstSeason = keys.find(k => k === '1') || keys[0];
            setSelectedSeason(firstSeason);
          }
        } catch (err) {
          console.error('Error fetching series info:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchInfo();
    }
  }, [item, type]);

  // Guard AFTER all hooks
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl" onClick={onClose} />

      <div className="relative w-full max-w-7xl bg-[#080808] border border-white/5 rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col lg:flex-row max-h-[90vh] z-10">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
        
        <button
          onClick={onClose}
          className="absolute top-8 right-8 z-50 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/10 text-white group active:scale-90"
        >
          <X size={24} className="group-hover:rotate-90 transition-transform" />
        </button>

        {/* TMDB Backdrop on mobile */}
        <div className="absolute inset-0 md:hidden opacity-20 pointer-events-none">
          <img src={display.backdrop || display.icon} className="w-full h-full object-cover blur-sm" alt="" />
        </div>

        {/* Poster Section with Cinematic Glow */}
        <div className="hidden lg:block w-[450px] flex-shrink-0 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#080808] z-20" />
          {tmdbLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900/20">
              <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
            </div>
          ) : (
            <div className="relative w-full h-full">
              <img
                src={display.icon}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x900/080808/333333?text=SEM+IMAGEM'; }}
              />
              <div className="absolute inset-0 shadow-[inset_-100px_0_100px_-20px_#080808]" />
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* TMDB Backdrop behind content */}
          {display.backdrop && (
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <img src={display.backdrop} className="w-full h-full object-cover blur-sm scale-110" alt="" />
              <div className="absolute inset-0 bg-gradient-to-b from-[#080808]/50 via-[#080808]/80 to-[#080808]" />
            </div>
          )}

          <div className="p-8 md:p-16 overflow-y-auto custom-scrollbar relative z-10">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <div className="flex items-center gap-2 bg-purple-600 px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                <Film size={12} className="text-white" />
                <span className="text-white text-[10px] font-black tracking-[0.2em] uppercase">
                  {type === 'live' ? 'AO VIVO' : type === 'movie' ? 'FILME' : 'SÉRIE'}
                </span>
              </div>
              
              {display.year && (
                <span className="bg-white/5 px-4 py-1.5 rounded-full text-zinc-400 text-[10px] font-black tracking-[0.2em] border border-white/10 uppercase">{display.year}</span>
              )}
              
              {display.rating && (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                  <Star size={14} fill="currentColor" />
                  <span className="text-xs font-black">{display.rating}</span>
                </div>
              )}

              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white shadow-lg">
                <span className="text-[10px] font-black tracking-widest text-purple-400">ULTRA HD 4K</span>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-4xl md:text-6xl font-black mb-4 leading-[0.95] uppercase tracking-tighter text-white italic drop-shadow-2xl line-clamp-2">
              {display.name}
            </h3>

            {/* Tagline */}
            {display.tagline && (
              <p className="text-purple-400/80 text-lg font-medium italic mb-8 tracking-wide">{display.tagline}</p>
            )}

            <div className="flex flex-wrap gap-3 mb-10">
              {display.genres.map((g) => (
                <span key={g} className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/5 text-zinc-300 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-colors">
                  {g}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-12">
              {/* Synopsis */}
              <div className="lg:col-span-7 space-y-4">
                <h4 className="text-[10px] font-black text-purple-500 tracking-[0.4em] uppercase flex items-center gap-3">
                  <div className="w-8 h-[1px] bg-purple-500/30" />
                  História
                </h4>
                <p className="text-zinc-400 text-base md:text-lg leading-relaxed font-medium italic line-clamp-6">{display.synopsis}</p>
              </div>

              {/* Credits */}
              <div className="lg:col-span-5 grid grid-cols-1 gap-10">
                {display.director && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-zinc-500 tracking-[0.4em] uppercase">Direção</h4>
                    <p className="text-white text-lg font-black uppercase italic tracking-wide">{display.director}</p>
                  </div>
                )}
                {display.cast.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-zinc-500 tracking-[0.4em] uppercase">Elenco</h4>
                    <p className="text-zinc-300 text-sm leading-relaxed font-bold tracking-wide">
                      {display.cast.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6 mb-16">
              {type !== 'series' && (
                <button
                  onClick={() => onPlay(item)}
                  className="w-full md:w-auto px-16 bg-white text-black h-20 rounded-[28px] flex items-center justify-center gap-4 font-black text-sm uppercase tracking-[0.2em] hover:bg-purple-600 hover:text-white transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)] group active:scale-95"
                >
                  Iniciar Reprodução
                  <Play size={24} fill="currentColor" className="group-hover:scale-125 transition-transform" />
                </button>
              )}
            </div>

            {/* Series Episode Selection */}
            {type === 'series' && (
              <div className="space-y-10 border-t border-white/5 pt-16">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-purple-500 tracking-[0.4em] uppercase flex items-center gap-3">
                    <div className="w-8 h-[1px] bg-purple-500/30" />
                    Temporadas
                  </h4>
                </div>
                
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Seasons Tabs */}
                    <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar">
                      {seasons.map((season: any) => (
                        <button
                          key={season.season_number}
                          onClick={() => setSelectedSeason(String(season.season_number))}
                          className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border ${
                            selectedSeason === String(season.season_number)
                              ? 'bg-white text-black border-white shadow-xl scale-105'
                              : 'bg-white/5 text-zinc-500 border-white/5 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          Temporada {season.season_number}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {uniqueEpisodes.map((episode: any) => {
                        const progress = historyService.getProgress(episode.id || episode.stream_id);
                        const isWatched = progress?.completed;
                        const percent = progress ? (progress.currentTime / progress.duration) * 100 : 0;

                        return (
                          <button
                            key={episode.id}
                            onClick={() => onPlay({
                              ...item,
                              id: episode.id || episode.stream_id,
                              name: `${norm.name} - ${episode.title || `E${episode.episode_num}`}`,
                              type: 'series'
                            })}
                            className={`flex items-center gap-6 p-6 rounded-3xl bg-[#1A1A1A]/30 border transition-all group text-left relative overflow-hidden ${
                              isWatched ? 'border-green-500/20 bg-green-500/5' : 'border-white/5 hover:bg-white/5 hover:border-purple-500/30'
                            }`}
                          >
                            <div className={`absolute inset-y-0 left-0 w-1 transition-opacity ${
                              isWatched ? 'bg-green-500 opacity-100' : 'bg-purple-600 opacity-0 group-hover:opacity-100'
                            }`} />
                            
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-inner ${
                              isWatched ? 'bg-green-500 text-white' : 'bg-white/5 text-zinc-500 group-hover:bg-purple-600 group-hover:text-white'
                            }`}>
                              {isWatched ? <CheckCircle2 size={20} /> : <Play size={20} fill="currentColor" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h5 className={`text-[13px] font-black uppercase tracking-wider transition-colors truncate ${
                                isWatched ? 'text-green-400' : 'text-white group-hover:text-purple-400'
                              }`}>
                                Ep. {episode.episode_num}: {episode.title}
                              </h5>
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 block">
                                {episode.info?.duration || 'Duração N/A'}
                              </span>
                            </div>
                            
                            <ChevronRight size={18} className="text-zinc-800 group-hover:text-white group-hover:translate-x-1 transition-all" />

                            {/* Progress bar for in-progress episodes */}
                            {!isWatched && percent > 0 && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
                                <div className="h-full bg-purple-500 shadow-[0_0_10px_#a855f7]" style={{ width: `${percent}%` }} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ContentDetailModal.displayName = 'ContentDetailModal';
