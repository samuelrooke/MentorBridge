# Tagging links (UTM)

Every sign-up stores where the visitor came from, so we can see which channel works. That only works if everyone tags links the same way. Use these names, in lowercase, exactly as written.

## How a tagged link looks

```
https://mentorbridge.nl/mentors/?utm_source=linkedin&utm_medium=social&utm_campaign=retirement-week1
```

- **Page:** link to the page for the group you're talking to: `/students/`, `/mentors/` or `/companies/`. Dutch versions: `/nl/students/`, `/nl/mentors/`, `/nl/companies/`.
- **utm_source:** where the link is (the list below).
- **utm_medium:** what kind of link it is (the list below).
- **utm_campaign:** free text for the post or action, lowercase with dashes, e.g. `retirement-week1`, `golf-zoetermeer`, `uwv-pilot`.

## utm_source

| Value | Use for |
|---|---|
| `linkedin` | LinkedIn posts, comments, DMs and the company page |
| `instagram` | Instagram posts, stories and bio |
| `golf` | Golf clubs: flyers and QR codes |
| `uwv` | Anything through UWV |
| `event` | Career fairs, company events, presentations (QR codes) |
| `email` | Emails we send ourselves |
| `school` | Links shared through schools and teachers |
| `google` | Google Ads, only if we run ads |

## utm_medium

| Value | Use for |
|---|---|
| `social` | A normal post or story |
| `dm` | A direct message |
| `qr` | A printed QR code |
| `email` | An email |
| `paid` | A paid ad |

## Examples

| Situation | Link |
|---|---|
| LinkedIn post for retirees | `/mentors/?utm_source=linkedin&utm_medium=social&utm_campaign=what-after-retirement` |
| DM to someone who reacted | `/mentors/?utm_source=linkedin&utm_medium=dm&utm_campaign=pension-replies` |
| QR code on a golf club flyer | `/nl/mentors/?utm_source=golf&utm_medium=qr&utm_campaign=golf-flyer` |
| QR code at a company event | `/companies/?utm_source=event&utm_medium=qr&utm_campaign=event-name` |
| Instagram bio for students | `/students/?utm_source=instagram&utm_medium=social&utm_campaign=bio` |

## What gets stored

With each sign-up: `utm_source`, `utm_medium`, `utm_campaign`, the referring site (host name only, e.g. `www.linkedin.com`) and the first page of the visit. The tags are kept for the browser session, so they still count if the visitor clicks around before signing up. This is described on the privacy page.

## Conversion per segment

GoatCounter (https://mentorbridge.goatcounter.com) counts:

- page views per page: `/students/`, `/mentors/`, `/companies/` and the `/nl/` versions,
- `form-start-student`, `form-start-mentor`, `form-start-company`: someone started filling in the form,
- `signup-student`, `signup-mentor`, `signup-company`: the sign-up was saved.

Conversion for a segment = `signup-<segment>` ÷ views of that segment's English and Dutch page. A good result is 1-3%.
