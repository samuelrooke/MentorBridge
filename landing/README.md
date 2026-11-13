# MentorBridge landing pages

The waiting list test on https://mentorbridge.nl. A front page sends visitors to one page per segment, each with its own hero, copy and the waiting list form. It's built with Vite, plain HTML/JS and Tailwind CSS. The form posts to the Node API in `../server`, which stores sign-ups in Supabase.

| Page | English | Dutch |
|---|---|---|
| Front page | `/` (`index.html`) | `/nl/` |
| Students | `/students/` (`students/index.html`) | `/nl/students/` |
| Mentors | `/mentors/` (`mentors/index.html`) | `/nl/mentors/` |
| Organizations | `/companies/` (`companies/index.html`) | `/nl/companies/` |
| Privacy statement | `/privacy/` (`privacy/index.html`) | `/nl/privacy/` |

## How the pages are built

Shared parts live once in `partials/`: `head`, `header`, `footer` (with the cookie bar), `signup` (the one waiting list form) and `contact`. A page pulls one in with `<!-- @include header -->`. `scripts/pages.mjs` lists the pages and fills in `{{path}}`, `{{segment}}` and `{{cta}}` per page. Vite does this for the English pages (`vite.config.js`), `scripts/build-nl.mjs` for the Dutch ones.

**Adding a page:** create `<name>/index.html`, add it to `PAGES` in `scripts/pages.mjs`, and add its Dutch text to `i18n/nl.json`.

**The form:** each segment page sets `<body data-segment="student|mentor|company">`. `src/main.js` shows only the fields for that segment (`data-for-role` in `partials/signup.html`). The options (sectors, age ranges, hours, availability) must match `server/src/routes/pilotRequests.js` and `supabase/migrations/0006_waitlist_fields.sql`. The same email can sign up once per segment; a second try shows "already on the waiting list".

## Run locally

1. **Database (once).** Apply the migrations in [`supabase/migrations`](../supabase/migrations) (see the main README). The landing pages use the `pilot_requests` and `contact_messages` tables.
2. **API settings.** `server/.env` must include `SUPABASE_SERVICE_ROLE_KEY`, because the API needs it to store sign-ups.
3. **Landing page settings.** Copy `landing/.env.example` to `landing/.env`. The default `VITE_API_URL=http://localhost:4000` points at the local API.
4. **Start both.** From the repo root:
   ```sh
   npm install
   npm run dev:landing
   ```
   The landing pages run at http://localhost:5174 and the API at http://localhost:4000. Changes to a partial reload the browser. The Dutch pages are generated when dev starts; after changing text, run `npm run i18n -w landing`.

## See the sign-ups

From the repo root:

```sh
npm run pilot-requests
```

This prints every sign-up (role, name, email, sector, the fields per segment, availability, source), totals per segment and per source, and the student follow-up answers. You can also see them in the Supabase Table Editor under `pilot_requests`.

## Deploy

The landing pages deploy to Vercel (project `landing`, Root Directory `landing`) and talk to the API (project `mentor-bridge`), which deploys separately. The steps for both are in the main [README](../README.md#deploy). In short:

- Apply new migrations first, then deploy the API, then the landing pages.
- On the landing project, `VITE_API_URL` is the API's URL. Vite builds it into the page, so redeploy after changing it.
- On the API, `LANDING_ORIGIN` lists the landing page's URLs, separated by commas. In production, CORS only allows those and `CLIENT_ORIGIN`.

## Placeholders to fill in

- **Images:** the slots waiting for a photo, and how to add one, are in [`docs/images.md`](../docs/images.md). In short: put the original in `docs/images-src/<slot id>.jpg`, run `npm run images -w landing`, check the alt text in `scripts/slots.mjs` and its Dutch entry. A slot without a photo shows the team photo set as its fallback, or a placeholder box.
- **Link previews:** `npm run og -w landing` renders `public/og/og-en.jpg` and `og-nl.jpg` from `og-template/og.html` with headless Chrome (set `CHROME_PATH` if it isn't found).
- **Photo sources:** the sources and licences of `public/slides/*.jpg` aren't recorded yet. Add them to `docs/images.md`.
- **Privacy statement:** Supabase region and project end date still need confirmation. Contact email: `mentorbridge.nl@outlook.com`.
- **Team photos:** replace the initials on the front page with photos (`public/team/<name>.jpg`).

## Measuring

- **Visitors:** GoatCounter, cookieless, counts page views per page.
- **Conversion per segment:** GoatCounter events `form-start-<segment>` and `signup-<segment>` (`student`, `mentor`, `company`). Conversion = `signup-<segment>` ÷ views of that segment's English and Dutch page. Target 1-3%. See [`docs/utm.md`](../docs/utm.md).
- **Source:** every sign-up stores `utm_source`, `utm_medium`, `utm_campaign`, the referring site (host name only) and the first page of the visit, kept for the browser session. Tag links as described in [`docs/utm.md`](../docs/utm.md).
- **Google Analytics 4 and Tag Manager (optional):** set `VITE_GA_ID` and `VITE_GTM_ID` in `landing/.env` and on Vercel. Visitors then see a cookie bar, and Google only loads after they click Accept (Consent Mode v2, analytics only, no advertising). Sign-ups are sent as `sign_up` events with a `role` and the A/B `variant`.
- **A/B test (student page):** the hero headline has two versions. GoatCounter counts `ab/hero-a` and `ab/hero-b` visits and every student sign-up stores its variant. Force one with `?variant=a` or `?variant=b`.

## Languages

Every page exists in English and Dutch, with an EN | NL switch in the header that remembers the visitor's choice.

- The files in `nl/` are **generated** (and not in git): edit the English pages, the partials and `i18n/nl.json`, never `nl/`. They are rebuilt on `npm run dev` and `npm run build`, or with `npm run i18n -w landing`.
- Links in the Dutch pages are rewritten to stay in Dutch (`/students/` becomes `/nl/students/`).
- The generator warns about English text without a Dutch translation, and about translations no page uses anymore.
- Texts set from JavaScript (button labels, errors, "Sending…") are in `UI`, `SERVER_NL` and `BUTTON` in `src/main.js`.
