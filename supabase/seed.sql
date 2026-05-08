-- Seed data for challenge templates and habits.
-- Safe to re-run because templates are keyed by slug and habits by template/name.

insert into public.challenge_templates (slug, name, description, duration_days, strict_mode, category, is_religious, is_active, sort_order)
values
  (
    'strict-75-hard',
    'Strict 75 Hard Style',
    'A strict physical and mental discipline template based on daily non-negotiables. Missing any required habit resets the streak.',
    75,
    true,
    'discipline',
    false,
    true,
    10
  ),
  (
    'muslim-add-on-75',
    'Muslim Add-On 75',
    'An optional faith-centered version for Muslims who want worship and reflection habits alongside health and discipline work.',
    75,
    true,
    'faith',
    true,
    true,
    20
  ),
  (
    'student-75',
    'Student 75',
    'A balanced academic challenge for deep study, health, planning, and consistent review.',
    75,
    true,
    'student',
    false,
    true,
    30
  ),
  (
    'creator-self-improvement-75',
    'Creator Self-Improvement 75',
    'A creator-focused template for daily output, learning, wellness, and reduced distraction.',
    75,
    true,
    'creator',
    false,
    true,
    40
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  duration_days = excluded.duration_days,
  strict_mode = excluded.strict_mode,
  category = excluded.category,
  is_religious = excluded.is_religious,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Two 45 minute workouts', 'Complete two workouts. At least one should be outside when safe and practical.', true, 'public', 10
from public.challenge_templates where slug = 'strict-75-hard'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Follow nutrition plan', 'Follow your chosen eating plan with no cheat meals and no alcohol.', true, 'private', 20
from public.challenge_templates where slug = 'strict-75-hard'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Drink water goal', 'Hit your daily water goal. The classic version uses one gallon.', true, 'public', 30
from public.challenge_templates where slug = 'strict-75-hard'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Read 10 pages', 'Read at least 10 pages of nonfiction or intentional learning material.', true, 'public', 40
from public.challenge_templates where slug = 'strict-75-hard'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Progress photo', 'Take a daily progress photo for private accountability.', true, 'private', 50
from public.challenge_templates where slug = 'strict-75-hard'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Share a lesson', 'Optional: share one thing learned with the community.', false, 'public', 60
from public.challenge_templates where slug = 'strict-75-hard'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Five daily prayers', 'Pray the five daily prayers. This habit only exists in this optional Muslim template.', true, 'private', 10
from public.challenge_templates where slug = 'muslim-add-on-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Quran reading or listening', 'Spend intentional time reading, memorizing, or listening to Quran.', true, 'private', 20
from public.challenge_templates where slug = 'muslim-add-on-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Health movement', 'Complete a daily workout, walk, or mobility session.', true, 'public', 30
from public.challenge_templates where slug = 'muslim-add-on-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'No harmful indulgence', 'Avoid the personal indulgence or habit you committed to leaving for the challenge.', true, 'private', 40
from public.challenge_templates where slug = 'muslim-add-on-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Daily gratitude dua', 'Optional: write one gratitude note or dua from the day.', false, 'private', 50
from public.challenge_templates where slug = 'muslim-add-on-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Deep study block', 'Complete one distraction-free deep study block for your highest priority class.', true, 'public', 10
from public.challenge_templates where slug = 'student-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Review notes', 'Review or summarize today''s notes, readings, or assignments.', true, 'public', 20
from public.challenge_templates where slug = 'student-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Move your body', 'Complete a workout, walk, sport, or mobility session.', true, 'public', 30
from public.challenge_templates where slug = 'student-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Plan tomorrow', 'Write tomorrow''s top tasks, class priorities, and study blocks.', true, 'private', 40
from public.challenge_templates where slug = 'student-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Screen curfew', 'Optional: stop recreational scrolling by your chosen cutoff time.', false, 'private', 50
from public.challenge_templates where slug = 'student-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Create or publish', 'Create, edit, ship, or publish a meaningful piece of work.', true, 'public', 10
from public.challenge_templates where slug = 'creator-self-improvement-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Skill learning', 'Spend focused time improving one craft, business, or technical skill.', true, 'public', 20
from public.challenge_templates where slug = 'creator-self-improvement-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Body maintenance', 'Complete a workout, walk, stretch, or recovery habit.', true, 'public', 30
from public.challenge_templates where slug = 'creator-self-improvement-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'No empty scrolling', 'Avoid recreational scrolling outside intentional research or publishing windows.', true, 'private', 40
from public.challenge_templates where slug = 'creator-self-improvement-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;

insert into public.habit_definitions (template_id, name, description, is_required, visibility_default, sort_order)
select id, 'Reach out', 'Optional: send one thoughtful message, collaboration pitch, or community reply.', false, 'public', 50
from public.challenge_templates where slug = 'creator-self-improvement-75'
on conflict (template_id, name) do update set description = excluded.description, is_required = excluded.is_required, visibility_default = excluded.visibility_default, sort_order = excluded.sort_order;
