import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Loader2, Tv } from 'lucide-react'
import Hls from 'hls.js'
import { Stream } from '../types/iptv'

interface PlayerProps {
  stream: Stream
  onBack: () => void
}

export const Player = ({ stream, onBack }: PlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let hls: Hls | null = null;
    const video = videoRef.current;
    if (!video || !stream.direct_source) return;
    
    const initPlayer = () => {
      setLoading(true);
      setError(false);

      if (Hls.isSupported()) {
        hls = new Hls({ 
          enableWorker: true,
          manifestLoadingTimeOut: 10000,
          fragLoadingTimeOut: 20000
        });
        hls.loadSource(stream.direct_source!);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error("HLS Fatal Error:", data);
            setError(true);
            setLoading(false);
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream.direct_source!;
        const onLoaded = () => {
          setLoading(false);
          video.play().catch(() => {});
        };
        const onError = () => {
          setError(true);
          setLoading(false);
        };
        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('error', onError);
        return () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
        };
      }
    };
    
    const cleanup = initPlayer();
    return () => {
      if (hls) hls.destroy();
      if (cleanup) cleanup();
    };
  }, [stream]);

  if (error) return (
    <div className="fixed inset-0 z-[400] bg-black flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
      <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
        <Tv className="w-12 h-12 text-red-500" />
      </div>
      <h2 className="text-2xl font-black text-white tracking-tighter mb-2">Ops! Falha na Reprodução</h2>
      <p className="text-neutral-500 mb-8 max-w-xs">O link deste canal pode estar offline ou é incompatível com o navegador.</p>
      <button onClick={onBack} className="h-14 px-8 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all text-white">
        Voltar para a Lista
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[400] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
      <button onClick={onBack} className="absolute top-6 left-6 z-[410] p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all text-white">
        <ArrowLeft className="w-6 h-6" />
      </button>
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-[405]">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      )}

      <video ref={videoRef} className="w-full h-full object-contain" controls autoPlay playsInline />
      
      <div className="absolute bottom-12 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none z-[405]">
        <div className="max-w-4xl mx-auto text-white">
          <h2 className="text-3xl font-black mb-2 tracking-tighter">{stream.name}</h2>
          <span className="px-3 py-1 bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-full uppercase tracking-widest">
            {stream.category_id}
          </span>
        </div>
      </div>
    </div>
  )
}
