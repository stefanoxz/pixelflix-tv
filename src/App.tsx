import { useState, lazy, Suspense } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ProfileSelection } from './components/ProfileSelection';
import { SyncScreen } from './components/sync/SyncScreen';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { Loader2 } from 'lucide-react';

const ContentExplorer = lazy(() => import('./components/content/ContentExplorer').then(module => ({ default: module.ContentExplorer })));
const LiveExplorer = lazy(() => import('./components/live/LiveExplorer').then(module => ({ default: module.LiveExplorer })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(module => ({ default: module.AdminPanel })));
const SettingsMenu = lazy(() => import('./components/settings/SettingsMenu').then(module => ({ default: module.SettingsMenu })));

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
    <ErrorBoundary>
      <Suspense fallback={<LoadingView />}>
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
            avatarUrl={selectedProfile?.avatar_url || ''}
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
        
        {currentView === 'live' && (
          <LiveExplorer onBack={() => setCurrentView('dashboard')} />
        )}

        {(currentView === 'movie' || currentView === 'series') && (
          <ContentExplorer 
            type={currentView as 'movie' | 'series'} 
            onBack={() => setCurrentView('dashboard')} 
          />
        )}

        {currentView === 'admin' && (
          <AdminPanel onBack={() => handleNavigate('login')} />
        )}

        {currentView === 'settings' && (
          <SettingsMenu 
            onBack={() => setCurrentView('dashboard')} 
            onLogout={handleLogout}
          />
        )}
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
