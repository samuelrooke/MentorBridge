# Images

Every image on the landing pages, where it comes from, and the slots that are waiting for one.

## Rules

- Real photos win. The team's own photos stay in the student slideshow and the front page hero.
- Generated images (Gemini) only fill slots without a real photo. Never put names, quotes, job titles or testimonials next to them, and never present them as real users.
- The image model never renders text. Text on the link previews comes from the HTML template.
- Alt text says what's in the picture and why it's there, in under 125 characters, without "image of" or names. Every alt needs a Dutch entry in `landing/i18n/nl.json`.
- Mark AI-generated images in the table below.

## Adding or replacing an image

1. Put the original in `docs/images-src/<slot id>.jpg` (or `.png` / `.webp`). That folder isn't in git.
2. Run `npm run images -w landing`. It crops the image to the slot's ratio and writes the WebP versions (and a JPG for heroes) to `landing/public/images/`.
3. Check the slot's alt text in `landing/scripts/slots.mjs` against the real image, and add the Dutch alt to `landing/i18n/nl.json`.
4. Build (`npm run build -w landing`). The page picks up the new image by itself and stops showing the fallback photo or placeholder.
5. Commit the files in `landing/public/images/` and update the table below.

Link previews: put a background photo in `docs/images-src/og-background.jpg` and run `npm run og -w landing`.

## Slots

| id | where | ratio | export | path | EN alt (for the slot's own image) | NL alt | now showing | source | status |
|---|---|---|---|---|---|---|---|---|---|
| students-card | Front page, "I'm a student" card | 4:3 | 1200x900 + 800x600 WebP | `/images/students-card-{800,1200}.webp` | A student at a kitchen table on a video call with her mentor, taking notes. | Een student aan de keukentafel in een videogesprek met haar mentor, terwijl ze aantekeningen maakt. | Team photo `sign-up.jpg` | Optional: Gemini prompt 4 (cropped to 4:3) | Team photo in use |
| mentors-card | Front page, "I want to mentor" card | 4:3 | 1200x900 + 800x600 WebP | `/images/mentors-card-{800,1200}.webp` | A mentor explains something to a student at a library table. | Een mentor legt een student iets uit aan een tafel in een bibliotheek. | Placeholder (sunk box) | Gemini prompt 1, AI-generated | **Waiting for an image** |
| organizations-card | Front page, "I represent an organization" card | 4:3 | 1200x900 + 800x600 WebP | `/images/organizations-card-{800,1200}.webp` | A site manager in his sixties shows a young intern a drawing on a tablet at a building site. | Een uitvoerder van in de zestig laat een jonge stagiair een tekening op een tablet zien op een bouwplaats. | Team photo `start.jpg` | Gemini prompt 2, AI-generated | Team photo in use |
| mentors-hero | `/mentors/` hero | 4:3 | 1440x1080, 1080x810, 720x540 WebP + 1440 JPG | `/images/mentors-hero-{720,1080,1440}.webp`, `mentors-hero.jpg` | A mentor at home, explaining something to a student on a video call. | Een mentor thuis, die een student iets uitlegt in een videogesprek. | Team photo `match.jpg` | Gemini prompt 6, AI-generated | Team photo in use |
| organizations-hero | `/companies/` hero | 4:3 | same as mentors-hero | `/images/organizations-hero-…` | A team lead in his late fifties walks a young intern through a delivery route in a warehouse. | Een teamleider van eind vijftig loopt met een jonge stagiair een bezorgroute door in een magazijn. | Team photo `start.jpg` | Gemini prompt 3, AI-generated | Team photo in use |
| og-en, og-nl | Link previews (LinkedIn and others), all pages | 1200x627 | JPG under 300 KB | `/og/og-en.jpg`, `/og/og-nl.jpg` | MentorBridge logo and headline next to a photo of an experienced professional shaking hands with a young person. | Logo en kop van MentorBridge naast een foto van een ervaren professional die een jongere de hand schudt. | Template `landing/og-template/og.html` + team photo `match.jpg` | Optional: Gemini prompt 5 as background | In use (64 KB EN, 62 KB NL) |

The Gemini prompts are in the team's prompt document. **Mentor images:** since 11 November the mentor page speaks to people with free time next to their job, not to retirees. Describe the mentor in prompts 1 and 6 as a working professional (for example in their thirties to fifties) rather than someone in their sixties.

## Team photos and other files

| file | where | source | licence | status |
|---|---|---|---|---|
| `slides/sign-up.jpg` (+ 720/1080/1440 WebP) | Student slideshow step 1, fallback for students-card | The team's own photo | TODO: who took it | In use |
| `slides/match.jpg` (+ WebP) | Student slideshow step 2, front page hero, fallback for mentors-hero, link preview background | The team's own photo | TODO: who took it | In use |
| `slides/start.jpg` (+ WebP) | Student slideshow step 3, fallback for organizations-card and organizations-hero | The team's own photo | TODO: who took it | In use |
| `icon.png` (512) | Structured data logo, large favicon | MentorBridge logo | Own | In use |
| `logo-112.png`, `favicon-32.png`, `apple-touch-icon.png` (180) | Header and footer logo, favicons | Made from `icon.png` by `npm run images` | Own | In use |

None of the images on the site are AI-generated yet.
