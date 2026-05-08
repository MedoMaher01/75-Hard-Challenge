# 75 Day Habit Challenge Community

A production-ready MVP for a multi-user 75-day habit challenge community. The frontend is a static Vite/React app and the backend is Supabase for authentication, Postgres, row-level security, and realtime updates.

## Features

- Email sign up, login, logout, and profile bootstrap.
- Join challenge templates and track daily required or optional habits.
- Strict reset logic handled in a Supabase RPC so missed required habits reset the streak server-side.
- Dashboard with current day, streak, habit completion, reset history, and completion percentage.
- Daily reflection and "learned today" fields with private, buddies, or public visibility.
- Public leaderboard and reflection feed filtered by RLS and privacy settings.
- Privacy controls for private accounts, habit visibility defaults, reflection sharing, and leaderboard sharing.
- Optional religious template support. Religious habits only appear when the Muslim add-on template is selected.
- Admin/moderator view for reported reflections.
- Responsive, accessible UI built with React and CSS only.

## Tech Stack

- React 19 + TypeScript + Vite
- Supabase Auth
- Supabase Postgres with RLS policies
- Supabase realtime channel subscriptions
- Static deployment compatible with Vercel, Netlify, Cloudflare Pages, GitHub Pages, or Supabase Storage hosting

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a free Supabase project.

3. In the Supabase SQL editor, run:

```text
supabase/schema.sql
supabase/seed.sql
```

4. Copy the environment example:

```bash
cp .env.example .env.local
```

5. Fill in `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

6. Start the dev server:

```bash
npm run dev
```

## Optional Demo Data

After signing up at least one user, run this in the Supabase SQL editor:

```text
supabase/demo-data.sql
```

It attaches a demo challenge, check-ins, public reflection, and reset event to the first profile.

## Production Build

```bash
npm run build
```

The static output is created in `dist/`. Configure your hosting provider with the same two `VITE_SUPABASE_*` environment variables.

## Database Model

Core tables are defined in `supabase/schema.sql`:

- `profiles`
- `challenge_templates`
- `habit_definitions`
- `challenges`
- `habit_checkins`
- `reflections`
- `reset_events`
- `visibility_settings`
- `follows`
- `moderation_actions`

The main write path is `submit_daily_checkin(...)`, which records habit check-ins, updates reflections, detects missed required habits, writes reset history, and updates challenge streak state in one transaction.

## Admin Moderation

Users are created with role `user`. To make a moderator or admin, update the profile in Supabase:

```sql
update public.profiles
set role = 'admin'
where username = 'your_username';
```

Admins and moderators can open the Admin tab and hide reported reflections.

## Privacy Notes

- Private accounts are excluded from the public leaderboard and public reflection feed.
- Private habit check-ins are not exposed to other users.
- Reflections marked private are only visible to the owner and moderators.
- Reflections marked public are still hidden if the account is private or reflection sharing is disabled.
- Religious habits are stored only in the optional Muslim template and are not forced globally.
