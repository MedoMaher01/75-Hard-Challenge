-- Optional local/demo data.
-- Run after creating at least one auth user in the app. It attaches a demo challenge
-- to the first profile so you can see dashboard, feed, and reset-history states.

do $$
declare
  v_user_id uuid;
  v_template_id uuid;
  v_challenge_id uuid;
  v_habit public.habit_definitions%rowtype;
begin
  select id into v_user_id from public.profiles order by created_at limit 1;
  select id into v_template_id from public.challenge_templates where slug = 'strict-75-hard';

  if v_user_id is null or v_template_id is null then
    raise notice 'Create a user and run seed.sql before demo-data.sql.';
    return;
  end if;

  select id into v_challenge_id
  from public.challenges
  where user_id = v_user_id and title = 'Demo Strict 75'
  limit 1;

  if v_challenge_id is null then
    insert into public.challenges (
      user_id,
      template_id,
      title,
      start_date,
      current_day,
      current_streak,
      longest_streak,
      status,
      strict_mode,
      last_checkin_date,
      resets_count
    ) values (
      v_user_id,
      v_template_id,
      'Demo Strict 75',
      current_date - 6,
      7,
      7,
      11,
      'active',
      true,
      current_date,
      1
    ) returning id into v_challenge_id;
  end if;

  for v_habit in select * from public.habit_definitions where template_id = v_template_id loop
    insert into public.habit_checkins (challenge_id, habit_definition_id, checkin_date, completed, is_private)
    values (v_challenge_id, v_habit.id, current_date, v_habit.sort_order <= 40, v_habit.visibility_default <> 'public')
    on conflict (challenge_id, habit_definition_id, checkin_date)
    do update set completed = excluded.completed, is_private = excluded.is_private;
  end loop;

  insert into public.reflections (challenge_id, user_id, reflection_date, body, learned_today, visibility)
  values (
    v_challenge_id,
    v_user_id,
    current_date,
    'Demo reflection: the checklist makes the day feel concrete.',
    'I learned that planning the second workout earlier removes friction.',
    'public'
  )
  on conflict (challenge_id, reflection_date)
  do update set body = excluded.body, learned_today = excluded.learned_today, visibility = excluded.visibility;

  insert into public.reset_events (challenge_id, user_id, reset_date, missed_habit_ids, previous_day, previous_streak, reason)
  values (v_challenge_id, v_user_id, current_date - 9, array[]::uuid[], 12, 11, 'Demo reset event.')
  on conflict (challenge_id, reset_date) do nothing;
end $$;
