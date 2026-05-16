import { Navigate } from 'react-router-dom';
import { AdminDashboard } from '../components/AdminDashboard';
import { ProtectedView } from '../components/ProtectedView';
import { useChallengeData } from '../providers/ChallengeProvider';
import { useToasts } from '../providers/ToastProvider';

export function AdminRoute() {
  const { profile, refreshApp } = useChallengeData();
  const { notify } = useToasts();
  const canModerate = profile?.role === 'super_admin' || profile?.role === 'moderator';

  if (profile && !canModerate) return <Navigate to="/dashboard" replace />;

  return (
    <ProtectedView profile={profile} allowedRoles={['super_admin', 'moderator']}>
      {profile && canModerate ? (
        <AdminDashboard profile={profile} onNotify={notify} onRefreshApp={refreshApp} />
      ) : null}
    </ProtectedView>
  );
}
