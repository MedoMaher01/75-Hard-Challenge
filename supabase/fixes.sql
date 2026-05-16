-- ============================================================
-- fixes.sql — Targeted patches on top of schema.sql + dashboard-rbac.sql
-- Run in Supabase SQL editor after the other two files have been applied.
-- Safe to re-run (uses CREATE OR REPLACE / IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- -------------------------------------------------------
-- FIX 1: Revoke the stale single-argument grant for
-- report_reflection that schema.sql left behind.
-- dashboard-rbac.sql already grants the two-argument
-- version; this prevents ambiguity.
-- -------------------------------------------------------
do $$
begin
  execute 'revoke execute on function public.report_reflection(uuid) from authenticated, anon, public';
exception when others then
  null; -- silently skip if already removed
end $$;

-- -------------------------------------------------------
-- FIX 2: owner_leave_challenge
-- Allows a user to soft-delete their own active challenge.
-- Only the owner can call this; moderators should use
-- admin_moderate_challenge (future) rather than this RPC.
-- -------------------------------------------------------
create or replace function public.owner_leave_challenge(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.challenges%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not public.is_account_active(auth.uid()) then
    raise exception 'Your account is suspended or banned.' using errcode = '42501';
  end if;

  select * into v_challenge
  from public.challenges
  where id = p_challenge_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Challenge not found.';
  end if;

  if v_challenge.user_id <> auth.uid() then
    raise exception 'You can only leave your own challenge.' using errcode = '42501';
  end if;

  update public.challenges
  set deleted_at = now(), updated_at = now()
  where id = p_challenge_id;

  perform public.write_audit_log(
    'challenge_left',
    'challenge',
    p_challenge_id::text,
    auth.uid(),
    jsonb_build_object('status', v_challenge.status, 'current_day', v_challenge.current_day),
    null,
    '{}'::jsonb
  );
end;
$$;

grant execute on function public.owner_leave_challenge(uuid) to authenticated;

-- -------------------------------------------------------
-- FIX 3: admin_create_template
-- Super-admins can create new challenge templates with
-- their habit definitions in a single RPC call.
-- -------------------------------------------------------
create or replace function public.admin_create_template(
  p_slug         text,
  p_name         text,
  p_description  text,
  p_duration_days integer default 75,
  p_strict_mode  boolean default true,
  p_category     text default 'general',
  p_is_religious boolean default false,
  p_sort_order   integer default 0,
  -- habits: jsonb array of {name, description, is_required, visibility_default, sort_order}
  p_habits       jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
  v_habit       jsonb;
begin
  if not public.has_permission('templates:manage', auth.uid()) then
    raise exception 'Template management permission required.' using errcode = '42501';
  end if;

  if p_duration_days < 1 or p_duration_days > 365 then
    raise exception 'Duration must be between 1 and 365 days.';
  end if;

  if p_slug !~ '^[a-z0-9-]{3,80}$' then
    raise exception 'Slug must be 3–80 lowercase letters, numbers, or hyphens.';
  end if;

  insert into public.challenge_templates (
    slug, name, description, duration_days, strict_mode,
    category, is_religious, is_active, sort_order
  ) values (
    trim(p_slug), trim(p_name), trim(p_description),
    p_duration_days, p_strict_mode,
    coalesce(nullif(trim(p_category), ''), 'general'),
    p_is_religious, true, p_sort_order
  )
  returning id into v_template_id;

  for v_habit in select * from jsonb_array_elements(coalesce(p_habits, '[]'::jsonb))
  loop
    insert into public.habit_definitions (
      template_id, name, description, is_required, visibility_default, sort_order
    ) values (
      v_template_id,
      trim(v_habit->>'name'),
      coalesce(nullif(trim(v_habit->>'description'), ''), trim(v_habit->>'name')),
      coalesce((v_habit->>'is_required')::boolean, true),
      coalesce(nullif(v_habit->>'visibility_default', ''), 'public'),
      coalesce((v_habit->>'sort_order')::integer, 0)
    );
  end loop;

  perform public.write_audit_log(
    'template_created',
    'challenge_template',
    v_template_id::text,
    null,
    null,
    jsonb_build_object('slug', p_slug, 'name', p_name, 'duration_days', p_duration_days),
    '{}'::jsonb
  );

  return v_template_id;
end;
$$;

grant execute on function public.admin_create_template(text, text, text, integer, boolean, text, boolean, integer, jsonb) to authenticated;

-- -------------------------------------------------------
-- FIX 4: admin_delete_template (soft-delete)
-- Deactivates and soft-deletes a template; does not
-- cascade to running challenges (they keep their data).
-- -------------------------------------------------------
create or replace function public.admin_delete_template(p_template_id uuid, p_reason text default 'Template removed')
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

  select * into v_old from public.challenge_templates where id = p_template_id and deleted_at is null for update;
  if not found then
    raise exception 'Template not found.';
  end if;

  update public.challenge_templates
  set is_active = false, deleted_at = now()
  where id = p_template_id;

  perform public.write_audit_log(
    'template_deleted',
    'challenge_template',
    p_template_id::text,
    null,
    to_jsonb(v_old),
    null,
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

grant execute on function public.admin_delete_template(uuid, text) to authenticated;

-- -------------------------------------------------------
-- FIX 5: Challenges delete policy (allow owner to update
-- deleted_at via the RPC above — the existing UPDATE
-- policy already covers this because user_id = auth.uid())
-- No additional RLS needed; owner_leave_challenge is
-- security-definer and bypasses RLS anyway.
-- -------------------------------------------------------

-- -------------------------------------------------------
-- FIX 6: Ensure challenges insert guard prevents joining
-- the same ACTIVE template twice at the DB level.
-- This is a partial unique index: one active challenge
-- per user per template.
-- -------------------------------------------------------
create unique index if not exists challenges_one_active_per_template_idx
  on public.challenges (user_id, template_id)
  where deleted_at is null and status = 'active';

-- -------------------------------------------------------
-- PHASE 1 SECURITY STABILIZATION
-- These patches intentionally live last so they override
-- broader grants/policies from schema.sql and
-- dashboard-rbac.sql without rebuilding the database.
-- -------------------------------------------------------

-- FIX 7: Buddy/follow hardening.
-- New relationships are requests, not accepted buddy links. The requester can
-- create a pending row; only the recipient can approve or block it.
alter table public.follows
  alter column status set default 'pending';

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
      and deleted_at is null
      and (
        (follower_id = left_user and following_id = right_user)
        or (follower_id = right_user and following_id = left_user)
      )
  );
$$;

create or replace function public.enforce_follow_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.follower_id <> auth.uid() then
      raise exception 'You can only create follow requests from your own account.' using errcode = '42501';
    end if;

    if new.following_id = auth.uid() then
      raise exception 'You cannot follow yourself.';
    end if;

    -- Clients cannot create an already trusted buddy relationship.
    new.status := 'pending';
    return new;
  end if;

  if new.follower_id <> old.follower_id or new.following_id <> old.following_id then
    raise exception 'Follow relationship owners cannot be changed.';
  end if;

  if auth.uid() = old.following_id then
    if new.status not in ('pending', 'accepted', 'blocked') then
      raise exception 'Invalid follow status.';
    end if;
    return new;
  end if;

  if auth.uid() = old.follower_id then
    -- Requesters may update non-trust metadata such as soft delete, but they
    -- cannot approve or block their own request.
    new.status := old.status;
    return new;
  end if;

  raise exception 'You cannot modify this follow relationship.' using errcode = '42501';
end;
$$;

drop trigger if exists enforce_follow_integrity on public.follows;
create trigger enforce_follow_integrity
before insert or update on public.follows
for each row execute function public.enforce_follow_integrity();

drop policy if exists "Users can follow others" on public.follows;
create policy "Users can create pending follow requests"
on public.follows for insert
with check (
  follower_id = auth.uid()
  and following_id <> auth.uid()
  and status = 'pending'
  and public.is_account_active(auth.uid())
);

drop policy if exists "Users can update follow relationships" on public.follows;
create policy "Recipients approve or block follow requests"
on public.follows for update
using (
  deleted_at is null
  and (following_id = auth.uid() or follower_id = auth.uid())
)
with check (
  follower_id <> following_id
  and (following_id = auth.uid() or follower_id = auth.uid())
);

create index if not exists follows_following_status_idx
  on public.follows(following_id, status)
  where deleted_at is null;

-- FIX 8: Prevent direct challenge/check-in tampering.
-- Challenge lifecycle writes must happen through security-definer RPCs. Direct
-- clients may create a challenge with safe columns only and may only edit title.
revoke insert, update on public.challenges from authenticated;
grant insert (user_id, template_id, title, start_date, strict_mode) on public.challenges to authenticated;
grant update (title) on public.challenges to authenticated;

revoke insert, update on public.habit_checkins from authenticated;
revoke insert, update on public.reports from authenticated;
revoke insert, update on public.moderation_actions from authenticated;
revoke insert, update on public.user_suspensions from authenticated;
revoke insert, update on public.featured_content from authenticated;
revoke insert, update on public.system_settings from authenticated;

create or replace function public.enforce_challenge_insert_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.challenge_templates%rowtype;
begin
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'You can only create your own challenge.' using errcode = '42501';
  end if;

  if not public.is_account_active(auth.uid()) then
    raise exception 'Your account is suspended or banned.' using errcode = '42501';
  end if;

  select * into v_template
  from public.challenge_templates
  where id = new.template_id
    and is_active
    and deleted_at is null;

  if not found then
    raise exception 'Challenge template is not available.';
  end if;

  new.start_date := current_date;
  new.strict_mode := v_template.strict_mode;
  new.current_day := 1;
  new.current_streak := 0;
  new.longest_streak := 0;
  new.status := 'active';
  new.last_checkin_date := null;
  new.resets_count := 0;
  new.deleted_at := null;

  return new;
end;
$$;

drop trigger if exists enforce_challenge_insert_integrity on public.challenges;
create trigger enforce_challenge_insert_integrity
before insert on public.challenges
for each row execute function public.enforce_challenge_insert_integrity();

-- FIX 9: Prevent direct profile security-field writes with column privileges.
-- The admin RPCs still work because they are security-definer functions.
revoke insert, update on public.profiles from authenticated;
grant insert (id, display_name, username, avatar_url, bio, is_private) on public.profiles to authenticated;
grant update (display_name, username, avatar_url, bio, is_private) on public.profiles to authenticated;

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

  if new.role is distinct from old.role
    or new.account_status is distinct from old.account_status
    or new.suspended_until is distinct from old.suspended_until
    or new.banned_at is distinct from old.banned_at
    or new.deleted_at is distinct from old.deleted_at then
    raise exception 'Profile security fields can only be changed through admin RPCs.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- FIX 10: Harden role assignment RPC with explicit actor/target validation.
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
  if not public.is_super_admin(auth.uid()) or not public.has_permission('users:manage_roles', auth.uid()) then
    raise exception 'Super admin role management permission required.' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Administrators cannot change their own role.' using errcode = '42501';
  end if;

  if p_new_role not in ('user', 'moderator', 'super_admin') then
    raise exception 'Invalid role.';
  end if;

  select role into v_old_role
  from public.profiles
  where id = p_user_id and deleted_at is null
  for update;

  if v_old_role is null then
    raise exception 'User not found.';
  end if;

  if v_old_role = 'super_admin' and p_new_role <> 'super_admin' then
    select count(*) into v_super_count
    from public.profiles
    where role = 'super_admin' and deleted_at is null;

    if v_super_count <= 1 then
      raise exception 'Cannot remove the last super admin.';
    end if;
  end if;

  perform set_config('app.allow_profile_security_update', 'true', true);
  update public.profiles set role = p_new_role where id = p_user_id;

  insert into public.moderation_actions (moderator_id, target_user_id, action, reason, metadata)
  values (
    auth.uid(),
    p_user_id,
    'role_change',
    coalesce(nullif(trim(p_reason), ''), 'Role updated'),
    jsonb_build_object('old_role', v_old_role, 'new_role', p_new_role)
  );

  perform public.write_audit_log(
    'role_change',
    'profile',
    p_user_id::text,
    p_user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_new_role),
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

-- FIX 11: Reflection ownership and report visibility validation.
create or replace function public.enforce_reflection_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.challenges c
    where c.id = new.challenge_id
      and c.user_id = new.user_id
      and c.deleted_at is null
  ) then
    raise exception 'Reflection owner must match challenge owner.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_reflection_owner on public.reflections;
create trigger enforce_reflection_owner
before insert or update of challenge_id, user_id on public.reflections
for each row execute function public.enforce_reflection_owner();

create or replace function public.can_view_reflection(reflection_id_to_check uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reflections r
    join public.profiles p on p.id = r.user_id
    where r.id = reflection_id_to_check
      and r.deleted_at is null
      and p.deleted_at is null
      and (
        r.user_id = viewer
        or public.is_moderator(viewer)
        or (
          not r.is_hidden
          and p.account_status = 'active'
          and public.can_show_reflections(r.user_id)
          and (
            (r.visibility = 'public' and not p.is_private)
            or (r.visibility = 'buddies' and public.are_buddies(viewer, r.user_id))
          )
        )
      )
  );
$$;

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

  if not public.can_view_reflection(p_reflection_id, auth.uid()) then
    raise exception 'Reflection not found.' using errcode = '42501';
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

revoke all on function public.can_view_reflection(uuid, uuid) from public, anon, authenticated;

-- FIX 12: High-value integrity indexes for ownership/visibility checks.
create index if not exists habit_definitions_template_sort_idx
  on public.habit_definitions(template_id, sort_order)
  where deleted_at is null;

create index if not exists reflections_user_date_idx
  on public.reflections(user_id, reflection_date)
  where deleted_at is null;
