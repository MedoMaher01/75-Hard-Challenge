import { FormEvent, useEffect, useState } from 'react';
import type { HabitVisibility, Profile, VisibilitySettings } from '../lib/types';

interface SettingsPanelProps {
  profile: Profile;
  settings: VisibilitySettings;
  onSave: (profile: Pick<Profile, 'id' | 'display_name' | 'username' | 'bio' | 'is_private'>, settings: Pick<VisibilitySettings, 'default_habit_visibility' | 'show_reflections' | 'show_completed_habits' | 'show_leaderboard'>) => Promise<void>;
}

export function SettingsPanel({ profile, settings, onSave }: SettingsPanelProps) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [isPrivate, setIsPrivate] = useState(profile.is_private);
  const [defaultHabitVisibility, setDefaultHabitVisibility] = useState<HabitVisibility>(settings.default_habit_visibility);
  const [showReflections, setShowReflections] = useState(settings.show_reflections);
  const [showCompletedHabits, setShowCompletedHabits] = useState(settings.show_completed_habits);
  const [showLeaderboard, setShowLeaderboard] = useState(settings.show_leaderboard);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDisplayName(profile.display_name);
    setUsername(profile.username);
    setBio(profile.bio ?? '');
    setIsPrivate(profile.is_private);
    setDefaultHabitVisibility(settings.default_habit_visibility);
    setShowReflections(settings.show_reflections);
    setShowCompletedHabits(settings.show_completed_habits);
    setShowLeaderboard(settings.show_leaderboard);
  }, [profile, settings]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    setError(null);

    try {
      await onSave(
        {
          id: profile.id,
          display_name: displayName,
          username,
          bio,
          is_private: isPrivate,
        },
        {
          default_habit_visibility: defaultHabitVisibility,
          show_reflections: showReflections,
          show_completed_habits: showCompletedHabits,
          show_leaderboard: showLeaderboard,
        },
      );
      setStatus('Privacy settings saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save settings.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="single-column">
      <section className="panel settings-panel" aria-labelledby="settings-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Privacy controls</p>
            <h2 id="settings-title">Account and sharing</h2>
          </div>
        </div>

        <form className="stacked-form" onSubmit={handleSubmit}>
          <div className="form-grid-two">
            <label>
              Display name
              <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label>
              Username
              <input
                required
                pattern="[a-z0-9_]{3,24}"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              />
              <small>Use 3 to 24 lowercase letters, numbers, or underscores.</small>
            </label>
          </div>

          <label>
            Bio
            <textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} />
          </label>

          <label className="toggle-row">
            <span>
              <strong>Private account</strong>
              <small>Hide your public profile, leaderboard entries, and shared progress where policies apply.</small>
            </span>
            <input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
          </label>

          <label className="select-label">
            Default habit visibility
            <select value={defaultHabitVisibility} onChange={(event) => setDefaultHabitVisibility(event.target.value as HabitVisibility)}>
              <option value="private">Private</option>
              <option value="buddies">Buddies only</option>
              <option value="public">Public</option>
            </select>
          </label>

          <label className="toggle-row">
            <span>
              <strong>Allow public reflections</strong>
              <small>When off, reflection policies keep your entries private even if marked public.</small>
            </span>
            <input type="checkbox" checked={showReflections} onChange={(event) => setShowReflections(event.target.checked)} />
          </label>

          <label className="toggle-row">
            <span>
              <strong>Show completed public habits</strong>
              <small>Individual hidden habits and private accounts remain protected.</small>
            </span>
            <input type="checkbox" checked={showCompletedHabits} onChange={(event) => setShowCompletedHabits(event.target.checked)} />
          </label>

          <label className="toggle-row">
            <span>
              <strong>Appear on leaderboard</strong>
              <small>Disabling this removes your challenges from the community leaderboard.</small>
            </span>
            <input type="checkbox" checked={showLeaderboard} onChange={(event) => setShowLeaderboard(event.target.checked)} />
          </label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {status ? <p className="form-success" role="status">{status}</p> : null}

          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save settings'}
          </button>
        </form>
      </section>
    </main>
  );
}
