import { useState, FormEvent, useEffect, useRef } from 'react'
import { Play, Zap, Search, Monitor, Link2, ArrowRight, Loader2, ArrowLeft, Video, Menu, X, Tv, ChevronRight } from 'lucide-react'
import Hls from 'hls.js'
import { parseM3uUrl, fetchM3u, parseM3uToData } from './services/iptv'
import { Stream, Category } from './types/iptv'

const Player = ({ stream, onBack }: { stream: Stream, onBack: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoRef.current || !stream.direct_source) return
    const video = videoRef.current
    if (Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(stream.direct_source)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}))
      return () => hls.destroy()
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.direct_source
      video.play().catch(() => {})
    }
  }, [stream])

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
      <button onClick={onBack} className="absolute top-6 left-6 z-10 p-3 bg-neutral-900/80 hover:bg-neutral-800 rounded-full transition-all">
        <ArrowLeft />
      </button>
      <video ref={videoRef} className="w-full max-w-5xl aspect-video" controls playsInline />
      <div className="mt-4 text-center">
        <h2 className="text-xl font-bold">{stream.name}</h2>
        <p className="text-neutral-500">{stream.category_id}</p>
      </div>
    </div>
  )
}

function App() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('Todos')
  const [activeStream, setActiveStream] = useState<Stream | null>(null)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const loadList = async (creds: any) => {
    setLoading(true)
    try {
      const m3u = await fetchM3u(creds)
      const { streams: s, categories: c } = parseM3uToData(m3u)
      setStreams(s)
      setCategories([{ category_id: 'Todos', category_name: 'Todos' }, ...c])
      setIsLoginOpen(false)
      localStorage.setItem('last_list', JSON.stringify(creds))
    } catch (e) { alert("Erro ao carregar lista.") }
    finally { setLoading(false) }
  }

  const filtered = streams.filter(s => 
    (activeCategory === 'Todos' || s.category_id === activeCategory) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  if (streams.length > 0) {
    return (
      <div className="min-h-screen bg-background flex text-neutral-200">
        <aside className="w-64 border-r border-white/5 bg-neutral-900/50 hidden md:block overflow-y-auto h-screen">
          <div className="p-6 font-bold text-xl flex items-center gap-2 text-white">
            <Play className="text-primary fill-current" /> SuperTech
          </div>
          <nav className="px-4 space-y-1">
            {categories.map(c => (
              <button 
                key={c.category_id}
                onClick={() => setActiveCategory(c.category_id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${activeCategory === c.category_id ? 'bg-primary/10 text-primary' : 'hover:bg-neutral-800'}`}
              >
                {c.category_name}
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <header className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-lg z-20">
            <input 
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar canais..."
              className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 w-96"
            />
            <button onClick={() => { setStreams([]); localStorage.removeItem('last_list') }} className="text-sm hover:text-primary">Sair</button>
          </header>
          
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filtered.map(s => (
              <button key={s.stream_id} onClick={() => setActiveStream(s)} className="group space-y-2">
                <div className="aspect-video bg-neutral-900 rounded-xl border border-white/5 group-hover:border-primary/50 transition-all overflow-hidden relative">
                  {s.stream_icon && <img src={s.stream_icon} className="w-full h-full object-contain p-2" />}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                    <Play className="fill-current w-8 h-8" />
                  </div>
                </div>
                <div className="text-xs font-medium truncate group-hover:text-primary">{s.name}</div>
              </button>
            ))}
          </div>
        </main>
        
        {activeStream && <Player stream={activeStream} onBack={() => setActiveStream(null)} />}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-6xl font-black text-gradient">SuperTech</h1>
        <p className="text-neutral-400">Sua central de entretenimento IPTV.</p>
        <button onClick={() => setIsLoginOpen(true)} className="px-8 py-3 bg-primary rounded-xl font-bold">Acessar Player</button>
      </div>

      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={(e: FormEvent) => {
            e.preventDefault()
            const formData = new FormData(e.target as HTMLFormElement)
            loadList(parseM3uUrl(formData.get('url') as string))
          }} className="bg-neutral-900 p-8 rounded-2xl w-full max-w-md space-y-4">
            <input name="url" placeholder="Cole sua URL M3U..." className="w-full bg-black p-3 rounded-lg border border-neutral-800" />
            <button disabled={loading} className="w-full py-3 bg-primary rounded-lg">{loading ? 'Carregando...' : 'Entrar'}</button>
          </form>
        </div>
      )}
    </div>
  )
}

export default App
