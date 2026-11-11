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

const CARD_SIZES = '(min-width: 1280px) 340px, (min-width: 768px) 30vw, calc(100vw - 64px)'
const HERO_SIZES = '(min-width: 1280px) 690px, (min-width: 1024px) 55vw, calc(100vw - 32px)'

export const SLOTS = {
  'students-card': {
    where: 'Front page, "I\'m a student" card',
    ratio: [4, 3],
    widths: [800, 1200],
    sizes: CARD_SIZES,
    className: 'card-media',
    alt: 'A student at a kitchen table on a video call with her mentor, taking notes.',
    fallback: { photo: 'sign-up', alt: 'A student typing on a laptop, with notes next to them.' },
  },
  'mentors-card': {
    where: 'Front page, "I want to mentor" card',
    ratio: [4, 3],
    widths: [800, 1200],
    sizes: CARD_SIZES,
    className: 'card-media',
    alt: 'A mentor explains something to a student at a library table.',
    fallback: null,
  },
  'organizations-card': {
    where: 'Front page, "I represent an organization" card',
    ratio: [4, 3],
    widths: [800, 1200],
    sizes: CARD_SIZES,
    className: 'card-media',
    alt: 'A site manager in his sixties shows a young intern a drawing on a tablet at a building site.',
    fallback: { photo: 'start', alt: 'People working at laptops in a bright office with large windows.' },
  },
  'mentors-hero': {
    where: '/mentors/ hero',
    ratio: [4, 3],
    widths: [720, 1080, 1440],
    jpg: true,
    sizes: HERO_SIZES,
    className: 'hero-photo',
    eager: true,
    alt: 'A mentor at home, explaining something to a student on a video call.',
    fallback: { photo: 'match', alt: 'A handshake between an experienced professional and a young person.' },
  },
  'organizations-hero': {
    where: '/companies/ hero',
    ratio: [4, 3],
    widths: [720, 1080, 1440],
    jpg: true,
    sizes: HERO_SIZES,
    className: 'hero-photo',
    eager: true,
    alt: 'A team lead in his late fifties walks a young intern through a delivery route in a warehouse.',
    fallback: { photo: 'start', alt: 'People working at laptops in a bright office with large windows.' },
  },
}
