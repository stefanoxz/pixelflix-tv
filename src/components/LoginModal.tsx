import { FormEvent } from 'react'
import { X, Link2, Loader2 } from 'lucide-react'
import { parseM3uUrl } from '../services/iptv'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLogin: (url: string) => void
  loading: boolean
}

export const LoginModal = ({ isOpen, onClose, onLogin, loading }: LoginModalProps) => {
  if (!isOpen) return null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const urlValue = formData.get('url') as string
    if (urlValue) onLogin(urlValue)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-neutral-900 border border-white/5 p-10 rounded-[48px] w-full max-w-xl space-y-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-8 right-8 text-neutral-500 hover:text-white transition-colors z-10 cursor-pointer">
          <X />
        </button>
        
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-white tracking-tighter">Entrar no <span className="text-primary italic">Cloud</span></h2>
          <p className="text-neutral-500 font-medium">Insira o endereço completo da sua playlist M3U.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative group">
            <Link2 className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-primary transition-colors pointer-events-none" />
            <input 
              name="url" 
              autoFocus
              placeholder="http://safawe.space/get.php?username=..." 
              className="w-full bg-black border border-white/5 rounded-[24px] py-6 pl-14 pr-6 text-white placeholder:text-neutral-700 focus:border-primary/50 transition-all outline-none" 
              required
            />
          </div>
          <button 
            disabled={loading} 
            className="w-full h-20 bg-primary text-white rounded-[24px] font-black uppercase tracking-[0.2em] shadow-glow flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:scale-105 transition-transform"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Sincronizar Lista'}
          </button>
        </form>
        <p className="text-center text-[10px] font-black text-neutral-700 uppercase tracking-widest">Tecnologia SuperTech de Sincronização em Nuvem</p>
      </div>
    </div>
  )
}
