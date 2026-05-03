import { memo, useState, useEffect } from 'react';
import { X, Star, Play, ChevronRight, Loader2, Clock, Film, Tag } from 'lucide-react';
import { xtreamService } from '../../services/xtream';
import { enrichFromTmdb, TmdbMeta } from '../../services/tmdb';

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
  };

  const seasons = seriesInfo?.seasons
    ? (Array.isArray(seriesInfo.seasons) ? seriesInfo.seasons : Object.values(seriesInfo.seasons))
    : [];

  const rawEpisodes = seriesInfo?.episodes || {};
  const episodes = rawEpisodes[selectedSeason || '']
    ? (Array.isArray(rawEpisodes[selectedSeason || '']) ? rawEpisodes[selectedSeason || ''] : Object.values(rawEpisodes[selectedSeason || '']))
    : [];

  // Deduplicate episodes by episode_num
  const uniqueEpisodes = episodes.filter((ep: any, idx: number, arr: any[]) =>
    arr.findIndex((e: any) => e.episode_num === ep.episode_num) === idx
  );

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
          const episodeKeys = Object.keys(data?.episodes || {});
          if (episodeKeys.length > 0) setSelectedSeason(episodeKeys[0]);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose} />

      <div className="relative w-full max-w-6xl bg-[#0A0A0A] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row animate-in zoom-in-95 duration-500 max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-20 p-3 rounded-full bg-black/50 hover:bg-white/10 transition-colors border border-white/10 text-white"
        >
          <X size={20} />
        </button>

        {/* TMDB Backdrop on mobile */}
        <div className="absolute inset-0 md:hidden opacity-20 pointer-events-none">
          <img src={display.backdrop || display.icon} className="w-full h-full object-cover blur-sm" alt="" />
        </div>

        {/* Poster Section */}
        <div className="hidden md:block w-[300px] flex-shrink-0 relative">
          {tmdbLoading ? (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : (
            <>
              <img
                src={display.icon}
                className="w-full h-full object-cover opacity-90"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x900/111111/FFFFFF?text=SEM+CAPA'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0A0A0A]" />
            </>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          {/* TMDB Backdrop behind content */}
          {display.backdrop && (
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <img src={display.backdrop} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0A]" />
            </div>
          )}

          <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar relative">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-black tracking-widest uppercase border border-purple-500/20">
                {type === 'live' ? 'AO VIVO' : type === 'movie' ? 'FILME' : 'SÉRIE'}
              </span>
              {display.year && (
                <span className="text-zinc-500 text-[10px] font-black tracking-widest uppercase">{display.year}</span>
              )}
              {display.rating && (
                <div className="flex items-center gap-1.5 text-yellow-500">
                  <Star size={12} fill="currentColor" />
                  <span className="text-xs font-black">{display.rating}</span>
                </div>
              )}
              {display.runtime && (
                <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold">
                  <Clock size={11} />
                  {display.runtime}
                </div>
              )}
              {display.genres.slice(0, 3).map((g) => (
                <span key={g} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-zinc-400 text-[10px] font-bold">
                  <Tag size={9} />
                  {g}
                </span>
              ))}
            </div>

            {/* Title */}
            <h3 className="text-4xl md:text-6xl font-black mb-2 leading-none uppercase tracking-tight text-white">
              {display.name}
            </h3>

            {/* Tagline */}
            {display.tagline && (
              <p className="text-purple-400 text-sm italic mb-6 opacity-80">{display.tagline}</p>
            )}

            <div className="space-y-8 mb-12 mt-6">
              {/* Synopsis */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-zinc-500 tracking-[0.3em] uppercase flex items-center gap-2">
                  <Film size={11} />
                  Sinopse
                  {tmdbLoading && <Loader2 size={11} className="animate-spin text-purple-400" />}
                </h4>
                <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-2xl">{display.synopsis}</p>
              </div>

              {type !== 'series' && (
                <button
                  onClick={() => onPlay(item)}
                  className="w-full md:w-auto px-12 bg-white text-black h-16 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest hover:bg-purple-500 hover:text-white transition-all shadow-2xl group"
                >
                  Assistir Agora
                  <Play size={20} fill="currentColor" className="group-hover:scale-110 transition-transform" />
                </button>
              )}
            </div>

            {/* Series Episode Selection */}
            {type === 'series' && (
              <div className="space-y-8 border-t border-white/5 pt-10">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Seasons Tabs */}
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                      {seasons.map((season: any) => (
                        <button
                          key={season.season_number}
                          onClick={() => setSelectedSeason(String(season.season_number))}
                          className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                            selectedSeason === String(season.season_number)
                              ? 'bg-white text-black'
                              : 'bg-white/5 text-zinc-500 hover:bg-white/10'
                          }`}
                        >
                          Temporada {season.season_number}
                        </button>
                      ))}
                    </div>

                    {/* Episodes List */}
                    <div className="grid grid-cols-1 gap-3">
                      {uniqueEpisodes.map((episode: any) => (
                        <button
                          key={episode.id}
                          onClick={() => onPlay({
                            ...item,
                            id: episode.id || episode.stream_id,
                            name: `${norm.name} - ${episode.title || `E${episode.episode_num}`}`,
                            type: 'series'
                          })}
                          className="flex items-center gap-6 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group text-left"
                        >
                          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-all">
                            <Play size={20} fill="currentColor" />
                          </div>
                          <div className="flex-1">
                            <h5 className="text-xs font-black uppercase tracking-wider text-white">
                              Episódio {episode.episode_num}: {episode.title}
                            </h5>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                              {episode.info?.duration || 'Duração N/A'}
                            </span>
                          </div>
                          <ChevronRight size={16} className="text-zinc-700 group-hover:text-white transition-colors" />
                        </button>
                      ))}
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
