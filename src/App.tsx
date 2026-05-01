import { useState, lazy, Suspense } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ProfileSelection } from './components/ProfileSelection';
import { SyncScreen } from './components/SyncScreen';
import { Loader2 } from 'lucide-react';

const ContentExplorer = lazy(() => import('./components/ContentExplorer').then(module => ({ default: module.ContentExplorer })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(module => ({ default: module.AdminPanel })));

const LoadingView = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
  </div>
);

type View = 'login' | 'profiles' | 'sync' | 'dashboard' | 'live' | 'movie' | 'series' | 'settings' | 'admin';

interface Profile {
  id: string;
  profile_name: string;
  avatar_url: string;
}

function App() {
  const [currentView, setCurrentView] = useState<View>('login');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const handleLogin = () => {
    setCurrentView('profiles');
  };

  const handleProfileSelect = (profile: Profile) => {
    setSelectedProfile(profile);
    setCurrentView('sync');
  };

  const handleSyncComplete = () => {
    setCurrentView('dashboard');
  };

  const handleAdminLogin = () => {
    setCurrentView('admin');
  };

  const handleLogout = () => {
    setSelectedProfile(null);
    setCurrentView('login');
  };

  const handleNavigate = (view: View) => {
    setCurrentView(view);
  };

  return (
    <>
      {currentView === 'login' && (
        <Login 
          onLogin={handleLogin} 
          onAdminLogin={handleAdminLogin}
        />
      )}

      {currentView === 'profiles' && (
        <ProfileSelection 
          onSelect={handleProfileSelect}
        />
      )}

      {currentView === 'sync' && (
        <SyncScreen 
          profileName={selectedProfile?.profile_name || ''}
          onComplete={handleSyncComplete}
        />
      )}
      
      {currentView === 'dashboard' && (
        <Dashboard 
          profile={selectedProfile}
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

      {currentView === 'admin' && (
        <AdminPanel onBack={() => setCurrentView('login')} />
      )}

      {currentView === 'settings' && (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
          <h2 className="text-4xl font-black mb-4 uppercase tracking-widest">Configurações</h2>
          <p className="text-zinc-500 mb-8 max-w-md">Painel de configurações do usuário em desenvolvimento.</p>
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
