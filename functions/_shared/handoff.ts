/**
 * One visitor ID across Mark's sites (AIOS state/VISITORS.md, "One visitor across all the sites").
 * Each domain keeps its own cookie, so the ID crosses over with a one-time pass the other site
 * trades for the same ID: on a link click (?vh=), and once a session in the background, where the
 * page asks the other site's /api/v for a pass over the cookie it already holds (a cross-site
 * request, so it only works where the browser sends third-party cookies, Chrome and Edge as of
 * November 2026, never Safari or Firefox). Used by functions/api/v.ts. IDENTICAL on all three
 * sites (markszymanski.co, motive11.com, hey.motive11.com): change every copy together.
 *
 * Why a pass and never the ID itself: a URL gets copied and shared, and an ID in it would turn
 * whoever opened the shared link into the same person. A pass works once, only within TTL_MIN, only
 * for the browser that asked for it (same IP and User-Agent, stored as a hash salted with the pass,
 * never raw), and the page takes it out of the address bar on arrival. The browser check is what
 * stops a forwarded or forged pass from merging two people; a real click between the sites is the
 * same browser seconds later. Private Relay can give the two sites different IPs, and then the pass
 * is simply refused: two rows, never a wrong merge.
 */

export const HANDOFF_RE = /^[0-9a-f]{32}$/;
const TTL_MIN = 30;

// The pages allowed to ask for a pass from another of these sites. A new site joins here, in every copy.
const SITES = [
  "https://markszymanski.co", "https://www.markszymanski.co",
  "https://motive11.com", "https://www.motive11.com", "https://hey.motive11.com",
];

/** True when the request came from a page on another origin (browsers send Origin on every POST). */
export function crossSite(request: Request): boolean {
  const o = request.headers.get("Origin");
  return !!o && o !== new URL(request.url).origin;
}

/**
 * Headers that let one of the other sites read the pass, or null when the asking page is not one of
 * Mark's. Without them the browser hides the answer from the page, so no stranger's page can learn a
 * pass for a visitor.
 */
export function sisterCors(request: Request): Record<string, string> | null {
  const o = request.headers.get("Origin");
  if (!o || !SITES.includes(o) || !crossSite(request)) return null;
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": "X-Hand, X-Track",
    Vary: "Origin",
  };
}

const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

async function browserHash(token: string, request: Request): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ua = request.headers.get("User-Agent") || "";
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${token}|${ip}|${ua}`)));
}

export async function mintHandoff(db: D1Database, visitorId: string, request: Request): Promise<{ token: string; stmt: D1PreparedStatement }> {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  const token = hex(b);
  const fp = await browserHash(token, request);
  return { token, stmt: db.prepare("INSERT INTO visitor_handoffs (token, visitor_id, fp) VALUES (?, ?, ?)").bind(token, visitorId, fp) };
}

type Row = {
  id: string; email: string | null; identified_at: string | null; identified_via: string | null; first_seen: string;
  alive: number | null; webdriver: number | null;
};

/**
 * The ID this browser should carry from now on, plus the writes that fold its old ID into it.
 * Null when the pass is unknown, used, expired, or from another browser, so the caller carries on
 * exactly as before.
 * Two IDs that each have a different email stay apart: those are two people, whatever the link says.
 */
export async function redeemHandoff(
  db: D1Database,
  token: string,
  current: string | null,
  request: Request,
): Promise<{ id: string; stmts: D1PreparedStatement[] } | null> {
  const hit = await db
    .prepare(`SELECT visitor_id FROM visitor_handoffs WHERE token = ? AND fp = ? AND used_at IS NULL AND created_at > datetime('now', '-${TTL_MIN} minutes')`)
    .bind(token, await browserHash(token, request))
    .first<{ visitor_id: string }>();
  if (!hit) return null;
  const used = db.prepare("UPDATE visitor_handoffs SET used_at = datetime('now') WHERE token = ? AND used_at IS NULL").bind(token);
  const r = await foldVisitor(db, current, hit.visitor_id);
  return { id: r.id, stmts: [used, ...r.stmts] };
}

/**
 * Fold one browser's ID into another that is proven to be the same browser (a redeemed pass, or both
 * cookies arriving on one request). Returns the ID to carry and the writes; no writes when there is
 * nothing to join. Two IDs that each have a different email stay apart: those are two people.
 */
export async function foldVisitor(
  db: D1Database,
  current: string | null,
  target: string,
): Promise<{ id: string; stmts: D1PreparedStatement[] }> {
  if (!current || current === target) return { id: target, stmts: [] };

  const { results } = await db
    .prepare("SELECT id, email, identified_at, identified_via, first_seen, alive, webdriver FROM visitors WHERE id IN (?, ?)")
    .bind(current, target)
    .all<Row>();
  const cur = results.find((r) => r.id === current);
  const tgt = results.find((r) => r.id === target);
  // The other row was swept in the meantime: nothing to join, keep this browser's own.
  if (!tgt) return { id: current, stmts: [] };
  if (!cur) return { id: target, stmts: [] };
  if (cur.email && tgt.email && cur.email !== tgt.email) return { id: current, stmts: [] };

  // Every write checks the target still exists when it runs: two sites syncing toward each other at
  // the same moment would otherwise each fold into a row the other just deleted, and lose both.
  const stmts = [
    db.prepare("UPDATE visitor_events SET visitor_id = ? WHERE visitor_id = ? AND EXISTS (SELECT 1 FROM visitors WHERE id = ?)")
      .bind(target, current, target),
    db.prepare(
      "UPDATE visitors SET first_seen = min(first_seen, ?), alive = max(coalesce(alive, 0), ?), webdriver = max(coalesce(webdriver, 0), ?) WHERE id = ?"
    ).bind(cur.first_seen, cur.alive || 0, cur.webdriver || 0, target),
  ];
  // A Stripe-matched email ('mbs-join') is never replaced by a form's (every site's v.ts), so
  // when the folded-in row carries that proof it comes along with the email.
  if (cur.email && (!tgt.email || (cur.identified_via === "mbs-join" && tgt.identified_via !== "mbs-join"))) {
    stmts.push(
      db.prepare("UPDATE visitors SET email = ?, identified_at = ?, identified_via = ? WHERE id = ?")
        .bind(cur.email, cur.identified_at, cur.identified_via, target),
    );
  }
  stmts.push(db.prepare("DELETE FROM visitors WHERE id = ? AND EXISTS (SELECT 1 FROM visitors WHERE id = ?)").bind(current, target));
  return { id: target, stmts };
}
