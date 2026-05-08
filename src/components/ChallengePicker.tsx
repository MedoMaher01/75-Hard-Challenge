import type { Challenge, TemplateWithHabits } from '../lib/types';

interface ChallengePickerProps {
  templates: TemplateWithHabits[];
  challenges: Challenge[];
  activeChallengeId: string | null;
  onSelectChallenge: (challengeId: string) => void;
  onStartChallenge: (template: TemplateWithHabits) => Promise<void>;
}

export function ChallengePicker({
  templates,
  challenges,
  activeChallengeId,
  onSelectChallenge,
  onStartChallenge,
}: ChallengePickerProps) {
  return (
    <section className="panel challenge-picker" aria-labelledby="challenge-picker-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Create or join</p>
          <h2 id="challenge-picker-title">Choose your challenge</h2>
        </div>
        {challenges.length ? <span className="soft-badge">{challenges.length} joined</span> : null}
      </div>

      {challenges.length ? (
        <label className="select-label">
          Active challenge
          <select value={activeChallengeId ?? ''} onChange={(event) => onSelectChallenge(event.target.value)}>
            {challenges.map((challenge) => (
              <option key={challenge.id} value={challenge.id}>
                {challenge.title} - day {challenge.current_day}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="muted">Pick a template to join the community challenge and start tracking today.</p>
      )}

      <div className="template-grid">
        {templates.map((template) => {
          const requiredCount = template.habit_definitions.filter((habit) => habit.is_required).length;
          const optionalCount = template.habit_definitions.length - requiredCount;

          return (
            <article className="template-card" key={template.id}>
              <div>
                <div className="card-meta-row">
                  <span className="soft-badge">{template.duration_days} days</span>
                  <span className={template.strict_mode ? 'danger-badge' : 'soft-badge'}>
                    {template.strict_mode ? 'Strict reset' : 'Flexible'}
                  </span>
                  {template.is_religious ? <span className="faith-badge">Optional faith add-on</span> : null}
                </div>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
              </div>

              <div className="template-footer">
                <span>
                  {requiredCount} required{optionalCount ? `, ${optionalCount} optional` : ''}
                </span>
                <button className="secondary-action" type="button" onClick={() => onStartChallenge(template)}>
                  Join
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
