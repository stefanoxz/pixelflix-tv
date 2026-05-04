import { useState, useEffect, lazy, Suspense } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ProfileSelection } from './components/ProfileSelection';
import { SyncScreen } from './components/sync/SyncScreen';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { Loader2 } from 'lucide-react';

import { ContentExplorer } from './components/content/ContentExplorerNew';
// const ContentExplorer = lazy(() => import('./components/content/ContentExplorer').then(module => ({ default: module.ContentExplorer })));
const LiveExplorer = lazy(() => import('./components/live/LiveExplorer').then(module => ({ default: module.LiveExplorer })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(module => ({ default: module.AdminPanel })));
const SettingsMenu = lazy(() => import('./components/settings/SettingsMenu').then(module => ({ default: module.SettingsMenu })));
const SearchView = lazy(() => import('./components/SearchView').then(module => ({ default: module.SearchView })));

const LoadingView = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
  </div>
);

type View = 'login' | 'profiles' | 'sync' | 'dashboard' | 'live' | 'movie' | 'series' | 'settings' | 'admin' | 'search';

interface Profile {
  id: string;
  profile_name: string;
  avatar_url: string;
}

function App() {
  const [currentView, setCurrentView] = useState<View>('login');
  const [searchQuery, setSearchQuery] = useState('');
  const [preselectedChannel, setPreselectedChannel] = useState<any>(null);
  const [preselectedItem, setPreselectedItem] = useState<any>(null);
  const [preselectedCategoryId, setPreselectedCategoryId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(() => {
    const saved = localStorage.getItem('selected_profile');
    return saved ? JSON.parse(saved) : null;
  });

  // Auto-recovery of session on load
  useEffect(() => {
    const creds = localStorage.getItem('xtream_creds');
    if (creds) {
      if (selectedProfile) {
        setCurrentView('dashboard');
      } else {
        setCurrentView('profiles');
      }
    }
  }, [selectedProfile]);

  const handleLogin = () => {
    setCurrentView('profiles');
  };

  const handleProfileSelect = (profile: Profile) => {
    setSelectedProfile(profile);
    localStorage.setItem('selected_profile', JSON.stringify(profile));
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
    localStorage.removeItem('selected_profile');
    localStorage.removeItem('xtream_creds');
    setCurrentView('login');
  };

  const handleNavigate = (view: View, search?: string, data?: any) => {
    if (view === 'live' && data) {
      setPreselectedChannel(data);
      if (data.category_id) setPreselectedCategoryId(String(data.category_id));
      setCurrentView('live');
    } else if ((view === 'movie' || view === 'series') && data) {
      setPreselectedItem(data);
      if (data.category_id) setPreselectedCategoryId(String(data.category_id));
      setCurrentView(view);
    } else {
      setPreselectedCategoryId(null);
      setPreselectedChannel(null);
      setPreselectedItem(null);
      setCurrentView(view);
    }
  };

  return (
    <ErrorBoundary onReset={() => setCurrentView('sync')}>
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
            onNavigate={(view, search, data) => handleNavigate(view as View, search, data)} 
          />
        )}
        
        {currentView === 'live' && (
          <LiveExplorer
            onBack={() => { setPreselectedChannel(null); setPreselectedCategoryId(null); setCurrentView('dashboard'); }}
            preselectedChannel={preselectedChannel}
            initialCategoryId={preselectedCategoryId}
          />
        )}

        {currentView === 'search' && (
          <SearchView 
            onNavigate={handleNavigate}
            onBack={() => setCurrentView('dashboard')}
          />
        )}

        {(currentView === 'movie' || currentView === 'series') && (
          <ContentExplorer 
            type={currentView as 'movie' | 'series'} 
            initialSearch={searchQuery}
            initialItem={preselectedItem}
            initialCategoryId={preselectedCategoryId}
            onBack={() => { setSearchQuery(''); setPreselectedItem(null); setPreselectedCategoryId(null); setCurrentView('dashboard'); }} 
          />
        )}

        {currentView === 'admin' && (
          <AdminPanel onBack={() => handleNavigate('login')} />
        )}

        {currentView === 'settings' && (
          <SettingsMenu 
            onBack={() => setCurrentView('dashboard')} 
            onLogout={handleLogout}
            onNavigate={(view) => handleNavigate(view as View)}
          />
        )}
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
