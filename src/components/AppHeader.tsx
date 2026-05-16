import type { Theme } from '../lib/types';
import type { Profile } from '../lib/types';

export type AppView = 'dashboard' | 'explore' | 'today' | 'community' | 'settings' | 'admin';

interface AppHeaderProps {
  activeView: AppView;
  profile: Profile | null;
  theme: Theme;
  onChangeView: (view: AppView) => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
}

export function AppHeader({ activeView, profile, theme, onChangeView, onToggleTheme, onSignOut }: AppHeaderProps) {
  const canModerate = profile?.role === 'super_admin' || profile?.role === 'moderator';
  const hasActiveChallenge = true; // header doesn't need this — sidebar/today view handles it

  return (
    <header className="app-header">
      <a className="brand" href="#top" aria-label="75 Day Habit home">
        <span className="brand-mark">75</span>
        <span>
          <strong>Habit Challenge</strong>
          <small>Daily discipline community</small>
        </span>
      </a>

      <nav className="app-nav" aria-label="Primary navigation">
        <button
          className={activeView === 'dashboard' ? 'active' : ''}
          type="button"
          onClick={() => onChangeView('dashboard')}
          id="nav-dashboard"
        >
          Dashboard
        </button>
        <button
          className={activeView === 'explore' ? 'active' : ''}
          type="button"
          onClick={() => onChangeView('explore')}
          id="nav-explore"
        >
          Explore
        </button>
        <button
          className={activeView === 'today' ? 'active' : ''}
          type="button"
          onClick={() => onChangeView('today')}
          id="nav-today"
        >
          Today
        </button>
        <button
          className={activeView === 'community' ? 'active' : ''}
          type="button"
          onClick={() => onChangeView('community')}
          id="nav-community"
        >
          Community
        </button>
        <button
          className={activeView === 'settings' ? 'active' : ''}
          type="button"
          onClick={() => onChangeView('settings')}
          id="nav-settings"
        >
          Privacy
        </button>
        {canModerate ? (
          <button
            className={activeView === 'admin' ? 'active' : ''}
            type="button"
            onClick={() => onChangeView('admin')}
            id="nav-admin"
          >
            {profile?.role === 'super_admin' ? 'Admin' : 'Moderation'}
          </button>
        ) : null}
      </nav>

      <div className="header-user">
        <button
          className="ghost-button theme-toggle"
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          id="theme-toggle"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <span>{profile?.display_name ?? 'Member'} · {profile?.role.replace('_', ' ') ?? 'user'}</span>
        <button className="ghost-button" type="button" onClick={onSignOut} id="sign-out-btn">
          Log out
        </button>
      </div>
    </header>
  );
}
