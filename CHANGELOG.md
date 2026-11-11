# Changelog

All notable changes to MentorBridge. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## [Unreleased]

### Added
- Waiting list with one page per segment: `/students/`, `/mentors/`, `/companies/`, plus a front page that sends visitors to the right one. All in English and Dutch.
- Waiting list fields per segment: name and sector for everyone (sector optional for mentors); age range, hours per month and availability for mentors; soft or hard skills and availability for students; role, size and how they'd use it for organizations.
- Consent checkbox on the form and a privacy statement at `/privacy/`, which also explains GoatCounter and the Google Analytics cookies (only after Accept).
- Every sign-up stores its UTM tags, referring site (host name only) and first page. Guide for tagging links in `docs/utm.md`.
- GoatCounter events per segment: `form-start-<segment>` and `signup-<segment>`.
- Mentor page aimed at "what to do after retirement"; organization page about keeping know-how when staff retire, internal use and white label on request.
- `npm run pilot-requests` shows the new fields and sign-ups per source.
- For search engines and link previews: absolute canonical and hreflang links, Open Graph and Twitter tags per page and language, structured data (Organization and WebSite) on the front page, `robots.txt`, and a sitemap generated from the page list.
- The `.vercel.app` addresses of the landing page redirect to https://mentorbridge.nl (301).
- Image slots for the front page cards and the mentor and organization heroes, filled from `docs/images-src/` with `npm run images -w landing` (uses sharp). Until a slot has its own image it shows a team photo or a placeholder. See `docs/images.md`.
- The mentor and companies pages have a 3-step photo slideshow, like the student page (Pexels photos).
- Photos on the three front page cards: a student, a mentor and a company (stock photos, sources in `docs/images.md`).
- Link preview images in English and Dutch (`npm run og -w landing`), rendered from an HTML template.
- Photos load as WebP in three sizes, with the first photo on each page loaded first.
- The header and footer logo is a 112 px version (8 KB instead of 293 KB), with proper 32 px and 180 px favicons.

### Changed
- MentorBridge is free for everybody during the first version; the "organizations pay" copy is gone.
- Mentors are described as experienced professionals with some free time next to their job (part-time and freelance too), not retirees. The mentor page targets "become a mentor next to your job".
- The same email can sign up only once per segment (migration 0006 removes earlier duplicates, keeping the oldest).
- Shared page parts (head, header, footer, form, contact) live in `landing/partials/`.
- Copy review for consistency: the front page headline says what MentorBridge is ("Experienced mentors for student interns."); the student page says find and prepare in its intro, like its title, and "Free for students"; the companies page points match its three options.
- The student follow-up has three questions; "What would help you most?" is gone because the form already asks what students want help with.
- Migration 0007: mentor age ranges for all working ages (under 30 to 60 or older) and a "A mentor for our interns" option for companies.
- The third group is called "companies" instead of "organizations" ("bedrijven" in Dutch): menu, cards, the companies page, the form and the API messages.
- The header button says "Join the waiting list", and "Sign up" on phones so it doesn't cover the logo.
- Beige design: cream page, header, footer and cards instead of white and dark bands. Dark sections are now red boxes on the beige page (the waiting list box in a darker red), with red buttons and accents, and gold for small labels and numbers inside the boxes. The app preview on the student page keeps the platform's own colours.
- Field and choice borders are darker, so they reach 3:1 contrast (WCAG 1.4.11).
- Page titles of at most 60 characters and descriptions of 140-160, built around what people search for. Section headings say what the section is about, for example "Questions and answers".
- The platform app asks search engines not to index it.
- Headings and the MentorBridge wordmark (header, footer, link previews) use Fraunces, a serif; body text and buttons stay Barlow. Both fonts are self-hosted, so the pages make no requests to Google. Anton, which wasn't used, is gone.

## [0.3.4] - 2026-11-06

### Removed
- The mentor survey line under the hero button.

## [0.3.3] - 2026-11-06

### Added
- Social proof under the hero button: "36 of the 38 professionals we asked would consider mentoring a student." (mentor survey, October 2026).

### Changed
- The three hero points each have their own dot, so they wrap cleanly on small screens.

## [0.3.2] - 2026-11-06

### Fixed
- The API accepts several landing page URLs in `LANDING_ORIGIN` (and client URLs in `CLIENT_ORIGIN`), separated by commas, so the forms work on every address Vercel gives the landing page.

## [0.3.1] - 2026-11-06

### Changed
- Shorter hero text: "A professional from your field helps you land your internship."
- Shorter B headline in the A/B test: "Find your internship with a mentor."

### Fixed
- The landing page now lists its own build tools (Vite, Tailwind), so it builds on its own.
- Landing page and main README match the current setup (migrations 0001 to 0005, analytics, A/B test).

### Removed
- Unused Dutch translations.

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
