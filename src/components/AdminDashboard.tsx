import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  changeUserRole,
  createChallengeTemplate,
  deleteChallengeTemplate,
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
  AdminAnalytics,
  AdminUser,
  AuditLogEntry,
  ModerationReport,
  NewHabitInput,
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

function makeSuspensionEnd(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function normalizeReason(value: string | null, fallback: string) {
  return value?.trim() || fallback;
}

/** Simple inline text-field modal */
function InlinePrompt({
  label,
  placeholder = '',
  onConfirm,
  onCancel,
}: {
  label: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="inline-prompt" role="dialog" aria-label={label}>
      <label className="select-label compact">
        {label}
        <input
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="table-actions" style={{ marginTop: '0.5rem' }}>
        <button className="primary-action" type="button" onClick={() => onConfirm(value)}>Confirm</button>
        <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** New template form */
function NewTemplateForm({ onSave, onCancel }: { onSave: (data: Parameters<typeof createChallengeTemplate>[0]) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(75);
  const [strict, setStrict] = useState(true);
  const [category, setCategory] = useState('general');
  const [religious, setReligious] = useState(false);
  const [habits, setHabits] = useState<NewHabitInput[]>([
    { name: '', description: '', is_required: true, visibility_default: 'public', sort_order: 10 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addHabit() {
    setHabits((h) => [...h, { name: '', description: '', is_required: true, visibility_default: 'public', sort_order: (h.length + 1) * 10 }]);
  }
  function removeHabit(i: number) { setHabits((h) => h.filter((_, idx) => idx !== i)); }
  function updateHabit(i: number, patch: Partial<NewHabitInput>) {
    setHabits((h) => h.map((hab, idx) => idx === i ? { ...hab, ...patch } : hab));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await onSave({ slug, name, description, duration_days: duration, strict_mode: strict, category, is_religious: religious, sort_order: 0, habits });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template.');
    } finally { setSaving(false); }
  }

  return (
    <form className="stacked-form new-template-form" onSubmit={handleSubmit} aria-label="Create template">
      <h3>New challenge template</h3>
      <div className="form-grid-two">
        <label className="select-label">Name<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="select-label">Slug (URL-safe)<input required pattern="[a-z0-9-]{3,80}" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="e.g. my-challenge-75" /></label>
      </div>
      <label className="select-label">Description<textarea rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="form-grid-two">
        <label className="select-label">Duration (days)<input type="number" min={1} max={365} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
        <label className="select-label">Category<input value={category} onChange={(e) => setCategory(e.target.value)} /></label>
      </div>
      <div className="table-actions">
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 800 }}>
          <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> Strict mode
        </label>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 800 }}>
          <input type="checkbox" checked={religious} onChange={(e) => setReligious(e.target.checked)} /> Faith add-on
        </label>
      </div>

      <h4 style={{ margin: '0.5rem 0 0' }}>Habits</h4>
      {habits.map((h, i) => (
        <div key={i} className="habit-form-row">
          <div className="form-grid-two">
            <label className="select-label">Habit name<input required value={h.name} onChange={(e) => updateHabit(i, { name: e.target.value })} /></label>
            <label className="select-label">Description<input value={h.description} onChange={(e) => updateHabit(i, { description: e.target.value })} /></label>
          </div>
          <div className="table-actions" style={{ marginTop: '0.4rem' }}>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 800 }}>
              <input type="checkbox" checked={h.is_required} onChange={(e) => updateHabit(i, { is_required: e.target.checked })} /> Required
            </label>
            <select value={h.visibility_default} onChange={(e) => updateHabit(i, { visibility_default: e.target.value as NewHabitInput['visibility_default'] })} style={{ width: 'auto' }}>
              <option value="public">Public</option>
              <option value="buddies">Buddies</option>
              <option value="private">Private</option>
            </select>
            {habits.length > 1 && <button className="danger-action" type="button" style={{ padding: '0.4rem 0.7rem' }} onClick={() => removeHabit(i)}>✕</button>}
          </div>
        </div>
      ))}
      <button className="ghost-button" type="button" onClick={addHabit}>+ Add habit</button>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="table-actions">
        <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create template'}</button>
        <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
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
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [suspendDays, setSuspendDays] = useState(7);

  // Inline prompt state
  const [promptTarget, setPromptTarget] = useState<null | {
    type: string;
    user?: AdminUser;
    template?: TemplateWithHabits;
    role?: UserRole;
    report?: ModerationReport;
    action?: 'hide' | 'unhide' | 'delete' | 'dismiss_report';
  }>(null);

  const sections: Array<{ key: AdminSection; label: string; superOnly?: boolean }> = [
    { key: 'overview', label: 'Analytics' },
    { key: 'users', label: 'Users' },
    { key: 'moderation', label: 'Reports' },
    { key: 'templates', label: 'Templates', superOnly: true },
    { key: 'settings', label: 'Settings', superOnly: true },
    { key: 'audit', label: 'Audit logs', superOnly: true },
  ];

  const loadDashboard = useCallback(async (nextSearch = '') => {
    setLoading(true); setError(null);
    try {
      const [nextAnalytics, nextUsers, nextReports] = await Promise.all([
        loadAdminAnalytics(),
        loadAdminUsers(nextSearch),
        loadModerationReports('open'),
      ]);
      setAnalytics(nextAnalytics); setUsers(nextUsers); setReports(nextReports);
      if (isSuperAdmin) {
        const [logs, tmpl] = await Promise.all([loadAuditLogs(), loadManageableTemplates()]);
        setAuditLogs(logs); setTemplates(tmpl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load dashboard.');
    } finally { setLoading(false); }
  }, [isSuperAdmin]);

  useEffect(() => { void loadDashboard(''); }, [loadDashboard]);

  async function withAction(action: () => Promise<void>, success: string) {
    setError(null);
    try {
      await action(); onNotify(success, 'success'); await loadDashboard(search); onRefreshApp();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Action failed.';
      setError(msg); onNotify(msg, 'error');
    }
  }

  function openPrompt(type: string, extra: Omit<typeof promptTarget, 'type'>) {
    setPromptTarget({ type, ...extra });
  }

  async function handlePromptConfirm(value: string) {
    if (!promptTarget) return;
    const reason = normalizeReason(value, 'Admin action');
    const { type, user, template } = promptTarget;
    setPromptTarget(null);

    if (type === 'warn' && user) await withAction(() => warnUser(user.id, reason), 'Warning recorded.');
    if (type === 'rename' && template) await withAction(() => updateChallengeTemplate({ id: template.id, name: reason, description: template.description, is_active: template.is_active, strict_mode: template.strict_mode }), 'Template renamed.');
    if (type === 'suspend' && user) await withAction(() => setUserStatus({ userId: user.id, status: 'suspended', suspendedUntil: makeSuspensionEnd(suspendDays), reason }), 'User suspended.');
    if (type === 'ban' && user) await withAction(() => setUserStatus({ userId: user.id, status: 'banned', suspendedUntil: null, reason }), 'User banned.');
    if (type === 'activate' && user) await withAction(() => setUserStatus({ userId: user.id, status: 'active', suspendedUntil: null, reason }), 'Account activated.');
    if (type === 'role' && user && promptTarget.role) await withAction(() => changeUserRole(user.id, promptTarget.role as UserRole, reason), 'Role updated.');
    if (type === 'delete-template' && template) await withAction(() => deleteChallengeTemplate(template.id, reason), 'Template deleted.');
    if (type === 'mod-action' && promptTarget.report?.reflection_id && promptTarget.action) {
      await withAction(() => moderateReflection(promptTarget.report!.reflection_id as string, promptTarget.action!, reason), 'Moderation complete.');
    }
  }

  function handleRoleChange(user: AdminUser, role: UserRole) {
    openPrompt('role', { user, role });
  }

  async function handleNewTemplate(data: Parameters<typeof createChallengeTemplate>[0]) {
    await withAction(() => createChallengeTemplate(data).then(() => void 0), 'Template created.');
    setShowNewTemplate(false);
  }

  async function handleSettingSave() {
    const value = Number(deadlineHours);
    if (!Number.isFinite(value) || value < 0 || value > 24) { setError('Must be 0–24.'); return; }
    await withAction(() => updateSystemSetting('checkin_deadline_hours', value, 'Hours after midnight UTC when past check-ins remain editable.'), 'Setting saved.');
  }

  const promptLabels: Record<string, string> = {
    warn: 'Warning reason',
    suspend: `Suspension reason (${suspendDays} days)`,
    ban: 'Ban reason',
    activate: 'Activation reason',
    role: `Role change reason${promptTarget?.type === 'role' && promptTarget.role ? ` (${promptTarget.role.replace('_', ' ')})` : ''}`,
    rename: 'New template name',
    'delete-template': 'Deletion reason',
    'mod-action': 'Moderation reason',
  };

  return (
    <main className="admin-dashboard">
      {promptTarget && (
        <div className="prompt-overlay" role="dialog" aria-modal="true">
          <div className="prompt-box panel">
            <InlinePrompt
              label={promptLabels[promptTarget.type] ?? 'Reason'}
              placeholder="Enter reason..."
              onConfirm={handlePromptConfirm}
              onCancel={() => setPromptTarget(null)}
            />
          </div>
        </div>
      )}

      <section className="panel admin-hero" aria-labelledby="admin-title">
        <div>
          <p className="eyebrow">Protected management</p>
          <h1 id="admin-title">{isSuperAdmin ? 'Admin dashboard' : 'Moderator dashboard'}</h1>
          <p>All privileged actions re-check roles and account status server-side before writing data.</p>
        </div>
        <span className={isSuperAdmin ? 'danger-badge' : 'soft-badge'}>{profile.role.replace('_', ' ')}</span>
      </section>

      <div className="admin-tabs" role="tablist" aria-label="Management sections">
        {sections.filter((s) => !s.superOnly || isSuperAdmin).map((s) => (
          <button className={section === s.key ? 'active' : ''} key={s.key} type="button" role="tab" aria-selected={section === s.key} onClick={() => setSection(s.key)}>{s.label}</button>
        ))}
      </div>

      {loading ? <p className="loading-pill">Loading dashboard...</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {section === 'overview' && (
        <section className="panel" aria-labelledby="analytics-title">
          <div className="section-heading">
            <div><p className="eyebrow">Analytics</p><h2 id="analytics-title">System health</h2></div>
            <button className="ghost-button" type="button" onClick={() => loadDashboard()}>Refresh</button>
          </div>
          <div className="metric-grid wide-metrics">
            <article className="metric-card accent-card"><span>Total users</span><strong>{analytics?.total_users ?? 0}</strong><small>registered</small></article>
            <article className="metric-card"><span>Active 7d</span><strong>{analytics?.active_users_7d ?? 0}</strong><small>checked in</small></article>
            <article className="metric-card"><span>Daily check-ins</span><strong>{analytics?.daily_checkins ?? 0}</strong><small>today</small></article>
            <article className="metric-card"><span>Completion rate</span><strong>{analytics?.completion_rate ?? 0}%</strong><small>{analytics?.completed_challenges}/{analytics?.total_challenges} challenges</small></article>
            <article className="metric-card"><span>Resets</span><strong>{analytics?.reset_count ?? 0}</strong><small>all time</small></article>
            <article className="metric-card"><span>Open reports</span><strong>{analytics?.open_reports ?? 0}</strong><small>moderation queue</small></article>
          </div>
          <div className="data-card">
            <h3>Most completed habits</h3>
            {analytics?.popular_habits?.length ? (
              <ul className="compact-list">{analytics.popular_habits.map((h) => <li key={h.name}><span>{h.name}</span><strong>{h.completed_count}</strong></li>)}</ul>
            ) : <p className="muted">No data yet.</p>}
          </div>
        </section>
      )}

      {section === 'users' && (
        <section className="panel" aria-labelledby="users-title">
          <div className="section-heading"><div><p className="eyebrow">User management</p><h2 id="users-title">Profiles and status</h2></div></div>
          <form className="inline-search" onSubmit={(e) => { e.preventDefault(); void loadDashboard(search); }}>
            <label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="username or display name" /></label>
            <button className="secondary-action" type="submit">Search</button>
          </form>
          <div className="form-grid-two" style={{ marginBottom: '0.75rem', alignItems: 'end' }}>
            <label className="select-label compact">Suspension duration (days)
              <input type="number" min={1} max={365} value={suspendDays} onChange={(e) => setSuspendDays(Number(e.target.value))} />
            </label>
          </div>
          <div className="responsive-table" role="region" aria-label="Users table" tabIndex={0}>
            <table>
              <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Activity</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.display_name}</strong><small>@{user.username}</small></td>
                    <td>
                      {isSuperAdmin
                        ? <select value={user.role} onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}>{roleOptions.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select>
                        : <span className="soft-badge">{user.role.replace('_', ' ')}</span>}
                    </td>
                    <td><span className={user.account_status === 'active' ? 'success-badge' : 'danger-badge'}>{user.account_status}</span></td>
                    <td><small>{user.challenge_count} challenges, {user.reflection_count} reflections</small></td>
                    <td>
                      <div className="table-actions">
                        <button className="ghost-button" type="button" onClick={() => openPrompt('warn', { user })}>Warn</button>
                        <button className="secondary-action" type="button" onClick={() => openPrompt('suspend', { user })}>Suspend {suspendDays}d</button>
                        {isSuperAdmin && <button className="ghost-button" type="button" onClick={() => openPrompt('activate', { user })}>Activate</button>}
                        {isSuperAdmin && <button className="danger-action" type="button" onClick={() => openPrompt('ban', { user })}>Ban</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {section === 'moderation' && (
        <section className="panel" aria-labelledby="moderation-title">
          <div className="section-heading"><div><p className="eyebrow">Content moderation</p><h2 id="moderation-title">Open reports</h2></div></div>
          {reports.length ? (
            <div className="feed-list">
              {reports.map((report) => (
                <article className="feed-card" key={report.report_id}>
                  <div className="feed-meta"><strong>@{report.author_username ?? 'unknown'}</strong><span>{report.reports_count ?? 0} reports · {formatTimestamp(report.created_at)}</span></div>
                  <p><strong>Reason:</strong> {report.reason}</p>
                  {report.learned_today ? <blockquote>{report.learned_today}</blockquote> : null}
                  {report.reflection_body ? <p>{report.reflection_body}</p> : null}
                  <div className="feed-actions">
                    <span>Reported by @{report.reporter_username ?? 'unknown'}</span>
                    <div className="table-actions">
                      <button className="secondary-action" type="button" disabled={!report.reflection_id || Boolean(report.is_hidden)} onClick={() => openPrompt('mod-action', { report, action: 'hide' } as never)}>Hide</button>
                      <button className="ghost-button" type="button" disabled={!report.reflection_id} onClick={() => openPrompt('mod-action', { report, action: 'dismiss_report' } as never)}>Dismiss</button>
                      {isSuperAdmin && <button className="danger-action" type="button" disabled={!report.reflection_id} onClick={() => openPrompt('mod-action', { report, action: 'delete' } as never)}>Delete</button>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="muted">No open reports.</p>}
        </section>
      )}

      {section === 'templates' && isSuperAdmin && (
        <section className="panel" aria-labelledby="templates-title">
          <div className="section-heading">
            <div><p className="eyebrow">Challenge templates</p><h2 id="templates-title">Manage templates</h2></div>
            <button className="primary-action" type="button" onClick={() => setShowNewTemplate((v) => !v)}>{showNewTemplate ? 'Cancel' : '+ New template'}</button>
          </div>
          {showNewTemplate && <NewTemplateForm onSave={handleNewTemplate} onCancel={() => setShowNewTemplate(false)} />}
          <div className="template-grid" style={{ marginTop: showNewTemplate ? '1.5rem' : 0 }}>
            {templates.map((template) => (
              <article className="template-card" key={template.id}>
                <div className="card-meta-row">
                  <span className={template.is_active ? 'success-badge' : 'danger-badge'}>{template.is_active ? 'active' : 'inactive'}</span>
                  <span className={template.strict_mode ? 'danger-badge' : 'soft-badge'}>{template.strict_mode ? 'strict' : 'flexible'}</span>
                  <span className="soft-badge">{template.duration_days}d</span>
                </div>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
                <p className="muted" style={{ fontSize: '0.85rem' }}>{template.habit_definitions.length} habits defined</p>
                <div className="table-actions">
                  <button className="ghost-button" type="button" onClick={() => openPrompt('rename', { template })}>Rename</button>
                  <button className="ghost-button" type="button" onClick={() => withAction(() => updateChallengeTemplate({ id: template.id, name: template.name, description: template.description, is_active: !template.is_active, strict_mode: template.strict_mode }), 'Template updated.')}>{template.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button className="secondary-action" type="button" onClick={() => withAction(() => updateChallengeTemplate({ id: template.id, name: template.name, description: template.description, is_active: template.is_active, strict_mode: !template.strict_mode }), 'Template updated.')}>Toggle strict</button>
                  <button className="danger-action" type="button" onClick={() => openPrompt('delete-template', { template })}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {section === 'settings' && isSuperAdmin && (
        <section className="panel" aria-labelledby="settings-admin-title">
          <div className="section-heading"><div><p className="eyebrow">System settings</p><h2 id="settings-admin-title">Anti-cheat controls</h2></div></div>
          <label className="select-label compact">Yesterday check-in deadline (hours after midnight UTC)
            <input type="number" min="0" max="24" value={deadlineHours} onChange={(e) => setDeadlineHours(e.target.value)} />
          </label>
          <p className="muted">The backend rejects future check-ins and past edits after this deadline.</p>
          <button className="primary-action" type="button" style={{ marginTop: '1rem' }} onClick={handleSettingSave}>Save setting</button>
        </section>
      )}

      {section === 'audit' && isSuperAdmin && (
        <section className="panel" aria-labelledby="audit-title">
          <div className="section-heading"><div><p className="eyebrow">Audit logs</p><h2 id="audit-title">Privileged actions</h2></div></div>
          <div className="responsive-table" role="region" aria-label="Audit logs" tabIndex={0}>
            <table>
              <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Entity</th><th>Time</th></tr></thead>
              <tbody>
                {auditLogs.map((entry) => (
                  <tr key={entry.id}>
                    <td><strong>{entry.action}</strong></td>
                    <td>@{entry.actor_username ?? 'system'}</td>
                    <td>@{entry.target_username ?? '—'}</td>
                    <td>{entry.entity_type}{entry.entity_id ? ` #${entry.entity_id.slice(0, 8)}` : ''}</td>
                    <td>{formatTimestamp(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
