import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppHeader, type AppView } from './components/AppHeader';
import { AuthView } from './components/AuthView';
import { DashboardSidebar } from './components/DashboardSidebar';
import { SetupNotice } from './components/SetupNotice';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { ChallengeProvider, useChallengeData } from './providers/ChallengeProvider';
import { CommunityProvider } from './providers/CommunityProvider';
import { ThemeProvider, useTheme } from './providers/ThemeProvider';
import { ToastProvider } from './providers/ToastProvider';
import { isSupabaseConfigured } from './lib/supabase';

const AdminRoute = lazy(() => import('./routes/AdminRoute').then((module) => ({ default: module.AdminRoute })));
const CommunityRoute = lazy(() => import('./routes/CommunityRoute').then((module) => ({ default: module.CommunityRoute })));
const DashboardRoute = lazy(() => import('./routes/DashboardRoute').then((module) => ({ default: module.DashboardRoute })));
const ExploreRoute = lazy(() => import('./routes/ExploreRoute').then((module) => ({ default: module.ExploreRoute })));
const SettingsRoute = lazy(() => import('./routes/SettingsRoute').then((module) => ({ default: module.SettingsRoute })));
const TodayRoute = lazy(() => import('./routes/TodayRoute').then((module) => ({ default: module.TodayRoute })));

const viewToPath: Record<AppView, string> = {
  dashboard: '/dashboard',
  explore: '/explore',
  today: '/today',
  community: '/community',
  settings: '/settings',
  admin: '/admin',
};

function viewFromPath(pathname: string): AppView {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/community')) return 'community';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/today') || pathname.startsWith('/challenge')) return 'today';
  if (pathname.startsWith('/explore')) return 'explore';
  return 'dashboard';
}

function AppGate() {
  const { booting, session } = useAuth();

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (booting) return <main className="setup-screen"><p className="loading-pill">Loading session...</p></main>;
  if (!session) return <AuthView />;

  return (
    <ChallengeProvider>
      <CommunityProvider>
        <AppShell />
      </CommunityProvider>
    </ChallengeProvider>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { profile, loadingData, error, setError, clearUserData } = useChallengeData();
  const activeView = viewFromPath(location.pathname);

  function handleChangeView(view: AppView) {
    navigate(viewToPath[view]);
  }

  async function handleSignOut() {
    await signOut();
    clearUserData();
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="app-shell" id="top">
      <AppHeader
        activeView={activeView}
        profile={profile}
        theme={theme}
        onChangeView={handleChangeView}
        onToggleTheme={toggleTheme}
        onSignOut={handleSignOut}
      />

      {error ? (
        <div className="global-alert" role="alert">
          {error}
          <button
            className="ghost-button"
            type="button"
            style={{ marginLeft: '1rem', padding: '0.3rem 0.7rem', fontSize: '0.85rem' }}
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {loadingData ? <p className="loading-pill">Syncing challenge data...</p> : null}

      {profile?.account_status && profile.account_status !== 'active' ? (
        <div className="global-alert" role="alert">
          Your account is <strong>{profile.account_status}</strong>. Server-side policies may block check-ins, reports, and community actions.
        </div>
      ) : null}

      <div className="dashboard-frame">
        <DashboardSidebar
          activeView={activeView}
          profile={profile}
          theme={theme}
          onChangeView={handleChangeView}
          onToggleTheme={toggleTheme}
        />
        <div className="dashboard-content">
          <Suspense fallback={<p className="loading-pill">Loading view...</p>}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={(
                  <DashboardRoute
                    onOpenToday={() => navigate('/today')}
                    onOpenExplore={() => navigate('/explore')}
                    onOpenSettings={() => navigate('/settings')}
                  />
                )}
              />
              <Route path="/explore" element={<ExploreRoute />} />
              <Route path="/today" element={<TodayRoute />} />
              <Route path="/challenge/:id" element={<TodayRoute />} />
              <Route path="/community" element={<CommunityRoute />} />
              <Route path="/settings" element={<SettingsRoute />} />
              <Route path="/admin" element={<AdminRoute />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <AppGate />
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
