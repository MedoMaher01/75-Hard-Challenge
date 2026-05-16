import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActiveChallenge } from './components/ActiveChallenge';
import { AdminDashboard } from './components/AdminDashboard';
import { AppHeader, type AppView } from './components/AppHeader';
import { AuthView } from './components/AuthView';
import { ChallengeExplorer } from './components/ChallengeExplorer';
import { Community } from './components/Community';
import { DashboardSidebar } from './components/DashboardSidebar';
import { DailyCheckIn } from './components/DailyCheckIn';
import { ProgressDashboard } from './components/ProgressDashboard';
import { ProtectedView } from './components/ProtectedView';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupNotice } from './components/SetupNotice';
import { ToastHost, type ToastMessage, type ToastTone } from './components/ToastHost';
import { UserDashboard } from './components/UserDashboard';
import {
  createChallenge,
  ensureProfile,
  ensureVisibilitySettings,
  leaveChallenge,
  loadDailyCheckins,
  loadPublicProgress,
  loadPublicReflections,
  loadResetEvents,
  loadTemplates,
  loadTodayReflection,
  loadUserChallenges,
  reportReflection,
  submitDailyCheckin,
  templateHabits,
  updateProfile,
  updateVisibilitySettings,
} from './lib/api';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { applyTheme, getStoredTheme, toggleTheme } from './lib/theme';
import type {
  Challenge,
  HabitCheckin,
  Profile,
  PublicProgress,
  PublicReflection,
  Reflection,
  ResetEvent,
  SubmitCheckinResult,
  TemplateWithHabits,
  Theme,
  VisibilitySettings,
} from './lib/types';

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  // ── App data ──────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<VisibilitySettings | null>(null);
  const [templates, setTemplates] = useState<TemplateWithHabits[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);

  // ── Challenge-specific data ───────────────────────────────────────────────
  const [checkins, setCheckins] = useState<HabitCheckin[]>([]);
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [resetEvents, setResetEvents] = useState<ResetEvent[]>([]);

  // ── Community data ────────────────────────────────────────────────────────
  const [publicProgress, setPublicProgress] = useState<PublicProgress[]>([]);
  const [publicReflections, setPublicReflections] = useState<PublicReflection[]>([]);

  // ── Loading / error ───────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Toasts ────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Theme initialization
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function handleToggleTheme() {
    setTheme((current) => {
      const next = toggleTheme(current);
      applyTheme(next);
      return next;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Auth listener
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setBooting(false);
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setBooting(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Load app data on login / refresh
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!session?.user) return;

    const user = session.user;
    let cancelled = false;

    async function loadAppData() {
      setLoadingData(true);
      setGlobalError(null);
      try {
        const nextProfile = await ensureProfile(user);
        const [nextSettings, nextTemplates, nextChallenges, nextProgress, nextReflections] = await Promise.all([
          ensureVisibilitySettings(user.id),
          loadTemplates(),
          loadUserChallenges(user.id),
          loadPublicProgress(),
          loadPublicReflections(),
        ]);

        if (cancelled) return;
        setProfile(nextProfile);
        setSettings(nextSettings);
        setTemplates(nextTemplates);
        setChallenges(nextChallenges);
        setPublicProgress(nextProgress);
        setPublicReflections(nextReflections);
        setActiveChallengeId((current) => {
          // Keep current selection if it's still valid, otherwise default to first active
          if (current && nextChallenges.some((c) => c.id === current)) return current;
          return nextChallenges.find((c) => c.status === 'active')?.id ?? nextChallenges[0]?.id ?? null;
        });
      } catch (caught) {
        if (!cancelled) setGlobalError(caught instanceof Error ? caught.message : 'Could not load application data.');
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    void loadAppData();
    return () => { cancelled = true; };
  }, [session, refreshKey]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Load challenge-specific data when active challenge changes
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!activeChallengeId) {
      setCheckins([]);
      setReflection(null);
      setResetEvents([]);
      return;
    }

    const challengeId = activeChallengeId;
    let cancelled = false;

    async function loadChallengeDetails() {
      setLoadingDetails(true);
      setGlobalError(null);
      try {
        const [nextCheckins, nextReflection, nextResetEvents] = await Promise.all([
          loadDailyCheckins(challengeId),
          loadTodayReflection(challengeId),
          loadResetEvents(challengeId),
        ]);

        if (cancelled) return;
        setCheckins(nextCheckins);
        setReflection(nextReflection);
        setResetEvents(nextResetEvents);
      } catch (caught) {
        if (!cancelled) setGlobalError(caught instanceof Error ? caught.message : 'Could not load challenge details.');
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    }

    void loadChallengeDetails();
    return () => { cancelled = true; };
  }, [activeChallengeId, refreshKey]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Realtime subscription for community feed updates
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!session?.user.id) return;

    // Use a stable ID to prevent multiple subscriptions when session reference changes
    const userId = session.user.id;
    const channel = supabase
      .channel(`community-progress-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, () => setRefreshKey((k) => k + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reflections' }, () => setRefreshKey((k) => k + 1))
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Derived state
  // ═══════════════════════════════════════════════════════════════════════════
  const activeChallenge = challenges.find((c) => c.id === activeChallengeId) ?? null;
  const activeTemplate = activeChallenge
    ? templates.find((t) => t.id === activeChallenge.template_id) ?? null
    : null;
  const activeHabits = templateHabits(activeTemplate);
  const canModerate = profile?.role === 'super_admin' || profile?.role === 'moderator';

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════
  function notify(message: string, tone: ToastTone = 'info') {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 5000);
  }

  function refreshApp() {
    setRefreshKey((k) => k + 1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════════════════════════════════════════
  async function handleStartChallenge(template: TemplateWithHabits) {
    if (!session?.user) return;
    setLoadingData(true);
    setGlobalError(null);
    try {
      const created = await createChallenge(session.user.id, template);
      setActiveChallengeId(created.id);
      setActiveView('today');
      notify('Challenge joined — daily check-ins are ready.', 'success');
      refreshApp();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not create challenge.';
      setGlobalError(message);
      notify(message, 'error');
    } finally {
      setLoadingData(false);
    }
  }

  async function handleLeaveChallenge(challengeId: string) {
    setGlobalError(null);
    try {
      await leaveChallenge(challengeId);
      // If we left the active challenge, clear it
      if (activeChallengeId === challengeId) {
        setActiveChallengeId(null);
      }
      notify('Challenge left. Your history is preserved.', 'success');
      refreshApp();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not leave challenge.';
      notify(message, 'error');
      throw caught; // re-throw so ActiveChallenge can show its inline error
    }
  }

  async function handleDailySubmit(input: {
    completedHabitIds: string[];
    privateHabitIds: string[];
    reflection: string | null;
    learnedToday: string | null;
    reflectionVisibility: 'private' | 'buddies' | 'public';
  }): Promise<SubmitCheckinResult> {
    if (!activeChallenge) throw new Error('Choose a challenge before checking in.');
    const result = await submitDailyCheckin({
      challengeId: activeChallenge.id,
      completedHabitIds: input.completedHabitIds,
      privateHabitIds: input.privateHabitIds,
      reflection: input.reflection,
      learnedToday: input.learnedToday,
      reflectionVisibility: input.reflectionVisibility,
    });
    refreshApp();
    return result;
  }

  async function handleSaveSettings(
    nextProfile: Pick<Profile, 'id' | 'display_name' | 'username' | 'bio' | 'is_private'>,
    nextSettings: Pick<
      VisibilitySettings,
      'default_habit_visibility' | 'show_reflections' | 'show_completed_habits' | 'show_leaderboard'
    >,
  ) {
    await Promise.all([updateProfile(nextProfile), updateVisibilitySettings(nextProfile.id, nextSettings)]);
    notify('Settings saved.', 'success');
    refreshApp();
  }

  async function handleTogglePrivate() {
    if (!profile) return;
    await updateProfile({
      id: profile.id,
      display_name: profile.display_name,
      username: profile.username,
      bio: profile.bio,
      is_private: !profile.is_private,
    });
    notify(`Account is now ${profile.is_private ? 'public' : 'private'}.`, 'success');
    refreshApp();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSettings(null);
    setChallenges([]);
    setActiveChallengeId(null);
    setActiveView('dashboard');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Render guards
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isSupabaseConfigured) return <SetupNotice />;
  if (booting) return <main className="setup-screen"><p className="loading-pill">Loading session...</p></main>;
  if (!session) return <AuthView />;

  // ═══════════════════════════════════════════════════════════════════════════
  // Main layout
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="app-shell" id="top">
      <AppHeader
        activeView={activeView}
        profile={profile}
        theme={theme}
        onChangeView={setActiveView}
        onToggleTheme={handleToggleTheme}
        onSignOut={handleSignOut}
      />
      <ToastHost toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((t) => t.id !== id))} />

      {globalError ? (
        <div className="global-alert" role="alert">
          {globalError}
          <button
            className="ghost-button"
            type="button"
            style={{ marginLeft: '1rem', padding: '0.3rem 0.7rem', fontSize: '0.85rem' }}
            onClick={() => setGlobalError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {loadingData ? <p className="loading-pill">Syncing challenge data...</p> : null}

      {profile?.account_status && profile.account_status !== 'active' ? (
        <div className="global-alert" role="alert">
          Your account is <strong>{profile.account_status}</strong>. Server-side policies may block check-ins, reports, and community actions.
        </div>
      ) : null}

      <div className="dashboard-frame">
        <DashboardSidebar
          activeView={activeView}
          profile={profile}
          theme={theme}
          onChangeView={setActiveView}
          onToggleTheme={handleToggleTheme}
        />
        <div className="dashboard-content">

          {/* ── Dashboard (home) ────────────────────────────────────────── */}
          {activeView === 'dashboard' && profile ? (
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
              onOpenToday={() => setActiveView('today')}
              onOpenExplore={() => setActiveView('explore')}
              onOpenSettings={() => setActiveView('settings')}
              onTogglePrivate={handleTogglePrivate}
            />
          ) : null}

          {/* ── Challenge explorer ──────────────────────────────────────── */}
          {activeView === 'explore' ? (
            <ChallengeExplorer
              templates={templates}
              challenges={challenges}
              loading={loadingData}
              onJoin={handleStartChallenge}
            />
          ) : null}

          {/* ── Today: active challenge + daily check-in ────────────────── */}
          {activeView === 'today' ? (
            <main className="content-grid today-view">
              {/* Left column: active challenge status */}
              <div className="left-column">
                {activeChallenge && activeTemplate ? (
                  <ActiveChallenge
                    challenge={activeChallenge}
                    template={activeTemplate}
                    onGoToCheckIn={() => {
                      // Scroll / focus right column — no-op on desktop since it's visible
                      document.getElementById('checkin-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    onLeave={handleLeaveChallenge}
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
                      onClick={() => setActiveView('explore')}
                      style={{ marginTop: '1rem' }}
                    >
                      Browse challenges →
                    </button>
                  </section>
                ) : null}
              </div>

              {/* Right column: daily check-in */}
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
                      onSubmit={handleDailySubmit}
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
          ) : null}

          {/* ── Community ───────────────────────────────────────────────── */}
          {activeView === 'community' ? (
            <Community progress={publicProgress} reflections={publicReflections} onReportReflection={reportReflection} />
          ) : null}

          {/* ── Privacy settings ────────────────────────────────────────── */}
          {activeView === 'settings' && profile && settings ? (
            <SettingsPanel profile={profile} settings={settings} onSave={handleSaveSettings} />
          ) : null}

          {/* ── Admin / Moderation (role-gated) ─────────────────────────── */}
          {activeView === 'admin' ? (
            <ProtectedView profile={profile} allowedRoles={['super_admin', 'moderator']}>
              {profile && canModerate ? (
                <AdminDashboard profile={profile} onNotify={notify} onRefreshApp={refreshApp} />
              ) : null}
            </ProtectedView>
          ) : null}

        </div>
      </div>
    </div>
  );
}
