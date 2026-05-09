-- RBAC, moderation, audit, and anti-cheat migration for the dashboard system.
-- Run after schema.sql and seed.sql. It is written to be safe to re-run.

create extension if not exists pgcrypto;

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%role%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end $$;

update public.profiles set role = 'super_admin' where role = 'admin';

alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'moderator', 'super_admin'));

alter table public.profiles
  alter column role set default 'user',
  add column if not exists account_status text not null default 'active' check (account_status in ('active', 'suspended', 'banned')),
  add column if not exists suspended_until timestamptz,
  add column if not exists banned_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.challenge_templates add column if not exists updated_at timestamptz not null default now();
alter table public.challenge_templates add column if not exists deleted_at timestamptz;
alter table public.habit_definitions add column if not exists updated_at timestamptz not null default now();
alter table public.habit_definitions add column if not exists deleted_at timestamptz;
alter table public.visibility_settings add column if not exists deleted_at timestamptz;
alter table public.challenges add column if not exists deleted_at timestamptz;
alter table public.habit_checkins add column if not exists deleted_at timestamptz;
alter table public.reflections add column if not exists deleted_at timestamptz;
alter table public.reset_events add column if not exists updated_at timestamptz not null default now();
alter table public.reset_events add column if not exists deleted_at timestamptz;
alter table public.follows add column if not exists updated_at timestamptz not null default now();
alter table public.follows add column if not exists deleted_at timestamptz;
alter table public.moderation_actions add column if not exists report_id uuid;
alter table public.moderation_actions add column if not exists target_user_id uuid references public.profiles(id) on delete set null;
alter table public.moderation_actions add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.moderation_actions add column if not exists updated_at timestamptz not null default now();
alter table public.moderation_actions add column if not exists deleted_at timestamptz;

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.moderation_actions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%action%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.moderation_actions drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.moderation_actions
  add constraint moderation_actions_action_check check (
    action in ('hide', 'unhide', 'delete', 'dismiss_report', 'warn', 'suspend', 'ban', 'activate', 'role_change', 'feature', 'settings_update')
  );

create table if not exists public.roles (
  role text primary key check (role in ('user', 'moderator', 'super_admin')),
  name text not null,
  description text not null,
  priority integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.permissions (
  permission_key text primary key,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.role_permissions (
  role text not null references public.roles(role) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role, permission_key)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('reflection', 'profile', 'challenge')),
  reflection_id uuid references public.reflections(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.user_suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  status text not null check (status in ('suspended', 'banned', 'active')),
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.featured_content (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('reflection', 'challenge')),
  reflection_id uuid references public.reflections(id) on delete cascade,
  challenge_id uuid references public.challenges(id) on delete cascade,
  featured_by uuid not null references public.profiles(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (reflection_id is not null or challenge_id is not null)
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.moderation_actions
  drop constraint if exists moderation_actions_report_id_fkey;

alter table public.moderation_actions
  add constraint moderation_actions_report_id_fkey foreign key (report_id) references public.reports(id) on delete set null;

create unique index if not exists reports_unique_reflection_reporter_idx
  on public.reports(reporter_id, reflection_id)
  where reflection_id is not null and deleted_at is null;

create index if not exists profiles_role_status_idx on public.profiles(role, account_status) where deleted_at is null;
create index if not exists reports_status_created_idx on public.reports(status, created_at desc) where deleted_at is null;
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);
create index if not exists user_suspensions_user_idx on public.user_suspensions(user_id, created_at desc) where deleted_at is null;
create index if not exists featured_content_active_idx on public.featured_content(content_type, starts_at, ends_at) where deleted_at is null;

insert into public.roles (role, name, description, priority)
values
  ('user', 'User', 'Normal community member with ownership over personal content.', 10),
  ('moderator', 'Moderator', 'Can review reports, hide abusive content, warn users, and issue temporary suspensions.', 50),
  ('super_admin', 'Super Admin', 'Full system control including roles, settings, templates, bans, and audit logs.', 100)
on conflict (role) do update set name = excluded.name, description = excluded.description, priority = excluded.priority, updated_at = now();

insert into public.permissions (permission_key, description)
values
  ('content:moderate', 'Review reports and hide or unhide reported content.'),
  ('users:warn', 'Warn users for policy violations.'),
  ('users:suspend', 'Temporarily suspend users.'),
  ('users:ban', 'Ban users.'),
  ('users:manage_roles', 'Assign and remove privileged roles.'),
  ('templates:manage', 'Manage challenge templates.'),
  ('settings:manage', 'Manage platform settings.'),
  ('audit:read', 'Read administrative audit logs.'),
  ('analytics:read', 'Read aggregate platform analytics.'),
  ('content:feature', 'Feature public challenge content.')
on conflict (permission_key) do update set description = excluded.description, updated_at = now();

insert into public.role_permissions (role, permission_key)
values
  ('moderator', 'content:moderate'),
  ('moderator', 'users:warn'),
  ('moderator', 'users:suspend'),
  ('moderator', 'analytics:read'),
  ('super_admin', 'content:moderate'),
  ('super_admin', 'users:warn'),
  ('super_admin', 'users:suspend'),
  ('super_admin', 'users:ban'),
  ('super_admin', 'users:manage_roles'),
  ('super_admin', 'templates:manage'),
  ('super_admin', 'settings:manage'),
  ('super_admin', 'audit:read'),
  ('super_admin', 'analytics:read'),
  ('super_admin', 'content:feature')
on conflict do nothing;

insert into public.system_settings (key, value, description)
values
  ('checkin_deadline_hours', '4'::jsonb, 'Hours after midnight UTC when yesterday check-ins remain editable.'),
  ('reports_auto_hide_threshold', '5'::jsonb, 'Report count that should be reviewed urgently by moderators.')
on conflict (key) do nothing;

drop trigger if exists set_challenge_templates_updated_at on public.challenge_templates;
create trigger set_challenge_templates_updated_at before update on public.challenge_templates for each row execute function public.set_updated_at();

drop trigger if exists set_habit_definitions_updated_at on public.habit_definitions;
create trigger set_habit_definitions_updated_at before update on public.habit_definitions for each row execute function public.set_updated_at();

drop trigger if exists set_reset_events_updated_at on public.reset_events;
create trigger set_reset_events_updated_at before update on public.reset_events for each row execute function public.set_updated_at();

drop trigger if exists set_follows_updated_at on public.follows;
create trigger set_follows_updated_at before update on public.follows for each row execute function public.set_updated_at();

drop trigger if exists set_moderation_actions_updated_at on public.moderation_actions;
create trigger set_moderation_actions_updated_at before update on public.moderation_actions for each row execute function public.set_updated_at();

drop trigger if exists set_roles_updated_at on public.roles;
create trigger set_roles_updated_at before update on public.roles for each row execute function public.set_updated_at();

drop trigger if exists set_permissions_updated_at on public.permissions;
create trigger set_permissions_updated_at before update on public.permissions for each row execute function public.set_updated_at();

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at before update on public.reports for each row execute function public.set_updated_at();

drop trigger if exists set_user_suspensions_updated_at on public.user_suspensions;
create trigger set_user_suspensions_updated_at before update on public.user_suspensions for each row execute function public.set_updated_at();

drop trigger if exists set_featured_content_updated_at on public.featured_content;
create trigger set_featured_content_updated_at before update on public.featured_content for each row execute function public.set_updated_at();

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at before update on public.system_settings for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid() and deleted_at is null), 'user');
$$;

create or replace function public.is_super_admin(viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = viewer
      and role = 'super_admin'
      and account_status = 'active'
      and deleted_at is null
  );
$$;

create or replace function public.is_moderator(viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = viewer
      and role in ('super_admin', 'moderator')
      and account_status = 'active'
      and deleted_at is null
  );
$$;

create or replace function public.has_permission(permission_to_check text, viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role = p.role
    where p.id = viewer
      and p.account_status = 'active'
      and p.deleted_at is null
      and rp.permission_key = permission_to_check
  );
$$;

create or replace function public.is_account_active(user_to_check uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = user_to_check
      and deleted_at is null
      and account_status <> 'banned'
      and (account_status <> 'suspended' or suspended_until is null or suspended_until <= now())
  );
$$;

create or replace function public.checkin_deadline_hours()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, least(24, coalesce((select (value #>> '{}')::integer from public.system_settings where key = 'checkin_deadline_hours' and deleted_at is null), 4)));
$$;

create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_target_user_id uuid default null,
  p_old_values jsonb default null,
  p_new_values jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, target_user_id, action, entity_type, entity_id, old_values, new_values, metadata)
  values (auth.uid(), p_target_user_id, p_action, p_entity_type, p_entity_id, p_old_values, p_new_values, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.write_audit_log(text, text, text, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.allow_profile_security_update', true) = 'true' then
    return new;
  end if;

  new.role = old.role;
  new.account_status = old.account_status;
  new.suspended_until = old.suspended_until;
  new.banned_at = old.banned_at;
  new.deleted_at = old.deleted_at;
  return new;
end;
$$;

drop trigger if exists prevent_role_escalation on public.profiles;
drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields before update on public.profiles for each row execute function public.protect_profile_security_fields();

create or replace function public.protect_reflection_moderation_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.allow_reflection_moderation_update', true) = 'true' then
    return new;
  end if;

  new.is_hidden = old.is_hidden;
  new.reports_count = old.reports_count;
  new.deleted_at = old.deleted_at;
  return new;
end;
$$;

drop trigger if exists protect_reflection_moderation_fields on public.reflections;
create trigger protect_reflection_moderation_fields before update on public.reflections for each row execute function public.protect_reflection_moderation_fields();

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
    join public.profiles p on p.id = c.user_id
    where c.id = challenge_id_to_check
      and c.deleted_at is null
      and p.deleted_at is null
      and (
        c.user_id = viewer
        or public.is_moderator(viewer)
        or (
          c.status in ('active', 'completed')
          and public.can_show_leaderboard(c.user_id)
          and p.account_status = 'active'
          and (not p.is_private or public.are_buddies(viewer, c.user_id))
        )
      )
  );
$$;

drop function if exists public.report_reflection(uuid);

create or replace function public.report_reflection(p_reflection_id uuid, p_reason text default 'Community report')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_existing_report boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.is_account_active(auth.uid()) then
    raise exception 'Your account cannot submit reports right now.' using errcode = '42501';
  end if;

  select user_id into v_owner_id
  from public.reflections
  where id = p_reflection_id and deleted_at is null;

  if v_owner_id is null then
    raise exception 'Reflection not found.';
  end if;

  if v_owner_id = auth.uid() then
    raise exception 'You cannot report your own reflection.';
  end if;

  select exists (
    select 1 from public.reports
    where reporter_id = auth.uid()
      and reflection_id = p_reflection_id
      and deleted_at is null
  ) into v_existing_report;

  insert into public.reports (reporter_id, content_type, reflection_id, reported_user_id, reason)
  values (auth.uid(), 'reflection', p_reflection_id, v_owner_id, coalesce(nullif(trim(p_reason), ''), 'Community report'))
  on conflict (reporter_id, reflection_id) where reflection_id is not null and deleted_at is null
  do update set reason = excluded.reason, status = 'open', updated_at = now();

  if not v_existing_report then
    perform set_config('app.allow_reflection_moderation_update', 'true', true);
    update public.reflections
    set reports_count = reports_count + 1
    where id = p_reflection_id;
  end if;
end;
$$;

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

  if not public.is_account_active(auth.uid()) then
    raise exception 'Your account is suspended or banned.' using errcode = '42501';
  end if;

  if p_checkin_date > current_date then
    raise exception 'Future check-ins are not allowed.';
  end if;

  if p_checkin_date < current_date
    and now() > (p_checkin_date::timestamptz + interval '1 day' + make_interval(hours => public.checkin_deadline_hours())) then
    raise exception 'Past check-in deadline has passed.';
  end if;

  if p_reflection_visibility not in ('private', 'buddies', 'public') then
    raise exception 'Invalid reflection visibility.';
  end if;

  select * into v_challenge
  from public.challenges
  where id = p_challenge_id and deleted_at is null
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

  if v_challenge.last_checkin_date is not null and p_checkin_date < v_challenge.last_checkin_date then
    raise exception 'Older check-ins cannot be edited after a newer submission.';
  end if;

  select * into v_template
  from public.challenge_templates
  where id = v_challenge.template_id and deleted_at is null;

  if not found then
    raise exception 'Challenge template not found.';
  end if;

  for v_habit in
    select * from public.habit_definitions where template_id = v_challenge.template_id and deleted_at is null
  loop
    insert into public.habit_checkins (challenge_id, habit_definition_id, checkin_date, completed, is_private)
    values (
      p_challenge_id,
      v_habit.id,
      p_checkin_date,
      v_habit.id = any(coalesce(p_completed_habit_ids, array[]::uuid[])),
      v_habit.id = any(coalesce(p_private_habit_ids, array[]::uuid[]))
    )
    on conflict (challenge_id, habit_definition_id, checkin_date)
    do update set
      completed = excluded.completed,
      is_private = excluded.is_private,
      updated_at = now(),
      deleted_at = null;
  end loop;

  select coalesce(array_agg(id order by sort_order), array[]::uuid[])
  into v_missed_habit_ids
  from public.habit_definitions
  where template_id = v_challenge.template_id
    and deleted_at is null
    and is_required
    and not (id = any(coalesce(p_completed_habit_ids, array[]::uuid[])));

  v_missed_required_count := coalesce(array_length(v_missed_habit_ids, 1), 0);
  v_previous_day := v_challenge.current_day;
  v_previous_streak := v_challenge.current_streak;
  v_gap_missed := v_challenge.last_checkin_date is not null and p_checkin_date > (v_challenge.last_checkin_date + 1);

  select exists (
    select 1 from public.reset_events where challenge_id = p_challenge_id and reset_date = p_checkin_date and deleted_at is null
  ) into v_existing_reset;

  if v_challenge.strict_mode and (v_missed_required_count > 0 or v_gap_missed) then
    v_reset := true;
    v_reason := case
      when v_gap_missed and v_missed_required_count > 0 then 'Missed daily check-in window and required habits.'
      when v_gap_missed then 'Missed daily check-in window.'
      else 'Missed required habit.'
    end;

    insert into public.reset_events (challenge_id, user_id, reset_date, missed_habit_ids, previous_day, previous_streak, reason)
    values (p_challenge_id, v_challenge.user_id, p_checkin_date, v_missed_habit_ids, v_previous_day, v_previous_streak, v_reason)
    on conflict (challenge_id, reset_date)
    do update set missed_habit_ids = excluded.missed_habit_ids, previous_day = excluded.previous_day, previous_streak = excluded.previous_streak, reason = excluded.reason, updated_at = now(), deleted_at = null;

    v_new_streak := case when v_missed_required_count = 0 then 1 else 0 end;
    v_new_day := 1;
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
    start_date = case when v_reset and v_missed_required_count > 0 then p_checkin_date + 1 when v_reset then p_checkin_date else start_date end
  where id = p_challenge_id;

  perform set_config('app.allow_reflection_moderation_update', 'true', true);

  if p_reflection is not null or p_learned_today is not null then
    insert into public.reflections (challenge_id, user_id, reflection_date, body, learned_today, visibility)
    values (p_challenge_id, v_challenge.user_id, p_checkin_date, nullif(p_reflection, ''), nullif(p_learned_today, ''), p_reflection_visibility)
    on conflict (challenge_id, reflection_date)
    do update set body = excluded.body, learned_today = excluded.learned_today, visibility = excluded.visibility, updated_at = now(), deleted_at = null;
  else
    update public.reflections
    set deleted_at = now(), updated_at = now()
    where challenge_id = p_challenge_id
      and user_id = v_challenge.user_id
      and reflection_date = p_checkin_date;
  end if;

  if v_reset then
    perform public.write_audit_log('challenge_reset', 'challenge', p_challenge_id::text, v_challenge.user_id, null, jsonb_build_object('missed_required_count', v_missed_required_count), jsonb_build_object('reason', v_reason));
  end if;

  return jsonb_build_object('reset', v_reset, 'missed_required_count', v_missed_required_count, 'current_day', greatest(v_new_day, 1), 'current_streak', greatest(v_new_streak, 0), 'status', v_new_status);
end;
$$;

create or replace function public.admin_list_users(p_search text default null, p_limit integer default 50)
returns table (
  id uuid,
  display_name text,
  username text,
  role text,
  account_status text,
  suspended_until timestamptz,
  banned_at timestamptz,
  is_private boolean,
  created_at timestamptz,
  updated_at timestamptz,
  challenge_count bigint,
  reflection_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator(auth.uid()) then
    raise exception 'Moderator access required.' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.username,
    p.role,
    p.account_status,
    p.suspended_until,
    p.banned_at,
    p.is_private,
    p.created_at,
    p.updated_at,
    (select count(*) from public.challenges c where c.user_id = p.id and c.deleted_at is null) as challenge_count,
    (select count(*) from public.reflections r where r.user_id = p.id and r.deleted_at is null) as reflection_count
  from public.profiles p
  where p.deleted_at is null
    and (
      p_search is null
      or p.username ilike '%' || p_search || '%'
      or p.display_name ilike '%' || p_search || '%'
    )
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create or replace function public.admin_list_reports(p_status text default 'open', p_limit integer default 50)
returns table (
  report_id uuid,
  status text,
  reason text,
  created_at timestamptz,
  reporter_username text,
  author_id uuid,
  author_username text,
  reflection_id uuid,
  reflection_body text,
  learned_today text,
  is_hidden boolean,
  reports_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('content:moderate', auth.uid()) then
    raise exception 'Moderation access required.' using errcode = '42501';
  end if;

  return query
  select
    rp.id,
    rp.status,
    rp.reason,
    rp.created_at,
    reporter.username,
    author.id,
    author.username,
    rf.id,
    rf.body,
    rf.learned_today,
    rf.is_hidden,
    rf.reports_count
  from public.reports rp
  left join public.profiles reporter on reporter.id = rp.reporter_id
  left join public.reflections rf on rf.id = rp.reflection_id
  left join public.profiles author on author.id = rf.user_id
  where rp.deleted_at is null
    and (p_status is null or rp.status = p_status)
  order by rp.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create or replace function public.admin_get_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission('analytics:read', auth.uid()) then
    raise exception 'Analytics access required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles where deleted_at is null),
    'active_users_7d', (select count(distinct c.user_id) from public.habit_checkins hc join public.challenges c on c.id = hc.challenge_id where hc.checkin_date >= current_date - 7 and hc.deleted_at is null and c.deleted_at is null),
    'daily_checkins', (select count(distinct challenge_id) from public.habit_checkins where checkin_date = current_date and deleted_at is null),
    'total_challenges', (select count(*) from public.challenges where deleted_at is null),
    'completed_challenges', (select count(*) from public.challenges where status = 'completed' and deleted_at is null),
    'completion_rate', coalesce((select round((((count(*) filter (where status = 'completed'))::numeric / nullif(count(*), 0)) * 100), 1) from public.challenges where deleted_at is null), 0),
    'reset_count', (select count(*) from public.reset_events where deleted_at is null),
    'open_reports', (select count(*) from public.reports where status = 'open' and deleted_at is null),
    'popular_habits', coalesce((
      select jsonb_agg(jsonb_build_object('name', habit_name, 'completed_count', completed_count))
      from (
        select hd.name as habit_name, count(*) as completed_count
        from public.habit_checkins hc
        join public.habit_definitions hd on hd.id = hc.habit_definition_id
        where hc.completed and hc.deleted_at is null and hd.deleted_at is null
        group by hd.name
        order by count(*) desc
        limit 5
      ) popular
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.admin_change_user_role(p_user_id uuid, p_new_role text, p_reason text default 'Role updated')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_role text;
  v_super_count integer;
begin
  if not public.has_permission('users:manage_roles', auth.uid()) then
    raise exception 'Super admin role management permission required.' using errcode = '42501';
  end if;

  if p_new_role not in ('user', 'moderator', 'super_admin') then
    raise exception 'Invalid role.';
  end if;

  select role into v_old_role from public.profiles where id = p_user_id and deleted_at is null for update;
  if v_old_role is null then
    raise exception 'User not found.';
  end if;

  if v_old_role = 'super_admin' and p_new_role <> 'super_admin' then
    select count(*) into v_super_count from public.profiles where role = 'super_admin' and deleted_at is null;
    if v_super_count <= 1 then
      raise exception 'Cannot remove the last super admin.';
    end if;
  end if;

  perform set_config('app.allow_profile_security_update', 'true', true);
  update public.profiles set role = p_new_role where id = p_user_id;

  insert into public.moderation_actions (moderator_id, target_user_id, action, reason, metadata)
  values (auth.uid(), p_user_id, 'role_change', coalesce(nullif(trim(p_reason), ''), 'Role updated'), jsonb_build_object('old_role', v_old_role, 'new_role', p_new_role));

  perform public.write_audit_log('role_change', 'profile', p_user_id::text, p_user_id, jsonb_build_object('role', v_old_role), jsonb_build_object('role', p_new_role), jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text, p_suspended_until timestamptz default null, p_reason text default 'Account status updated')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles%rowtype;
  v_actor_role text;
begin
  if not public.has_permission('users:suspend', auth.uid()) then
    raise exception 'User suspension permission required.' using errcode = '42501';
  end if;

  if p_status not in ('active', 'suspended', 'banned') then
    raise exception 'Invalid account status.';
  end if;

  select * into v_target from public.profiles where id = p_user_id and deleted_at is null for update;
  if not found then
    raise exception 'User not found.';
  end if;

  select public.current_user_role() into v_actor_role;

  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own account status.';
  end if;

  if v_actor_role = 'moderator' and (v_target.role <> 'user' or p_status <> 'suspended') then
    raise exception 'Moderators may only temporarily suspend normal users.' using errcode = '42501';
  end if;

  if p_status = 'banned' and not public.has_permission('users:ban', auth.uid()) then
    raise exception 'Ban permission required.' using errcode = '42501';
  end if;

  if p_status = 'suspended' and (p_suspended_until is null or p_suspended_until <= now()) then
    raise exception 'Suspensions require a future end time.';
  end if;

  perform set_config('app.allow_profile_security_update', 'true', true);
  update public.profiles
  set account_status = p_status,
      suspended_until = case when p_status = 'suspended' then p_suspended_until else null end,
      banned_at = case when p_status = 'banned' then now() else null end
  where id = p_user_id;

  insert into public.user_suspensions (user_id, actor_id, status, reason, ends_at, revoked_at)
  values (p_user_id, auth.uid(), p_status, coalesce(nullif(trim(p_reason), ''), 'Account status updated'), p_suspended_until, case when p_status = 'active' then now() else null end);

  insert into public.moderation_actions (moderator_id, target_user_id, action, reason, metadata)
  values (auth.uid(), p_user_id, case when p_status = 'banned' then 'ban' when p_status = 'suspended' then 'suspend' else 'activate' end, coalesce(nullif(trim(p_reason), ''), 'Account status updated'), jsonb_build_object('status', p_status, 'suspended_until', p_suspended_until));

  perform public.write_audit_log('account_status_change', 'profile', p_user_id::text, p_user_id, jsonb_build_object('status', v_target.account_status, 'suspended_until', v_target.suspended_until, 'banned_at', v_target.banned_at), jsonb_build_object('status', p_status, 'suspended_until', p_suspended_until), jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_warn_user(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
begin
  if not public.has_permission('users:warn', auth.uid()) then
    raise exception 'Warn permission required.' using errcode = '42501';
  end if;

  select role into v_target_role from public.profiles where id = p_user_id and deleted_at is null;
  if v_target_role is null then
    raise exception 'User not found.';
  end if;

  if public.current_user_role() = 'moderator' and v_target_role <> 'user' then
    raise exception 'Moderators cannot warn privileged users.' using errcode = '42501';
  end if;

  insert into public.moderation_actions (moderator_id, target_user_id, action, reason)
  values (auth.uid(), p_user_id, 'warn', coalesce(nullif(trim(p_reason), ''), 'Policy warning'));

  perform public.write_audit_log('user_warned', 'profile', p_user_id::text, p_user_id, null, null, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_moderate_reflection(p_reflection_id uuid, p_action text, p_reason text default 'Moderation action')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reflection public.reflections%rowtype;
begin
  if not public.has_permission('content:moderate', auth.uid()) then
    raise exception 'Moderation access required.' using errcode = '42501';
  end if;

  if p_action not in ('hide', 'unhide', 'delete', 'dismiss_report') then
    raise exception 'Invalid moderation action.';
  end if;

  if p_action = 'delete' and not public.is_super_admin(auth.uid()) then
    raise exception 'Only super admins can delete content.' using errcode = '42501';
  end if;

  select * into v_reflection from public.reflections where id = p_reflection_id for update;
  if not found then
    raise exception 'Reflection not found.';
  end if;

  perform set_config('app.allow_reflection_moderation_update', 'true', true);

  if p_action = 'hide' then
    update public.reflections set is_hidden = true where id = p_reflection_id;
    update public.reports set status = 'actioned' where reflection_id = p_reflection_id and status in ('open', 'reviewing');
  elsif p_action = 'unhide' then
    update public.reflections set is_hidden = false where id = p_reflection_id;
  elsif p_action = 'delete' then
    update public.reflections set is_hidden = true, deleted_at = now() where id = p_reflection_id;
    update public.reports set status = 'actioned' where reflection_id = p_reflection_id and status in ('open', 'reviewing');
  else
    update public.reports set status = 'dismissed' where reflection_id = p_reflection_id and status in ('open', 'reviewing');
  end if;

  insert into public.moderation_actions (moderator_id, reflection_id, target_user_id, action, reason)
  values (auth.uid(), p_reflection_id, v_reflection.user_id, p_action, coalesce(nullif(trim(p_reason), ''), 'Moderation action'));

  perform public.write_audit_log('reflection_' || p_action, 'reflection', p_reflection_id::text, v_reflection.user_id, jsonb_build_object('is_hidden', v_reflection.is_hidden, 'deleted_at', v_reflection.deleted_at), jsonb_build_object('action', p_action), jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_list_audit_logs(p_limit integer default 100)
returns table (
  id uuid,
  actor_username text,
  target_username text,
  action text,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('audit:read', auth.uid()) then
    raise exception 'Audit permission required.' using errcode = '42501';
  end if;

  return query
  select a.id, actor.username, target.username, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at
  from public.audit_logs a
  left join public.profiles actor on actor.id = a.actor_id
  left join public.profiles target on target.id = a.target_user_id
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.admin_update_template(
  p_template_id uuid,
  p_name text,
  p_description text,
  p_is_active boolean,
  p_strict_mode boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.challenge_templates%rowtype;
begin
  if not public.has_permission('templates:manage', auth.uid()) then
    raise exception 'Template management permission required.' using errcode = '42501';
  end if;

  select * into v_old from public.challenge_templates where id = p_template_id for update;
  if not found then
    raise exception 'Template not found.';
  end if;

  update public.challenge_templates
  set name = nullif(trim(p_name), ''),
      description = nullif(trim(p_description), ''),
      is_active = p_is_active,
      strict_mode = p_strict_mode
  where id = p_template_id;

  perform public.write_audit_log('template_update', 'challenge_template', p_template_id::text, null, to_jsonb(v_old), jsonb_build_object('name', p_name, 'is_active', p_is_active, 'strict_mode', p_strict_mode), '{}'::jsonb);
end;
$$;

create or replace function public.admin_upsert_setting(p_key text, p_value jsonb, p_description text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('settings:manage', auth.uid()) then
    raise exception 'Settings permission required.' using errcode = '42501';
  end if;

  insert into public.system_settings (key, value, description, updated_by)
  values (p_key, p_value, p_description, auth.uid())
  on conflict (key)
  do update set value = excluded.value, description = coalesce(excluded.description, public.system_settings.description), updated_by = auth.uid(), updated_at = now(), deleted_at = null;

  insert into public.moderation_actions (moderator_id, action, reason, metadata)
  values (auth.uid(), 'settings_update', 'System setting updated', jsonb_build_object('key', p_key));

  perform public.write_audit_log('settings_update', 'system_settings', p_key, null, null, p_value, '{}'::jsonb);
end;
$$;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.reports enable row level security;
alter table public.user_suspensions enable row level security;
alter table public.featured_content enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Profiles are readable when public or connected" on public.profiles;
create policy "Profiles are readable when public or connected"
on public.profiles for select
using (
  deleted_at is null
  and (
    id = auth.uid()
    or (not is_private and account_status = 'active')
    or public.are_buddies(auth.uid(), id)
    or public.is_moderator(auth.uid())
  )
);

drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile"
on public.profiles for insert
with check (id = auth.uid() and role = 'user');

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update
using (id = auth.uid() and deleted_at is null)
with check (id = auth.uid());

drop policy if exists "Templates are public" on public.challenge_templates;
create policy "Templates are public"
on public.challenge_templates for select
using ((is_active and deleted_at is null) or public.has_permission('templates:manage', auth.uid()));

drop policy if exists "Habits are public for active templates" on public.habit_definitions;
create policy "Habits are public for active templates"
on public.habit_definitions for select
using (
  deleted_at is null
  and exists (select 1 from public.challenge_templates t where t.id = template_id and t.deleted_at is null and (t.is_active or public.has_permission('templates:manage', auth.uid())))
);

drop policy if exists "Users can read own visibility settings" on public.visibility_settings;
create policy "Users can read own visibility settings"
on public.visibility_settings for select
using (deleted_at is null and (user_id = auth.uid() or public.is_moderator(auth.uid())));

drop policy if exists "Users can insert own visibility settings" on public.visibility_settings;
create policy "Users can insert own visibility settings"
on public.visibility_settings for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update own visibility settings" on public.visibility_settings;
create policy "Users can update own visibility settings"
on public.visibility_settings for update
using (user_id = auth.uid() and deleted_at is null)
with check (user_id = auth.uid());

drop policy if exists "Users can view allowed challenges" on public.challenges;
create policy "Users can view allowed challenges"
on public.challenges for select
using (public.can_view_challenge(id, auth.uid()));

drop policy if exists "Users can create own challenges" on public.challenges;
create policy "Users can create own challenges"
on public.challenges for insert
with check (user_id = auth.uid() and public.is_account_active(auth.uid()));

drop policy if exists "Users can update own challenges" on public.challenges;
create policy "Users can update own challenges"
on public.challenges for update
using (user_id = auth.uid() and deleted_at is null and public.is_account_active(auth.uid()))
with check (user_id = auth.uid());

drop policy if exists "Habit checkins are visible when allowed" on public.habit_checkins;
create policy "Habit checkins are visible when allowed"
on public.habit_checkins for select
using (
  deleted_at is null
  and (
    public.owns_challenge(challenge_id, auth.uid())
    or public.is_moderator(auth.uid())
    or (
      not is_private
      and public.can_view_challenge(challenge_id, auth.uid())
      and exists (select 1 from public.challenges c where c.id = challenge_id and public.can_show_completed_habits(c.user_id))
    )
  )
);

drop policy if exists "Users can view allowed reflections" on public.reflections;
create policy "Users can view allowed reflections"
on public.reflections for select
using (
  deleted_at is null
  and (
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
  )
);

drop policy if exists "Users can insert own reflections" on public.reflections;
create policy "Users can insert own reflections"
on public.reflections for insert
with check (user_id = auth.uid() and public.owns_challenge(challenge_id, auth.uid()) and public.is_account_active(auth.uid()));

drop policy if exists "Users can update own reflections" on public.reflections;
create policy "Users can update own reflections"
on public.reflections for update
using (user_id = auth.uid() and deleted_at is null and public.is_account_active(auth.uid()))
with check (user_id = auth.uid());

drop policy if exists "Users can view own reset events" on public.reset_events;
create policy "Users can view own reset events"
on public.reset_events for select
using (deleted_at is null and (user_id = auth.uid() or public.is_moderator(auth.uid())));

drop policy if exists "Users can view own follows" on public.follows;
create policy "Users can view own follows"
on public.follows for select
using (deleted_at is null and (follower_id = auth.uid() or following_id = auth.uid() or public.is_moderator(auth.uid())));

drop policy if exists "Users can follow others" on public.follows;
create policy "Users can follow others"
on public.follows for insert
with check (follower_id = auth.uid() and public.is_account_active(auth.uid()));

drop policy if exists "Users can update follow relationships" on public.follows;
create policy "Users can update follow relationships"
on public.follows for update
using (deleted_at is null and (follower_id = auth.uid() or following_id = auth.uid()))
with check (follower_id = auth.uid() or following_id = auth.uid());

drop policy if exists "Moderators can read moderation actions" on public.moderation_actions;
create policy "Moderators can read moderation actions"
on public.moderation_actions for select
using (deleted_at is null and public.is_moderator(auth.uid()));

drop policy if exists "Moderators can create moderation actions" on public.moderation_actions;
create policy "Moderators can create moderation actions"
on public.moderation_actions for insert
with check (public.is_moderator(auth.uid()) and moderator_id = auth.uid());

drop policy if exists "Role metadata readable by authenticated users" on public.roles;
create policy "Role metadata readable by authenticated users" on public.roles for select using (auth.uid() is not null and deleted_at is null);

drop policy if exists "Permission metadata readable by moderators" on public.permissions;
create policy "Permission metadata readable by moderators" on public.permissions for select using (public.is_moderator(auth.uid()) and deleted_at is null);

drop policy if exists "Role permissions readable by moderators" on public.role_permissions;
create policy "Role permissions readable by moderators" on public.role_permissions for select using (public.is_moderator(auth.uid()));

drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports" on public.reports for insert with check (reporter_id = auth.uid() and public.is_account_active(auth.uid()));

drop policy if exists "Users can read own reports or moderators read all" on public.reports;
create policy "Users can read own reports or moderators read all" on public.reports for select using (deleted_at is null and (reporter_id = auth.uid() or public.is_moderator(auth.uid())));

drop policy if exists "Moderators can update reports" on public.reports;
create policy "Moderators can update reports" on public.reports for update using (public.is_moderator(auth.uid())) with check (public.is_moderator(auth.uid()));

drop policy if exists "Users can read own suspensions or moderators read all" on public.user_suspensions;
create policy "Users can read own suspensions or moderators read all" on public.user_suspensions for select using (deleted_at is null and (user_id = auth.uid() or public.is_moderator(auth.uid())));

drop policy if exists "Moderators can insert suspensions" on public.user_suspensions;
create policy "Moderators can insert suspensions" on public.user_suspensions for insert with check (public.is_moderator(auth.uid()) and actor_id = auth.uid());

drop policy if exists "Featured content is public" on public.featured_content;
create policy "Featured content is public" on public.featured_content for select using (deleted_at is null and starts_at <= now() and (ends_at is null or ends_at >= now()));

drop policy if exists "Super admins manage featured content" on public.featured_content;
create policy "Super admins manage featured content" on public.featured_content for all using (public.has_permission('content:feature', auth.uid())) with check (public.has_permission('content:feature', auth.uid()));

drop policy if exists "Super admins read settings" on public.system_settings;
create policy "Super admins read settings" on public.system_settings for select using (public.has_permission('settings:manage', auth.uid()) and deleted_at is null);

drop policy if exists "Super admins manage settings" on public.system_settings;
create policy "Super admins manage settings" on public.system_settings for all using (public.has_permission('settings:manage', auth.uid())) with check (public.has_permission('settings:manage', auth.uid()));

drop policy if exists "Super admins read audit logs" on public.audit_logs;
create policy "Super admins read audit logs" on public.audit_logs for select using (public.has_permission('audit:read', auth.uid()));

grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert on public.user_suspensions to authenticated;
grant select, insert, update on public.featured_content to authenticated;
grant select, insert, update on public.system_settings to authenticated;
grant select on public.audit_logs to authenticated;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_super_admin(uuid) to authenticated;
grant execute on function public.has_permission(text, uuid) to authenticated;
grant execute on function public.is_account_active(uuid) to authenticated;
grant execute on function public.submit_daily_checkin(uuid, date, uuid[], uuid[], text, text, text) to authenticated;
grant execute on function public.report_reflection(uuid, text) to authenticated;
grant execute on function public.admin_list_users(text, integer) to authenticated;
grant execute on function public.admin_list_reports(text, integer) to authenticated;
grant execute on function public.admin_get_analytics() to authenticated;
grant execute on function public.admin_change_user_role(uuid, text, text) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.admin_warn_user(uuid, text) to authenticated;
grant execute on function public.admin_moderate_reflection(uuid, text, text) to authenticated;
grant execute on function public.admin_list_audit_logs(integer) to authenticated;
grant execute on function public.admin_update_template(uuid, text, text, boolean, boolean) to authenticated;
grant execute on function public.admin_upsert_setting(text, jsonb, text) to authenticated;
