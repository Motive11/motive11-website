/**
 * Counts every page the site serves, from the server's side, into page_hits in the shared AIOS D1
 * (AIOS state/VISITORS.md, "The page count"), through ./_shared/page-count.ts. Identical on every
 * site that runs the ledger, with nothing site-specific in it (the site is the request's own host),
 * so a new domain gets the page count by copying it over: change one, copy it to all. This is the record
 * of machines that never run JavaScript, the AI crawlers included, recorded by name, and of every
 * page load outside Europe, so it can be checked against the visitor ledger (/api/v). A real page
 * load in Europe is NOT counted here: /api/v counts it once the page's script has run, because a
 * script claiming to be a browser looks identical from here (see page-count.ts for the one that
 * did). Anything claiming to be a browser without saying it is loading a page is kept as
 * "unconfirmed", in Europe too, so the junk is counted and never mistaken for people.
 *
 * It never changes the response and never delays it (the write runs after, in waitUntil), and a
 * failure is a lost count, nothing more. Prefetches are skipped, since nobody saw that page.
 *
 * public/_routes.json keeps every Function, this one included, off /_astro, /images, /fonts, and
 * /og, so the files a page loads never pass through one. A Function added under those paths would
 * never run. Checked locally November 5, 2026: with this middleware in front, _headers and
 * _redirects still apply to the pages it passes through (Cloudflare's docs don't say either way).
 */

import { mayTrack, countryOf } from "./_shared/no-track";
import { machineLabel, browserOf } from "./_shared/ua";
import { recordHit } from "./_shared/page-count";

interface Env {
  DB?: D1Database;
}

async function count(db: D1Database, request: Request) {
  const url = new URL(request.url);
  const cf = (request as any).cf || {};
  const ua = request.headers.get("User-Agent") || "";
  const country = countryOf(request);
  const anon = mayTrack(request) === true ? 0 : 1;
  const label = machineLabel(ua, cf.asn);
  const kind = !label ? "browser" : label.startsWith("crawler:") ? "crawler" : "bot";
  const nav = request.headers.get("Sec-Fetch-Dest") === "document" ? 1 : 0;
  // A real page load in Europe is counted by /api/v once its script runs. One that never said it
  // was loading a page is kept here as "unconfirmed" (nothing personal in it), never as a person.
  if (kind === "browser" && anon && nav) return;
  let ref = "";
  try {
    const r = request.headers.get("Referer");
    if (r) ref = new URL(r).hostname.replace(/^www\./, "");
    if (ref === url.hostname.replace(/^www\./, "")) ref = "";
  } catch {}
  await recordHit(db, {
    site: url.hostname.replace(/^www\./, ""),
    path: url.pathname,
    country,
    ref,
    src: url.searchParams.get("utm_source") || url.searchParams.get("ref") || "",
    kind,
    agent: kind === "crawler" ? label!.slice(8) : kind === "bot" ? label : anon ? null : browserOf(ua),
    anon,
    asOrg: cf.asOrganization || null,
    nav,
    bump: false,
  });
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next, waitUntil }) => {
  const res = await next();
  try {
    const host = new URL(request.url).hostname.replace(/^www\./, "");
    const purpose = (request.headers.get("Sec-Purpose") || request.headers.get("Purpose") || "").toLowerCase();
    if (
      env.DB && !host.endsWith(".pages.dev") && host !== "localhost" && request.method === "GET" && res.status === 200 &&
      (res.headers.get("Content-Type") || "").includes("text/html") && !purpose.includes("prefetch")
    ) {
      waitUntil(count(env.DB, request).catch(() => {}));
    }
  } catch {}
  return res;
};
