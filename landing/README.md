# MentorBridge landing page

A one-page validation test. Its only goal is to count how many companies request a free pilot. It's built with Vite, plain HTML/JS and Tailwind CSS. The form posts to the Node API in `../server`, which stores requests in Supabase.

## Run locally

1. **Database (once).** In the Supabase SQL editor, run [`supabase/migrations/0002_pilot_requests.sql`](../supabase/migrations/0002_pilot_requests.sql).
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

This prints every request (date, email, company, interns per year) and the total count. You can also see them in the Supabase Table Editor under `pilot_requests`.

## Deploy

The landing page and the API deploy separately.

**1. API** (any Node host, e.g. Render or Railway)
- Root directory `server`, start command `npm start`.
- Environment variables:
  - `NODE_ENV=production`
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `LANDING_ORIGIN`: the landing page's public URL, e.g. `https://mentorbridge.netlify.app`. In production, CORS only allows this origin (and `CLIENT_ORIGIN`, if set). Localhost is only allowed outside production.

**2. Landing page** (any static host, e.g. Netlify)
- Base directory `landing`, build command `npm run build`, publish directory `landing/dist`.
- Environment variable `VITE_API_URL` = the API's public URL, e.g. `https://mentorbridge-api.onrender.com`. Vite builds it into the page, so redeploy after changing it.

Deploy the API first, so you know its URL before building the landing page.

## Placeholders to fill in

- `landing/public/hero.jpg`: the hero image. The page expects a portrait image (4:5).
- GoatCounter: in `index.html`, replace `YOUR-CODE` in `https://YOUR-CODE.goatcounter.com/count`.
- Contact email: in `index.html`, replace both `[CONTACT EMAIL]` in the footer.

## Measuring

- **Visitors:** GoatCounter (cookieless, so no cookie banner).
- **Conversions:** rows in `pilot_requests`. Each successful request is also counted in GoatCounter as the event `pilot-request`, so the conversion rate is pilot requests ÷ visitors.
