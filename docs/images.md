
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
| organizations-card | Front page, "I represent a company" card | 4:3 | 1200x900 + 800x600 WebP | `/images/organizations-card-{800,1200}.webp` | A smiling professional with crossed arms in an office, with colleagues in a meeting behind him. | Een lachende professional met de armen over elkaar in een kantoor, met collega's in een vergadering achter hem. | Own image (cropped from the top, `position: 'north'`) | **TODO:** source and licence of `companies.jpeg` unknown. Stock or AI-generated? Record it here. | In use, but only 500x750: soft at full size. Replace with a larger original. |
| organizations-hero | `/companies/` hero | 4:3 | same as mentors-hero | `/images/organizations-hero-…` | A team lead in his late fifties walks a young intern through a delivery route in a warehouse. | Een teamleider van eind vijftig loopt met een jonge stagiair een bezorgroute door in een magazijn. | Team photo `start.jpg` | Gemini prompt 3, AI-generated | Team photo in use |
| og-en, og-nl | Link previews (LinkedIn and others), all pages | 1200x627 | JPG under 300 KB | `/og/og-en.jpg`, `/og/og-nl.jpg` | MentorBridge logo and headline next to a photo of an experienced professional shaking hands with a young person. | Logo en kop van MentorBridge naast een foto van een ervaren professional die een jongere de hand schudt. | Template `landing/og-template/og.html` + team photo `match.jpg` | Optional: Gemini prompt 5 as background | In use (64 KB EN, 62 KB NL) |

The Gemini prompts are in the team's prompt document. **Mentor images:** since 11 November the mentor page speaks to people with free time next to their job, not to retirees. Describe the mentor in prompts 1 and 6 as a working professional (for example in their thirties to fifties) rather than someone in their sixties.

## Slideshows on the mentor and companies pages

Same 3-step slideshow as the student page. Originals in `docs/images-src/slides/<name>.jpg`, cropped to 4:3 by `npm run images -w landing` (crop positions in `SLIDE_CROPS`, `landing/scripts/slots.mjs`). All are Pexels stock photos (Pexels License), not AI-generated. company-2 and company-3 are large originals (Pexels 7793743 and 12903173); the mentor photos are 500 px wide and look a bit soft on large screens.

| file | page, step | alt |
|---|---|---|
| `slides/mentor-1` | /mentors/, step 1 | An experienced mentor with a white beard helps a young woman with her work at a desk. |
| `slides/mentor-2` | /mentors/, step 2 | An experienced professional with glasses working on a laptop at home. |
| `slides/mentor-3` | /mentors/, step 3 | An experienced professional in a white blouse in a bright office. |
| `slides/company-1` | /companies/, step 1 | Two professionals at work at a shared desk, one on the phone and one taking notes. |
| `slides/company-2` | /companies/, step 2 | A team at work in a bright office, with colleagues talking in the doorway. |
| `slides/company-3` | /companies/, step 3 | An experienced colleague shows a young employee something on his screen in an open office. |

## Team photos and other files

| file | where | source | licence | status |
|---|---|---|---|---|
| `slides/sign-up.jpg` (+ 720/1080/1440 WebP) | Student slideshow step 1, fallback for students-card | The team's own photo | TODO: who took it | In use |
| `slides/match.jpg` (+ WebP) | Student slideshow step 2, front page hero, fallback for mentors-hero, link preview background | The team's own photo | TODO: who took it | In use |
| `slides/start.jpg` (+ WebP) | Student slideshow step 3, fallback for organizations-card and organizations-hero | The team's own photo | TODO: who took it | In use |
| `icon.png` (512) | Structured data logo, large favicon | MentorBridge logo | Own | In use |
| `logo-112.png`, `favicon-32.png`, `apple-touch-icon.png` (180) | Header and footer logo, favicons | Made from `icon.png` by `npm run images` | Own | In use |

No image on the site is AI-generated: all photos are the team's own or Pexels stock photos. Spare: `docs/images-src/spare-intern-clipboard.jpg` (young man with a clipboard in a meeting, Pexels), not used yet.
