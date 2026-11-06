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
4. In Supabase, under **Authentication → URL Configuration**, set the platform app's URL as Site URL so confirmation emails link back to it.

`VITE_` variables are built into the page, so redeploy after changing them.

## Database

Schema changes are migration files in `supabase/migrations`. Migrations 0001 to 0005 are already applied to the shared project. For new ones: `npm run db:new <name>`, then `npm run db:link` (once) and `npm run db:push`. Before the very first push, run `npx supabase migration repair --status applied 0001 0002 0003 0004` once, so the CLI knows those are already in.

Admins are set by hand in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
