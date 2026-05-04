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

  const norm = {
    name:     item?.name || item?.title || 'Sem título',
    icon:     item?.stream_icon || item?.cover || item?.icon || item?.poster || item?.movie_image || '',
    seriesId: item?.series_id || item?.stream_id || item?.id,
    year:     item?.year || item?.added?.substring(0, 4) || '',
    rating:   item?.rating || item?.vote_average || '',
    synopsis: item?.synopsis || item?.plot || item?.description || item?.overview || '',
  };

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

  const seasons = seasonsMetadata.length > 0 
    ? seasonsMetadata 
    : episodeKeys.map(key => ({ season_number: parseInt(key), name: `Temporada ${key}` }));

  const episodes = rawEpisodes[selectedSeason || '']
    ? (Array.isArray(rawEpisodes[selectedSeason || '']) ? rawEpisodes[selectedSeason || ''] : Object.values(rawEpisodes[selectedSeason || '']))
    : [];

  const uniqueEpisodes = episodes
    .filter((ep: any, idx: number, arr: any[]) =>
      arr.findIndex((e: any) => e.episode_num === ep.episode_num) === idx
    )
    .sort((a: any, b: any) => (parseInt(a.episode_num) || 0) - (parseInt(b.episode_num) || 0));

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

  useEffect(() => {
    if (type === 'series' && item) {
      const fetchInfo = async () => {
        setLoading(true);
        try {
          const data = await xtreamService.fetchAction('get_series_info', { series_id: String(norm.seriesId) });
          setSeriesInfo(data);
          const keys = Object.keys(data?.episodes || {}).sort((a, b) => parseInt(a) - parseInt(b));
          if (keys.length > 0) {
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

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={onClose} />

      <div className="relative w-full max-w-7xl bg-[#050308] border border-white/5 rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col lg:flex-row max-h-[90vh] z-10">
        {/* Poster Section */}
        <div className="hidden lg:block w-[400px] flex-shrink-0 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#050308] z-20" />
          <img
            src={display.icon}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x900/050308/333333?text=SEM+IMAGEM'; }}
            alt=""
          />
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <button
            onClick={onClose}
            className="absolute top-8 right-8 z-50 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/10 text-white group"
          >
            <X size={20} className="group-hover:rotate-90 transition-transform" />
          </button>

          <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="bg-purple-600 px-3 py-1 rounded-full text-[9px] font-black tracking-widest text-white uppercase">
                {type === 'live' ? 'AO VIVO' : type === 'movie' ? 'FILME' : 'SÉRIE'}
              </span>
              {display.year && (
                <span className="bg-white/5 px-3 py-1 rounded-full text-zinc-400 text-[9px] font-black tracking-widest border border-white/10">{display.year}</span>
              )}
              {display.rating && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                  <Star size={10} fill="currentColor" />
                  <span className="text-[10px] font-black">{display.rating}</span>
                </div>
              )}
            </div>

            <h3 className="text-3xl md:text-5xl font-black mb-4 uppercase tracking-tighter text-white italic line-clamp-2">
              {display.name}
            </h3>

            {display.tagline && (
              <p className="text-purple-400/80 text-sm font-medium italic mb-6">{display.tagline}</p>
            )}

            <div className="flex flex-wrap gap-2 mb-8">
              {display.genres.map((g) => (
                <span key={g} className="px-3 py-1 rounded-lg bg-white/5 border border-white/5 text-zinc-400 text-[9px] font-black uppercase tracking-widest">
                  {g}
                </span>
              ))}
            </div>

            <p className="text-zinc-400 text-sm md:text-base leading-relaxed font-medium italic mb-10 line-clamp-4 max-w-3xl">
              {display.synopsis}
            </p>

            {type !== 'series' && (
              <button
                onClick={() => onPlay(item)}
                className="w-full md:w-auto px-12 bg-white text-black h-16 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all shadow-xl group active:scale-95"
              >
                Assistir Agora
                <Play size={18} fill="currentColor" className="group-hover:scale-110 transition-transform" />
              </button>
            )}

            {type === 'series' && (
              <div className="border-t border-white/5 pt-8 mt-4">
                <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar mb-4">
                  {seasons.map((season: any) => (
                    <button
                      key={season.season_number}
                      onClick={() => setSelectedSeason(String(season.season_number))}
                      className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                        selectedSeason === String(season.season_number)
                          ? 'bg-white text-black border-white shadow-lg'
                          : 'bg-white/5 text-zinc-500 border-white/5 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      Temporada {season.season_number}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <div 
                    className="flex gap-4 overflow-x-auto pb-4 pt-2 px-1 scroll-smooth custom-scrollbar select-none"
                    onWheel={(e) => {
                      if (e.deltaY !== 0) {
                        e.currentTarget.scrollLeft += e.deltaY;
                        e.preventDefault();
                      }
                    }}
                  >
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
                            type: 'series',
                            extension: episode.container_extension
                          })}
                          className={`flex-shrink-0 w-[220px] p-4 rounded-3xl bg-white/5 border transition-all duration-300 text-left relative overflow-hidden flex flex-col gap-3 ${
                            isWatched ? 'border-green-500/20 bg-green-500/5' : 'border-white/5 hover:bg-white/10 hover:border-purple-500/40'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center transition-all ${
                              isWatched ? 'bg-green-500 text-white' : 'bg-white/5 text-zinc-500'
                            }`}>
                              {isWatched ? <CheckCircle2 size={14} /> : <Play size={14} fill="currentColor" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className={`text-[10px] font-black uppercase tracking-widest truncate ${
                                isWatched ? 'text-green-400' : 'text-white'
                              }`}>
                                Ep. {episode.episode_num}
                              </h5>
                              <p className="text-[9px] text-zinc-500 truncate mt-0.5">
                                {episode.title || `Episódio ${episode.episode_num}`}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-1 pt-2 border-t border-white/5">
                            <div className="flex items-center gap-2">
                              <Clock size={8} className="text-zinc-600" />
                              <span className="text-[8px] text-zinc-600 font-bold uppercase">
                                {episode.info?.duration || 'N/A'}
                              </span>
                            </div>
                            <ChevronRight size={10} className="text-zinc-700" />
                          </div>

                          {!isWatched && percent > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
                              <div className="h-full bg-purple-600" style={{ width: `${percent}%` }} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <style dangerouslySetInnerHTML={{ __html: `
                    .custom-scrollbar::-webkit-scrollbar { height: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(168, 85, 247, 0.3); border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(168, 85, 247, 0.6); }
                  `}} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ContentDetailModal.displayName = 'ContentDetailModal';
