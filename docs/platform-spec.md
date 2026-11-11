# MentorBridge platform: dashboard, schedule and messages

A self-contained brief. Paste the whole file into an AI coding assistant. Everything it needs about the codebase is in here.

---

## 1. What MentorBridge is

MentorBridge matches students with experienced professionals from their field (mentors). A mentor helps a student find and prepare for an internship in a few short sessions, online or in person. Companies can take part too: their own staff mentor their interns, or MentorBridge matches their interns with a mentor. Mentors are people with some free time next to their job. Matching is done by hand by an admin. The first version is free for everybody. Netherlands and Belgium first.

The platform app is where matched students and mentors work together. Right now it only has login, profile, account and an admin matching page. This task adds a real **dashboard**, a **schedule** (sessions calendar) and **messages** (chat between a student and their mentor).

## 2. Tech stack (already set up, don't change it)

| Part | Tech |
|---|---|
| Platform app | `client/`: React 19, TypeScript, Vite 8, React Router 7, Tailwind CSS 4 (CSS-first `@theme`, components with `@apply` in `client/src/index.css`) |
| Data and auth | Supabase (Postgres with row level security, email/password auth, Realtime), `@supabase/supabase-js` v2 |
| API | `server/`: Node 22, Express 5. Only used for admin actions with the service key. Students and mentors talk to Supabase directly, protected by RLS. |
| Tests | Vitest + Testing Library in `client/` |
| Hosting | Vercel (client, server and landing are separate projects), production deploys from `main` |

Monorepo with npm workspaces: `client/`, `server/`, `landing/`, migrations in `supabase/migrations/`.

## 3. Existing client code you build on

```
client/src/
  App.tsx                 routes: /login, /reset-password, /dashboard, /profile, /account, /admin (admin only)
  main.tsx
  index.css               Tailwind theme + component classes (.card, .stack, .tiles, .btn, .badge ...)
  lib/supabase.ts         export const supabase = createClient(url, anonKey); types Role, Profile
  lib/api.ts              api<T>(path, init) calls the Express API with the user's access token
  context/auth.ts         useAuth(): { session, profile, loading, refreshProfile, signOut }
  context/AuthContext.tsx AuthProvider
  components/Layout.tsx   top bar (Wordmark, nav: Dashboard, Profile, Account, Matching for admins), <Outlet/>
  components/ProtectedRoute.tsx  <ProtectedRoute roles={['admin']}>
  pages/Dashboard.tsx     currently a welcome card + links to Profile and Account
  pages/Profile.tsx, Account.tsx, Admin.tsx, Login.tsx, ResetPassword.tsx
```

`Profile` type: `{ id, role: 'student' | 'company' | 'mentor' | 'admin', full_name, email, created_at }`.

The Express API already has `GET /api/me/matches`, which returns the signed-in user's matches with names: `select('*, student:student_id(full_name), mentor:mentor_id(full_name), company:company_id(full_name)')`. You may use it, or query Supabase directly with the same select.

## 4. Database (already exists, from migration 0001)

Relevant tables. RLS is on for all of them.

```sql
profiles (id uuid pk -> auth.users, role user_role, full_name text, email text, created_at timestamptz)

matches (
  id uuid pk, student_id uuid -> profiles, mentor_id uuid -> profiles, company_id uuid -> profiles null,
  status match_status ('proposed' | 'active' | 'completed' | 'cancelled') default 'proposed',
  created_by uuid, created_at timestamptz
)

sessions (
  id uuid pk, match_id uuid -> matches, starts_at timestamptz not null, duration_min int default 60,
  meeting_url text, notes text, created_by uuid default auth.uid(), created_at timestamptz
)

messages (
  id uuid pk, match_id uuid -> matches, sender_id uuid -> profiles default auth.uid(),
  body text not null check (length between 1 and 5000), created_at timestamptz
)
-- index on messages (match_id, created_at)

plan_activities (
  id uuid pk, match_id uuid -> matches, title text not null, description text, due_date date,
  completed_at timestamptz, sort_order int default 0, created_at timestamptz
)

feedback (id, match_id, author_id default auth.uid(), rating 1-5, comments, created_at, unique (match_id, author_id))

consents (match_id pk, student_id, granted_at, revoked_at)  -- a company sees a match only with the student's consent
```

Helper functions (security definer): `is_admin()`, `is_match_member(m_id)` (true if auth.uid() is the student or mentor of the match), `company_can_view(m_id)` (company of the match AND an active consent).

Existing RLS policies:

- `matches`: select if `is_admin() or is_match_member(id) or company_can_view(id)`. Only admins create or change matches (through the API).
- `sessions`: student and mentor of the match can select, insert, update and delete (`is_match_member(match_id)`).
- `messages`: members can select; members can insert with `sender_id = auth.uid()`. No update or delete.
- `plan_activities`: members can do everything; the company can read with consent; admins can read.
- `profiles`: users see themselves and the people they are matched with.

**Database changes are allowed only as a new migration file:** `supabase/migrations/0008_platform_schedule_messages.sql`. Never edit 0001-0007. Expected content (adjust if needed):

```sql
-- Live updates for the chat and the schedule.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.sessions;
-- A short title for each session, e.g. "Interview practice".
alter table public.sessions add column title text check (length(title) <= 120);
-- When a member last read the messages of a match, for unread counts.
create table public.message_reads (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  read_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
alter table public.message_reads enable row level security;
create policy "own read markers" on public.message_reads for all
  using (user_id = auth.uid() and public.is_match_member(match_id))
  with check (user_id = auth.uid() and public.is_match_member(match_id));
```

## 5. What to build

### 5.1 Dashboard (`/dashboard`, replaces the current page)

For students and mentors:

- A header with the user's name and role.
- **"Your match"** card: the other person's name (mentor for a student, student for a mentor), match status, and the company if there is one. With no match yet: a friendly empty state ("We're looking for a good match. We'll email you.").
- **"Next session"** card: date, time, duration, title, a "Join" link if `meeting_url` is set. Empty state with a button to plan one.
- **"Messages"** card: the last message and an unread count, linking to `/messages`.
- **"Your plan"** card: progress of `plan_activities` (e.g. "2 of 4 steps done") with the next open step.
- Links to Profile and Account stay.
- Admins keep their current view plus a link to Matching.
- Companies see only matches they can view (consent), read-only.

### 5.2 Schedule (`/schedule`)

- A month view and a list view (upcoming and past) of the sessions of the user's match. If a mentor has several matches, show all, with the student's name on each session.
- **Plan a session** (student or mentor): date, start time, duration (30, 45, 60, 90 min), title, optional meeting link, optional notes. Validate: a date in the future, a valid URL.
- Edit and delete a session (any member of the match).
- **Add to calendar**: download a `.ics` file per session (generate it in the browser, no extra service) and a Google Calendar link (`https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...`).
- Times shown in the user's own time zone (`Intl.DateTimeFormat`); stored as `timestamptz`.
- Live updates via Supabase Realtime: a session planned by the other person appears without reloading.
- Build the month grid yourself (no paid calendar library). A small free date library such as `date-fns` is allowed if needed.

### 5.3 Messages (`/messages`)

- Left: the user's matches (one conversation per match), with the other person's name, last message and unread badge. On phones: list first, then the conversation as its own screen.
- Right: the conversation, newest at the bottom, grouped by day, own messages on one side and theirs on the other, with time stamps.
- A text box (Enter sends, Shift+Enter makes a new line), max 5000 characters, with a character count near the limit. No attachments in this version.
- Live: subscribe to `postgres_changes` on `messages` filtered by `match_id=eq.<id>`; new messages appear at once. Unsubscribe on leaving.
- Unread: upsert `message_reads` when a conversation is open; unread count = messages after `read_at` from the other person.
- Load the last 50 messages, "Load older" for more.
- Companies and admins don't see messages (RLS already enforces this; don't show the page to them).

### 5.4 Navigation

Add **Schedule** and **Messages** to the top bar (students and mentors), with an unread badge on Messages. Keep Dashboard, Profile, Account, and Matching for admins.

## 6. Design

Match the landing page (mentorbridge.nl): beige-first with red accents.

```css
--color-cream: #FAF2E5;   /* page */
--color-card: #FEFAF1;    /* cards, with border ink/8 and a soft shadow */
--color-sunk: #F4E7D6;    /* panels, chips, other person's chat bubbles */
--color-ink: #2E1015;     /* text */
--color-muted: #5E4B4D;   /* secondary text */
--color-accent: #7B1E2B;  /* links, accents */
--color-cta: #7B1E2B;     /* buttons, own chat bubbles; text on it #FFF6ED */
--color-cta-hover: #5E1520;
--color-on-dark: #FFF6ED; /* text on red */
--color-gold: #E1B385;    /* small numbers and labels on red only, never on light */
```

- Fonts: Barlow (body, buttons) and Fraunces 600 (headings). The landing page self-hosts them in `landing/public/fonts/`; copy the woff2 files and `@font-face` rules to the client, and remove the Google Fonts link from `client/index.html` (no requests to Google).
- Rounded cards (`rounded-3xl`), calm spacing, no all-caps labels above every heading, no animations except small transitions (respect `prefers-reduced-motion`).
- Contrast at least 4.5:1 for text and 3:1 for input borders (use ink at 50% for field borders). Visible focus rings.
- Works from 360 px wide. Keyboard usable: the chat box, the calendar grid (arrow keys move between days) and every button.

## 7. Copy rules

- Plain English, short sentences, sentence case. No em dashes. No marketing words (unlock, empower, seamless, journey...).
- Don't invent numbers, quotes or testimonials.
- MentorBridge is not a progress-tracking or HR tool. The plan helps the student and mentor, it isn't a report for the company.

## 8. Constraints

- No new paid services. Supabase Realtime and `.ics` files only.
- Don't change the landing page, the server's waiting list routes, or migrations 0001-0007.
- Students and mentors use Supabase directly with RLS. Only add API routes if something needs the service key.
- Keep `npm run lint`, `npm test` and `npm run build` passing. Add tests for the `.ics` generation, the unread count and the date grouping.

## 9. Done when

1. A student and a mentor in the same match can each plan, edit and delete sessions, and see the other's changes live.
2. They can chat live; unread badges update; the other user can't see anyone else's conversations.
3. A user without a match sees clear empty states on all three pages.
4. A company user sees the dashboard read-only and never sees messages.
5. `.ics` files import correctly into Google Calendar and Outlook.
6. Everything works on a 360 px phone and with the keyboard only.
7. Lint, tests and build pass. Migration 0008 is the only database change.

## 10. Deliverables

- Migration `supabase/migrations/0008_platform_schedule_messages.sql`.
- New pages `client/src/pages/Schedule.tsx`, `Messages.tsx`, a new `Dashboard.tsx`, routes in `App.tsx`, nav in `Layout.tsx`.
- Small hooks in `client/src/lib/` (e.g. `useMatches`, `useSessions`, `useMessages`) that wrap the Supabase queries and Realtime subscriptions.
- Tests in `client/src/**/*.test.tsx`.
- A short note in the root `README.md` about enabling Realtime (the migration does it) and the new pages.
