import { useNavigate } from 'react-router-dom';
import { ChallengeExplorer } from '../components/ChallengeExplorer';
import { useChallengeData } from '../providers/ChallengeProvider';

export function ExploreRoute() {
  const navigate = useNavigate();
  const { templates, challenges, loadingData, startChallenge } = useChallengeData();

  return (
    <ChallengeExplorer
      templates={templates}
      challenges={challenges}
      loading={loadingData}
      onJoin={async (template) => {
        await startChallenge(template);
        navigate('/today');
      }}
    />
  );
}
