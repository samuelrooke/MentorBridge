# Changelog

All notable changes to MentorBridge. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## [0.3.0] - 2026-11-05

### Landing page
- Hero slideshow uses the team's own photos: you sign up, your mentor helps you in, you start your internship.
- Benefits rewritten as a finished story: a better chance of landing your internship.
- Footer links to LinkedIn.
- Cleaner, calmer design: decorative shapes, labels, scroll animations, repeated numbers and the research section removed.
- Captions on the slideshow have a stronger dark fade, so the text is easier to read.

### Platform app
- Reset a forgotten password by email, and change your password on the account page.
- Clearer login errors, and a button to resend the confirmation email.
- Accessibility: main landmark on the login and reset pages; the log in / create account switch uses toggle buttons.

### Removed
- The old survey page in the repository root.
- Unused dependencies and CSS.

## [0.2.1] - 2026-11-05

### Changed

- Footer links to Instagram (@mentorbridgenl); placeholder LinkedIn and TikTok links removed.

## [0.2.0] - 2026-11-05

### Landing page
- New hero: "Find your match." with a three-slide illustrated slideshow (sign up, match, meet), 4 seconds per slide, with pause and dots.
- Dutch version at /nl/ with an EN | NL switch that remembers the visitor's choice.
- A/B test of the hero headline; every sign-up stores the variant it saw.
- "Without a mentor" vs "With MentorBridge" section, team section, contact form, shorter texts.
- New arch logo, deep wine colours, dark header with a log in button, section highlighting and a phone menu.
- Google Analytics 4 and Tag Manager, loaded only after cookie consent; sign-ups are sent as sign_up events.
- Contact email removed from the page; questions go through the contact form.

### Platform app
- New logo, simple dashboard and account page with log out.

### API and database
- POST /api/contact for the contact form.
- Sign-ups store the A/B variant.
- Migration 0005: variant column and contact_messages table.

## [0.1.1] - 2026-11-03

### Fixed

- Vercel builds of the landing page and platform app: install dependencies from the repository root, so build tools like Vite are available in the monorepo.

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

[0.2.1]: https://github.com/samuelrooke/MentorBridge/releases/tag/v0.2.1
[0.2.0]: https://github.com/samuelrooke/MentorBridge/releases/tag/v0.2.0
[0.1.1]: https://github.com/samuelrooke/MentorBridge/releases/tag/v0.1.1
[0.1.0]: https://github.com/samuelrooke/MentorBridge/releases/tag/v0.1.0
