import { useState, useMemo } from 'react'
import { Search, Menu, X, Play, Zap, Shield, Monitor, ChevronRight } from 'lucide-react'
import { parseM3uUrl } from './services/iptv'
import { Stream } from './types/iptv'
import { useIPTV } from './hooks/useIPTV'
import { Player } from './components/Player'
import { Sidebar } from './components/Sidebar'
import { ChannelGrid } from './components/ChannelGrid'
import { LoginModal } from './components/LoginModal'

function App() {
  const { streams, categories, loading, error, loadList, logout } = useIPTV()
  const [activeCategory, setActiveCategory] = useState<string>('Todos')
  const [activeStream, setActiveStream] = useState<Stream | null>(null)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => streams.filter(s => 
    (activeCategory === 'Todos' || s.category_id === activeCategory) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  ), [streams, activeCategory, search]);

  const handleLogin = async (url: string) => {
    const creds = parseM3uUrl(url)
    if (creds) {
      const success = await loadList(creds)
      if (success) setIsLoginOpen(false)
    } else {
      alert("URL M3U inválida.")
    }
  }

  const handleLogout = () => {
    if(window.confirm('Deseja sair do WebPlayer?')) {
      setActiveStream(null)
      logout()
    }
  }

  const handleDemo = () => {
    const demoUrl = "http://safawe.space/get.php?username=406850266&password=823833547&type=m3u_plus&output=ts"
    handleLogin(demoUrl)
  }

  if (streams.length > 0) {
    return (
      <div className="min-h-screen bg-neutral-950 flex text-neutral-300 font-sans selection:bg-primary/20">
        <Sidebar 
          categories={categories} 
          activeCategory={activeCategory} 
          onSelectCategory={setActiveCategory} 
        />

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[200] lg:hidden animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="absolute top-0 bottom-0 left-0 w-80 bg-neutral-900 border-r border-white/10 p-8 overflow-y-auto animate-in slide-in-from-left duration-500">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3 text-white font-black text-2xl tracking-tighter">
                  <Play className="w-6 h-6 text-primary fill-current" /> SuperTech
                </div>
                <X onClick={() => setIsMobileMenuOpen(false)} className="text-neutral-500 cursor-pointer" />
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
        <main className="flex-1 min-w-0 flex flex-col h-screen">
          <header className="px-6 h-24 border-b border-white/5 flex items-center gap-6 sticky top-0 bg-neutral-950/80 backdrop-blur-xl z-50 shrink-0">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-neutral-400 hover:text-white transition-colors">
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
            <button onClick={handleLogout} className="px-6 h-12 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-xs font-black uppercase tracking-widest text-neutral-400 hover:text-white shrink-0">
              Sair
            </button>
          </header>
          
          <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-black text-white tracking-tighter">{activeCategory}</h1>
                <p className="text-neutral-600 text-sm mt-1">{filtered.length} canais encontrados</p>
              </div>
            </div>

            <ChannelGrid 
              channels={filtered} 
              onSelectChannel={setActiveStream} 
              activeCategory={activeCategory}
            />
          </div>
        </main>
        
        {activeStream && <Player stream={activeStream} onBack={() => setActiveStream(null)} />}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[50vh] bg-gradient-to-b from-primary/10 via-background to-transparent pointer-events-none z-0" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none z-0" />

      <header className="h-24 px-8 flex items-center justify-between relative z-[100]">
        <div className="flex items-center gap-3 font-black text-3xl tracking-tighter cursor-default">
          <Play className="w-7 h-7 text-primary fill-current" /> SuperTech
        </div>
        <button 
          onClick={() => setIsLoginOpen(true)}
          className="px-6 h-12 rounded-2xl bg-primary text-white font-black uppercase text-xs tracking-widest shadow-glow hover:scale-105 active:scale-95 transition-all z-[110] relative cursor-pointer"
        >
          Entrar
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8 relative z-50">
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
              Transformamos sua lista M3U em uma experiêncian cinematográfica fluida, segura e de alta performance diretamente no seu navegador.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom duration-1000 delay-300 relative z-[60]">
            <button 
              onClick={() => setIsLoginOpen(true)} 
              className="w-full sm:w-auto px-10 h-16 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-glow flex items-center justify-center gap-3 cursor-pointer relative z-[70]"
            >
              Acessar Player <ChevronRight className="w-5 h-5" />
            </button>
            <button 
              onClick={handleDemo}
              className="w-full sm:w-auto px-10 h-16 bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 rounded-2xl font-black uppercase tracking-widest text-neutral-400 transition-all cursor-pointer relative z-[70]"
            >
              Ver Demo
            </button>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full animate-in fade-in slide-in-from-bottom duration-1000 delay-500 relative z-[10]">
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

      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
        onLogin={handleLogin} 
        loading={loading}
      />
      
      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] bg-red-500 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl animate-in slide-in-from-bottom duration-300">
          {error}
        </div>
      )}
    </div>
  )
}

export default App
