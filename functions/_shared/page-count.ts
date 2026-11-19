/**
 * Writes one row to page_hits, one count to page_hits_daily, and one to page_reads_daily in the
 * shared AIOS D1 (AIOS state/VISITORS.md, "The page count"), each keyed by site, so every one of
 * Mark's sites can write here and the Visitors tab splits them. Identical on every site that runs
 * the ledger (markszymanski.co, motive11.com, hey.motive11.com): change one, copy it to all.
 * Called by _middleware.ts for machines
 * and for page loads outside Europe, and by /api/v for a page view in Europe, which is only counted
 * once the page's script has run (the way Fathom counts), because the server alone cannot tell a
 * person from a script that claims to be a browser: on November 5, 2026 one in Lithuania loaded
 * the homepage 8 times in 3 minutes and was shown as 8 European page views.
 */

import { groupOf } from "./ua";

const HOURLY_CAP = 5000;
const LIVE_BUMP_CAP = 300;
const RETAIN_DAYS = 400;
const SWEEP_ODDS = 200;
const ET_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

export interface Hit {
  site: string;
  path: string;
  country: string;
  ref: string;
  src: string;
  kind: "browser" | "crawler" | "bot";
  agent: string | null;
  anon: 0 | 1;
  asOrg: string | null;
  nav: 0 | 1;
  // Moves the counter an open Work HQ redraws on. Only for a page view by a person that
  // nothing else reports: everyone outside Europe already moves it through /api/v.
  bump: boolean;
}

export async function recordHit(db: D1Database, h: Hit) {
  // Its own counter in visitor_hourly ('YYYY-MM-DDTHHh'), apart from the ledger's, so a crawler
  // flood here can never stop the ledger recording people. /api/v's sweep clears old hours.
  const hour = new Date().toISOString().slice(0, 13) + "h";
  const seen = await db.prepare("SELECT n FROM visitor_hourly WHERE hour = ?").bind(hour).first<{ n: number }>();
  if (seen && seen.n >= HOURLY_CAP) return;

  const grp = groupOf(h.kind, h.agent, h.nav, h.anon);
  const day = ET_DAY.format(new Date());
  const stmts = [
    db.prepare("INSERT INTO visitor_hourly (hour, n) VALUES (?, 1) ON CONFLICT(hour) DO UPDATE SET n = n + 1").bind(hour),
    db.prepare(
      "INSERT INTO page_hits (ts, site, path, country, ref, src, kind, agent, anon, as_org, nav, grp) VALUES (strftime('%Y-%m-%d %H:%M:00', 'now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(h.site, clip(h.path, 200) || null, clip(h.country, 2) || null, clip(h.ref, 100) || null, clip(h.src, 60) || null,
      h.kind, clip(h.agent, 40) || null, h.anon, h.anon ? null : clip(h.asOrg, 80) || null, h.nav, grp),
    // Running totals per Eastern day, so Work HQ reads a few hundred rows instead of every
    // hit on every refresh. Browsers are one bucket per group; crawlers and bots keep their names.
    db.prepare(
      "INSERT INTO page_hits_daily (site, day, grp, agent, anon, n) VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(site, day, grp, agent, anon) DO UPDATE SET n = n + 1"
    ).bind(h.site, day, grp, h.kind === "browser" ? "" : clip(h.agent, 40), h.anon),
    // Which pages each group reads, per day, for "what AI reads" beside "what people read".
    db.prepare(
      "INSERT INTO page_reads_daily (site, day, grp, path, n) VALUES (?, ?, ?, ?, 1) ON CONFLICT(site, day, grp, path) DO UPDATE SET n = n + 1"
    ).bind(h.site, day, grp, clip(h.path, 200) || "/"),
  ];
  if (h.bump && (!seen || seen.n < LIVE_BUMP_CAP)) {
    stmts.push(db.prepare("INSERT INTO live_versions (tbl, v) VALUES ('visitor_events', 1) ON CONFLICT(tbl) DO UPDATE SET v = v + 1"));
  }
  await db.batch(stmts);
  if (Math.random() * SWEEP_ODDS < 1) {
    await db.batch([
      db.prepare(`DELETE FROM page_hits WHERE ts < datetime('now', '-${RETAIN_DAYS} days')`),
      db.prepare(`DELETE FROM page_reads_daily WHERE day < date('now', '-${RETAIN_DAYS} days')`),
    ]);
  }
}
