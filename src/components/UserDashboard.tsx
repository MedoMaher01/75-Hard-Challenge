import { formatShortDate } from '../lib/dates';
import type {
  Challenge,
  HabitCheckin,
  HabitDefinition,
  Profile,
  Reflection,
  ResetEvent,
  TemplateWithHabits,
  VisibilitySettings,
} from '../lib/types';

interface UserDashboardProps {
  profile: Profile;
  settings: VisibilitySettings | null;
  challenges: Challenge[];
  activeChallenge: Challenge | null;
  activeTemplate: TemplateWithHabits | null;
  habits: HabitDefinition[];
  checkins: HabitCheckin[];
  resetEvents: ResetEvent[];
  reflection: Reflection | null;
  onOpenToday: () => void;
  onOpenExplore: () => void;
  onOpenSettings: () => void;
  onTogglePrivate: () => Promise<void>;
}

export function UserDashboard({
  profile,
  settings,
  challenges,
  activeChallenge,
  activeTemplate,
  habits,
  checkins,
  resetEvents,
  reflection,
  onOpenToday,
  onOpenExplore,
  onOpenSettings,
  onTogglePrivate,
}: UserDashboardProps) {
  const completedHabitIds = new Set(checkins.filter((checkin) => checkin.completed).map((checkin) => checkin.habit_definition_id));
  const requiredHabits = habits.filter((habit) => habit.is_required);
  const completedRequired = requiredHabits.filter((habit) => completedHabitIds.has(habit.id)).length;
  const dailyCompletion = habits.length ? Math.round((completedHabitIds.size / habits.length) * 100) : 0;
  const challengeCompletion = activeChallenge && activeTemplate
    ? Math.min(100, Math.round((activeChallenge.current_day / activeTemplate.duration_days) * 100))
    : 0;
  const completedChallenges = challenges.filter((challenge) => challenge.status === 'completed').length;

  return (
    <main className="dashboard-home">
      <section className="panel hero-dashboard" aria-labelledby="dashboard-home-title">
        <div>
          <p className="eyebrow">User dashboard</p>
          <h1 id="dashboard-home-title">{profile.display_name}'s command center</h1>
          <p>
            Track today, protect your privacy, and keep reset history visible so progress remains honest.
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary-action" type="button" onClick={onOpenToday}>
            Check in today
          </button>
          <button className="ghost-button" type="button" onClick={onOpenSettings}>
            Privacy settings
          </button>
        </div>
      </section>

      <section className="metric-grid wide-metrics" aria-label="Personal stats">
        <article className="metric-card accent-card">
          <span>Current streak</span>
          <strong>{activeChallenge?.current_streak ?? 0}</strong>
          <small>day {activeChallenge?.current_day ?? 0}</small>
        </article>
        <article className="metric-card">
          <span>Today complete</span>
          <strong>{dailyCompletion}%</strong>
          <small>{completedRequired}/{requiredHabits.length} required habits</small>
        </article>
        <article className="metric-card">
          <span>Challenge completion</span>
          <strong>{challengeCompletion}%</strong>
          <small>{activeTemplate?.name ?? 'No active template'}</small>
        </article>
        <article className="metric-card">
          <span>Completed challenges</span>
          <strong>{completedChallenges}</strong>
          <small>{challenges.length} total joined</small>
        </article>
      </section>

      <div className="dashboard-two-column">
        <section className="panel" aria-labelledby="challenge-stat-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Challenge stats</p>
              <h2 id="challenge-stat-title">Current progress</h2>
            </div>
            <span className={activeChallenge?.status === 'completed' ? 'success-badge' : 'soft-badge'}>
              {activeChallenge?.status ?? 'not started'}
            </span>
          </div>

          {activeChallenge && activeTemplate ? (
            <>
              <div className="progress-block">
                <div className="progress-copy">
                  <span>{activeChallenge.title}</span>
                  <strong>{challengeCompletion}%</strong>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${challengeCompletion}%` }} />
                </div>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Started</dt>
                  <dd>{formatShortDate(activeChallenge.start_date)}</dd>
                </div>
                <div>
                  <dt>Longest streak</dt>
                  <dd>{activeChallenge.longest_streak}</dd>
                </div>
                <div>
                  <dt>Resets</dt>
                  <dd>{activeChallenge.resets_count}</dd>
                </div>
                <div>
                  <dt>Last check-in</dt>
                  <dd>{formatShortDate(activeChallenge.last_checkin_date)}</dd>
                </div>
              </dl>
            </>
          ) : (
          <p className="muted">
              Join a challenge template to populate your dashboard.{' '}
              <button
                className="ghost-button"
                type="button"
                style={{ display: 'inline', padding: '0.2rem 0.6rem', fontSize: '0.9rem' }}
                onClick={onOpenExplore}
              >
                Browse challenges →
              </button>
            </p>
          )}
        </section>

        <section className="panel" aria-labelledby="privacy-stat-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Privacy status</p>
              <h2 id="privacy-stat-title">Sharing controls</h2>
            </div>
            <span className={profile.is_private ? 'danger-badge' : 'success-badge'}>
              {profile.is_private ? 'private' : 'public'}
            </span>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Default habit visibility</dt>
              <dd>{settings?.default_habit_visibility ?? 'private'}</dd>
            </div>
            <div>
              <dt>Leaderboard</dt>
              <dd>{settings?.show_leaderboard ? 'Allowed' : 'Hidden'}</dd>
            </div>
            <div>
              <dt>Public reflections</dt>
              <dd>{settings?.show_reflections ? 'Allowed' : 'Disabled'}</dd>
            </div>
          </dl>

          <button className="secondary-action" type="button" onClick={onTogglePrivate}>
            Make account {profile.is_private ? 'public' : 'private'}
          </button>
        </section>
      </div>

      <div className="dashboard-two-column">
        <section className="panel" aria-labelledby="reflection-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Reflection</p>
              <h2 id="reflection-title">Today learned</h2>
            </div>
            <span className="soft-badge">{reflection?.visibility ?? 'private'}</span>
          </div>
          {reflection?.learned_today || reflection?.body ? (
            <article className="feed-card">
              {reflection.learned_today ? <blockquote>{reflection.learned_today}</blockquote> : null}
              {reflection.body ? <p>{reflection.body}</p> : null}
            </article>
          ) : (
            <p className="muted">No reflection saved today. Add one from the daily check-in screen.</p>
          )}
        </section>

        <section className="panel" aria-labelledby="reset-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Reset history</p>
              <h2 id="reset-title">Integrity log</h2>
            </div>
          </div>
          {resetEvents.length ? (
            <ul className="timeline-list">
              {resetEvents.slice(0, 4).map((event) => (
                <li key={event.id}>
                  <span>{formatShortDate(event.reset_date)}</span>
                  <strong>{event.reason}</strong>
                  <small>Previous streak {event.previous_streak}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No reset events recorded for the selected challenge.</p>
          )}
        </section>
      </div>
    </main>
  );
}
