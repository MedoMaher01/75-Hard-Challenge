import { useState } from 'react';
import { formatTimestamp } from '../lib/dates';
import type { PublicProgress, PublicReflection } from '../lib/types';

interface CommunityProps {
  progress: PublicProgress[];
  reflections: PublicReflection[];
  onReportReflection: (reflectionId: string) => Promise<void>;
}

export function Community({ progress, reflections, onReportReflection }: CommunityProps) {
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function handleReport(reflectionId: string) {
    setError(null);
    try {
      await onReportReflection(reflectionId);
      setReportedIds((current) => new Set(current).add(reflectionId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not report reflection.');
    }
  }

  return (
    <main className="content-grid community-layout">
      <section className="panel" aria-labelledby="leaderboard-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Community</p>
            <h2 id="leaderboard-title">Public leaderboard</h2>
          </div>
          <span className="soft-badge">privacy filtered</span>
        </div>

        {progress.length ? (
          <div className="leaderboard-list">
            {progress.map((item, index) => (
              <article className="leaderboard-row" key={item.id}>
                <span className="rank">#{index + 1}</span>
                <div>
                  <strong>{item.profiles?.display_name ?? 'Private member'}</strong>
                  <small>@{item.profiles?.username ?? 'hidden'} - {item.challenge_templates?.name ?? item.title}</small>
                </div>
                <div className="leaderboard-score">
                  <strong>{item.current_streak}</strong>
                  <small>day {item.current_day}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No public progress yet. Public entries appear when members allow leaderboard sharing.</p>
        )}
      </section>

      <section className="panel" aria-labelledby="feed-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Shared lessons</p>
            <h2 id="feed-title">Community feed</h2>
          </div>
        </div>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        {reflections.length ? (
          <div className="feed-list">
            {reflections.map((reflection) => (
              <article className="feed-card" key={reflection.id}>
                <div className="feed-meta">
                  <strong>{reflection.profiles?.display_name ?? 'Member'}</strong>
                  <span>{formatTimestamp(reflection.created_at)}</span>
                </div>
                {reflection.learned_today ? (
                  <blockquote>
                    <span>Learned today</span>
                    {reflection.learned_today}
                  </blockquote>
                ) : null}
                {reflection.body ? <p>{reflection.body}</p> : null}
                <div className="feed-actions">
                  <span>{reflection.challenges?.title ?? 'Challenge reflection'}</span>
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={reportedIds.has(reflection.id)}
                    onClick={() => handleReport(reflection.id)}
                  >
                    {reportedIds.has(reflection.id) ? 'Reported' : 'Report'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No public reflections yet. Private notes are never shown here.</p>
        )}
      </section>
    </main>
  );
}
