import { useState, FormEvent } from 'react'
import { Play, Shield, Zap, Search, Globe, Tv, Monitor, KeyRound, UserIcon, Link2, ArrowRight, Loader2 } from 'lucide-react'

const Navbar = ({ onLoginClick }: { onLoginClick: () => void }) => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
    <div className="container mx-auto px-4 h-20 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <Play className="w-6 h-6 text-primary-foreground fill-current" />
        </div>
        <span className="text-2xl font-black tracking-tighter text-white">Super<span className="text-primary">Tech</span></span>
      </div>
      
      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
        <a href="#" className="hover:text-white transition-colors">Início</a>
        <a href="#" className="hover:text-white transition-colors">Recursos</a>
        <a href="#" className="hover:text-white transition-colors">Sobre</a>
      </div>
      
      <div>
        <button 
          onClick={onLoginClick}
          className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-all shadow-glow"
        >
          Acessar Player
        </button>
      </div>
    </div>
  </nav>
)

const Hero = ({ onLoginClick }: { onLoginClick: () => void }) => (
  <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
    <div className="absolute inset-0 z-0">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0,transparent_70%)] blur-3xl" />
    </div>
    
    <div className="container relative z-10 px-4 mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 text-sm font-medium rounded-full bg-primary/10 border border-primary/20 text-primary animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Zap className="w-4 h-4" />
        <span>O WebPlayer mais rápido do mercado</span>
      </div>
      
      <h1 className="text-5xl lg:text-7xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/50 animate-in fade-in slide-in-from-bottom-6 duration-1000">
        Sua Experiência IPTV <br className="hidden lg:block" />
        Definitiva Começa Aqui
      </h1>
      
      <p className="max-w-2xl mx-auto text-lg text-neutral-400 mb-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
        Assista a milhares de canais ao vivo, filmes e séries diretamente do seu navegador. 
        Sem instalações complicadas, apenas diversão instantânea.
      </p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
        <button 
          onClick={onLoginClick}
          className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all shadow-glow group"
        >
          <span className="flex items-center justify-center gap-2">
            Acessar com sua Lista
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>
      </div>
    </div>
  </div>
)

const LoginOverlay = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Simula processamento da lista
    setTimeout(() => {
      setLoading(false)
      alert("Conectando à lista: " + url + "\n(Em breve: redirecionamento para o player)")
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-white">Acessar Player</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <Monitor className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-400">Cole sua URL M3U ou Xtream</label>
            <div className="relative">
              <Link2 className="absolute left-3 top-3.5 w-5 h-5 text-neutral-500" />
              <textarea
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://servidor.com/get.php?username=...&password=..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-neutral-700 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all min-h-[120px] resize-none"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-all shadow-glow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {loading ? 'Validando Lista...' : 'Carregar Conteúdo'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Suas credenciais são processadas de forma segura e não ficam armazenadas em nossos servidores.
        </p>
      </div>
    </div>
  )
}

function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-primary/30">
      <Navbar onLoginClick={() => setIsLoginOpen(true)} />
      <main>
        <Hero onLoginClick={() => setIsLoginOpen(true)} />
      </main>
      
      <LoginOverlay isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      
      <footer className="py-12 border-t border-white/5 bg-neutral-950">
        <div className="container px-4 mx-auto text-center">
          <p className="text-neutral-500 text-sm">
            © 2026 SuperTech IPTV. Design Premium para sua diversão.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
