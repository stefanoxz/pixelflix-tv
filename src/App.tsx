import { useState } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ContentExplorer } from './components/ContentExplorer';

type View = 'login' | 'dashboard' | 'live' | 'movie' | 'series' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('login');

  const handleLogin = () => {
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setCurrentView('login');
  };

  const handleNavigate = (view: View) => {
    setCurrentView(view);
  };

  return (
    <>
      {currentView === 'login' && <Login onLogin={handleLogin} />}
      
      {currentView === 'dashboard' && (
        <Dashboard 
          onLogout={handleLogout} 
          onNavigate={(view) => handleNavigate(view as View)} 
        />
      )}
      
      {(currentView === 'live' || currentView === 'movie' || currentView === 'series') && (
        <ContentExplorer 
          type={currentView as 'live' | 'movie' | 'series'} 
          onBack={() => setCurrentView('dashboard')} 
        />
      )}

      {currentView === 'settings' && (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
          <h2 className="text-4xl font-black mb-4 uppercase tracking-widest">Configurações</h2>
          <p className="text-zinc-500 mb-8 max-w-md">Painel de configurações em desenvolvimento.</p>
          <button 
            onClick={() => setCurrentView('dashboard')}
            className="px-8 py-4 bg-white text-black font-black rounded-2xl hover:bg-zinc-200 transition-all"
          >
            Voltar ao Dashboard
          </button>
        </div>
      )}
    </>
  );
}

export default App;
