import { useState } from 'react'
import { Play, Settings, List } from 'lucide-react'

function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="inline-block p-4 rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-4">
          <Play className="w-12 h-12 text-primary animate-pulse" />
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight">Novo Começo</h1>
        <p className="text-neutral-400 text-lg">
          O sistema foi reiniciado. Estamos prontos para construir uma base sólida para o seu IPTV.
        </p>

        <div className="grid grid-cols-1 gap-4 mt-8">
          <div className="p-6 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-primary/50 transition-colors group">
            <List className="w-6 h-6 mb-2 text-neutral-500 group-hover:text-primary transition-colors" />
            <h3 className="font-semibold">Listas M3U</h3>
            <p className="text-sm text-neutral-500">Suporte completo a carregamento e parsing de playlists.</p>
          </div>
          <div className="p-6 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-primary/50 transition-colors group">
            <Settings className="w-6 h-6 mb-2 text-neutral-500 group-hover:text-primary transition-colors" />
            <h3 className="font-semibold">Configuração Limpa</h3>
            <p className="text-sm text-neutral-500">Arquitetura modular focada em performance e segurança.</p>
          </div>
        </div>

        <div className="pt-8">
          <p className="text-xs text-neutral-600 uppercase tracking-widest font-medium">Aguardando suas instruções...</p>
        </div>
      </div>
    </div>
  )
}

export default App
