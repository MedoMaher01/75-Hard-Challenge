# 75 Day Habit Challenge Community

A static React + TypeScript + Vite frontend backed by Supabase Auth, Postgres, RLS, RPCs, and realtime subscriptions. The product supports multi-user habit challenges, strict reset rules, daily reflections, community progress, and a production-grade role-based dashboard system.

## Features

- Email sign up, login, logout, and profile bootstrap.
- User dashboard with challenge progress, streak, reset history, reflections, stats, and privacy controls.
- Daily habit checklist with strict server-side reset logic.
- Public leaderboard and community reflection feed filtered by privacy policies.
- Role-based admin/moderator dashboard with protected management tools.
- Supabase RLS policies and security-definer RPCs for privileged actions.
- Reports, moderation queue, audit logs, bans, suspensions, featured content tables, and system settings.
- Anti-cheat controls for future check-ins, past-day deadlines, duplicate submissions, and reset history.
- Responsive mobile-first UI with sidebar navigation, loading states, empty states, error boundary, and toast notifications.

## Tech Stack

- React 19 + TypeScript + Vite
- Supabase Auth
- Supabase Postgres with RLS
- Supabase RPCs for privileged writes
- Supabase realtime for community updates
- Static deployment on Vercel, Netlify, Cloudflare Pages, GitHub Pages, or Supabase hosting

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a free Supabase project.

3. Run the database SQL in this order from the Supabase SQL editor:

```text
supabase/schema.sql
supabase/seed.sql
supabase/dashboard-rbac.sql
```

4. Copy the environment example:

```bash
cp .env.example .env.local
```

5. Fill in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
```

6. Start the app:

```bash
npm run dev
```

## Production Build

```bash
npm run build
```

The static output is created in `dist/`. Configure your host with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Dashboard Overview

- `Dashboard`: user command center with current streak, day, daily completion, privacy status, reflection preview, reset history, and challenge stats.
- `Today`: challenge template picker, active challenge selector, daily checklist, reflection editor, and strict reset confirmation.
- `Community`: public leaderboard and shared lessons. Private accounts and private reflections are filtered by RLS.
- `Privacy`: profile, account privacy, habit visibility defaults, reflection sharing, and leaderboard settings.
- `Admin` or `Moderation`: role-protected management dashboard for moderators and super admins.

## Roles

- `user`: can manage their own profile, challenges, check-ins, reflections, privacy settings, and public community participation.
- `moderator`: can review reports, hide/unhide content, dismiss reports, warn users, and temporarily suspend normal users.
- `super_admin`: full system access, including role changes, bans, template management, system settings, audit logs, and destructive content moderation.

Moderators cannot change roles, ban users, delete content, manage settings, manage templates, or access audit logs. These restrictions are enforced in Supabase RPCs and policies, not only in the frontend.

## Admin Setup

After creating your first account, promote it from the Supabase SQL editor:

```sql
update public.profiles
set role = 'super_admin'
where username = 'your_username';
```

Use the Admin dashboard to assign future moderators or super admins. The `admin_change_user_role` RPC prevents non-super-admin role changes and prevents removing the last super admin.

## Database Model

Core tables:

- `profiles`
- `visibility_settings`
- `challenge_templates`
- `habit_definitions`
- `challenges`
- `habit_checkins`
- `reflections`
- `reset_events`
- `follows`

Dashboard and security tables:

- `roles`
- `permissions`
- `role_permissions`
- `reports`
- `moderation_actions`
- `audit_logs`
- `user_suspensions`
- `featured_content`
- `system_settings`

Most mutable tables include `created_at`, `updated_at`, and `deleted_at`. Destructive moderation uses soft deletes where possible.

## Security Architecture

- Frontend route protection is UX only. Supabase remains the source of truth.
- RLS limits normal users to their own data and allowed public/community data.
- Privileged actions go through security-definer RPCs that re-check role and permission state.
- Profile security fields such as `role`, `account_status`, `suspended_until`, `banned_at`, and `deleted_at` are protected by triggers.
- Reflection moderation fields such as `is_hidden`, `reports_count`, and `deleted_at` are protected by triggers.
- Super-admin-only actions are checked with `has_permission(...)` and audited.
- Moderator actions are limited server-side even if a malicious client calls RPCs directly.

## RLS Summary

- Users can read and update their own profile and visibility settings.
- Users can create and update only their own challenges, check-ins, and reflections.
- Public challenge and reflection reads are filtered by account privacy and visibility settings.
- Moderators can read moderation queues and perform limited moderation through RPCs.
- Super admins can read audit logs and manage templates/settings through RPCs.
- Audit logs are readable only by users with `audit:read` permission.

## Moderation Workflow

1. A user reports a public reflection from the community feed.
2. `report_reflection(...)` inserts or updates a `reports` row and increments `reports_count` server-side.
3. Moderators open the protected Moderation dashboard.
4. Moderators can hide content, dismiss reports, warn users, or temporarily suspend normal users.
5. Super admins can delete content, ban users, change roles, update templates, update settings, and review audit logs.
6. Every privileged action writes to `moderation_actions` and/or `audit_logs`.

## Anti-Cheat Rules

- Future check-ins are rejected by `submit_daily_checkin(...)`.
- Past check-ins are rejected after the configured UTC deadline.
- A user cannot edit older days after a newer submission exists.
- Habit check-ins are unique by challenge, habit, and date.
- Required habit misses trigger reset events in the same backend transaction.
- Suspended or banned accounts cannot submit check-ins or reports.

The default past-day deadline is controlled by `system_settings.checkin_deadline_hours` and can be changed by a super admin.

## Optional Demo Data

After signing up at least one user and running all schema files, you can run:

```text
supabase/demo-data.sql
```

It attaches a demo challenge, check-ins, public reflection, and reset event to the first profile.

## Verification

Run:

```bash
npm run dev
npm run build
```

Manual checks:

- User can sign up, join a challenge, and check in.
- User cannot access Admin/Moderation without `moderator` or `super_admin` role.
- Moderator can hide reports and suspend normal users only.
- Moderator cannot change roles, ban users, delete content, manage templates/settings, or view audit logs.
- Super admin can manage roles, bans, templates, settings, and audit logs.
- Users can only update their own profile, visibility settings, check-ins, and reflections.
- Public feed does not expose private reflections or private accounts.

## Troubleshooting

- If the app shows setup required, confirm `.env.local` has the two `NEXT_PUBLIC_SUPABASE_*` variables.
- If Admin dashboard calls fail, confirm `supabase/dashboard-rbac.sql` was run after `schema.sql` and `seed.sql`.
- If reports do not appear, confirm RLS is enabled and the user has `moderator` or `super_admin` role.
- If check-ins fail for yesterday, check the `checkin_deadline_hours` system setting.
- If role changes fail, confirm the acting user is `super_admin` and that at least one super admin remains.

## Current Limitations

- No email delivery for warnings or suspensions yet.
- No dedicated notification inbox yet.
- No pagination UI beyond server-limited dashboard lists.
- No full template habit editor yet; the dashboard supports template activation, naming, and strict-mode management.
- Timezone handling uses Supabase/Postgres date and UTC deadline settings for reliability.
