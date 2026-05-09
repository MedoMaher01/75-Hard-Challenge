import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { todayISO } from './dates';
import type {
  AccountStatus,
  AdminAnalytics,
  AdminUser,
  AuditLogEntry,
  Challenge,
  ChallengeTemplate,
  HabitCheckin,
  HabitDefinition,
  HabitVisibility,
  ModerationReport,
  Profile,
  PublicProgress,
  PublicReflection,
  Reflection,
  ReflectionVisibility,
  ResetEvent,
  SubmitCheckinResult,
  TemplateWithHabits,
  VisibilitySettings,
  UserRole,
} from './types';

function usernameFromUser(user: User) {
  const source = user.email?.split('@')[0] || user.id.slice(0, 8);
  const clean = source.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
  return `${clean || 'user'}_${user.id.slice(0, 6)}`;
}

export async function ensureProfile(user: User): Promise<Profile> {
  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing as Profile;

  const displayName =
    (user.user_metadata.display_name as string | undefined) || user.email?.split('@')[0] || 'Habit builder';

  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      display_name: displayName,
      username: usernameFromUser(user),
    })
    .select('*')
    .single();

  if (createError) throw createError;
  return created as Profile;
}

export async function ensureVisibilitySettings(userId: string): Promise<VisibilitySettings> {
  const { data: existing, error: readError } = await supabase
    .from('visibility_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing as VisibilitySettings;

  const { data: created, error: createError } = await supabase
    .from('visibility_settings')
    .insert({ user_id: userId })
    .select('*')
    .single();

  if (createError) throw createError;
  return created as VisibilitySettings;
}

export async function loadTemplates(): Promise<TemplateWithHabits[]> {
  const { data, error } = await supabase
    .from('challenge_templates')
    .select('*, habit_definitions(*)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('sort_order', { foreignTable: 'habit_definitions', ascending: true });

  if (error) throw error;
  return (data ?? []) as TemplateWithHabits[];
}

export async function loadManageableTemplates(): Promise<TemplateWithHabits[]> {
  const { data, error } = await supabase
    .from('challenge_templates')
    .select('*, habit_definitions(*)')
    .order('sort_order', { ascending: true })
    .order('sort_order', { foreignTable: 'habit_definitions', ascending: true });

  if (error) throw error;
  return (data ?? []) as TemplateWithHabits[];
}

export async function loadUserChallenges(userId: string): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*, challenge_templates(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Challenge[];
}

export async function createChallenge(userId: string, template: ChallengeTemplate, title?: string): Promise<Challenge> {
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      user_id: userId,
      template_id: template.id,
      title: title?.trim() || template.name,
      start_date: todayISO(),
      strict_mode: template.strict_mode,
    })
    .select('*, challenge_templates(*)')
    .single();

  if (error) throw error;
  return data as Challenge;
}

export async function loadDailyCheckins(challengeId: string, checkinDate = todayISO()): Promise<HabitCheckin[]> {
  const { data, error } = await supabase
    .from('habit_checkins')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('checkin_date', checkinDate);

  if (error) throw error;
  return (data ?? []) as HabitCheckin[];
}

export async function loadTodayReflection(challengeId: string, checkinDate = todayISO()): Promise<Reflection | null> {
  const { data, error } = await supabase
    .from('reflections')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('reflection_date', checkinDate)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as Reflection | null;
}

export async function loadResetEvents(challengeId: string): Promise<ResetEvent[]> {
  const { data, error } = await supabase
    .from('reset_events')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data ?? []) as ResetEvent[];
}

export async function submitDailyCheckin(input: {
  challengeId: string;
  checkinDate?: string;
  completedHabitIds: string[];
  privateHabitIds: string[];
  reflection: string | null;
  learnedToday: string | null;
  reflectionVisibility: ReflectionVisibility;
}): Promise<SubmitCheckinResult> {
  const { data, error } = await supabase.rpc('submit_daily_checkin', {
    p_challenge_id: input.challengeId,
    p_checkin_date: input.checkinDate ?? todayISO(),
    p_completed_habit_ids: input.completedHabitIds,
    p_private_habit_ids: input.privateHabitIds,
    p_reflection: input.reflection,
    p_learned_today: input.learnedToday,
    p_reflection_visibility: input.reflectionVisibility,
  });

  if (error) throw error;
  return data as SubmitCheckinResult;
}

export async function loadPublicProgress(): Promise<PublicProgress[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('id, title, current_day, current_streak, status, updated_at, profiles(display_name, username), challenge_templates(name, duration_days)')
    .in('status', ['active', 'completed'])
    .order('current_streak', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as unknown as PublicProgress[];
}

export async function loadPublicReflections(): Promise<PublicReflection[]> {
  const { data, error } = await supabase
    .from('reflections')
    .select('*, profiles(display_name, username), challenges(title)')
    .eq('visibility', 'public')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as PublicReflection[];
}

export async function updateProfile(profile: Pick<Profile, 'id' | 'display_name' | 'username' | 'bio' | 'is_private'>) {
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: profile.display_name.trim(),
      username: profile.username.trim().toLowerCase(),
      bio: profile.bio?.trim() || null,
      is_private: profile.is_private,
    })
    .eq('id', profile.id);

  if (error) throw error;
}

export async function updateVisibilitySettings(
  userId: string,
  settings: Pick<
    VisibilitySettings,
    'default_habit_visibility' | 'show_reflections' | 'show_completed_habits' | 'show_leaderboard'
  >,
) {
  const { error } = await supabase
    .from('visibility_settings')
    .update(settings)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function reportReflection(reflectionId: string, reason = 'Community report') {
  const { error } = await supabase.rpc('report_reflection', {
    p_reflection_id: reflectionId,
    p_reason: reason,
  });

  if (error) throw error;
}

export async function loadAdminUsers(search = ''): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_search: search.trim() || null,
    p_limit: 50,
  });

  if (error) throw error;
  return (data ?? []) as AdminUser[];
}

export async function loadModerationReports(status: 'open' | 'reviewing' | 'actioned' | 'dismissed' | null = 'open'):
  Promise<ModerationReport[]> {
  const { data, error } = await supabase.rpc('admin_list_reports', {
    p_status: status,
    p_limit: 50,
  });

  if (error) throw error;
  return (data ?? []) as ModerationReport[];
}

export async function loadAdminAnalytics(): Promise<AdminAnalytics> {
  const { data, error } = await supabase.rpc('admin_get_analytics');

  if (error) throw error;
  return data as AdminAnalytics;
}

export async function changeUserRole(userId: string, role: UserRole, reason: string) {
  const { error } = await supabase.rpc('admin_change_user_role', {
    p_user_id: userId,
    p_new_role: role,
    p_reason: reason,
  });

  if (error) throw error;
}

export async function setUserStatus(input: {
  userId: string;
  status: AccountStatus;
  suspendedUntil: string | null;
  reason: string;
}) {
  const { error } = await supabase.rpc('admin_set_user_status', {
    p_user_id: input.userId,
    p_status: input.status,
    p_suspended_until: input.suspendedUntil,
    p_reason: input.reason,
  });

  if (error) throw error;
}

export async function warnUser(userId: string, reason: string) {
  const { error } = await supabase.rpc('admin_warn_user', {
    p_user_id: userId,
    p_reason: reason,
  });

  if (error) throw error;
}

export async function moderateReflection(reflectionId: string, action: 'hide' | 'unhide' | 'delete' | 'dismiss_report', reason: string) {
  const { error } = await supabase.rpc('admin_moderate_reflection', {
    p_reflection_id: reflectionId,
    p_action: action,
    p_reason: reason,
  });

  if (error) throw error;
}

export async function loadAuditLogs(): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase.rpc('admin_list_audit_logs', {
    p_limit: 100,
  });

  if (error) throw error;
  return (data ?? []) as AuditLogEntry[];
}

export async function updateChallengeTemplate(template: Pick<ChallengeTemplate, 'id' | 'name' | 'description' | 'is_active' | 'strict_mode'>) {
  const { error } = await supabase.rpc('admin_update_template', {
    p_template_id: template.id,
    p_name: template.name,
    p_description: template.description,
    p_is_active: template.is_active,
    p_strict_mode: template.strict_mode,
  });

  if (error) throw error;
}

export async function updateSystemSetting(key: string, value: unknown, description: string) {
  const { error } = await supabase.rpc('admin_upsert_setting', {
    p_key: key,
    p_value: value,
    p_description: description,
  });

  if (error) throw error;
}

export function templateHabits(template: TemplateWithHabits | null | undefined): HabitDefinition[] {
  return template?.habit_definitions?.slice().sort((a, b) => a.sort_order - b.sort_order) ?? [];
}
