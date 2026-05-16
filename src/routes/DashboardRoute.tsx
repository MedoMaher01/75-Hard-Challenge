import { UserDashboard } from '../components/UserDashboard';
import { useChallengeData } from '../providers/ChallengeProvider';

interface DashboardRouteProps {
  onOpenExplore: () => void;
  onOpenSettings: () => void;
  onOpenToday: () => void;
}

export function DashboardRoute({ onOpenExplore, onOpenSettings, onOpenToday }: DashboardRouteProps) {
  const {
    profile,
    settings,
    challenges,
    activeChallenge,
    activeTemplate,
    activeHabits,
    checkins,
    resetEvents,
    reflection,
    togglePrivate,
  } = useChallengeData();

  if (!profile) return null;

  return (
    <UserDashboard
      profile={profile}
      settings={settings}
      challenges={challenges}
      activeChallenge={activeChallenge}
      activeTemplate={activeTemplate}
      habits={activeHabits}
      checkins={checkins}
      resetEvents={resetEvents}
      reflection={reflection}
      onOpenToday={onOpenToday}
      onOpenExplore={onOpenExplore}
      onOpenSettings={onOpenSettings}
      onTogglePrivate={togglePrivate}
    />
  );
}
