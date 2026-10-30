# MentorBridge

MentorBridge connects students with experienced professionals 2–3 months before their internship, so they start prepared and companies get interns who contribute from day one.

## Project structure

```
index.html            Landing page / validation survey (static, standalone)
client/               React + Vite + TypeScript web app
  src/context/        Supabase auth state (session + profile)
  src/pages/          Login, Dashboard, Profile (intake), Admin (manual matching)
server/               Node.js + Express API
  src/middleware/     Verifies Supabase access tokens, role checks
  src/routes/         /api/me, /api/admin
supabase/migrations/  Database schema and row level security policies
```

The browser talks to Supabase directly for auth and for anything row level security allows (profiles, plan, messages, sessions). The Node backend handles trusted work that needs the service-role key, starting with manual matching.

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. **Create the database:** open the SQL editor and run [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql).
3. **Add environment variables:**
   - Copy `client/.env.example` to `client/.env` and fill in the project URL and anon key.
   - Copy `server/.env.example` to `server/.env` and fill in the URL, anon key and service-role key. Keep the service-role key out of the client.

   You can find these under *Project settings → API*.
4. **Install and run:**
   ```sh
   npm install
   npm run dev
   ```
   The app runs at http://localhost:5173 and the API at http://localhost:4000. Vite forwards `/api` to the API.

## Roles

People choose **student**, **company** or **mentor** when they sign up. To make someone an **admin** who can do manual matching, run this in the SQL editor after they sign up:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## MVP scope (MoSCoW Must-haves)

| Feature | Where |
| --- | --- |
| Student, company, mentor registration and intake | `profiles`, `*_profiles` tables, Profile page |
| Manual matching | `matches` table, Admin page, `POST /api/admin/matches` |
| Consent before data is shared with the company | `consents` table; company access depends on it |
| Structured preparation plan | `plan_activities` table |
| Communication | `messages` table |
| Session scheduling | `sessions` table |
| Feedback | `feedback` table |

The tables and access rules are in place for consent, the plan, messages, sessions and feedback. Their screens still need to be built.
