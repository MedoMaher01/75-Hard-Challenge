import { useEffect, useState } from 'react';
import {
  changeUserRole,
  loadAdminAnalytics,
  loadAdminUsers,
  loadAuditLogs,
  loadManageableTemplates,
  loadModerationReports,
  moderateReflection,
  setUserStatus,
  updateChallengeTemplate,
  updateSystemSetting,
  warnUser,
} from '../lib/api';
import { formatTimestamp } from '../lib/dates';
import type {
  AccountStatus,
  AdminAnalytics,
  AdminUser,
  AuditLogEntry,
  ModerationReport,
  Profile,
  TemplateWithHabits,
  UserRole,
} from '../lib/types';
import type { ToastTone } from './ToastHost';

type AdminSection = 'overview' | 'users' | 'moderation' | 'templates' | 'settings' | 'audit';

interface AdminDashboardProps {
  profile: Profile;
  onNotify: (message: string, tone?: ToastTone) => void;
  onRefreshApp: () => void;
}

const roleOptions: UserRole[] = ['user', 'moderator', 'super_admin'];

function defaultSuspensionEnd() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

function normalizeReason(value: string | null, fallback: string) {
  return value?.trim() || fallback;
}

export function AdminDashboard({ profile, onNotify, onRefreshApp }: AdminDashboardProps) {
  const isSuperAdmin = profile.role === 'super_admin';
  const [section, setSection] = useState<AdminSection>('overview');
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [templates, setTemplates] = useState<TemplateWithHabits[]>([]);
  const [search, setSearch] = useState('');
  const [deadlineHours, setDeadlineHours] = useState('4');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sections: Array<{ key: AdminSection; label: string; superOnly?: boolean }> = [
    { key: 'overview', label: 'Analytics' },
    { key: 'users', label: 'Users' },
    { key: 'moderation', label: 'Reports' },
    { key: 'templates', label: 'Templates', superOnly: true },
    { key: 'settings', label: 'Settings', superOnly: true },
    { key: 'audit', label: 'Audit logs', superOnly: true },
  ];

  async function loadDashboard(nextSearch = search) {
    setLoading(true);
    setError(null);
    try {
      const [nextAnalytics, nextUsers, nextReports] = await Promise.all([
        loadAdminAnalytics(),
        loadAdminUsers(nextSearch),
        loadModerationReports('open'),
      ]);
      setAnalytics(nextAnalytics);
      setUsers(nextUsers);
      setReports(nextReports);

      if (isSuperAdmin) {
        const [nextAuditLogs, nextTemplates] = await Promise.all([loadAuditLogs(), loadManageableTemplates()]);
        setAuditLogs(nextAuditLogs);
        setTemplates(nextTemplates);
      } else {
        setAuditLogs([]);
        setTemplates([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load management dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard('');
  }, [isSuperAdmin]);

  async function withAction(action: () => Promise<void>, success: string) {
    setError(null);
    try {
      await action();
      onNotify(success, 'success');
      await loadDashboard();
      onRefreshApp();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Action failed.';
      setError(message);
      onNotify(message, 'error');
    }
  }

  async function handleRoleChange(user: AdminUser, role: UserRole) {
    const reason = normalizeReason(window.prompt(`Reason for changing @${user.username} to ${role}?`), 'Role updated');
    await withAction(() => changeUserRole(user.id, role, reason), 'Role updated and audited.');
  }

  async function handleStatusChange(user: AdminUser, status: AccountStatus) {
    const reason = normalizeReason(window.prompt(`Reason for ${status} action on @${user.username}?`), 'Account status updated');
    await withAction(
      () => setUserStatus({
        userId: user.id,
        status,
        suspendedUntil: status === 'suspended' ? defaultSuspensionEnd() : null,
        reason,
      }),
      'Account status updated and audited.',
    );
  }

  async function handleWarn(user: AdminUser) {
    const reason = normalizeReason(window.prompt(`Warning reason for @${user.username}?`), 'Policy warning');
    await withAction(() => warnUser(user.id, reason), 'Warning recorded.');
  }

  async function handleModeration(report: ModerationReport, action: 'hide' | 'unhide' | 'delete' | 'dismiss_report') {
    if (!report.reflection_id) return;
    const reason = normalizeReason(window.prompt(`Reason for ${action.replace('_', ' ')}?`), 'Moderation action');
    await withAction(() => moderateReflection(report.reflection_id as string, action, reason), 'Moderation action completed.');
  }

  async function handleTemplateUpdate(template: TemplateWithHabits, patch: Partial<Pick<TemplateWithHabits, 'name' | 'description' | 'is_active' | 'strict_mode'>>) {
    await withAction(
      () => updateChallengeTemplate({
        id: template.id,
        name: patch.name ?? template.name,
        description: patch.description ?? template.description,
        is_active: patch.is_active ?? template.is_active,
        strict_mode: patch.strict_mode ?? template.strict_mode,
      }),
      'Template updated.',
    );
  }

  async function handleSettingSave() {
    const value = Number(deadlineHours);
    if (!Number.isFinite(value) || value < 0 || value > 24) {
      setError('Deadline must be a number between 0 and 24 hours.');
      return;
    }
    await withAction(
      () => updateSystemSetting('checkin_deadline_hours', value, 'Hours after midnight UTC when yesterday check-ins remain editable.'),
      'System setting updated.',
    );
  }

  return (
    <main className="admin-dashboard">
      <section className="panel admin-hero" aria-labelledby="admin-title">
        <div>
          <p className="eyebrow">Protected management</p>
          <h1 id="admin-title">{isSuperAdmin ? 'Admin dashboard' : 'Moderator dashboard'}</h1>
          <p>
            Privileged actions call Supabase RPCs that re-check roles, ownership, and account status before writing data.
          </p>
        </div>
        <span className={isSuperAdmin ? 'danger-badge' : 'soft-badge'}>{profile.role.replace('_', ' ')}</span>
      </section>

      <div className="admin-tabs" role="tablist" aria-label="Management sections">
        {sections.filter((item) => !item.superOnly || isSuperAdmin).map((item) => (
          <button className={section === item.key ? 'active' : ''} key={item.key} type="button" onClick={() => setSection(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <p className="loading-pill">Loading protected dashboard...</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {section === 'overview' ? (
        <section className="panel" aria-labelledby="analytics-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Analytics</p>
              <h2 id="analytics-title">System health</h2>
            </div>
            <button className="ghost-button" type="button" onClick={() => loadDashboard()}>
              Refresh
            </button>
          </div>
          <div className="metric-grid wide-metrics">
            <article className="metric-card accent-card"><span>Total users</span><strong>{analytics?.total_users ?? 0}</strong><small>registered profiles</small></article>
            <article className="metric-card"><span>Active users</span><strong>{analytics?.active_users_7d ?? 0}</strong><small>check-ins last 7 days</small></article>
            <article className="metric-card"><span>Daily check-ins</span><strong>{analytics?.daily_checkins ?? 0}</strong><small>today</small></article>
            <article className="metric-card"><span>Completion rate</span><strong>{analytics?.completion_rate ?? 0}%</strong><small>{analytics?.completed_challenges ?? 0}/{analytics?.total_challenges ?? 0} challenges</small></article>
            <article className="metric-card"><span>Reset events</span><strong>{analytics?.reset_count ?? 0}</strong><small>all time</small></article>
            <article className="metric-card"><span>Open reports</span><strong>{analytics?.open_reports ?? 0}</strong><small>moderation queue</small></article>
          </div>
          <div className="data-card">
            <h3>Most completed habits</h3>
            {analytics?.popular_habits?.length ? (
              <ul className="compact-list">
                {analytics.popular_habits.map((habit) => (
                  <li key={habit.name}><span>{habit.name}</span><strong>{habit.completed_count}</strong></li>
                ))}
              </ul>
            ) : <p className="muted">No habit completion data yet.</p>}
          </div>
        </section>
      ) : null}

      {section === 'users' ? (
        <section className="panel" aria-labelledby="users-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">User management</p>
              <h2 id="users-title">Profiles and status</h2>
            </div>
          </div>
          <form className="inline-search" onSubmit={(event) => { event.preventDefault(); void loadDashboard(search); }}>
            <label>
              Search users
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="username or display name" />
            </label>
            <button className="secondary-action" type="submit">Search</button>
          </form>
          <div className="responsive-table" role="region" aria-label="Users table" tabIndex={0}>
            <table>
              <thead>
                <tr><th>User</th><th>Role</th><th>Status</th><th>Activity</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.display_name}</strong><small>@{user.username}</small></td>
                    <td>
                      {isSuperAdmin ? (
                        <select value={user.role} onChange={(event) => handleRoleChange(user, event.target.value as UserRole)}>
                          {roleOptions.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
                        </select>
                      ) : <span className="soft-badge">{user.role.replace('_', ' ')}</span>}
                    </td>
                    <td><span className={user.account_status === 'active' ? 'success-badge' : 'danger-badge'}>{user.account_status}</span></td>
                    <td><small>{user.challenge_count} challenges, {user.reflection_count} reflections</small></td>
                    <td>
                      <div className="table-actions">
                        <button className="ghost-button" type="button" onClick={() => handleWarn(user)}>Warn</button>
                        <button className="secondary-action" type="button" onClick={() => handleStatusChange(user, 'suspended')}>Suspend 7d</button>
                        {isSuperAdmin ? <button className="ghost-button" type="button" onClick={() => handleStatusChange(user, 'active')}>Activate</button> : null}
                        {isSuperAdmin ? <button className="danger-action" type="button" onClick={() => handleStatusChange(user, 'banned')}>Ban</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {section === 'moderation' ? (
        <section className="panel" aria-labelledby="moderation-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Content moderation</p>
              <h2 id="moderation-title">Open reports</h2>
            </div>
          </div>
          {reports.length ? (
            <div className="feed-list">
              {reports.map((report) => (
                <article className="feed-card" key={report.report_id}>
                  <div className="feed-meta">
                    <strong>@{report.author_username ?? 'unknown'}</strong>
                    <span>{report.reports_count ?? 0} reports - {formatTimestamp(report.created_at)}</span>
                  </div>
                  <p><strong>Reason:</strong> {report.reason}</p>
                  {report.learned_today ? <blockquote>{report.learned_today}</blockquote> : null}
                  {report.reflection_body ? <p>{report.reflection_body}</p> : null}
                  <div className="feed-actions">
                    <span>Reported by @{report.reporter_username ?? 'unknown'}</span>
                    <div className="table-actions">
                      <button className="secondary-action" type="button" disabled={!report.reflection_id || Boolean(report.is_hidden)} onClick={() => handleModeration(report, 'hide')}>Hide</button>
                      <button className="ghost-button" type="button" disabled={!report.reflection_id} onClick={() => handleModeration(report, 'dismiss_report')}>Dismiss</button>
                      {isSuperAdmin ? <button className="danger-action" type="button" disabled={!report.reflection_id} onClick={() => handleModeration(report, 'delete')}>Delete</button> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="muted">No open reports.</p>}
        </section>
      ) : null}

      {section === 'templates' && isSuperAdmin ? (
        <section className="panel" aria-labelledby="templates-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Challenge templates</p>
              <h2 id="templates-title">Manage templates</h2>
            </div>
          </div>
          <div className="template-grid">
            {templates.map((template) => (
              <article className="template-card" key={template.id}>
                <div className="card-meta-row">
                  <span className={template.is_active ? 'success-badge' : 'danger-badge'}>{template.is_active ? 'active' : 'inactive'}</span>
                  <span className={template.strict_mode ? 'danger-badge' : 'soft-badge'}>{template.strict_mode ? 'strict' : 'flexible'}</span>
                </div>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
                <div className="table-actions">
                  <button className="ghost-button" type="button" onClick={() => handleTemplateUpdate(template, { name: normalizeReason(window.prompt('Template name', template.name), template.name) })}>Rename</button>
                  <button className="ghost-button" type="button" onClick={() => handleTemplateUpdate(template, { is_active: !template.is_active })}>{template.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button className="secondary-action" type="button" onClick={() => handleTemplateUpdate(template, { strict_mode: !template.strict_mode })}>Toggle strict</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {section === 'settings' && isSuperAdmin ? (
        <section className="panel" aria-labelledby="settings-admin-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">System settings</p>
              <h2 id="settings-admin-title">Anti-cheat controls</h2>
            </div>
          </div>
          <label className="select-label compact">
            Yesterday check-in deadline hours
            <input type="number" min="0" max="24" value={deadlineHours} onChange={(event) => setDeadlineHours(event.target.value)} />
          </label>
          <p className="muted">The backend rejects future check-ins and past edits after this UTC deadline.</p>
          <button className="primary-action" type="button" onClick={handleSettingSave}>Save setting</button>
        </section>
      ) : null}

      {section === 'audit' && isSuperAdmin ? (
        <section className="panel" aria-labelledby="audit-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Audit logs</p>
              <h2 id="audit-title">Privileged actions</h2>
            </div>
          </div>
          <div className="responsive-table" role="region" aria-label="Audit logs table" tabIndex={0}>
            <table>
              <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Entity</th><th>Time</th></tr></thead>
              <tbody>
                {auditLogs.map((entry) => (
                  <tr key={entry.id}>
                    <td><strong>{entry.action}</strong></td>
                    <td>@{entry.actor_username ?? 'system'}</td>
                    <td>@{entry.target_username ?? 'none'}</td>
                    <td>{entry.entity_type} {entry.entity_id ? `#${entry.entity_id.slice(0, 8)}` : ''}</td>
                    <td>{formatTimestamp(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
