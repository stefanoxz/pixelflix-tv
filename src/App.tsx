import { useState } from 'react'
import { Play, Shield, Zap, Search, Globe, Tv, Film, Monitor } from 'lucide-react'

const Hero = () => (
  <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
    <div className="absolute inset-0 z-0">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.15)_0,transparent_70%)] blur-3xl" />
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
        <button className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] group">
          <span className="flex items-center justify-center gap-2">
            Começar Agora
            <Play className="w-4 h-4 fill-current group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>
        <button className="w-full sm:w-auto px-8 py-4 bg-neutral-900 text-white font-semibold rounded-xl border border-neutral-800 hover:bg-neutral-800 transition-all">
          Ver Demonstração
        </button>
      </div>
    </div>
  </div>
)

const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <div className="p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800 hover:border-primary/50 transition-all group">
    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-neutral-500 leading-relaxed">{description}</p>
  </div>
)

const Features = () => (
  <div className="py-24 bg-background">
    <div className="container px-4 mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl lg:text-5xl font-bold mb-4">Por que escolher o SuperTech?</h2>
        <p className="text-neutral-500">Desenvolvido com foco total em performance e facilidade de uso.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <FeatureCard 
          icon={Monitor} 
          title="Interface Moderna" 
          description="Design intuitivo e otimizado para qualquer tamanho de tela, do mobile ao desktop."
        />
        <FeatureCard 
          icon={Zap} 
          title="Streaming Veloz" 
          description="Tecnologia de carregamento inteligente que reduz o buffering ao mínimo possível."
        />
        <FeatureCard 
          icon={Shield} 
          title="100% Seguro" 
          description="Suas credenciais são processadas com criptografia de ponta no backend."
        />
        <FeatureCard 
          icon={Globe} 
          title="Suporte Global" 
          description="Compatível com as principais listas M3U e servidores Xtream do mundo."
        />
        <FeatureCard 
          icon={Search} 
          title="Busca Inteligente" 
          description="Encontre seus canais e conteúdos favoritos em segundos com filtros avançados."
        />
        <FeatureCard 
          icon={Tv} 
          title="Conteúdo HD" 
          description="Suporte a resoluções 4K, Full HD e HD com ajuste automático de bitrate."
        />
      </div>
    </div>
  </div>
)

const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
    <div className="container mx-auto px-4 h-20 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <Play className="w-6 h-6 text-primary-foreground fill-current" />
        </div>
        <span className="text-2xl font-black tracking-tighter">Super<span className="text-primary">Tech</span></span>
      </div>
      
      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
        <a href="#" className="hover:text-white transition-colors">Início</a>
        <a href="#" className="hover:text-white transition-colors">Recursos</a>
        <a href="#" className="hover:text-white transition-colors">Sobre</a>
        <a href="#" className="hover:text-white transition-colors">Contato</a>
      </div>
      
      <div>
        <button className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-all">
          Login
        </button>
      </div>
    </div>
  </nav>
)

function App() {
  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-primary/30">
      <Navbar />
      <main>
        <Hero />
        <Features />
      </main>
      
      <footer className="py-12 border-t border-white/5 bg-neutral-950">
        <div className="container px-4 mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Play className="w-5 h-5 text-primary fill-current" />
            <span className="text-xl font-bold tracking-tighter">SuperTech IPTV</span>
          </div>
          <p className="text-neutral-500 text-sm mb-8">
            © 2026 SuperTech Player. Todos os direitos reservados.
          </p>
          <div className="flex justify-center gap-6 text-neutral-400">
            <a href="#" className="hover:text-primary transition-colors">Privacidade</a>
            <a href="#" className="hover:text-primary transition-colors">Termos</a>
            <a href="#" className="hover:text-primary transition-colors">DMCA</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
