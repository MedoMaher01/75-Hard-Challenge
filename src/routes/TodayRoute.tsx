import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ActiveChallenge } from '../components/ActiveChallenge';
import { DailyCheckIn } from '../components/DailyCheckIn';
import { ProgressDashboard } from '../components/ProgressDashboard';
import { useChallengeData } from '../providers/ChallengeProvider';

export function TodayRoute() {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    activeChallenge,
    activeTemplate,
    activeHabits,
    checkins,
    reflection,
    resetEvents,
    settings,
    loadingDetails,
    selectChallenge,
    leaveChallenge,
    submitCheckin,
  } = useChallengeData();

  useEffect(() => {
    if (id) selectChallenge(id);
  }, [id, selectChallenge]);

  return (
    <main className="content-grid today-view">
      <div className="left-column">
        {activeChallenge && activeTemplate ? (
          <ActiveChallenge
            challenge={activeChallenge}
            template={activeTemplate}
            onGoToCheckIn={() => {
              document.getElementById('checkin-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onLeave={leaveChallenge}
          />
        ) : null}

        {activeChallenge && activeTemplate ? (
          <ProgressDashboard
            challenge={activeChallenge}
            template={activeTemplate}
            habits={activeHabits}
            checkins={checkins}
            resetEvents={resetEvents}
          />
        ) : null}

        {!activeChallenge ? (
          <section className="panel empty-state" aria-labelledby="no-challenge-title">
            <p className="eyebrow">No active challenge</p>
            <h2 id="no-challenge-title">You haven't joined a challenge yet</h2>
            <p>Explore available challenge templates and preview their habits before committing.</p>
            <button
              className="primary-action"
              type="button"
              onClick={() => navigate('/explore')}
              style={{ marginTop: '1rem' }}
            >
              Browse challenges →
            </button>
          </section>
        ) : null}
      </div>

      <div className="right-column" id="checkin-section">
        {activeChallenge && activeTemplate ? (
          <>
            {loadingDetails ? <p className="loading-pill">Loading today's check-in...</p> : null}
            <DailyCheckIn
              challenge={activeChallenge}
              habits={activeHabits}
              checkins={checkins}
              reflection={reflection}
              defaultHabitVisibility={settings?.default_habit_visibility ?? 'private'}
              onSubmit={submitCheckin}
            />
          </>
        ) : (
          <section className="panel empty-state">
            <p className="eyebrow">Daily check-in</p>
            <h2>Join a challenge to unlock check-ins</h2>
            <p className="muted">
              Templates define required and optional habits. Strict templates reset when required habits are missed.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
