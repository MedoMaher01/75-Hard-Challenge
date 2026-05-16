import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createChallenge,
  ensureProfile,
  ensureVisibilitySettings,
  leaveChallenge as leaveChallengeApi,
  loadDailyCheckins,
  loadResetEvents,
  loadTemplates,
  loadTodayReflection,
  loadUserChallenges,
  submitDailyCheckin,
  templateHabits,
  updateProfile,
  updateVisibilitySettings,
} from '../lib/api';
import type {
  Challenge,
  HabitCheckin,
  Profile,
  Reflection,
  ResetEvent,
  SubmitCheckinResult,
  TemplateWithHabits,
  VisibilitySettings,
} from '../lib/types';
import { useAuth } from './AuthProvider';
import { useToasts } from './ToastProvider';

interface ChallengeContextValue {
  profile: Profile | null;
  settings: VisibilitySettings | null;
  templates: TemplateWithHabits[];
  challenges: Challenge[];
  activeChallengeId: string | null;
  activeChallenge: Challenge | null;
  activeTemplate: TemplateWithHabits | null;
  activeHabits: ReturnType<typeof templateHabits>;
  checkins: HabitCheckin[];
  reflection: Reflection | null;
  resetEvents: ResetEvent[];
  loadingData: boolean;
  loadingDetails: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  refreshApp: () => void;
  selectChallenge: (challengeId: string | null) => void;
  startChallenge: (template: TemplateWithHabits) => Promise<Challenge>;
  leaveChallenge: (challengeId: string) => Promise<void>;
  submitCheckin: (input: {
    completedHabitIds: string[];
    privateHabitIds: string[];
    reflection: string | null;
    learnedToday: string | null;
    reflectionVisibility: 'private' | 'buddies' | 'public';
  }) => Promise<SubmitCheckinResult>;
  saveSettings: (
    nextProfile: Pick<Profile, 'id' | 'display_name' | 'username' | 'bio' | 'is_private'>,
    nextSettings: Pick<
      VisibilitySettings,
      'default_habit_visibility' | 'show_reflections' | 'show_completed_habits' | 'show_leaderboard'
    >,
  ) => Promise<void>;
  togglePrivate: () => Promise<void>;
  clearUserData: () => void;
}

const ChallengeContext = createContext<ChallengeContextValue | null>(null);

export function ChallengeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { notify } = useToasts();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<VisibilitySettings | null>(null);
  const [templates, setTemplates] = useState<TemplateWithHabits[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<HabitCheckin[]>([]);
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [resetEvents, setResetEvents] = useState<ResetEvent[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const clearUserData = useCallback(() => {
    setProfile(null);
    setSettings(null);
    setTemplates([]);
    setChallenges([]);
    setActiveChallengeId(null);
    setCheckins([]);
    setReflection(null);
    setResetEvents([]);
    setError(null);
  }, []);

  const refreshApp = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!session?.user) {
      clearUserData();
      return;
    }

    const user = session.user;
    let cancelled = false;

    async function loadAppData() {
      setLoadingData(true);
      setError(null);
      try {
        const nextProfile = await ensureProfile(user);
        const [nextSettings, nextTemplates, nextChallenges] = await Promise.all([
          ensureVisibilitySettings(user.id),
          loadTemplates(),
          loadUserChallenges(user.id),
        ]);

        if (cancelled) return;
        setProfile(nextProfile);
        setSettings(nextSettings);
        setTemplates(nextTemplates);
        setChallenges(nextChallenges);
        setActiveChallengeId((current) => {
          if (current && nextChallenges.some((challenge) => challenge.id === current)) return current;
          return nextChallenges.find((challenge) => challenge.status === 'active')?.id ?? nextChallenges[0]?.id ?? null;
        });
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load application data.');
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    void loadAppData();
    return () => { cancelled = true; };
  }, [clearUserData, refreshKey, session]);

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
      setError(null);
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
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load challenge details.');
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    }

    void loadChallengeDetails();
    return () => { cancelled = true; };
  }, [activeChallengeId, refreshKey]);

  const activeChallenge = challenges.find((challenge) => challenge.id === activeChallengeId) ?? null;
  const activeTemplate = activeChallenge
    ? templates.find((template) => template.id === activeChallenge.template_id) ?? null
    : null;
  const activeHabits = useMemo(() => templateHabits(activeTemplate), [activeTemplate]);

  const startChallenge = useCallback(async (template: TemplateWithHabits) => {
    if (!session?.user) throw new Error('Sign in before joining a challenge.');
    setLoadingData(true);
    setError(null);
    try {
      const created = await createChallenge(session.user.id, template);
      setActiveChallengeId(created.id);
      notify('Challenge joined — daily check-ins are ready.', 'success');
      refreshApp();
      return created;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not create challenge.';
      setError(message);
      notify(message, 'error');
      throw caught;
    } finally {
      setLoadingData(false);
    }
  }, [notify, refreshApp, session?.user]);

  const leaveChallenge = useCallback(async (challengeId: string) => {
    setError(null);
    try {
      await leaveChallengeApi(challengeId);
      setActiveChallengeId((current) => (current === challengeId ? null : current));
      notify('Challenge left. Your history is preserved.', 'success');
      refreshApp();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not leave challenge.';
      notify(message, 'error');
      throw caught;
    }
  }, [notify, refreshApp]);

  const submitCheckin = useCallback(async (input: Parameters<ChallengeContextValue['submitCheckin']>[0]) => {
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
  }, [activeChallenge, refreshApp]);

  const saveSettings = useCallback(async (
    nextProfile: Parameters<ChallengeContextValue['saveSettings']>[0],
    nextSettings: Parameters<ChallengeContextValue['saveSettings']>[1],
  ) => {
    await Promise.all([updateProfile(nextProfile), updateVisibilitySettings(nextProfile.id, nextSettings)]);
    notify('Settings saved.', 'success');
    refreshApp();
  }, [notify, refreshApp]);

  const togglePrivate = useCallback(async () => {
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
  }, [notify, profile, refreshApp]);

  const value = useMemo<ChallengeContextValue>(() => ({
    profile,
    settings,
    templates,
    challenges,
    activeChallengeId,
    activeChallenge,
    activeTemplate,
    activeHabits,
    checkins,
    reflection,
    resetEvents,
    loadingData,
    loadingDetails,
    error,
    setError,
    refreshApp,
    selectChallenge: setActiveChallengeId,
    startChallenge,
    leaveChallenge,
    submitCheckin,
    saveSettings,
    togglePrivate,
    clearUserData,
  }), [
    activeChallenge,
    activeChallengeId,
    activeHabits,
    activeTemplate,
    challenges,
    checkins,
    clearUserData,
    error,
    leaveChallenge,
    loadingData,
    loadingDetails,
    profile,
    reflection,
    refreshApp,
    resetEvents,
    saveSettings,
    settings,
    startChallenge,
    submitCheckin,
    templates,
    togglePrivate,
  ]);

  return <ChallengeContext.Provider value={value}>{children}</ChallengeContext.Provider>;
}

export function useChallengeData() {
  const value = useContext(ChallengeContext);
  if (!value) throw new Error('useChallengeData must be used inside ChallengeProvider');
  return value;
}
