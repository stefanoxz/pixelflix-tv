import { useState, FormEvent, useEffect, useRef } from 'react'
import { Play, Shield, Zap, Search, Globe, Tv, Monitor, KeyRound, UserIcon, Link2, ArrowRight, Loader2, ArrowLeft, Heart, History, Trash2, Video, Film, List } from 'lucide-react'
import Hls from 'hls.js'
import { parseM3uUrl, fetchM3u, parseM3uToStreams } from './services/iptv'
import { Stream, IptvCredentials } from './types/iptv'

// --- Player Component ---
const Player = ({ stream, onBack }: { stream: Stream, onBack: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoRef.current || !stream.direct_source) return

    const video = videoRef.current
    if (Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(stream.direct_source)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.error("Auto-play blocked", e))
      })
      return () => hls.destroy()
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.direct_source
      video.play().catch(e => console.error("Auto-play blocked", e))
    }
  }, [stream])

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="font-bold truncate max-w-[200px] md:max-w-md">{stream.name}</h2>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <video 
          ref={videoRef} 
          className="w-full h-full max-h-screen" 
          controls 
          playsInline
        />
      </div>
    </div>
  )
}

// --- Main App Component ---
function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [streams, setStreams] = useState<Stream[]>([])
  const [activeStream, setActiveStream] = useState<Stream | null>(null)
  const [url, setUrl] = useState('')
  const [search, setSearch] = useState('')
  
  // Persistência básica
  useEffect(() => {
    const saved = localStorage.getItem('last_list')
    if (saved) {
      try {
        const creds = JSON.parse(saved)
        loadList(creds)
      } catch (e) {}
    }
  }, [])

  const loadList = async (creds: IptvCredentials) => {
    setLoading(true)
    try {
      // Nota: Em produção, isso passaria por uma Edge Function para evitar erro de CORS
      // Para este exemplo rápido, vamos tentar o fetch direto
      const m3u = await fetchM3u(creds)
      const parsedStreams = parseM3uToStreams(m3u)
      setStreams(parsedStreams)
      setIsLoginOpen(false)
      localStorage.setItem('last_list', JSON.stringify(creds))
    } catch (e) {
      alert("Erro ao carregar lista. Isso pode ocorrer por bloqueio de CORS do servidor IPTV ou URL inválida. Verifique o link e tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const creds = parseM3uUrl(url)
    if (!creds) {
      alert("Formato de URL inválido. Use o link completo do get.php")
      return
    }
    loadList(creds)
  }

  const filteredStreams = streams.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  if (streams.length > 0) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
        {/* Header do Player */}
        <header className="h-20 bg-neutral-900 border-b border-white/5 px-6 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Play className="w-6 h-6 text-primary-foreground fill-current" />
            </div>
            <span className="text-xl font-bold">Super<span className="text-primary">Tech</span></span>
          </div>
          
          <div className="flex-1 max-w-xl mx-8 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar canais..."
              className="w-full bg-black border border-neutral-800 rounded-xl py-2 pl-11 pr-4 focus:border-primary/50 transition-all"
            />
          </div>

          <button 
            onClick={() => {
              setStreams([])
              localStorage.removeItem('last_list')
            }}
            className="p-2 text-neutral-500 hover:text-white transition-colors"
          >
            <Trash2 className="w-6 h-6" />
          </button>
        </header>

        {/* Lista de Canais */}
        <main className="flex-1 p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 overflow-y-auto">
          {filteredStreams.map(stream => (
            <button 
              key={stream.stream_id}
              onClick={() => setActiveStream(stream)}
              className="group flex flex-col text-left animate-in fade-in duration-500"
            >
              <div className="aspect-video bg-neutral-900 rounded-xl mb-3 overflow-hidden relative border border-white/5 group-hover:border-primary/50 transition-all">
                {stream.stream_icon ? (
                  <img src={stream.stream_icon} alt="" className="w-full h-full object-contain p-4" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-700">
                    <Video className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                  <Play className="w-10 h-10 fill-current text-white" />
                </div>
              </div>
              <span className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                {stream.name}
              </span>
            </button>
          ))}
        </main>

        {activeStream && (
          <Player stream={activeStream} onBack={() => setActiveStream(null)} />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-primary/30">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Play className="w-6 h-6 text-primary-foreground fill-current" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">Super<span className="text-primary">Tech</span></span>
          </div>
          <button 
            onClick={() => setIsLoginOpen(true)}
            className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-all shadow-glow"
          >
            Acessar Player
          </button>
        </div>
      </nav>

      <main>
        <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
          </div>
          <div className="container relative z-10 px-4 mx-auto text-center">
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/50 animate-in fade-in slide-in-from-bottom-6 duration-1000">
              Assista sua Lista IPTV <br />
              Com Design Premium
            </h1>
            <button 
              onClick={() => setIsLoginOpen(true)}
              className="mt-8 px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-all shadow-glow group inline-flex items-center gap-2"
            >
              Acessar com sua Lista
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </main>
      
      {isLoginOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white">Acessar Player</h2>
              <button onClick={() => setIsLoginOpen(false)} className="text-neutral-500 hover:text-white">
                <Monitor className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-400">URL M3U</label>
                <textarea
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://safawe.space/get.php?username=..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:border-primary/50 transition-all min-h-[100px]"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                {loading ? 'Carregando...' : 'Entrar no Player'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
