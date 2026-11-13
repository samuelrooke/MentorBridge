# MentorBridge

MentorBridge matches students with experienced professionals from their own field, who help them find their internship and prepare for it. Free for students.

## Project structure

```
landing/              Landing page (Vite, plain HTML/JS, Tailwind)
client/               Platform web app (React, Vite, TypeScript, Tailwind)
server/               Node.js + Express API (api/ is the Vercel entry point)
supabase/             Migrations, local seed data and Supabase CLI config
scripts/              setup and doctor scripts
docker-compose.yml    Runs API, platform app and landing page in Docker
```

## Run locally

```sh
npm install
npm run setup     # creates the .env files from the examples; fill in the Supabase keys
npm run doctor    # checks .env files, Supabase connection and migrations
npm run dev       # platform app :5173 · landing page :5174 · API :4000
```

Or everything in Docker: `npm run docker:up` (API :4000 · platform app :8080 · landing page :8081).

## Deploy on Vercel

Create three Vercel projects from this repository, each with its own **Root Directory**. Build settings are in each folder's `vercel.json`.

| Project | Root Directory | Environment variables |
| --- | --- | --- |
| API | `server` | `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_ORIGIN`, `LANDING_ORIGIN` |
| Landing page | `landing` | `VITE_API_URL` |
| Platform app | `client` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` |

1. Deploy the **API** first and copy its URL.
2. Deploy the **landing page** and **platform app** with `VITE_API_URL` set to that URL.
3. Set `LANDING_ORIGIN` and `CLIENT_ORIGIN` on the API to their two URLs and redeploy it. In production, CORS only allows these two.
4. In Supabase, under **Authentication → URL Configuration**, set the Site URL to `https://mentorbridge.nl` and add `https://mentorbridge.nl/**` under Redirect URLs, so account emails link back to the site.

**One domain.** Visitors only ever see https://mentorbridge.nl. The landing project forwards the app's paths (`/login`, `/dashboard`, `/profile`, `/schedule`, `/messages`, `/matching`, `/account`, `/admin`, `/reset-password`, `/auth/confirm` and the app's files under `/app-assets/`) to the `client` project, see `landing/vercel.json`. When the app gets a new top-level page, add its path there too. Deploy the `client` project before the landing project when both change, so the forwarded files exist.

`VITE_` variables are built into the page, so redeploy after changing them.

### Account emails without Supabase branding

Out of the box, Supabase sends the confirmation and password emails from its own address, with its own text, and the link goes to `<project>.supabase.co`. To make them MentorBridge emails:

1. **Text and link.** In Supabase, **Authentication → Email Templates**, paste the HTML from `supabase/templates/` into *Confirm signup* (`confirmation.html`), *Reset password* (`recovery.html`) and *Change email address* (`email_change.html`). The subjects are in `supabase/config.toml`. The links then go to the platform's own `/auth/confirm` page. This needs the Site URL from step 4 above.
2. **Sender.** Under **Authentication → SMTP Settings**, turn on custom SMTP with a mail service (for example Brevo or Resend, both have free tiers) and set the sender name to MentorBridge. Without custom SMTP, Supabase's built-in mail only reaches a few addresses an hour and only the project team's own addresses, so real users may not get the email at all.
3. **Fastest sign-up (optional).** Under **Authentication → Sign In / Providers → Email**, turning off *Confirm email* logs people in right after sign-up, with no email step. The app handles both settings.

## Database

Schema changes are migration files in `supabase/migrations`. Migrations 0001 to 0005 are already applied to the shared project. For new ones: `npm run db:new <name>`, then `npm run db:link` (once) and `npm run db:push`. Before the very first push, run `npx supabase migration repair --status applied 0001 0002 0003 0004` once, so the CLI knows those are already in.

Migration `0008_platform_schedule_messages.sql` enables Supabase Realtime for sessions and messages and adds message read markers. Apply it with `npm run db:push` to use the platform's dashboard, schedule, and messages pages.

Migration `0010_student_start_preference.sql` adds the student's preferred start season or a specific date to their profile.

Migration `0012_admin_full_access.sql` lets admins use Schedule and Messages for every match: they can read all conversations and post in them as "MentorBridge team". The privacy statement says so.

**Admin dashboard.** Admins get the admin dashboard on `/dashboard` (overview, users, matches, waiting list, contact). Most of it goes through `/api/admin/*` on the API, which needs the service-role key. "View as" in the top bar shows the platform as any student, mentor or company.

**Sign-up.** `POST /api/signup` (used by the landing form and the platform's Create account) creates the account already confirmed and returns a one-time login for `/auth/confirm`, so no email is sent.

Admins are set by hand in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
-- or from the terminal, with the service-role key in server/.env:
--   npm run users -- make-admin you@example.com
```
