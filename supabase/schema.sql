-- Supabase schema for the 75-day habit challenge MVP.
-- Run this in the Supabase SQL editor before running seed.sql.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  avatar_url text,
  bio text,
  is_private boolean not null default false,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.challenge_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  duration_days integer not null default 75 check (duration_days between 1 and 365),
  strict_mode boolean not null default true,
  category text not null default 'general',
  is_religious boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_definitions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.challenge_templates(id) on delete cascade,
  name text not null,
  description text not null,
  cadence text not null default 'daily' check (cadence = 'daily'),
  is_required boolean not null default true,
  visibility_default text not null default 'public' check (visibility_default in ('private', 'buddies', 'public')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (template_id, name)
);

create table if not exists public.visibility_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  default_habit_visibility text not null default 'private' check (default_habit_visibility in ('private', 'buddies', 'public')),
  show_reflections boolean not null default true,
  show_completed_habits boolean not null default true,
  show_leaderboard boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid not null references public.challenge_templates(id),
  title text not null,
  start_date date not null default current_date,
  current_day integer not null default 1 check (current_day >= 1),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  strict_mode boolean not null default true,
  last_checkin_date date,
  resets_count integer not null default 0 check (resets_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  habit_definition_id uuid not null references public.habit_definitions(id) on delete cascade,
  checkin_date date not null default current_date,
  completed boolean not null default false,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, habit_definition_id, checkin_date)
);

create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reflection_date date not null default current_date,
  body text check (body is null or char_length(body) <= 4000),
  learned_today text check (learned_today is null or char_length(learned_today) <= 1200),
  visibility text not null default 'private' check (visibility in ('private', 'buddies', 'public')),
  is_hidden boolean not null default false,
  reports_count integer not null default 0 check (reports_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, reflection_date)
);

create table if not exists public.reset_events (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reset_date date not null default current_date,
  missed_habit_ids uuid[] not null default array[]::uuid[],
  previous_day integer not null,
  previous_streak integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, reset_date)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references public.profiles(id),
  reflection_id uuid references public.reflections(id) on delete set null,
  action text not null check (action in ('hide', 'unhide', 'warn', 'ban_note')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists challenges_user_status_idx on public.challenges(user_id, status);
create index if not exists challenges_leaderboard_idx on public.challenges(status, current_streak desc, updated_at desc);
create index if not exists habit_checkins_challenge_date_idx on public.habit_checkins(challenge_id, checkin_date);
create index if not exists reflections_public_idx on public.reflections(visibility, is_hidden, created_at desc);
create index if not exists reset_events_challenge_idx on public.reset_events(challenge_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists set_visibility_settings_updated_at on public.visibility_settings;
create trigger set_visibility_settings_updated_at before update on public.visibility_settings for each row execute function public.set_updated_at();

drop trigger if exists set_challenges_updated_at on public.challenges;
create trigger set_challenges_updated_at before update on public.challenges for each row execute function public.set_updated_at();

drop trigger if exists set_habit_checkins_updated_at on public.habit_checkins;
create trigger set_habit_checkins_updated_at before update on public.habit_checkins for each row execute function public.set_updated_at();

drop trigger if exists set_reflections_updated_at on public.reflections;
create trigger set_reflections_updated_at before update on public.reflections for each row execute function public.set_updated_at();

create or replace function public.is_moderator(viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = viewer and role in ('admin', 'moderator')
  );
$$;

create or replace function public.profile_is_public(owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select not is_private from public.profiles where id = owner_id), false);
$$;

create or replace function public.can_show_leaderboard(owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select show_leaderboard from public.visibility_settings where user_id = owner_id), true);
$$;

create or replace function public.can_show_reflections(owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select show_reflections from public.visibility_settings where user_id = owner_id), true);
$$;

create or replace function public.can_show_completed_habits(owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select show_completed_habits from public.visibility_settings where user_id = owner_id), false);
$$;

create or replace function public.are_buddies(left_user uuid, right_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select left_user is not null and right_user is not null and exists (
    select 1 from public.follows
    where status = 'accepted'
      and (
        (follower_id = left_user and following_id = right_user)
        or (follower_id = right_user and following_id = left_user)
      )
  );
$$;

create or replace function public.owns_challenge(challenge_id_to_check uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenges
    where id = challenge_id_to_check and user_id = viewer
  );
$$;

create or replace function public.can_view_challenge(challenge_id_to_check uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.challenges c
    where c.id = challenge_id_to_check
      and (
        c.user_id = viewer
        or public.is_moderator(viewer)
        or (
          c.status in ('active', 'completed')
          and public.can_show_leaderboard(c.user_id)
          and (public.profile_is_public(c.user_id) or public.are_buddies(viewer, c.user_id))
        )
      )
  );
$$;

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_moderator(auth.uid()) then
    raise exception 'Only moderators can change profile roles.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_escalation on public.profiles;
create trigger prevent_role_escalation before update on public.profiles for each row execute function public.prevent_role_escalation();

create or replace function public.protect_reflection_moderation_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.allow_reflection_moderation_update', true) = 'true' or public.is_moderator(auth.uid()) then
    return new;
  end if;

  if not public.is_moderator(auth.uid()) then
    new.is_hidden = old.is_hidden;
    new.reports_count = old.reports_count;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_reflection_moderation_fields on public.reflections;
create trigger protect_reflection_moderation_fields before update on public.reflections for each row execute function public.protect_reflection_moderation_fields();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_username text;
begin
  generated_username := 'user_' || substring(replace(new.id::text, '-', '') from 1 for 12);

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Habit builder'),
    generated_username
  )
  on conflict (id) do nothing;

  insert into public.visibility_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.submit_daily_checkin(
  p_challenge_id uuid,
  p_checkin_date date default current_date,
  p_completed_habit_ids uuid[] default array[]::uuid[],
  p_private_habit_ids uuid[] default array[]::uuid[],
  p_reflection text default null,
  p_learned_today text default null,
  p_reflection_visibility text default 'private'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.challenges%rowtype;
  v_template public.challenge_templates%rowtype;
  v_habit public.habit_definitions%rowtype;
  v_missed_habit_ids uuid[] := array[]::uuid[];
  v_missed_required_count integer := 0;
  v_previous_day integer;
  v_previous_streak integer;
  v_new_day integer;
  v_new_streak integer;
  v_new_status text;
  v_reset boolean := false;
  v_existing_reset boolean := false;
  v_gap_missed boolean := false;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if p_reflection_visibility not in ('private', 'buddies', 'public') then
    raise exception 'Invalid reflection visibility.';
  end if;

  select * into v_challenge
  from public.challenges
  where id = p_challenge_id
  for update;

  if not found then
    raise exception 'Challenge not found.';
  end if;

  if v_challenge.user_id <> auth.uid() then
    raise exception 'You can only check in to your own challenge.' using errcode = '42501';
  end if;

  if v_challenge.status <> 'active' then
    raise exception 'Only active challenges can receive check-ins.';
  end if;

  select * into v_template
  from public.challenge_templates
  where id = v_challenge.template_id;

  if not found then
    raise exception 'Challenge template not found.';
  end if;

  for v_habit in
    select * from public.habit_definitions where template_id = v_challenge.template_id
  loop
    insert into public.habit_checkins (challenge_id, habit_definition_id, checkin_date, completed, is_private)
    values (
      p_challenge_id,
      v_habit.id,
      p_checkin_date,
      v_habit.id = any(p_completed_habit_ids),
      v_habit.id = any(p_private_habit_ids)
    )
    on conflict (challenge_id, habit_definition_id, checkin_date)
    do update set
      completed = excluded.completed,
      is_private = excluded.is_private,
      updated_at = now();
  end loop;

  select coalesce(array_agg(id order by sort_order), array[]::uuid[])
  into v_missed_habit_ids
  from public.habit_definitions
  where template_id = v_challenge.template_id
    and is_required
    and not (id = any(p_completed_habit_ids));

  v_missed_required_count := coalesce(array_length(v_missed_habit_ids, 1), 0);
  v_previous_day := v_challenge.current_day;
  v_previous_streak := v_challenge.current_streak;
  v_gap_missed := v_challenge.last_checkin_date is not null and p_checkin_date > (v_challenge.last_checkin_date + 1);

  select exists (
    select 1 from public.reset_events where challenge_id = p_challenge_id and reset_date = p_checkin_date
  ) into v_existing_reset;

  if v_challenge.strict_mode and (v_missed_required_count > 0 or v_gap_missed) then
    v_reset := true;
    v_reason := case
      when v_gap_missed and v_missed_required_count > 0 then 'Missed daily check-in window and required habits.'
      when v_gap_missed then 'Missed daily check-in window.'
      else 'Missed required habit.'
    end;

    insert into public.reset_events (
      challenge_id,
      user_id,
      reset_date,
      missed_habit_ids,
      previous_day,
      previous_streak,
      reason
    ) values (
      p_challenge_id,
      v_challenge.user_id,
      p_checkin_date,
      v_missed_habit_ids,
      v_previous_day,
      v_previous_streak,
      v_reason
    )
    on conflict (challenge_id, reset_date)
    do update set
      missed_habit_ids = excluded.missed_habit_ids,
      previous_day = excluded.previous_day,
      previous_streak = excluded.previous_streak,
      reason = excluded.reason,
      created_at = now();

    if v_missed_required_count = 0 then
      v_new_streak := 1;
      v_new_day := 1;
    else
      v_new_streak := 0;
      v_new_day := 1;
    end if;

    v_new_status := 'active';
  elsif v_missed_required_count = 0 then
    if v_challenge.last_checkin_date = p_checkin_date then
      v_new_streak := greatest(v_challenge.current_streak, 1);
    else
      v_new_streak := v_challenge.current_streak + 1;
    end if;
    v_new_day := least(v_new_streak, v_template.duration_days);
    v_new_status := case when v_new_streak >= v_template.duration_days then 'completed' else 'active' end;
  else
    v_new_streak := 0;
    v_new_day := v_challenge.current_day;
    v_new_status := 'active';
  end if;

  update public.challenges
  set
    current_day = greatest(v_new_day, 1),
    current_streak = greatest(v_new_streak, 0),
    longest_streak = greatest(longest_streak, v_new_streak),
    status = v_new_status,
    last_checkin_date = p_checkin_date,
    resets_count = case when v_reset and not v_existing_reset then resets_count + 1 else resets_count end,
    start_date = case
      when v_reset and v_missed_required_count > 0 then p_checkin_date + 1
      when v_reset then p_checkin_date
      else start_date
    end
  where id = p_challenge_id;

  if p_reflection is not null or p_learned_today is not null then
    insert into public.reflections (
      challenge_id,
      user_id,
      reflection_date,
      body,
      learned_today,
      visibility
    ) values (
      p_challenge_id,
      v_challenge.user_id,
      p_checkin_date,
      nullif(p_reflection, ''),
      nullif(p_learned_today, ''),
      p_reflection_visibility
    )
    on conflict (challenge_id, reflection_date)
    do update set
      body = excluded.body,
      learned_today = excluded.learned_today,
      visibility = excluded.visibility,
      updated_at = now();
  else
    delete from public.reflections
    where challenge_id = p_challenge_id
      and user_id = v_challenge.user_id
      and reflection_date = p_checkin_date;
  end if;

  return jsonb_build_object(
    'reset', v_reset,
    'missed_required_count', v_missed_required_count,
    'current_day', greatest(v_new_day, 1),
    'current_streak', greatest(v_new_streak, 0),
    'status', v_new_status
  );
end;
$$;

create or replace function public.report_reflection(p_reflection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  perform set_config('app.allow_reflection_moderation_update', 'true', true);

  update public.reflections
  set reports_count = reports_count + 1
  where id = p_reflection_id
    and user_id <> auth.uid();
end;
$$;

alter table public.profiles enable row level security;
alter table public.challenge_templates enable row level security;
alter table public.habit_definitions enable row level security;
alter table public.visibility_settings enable row level security;
alter table public.challenges enable row level security;
alter table public.habit_checkins enable row level security;
alter table public.reflections enable row level security;
alter table public.reset_events enable row level security;
alter table public.follows enable row level security;
alter table public.moderation_actions enable row level security;

drop policy if exists "Profiles are readable when public or connected" on public.profiles;
create policy "Profiles are readable when public or connected"
on public.profiles for select
using (
  id = auth.uid()
  or not is_private
  or public.are_buddies(auth.uid(), id)
  or public.is_moderator(auth.uid())
);

drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile"
on public.profiles for insert
with check (id = auth.uid() and role = 'user');

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update
using (id = auth.uid() or public.is_moderator(auth.uid()))
with check (id = auth.uid() or public.is_moderator(auth.uid()));

drop policy if exists "Templates are public" on public.challenge_templates;
create policy "Templates are public"
on public.challenge_templates for select
using (is_active);

drop policy if exists "Habits are public for active templates" on public.habit_definitions;
create policy "Habits are public for active templates"
on public.habit_definitions for select
using (exists (select 1 from public.challenge_templates t where t.id = template_id and t.is_active));

drop policy if exists "Users can read own visibility settings" on public.visibility_settings;
create policy "Users can read own visibility settings"
on public.visibility_settings for select
using (user_id = auth.uid() or public.is_moderator(auth.uid()));

drop policy if exists "Users can insert own visibility settings" on public.visibility_settings;
create policy "Users can insert own visibility settings"
on public.visibility_settings for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update own visibility settings" on public.visibility_settings;
create policy "Users can update own visibility settings"
on public.visibility_settings for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can view allowed challenges" on public.challenges;
create policy "Users can view allowed challenges"
on public.challenges for select
using (public.can_view_challenge(id, auth.uid()));

drop policy if exists "Users can create own challenges" on public.challenges;
create policy "Users can create own challenges"
on public.challenges for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update own challenges" on public.challenges;
create policy "Users can update own challenges"
on public.challenges for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Habit checkins are visible when allowed" on public.habit_checkins;
create policy "Habit checkins are visible when allowed"
on public.habit_checkins for select
using (
  public.owns_challenge(challenge_id, auth.uid())
  or public.is_moderator(auth.uid())
  or (
    not is_private
    and public.can_view_challenge(challenge_id, auth.uid())
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id and public.can_show_completed_habits(c.user_id)
    )
  )
);

drop policy if exists "Users can view allowed reflections" on public.reflections;
create policy "Users can view allowed reflections"
on public.reflections for select
using (
  user_id = auth.uid()
  or public.is_moderator(auth.uid())
  or (
    not is_hidden
    and public.can_show_reflections(user_id)
    and (
      (visibility = 'public' and public.profile_is_public(user_id))
      or (visibility = 'buddies' and public.are_buddies(auth.uid(), user_id))
    )
  )
);

drop policy if exists "Users can insert own reflections" on public.reflections;
create policy "Users can insert own reflections"
on public.reflections for insert
with check (user_id = auth.uid() and public.owns_challenge(challenge_id, auth.uid()));

drop policy if exists "Users can update own reflections" on public.reflections;
create policy "Users can update own reflections"
on public.reflections for update
using (user_id = auth.uid() or public.is_moderator(auth.uid()))
with check (user_id = auth.uid() or public.is_moderator(auth.uid()));

drop policy if exists "Users can view own reset events" on public.reset_events;
create policy "Users can view own reset events"
on public.reset_events for select
using (user_id = auth.uid() or public.is_moderator(auth.uid()));

drop policy if exists "Users can view own follows" on public.follows;
create policy "Users can view own follows"
on public.follows for select
using (follower_id = auth.uid() or following_id = auth.uid() or public.is_moderator(auth.uid()));

drop policy if exists "Users can follow others" on public.follows;
create policy "Users can follow others"
on public.follows for insert
with check (follower_id = auth.uid());

drop policy if exists "Users can update follow relationships" on public.follows;
create policy "Users can update follow relationships"
on public.follows for update
using (follower_id = auth.uid() or following_id = auth.uid())
with check (follower_id = auth.uid() or following_id = auth.uid());

drop policy if exists "Moderators can read moderation actions" on public.moderation_actions;
create policy "Moderators can read moderation actions"
on public.moderation_actions for select
using (public.is_moderator(auth.uid()));

drop policy if exists "Moderators can create moderation actions" on public.moderation_actions;
create policy "Moderators can create moderation actions"
on public.moderation_actions for insert
with check (public.is_moderator(auth.uid()) and moderator_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.challenge_templates, public.habit_definitions to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.visibility_settings to authenticated;
grant select, insert, update on public.challenges to authenticated;
grant select, insert, update on public.habit_checkins to authenticated;
grant select, insert, update on public.reflections to authenticated;
grant select on public.reset_events to authenticated;
grant select, insert, update on public.follows to authenticated;
grant select, insert on public.moderation_actions to authenticated;
grant execute on function public.submit_daily_checkin(uuid, date, uuid[], uuid[], text, text, text) to authenticated;
grant execute on function public.report_reflection(uuid) to authenticated;

-- Enable realtime events used by the frontend. If a table is already in the publication,
-- Supabase may report it as already added, which is safe to ignore during re-runs.
alter publication supabase_realtime add table public.challenges;
alter publication supabase_realtime add table public.reflections;
