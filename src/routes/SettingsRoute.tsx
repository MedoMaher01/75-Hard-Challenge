import { SettingsPanel } from '../components/SettingsPanel';
import { useChallengeData } from '../providers/ChallengeProvider';

export function SettingsRoute() {
  const { profile, settings, saveSettings } = useChallengeData();
  if (!profile || !settings) return null;

  return <SettingsPanel profile={profile} settings={settings} onSave={saveSettings} />;
}
