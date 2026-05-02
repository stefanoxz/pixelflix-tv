import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  isLocal?: boolean;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (this.props.isLocal) {
        // Local error fallback (e.g., inside a player or sidebar)
        return (
          <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/50 rounded-3xl border border-red-500/20 text-center w-full h-full min-h-[200px]">
            <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
            <h3 className="text-sm font-bold text-white mb-1 uppercase tracking-wider">Erro neste componente</h3>
            <p className="text-xs text-zinc-500 mb-4 max-w-[200px]">Algo deu errado ao carregar esta parte da interface.</p>
            <button 
              onClick={this.handleReset}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <RefreshCw size={12} /> Tentar Novamente
            </button>
          </div>
        );
      }

      // Global error fallback (app-level crash)
      return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-6 text-center">
          <div className="p-6 rounded-full bg-red-500/10 border border-red-500/20 mb-8 animate-pulse">
            <AlertTriangle className="w-16 h-16 text-red-500" />
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter mb-4">
            Ops! Algo Quebrou.
          </h1>
          
          <p className="text-zinc-500 max-w-lg mb-10 leading-relaxed">
            Um erro inesperado aconteceu e derrubou a aplicação. Nossa equipe de auto-reparo já registrou o problema. 
            Você pode tentar sincronizar os dados ou voltar para a tela inicial.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button 
              onClick={this.handleReset}
              className="px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-zinc-200 transition-all flex items-center gap-3 w-full sm:w-auto justify-center"
            >
              <RefreshCw size={16} /> Sincronizar Agora
            </button>
            <button 
              onClick={this.handleGoHome}
              className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-zinc-800 transition-all border border-white/5 flex items-center gap-3 w-full sm:w-auto justify-center"
            >
              <Home size={16} /> Voltar ao Início
            </button>
          </div>
          
          {/* Detailed Error for Devs (hidden but available) */}
          <details className="mt-12 text-left bg-zinc-900/50 p-4 rounded-2xl border border-white/5 max-w-2xl w-full">
            <summary className="text-xs font-bold text-zinc-500 cursor-pointer uppercase tracking-widest">
              Detalhes Técnicos (Para Suporte)
            </summary>
            <pre className="mt-4 text-[10px] text-red-400 overflow-auto max-h-32 custom-scrollbar p-2 bg-black rounded-lg">
              {this.state.error?.toString()}
              {'\n'}
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
