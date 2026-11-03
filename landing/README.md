# MentorBridge landing page

A one-page validation test aimed at students looking for an internship. Its main goal is student sign-ups. Mentors and host organizations can sign up through the same form (the organization option is the free pilot request). It's built with Vite, plain HTML/JS and Tailwind CSS. The form posts to the Node API in `../server`, which stores requests in Supabase.

## Run locally

1. **Database (once).** In the Supabase SQL editor, run [`0002_pilot_requests.sql`](../supabase/migrations/0002_pilot_requests.sql) then [`0003_pilot_request_roles.sql`](../supabase/migrations/0003_pilot_request_roles.sql), then [`0004_student_answers.sql`](../supabase/migrations/0004_student_answers.sql).
2. **API settings.** `server/.env` must include `SUPABASE_SERVICE_ROLE_KEY`, because the API needs it to store requests.
3. **Landing page settings.** Copy `landing/.env.example` to `landing/.env`. The default `VITE_API_URL=http://localhost:4000` points at the local API.
4. **Start both.** From the repo root:
   ```sh
   npm install
   npm run dev:landing
   ```
   The landing page runs at http://localhost:5174 and the API at http://localhost:4000.

## See the requests

From the repo root:

```sh
npm run pilot-requests
```

This prints every sign-up (date, role, email, company, interns per year, field) and the totals for companies, students and mentors. It also counts the answers students gave to the four follow-up questions (internship place, applications sent, help wanted, when they need one). You can also see them in the Supabase Table Editor under `pilot_requests`.

## Deploy

The landing page deploys to Vercel (Root Directory `landing`) and talks to the API, which deploys separately. The steps for both are in the main [README](../README.md#deploy). In short:

- Deploy the API first and note its URL.
- On the landing page's Vercel project, set `VITE_API_URL` to that URL. Vite builds it into the page, so redeploy after changing it.
- On the API, set `LANDING_ORIGIN` to the landing page's Vercel URL. In production, CORS only allows that origin and `CLIENT_ORIGIN`.

## Placeholders to fill in

- `landing/public/hero.jpg`: the hero image (landscape, currently 1264 × 848).
- GoatCounter: in `index.html`, replace `YOUR-CODE` in `https://YOUR-CODE.goatcounter.com/count`.
- Contact email: in `index.html`, replace both `[CONTACT EMAIL]` in the footer.

## Measuring

- **Visitors:** GoatCounter (cookieless, so no cookie banner).
- **Conversions:** rows in `pilot_requests`, by `role`. GoatCounter also counts the events `pilot-request`, `signup-student` and `signup-mentor`. The main conversion rate is student sign-ups ÷ visitors.
