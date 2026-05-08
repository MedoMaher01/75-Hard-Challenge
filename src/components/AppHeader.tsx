import type { Profile } from '../lib/types';

export type AppView = 'today' | 'community' | 'settings' | 'admin';

interface AppHeaderProps {
  activeView: AppView;
  profile: Profile | null;
  onChangeView: (view: AppView) => void;
  onSignOut: () => void;
}

export function AppHeader({ activeView, profile, onChangeView, onSignOut }: AppHeaderProps) {
  const canModerate = profile?.role === 'admin' || profile?.role === 'moderator';

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
        <button className={activeView === 'today' ? 'active' : ''} type="button" onClick={() => onChangeView('today')}>
          Today
        </button>
        <button
          className={activeView === 'community' ? 'active' : ''}
          type="button"
          onClick={() => onChangeView('community')}
        >
          Community
        </button>
        <button
          className={activeView === 'settings' ? 'active' : ''}
          type="button"
          onClick={() => onChangeView('settings')}
        >
          Privacy
        </button>
        {canModerate ? (
          <button className={activeView === 'admin' ? 'active' : ''} type="button" onClick={() => onChangeView('admin')}>
            Admin
          </button>
        ) : null}
      </nav>

      <div className="header-user">
        <span>{profile?.display_name ?? 'Member'}</span>
        <button className="ghost-button" type="button" onClick={onSignOut}>
          Log out
        </button>
      </div>
    </header>
  );
}
