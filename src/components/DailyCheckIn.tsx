import { FormEvent, useEffect, useState } from 'react';
import { todayISO } from '../lib/dates';
import type {
  Challenge,
  HabitCheckin,
  HabitDefinition,
  HabitVisibility,
  Reflection,
  ReflectionVisibility,
  SubmitCheckinResult,
} from '../lib/types';

interface DailyCheckInProps {
  challenge: Challenge;
  habits: HabitDefinition[];
  checkins: HabitCheckin[];
  reflection: Reflection | null;
  defaultHabitVisibility: HabitVisibility;
  onSubmit: (input: {
    completedHabitIds: string[];
    privateHabitIds: string[];
    reflection: string | null;
    learnedToday: string | null;
    reflectionVisibility: ReflectionVisibility;
  }) => Promise<SubmitCheckinResult>;
}

export function DailyCheckIn({
  challenge,
  habits,
  checkins,
  reflection,
  defaultHabitVisibility,
  onSubmit,
}: DailyCheckInProps) {
  const [completedHabitIds, setCompletedHabitIds] = useState<Set<string>>(new Set());
  const [privateHabitIds, setPrivateHabitIds] = useState<Set<string>>(new Set());
  const [reflectionBody, setReflectionBody] = useState('');
  const [learnedToday, setLearnedToday] = useState('');
  const [reflectionVisibility, setReflectionVisibility] = useState<ReflectionVisibility>('private');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCompletedHabitIds(new Set(checkins.filter((checkin) => checkin.completed).map((checkin) => checkin.habit_definition_id)));

    const existingPrivateIds = checkins.filter((checkin) => checkin.is_private).map((checkin) => checkin.habit_definition_id);
    const defaultPrivateIds = habits
      .filter((habit) => defaultHabitVisibility !== 'public' || habit.visibility_default !== 'public')
      .map((habit) => habit.id);

    setPrivateHabitIds(new Set(existingPrivateIds.length ? existingPrivateIds : defaultPrivateIds));
    setReflectionBody(reflection?.body ?? '');
    setLearnedToday(reflection?.learned_today ?? '');
    setReflectionVisibility(reflection?.visibility ?? 'private');
    setStatus(null);
    setError(null);
  }, [checkins, defaultHabitVisibility, habits, reflection]);

  function toggleSetValue(current: Set<string>, value: string) {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);

    const missedRequired = habits.filter((habit) => habit.is_required && !completedHabitIds.has(habit.id));
    if (challenge.strict_mode && missedRequired.length) {
      const confirmed = window.confirm(
        `You missed ${missedRequired.length} required habit${missedRequired.length === 1 ? '' : 's'}. This will reset your strict streak to day 1. Continue?`,
      );
      if (!confirmed) {
        setLoading(false);
        return;
      }
    }

    try {
      const result = await onSubmit({
        completedHabitIds: Array.from(completedHabitIds),
        privateHabitIds: Array.from(privateHabitIds),
        reflection: reflectionBody.trim() || null,
        learnedToday: learnedToday.trim() || null,
        reflectionVisibility,
      });
      setStatus(
        result.reset
          ? 'Check-in saved and the strict streak was reset. Tomorrow starts clean.'
          : 'Check-in saved. Progress is up to date.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save check-in.');
    } finally {
      setLoading(false);
    }
  }

  const requiredComplete = habits.filter((habit) => habit.is_required && completedHabitIds.has(habit.id)).length;
  const requiredTotal = habits.filter((habit) => habit.is_required).length;

  return (
    <section className="panel checkin-panel" aria-labelledby="checkin-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Daily check-in</p>
          <h2 id="checkin-title">Today, {todayISO()}</h2>
        </div>
        <span className="soft-badge">
          {requiredComplete}/{requiredTotal} required
        </span>
      </div>

      <form className="checkin-form" onSubmit={handleSubmit}>
        <fieldset>
          <legend>Habit checklist</legend>
          <div className="habit-list">
            {habits.map((habit) => {
              const checked = completedHabitIds.has(habit.id);
              const isPrivate = privateHabitIds.has(habit.id);

              return (
                <article className={checked ? 'habit-row completed' : 'habit-row'} key={habit.id}>
                  <label className="habit-main">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setCompletedHabitIds((current) => toggleSetValue(current, habit.id))}
                    />
                    <span>
                      <strong>{habit.name}</strong>
                      <small>{habit.description}</small>
                    </span>
                  </label>
                  <div className="habit-controls">
                    <span className={habit.is_required ? 'danger-badge' : 'soft-badge'}>
                      {habit.is_required ? 'Required' : 'Optional'}
                    </span>
                    <label className="privacy-toggle">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={() => setPrivateHabitIds((current) => toggleSetValue(current, habit.id))}
                      />
                      Hide
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        </fieldset>

        <div className="journal-grid">
          <label>
            Daily reflection
            <textarea
              rows={5}
              value={reflectionBody}
              onChange={(event) => setReflectionBody(event.target.value)}
              placeholder="What happened today? What felt hard?"
            />
          </label>
          <label>
            What did you learn today?
            <textarea
              rows={5}
              value={learnedToday}
              onChange={(event) => setLearnedToday(event.target.value)}
              placeholder="A useful lesson, mistake, insight, or win."
            />
          </label>
        </div>

        <label className="select-label compact">
          Reflection visibility
          <select value={reflectionVisibility} onChange={(event) => setReflectionVisibility(event.target.value as ReflectionVisibility)}>
            <option value="private">Private</option>
            <option value="buddies">Buddies only</option>
            <option value="public">Public community feed</option>
          </select>
        </label>

        {challenge.strict_mode ? (
          <p className="strict-warning" role="note">
            Strict mode is on. Missing any required habit records a reset event and sets the streak back to day 1.
          </p>
        ) : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {status ? <p className="form-success" role="status">{status}</p> : null}

        <button className="primary-action" type="submit" disabled={loading || !habits.length}>
          {loading ? 'Saving...' : 'Save daily check-in'}
        </button>
      </form>
    </section>
  );
}
