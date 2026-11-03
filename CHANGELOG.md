# Changelog

All notable changes to MentorBridge. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## [0.1.0] - 2026-11-03

First release: the validation landing page for students, the API that stores sign-ups, and the foundation of the platform app.

### Landing page

- One-page site aimed at students looking for an internship, with student sign-up as the main goal.
- Sign-up form for students, mentors and organizations (organization = free pilot request).
- Four optional follow-up questions for students after signing up: internship place, applications sent, help wanted, when they need one.
- Hero illustration of how the service works, problem figure, what your mentor helps with, how it works, platform preview, research-based social proof, FAQ and footer with contact email.
- MentorBridge logo and app icon, colours matched to the logo, light and accessible design (WCAG AA contrast, keyboard navigation, reduced motion).
- Visitor counting with GoatCounter (code still to be filled in).

### API

- `POST /api/pilot-requests` with validation, honeypot spam protection and no tracking data.
- `PATCH /api/pilot-requests/:id/answers` for the follow-up answers, once per sign-up and within an hour.
- CORS limited to the platform app and landing page in production.
- `npm run pilot-requests` lists sign-ups, totals per role and answer counts.
- Auth routes (`/api/me`) and admin matching (`/api/admin`) for the platform app.

### Platform app

- Login and sign-up with Supabase Auth, roles for students, organizations and mentors.
- Dashboard, intake profile per role and an admin page for manual matching.

### Database

- Migrations 0001 to 0004: profiles, intake, matches, consent, plan, sessions, messages, feedback, pilot requests and student answers, all with row level security.

### Development and deployment

- Dockerfiles for the API, platform app and landing page, and a compose file for the whole stack.
- Vercel configuration for all three parts.
- Supabase CLI config, local seed data and `db:*` scripts.
- `npm run setup` and `npm run doctor` for checking a setup.
- GitHub Actions CI: lint, tests, builds and Docker images.

### Not yet included

- Screens for the preparation plan, sessions, messages, consent and feedback (the database tables and access rules exist).
- Social media links and the GoatCounter code on the landing page.

[0.1.0]: https://github.com/samuelrooke/MentorBridge/releases/tag/v0.1.0
