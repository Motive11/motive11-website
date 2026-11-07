/**
 * The bare /book page lists this brand's public booking types (AIOS state/booking-worker). Every
 * type has been hidden since November 7, 2026, and an empty list only says "This link isn't active",
 * so the page sends people home while nothing is public and comes back by itself once a type is
 * made public again. Only the bare address: /book/<slug>, /book/l/<token>, and /book/manage/<token>
 * never reach this (public/_redirects serves them). The same file is on both sites; change both.
 */

export const onRequestGet: PagesFunction = async ({ request, next }) => {
  try {
    const r = await fetch("https://book.motive11.com/types?entity=motive11", { cf: { cacheTtl: 60, cacheEverything: true } });
    const { types } = (await r.json()) as { types?: unknown[] };
    if (r.ok && Array.isArray(types) && types.length === 0) return Response.redirect(new URL("/", request.url).toString(), 302);
  } catch {
    // The booking Worker unreachable: show the page as before rather than guess.
  }
  return next();
};
