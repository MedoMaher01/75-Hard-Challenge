export type ChallengeStatus = 'active' | 'completed' | 'paused';
export type ReflectionVisibility = 'private' | 'buddies' | 'public';
export type HabitVisibility = 'private' | 'buddies' | 'public';
export type UserRole = 'user' | 'moderator' | 'admin';

export interface Profile {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  role: UserRole;
  created_at: string;
  updated_at: string;
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
