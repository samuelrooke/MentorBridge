// Image slots: places on the pages that are waiting for a photo.
// A page marks a slot with <!-- @image id -->. When building, pages.mjs fills it in with:
//   1. the slot's own image, if public/images/<id>-<width>.webp exists for every width;
//   2. otherwise the fallback, one of the team's photos in public/slides/;
//   3. otherwise a placeholder: a sunk-coloured box at the right ratio.
// To add an image: put the original in docs/images-src/<id>.jpg (or .png/.webp), run
// `npm run images -w landing`, then check the alt text here and its Dutch entry in i18n/nl.json.
// docs/images.md lists every slot with its source and status.

// Widths of the WebP versions made from the team photos in public/slides/.
export const PHOTO_WIDTHS = [720, 1080, 1440]

// Slideshow photos for the mentor and companies pages. Originals in docs/images-src/slides/<name>.jpg,
// fitted to 4:3 into public/slides/<name>.jpg by `npm run images`. contain: whole photo on a blurred backdrop; cover: crop.
export const SLIDE_CROPS = {
  'student-1': 'cover',
  'mentor-1': 'contain',
  'mentor-2': 'contain',
  'mentor-3': 'contain',
  'company-1': 'cover',
  'company-2': 'cover',
  'company-3': { top: 0.3 },
}

const CARD_SIZES = '(min-width: 1280px) 340px, (min-width: 768px) 30vw, calc(100vw - 64px)'
const HERO_SIZES = '(min-width: 1280px) 690px, (min-width: 1024px) 55vw, calc(100vw - 32px)'

export const SLOTS = {
  'students-card': {
    where: 'Front page, "I\'m a student" card',
    ratio: [4, 3],
    widths: [800, 1200],
    sizes: CARD_SIZES,
    className: 'card-media',
    alt: 'A smiling student holding notebooks in a school hallway, with classmates behind her.',
    position: 'north',
    fallback: { photo: 'sign-up', alt: 'A student typing on a laptop, with notes next to them.' },
  },
  'mentors-card': {
    where: 'Front page, "I want to mentor" card',
    ratio: [4, 3],
    widths: [800, 1200],
    sizes: CARD_SIZES,
    className: 'card-media',
    alt: 'An experienced professional with glasses working on a laptop at home.',
    // The current original is a portrait photo: crop from the top so the face stays in. Check when replacing it.
    position: 'north',
    fallback: null,
  },
  'organizations-card': {
    where: 'Front page, "I represent an organization" card',
    ratio: [4, 3],
    widths: [800, 1200],
    sizes: CARD_SIZES,
    className: 'card-media',
    alt: 'A smiling young professional in an office, with colleagues working behind her.',
    // Portrait original: crop from the centre so her face and the team stay in. Check when replacing it.
    position: 'centre',
    fallback: { photo: 'start', alt: 'People working at laptops in a bright office with large windows.' },
  },
}
