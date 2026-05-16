import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadPublicProgress, loadPublicReflections, reportReflection } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { PublicProgress, PublicReflection } from '../lib/types';
import { useAuth } from './AuthProvider';

interface CommunityContextValue {
  progress: PublicProgress[];
  reflections: PublicReflection[];
  loading: boolean;
  error: string | null;
  refreshCommunity: () => void;
  reportReflectionById: (reflectionId: string) => Promise<void>;
}

const CommunityContext = createContext<CommunityContextValue | null>(null);

export function CommunityProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [progress, setProgress] = useState<PublicProgress[]>([]);
  const [reflections, setReflections] = useState<PublicReflection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshCommunity = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProgress([]);
      setReflections([]);
      return;
    }

    let cancelled = false;

    async function loadCommunity() {
      setLoading(true);
      setError(null);
      try {
        const [nextProgress, nextReflections] = await Promise.all([
          loadPublicProgress(),
          loadPublicReflections(),
        ]);

        if (cancelled) return;
        setProgress(nextProgress);
        setReflections(nextReflections);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load community data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCommunity();
    return () => { cancelled = true; };
  }, [refreshKey, session?.user]);

  useEffect(() => {
    if (!session?.user.id) return;

    const channel = supabase
      .channel(`community-feed-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, refreshCommunity)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reflections' }, refreshCommunity)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshCommunity, session?.user.id]);

  const reportReflectionById = useCallback(async (reflectionId: string) => {
    await reportReflection(reflectionId);
  }, []);

  const value = useMemo<CommunityContextValue>(() => ({
    progress,
    reflections,
    loading,
    error,
    refreshCommunity,
    reportReflectionById,
  }), [error, loading, progress, reflections, refreshCommunity, reportReflectionById]);

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useCommunityData() {
  const value = useContext(CommunityContext);
  if (!value) throw new Error('useCommunityData must be used inside CommunityProvider');
  return value;
}
