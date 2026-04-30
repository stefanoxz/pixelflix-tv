import { useState, FormEvent, useEffect, useRef } from 'react'
import { Play, Search, Link2, Loader2, ArrowLeft, Menu, X, ChevronRight, Tv, Settings, Globe, Shield, Zap, Monitor } from 'lucide-react'
import Hls from 'hls.js'
import { parseM3uUrl, fetchM3u, parseM3uToData } from './services/iptv'
import { Stream, Category } from './types/iptv'

const Player = ({ stream, onBack }: { stream: Stream, onBack: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!videoRef.current || !stream.direct_source) return
    const video = videoRef.current
    
    const initPlayer = () => {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true })
        hls.loadSource(stream.direct_source!)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false)
          video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error("HLS Fatal Error:", data)
            setError(true)
            setLoading(false)
          }
        })
        return () => hls.destroy()
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream.direct_source!
        video.addEventListener('loadedmetadata', () => {
          setLoading(false)
          video.play().catch(() => {})
        })
      }
    }
    
    initPlayer()
  }, [stream])

  if (error) return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-8 text-center">
      <Tv className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-xl font-bold">Erro ao reproduzir canal</h2>
      <p className="text-neutral-500 mb-6">O servidor não respondeu ou o stream é incompatível.</p>
      <button onClick={onBack} className="px-6 py-3 bg-white/10 rounded-xl">Voltar para a lista</button>
    </div>
  )


  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
      <button onClick={onBack} className="absolute top-6 left-6 z-10 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all text-white">
        <ArrowLeft className="w-6 h-6" />
      </button>
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-0">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      )}

      <video ref={videoRef} className="w-full h-full object-contain" controls autoPlay playsInline />
      
      <div className="absolute bottom-12 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black text-white mb-2">{stream.name}</h2>
          <span className="px-3 py-1 bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-full uppercase tracking-widest">
            {stream.category_id}
          </span>
        </div>
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('last_list')
    if (saved) {
      try { loadList(JSON.parse(saved)) } catch (e) {}
    }
  }, [])

  const loadList = async (creds: any) => {
    if (!creds) {
      alert("Por favor, insira uma URL M3U válida (ex: http://servidor.com/get.php?username=...)");
      return;
    }
    setLoading(true);
    try {
      console.log("Iniciando sincronização da lista...");
      const m3u = await fetchM3u(creds);
      const { streams: s, categories: c } = parseM3uToData(m3u);
      
      if (s.length === 0) {
        alert("A lista foi carregada, mas não encontramos nenhum canal. Verifique se o usuário/senha estão corretos.");
        return;
      }

      setStreams(s);
      setCategories([{ category_id: 'Todos', category_name: 'Todos' }, ...c]);
      setIsLoginOpen(false);
      localStorage.setItem('last_list', JSON.stringify(creds));
      console.log("Lista carregada com sucesso:", s.length, "canais.");
    } catch (e) { 
      console.error("Erro no loadList:", e);
      alert("Erro ao conectar com o servidor IPTV. Isso pode ser um bloqueio de CORS ou o servidor está offline."); 
    } finally { 
      setLoading(false); 
    }
  }

  const filtered = streams.filter(s => 
    (activeCategory === 'Todos' || s.category_id === activeCategory) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleLogout = () => {
    if(confirm('Deseja sair do WebPlayer?')) {
      setStreams([])
      localStorage.removeItem('last_list')
    }
  }

  if (streams.length > 0) {
    return (
      <div className="min-h-screen bg-neutral-950 flex text-neutral-300 font-sans">
        {/* Sidebar Desktop */}
        <aside className="w-72 border-r border-white/5 bg-neutral-900/20 backdrop-blur-xl hidden lg:flex flex-col h-screen sticky top-0 overflow-hidden">
          <div className="p-8 border-b border-white/5">
            <div className="flex items-center gap-3 text-white font-black text-2xl tracking-tighter">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-glow">
                <Play className="w-6 h-6 text-white fill-current" />
              </div>
              Super<span className="text-primary">Tech</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
            <h3 className="px-4 text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-4">Categorias</h3>
            {categories.map(c => (
              <button 
                key={c.category_id}
                onClick={() => setActiveCategory(c.category_id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group ${activeCategory === c.category_id ? 'bg-primary text-white shadow-glow' : 'hover:bg-white/5 hover:text-white'}`}
              >
                <span className="text-sm font-bold truncate">{c.category_name}</span>
                <ChevronRight className={`w-4 h-4 transition-transform ${activeCategory === c.category_id ? 'translate-x-0' : '-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'}`} />
              </button>
            ))}
          </div>
        </aside>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[150] lg:hidden animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="absolute top-0 bottom-0 left-0 w-80 bg-neutral-900 border-r border-white/10 p-8 overflow-y-auto animate-in slide-in-from-left duration-500">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3 text-white font-black text-2xl tracking-tighter">
                  <Play className="w-6 h-6 text-primary fill-current" /> SuperTech
                </div>
                <X onClick={() => setIsMobileMenuOpen(false)} className="text-neutral-500" />
              </div>
              <div className="space-y-1">
                {categories.map(c => (
                  <button 
                    key={c.category_id}
                    onClick={() => { setActiveCategory(c.category_id); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${activeCategory === c.category_id ? 'bg-primary text-white shadow-glow' : 'text-neutral-500'}`}
                  >
                    <span className="text-sm font-bold">{c.category_name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <header className="px-6 h-24 border-b border-white/5 flex items-center gap-6 sticky top-0 bg-neutral-950/80 backdrop-blur-xl z-50">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-neutral-400">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1 max-w-2xl relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-primary transition-colors" />
              <input 
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Qual canal vamos assistir hoje?"
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-neutral-600 focus:bg-white/10 focus:border-primary/50 transition-all outline-none"
              />
            </div>
            <button onClick={handleLogout} className="px-6 h-12 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-xs font-black uppercase tracking-widest text-neutral-400 hover:text-white">
              Sair
            </button>
          </header>
          
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-black text-white tracking-tighter">{activeCategory}</h1>
                <p className="text-neutral-600 text-sm mt-1">{filtered.length} canais encontrados</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 gap-6">
              {filtered.map(s => (
                <button 
                  key={s.stream_id} 
                  onClick={() => setActiveStream(s)} 
                  className="group flex flex-col gap-3 text-left transition-all duration-500"
                >
                  <div className="aspect-video bg-neutral-900 rounded-3xl border border-white/5 group-hover:border-primary group-hover:shadow-glow transition-all overflow-hidden relative shadow-2xl">
                    <div className="absolute inset-0 bg-neutral-800 animate-pulse z-0" />
                    {s.stream_icon && (
                      <img 
                        src={s.stream_icon} 
                        className="w-full h-full object-contain p-6 relative z-10 group-hover:scale-110 transition-transform duration-500" 
                        loading="lazy" 
                      />
                    )}
                    {!s.stream_icon && (
                      <div className="w-full h-full flex items-center justify-center relative z-10 text-neutral-700">
                        <Tv className="w-12 h-12" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 z-20">
                      <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-glow animate-in zoom-in duration-300">
                        <Play className="fill-current w-6 h-6 text-white ml-1" />
                      </div>
                    </div>
                  </div>
                  <div className="px-2">
                    <div className="text-sm font-black text-neutral-400 group-hover:text-white truncate transition-colors">{s.name}</div>
                    <div className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mt-1">{s.category_id}</div>
                  </div>
                </button>
              ))}
            </div>
            
            {filtered.length === 0 && (
              <div className="py-32 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                  <Search className="w-8 h-8 text-neutral-600" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Nenhum canal encontrado</h3>
                <p className="text-neutral-600 max-w-xs">Tente ajustar sua busca ou mudar de categoria.</p>
              </div>
            )}
          </div>
        </main>
        
        {activeStream && <Player stream={activeStream} onBack={() => setActiveStream(null)} />}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col relative overflow-hidden">
      {/* Background Decor - Adicionado pointer-events-none para não bloquear cliques */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[50vh] bg-gradient-to-b from-primary/10 via-background to-transparent pointer-events-none z-0" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none z-0" />

      <header className="h-24 px-8 flex items-center justify-between relative z-50">
        <div className="flex items-center gap-3 font-black text-3xl tracking-tighter">
          <Play className="w-7 h-7 text-primary fill-current" /> SuperTech
        </div>
        <button 
          onClick={() => setIsLoginOpen(true)}
          className="px-6 h-12 rounded-2xl bg-primary text-white font-black uppercase text-xs tracking-widest shadow-glow hover:scale-105 transition-all"
        >
          Entrar
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
        <div className="max-w-3xl text-center space-y-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-xs font-black text-primary uppercase tracking-[0.2em] animate-in fade-in slide-in-from-bottom duration-700">
            <Zap className="w-4 h-4 fill-current" /> O Futuro do Streaming é Web
          </div>
          
          <div className="space-y-6">
            <h1 className="text-7xl md:text-8xl font-black text-white tracking-tighter leading-[0.9] animate-in fade-in slide-in-from-bottom duration-1000">
              Sua Experiência <br />
              <span className="text-primary italic">IPTV</span> Definitiva
            </h1>
            <p className="text-xl text-neutral-500 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom duration-1000 delay-200">
              Transformamos sua lista M3U em uma experiência cinematográfica fluida, segura e de alta performance diretamente no seu navegador.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom duration-1000 delay-300">
            <button 
              onClick={() => {
                console.log("Abrindo modal de login...");
                setIsLoginOpen(true);
              }} 
              className="w-full sm:w-auto px-10 h-16 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-glow flex items-center justify-center gap-3"
            >
              Acessar Player <ChevronRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                const demoUrl = "http://safawe.space/get.php?username=406850266&password=823833547&type=m3u_plus&output=ts";
                loadList(parseM3uUrl(demoUrl));
              }}
              className="w-full sm:w-auto px-10 h-16 bg-white/5 border border-white/5 hover:bg-white/10 rounded-2xl font-black uppercase tracking-widest text-neutral-400 transition-all"
            >
              Ver Demo
            </button>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full animate-in fade-in slide-in-from-bottom duration-1000 delay-500">
          <div className="p-8 bg-white/5 rounded-[40px] border border-white/5 space-y-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center"><Zap className="text-primary" /></div>
            <h4 className="text-xl font-bold text-white tracking-tight">Ultra Veloz</h4>
            <p className="text-neutral-500 text-sm leading-relaxed">Carregamento instantâneo de listas com motor de processamento assíncrono.</p>
          </div>
          <div className="p-8 bg-white/5 rounded-[40px] border border-white/5 space-y-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center"><Shield className="text-primary" /></div>
            <h4 className="text-xl font-bold text-white tracking-tight">Privacidade Total</h4>
            <p className="text-neutral-500 text-sm leading-relaxed">Suas credenciais são processadas localmente e nunca tocam nossos discos.</p>
          </div>
          <div className="p-8 bg-white/5 rounded-[40px] border border-white/5 space-y-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center"><Monitor className="text-primary" /></div>
            <h4 className="text-xl font-bold text-white tracking-tight">Multi-plataforma</h4>
            <p className="text-neutral-500 text-sm leading-relaxed">Adaptado para Smart TVs, Tablets, PCs e Smartphones sem apps extras.</p>
          </div>
        </div>
      </main>

      {isLoginOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-neutral-900 border border-white/5 p-10 rounded-[48px] w-full max-w-xl space-y-8 shadow-2xl relative">
            <button onClick={() => setIsLoginOpen(false)} className="absolute top-8 right-8 text-neutral-500 hover:text-white"><X /></button>
            
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-white tracking-tighter">Entrar no <span className="text-primary italic">Cloud</span></h2>
              <p className="text-neutral-500 font-medium">Insira o endereço completo da sua playlist M3U.</p>
            </div>

            <form onSubmit={(e: FormEvent) => {
              e.preventDefault();
              try {
                const formData = new FormData(e.target as HTMLFormElement);
                const urlValue = formData.get('url') as string;
                console.log("Processando URL:", urlValue);
                const creds = parseM3uUrl(urlValue);
                loadList(creds);
              } catch (err) {
                console.error("Erro no submit:", err);
                alert("Ocorreu um erro ao processar a lista.");
              }
            }} className="space-y-6">
              <div className="relative group">
                <Link2 className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-primary transition-colors" />
                <input 
                  name="url" 
                  autoFocus
                  placeholder="http://safawe.space/get.php?username=..." 
                  className="w-full bg-black border border-white/5 rounded-[24px] py-6 pl-14 pr-6 text-white placeholder:text-neutral-700 focus:border-primary/50 transition-all outline-none" 
                />
              </div>
              <button 
                disabled={loading} 
                className="w-full h-20 bg-primary text-white rounded-[24px] font-black uppercase tracking-[0.2em] shadow-glow flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Sincronizar Lista'}
              </button>
            </form>
            <p className="text-center text-[10px] font-black text-neutral-700 uppercase tracking-widest">Tecnologia SuperTech de Sincronização em Nuvem</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
