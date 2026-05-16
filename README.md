# 75 Hard Challenge Community Platform

A privacy-first, community-oriented habit challenge tracker built with **React + TypeScript + Vite** and **Supabase**. Users join structured challenge templates, track daily habits, write reflections, and share progress — all with granular privacy controls enforced both client-side and via PostgreSQL Row-Level Security.

---

## Architecture Overview

```
src/
├── App.tsx                  # Root — auth, data loading, view routing
├── components/
│   ├── AppHeader.tsx        # Top nav + dark mode toggle
│   ├── DashboardSidebar.tsx # Sidebar nav
│   ├── AuthView.tsx         # Sign up / log in
│   ├── ChallengeExplorer.tsx # Browse & preview challenge templates
│   ├── ActiveChallenge.tsx  # Active challenge status + leave
│   ├── DailyCheckIn.tsx     # Daily habit checklist + reflection
│   ├── ProgressDashboard.tsx# Progress bars + reset history
│   ├── UserDashboard.tsx    # Personal stats home
│   ├── Community.tsx        # Leaderboard + public reflection feed
│   ├── SettingsPanel.tsx    # Profile + privacy settings
│   ├── AdminDashboard.tsx   # Moderation + analytics (role-gated)
│   ├── ProtectedView.tsx    # Client-side role guard
│   ├── ErrorBoundary.tsx    # React error boundary
│   ├── ToastHost.tsx        # Toast notification system
│   └── SetupNotice.tsx      # Missing env vars notice
└── lib/
    ├── supabase.ts          # Supabase browser client
    ├── api.ts               # All Supabase queries and RPC calls
    ├── types.ts             # TypeScript interfaces
    ├── dates.ts             # Date formatting utilities
    └── theme.ts             # Dark mode persistence

supabase/
├── schema.sql               # Core tables, RLS, triggers, RPCs
├── seed.sql                 # Challenge templates and habits
├── dashboard-rbac.sql       # RBAC tables, admin RPCs, moderation
└── fixes.sql                # Targeted patches (run last)
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | One row per auth user. Holds display name, username, role, and account status |
| `challenge_templates` | Admin-managed challenge blueprints (e.g. "Strict 75 Hard") |
| `habit_definitions` | Habits belonging to a template (required vs optional) |
| `challenges` | A user's active run of a template. Tracks day, streak, status |
| `habit_checkins` | Per-habit, per-day completion records |
| `reflections` | Daily journal entries with visibility control |
| `reset_events` | Immutable log of streak resets for accountability |
| `visibility_settings` | Per-user sharing preferences |
| `follows` | Social graph (follower → following) |

### Admin / RBAC Tables

| Table | Purpose |
|-------|---------|
| `roles` | Role definitions with priority |
| `permissions` | Named permission keys |
| `role_permissions` | Many-to-many role↔permission mapping |
| `reports` | User-submitted content reports |
| `moderation_actions` | Audit trail of moderator actions |
| `audit_logs` | All privileged admin actions |
| `user_suspensions` | Suspension history per user |
| `system_settings` | Key-value platform configuration |
| `featured_content` | Admin-featured challenges/reflections |

---

## Role System

| Role | Permissions |
|------|------------|
| `user` | Own data only |
| `moderator` | Content moderation, user warnings, temporary suspensions |
| `super_admin` | All of the above + bans, role management, template management, settings, audit logs |

Role changes are gated by `admin_change_user_role` RPC which checks super-admin status and `users:manage_roles` permission. The `protect_profile_security_fields` trigger and column-level grants prevent direct client writes to `role`, `account_status`, suspension, ban, and soft-delete fields.

**Only a super_admin can promote/demote other users.** Admins cannot change their own role through the RPC, and the last super_admin cannot be demoted.

---

## RLS Explanation

All tables have RLS enabled. Key policy patterns:

- **Profiles**: Readable when public + active, or are buddies, or viewer is moderator
- **Challenges**: Readable when owned, or moderator, or owner is public + leaderboard opted in
- **Habit checkins**: Readable when owned, or moderator, or challenge visible + `show_completed_habits` on + not private
- **Reflections**: Readable when owned, or moderator, or (not hidden + `show_reflections` on + visibility matches)
- **Templates/Habits**: Readable by all authenticated users (active only; inactive visible to admins)
- **Follows/Buddies**: New follow rows are always `pending`; only the recipient can approve or block a request. Buddy-only visibility requires an `accepted`, non-deleted relationship.

Security-definer helper functions (`is_moderator`, `can_view_challenge`, `are_buddies`, etc.) are called inside policies so they run with elevated privileges without exposing logic to callers.

### Phase 1 Security Stabilization

`supabase/fixes.sql` contains the current final hardening layer. Run it last. It intentionally overrides earlier broad grants/policies without rebuilding the database.

Security fixes included:

- Follow/buddy requests default to `pending`; clients cannot self-create `accepted` or `blocked` trust relationships.
- Buddy visibility now ignores soft-deleted follow rows.
- Direct client writes to challenge lifecycle fields are blocked with column-level grants. Users can create challenges with safe join columns only; streaks, day counters, resets, status, and last check-in are updated by RPCs.
- Direct client writes to `habit_checkins` are revoked; daily check-ins are written by `submit_daily_checkin`.
- Direct profile writes are limited to public profile fields. Role and account-status changes must go through admin RPCs.
- `admin_change_user_role` explicitly requires super-admin authority and disallows changing the caller's own role.
- Reflection ownership is validated so `reflections.user_id` must match the owner of `reflections.challenge_id`.
- Reporting a reflection now requires that the reporter can view that reflection.

---

## Challenge Lifecycle

```
[Browse templates in ChallengeExplorer]
        ↓
[Join → challenge row created, status=active]
        ↓
[Daily check-in via submit_daily_checkin RPC]
        ↓  ← Strict mode: missed required habit → reset_event inserted, streak=0
        ↓  ← Gap missed (day skipped) → same
        ↓
[current_streak reaches duration_days → status=completed]
        ↓
[User can leave at any time → deleted_at set, challenge archived]
```

The `submit_daily_checkin` RPC is an atomic, security-definer function that:
1. Validates ownership and account status
2. Rejects future dates and past dates beyond the deadline
3. Upserts all habit checkin rows
4. Evaluates reset conditions
5. Updates challenge counters
6. Upserts or soft-deletes the reflection
7. Writes an audit log entry on reset

---

## Admin Setup

1. Sign up as the first user
2. In Supabase SQL editor, run:
   ```sql
   update public.profiles
   set role = 'super_admin'
   where id = '<your-user-uuid>';
   ```
3. The `Admin` tab will appear automatically in the UI (role check happens client-side; all admin actions re-check server-side)

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> ⚠️ Never use the `service_role` key in the frontend. The anon key is safe — all access is controlled by RLS.

`.env.local` is intentionally ignored by git. Do not commit real environment files. Vercel should receive the same two `VITE_` variables through the project dashboard.

---

## Supabase Setup

1. Create a new Supabase project
2. In the SQL editor, run the files **in order**:
   ```
   supabase/schema.sql
   supabase/seed.sql
   supabase/dashboard-rbac.sql
   supabase/fixes.sql
   ```
3. Treat `fixes.sql` as the final patch layer. It contains security and integrity corrections that supersede overlapping definitions in the earlier files.
4. In Authentication → Email, disable "Confirm email" for local dev (or configure your SMTP)
5. Enable Realtime for the `challenges` and `reflections` tables (schema.sql does this automatically)

### Migration Notes

This project currently uses ordered SQL files rather than a full migration history. Some objects are created in `schema.sql` and intentionally replaced later by `dashboard-rbac.sql` or `fixes.sql`. Do not run the files out of order. For production, prefer adding new incremental patch files instead of editing historical SQL after deployment.

---

## Vercel Deployment

1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Build command: `npm run build`
4. Output directory: `dist`

In Supabase → Authentication → URL Configuration, add your Vercel domain to **Allowed Redirect URLs**.

---

## Development Workflow

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type-check + build
npm run build

# Preview production build
npm run preview
```

---

## Troubleshooting

### "Could not load application data" on login
- Check your `.env.local` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Verify all SQL files have been run in order

### 403 on challenge creation
- The unique index `challenges_one_active_per_template_idx` prevents duplicate active challenges for the same template — this is intentional
- If you see `42501`, your account may be suspended

### Admin tab not showing
- Your profile's `role` column must be `moderator` or `super_admin` — update it directly in Supabase

### Common RLS issues
- **Profile not visible**: check `is_private` and `account_status` columns
- **Reflection not in community feed**: check `visibility = 'public'`, `is_hidden = false`, and the author's `show_reflections` setting
- **Checkins not loading**: the RLS policy requires `owns_challenge()` — verify `user_id` matches the logged-in user

### Past check-in rejected
- The `checkin_deadline_hours` system setting (default: 4 hours) controls the window for editing yesterday's check-in. After 04:00 UTC, yesterday is locked.

---

## Technical Debt / Known Limitations

- No pagination on leaderboard or community feed (hardcoded 20-item limit)
- No buddy/follow UI — the `follows` table exists but there is no follow/unfollow component
- Avatar upload not implemented — `avatar_url` column exists but is unused
- Admin template editing only supports top-level fields; editing individual habit definitions requires a SQL migration
- No email notifications for moderation actions
