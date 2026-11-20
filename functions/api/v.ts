/**
 * POST /api/v: Motive11's copy of the visitor ledger that markszymanski.co runs (AIOS
 * state/VISITORS.md explains the whole system). Head.astro sends every page view and every mjsTrack
 * moment here (mjsEvent), the email from any submitted form, the booking widget's included
 * (mjsIdentify), and the private code on a newsletter link (?k=, which names an email-list
 * subscriber). Rows land in the shared AIOS D1 (visitors, visitor_events, visitor_keys) with
 * site = motive11.com, through the DB binding, which only production has; with no binding every
 * request is answered and nothing is written.
 *
 * The visitor's random ID lives in a cookie this function sets (m11v, HttpOnly), not in
 * localStorage, because Safari erases script-written storage after 7 days without a visit and a
 * buying journey runs for months. hey.motive11.com reads the same cookie (Domain=motive11.com). The
 * ID inside it can be the same as markszymanski.co's: a click between the sites, or a background
 * sync once a session, carries it over with a one-time pass (../_shared/handoff.ts).
 *
 * Europe (and an unknown country) is never stored in the ledger and its cookie is cleared
 * (../_shared/no-track.ts); a page view from there becomes an anonymous count in page_hits (page,
 * country, referring site, minute, nothing else, keyed by this site), counted here rather than in
 * _middleware.ts so only a browser that actually ran the page's script is counted. Same block as
 * markszymanski.co's /api/v.
 *
 * Machines are kept and labeled in visitors.bot, never dropped (Mark, November 5, 2026: keep
 * everything, filter on read), so a wrong rule is fixed by reading differently. Each page view also
 * gets an "engage" update when the visitor shows signs of life (scroll, pointer, touch, key), and
 * again when the page is hidden, with time visible and scroll depth; that is the evidence that
 * separates a person from a script that runs JavaScript. Anyone can POST here and the D1 is shared
 * with all of AIOS, so a body is capped at 4 KB, past HOURLY_CAP events in an hour nothing is
 * written at all, and past BOT_HOURLY_CAP nothing from a labeled machine (the count is read first,
 * so a flood costs reads, not writes). Anonymous visitors idle for RETAIN_DAYS are deleted by an
 * occasional sweep on the way out.
 */

import { mayTrack, countryOf } from "../_shared/no-track";
import { HANDOFF_RE, crossSite, foldVisitor, mintHandoff, redeemHandoff, sisterCors } from "../_shared/handoff";
import { machineLabel, deviceOf, browserOf, osOf } from "../_shared/ua";
import { recordHit } from "../_shared/page-count";

interface Env {
  DB?: D1Database;
  ASSETS: Fetcher;
}

// One cookie for motive11.com and hey.motive11.com (Domain=motive11.com), so the two are one visitor
// in every browser, Safari included (November 20, 2026). Each kept its own before (m11_vid here),
// and a browser still carrying that one is moved over on its next request.
const COOKIE = "m11v";
const LEGACY = "m11_vid";
const BODY_MAX = 4096;
const HOURLY_CAP = 3000;
const BOT_HOURLY_CAP = 1000;
const LIVE_BUMP_CAP = 300;
const RETAIN_DAYS = 180;
const SWEEP_ODDS = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// "&" because booking type names can carry one; without it every "Booked ..." event for that
// type was refused on markszymanski.co.
const TYPE_RE = /^[A-Za-z0-9 ()_.:'&-]{1,80}$/;
const KEY_RE = /^[A-Za-z0-9_-]{8,32}$/;
const PV_RE = /^[a-z0-9]{8,24}$/;
const SIZE_RE = /^\d{2,5}x\d{2,5}$/;

// A scraper that runs a real browser and comes from a consumer network, so machineLabel misses it.
// Mirrors botTag in markszymanski.co's functions/api/v.ts and SAN_SALVADOR_SCRAPER in AIOS
// pipelines/site-analytics/sync.py; a person in San Salvador on a phone stays a person.
function botTag(cf: any, device: string): string | null {
  if (cf.city === "San Salvador" && device === "desktop") return "san-salvador-scraper";
  return null;
}

const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

function cookieVal(request: Request, name: string): string | null {
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([0-9a-f-]{36})(?:;|$)`));
  return m ? m[1] : null;
}

// X-Track tells the page this visitor is recorded, so the page only reads device details (screen,
// language, time zone) for visitors outside Europe.
// setCookie may carry several cookies, one per line.
function done(setCookie?: string, tracked = false, hand?: string, cors?: Record<string, string> | null): Response {
  const headers = new Headers({ "Cache-Control": "no-store", ...(cors || {}) });
  for (const c of (setCookie || "").split("\n")) if (c) headers.append("Set-Cookie", c);
  if (tracked) headers.set("X-Track", "1");
  if (hand) headers.set("X-Hand", hand);
  return new Response(null, { status: 204, headers });
}

async function sweep(db: D1Database) {
  const cutoff = `datetime('now', '-${RETAIN_DAYS} days')`;
  await db.batch([
    db.prepare(`DELETE FROM visitor_events WHERE visitor_id IN (SELECT id FROM visitors WHERE email IS NULL AND last_seen < ${cutoff} LIMIT 500)`),
    db.prepare(`DELETE FROM visitors WHERE email IS NULL AND last_seen < ${cutoff} AND NOT EXISTS (SELECT 1 FROM visitor_events e WHERE e.visitor_id = visitors.id)`),
    db.prepare("DELETE FROM visitor_hourly WHERE hour < strftime('%Y-%m-%dT%H', 'now', '-2 days')"),
    db.prepare("DELETE FROM visitor_handoffs WHERE created_at < datetime('now', '-1 day')"),
  ]);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const track = mayTrack(request);
  if (track !== true) {
    if (env.DB) {
      try {
        const text = await request.text();
        const b = text.length <= BODY_MAX ? JSON.parse(text) : null;
        const cf = (request as any).cf || {};
        if (b && b.t === "view" && !machineLabel(request.headers.get("User-Agent") || "", cf.asn)) {
          // The path comes from the POST body, so it is only counted when the site really serves
          // it: otherwise anyone could invent paths and flood page_reads_daily with new rows.
          // Only the cleaned-up pathname is kept, so "/?x=..." or "//x" cannot pass as "/".
          const db = env.DB, here = new URL(request.url);
          let u: URL | null = null;
          try { u = new URL(clip(b.p, 200), here); } catch {}
          waitUntil((async () => {
            if (!u || u.origin !== here.origin) return;
            const path = u.pathname;
            const page = await env.ASSETS.fetch(new URL(path, here.origin), { method: "HEAD" });
            if (page.status !== 200) return;
            await recordHit(db, {
              site: here.hostname.replace(/^www\./, ""), path, country: countryOf(request),
              ref: clip(b.r, 100), src: clip(b.s, 60), kind: "browser", agent: null, anon: 1, asOrg: null, nav: 1, bump: true,
            });
          })().catch(() => {}));
        }
      } catch {}
    }
    return track === false
      ? done(`${COOKIE}=; Domain=motive11.com; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=None\n${LEGACY}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`)
      : done();
  }
  if (!env.DB) return done();

  const ua = request.headers.get("User-Agent") || "";
  const cf = (request as any).cf || {};

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > BODY_MAX) return done();
    body = JSON.parse(text);
    if (!body || typeof body !== "object") return done();
  } catch {
    return done();
  }
  const type = clip(body.t, 80);
  // Mission Control matches "MBS joined" to a Stripe purchase from any site, and it can only happen on
  // markszymanski.co, so a POST of it here could only be someone borrowing a real buyer's identity.
  if (!TYPE_RE.test(type) || type === "MBS joined") return done();
  // SameSite=None (below) lets the other sites' pages read a pass over this cookie, so it would also
  // let any page in the world post here as this visitor (name them, invent events). A request from
  // another origin may therefore only ask for a pass, and only from one of Mark's own sites.
  const cors = sisterCors(request);
  if (crossSite(request) && (!cors || type !== "handoff")) return done();

  const shared = cookieVal(request, COOKIE);
  const legacy = cookieVal(request, LEGACY);
  const existing = shared || legacy;
  // An engage update, a handoff request, or a sync belongs to a page view already recorded, so none
  // of them ever starts a new visitor.
  if ((type === "engage" || type === "handoff" || type === "sync") && !existing) return done(undefined, false, undefined, cors);
  let id = existing || crypto.randomUUID();
  // The old cookie is cleared only once nothing is left to fold from it, so a request that stops
  // early (the hourly cap, a failed write) keeps it and the next one tries again.
  let legacyDone = !!legacy && (!shared || legacy === shared);
  // SameSite=None so this cookie also reaches /api/v when another of Mark's sites asks for a pass.
  const cookieFor = (v: string) =>
    `${COOKIE}=${v}; Domain=motive11.com; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=None` +
    (legacyDone ? `\n${LEGACY}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax` : "");
  let setCookie = cookieFor(id);

  try {
    // Its own counter in visitor_hourly ('YYYY-MM-DDTHHm'), apart from markszymanski.co's
    // ('YYYY-MM-DDTHH') and its page count's ('...h'), so a flood on one site can never stop the
    // other recording people. The sweep's string comparison clears all three shapes.
    const hour = new Date().toISOString().slice(0, 13) + "m";
    const seen = await env.DB.prepare("SELECT n FROM visitor_hourly WHERE hour = ?").bind(hour).first<{ n: number }>();
    if (seen && seen.n >= HOURLY_CAP) return done(setCookie);

    const device = deviceOf(ua);
    // hosting-network is the one soft label: a VPN or iCloud Private Relay (some of it runs over
    // Akamai) puts a real person there for a visit, so a browser ever seen off it is never labeled
    // by it, and one labeled by it is cleared the first time it shows up from anywhere else.
    const label = machineLabel(ua, cf.asn) || botTag(cf, device);
    if (label && seen && seen.n >= BOT_HOURLY_CAP) return done(setCookie);
    const counter = env.DB.prepare(
      "INSERT INTO visitor_hourly (hour, n) VALUES (?, 1) ON CONFLICT(hour) DO UPDATE SET n = n + 1"
    ).bind(hour);

    // Both cookies on one request are the same browser, so the old one's history joins the shared one.
    if (shared && legacy && legacy !== shared) {
      const f = await foldVisitor(env.DB, legacy, shared);
      if (f.stmts.length) await env.DB.batch(f.stmts);
      legacyDone = true;
      setCookie = cookieFor(id);
    }

    // A pass for this browser's ID (../_shared/handoff.ts): asked for by this site's own page when it
    // links to another site, or by another site's page once a session. Not an event: nothing is
    // recorded but the pass.
    if (type === "handoff") {
      if (label) return done(setCookie, true, undefined, cors);
      const m = await mintHandoff(env.DB, id, request);
      await env.DB.batch([counter, m.stmt]);
      return done(setCookie, true, m.token, cors);
    }

    // The page traded another site's pass in the background: this browser takes that site's ID.
    if (type === "sync") {
      const vh = clip(body.vh, 32);
      if (label || !HANDOFF_RE.test(vh)) return done(setCookie, true);
      const r = await redeemHandoff(env.DB, vh, existing, request);
      if (!r) return done(setCookie, true);
      if (r.id !== id) { id = r.id; setCookie = cookieFor(id); }
      await env.DB.batch([counter, ...r.stmts]);
      return done(setCookie, true);
    }

    let joins: D1PreparedStatement[] = [];
    const vh = type === "view" ? clip(body.vh, 32) : "";
    if (HANDOFF_RE.test(vh)) {
      const r = await redeemHandoff(env.DB, vh, existing, request);
      if (r) {
        joins = r.stmts;
        if (r.id !== id) { id = r.id; setCookie = cookieFor(id); }
      }
    }

    if (type === "engage") {
      const pv = clip(body.pv, 24);
      if (!PV_RE.test(pv)) return done(setCookie, true);
      const num = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
      const alive = body.a ? 1 : 0;
      const up = [counter, env.DB.prepare(
        "UPDATE visitor_events SET alive = max(coalesce(alive, 0), ?), active_s = max(coalesce(active_s, 0), ?), scroll = max(coalesce(scroll, 0), ?), load_ms = coalesce(load_ms, nullif(?, 0)) WHERE visitor_id = ? AND pv = ? AND type = 'view'"
      ).bind(alive, num(body.as, 3600), num(body.sc, 100), num(body.ld, 120000), id, pv)];
      if (alive) up.push(env.DB.prepare("UPDATE visitors SET alive = 1, last_seen = datetime('now') WHERE id = ?").bind(id));
      const scr = clip(body.scr, 11), vp = clip(body.vp, 11);
      if (SIZE_RE.test(scr) || SIZE_RE.test(vp)) {
        up.push(env.DB.prepare(
          "UPDATE visitors SET screen = coalesce(?, screen), viewport = coalesce(?, viewport), lang = coalesce(?, lang), tz = coalesce(?, tz), webdriver = max(coalesce(webdriver, 0), ?) WHERE id = ?"
        ).bind(SIZE_RE.test(scr) ? scr : null, SIZE_RE.test(vp) ? vp : null, clip(body.lang, 35) || null, clip(body.tz, 60) || null, body.wd ? 1 : 0, id));
      }
      await env.DB.batch(up);
      return done(setCookie, true);
    }

    const stmts = [
      counter,
      ...joins,
      env.DB.prepare(
        "INSERT INTO visitors (id, country, device, bot, ua, browser, os) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_seen = datetime('now'), country = excluded.country, device = excluded.device, bot = CASE WHEN visitors.bot IS NULL THEN nullif(excluded.bot, 'hosting-network') WHEN visitors.bot = 'hosting-network' THEN excluded.bot ELSE visitors.bot END, ua = excluded.ua, browser = excluded.browser, os = excluded.os"
      ).bind(id, clip(cf.country, 2) || null, device, label, clip(ua, 300) || null, browserOf(ua), osOf(ua)),
    ];
    let detail = clip(body.d, 200);
    // A later form's email re-ties the browser (someone who browsed as a Gmail and booked with a work
    // address: the booking must carry that path, AIOS state/VISITORS.md). Except three ties that are
    // facts, never replaced: a Stripe-proven email ('mbs-join'), one tied by hand ('manual...'), and
    // Mark's own addresses (HIDDEN in Mission Control's src/data/journeys.js; keep the two in step),
    // or his own test bookings rename his browsers (November 7, 2026).
    if (type === "identify") {
      const email = clip(body.e, 200).trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return done(setCookie);
      stmts.push(env.DB.prepare(
        "UPDATE visitors SET email = ?, identified_at = datetime('now'), identified_via = ? WHERE id = ? AND (email IS NULL OR (identified_via <> 'mbs-join' AND identified_via NOT LIKE 'manual%' AND email NOT IN ('mark@motive11.com', 'me@markszymanski.co')))"
      ).bind(email, detail || null, id));
      detail = `${email} via ${detail}`.slice(0, 200);
    }
    // A newsletter link's ?k= names a subscriber (AIOS state/visitor_keys.py). It only names a
    // browser nobody has named yet: a forwarded newsletter clicked by someone already known must
    // not turn them into the original subscriber.
    const key = type === "view" ? clip(body.k, 32) : "";
    let keyEmail: string | null = null;
    if (KEY_RE.test(key)) {
      const hit = await env.DB.prepare("SELECT email FROM visitor_keys WHERE key = ?").bind(key).first<{ email: string }>();
      keyEmail = hit ? hit.email : null;
    }
    if (keyEmail) {
      stmts.push(env.DB.prepare(
        "UPDATE visitors SET email = ?, identified_at = datetime('now'), identified_via = 'newsletter' WHERE id = ? AND (email IS NULL OR identified_via = 'device-match')"
      ).bind(keyEmail, id));
    }
    stmts.push(env.DB.prepare(
      "INSERT INTO visitor_events (visitor_id, site, type, path, source, medium, campaign, referrer, detail, pv, title, city, region, asn, as_org, content, term) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id, new URL(request.url).hostname.replace(/^www\./, ""), type, clip(body.p, 200) || null,
      clip(body.s, 60) || null, clip(body.m, 60) || null, clip(body.c, 60) || null, clip(body.r, 100) || null, detail || null,
      type === "view" && PV_RE.test(clip(body.pv, 24)) ? clip(body.pv, 24) : null, type === "view" ? clip(body.ti, 120) || null : null,
      clip(cf.city, 80) || null, clip(cf.region, 80) || null, Number(cf.asn) || null, clip(cf.asOrganization, 80) || null,
      clip(body.ct, 80) || null, clip(body.tm, 80) || null));
    // Mission Control polls live_versions and refetches the Visitors tab when this counter moves
    // (AIOS state/mission-control-worker/README.md, "Live updates"). Each refetch reads the last
    // 30 days of events, so past LIVE_BUMP_CAP events in an hour the counter stops moving and a
    // flood cannot turn an open dashboard into billions of row reads.
    if (!label && (!seen || seen.n < LIVE_BUMP_CAP)) {
      stmts.push(env.DB.prepare(
        "INSERT INTO live_versions (tbl, v) VALUES ('visitor_events', 1) ON CONFLICT(tbl) DO UPDATE SET v = v + 1"
      ));
    }
    await env.DB.batch(stmts);

    if (Math.random() * SWEEP_ODDS < 1) waitUntil(sweep(env.DB).catch(() => {}));
  } catch {
    // the ledger must never break a page; a failed write is a lost row, nothing more
    return done(setCookie);
  }
  return done(setCookie, true);
};
