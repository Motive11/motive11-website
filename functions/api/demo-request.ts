/**
 * POST /api/demo-request: the /demo page's form. Verifies Turnstile, takes a first name, any email, and a
 * company website, and queues one row in the shared AIOS D1 (demo_requests) for the AIOS Demo Builder task
 * (AIOS pipelines/demo-request/README.md), which builds the demo and emails the link. One request per
 * website and per email: asking again answers the same way and builds nothing new. Also subscribes the
 * person to the operator newsletter, the same way /api/newsletter does, because the form says so.
 *
 * Needs the DB binding (production only), TURNSTILE_SECRET_KEY, and the three BENTO_* secrets.
 */
import { currentAudience, subscribeToBento } from "../_shared/bento";

interface Env {
  DB?: D1Database;
  TURNSTILE_SECRET_KEY: string;
  BENTO_PUBLISHABLE_KEY: string;
  BENTO_SECRET_KEY: string;
  BENTO_SITE_UUID: string;
}

const HOURLY_CAP = 10;

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function siteOf(raw: string): { url: string; domain: string } | null {
  const s = raw.trim();
  if (!s || s.length > 300) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(host) || host.endsWith("motive11.com")) return null;
    return { url: `https://${u.hostname.toLowerCase()}${u.pathname === "/" ? "" : u.pathname}`, domain: host };
  } catch {
    return null;
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: { first?: string; email?: string; site?: string; token?: string };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Something went wrong. Please try again." }, 400);
  }

  // Letters only, no periods: the name is printed into an email sent from Mark, and "paypal-login.com"
  // as a name would become a link in it.
  const first = (body.first ?? "").trim().replace(/\s+/g, " ");
  if (!/^\p{L}[\p{L} '-]{0,39}$/u.test(first)) {
    return json({ error: "Just your first name, please." }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: "That email doesn't look right." }, 400);
  }
  const site = siteOf(body.site ?? "");
  if (!site) return json({ error: "That website doesn't look right." }, 400);
  if (!body.token) return json({ error: "Please try again in a moment." }, 400);

  const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: context.env.TURNSTILE_SECRET_KEY,
      response: body.token,
      remoteip: context.request.headers.get("CF-Connecting-IP"),
    }),
  }).then((r) => r.json<{ success: boolean }>()).catch(() => ({ success: false }));
  if (!verify.success) return json({ error: "Verification failed. Please try again." }, 403);

  if (context.env.DB) {
    // Any email is allowed, Gmail included (Mark, November 23, 2026: a real owner may only have one), so
    // nothing ties the email to the website. What bounds abuse: Turnstile, one demo per website and per
    // email, at most HOURLY_CAP new requests an hour across everyone, and the builder's own daily cap.
    // One statement, so parallel submissions can't all pass the check before any of them writes.
    const res = await context.env.DB.prepare(
      `INSERT INTO demo_requests (id, name, email, website, domain)
       SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM demo_requests WHERE domain = ? OR email = ?)
         AND (SELECT COUNT(*) FROM demo_requests WHERE created_at > datetime('now', '-1 hour')) < ?
       ON CONFLICT(domain) DO NOTHING`,
    ).bind(crypto.randomUUID(), first, email, site.url, site.domain, site.domain, email, HOURLY_CAP).run();
    if (!res.meta.changes) {
      const dup = await context.env.DB.prepare("SELECT 1 FROM demo_requests WHERE domain = ? OR email = ?")
        .bind(site.domain, email).first();
      if (!dup) return json({ error: "I'm getting a lot of requests right now. Please try again in an hour." }, 429);
    }
  }

  context.waitUntil((async () => {
    const audience = (await currentAudience(context.env, email)) === "audience:builder" ? "audience:builder" : "audience:operator";
    await subscribeToBento(context.env, {
      email,
      event: "demo_requested",
      fields: { first_name: first, signup_site: "motive11.com", demo_website: site.url },
      tags: [audience, "motive11:demo-requested"],
    });
  })());
  return json({ success: true });
};
