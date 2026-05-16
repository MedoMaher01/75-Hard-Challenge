import type { AppView } from './AppHeader';
import type { Profile, Theme } from '../lib/types';

interface DashboardSidebarProps {
  activeView: AppView;
  profile: Profile | null;
  theme: Theme;
  onChangeView: (view: AppView) => void;
  onToggleTheme: () => void;
}

const baseItems: Array<{ view: AppView; label: string; description: string }> = [
  { view: 'dashboard', label: 'Dashboard', description: 'Your stats' },
  { view: 'explore', label: 'Explore', description: 'Browse challenges' },
  { view: 'today', label: 'Today', description: 'Daily check-in' },
  { view: 'community', label: 'Community', description: 'Leaderboard' },
  { view: 'settings', label: 'Privacy', description: 'Account controls' },
];

export function DashboardSidebar({ activeView, profile, theme, onChangeView, onToggleTheme }: DashboardSidebarProps) {
  const canModerate = profile?.role === 'super_admin' || profile?.role === 'moderator';
  const items = canModerate
    ? [...baseItems, { view: 'admin' as AppView, label: profile?.role === 'super_admin' ? 'Admin' : 'Moderation', description: 'Protected tools' }]
    : baseItems;

  return (
    <aside className="dashboard-sidebar" aria-label="Dashboard sections">
      <div className="sidebar-card">
        <p className="eyebrow">Workspace</p>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <button
              className={activeView === item.view ? 'active' : ''}
              key={item.view}
              type="button"
              onClick={() => onChangeView(item.view)}
              id={`sidebar-${item.view}`}
            >
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-card compact-card">
        <span className={(profile?.account_status ?? 'active') === 'active' ? 'success-badge' : 'danger-badge'}>
          {profile?.account_status ?? 'active'}
        </span>
        <strong>{profile?.role.replace('_', ' ') ?? 'user'}</strong>
        <small className="muted">Server-side RLS and RPC checks enforce privileged access.</small>
      </div>

      <div className="sidebar-card compact-card">
        <button
          className="ghost-button theme-toggle-sidebar"
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          id="sidebar-theme-toggle"
        >
          {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
        </button>
      </div>
    </aside>
  );
}
