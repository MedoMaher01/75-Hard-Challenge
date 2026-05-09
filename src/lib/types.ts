export type ChallengeStatus = 'active' | 'completed' | 'paused';
export type ReflectionVisibility = 'private' | 'buddies' | 'public';
export type HabitVisibility = 'private' | 'buddies' | 'public';
export type UserRole = 'user' | 'moderator' | 'super_admin';
export type AccountStatus = 'active' | 'suspended' | 'banned';

export interface Profile {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  role: UserRole;
  account_status: AccountStatus;
  suspended_until: string | null;
  banned_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VisibilitySettings {
  id: string;
  user_id: string;
  default_habit_visibility: HabitVisibility;
  show_reflections: boolean;
  show_completed_habits: boolean;
  show_leaderboard: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChallengeTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  duration_days: number;
  strict_mode: boolean;
  category: string;
  is_religious: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface HabitDefinition {
  id: string;
  template_id: string;
  name: string;
  description: string;
  is_required: boolean;
  cadence: 'daily';
  visibility_default: HabitVisibility;
  sort_order: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface TemplateWithHabits extends ChallengeTemplate {
  habit_definitions: HabitDefinition[];
}

export interface Challenge {
  id: string;
  user_id: string;
  template_id: string;
  title: string;
  start_date: string;
  current_day: number;
  current_streak: number;
  longest_streak: number;
  status: ChallengeStatus;
  strict_mode: boolean;
  last_checkin_date: string | null;
  resets_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  challenge_templates?: ChallengeTemplate;
}

export interface HabitCheckin {
  id: string;
  challenge_id: string;
  habit_definition_id: string;
  checkin_date: string;
  completed: boolean;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Reflection {
  id: string;
  challenge_id: string;
  user_id: string;
  reflection_date: string;
  body: string | null;
  learned_today: string | null;
  visibility: ReflectionVisibility;
  is_hidden: boolean;
  reports_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ResetEvent {
  id: string;
  challenge_id: string;
  user_id: string;
  reset_date: string;
  missed_habit_ids: string[];
  previous_day: number;
  previous_streak: number;
  reason: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface PublicProgress {
  id: string;
  title: string;
  current_day: number;
  current_streak: number;
  status: ChallengeStatus;
  updated_at: string;
  profiles: Pick<Profile, 'display_name' | 'username'> | null;
  challenge_templates: Pick<ChallengeTemplate, 'name' | 'duration_days'> | null;
}

export interface PublicReflection extends Reflection {
  profiles: Pick<Profile, 'display_name' | 'username'> | null;
  challenges: Pick<Challenge, 'title'> | null;
}

export interface SubmitCheckinResult {
  reset: boolean;
  missed_required_count: number;
  current_day: number;
  current_streak: number;
  status: ChallengeStatus;
}

export interface AdminUser {
  id: string;
  display_name: string;
  username: string;
  role: UserRole;
  account_status: AccountStatus;
  suspended_until: string | null;
  banned_at: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  challenge_count: number;
  reflection_count: number;
}

export interface ModerationReport {
  report_id: string;
  status: 'open' | 'reviewing' | 'actioned' | 'dismissed';
  reason: string;
  created_at: string;
  reporter_username: string | null;
  author_id: string | null;
  author_username: string | null;
  reflection_id: string | null;
  reflection_body: string | null;
  learned_today: string | null;
  is_hidden: boolean | null;
  reports_count: number | null;
}

export interface PopularHabitStat {
  name: string;
  completed_count: number;
}

export interface AdminAnalytics {
  total_users: number;
  active_users_7d: number;
  daily_checkins: number;
  total_challenges: number;
  completed_challenges: number;
  completion_rate: number;
  reset_count: number;
  open_reports: number;
  popular_habits: PopularHabitStat[];
}

export interface AuditLogEntry {
  id: string;
  actor_username: string | null;
  target_username: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
