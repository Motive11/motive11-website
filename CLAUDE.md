<!-- AIOS pointer -->
# motive11.com

Deliverable repo for Motive11's own marketing site, aimed at operators. Brain/context lives in AIOS,
read it before doing work:

**Context:** `C:\Users\marks\AIOS\entities\motive11\` (brand in `brand/`, offers in `context/offers/`,
who the site is for in `C:\Users\marks\AIOS\entities\szymanski-media\context\offer-stack\icps.md`).
Why this site exists separately from markszymanski.co: `C:\Users\marks\AIOS\entities\motive11\context\site-split-map.html`
(November 6, 2026). Build method: `C:\Users\marks\AIOS\pipelines\web-build\`.

## Stack & deploy

Astro + Tailwind on Cloudflare Pages, git-connected, push to `main` deploys. Live at https://motive11.com.
Details in `README.md`.

## Rules for this repo

- **Prices live in `src/lib/pricing.ts`, and the same numbers live in the markszymanski.co repo's
  `src/lib/pricing.ts`.** Mark chose to show prices here (November 6, 2026) knowing it makes a second
  copy. Change both files in the same task until the operator offers leave markszymanski.co.
- **Case studies are written for operators** (problem, what I built, what changed), first person,
  buttoned up. markszymanski.co keeps the longer builder versions; never sync one from the other.
- **Brand colors mirror `AIOS entities/motive11/brand/brand.json`** in `src/styles/global.css`. Change both
  in the same task.
- **Every new page ships with its share image.** `npm run build` makes it in `public/og/`; commit it with
  the page and look at it first. How it works: `README.md`, "Share images".

## Content-Security-Policy: new outside domains go in `public/_headers`

`public/_headers` sends a Content-Security-Policy that allowlists every outside domain the site loads.
**Anything new from another domain (a map, reviews widget, booking or chat embed, video host, font
service, form service) needs its origin added there in the same commit, or it is silently blocked on
the live site.** `astro dev` ignores `_headers`, so it looks fine locally. Test with
`npx wrangler pages dev dist` plus AIOS `pipelines/web-build/check_csp.py`. Standard: AIOS
`pipelines/web-build/security-headers.md`.
