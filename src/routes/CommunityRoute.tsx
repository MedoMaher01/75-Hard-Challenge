import { Community } from '../components/Community';
import { useCommunityData } from '../providers/CommunityProvider';

export function CommunityRoute() {
  const { progress, reflections, loading, error, reportReflectionById } = useCommunityData();

  return (
    <>
      {loading ? <p className="loading-pill">Loading community data...</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <Community progress={progress} reflections={reflections} onReportReflection={reportReflectionById} />
    </>
  );
}
