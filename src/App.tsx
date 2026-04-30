import { useState } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

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
      
      {/* Mocking other views for now */}
      {(currentView === 'live' || currentView === 'movie' || currentView === 'series') && (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
          <h2 className="text-4xl font-black mb-4 uppercase tracking-widest">{currentView} Content</h2>
          <p className="text-zinc-500 mb-8 max-w-md">Esta funcionalidade está sendo implementada para carregar os dados do seu servidor Xtream Codes.</p>
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
