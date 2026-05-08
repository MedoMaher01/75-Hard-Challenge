import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AdminModeration } from './components/AdminModeration';
import { AppHeader, type AppView } from './components/AppHeader';
import { AuthView } from './components/AuthView';
import { ChallengePicker } from './components/ChallengePicker';
import { Community } from './components/Community';
import { DailyCheckIn } from './components/DailyCheckIn';
import { ProgressDashboard } from './components/ProgressDashboard';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupNotice } from './components/SetupNotice';
import {
  createChallenge,
  ensureProfile,
  ensureVisibilitySettings,
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
  VisibilitySettings,
} from './lib/types';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeView, setActiveView] = useState<AppView>('today');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<VisibilitySettings | null>(null);
  const [templates, setTemplates] = useState<TemplateWithHabits[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<HabitCheckin[]>([]);
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [resetEvents, setResetEvents] = useState<ResetEvent[]>([]);
  const [publicProgress, setPublicProgress] = useState<PublicProgress[]>([]);
  const [publicReflections, setPublicReflections] = useState<PublicReflection[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
          if (current && nextChallenges.some((challenge) => challenge.id === current)) return current;
          return nextChallenges[0]?.id ?? null;
        });
      } catch (caught) {
        if (!cancelled) setGlobalError(caught instanceof Error ? caught.message : 'Could not load application data.');
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    void loadAppData();
  }, [session, refreshKey]);

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
  }, [activeChallengeId, refreshKey]);

  useEffect(() => {
    if (!session?.user) return;

    const channel = supabase
      .channel('community-progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, () => setRefreshKey((key) => key + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reflections' }, () => setRefreshKey((key) => key + 1))
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  const activeChallenge = challenges.find((challenge) => challenge.id === activeChallengeId) ?? null;
  const activeTemplate = activeChallenge
    ? templates.find((template) => template.id === activeChallenge.template_id) ?? null
    : null;
  const activeHabits = templateHabits(activeTemplate);
  const canModerate = profile?.role === 'admin' || profile?.role === 'moderator';

  async function handleStartChallenge(template: TemplateWithHabits) {
    if (!session?.user) return;
    setLoadingData(true);
    setGlobalError(null);
    try {
      const created = await createChallenge(session.user.id, template);
      setActiveChallengeId(created.id);
      setActiveView('today');
      setRefreshKey((key) => key + 1);
    } catch (caught) {
      setGlobalError(caught instanceof Error ? caught.message : 'Could not create challenge.');
    } finally {
      setLoadingData(false);
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
    setRefreshKey((key) => key + 1);
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
    setRefreshKey((key) => key + 1);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSettings(null);
    setChallenges([]);
    setActiveChallengeId(null);
    setActiveView('today');
  }

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (booting) return <main className="setup-screen"><p className="loading-pill">Loading session...</p></main>;
  if (!session) return <AuthView />;

  return (
    <div className="app-shell" id="top">
      <AppHeader activeView={activeView} profile={profile} onChangeView={setActiveView} onSignOut={handleSignOut} />

      {globalError ? (
        <div className="global-alert" role="alert">
          {globalError}
        </div>
      ) : null}

      {loadingData ? <p className="loading-pill">Syncing challenge data...</p> : null}

      {activeView === 'today' ? (
        <main className="content-grid">
          <div className="left-column">
            <ChallengePicker
              templates={templates}
              challenges={challenges}
              activeChallengeId={activeChallengeId}
              onSelectChallenge={setActiveChallengeId}
              onStartChallenge={handleStartChallenge}
            />
            {activeChallenge && activeTemplate ? (
              <ProgressDashboard
                challenge={activeChallenge}
                template={activeTemplate}
                habits={activeHabits}
                checkins={checkins}
                resetEvents={resetEvents}
              />
            ) : null}
          </div>

          <div className="right-column">
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
                <p className="eyebrow">No active challenge</p>
                <h2>Join a template to unlock daily check-ins.</h2>
                <p>Templates define required and optional habits. Strict templates reset when required habits are missed.</p>
              </section>
            )}
          </div>
        </main>
      ) : null}

      {activeView === 'community' ? (
        <Community progress={publicProgress} reflections={publicReflections} onReportReflection={reportReflection} />
      ) : null}

      {activeView === 'settings' && profile && settings ? (
        <SettingsPanel profile={profile} settings={settings} onSave={handleSaveSettings} />
      ) : null}

      {activeView === 'admin' && profile && canModerate ? <AdminModeration profile={profile} /> : null}
    </div>
  );
}
