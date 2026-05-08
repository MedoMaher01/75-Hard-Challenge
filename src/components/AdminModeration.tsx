import { useEffect, useState } from 'react';
import { formatTimestamp } from '../lib/dates';
import { supabase } from '../lib/supabase';
import type { Profile, PublicReflection } from '../lib/types';

interface AdminModerationProps {
  profile: Profile;
}

export function AdminModeration({ profile }: AdminModerationProps) {
  const [items, setItems] = useState<PublicReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadReports() {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from('reflections')
      .select('*, profiles(display_name, username), challenges(title)')
      .gt('reports_count', 0)
      .order('reports_count', { ascending: false })
      .limit(50);

    if (loadError) {
      setError(loadError.message);
    } else {
      setItems((data ?? []) as PublicReflection[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function hideReflection(reflectionId: string) {
    setError(null);
    const { error: updateError } = await supabase.from('reflections').update({ is_hidden: true }).eq('id', reflectionId);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    const { error: actionError } = await supabase.from('moderation_actions').insert({
      moderator_id: profile.id,
      reflection_id: reflectionId,
      action: 'hide',
      reason: 'Reported reflection hidden from admin panel.',
    });

    if (actionError) setError(actionError.message);
    await loadReports();
  }

  return (
    <main className="single-column">
      <section className="panel" aria-labelledby="admin-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Admin moderation</p>
            <h2 id="admin-title">Reported reflections</h2>
          </div>
          <span className="danger-badge">{profile.role}</span>
        </div>

        {loading ? <p className="muted">Loading reports...</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}

        {!loading && !items.length ? <p className="muted">No reported reflections need review.</p> : null}

        <div className="feed-list">
          {items.map((item) => (
            <article className="feed-card" key={item.id}>
              <div className="feed-meta">
                <strong>{item.profiles?.display_name ?? 'Member'}</strong>
                <span>{item.reports_count} reports</span>
              </div>
              {item.learned_today ? <blockquote>{item.learned_today}</blockquote> : null}
              {item.body ? <p>{item.body}</p> : null}
              <div className="feed-actions">
                <span>{formatTimestamp(item.created_at)}</span>
                <button className="danger-action" type="button" disabled={item.is_hidden} onClick={() => hideReflection(item.id)}>
                  {item.is_hidden ? 'Hidden' : 'Hide reflection'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
