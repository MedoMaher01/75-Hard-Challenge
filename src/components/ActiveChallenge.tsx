import { useState } from 'react';
import { formatShortDate } from '../lib/dates';
import type { Challenge, TemplateWithHabits } from '../lib/types';

interface ActiveChallengeProps {
  challenge: Challenge;
  template: TemplateWithHabits;
  onGoToCheckIn: () => void;
  onLeave: (challengeId: string) => Promise<void>;
}

export function ActiveChallenge({ challenge, template, onGoToCheckIn, onLeave }: ActiveChallengeProps) {
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const challengeCompletion = Math.min(
    100,
    Math.round((challenge.current_day / template.duration_days) * 100),
  );

  const streakCompletion = Math.min(
    100,
    Math.round((challenge.current_streak / template.duration_days) * 100),
  );

  async function handleLeave() {
    setLeaving(true);
    setLeaveError(null);
    try {
      await onLeave(challenge.id);
      setShowLeaveConfirm(false);
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Could not leave challenge.');
    } finally {
      setLeaving(false);
    }
  }

  return (
    <section className="panel active-challenge-panel" aria-labelledby="active-challenge-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Active challenge</p>
          <h2 id="active-challenge-title">{challenge.title}</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={challenge.status === 'completed' ? 'success-badge' : 'soft-badge'}>
            {challenge.status}
          </span>
          {challenge.strict_mode && <span className="danger-badge">⚡ Strict</span>}
        </div>
      </div>

      {/* Metric grid */}
      <div className="metric-grid wide-metrics">
        <article className="metric-card accent-card">
          <span>Current day</span>
          <strong>{challenge.current_day}</strong>
          <small>of {template.duration_days}</small>
        </article>
        <article className="metric-card">
          <span>Streak</span>
          <strong>{challenge.current_streak}</strong>
          <small>longest {challenge.longest_streak}</small>
        </article>
        <article className="metric-card">
          <span>Resets</span>
          <strong>{challenge.resets_count}</strong>
          <small>last check-in {formatShortDate(challenge.last_checkin_date)}</small>
        </article>
      </div>

      {/* Progress bars */}
      <div className="progress-block" aria-label="Challenge completion">
        <div className="progress-copy">
          <span>Challenge progress ({template.name})</span>
          <strong>{challengeCompletion}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${challengeCompletion}%` }} />
        </div>
      </div>

      <div className="progress-block" aria-label="Current streak">
        <div className="progress-copy">
          <span>Streak progress</span>
          <strong>{streakCompletion}%</strong>
        </div>
        <div className="progress-track secondary">
          <span style={{ width: `${streakCompletion}%` }} />
        </div>
      </div>

      {/* Actions */}
      <div className="active-challenge-actions">
        <button className="primary-action" type="button" onClick={onGoToCheckIn} id="go-to-checkin">
          Today's check-in →
        </button>
        <button
          className="ghost-button leave-btn"
          type="button"
          onClick={() => setShowLeaveConfirm(true)}
          id="leave-challenge-btn"
        >
          Leave challenge
        </button>
      </div>

      {/* Leave confirmation */}
      {showLeaveConfirm && (
        <div className="leave-confirm-box" role="alertdialog" aria-labelledby="leave-confirm-title">
          <p className="eyebrow" style={{ color: 'var(--danger)' }}>Confirm exit</p>
          <h3 id="leave-confirm-title">Leave "{challenge.title}"?</h3>
          <p className="muted">
            Your progress will be archived but your streak and check-in history will be preserved for record keeping.
            This action cannot be undone.
          </p>
          {leaveError && <p className="form-error" role="alert">{leaveError}</p>}
          <div className="table-actions">
            <button
              className="danger-action"
              type="button"
              disabled={leaving}
              onClick={handleLeave}
              id="confirm-leave-btn"
            >
              {leaving ? 'Leaving...' : 'Yes, leave challenge'}
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={leaving}
              onClick={() => { setShowLeaveConfirm(false); setLeaveError(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
