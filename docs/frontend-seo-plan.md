# Frontend, design and SEO plan

Phase 0 (audit), 10 November 2026. Nothing on the site has changed yet. The only new files are this plan and `docs/font-specimen.html`.

Covers add-on items A2, A3, C6, C8 and the visual side of A1 from `docs/addons-status.md`.

## First: which version of the site this is for

The prompt describes **v0.3.4**, the live site: one page per language, everything in `landing/index.html`.

Since then, branch **`feature/waitlist-segments`** (not committed, not deployed) rebuilt the landing for version 3:

- a front page, plus `/students/`, `/mentors/`, `/companies/` and `/privacy/`, in English and Dutch;
- shared parts in `landing/partials/` (head, header, footer, signup form, contact);
- a page list in `landing/scripts/pages.mjs`, which already has a `SITE_URL` constant.

So several instructions point at things that have moved or no longer exist:

| Prompt says | On the branch |
|---|---|
| `landing/index.html` is the whole site | The head, header and footer are in `landing/partials/`. `index.html` is only the front page. |
| hreflang at `index.html:20-22` | `landing/partials/head.html:7-9` |
| No new pages | The segment pages already exist on the branch. This job adds none. |
| Image slots on top of the `#mentors` and `#organizations` cards | Those cards are gone. The front page has three cards ("Who are you?"), and the mentor and organization pages have their own hero photo. |
| The A/B hero is on `/` | It moved to `/students/` |
| SEO for `/` and `/nl/` | 10 URLs: 5 pages in 2 languages |

**Recommended default:** do this work on top of the segment branch. The other way means making every change twice. The rest of this plan assumes the branch. "Live" means v0.3.4 on https://mentorbridge.nl.

## a) Findings

Every item from `<known_facts>` is marked **Known fact: confirmed** or **Known fact: corrected**.

| Area | Finding | Evidence | Impact | Fix |
|---|---|---|---|---|
| Design | **Known fact: confirmed.** White is the page colour and most surfaces: 18 rules use `bg-white`, including body, `.hero`, cards, form card, fields, choices, buttons and the cookie bar. | `landing/src/style.css` lines 44, 82-84, 130, 144, 191, 196, 207, 210, 220, 240, 260, 263, 269, 279, 286, 317 | No warm surfaces yet | Batch 1 |
| Fonts | **Known fact: confirmed, one correction.** Barlow and Anton load from Google; Anton is used nowhere on the landing. Correction: the client app also loads both from Google (`client/index.html:11`). It defines `--font-display: 'Anton'` (`client/src/index.css:25`), but no class uses it. | Live `landing/index.html:16-19`; branch `partials/head.html:10-15`. Lighthouse: 6 requests to Google per page (1 CSS + 5 Barlow files, about 15 KB each). | Extra connections; GDPR concern; Anton downloads for nothing | Batch 2 |
| Fonts | Weight 500 is used by one rule only: the hero points. | `style.css:152` | One extra font file | Decision 6 |
| SEO | **Known fact: confirmed for live, partly fixed on the branch.** Live has no canonical and relative hreflang. The branch has an absolute canonical, but hreflang is still relative. Lighthouse fails the hreflang audit on both. | Live `landing/index.html:20-22`; branch `partials/head.html:6-9` | Google may ignore the language links | Batch 3: absolute URLs |
| SEO | **Known fact: confirmed.** No Open Graph, Twitter or JSON-LD tags. `robots.txt` and `sitemap.xml` return 404 on live. | `curl -I https://mentorbridge.nl/robots.txt` gives 404 | LinkedIn shows no preview image; no sitemap for Search Console | Batch 3 |
| SEO | **Known fact: confirmed.** The live title is 64 characters. The live description mixes "their field" and "your CV". | Live `landing/index.html:6-10` | Title is cut in results | Batch 3 |
| SEO | **New (branch, my own text):** most branch titles are over 60 characters and two descriptions are far too long. Front page: title 79, description 210 (EN) and 239 (NL). Students: title 77 (EN), 80 (NL). Organizations NL: title 87. | Measured on `landing/dist` | Cut in search results | Batch 3, options in decision 7 |
| SEO | **New:** without JavaScript, the H1 contains both A/B variants: "Find your match. Find your internship with a mentor." Variant A has no words people search for. | `curl https://mentorbridge.nl/` | Weaker H1, but changing it would break the A/B test | No change. After the test ends, keep the winner; B has the search words. |
| SEO | **Known fact: confirmed.** `landing-drab-iota-50.vercel.app` serves the production site with no `noindex`, so it's an indexable duplicate. `landing-mentor-bridge2.vercel.app` already sends `X-Robots-Tag: noindex`. `www.mentorbridge.nl` already 308s to `https://mentorbridge.nl/`. | `curl -I` on each address | Duplicate content | Canonical, plus a 301 (decision 13) |
| Performance | **Known fact: confirmed.** `icon.png` is 293 KB at 512x512 and shows at 48-56 px in the header and footer. It's the largest file on the branch front page. | `landing/public/icon.png`; Lighthouse network list | Slower first load on every page | Batch 4: a 112 px version under 20 KB |
| Performance | **Known fact: corrected.** `apple-touch-icon.png` is 298 KB and also 512x512; it should be 180x180. | Image header | Wasted download | Batch 4 |
| Performance | **Known fact: confirmed.** The slides are 173-182 KB JPGs at 1440x1080, used in a box about 400 px wide on phones. The first slide has `loading="eager"` but no `fetchpriority`. | `landing/public/slides/`; Lighthouse: "properly size images" could save 704 KiB, "modern image formats" 499 KiB | LCP 6.6 s on mobile | Batch 4: srcset, WebP, `fetchpriority="high"` |
| Accessibility | **Known fact: confirmed.** Field and choice borders (ink/30) are 1.96:1 on white and 1.93:1 on cream. ink/50 gives 3.16-3.37:1. | Contrast script below | Fails WCAG 1.4.11 today | Batch 1: ink/50 |
| Accessibility | **New, branch regression (mine):** on phones the header button covers the logo ("Join the waiting list", NL "Meld je aan voor de wachtlijst"). Live "Sign up free" fits. Lighthouse marks the Dutch front page 96 on accessibility because the rose "Bridge" ends up on the white button. | Lighthouse screenshots at 412 px | Broken header on phones in both languages | Batch 0: short label on small screens |
| Privacy | **New, correction to my earlier notes:** production has Google Analytics 4 and Tag Manager configured. The IDs are in the live bundle (`G-JZJ…`, `GTM-PCQ…`) and the cookie bar shows. The branch privacy page says "If we ever use Google Analytics", which is wrong. `docs/addons-status.md` also says the IDs are empty. | `curl` of `/assets/main-D19Fvlqn.js` | Inaccurate privacy statement | Batch 0: fix the text. Also check in tagmanager.google.com which tags the container fires and that they wait for consent; the repo can't show that. |
| Analytics | **New:** the branch changes the text around the A/B headline (label, lead, button, points) and moves it to `/students/`. The variants themselves are unchanged. The database had 4 sign-ups on 10 November. | `landing/students/index.html` vs live | Results from before and after the deploy can't be pooled | Decision 14 |
| Build | **New:** Vite dev and preview serve the front page for any unknown URL, because the default `appType` is `'spa'`. Locally `/robots.txt` returns HTML, so Lighthouse reports 295 robots.txt errors. Vercel correctly returns 404. | Lighthouse SEO 85 on the local branch build | Local checks don't match production | Batch 3: `appType: 'mpa'` |
| Best practices | **New:** GoatCounter loads from `//gc.zgo.at` (protocol-relative). On local http that counts as an insecure request, so Lighthouse Best Practices is 82 locally. It's fine on https. | `partials/head.html:22` | Local score only | Optional: write `https://`. Same script, no change to tracking. |
| CSS | **New:** the role picker CSS is dead on the branch (the form no longer has a role switch). | `style.css:274-280` | Dead code | Batch 1: remove |
| CSS | **New:** the contrast comment says "pale on head 12.7"; it measures 13.58. | `style.css:10` | Outdated note | Batch 1: recompute |
| SEO | **New:** the client app has no `noindex` and its title is just "MentorBridge". | `client/index.html` | The login page could be indexed | Batch 3 |
| Docs | **Known fact: confirmed on live, already fixed on the branch.** The README said the hero is an HTML illustration. | `devel:landing/README.md:37` | None on the branch | Done on the branch |
| Design | **Known fact: confirmed.** CHANGELOG 0.3.0 removed "decorative shapes, labels, scroll animations, repeated numbers and the research section". | `CHANGELOG.md`, 0.3.0 | Guardrail for the mockups | Section b |
| Docs | **New:** the 7 mockups are not in the repo. `docs/mockups/` doesn't exist. | `ls docs` | Section b can't be done in full | Please add them |

### Contrast, measured

Every number in the prompt's `<design>` section checks out:

| Text | on cream #FAF2E5 | on card #FEFAF1 | on sunk #F4E7D6 |
|---|---|---|---|
| ink #2E1015 | 15.73 | 16.78 | 14.36 |
| accent #7B1E2B | 9.16 | 9.77 | 8.36 |
| muted #5E4B4D | 7.30 | 7.78 | 6.66 |
| gold #E1B385 | 1.72 (fails) | 1.83 (fails) | 1.57 (fails) |

| Text | on cta #7B1E2B | on gradient start #691D27 | on gradient end #440C15 | on head #3D0A14 |
|---|---|---|---|---|
| gold #E1B385 | 5.33 | 6.09 | 8.39 | 8.78 |
| on-dark #FFF6ED | 9.53 | 10.89 | 15.01 | 15.70 |
| pale #F3E4E2 | 8.24 | 9.42 | 12.99 | 13.58 |

Surfaces against each other: card on cream 1.07, sunk on cream 1.10. Cards keep their border or shadow.

### Lighthouse baseline (mobile)

GoatCounter was blocked in every run so the test visits didn't land in the real stats.

| Page | Build | Perf | A11y | Best pr. | SEO | LCP | CLS | Weight |
|---|---|---|---|---|---|---|---|---|
| `/` | live v0.3.4 | 72 | 100 | 100 | 91 | 6.6 s | 0.066 | 928 KiB |
| `/nl/` | live v0.3.4 | 73 | 100 | 100 | 91 | 6.5 s | 0.034 | 928 KiB |
| `/` | branch, local preview | 81 | 100 | 82* | 85* | 4.4 s | 0 | 564 KiB |
| `/nl/` | branch, local preview | 81 | 96 | 82* | 85* | 4.4 s | 0 | 565 KiB |
| `/students/` | branch, local preview | 73 | 100 | 82* | 85* | 6.3 s | 0 | 927 KiB |
| `/mentors/` | branch, local preview | 81 | 100 | 82* | 85* | 4.4 s | 0 | 566 KiB |

\* Local only: Best Practices drops for the http GoatCounter request and SEO for the robots.txt fallback (both in the findings). On Vercel both go away. Live SEO loses points only on hreflang.

Main live losses: LCP 6.6 s (photos too large, fonts from Google), "properly size images" 704 KiB, "modern image formats" 499 KiB.

### Crawler view (live, no JavaScript)

- `<html lang="en">` and `lang="nl"`: correct.
- Title and description: see the findings.
- No canonical, no OG tags, no JSON-LD.
- The H1 contains both A/B variants.
- H2s: "From guessing to knowing", "From your first application to your first day", "Four students building MentorBridge", "Not a student?", "Good to know", "Find your match" (the same text as the H1 variant), "Questions? Send us a message", plus three footer headings.

## b) Mockups vs site

The mockups aren't in the repo, so I can't compare section by section yet. Please add the 7 images to `docs/mockups/` and I'll finish this section. Until then, this is based on the prompt's own description:

| From the mockups | Take? | Why |
|---|---|---|
| Cream page, cream cards with thin borders | Yes | Batch 1. Contrast checked above. |
| Dark sections as a burgundy gradient (#691D27 to #440C15) | Yes | Batch 1. Footer and header stay solid so the page has an anchor. |
| Gold for numbers and small labels on dark | Yes, on dark only | 1.6-1.8:1 on light surfaces |
| CTA panel #741E2B | Use the existing cta #7B1E2B | The two colours are almost the same; one token is enough |
| Warm photos of people | Yes | Batch 4, real photos first |
| Calm spacing | Yes | Already close; check after batch 1 |
| Serif headings | Your call | Decision 4, specimen in `docs/font-specimen.html` |
| All-caps labels above every heading, one italic word in a headline, an arrow on every link, identical card grids everywhere, scroll-in animations | No | Removed on purpose in 0.3.0 and reads as template work |
| Mission and vision section | Not now | Could go on the front page after "How it works", or next to the team section. Needs your vision text, not mockup text. |
| Values section | Not now | Could fold into the team section later |
| Quote panel | No | Needs a real, sourced quote. We have none, and the copy rules forbid invented ones. |
| Three-audience cards | Already exist | The branch front page has them ("Who are you?") |
| "Progress overview" and similar copy | No, flagged | Pulls towards the progress-tracking tool MentorBridge isn't |

## c) Plan in batches

New branch from `feature/waitlist-segments`, one commit per batch, `CHANGELOG.md` under `[Unreleased]`, no version bump.

### Batch 0: fixes the segment pages need before they go live

These are needed even if the rest of this plan waits.

- **Header button:** a short label on small screens ("Sign up" / "Aanmelden"), the full label from `sm` up. File: `partials/header.html`, plus `nl.json`.
- **Privacy page:** say that we use Google Analytics through Google Tag Manager, only after Accept. Files: `privacy/index.html`, `nl.json`. Also fix the S0 line in `docs/addons-status.md`.
- **Risk:** low. Check the header at 360, 412 and 768 px in both languages.

### Batch 1: tokens and surfaces

Files: `landing/src/style.css`, `landing/partials/contact.html`.

- **New tokens in `@theme`:** `--color-cream`, `--color-card`, `--color-sunk`, `--color-gold`, `--color-on-dark`. `--color-white` stays as is.
- **Mapping (my default):**

  | Today | Becomes |
  |---|---|
  | `body`, `.hero` (white) | cream |
  | `.band` (paper #FAF6F5) | cream. The hairline border and the dark sections already separate the sections. Using sunk here would merge the FAQ with the sunk contact section. |
  | `.audience`, `.form-card`, `.contrast-pain`, `.cookie-bar` | card, keeping the border or shadow |
  | Fields and `.choices span` | card with an ink/50 border |
  | `.btn-light`, `.btn-header`, current language in `.lang-switch` | card |
  | `#contact`, `.audience-icon` (accent-tint) | sunk |
  | `.on-dark` sections | gradient 135deg #691D27 to #440C15. Footer stays `band`, header stays `head`. |
  | White text on dark | on-dark #FFF6ED; secondary text pale |
  | `.label-dark` (rose) and the numbers in `.feature-icon` / `.next-steps` | gold |
  | Rose | stays for the logo accent and the headline underline |
  | Slideshow captions, dots and pause button | white (they sit on photos) |
  | `.mockup*` in the student page's app preview, including its accent-tint pill and progress bar | unchanged: it shows the client app as it looks today |

- **Focus rings:** ink on light surfaces (14.4:1 or more), on-dark on dark (9.5:1 or more).
- Remove the dead role-picker CSS and recompute the contrast comment.
- **Risks:** low contrast between surfaces (cards rely on borders), and the dark gradient behind the white form card. Check at 360, 768 and 1280 px.

### Batch 2: fonts

Files: `landing/public/fonts/`, `partials/head.html`, `style.css`, `landing/vercel.json`.

- Drop Anton. Remove the Google Fonts link and both preconnects.
- Self-host Barlow as Latin woff2 files, with the OFL licence next to them.
- Use `@font-face` with `font-display: swap` and a Latin `unicode-range`.
- Preload only 400 (body) and 800 (H1).
- Add a fallback `@font-face` based on Arial with `size-adjust`, so swapping fonts doesn't shift the layout.
- Long cache headers for `/fonts/` in `vercel.json`, since the file names include the version.
- If you pick a serif (decision 4), add that one family the same way.
- **Risks:** a wrong preload path (preloads need `crossorigin`), and cache headers on files without a hash.

### Batch 3: SEO head, generator, robots, sitemap, JSON-LD, client noindex

Files: `partials/head.html`, `scripts/pages.mjs`, `scripts/build-nl.mjs`, every page `<head>`, `i18n/nl.json`, `landing/public/robots.txt`, `landing/vite.config.js`, `client/index.html`.

- **URLs:**
  - One `SITE_URL` in `pages.mjs`, filled in as `{{site}}`.
  - Canonical and hreflang (en, nl, x-default) absolute on every page, the same three on both languages.
  - The NL canonical points at `/nl/...`.
  - The canonical never includes `?variant=`.
- **Titles and descriptions:** per page and language, from decision 7.
- **Open Graph:** `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` (absolute, 1200x627) with `width`, `height` and `alt`, `og:locale` and `og:locale:alternate`. Plus `twitter:card` = `summary_large_image`.
- **Generator:**
  - `build-nl.mjs` sets the canonical, `og:url`, `og:locale`, `og:locale:alternate` and `og:image` for NL directly.
  - It only translates `og:title`, `og:description` and `og:image:alt`. Today it translates every `og:` tag, which would report URLs as missing translations.
- **JSON-LD:** one language-neutral block on the front page (`/` and `/nl/`):
  ```json
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://mentorbridge.nl/#organization",
        "name": "MentorBridge",
        "url": "https://mentorbridge.nl/",
        "logo": "https://mentorbridge.nl/icon.png",
        "sameAs": ["https://www.linkedin.com/company/146928627/", "https://www.instagram.com/mentorbridgenl/"],
        "areaServed": [{ "@type": "Country", "name": "Netherlands" }, { "@type": "Country", "name": "Belgium" }]
      },
      {
        "@type": "WebSite",
        "@id": "https://mentorbridge.nl/#website",
        "name": "MentorBridge",
        "url": "https://mentorbridge.nl/",
        "inLanguage": ["en", "nl"],
        "publisher": { "@id": "https://mentorbridge.nl/#organization" }
      }
    ]
  }
  ```
  No FAQPage (decision 12), no Review or Rating.
- **robots.txt:** allow all, plus a `Sitemap:` line.
- **sitemap.xml:** all 10 URLs, each with its `xhtml:link` hreflang alternates. Generated from the page list during the build, so it can't drift when pages are added; the generated file is gitignored like `nl/`.
- **`vite.config.js`:** `appType: 'mpa'`, so local 404s match production.
- **`client/index.html`:** `<meta name="robots" content="noindex">`.
- **Headings:** no level is skipped today and Lighthouse finds no vague link text. These H2s don't say what the section is about. Default: rename them, Dutch in `nl.json`:

  | Page | Today | Proposed |
  |---|---|---|
  | `/students/` | From guessing to knowing | How a mentor helps with your internship |
  | `/` | Who are you? | For students, mentors and organizations |
  | `/` | From the waiting list to your first session | How MentorBridge works |
  | `/mentors/` | Your experience is worth passing on | Who can become a mentor |
  | All FAQs | Good to know | Questions and answers |

- **Not touched:** the A/B headline, its markup and its logic.
- **Risks:**
  - hreflang must be absolute and point both ways.
  - LinkedIn caches previews, so refresh them in Post Inspector after the deploy.
  - Inline JSON-LD must pass through Vite unchanged; check it in `dist`.

### Batch 4: image slots, `docs/images.md`, logo and favicons

Files: the pages, `style.css`, `landing/public/images/`, `landing/public/og/`, `landing/og/` (template), `docs/images.md`, `.gitignore` (`docs/images-src/`).

- **Slots, adapted to the branch:**

  | id | where | ratio | export | path |
  |---|---|---|---|---|
  | students-card | front page, "I'm a student" card | 4:3 | 1200x900 + 800x600 WebP | `/images/students-card.webp` |
  | mentors-card | front page, "I want to mentor" card | 4:3 | same | `/images/mentors-card.webp` |
  | organizations-card | front page, "I represent an organization" card | 4:3 | same | `/images/organizations-card.webp` |
  | mentors-hero | `/mentors/` hero (now reuses the team photo `match.jpg`) | 4:3 (decision 9) | 1440x1080, 1080x810, 720x540 WebP + JPG | `/images/mentors-hero.webp` |
  | organizations-hero | `/companies/` hero (now reuses `start.jpg`) | 4:3 | same | `/images/organizations-hero.webp` |
  | og-en, og-nl | link previews, shared by all pages in that language (decision 8) | 1200x627 | JPG under 300 KB | `/og/og-en.jpg`, `/og/og-nl.jpg` |

  The front page hero and the student slideshow keep the team's own photos.
- **Placeholders:** the front page cards get a sunk box at 4:3 until their image exists, so there's no broken-image icon. The hero slots keep the current photo until the new one arrives.
- **Markup:** `<picture>` with `srcset` and `sizes`, `loading="lazy"` below the fold, `width` and `height` on every image. The first slide gets `fetchpriority="high"`.
- **Slides:** WebP in 720, 1080 and 1440 widths, with the JPGs as fallback.
- **Logo and favicons:**
  - Header and footer logo at 112 px (2x of 56), under 20 KB.
  - `favicon-32.png` and a 180x180 `apple-touch-icon.png`. Keep the 512 for manifests.
  - An SVG logo only if the team has a vector original. The repo has none.
- **OG images:** an HTML template in `landing/og/` (photo, logo and headline on a cream or burgundy band, both languages), screenshotted at 1200x627 with headless Chrome, which is installed. No text from the image model.
- **`docs/images.md`:** one row per slot with id, where, ratio, sizes, path, EN alt, NL alt, source (team photo / Gemini / stock + licence) and status. AI images are marked.
- **Image tool:** none is installed (no ImageMagick, ffmpeg, cwebp or Pillow), see decision 10.
- **Risks:**
  - Repo size: the exports add a few MB.
  - Every alt text needs a Dutch entry in `nl.json`.
  - AI images must never sit next to names, quotes or job titles.

### Batch 5: verify and report

- **CI checks:** lint, the 45 tests and the build. The generator must report everything translated.
- **Built pages:** `lang`, title, description, canonical, three absolute hreflang links, OG and Twitter tags, and JSON-LD that parses, on every page in `dist`.
- **Contrast:** a script prints every text and background pair from the tokens.
- **Lighthouse:** mobile, before and after, on the same pages as the baseline table.
- **Screenshots:** at 360, 768 and 1280 px. Desktop Chrome won't make a window narrower than about 500 px, so a plain "360 px" screenshot is a cropped wider page. I'll use device emulation through Chrome's DevTools Protocol, using Node's built-in WebSocket, with no new dependency.
- **Keyboard:** header, menu, language switch, slideshow controls, both forms and the cookie bar, with focus visible on every surface.
- **Still working:**
  - forms post to the local API;
  - `?variant=a` and `?variant=b` render;
  - GoatCounter calls are unchanged;
  - Google stays blocked until Accept;
  - the EN | NL switch keeps the page.

## d) Decisions for you

Each has my recommended default. Reply with the numbers you want to change. Silence means the default.

1. **Base:** build on top of `feature/waitlist-segments`. Default: yes. The alternative is v0.3.4 (`devel`), which means doing everything twice.
2. **Batch 0 first:** fix the header overlap and the privacy text before the segment pages go live. Default: yes.
3. **Domain:** canonical is `https://mentorbridge.nl` without www. `www` already 308s to it. Default: confirmed.
4. **Fonts:** Barlow only, or serif headings? Default: Barlow only for now. See `docs/font-specimen.html`, which shows Barlow next to Fraunces and Newsreader, on cream and on burgundy, with each serif's real italic. Without the mockups I can't say which is closest to them. Fraunces is warmer and heavier and sits closer to the burgundy and cream palette; Newsreader is quieter and more like a newspaper. I left out Playfair Display: it's the most common choice on template sites.
5. **Font files:** commit woff2 files with the OFL licence, or add the `@fontsource/barlow` package? Default: commit the files (no new dependency).
6. **Weight 500:** used only by the hero points. Default: keep all 5 weights (about 15 KB each). Option: show the hero points at 400 and drop one file.
7. **Titles and descriptions** (titles at most 60 characters, descriptions 140-160; lengths counted):

   | Page | Option | Title | Description |
   |---|---|---|---|
   | `/` EN | A (default) | Experienced mentors for student interns \| MentorBridge (54) | MentorBridge matches students with experienced and retiring professionals from their field, so they start their internship ready. Free in our first version. (156) |
   | `/` EN | B | Internship-ready with an experienced mentor \| MentorBridge (58) | Retired and retiring professionals help students get ready for their internship, so their know-how carries on. Join the waiting list. Free for now. (147) |
   | `/` NL | A (default) | Ervaren mentoren voor stagiairs \| MentorBridge (46) | MentorBridge koppelt studenten aan ervaren professionals uit hun vakgebied, zodat ze goed voorbereid aan hun stage beginnen. Gratis in onze eerste versie. (154) |
   | `/` NL | B | Klaar voor je stage met een ervaren mentor \| MentorBridge (57) | Gepensioneerde en ervaren professionals helpen studenten bij hun stage, zodat hun kennis doorgaat. Meld je aan voor de wachtlijst. Nu nog gratis. (145) |
   | `/students/` EN | A ("find", fork B) | Find your internship with a mentor \| MentorBridge (49) | Get matched with an experienced professional from your field who helps you find your internship and prepare for it. Join the waiting list. Free for students. (157) |
   | `/students/` EN | B ("prepare", fork A) | Get ready for your internship with a mentor \| MentorBridge (58) | A mentor from your field helps you prepare for your internship: soft skills, the basics of the job and your first weeks. Join the waiting list. Free. (149) |
   | `/students/` NL | A | Vind je stage met een mentor uit je vakgebied \| MentorBridge (60) | Word gekoppeld aan een ervaren professional uit je vakgebied, die je helpt een stage te vinden en je voor te bereiden. Meld je aan. Gratis voor studenten. (154) |
   | `/students/` NL | B | Goed voorbereid op stage met een mentor \| MentorBridge (54) | Een mentor uit je vakgebied bereidt je voor op je stage: soft skills, de basis van het vak en je eerste weken. Meld je aan voor de wachtlijst. Gratis. (150) |
   | `/mentors/` EN | A (default, current) | What to do after retirement? Mentor a student \| MentorBridge (60) | Wondering what to do after retirement? Pass on your experience to a student from your field in a few hours a month, online or in person. Free to join. (150) |
   | `/mentors/` EN | B | Mentor a student after retirement \| MentorBridge (48) | Retired, about to retire or 55+? Help a student from your field get ready for their internship in a few hours a month, online or in person. Free to join. (153) |
   | `/mentors/` NL | A (default) | Wat te doen na je pensioen? Word mentor \| MentorBridge (54) | Weet je nog niet wat je na je pensioen gaat doen? Geef je ervaring door aan een student uit jouw vakgebied, een paar uur per maand. Gratis aanmelden. (149) |
   | `/mentors/` NL | B | Mentor worden na je pensioen \| MentorBridge (43) | Met pensioen, bijna met pensioen of 55+? Help een student uit jouw vakgebied op weg naar de stage, een paar uur per maand, online of op locatie. (144) |
   | `/companies/` EN | A (default) | Keep know-how when staff retire \| MentorBridge (46) | When experienced staff retire, their know-how leaves with them. Let them mentor your interns first. For medium and large organizations. Free for now. (149) |
   | `/companies/` EN | B | Retiring staff as mentors for your interns \| MentorBridge (57) | Let 1 or 2 experienced or retiring employees mentor your interns, so their know-how stays in your organization. Free during our first version. (142) |
   | `/companies/` NL | A (default) | Kennis behouden bij pensionering \| MentorBridge (47) | Als ervaren medewerkers met pensioen gaan, gaat hun kennis mee. Laat ze eerst je stagiairs begeleiden. Voor middelgrote en grote organisaties. Nu gratis. (153) |
   | `/companies/` NL | B | Ervaren collega's als mentor voor stagiairs \| MentorBridge (58) | Laat 1 of 2 ervaren medewerkers die bijna met pensioen gaan je stagiairs begeleiden, zodat hun kennis in je organisatie blijft. Gratis in onze eerste versie. (157) |

   The student page has no default because the options follow the open "prepare or place" question (context section 15). A is "find an internship" (fork B, and the prompt's own example); B is "get ready" (fork A, closer to version 3's "internship-ready"). The privacy page keeps "Privacy statement | MentorBridge".
8. **OG images:** one per language, shared by all pages, or one per page? Default: one per language for now; per-page images later if LinkedIn posts link straight to segment pages.
9. **Image slots:**
   - Default: the prompt's mentors-card and organizations-card become the front page's audience cards. Students-card is added so all three cards match, cropped from a team photo.
   - Segment heroes in 4:3, to fit the side-by-side hero next to the 4:3 slideshow. Gemini prompts 4 and 6 are written for 16:9 with the person in the right third; a 4:3 crop works if the subject is placed a bit more to the centre. Say if you'd rather have full-width 16:9 heroes, which is a bigger layout change.
10. **Image tool:** nothing is installed. Default: add `sharp` as a dev dependency of `landing`, used only by a local `npm run images` script. The exports are committed, so Vercel doesn't need it. Alternative: a script that drives the installed Chrome. No dependency, but more fragile across the team's machines.
11. **`areaServed`:** default Netherlands and Belgium, matching version 3 and the branch copy. Option: Netherlands only, matching live v0.3.4.
12. **FAQPage schema:** default skip. Google only shows FAQ results for government and health sites.
13. **`.vercel.app` duplicate:** default is a 301 in `landing/vercel.json`, in git and reviewable:
    ```json
    "redirects": [
      { "source": "/:path*", "has": [{ "type": "host", "value": "landing-drab-iota-50.vercel.app" }], "destination": "https://mentorbridge.nl/:path*", "statusCode": 301 },
      { "source": "/:path*", "has": [{ "type": "host", "value": "landing-mentor-bridge2.vercel.app" }], "destination": "https://mentorbridge.nl/:path*", "statusCode": 301 }
    ]
    ```
    Preview deployments have other host names, so they keep working.

    Dashboard route instead: Vercel → project `landing` → Settings → Domains → the `.vercel.app` row → Edit → redirect to `mentorbridge.nl` with 301, if that option shows for the row. Don't rename or remove the `.vercel.app` domain itself; that's what took the API offline on 9 November.
14. **A/B test:** default is to treat the segment deploy date as the start of a new test period and only compare sign-ups after it. With 4 sign-ups there's little to lose. Option: put the v0.3.4 hero lead, points and button text back on `/students/` so the conditions stay the same.
15. **Client app fonts:** the platform app also loads Anton and Barlow from Google. Default: out of scope here, separate small task. Option: self-host Barlow there too in batch 2.
16. **H2 renames** (batch 3 table): default yes.

## What I need from you

- Your answers to the decisions above, or "defaults".
- The 7 mockups in `docs/mockups/`, if you want section b finished.
- After the deploy, these are yours:
  - Search Console verification with a DNS TXT record at GoDaddy, then submit `https://mentorbridge.nl/sitemap.xml`.
  - LinkedIn Post Inspector and Google's Rich Results Test.
  - The `.vercel.app` redirect, if you prefer the dashboard.
  - Generating the Gemini images, using the slot list once it's in `docs/images.md`.
