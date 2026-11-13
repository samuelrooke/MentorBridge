# Add-ons from the marketing guest lecture: status

Last updated 13 November 2026, branch `feature/frontend-seo`. The lecture notes are the new guideline (version 3 in `MentorBridge_context.md`).

Step 1 (audit) is done. Step 2: all P1 items are built. They are **not live yet**: migration 0006 has to be applied to the Supabase database, then the API and the landing pages deployed, in that order.

Statuses: `DONE`, `PARTIAL`, `MISSING`, `CONFLICT`, `NOT CODE`, `BLOCKED` (waiting on an answer or input from the team).

## Status per item

| ID | Prio | Status | Where | What's missing |
|---|---|---|---|---|
| S0 | | PARTIAL | See inventory below | Hosting budget 50-100 €: per month or total? |
| A1 | P1 | DONE | `landing/index.html` (front page, "Who are you?" sends to the right page), `students/`, `mentors/`, `companies/`, each with its own hero, copy, FAQ and the form. Dutch versions under `/nl/`. Shared parts in `landing/partials/`, page list in `landing/scripts/pages.mjs`. | |
| A2 | P1 | PARTIAL | Students: 3-photo slideshow. Front and mentor pages: `slides/match.jpg` (handshake, professional and young person). Organizations: `slides/start.jpg` (office). All with alt text. | TODO: licensed photo of an older mentor with a student, and a workplace or HR photo. Sources of the current photos are not recorded. |
| A3 | P2 | CHANGED | Every page has its own title (at most 60 characters) and description (140-160), see `docs/frontend-seo-plan.md`. On 11 November the mentor group changed (people with free time next to their job, not retirees), so the "what to do after retirement" keyword is gone. The mentor page now targets "become a mentor next to your job" / "mentor worden naast je werk". | Team: confirm the new mentor keywords. |
| A4 | P2 | MISSING | | Not built yet. |
| A5 | P2 | BLOCKED | Not on the site. | Needs the real source and exact claim. The team also decided earlier not to show survey numbers as social proof. |
| A6 | P1 | DONE | FAQ on every page and hero points: free for everybody during the first version, payment model later, "we'll tell you before anything changes". Mentors: "no payment for mentors at the moment". The "organizations pay" copy is gone. | |
| A7 | P1 | DONE | `landing/companies/index.html`: retiring staff take their know-how with them; use it internally with 1-2 of your own mentors; or a mentor for your interns; white label "on request" (nothing built); contact form for HR on the page. | UNCLEAR: SaaS companies as a segment. Construction and logistics are named as examples. |
| A8 | P1 | CHANGED | Replaced on 11 November: `landing/mentors/index.html` speaks to people with free time next to their job (working, part-time, freelance), not retirees. The front page mentor card, the front page lead and the "Who are the mentors?" answers follow. No health or sickness wording. | The mentor form's age ranges (under 55, 55-59, …) were made for retirees; changing them needs a migration. Does "work on the side" mean paid? The site says no payment at the moment. |
| A9 | P2 | MISSING | | UNCLEAR: own page or a section on the organization page. |
| B1 | P1 | DONE | One form (`landing/partials/signup.html`) on all three pages, posted to `POST /api/pilot-requests`. Same table `pilot_requests` with `role`. Success state per segment. Unique index on (role, email) in migration 0006, API returns 409 and the page shows "already on the waiting list". RLS on, no public policies; inserts go through the API with the service key, so nobody can read rows with the public key. | Migration 0006 not applied yet. It deletes 1 existing duplicate row (keeps the oldest). |
| B2 | P1 | DONE | Company: contact name, work email, organization, role, sector; optional size and interest (internal / white label / both). Mentor: name, email, age range, hours per month, availability; optional sector. Student: name, email, sector, soft/hard/both, availability. Shared sector list, dropdowns and fixed options, age as ranges. Validated in `server/src/routes/pilotRequests.js`, constrained in migration 0006. | Since 11 November: age ranges under 30 to 60+ and a "mentor for our interns" option for companies (migration 0007). Students get 3 optional follow-up questions. |
| B3 | P1 | DONE | Required consent checkbox linking to `/privacy/`, stored as `consent_at`. Privacy statement: what we store, what we don't, why, legal basis, who sees it, how long, how to see or remove it, where to complain. Contact email: `mentorbridge.nl@outlook.com`. | TODO in the page: Supabase region and exact project end date. |
| B4 | P2 | DONE | Contact form submissions are stored in Supabase `contact_messages`. Direct contact links use `mentorbridge.nl@outlook.com`. | No automatic email is sent by the site. |
| C1 | P1 | DONE | `landing/src/main.js` reads `utm_source`, `utm_medium`, `utm_campaign`, the referring host and the first page, keeps them for the session (new UTM tags replace them) and sends them with the sign-up. Stored in new columns. Naming guide: `docs/utm.md`. | |
| C2 | P1 | DONE | GoatCounter counts views per page plus `form-start-<segment>` and `signup-<segment>`. Conversion = sign-ups ÷ views of that segment's EN + NL page. Explained in `docs/utm.md` and `landing/README.md`. | The old event `pilot-request` is now `signup-company`. |
| C3 | P2 | PARTIAL | `npm run pilot-requests` now shows the new fields and sign-ups per source. | No SQL view yet (per week, progress against targets). |
| C4 | P2 | PARTIAL | Cookie bar for GA4 and GTM, unchanged. | Doesn't cover LinkedIn or Google Ads yet. |
| C5 | P2 | MISSING | | Needs the LinkedIn partner ID. |
| C6 | P2 | PARTIAL | Canonical and absolute hreflang on every page, `robots.txt`, and a sitemap generated from the page list with `<lastmod>` from git. | Search Console verification tag (needs the team's Google account). |
| C7 | P3 | MISSING | | UNCLEAR: are ads planned? |
| C8 | P2 | DONE | Open Graph and Twitter tags per page and language, 1200x627 images in `landing/public/og/` (`npm run og -w landing`). | |
| C9 | P3 | MISSING | | Can be made now that the pages and UTM names exist. |
| D1 | LATER | PARTIAL | Platform app has auth, roles, keyword-based student/mentor matching, profile bios and photos, an overview dashboard, live session schedule, and private live messaging. | Migrations 0008 to 0011 are applied to the live database (13 November). Still to do: merge `feature/frontend-seo` into `main` so Vercel deploys it. The waiting list fields (sector list, age range, hours, availability options) aren't in the platform tables yet. |
| D2 | LATER | PARTIAL | Landing colours are tokens in `landing/src/style.css`. Header and footer now exist once (partials), so the name and logo are in fewer places. | No single brand config. |
| D3 | LATER | NOT CODE | | Investor note UNCLEAR. |

## To go live

1. Apply migration `supabase/migrations/0006_waitlist_fields.sql` to the shared Supabase project (`npm run db:push`, or paste it in the SQL editor). It deletes 1 duplicate sign-up.
2. Deploy the API (Vercel project `mentor-bridge`). The new API needs the new columns, and the old landing form no longer passes its checks (no name, no consent), so steps 2 and 3 belong together.
3. Deploy the landing pages (Vercel project `landing`).
4. Test one sign-up per segment on https://mentorbridge.nl and remove the test rows.
5. Migrations 0008 to 0011 are applied. Merge `feature/frontend-seo` into `devel` and `main`; Vercel deploys the client and landing from `main`.
6. Then in Supabase, Authentication → URL Configuration: Site URL `https://mentorbridge.nl`, Redirect URL `https://mentorbridge.nl/**`.

## S0. Inventory (from the audit)

- **Repo:** npm workspaces. `landing/` is plain HTML + JS with Vite 8 and Tailwind 4 (`@apply`). `client/` is React 19. `server/` is Express 5. Migrations in `supabase/migrations/`.
- **Hosting:** three Vercel projects on the free Hobby plan: `landing` (https://mentorbridge.nl), `client` and `mentor-bridge` (the API). Supabase is the database and auth only. Domain at GoDaddy.
- **Supabase:** Postgres with RLS on every table, email and password auth for the platform app, no storage buckets, no edge functions.
- **Analytics:** GoatCounter (cookieless). GA4 and Google Tag Manager are configured in production (`VITE_GA_ID` and `VITE_GTM_ID` on Vercel) and load only after Accept in the cookie bar. Which tags the GTM container fires can only be checked in tagmanager.google.com.
- **Email:** only Supabase Auth emails for the platform app.
- **Paid services seen:** the GoDaddy domain. The Supabase plan can't be seen from the repo.

## Open questions (UNCLEAR)

- S0: hosting budget of 50-100 €, per month or in total, and for what? (Hosting is on Vercel and free right now.)
- A3: Dutch keywords too (pensioen)?
- A5: the real source and exact claim behind "88%" and "twice as fast".
- A7: are SaaS companies a target segment or just an example?
- A9: own page or a section on the organization page?
- B4: what is Gmail for: contact address, confirmation emails or outreach?
- C7: are Google Ads actually planned, and with what budget?
- D3: the investor note.
- Prepare or place (context section 15) is still open: the student page and the follow-up questions still talk about finding an internship.
