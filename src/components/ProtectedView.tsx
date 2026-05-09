import type { ReactNode } from 'react';
import type { Profile, UserRole } from '../lib/types';

interface ProtectedViewProps {
  profile: Profile | null;
  allowedRoles: UserRole[];
  children: ReactNode;
}

export function ProtectedView({ profile, allowedRoles, children }: ProtectedViewProps) {
  if (!profile || !allowedRoles.includes(profile.role)) {
    return (
      <main className="single-column">
        <section className="panel empty-state" role="alert">
          <p className="eyebrow">Protected area</p>
          <h2>Access denied</h2>
          <p className="muted">Your account does not have the role required for this dashboard.</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
