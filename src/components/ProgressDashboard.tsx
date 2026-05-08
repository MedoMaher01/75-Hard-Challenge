import { formatShortDate, formatTimestamp } from '../lib/dates';
import type { Challenge, HabitCheckin, HabitDefinition, ResetEvent, TemplateWithHabits } from '../lib/types';

interface ProgressDashboardProps {
  challenge: Challenge;
  template: TemplateWithHabits;
  habits: HabitDefinition[];
  checkins: HabitCheckin[];
  resetEvents: ResetEvent[];
}

export function ProgressDashboard({ challenge, template, habits, checkins, resetEvents }: ProgressDashboardProps) {
  const completedHabitIds = new Set(checkins.filter((checkin) => checkin.completed).map((checkin) => checkin.habit_definition_id));
  const completedCount = completedHabitIds.size;
  const requiredCount = habits.filter((habit) => habit.is_required).length;
  const completedRequiredCount = habits.filter((habit) => habit.is_required && completedHabitIds.has(habit.id)).length;
  const dailyCompletion = habits.length ? Math.round((completedCount / habits.length) * 100) : 0;
  const challengeCompletion = Math.min(100, Math.round((challenge.current_day / template.duration_days) * 100));

  return (
    <section className="panel dashboard-panel" aria-labelledby="dashboard-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Progress dashboard</p>
          <h2 id="dashboard-title">{challenge.title}</h2>
        </div>
        <span className={challenge.status === 'completed' ? 'success-badge' : 'soft-badge'}>{challenge.status}</span>
      </div>

      <div className="metric-grid">
        <article className="metric-card accent-card">
          <span>Current day</span>
          <strong>{challenge.current_day}</strong>
          <small>of {template.duration_days}</small>
        </article>
        <article className="metric-card">
          <span>Strict streak</span>
          <strong>{challenge.current_streak}</strong>
          <small>longest {challenge.longest_streak}</small>
        </article>
        <article className="metric-card">
          <span>Habits today</span>
          <strong>{completedCount}/{habits.length}</strong>
          <small>{completedRequiredCount}/{requiredCount} required</small>
        </article>
        <article className="metric-card">
          <span>Resets</span>
          <strong>{challenge.resets_count}</strong>
          <small>last check-in {formatShortDate(challenge.last_checkin_date)}</small>
        </article>
      </div>

      <div className="progress-block" aria-label="Challenge completion">
        <div className="progress-copy">
          <span>Challenge completion</span>
          <strong>{challengeCompletion}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${challengeCompletion}%` }} />
        </div>
      </div>

      <div className="progress-block" aria-label="Today's habit completion">
        <div className="progress-copy">
          <span>Today completed</span>
          <strong>{dailyCompletion}%</strong>
        </div>
        <div className="progress-track secondary">
          <span style={{ width: `${dailyCompletion}%` }} />
        </div>
      </div>

      <div className="reset-history">
        <h3>Reset history</h3>
        {resetEvents.length ? (
          <ul className="timeline-list">
            {resetEvents.map((event) => (
              <li key={event.id}>
                <span>{formatShortDate(event.reset_date)}</span>
                <strong>{event.reason}</strong>
                <small>
                  Previous day {event.previous_day}, streak {event.previous_streak} at {formatTimestamp(event.created_at)}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No resets yet. Missed required habits will appear here.</p>
        )}
      </div>
    </section>
  );
}
