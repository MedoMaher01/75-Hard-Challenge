import { useState } from 'react';
import type { Challenge, HabitDefinition, TemplateWithHabits } from '../lib/types';

interface ChallengeExplorerProps {
  templates: TemplateWithHabits[];
  challenges: Challenge[];
  loading: boolean;
  onJoin: (template: TemplateWithHabits) => Promise<void>;
}

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    discipline: 'Discipline',
    faith: 'Faith',
    student: 'Student',
    creator: 'Creator',
    general: 'General',
  };
  return map[category] ?? category;
}

function HabitPreviewRow({ habit }: { habit: HabitDefinition }) {
  return (
    <li className="explorer-habit-row">
      <span className={habit.is_required ? 'danger-badge' : 'soft-badge'}>
        {habit.is_required ? 'Required' : 'Optional'}
      </span>
      <span className="explorer-habit-name">
        <strong>{habit.name}</strong>
        <small>{habit.description}</small>
      </span>
      <span className={`soft-badge vis-badge`}>{habit.visibility_default}</span>
    </li>
  );
}

export function ChallengeExplorer({ templates, challenges, loading, onJoin }: ChallengeExplorerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const activeTemplateIds = new Set(
    challenges.filter((c) => c.status === 'active').map((c) => c.template_id),
  );

  async function handleJoin(template: TemplateWithHabits) {
    setJoiningId(template.id);
    try {
      await onJoin(template);
    } finally {
      setJoiningId(null);
    }
  }

  if (loading) {
    return (
      <section className="panel" aria-label="Loading challenges">
        <p className="loading-pill">Loading challenge templates...</p>
      </section>
    );
  }

  if (!templates.length) {
    return (
      <section className="panel empty-state" aria-labelledby="explorer-empty-title">
        <p className="eyebrow">No templates</p>
        <h2 id="explorer-empty-title">No challenge templates available</h2>
        <p className="muted">An admin needs to create templates before you can join a challenge.</p>
      </section>
    );
  }

  return (
    <main className="explorer-layout" aria-labelledby="explorer-title">
      <div className="explorer-header panel">
        <div>
          <p className="eyebrow">Browse &amp; join</p>
          <h1 id="explorer-title">Challenge explorer</h1>
          <p className="muted">
            Preview every habit before committing. Required habits trigger a reset in strict mode if missed.
          </p>
        </div>
        <span className="soft-badge">{templates.length} available</span>
      </div>

      <div className="explorer-grid">
        {templates.map((template) => {
          const required = template.habit_definitions.filter((h) => h.is_required);
          const optional = template.habit_definitions.filter((h) => !h.is_required);
          const isExpanded = expandedId === template.id;
          const isAlreadyActive = activeTemplateIds.has(template.id);
          const isJoining = joiningId === template.id;

          return (
            <article
              key={template.id}
              className={`explorer-card panel${isExpanded ? ' expanded' : ''}`}
              aria-labelledby={`template-${template.id}-name`}
            >
              <div className="explorer-card-header">
                <div className="card-meta-row">
                  <span className="soft-badge">{template.duration_days} days</span>
                  <span className={template.strict_mode ? 'danger-badge' : 'soft-badge'}>
                    {template.strict_mode ? '⚡ Strict mode' : '✦ Flexible'}
                  </span>
                  <span className="soft-badge">{categoryLabel(template.category)}</span>
                  {template.is_religious ? <span className="faith-badge">Faith add-on</span> : null}
                </div>

                <h2 id={`template-${template.id}-name`}>{template.name}</h2>
                <p className="explorer-desc">{template.description}</p>

                <div className="explorer-summary">
                  <span>
                    <strong>{required.length}</strong> required habit{required.length !== 1 ? 's' : ''}
                  </span>
                  {optional.length > 0 && (
                    <span>
                      <strong>{optional.length}</strong> optional
                    </span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="explorer-habits" aria-label="Habit list">
                  {required.length > 0 && (
                    <>
                      <p className="habits-section-label">Required — missed habits reset a strict streak</p>
                      <ul className="explorer-habit-list">
                        {required.map((h) => <HabitPreviewRow key={h.id} habit={h} />)}
                      </ul>
                    </>
                  )}
                  {optional.length > 0 && (
                    <>
                      <p className="habits-section-label optional-label">Optional — no penalty for missing these</p>
                      <ul className="explorer-habit-list">
                        {optional.map((h) => <HabitPreviewRow key={h.id} habit={h} />)}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <div className="explorer-card-footer">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : template.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`template-habits-${template.id}`}
                >
                  {isExpanded ? 'Hide habits ↑' : `Preview ${template.habit_definitions.length} habits ↓`}
                </button>

                {isAlreadyActive ? (
                  <span className="success-badge">Already active</span>
                ) : (
                  <button
                    className="primary-action"
                    type="button"
                    disabled={isJoining}
                    onClick={() => handleJoin(template)}
                    id={`join-${template.id}`}
                  >
                    {isJoining ? 'Joining...' : 'Join challenge →'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
