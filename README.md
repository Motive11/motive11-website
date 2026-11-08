# motive11.com

Motive11's marketing site: the operator-facing home for Mark Szymanski's build work (custom software,
AI systems, and websites for established firms). markszymanski.co stays the home for Mark himself,
his content, and builders; this site links there and never copies its prices.

## Stack

- Astro 7 (static output), Tailwind v4 via `@tailwindcss/vite`, `@astrojs/sitemap`
- Satoshi, self-hosted by Astro's Fonts API from Fontshare at build time
- Cloudflare Pages, git-connected (`Motive11/motive11-website` → Pages project `motive11-website`, which holds motive11.com and www)
- One form of its own: the operator newsletter signup (`src/components/NewsletterForm.astro`, on
  `/newsletter` and in the footer). Booking is the shared widget from the AIOS booking Worker
- Two Pages Functions: `functions/api/v.ts`, the visitor ledger (below), and
  `functions/api/newsletter.ts`, which checks Turnstile (the `motive11.com` widget) and subscribes the
  person in Szymanski Media's Bento with `audience:operator`, never asking. `functions/_shared/bento.ts`
  is a copy of markszymanski.co's; fix a Bento quirk in both

## Pages

| Path | Source |
|---|---|
| `/` | `src/pages/index.astro` |
| `/services` | `src/pages/services.astro`, offers from `src/lib/offers.ts`, prices from `src/lib/pricing.ts` |
| `/fractional`, `/fractional/<industry>` | `src/components/fractional/FractionalPage.astro`, industries in `src/lib/industries.ts`. `/partnership` and old `/work-with-me` links redirect here |
| `/ai-onboarding-day` | `src/pages/ai-onboarding-day.astro` |
| `/testimonials` | `src/pages/testimonials.astro`: every Motive11 testimonial from the testimonials API (entity `motive11` only), linked from the footer |
| `/privacy`, `/cookie-policy`, `/disclaimer` | Termageddon embeds (license motive11.com in Motive11's Termageddon account) in `src/pages/*.astro` via `src/layouts/LegalLayout.astro`. The text is edited in Termageddon, never in the repo |
| `/case-studies`, `/case-studies/<slug>` | `src/content/case-studies/*.md` (schema in `src/content.config.ts`) |
| `/about` | `src/pages/about.astro` |
| `/book`, `/book/<slug>` | `src/pages/book/index.astro`; `public/_redirects` rewrites every booking path to it. The bare `/book` goes home while no booking type is public (`functions/book/index.ts`) |
| `/terms`, `/ai-policy` | `src/pages/*.astro` via `src/layouts/LegalLayout.astro` |

Testimonials are read at build time from `testimonials.markszymanski.co` by id (`src/lib/testimonials.ts`).
A failed fetch drops the quote and the build carries on, so a rebuild picks up edited quotes.

Dark mode is the default; the header toggle stores `light` or `dark` in `localStorage`.

## Share images

Every page shares its own image (since November 8, 2026): Mark's full-body photo on the right, the page's
title and one line on the left, Motive11's charcoal and orange. Same layout as markszymanski.co.
`scripts/og/generate.py` renders them from a built `dist/` into `public/og/<path>.jpg` (3600x1890) with
Playwright from the AIOS venv, reading the colors, logo, and font from AIOS `entities/motive11/brand/brand.json`
and the photo from AIOS `entities/szymanski-media/brand/faces/mark-fullbody.png`. `src/lib/og.ts` makes
`Head.astro` use a page's image when the file exists, else `/og/home.jpg`. Hand-written titles and lines
live in `scripts/og/pages.json`; everything else comes from the page's own title and description.

**New pages get theirs automatically.** A local `npm run build` ends with `scripts/og/postbuild.mjs`, which
runs `generate.py --missing` and lists the images it made. **Commit those files with the page**: Cloudflare
skips this step (no AIOS there), so an uncommitted image never reaches production. Build once more so local
`dist/` points at them. Re-render a card after changing its title or line with
`MSYS_NO_PATHCONV=1 C:/Users/marks/AIOS/.venv/Scripts/python.exe scripts/og/generate.py /that-path`. Pages
nobody shares (legal pages, `/me`, `/book`) go in `SKIP` in `generate.py` and keep the home card, as do
the booking pages under `/book/<slug>`.

## Visitor ledger

The same visitor ledger markszymanski.co runs (AIOS `state/VISITORS.md`): every page view (with utm tags and
the referring site), click, outbound click, form start, and Fathom moment, plus the email from any form the
site accepts, the booking widget's included, so a visitor is tied to a person once they give an email. A
form the server refuses records `Form not accepted` instead and names nobody.

- The browser half is in `src/components/Head.astro` (`mjsTrack`, `mjsEvent`, `mjsIdentify`). It only sends from
  motive11.com itself. Pages fire conversion moments with `window.mjsTrack("Name")`, which reaches Fathom and the
  ledger; the booking widget calls the same function.
- The server half is `functions/api/v.ts` (with `functions/_shared/`). It sets the `m11_vid` cookie (HttpOnly,
  a year) and writes `visitors` and `visitor_events` rows with `site = motive11.com` to the shared AIOS D1
  `aios-state`, so they show up in Mission Control > Sales > Visitors beside markszymanski.co's.
- **Production needs a D1 binding: variable name `DB`, database `aios-state`, on the `motive11-website` Pages
  project's Production environment only.** Without it (previews, `wrangler pages dev`), `/api/v` answers 204
  and writes nothing.
- Kept from markszymanski.co: nobody in Europe is stored or has device details read, machines are labeled
  not dropped, 4 KB bodies, hourly flood caps (its own `visitor_hourly` counter, `YYYY-MM-DDTHHm`), and the
  180-day sweep of anonymous visitors. Not carried over: the server-side page count (`_middleware.ts`,
  `page_hits`), because its daily tables have no site column and Motive11 rows would land in
  markszymanski.co's numbers. Fathom counts this site's totals.
- **The privacy and cookie policies must change in the same task whenever what the ledger records, how long
  it keeps it, or where it skips changes.** Since November 7, 2026 both are Termageddon embeds, so the edit is
  in Termageddon's Review and Override: the Privacy Policy's custom "Visit history" section and the Cookie
  Policy's Essential, Functional, Marketing, and "Your choices" sections are overridden by hand there (they
  no longer auto-update). The hand-written policy this replaced is in git history.

## Develop

```bash
npm install
npm run dev        # astro dev, ignores public/_headers
npm run build
npx wrangler pages dev dist --port 8811   # serves dist with the real headers and redirects
```

## Deploy

Pushing `main` deploys. Pages build settings: build command `npm install --no-audit --no-fund && npm run build`,
output `dist`, env `NODE_VERSION=24` and `SKIP_DEPENDENCY_INSTALL=1` (production and preview).
Production secrets (set November 7, 2026, values from AIOS: the Turnstile widget's secret from the
Cloudflare API, the Bento keys from `entities/szymanski-media/.env`): `TURNSTILE_SECRET_KEY`,
`BENTO_PUBLISHABLE_KEY`, `BENTO_SECRET_KEY`, `BENTO_SITE_UUID`. Without them the newsletter form fails
verification; nothing else depends on them.

**Order for the first Astro deploy (November 2026):** the Pages project is still set up for the old static
site (no build command, output = repo root). Change the build settings above BEFORE merging the Astro
branch to `main`. Merging first publishes a repo root with no `index.html`, and every page, booking
links included, 404s until the settings are fixed. Changing the settings first is safe: a failed build
leaves the current production deploy live.

The Fractional and AI Onboarding Day videos live in Szymanski Media's Bunny Stream library 572643,
which only plays on allowed sites. motive11.com is on that list, so a local preview shows the player but
the video refuses to play. To test video locally, add `127.0.0.1` with `addAllowedReferrer` (AIOS
`connectors/bunny_net`, account key) and remove it again with `removeAllowedReferrer` when done.

Before launch and after any header, hero, or layout change, run from AIOS:
`pipelines/web-build/check_widths.py` on the main pages and `pipelines/web-build/check_csp.py dist`,
and after a push `pipelines/web-build/check_live.py https://motive11.com`.
