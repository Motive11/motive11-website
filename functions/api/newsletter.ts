/**
 * POST /api/newsletter: the operator newsletter signup (the /newsletter page and the footer form).
 * Verifies Turnstile (the motive11.com widget), then subscribes the person in Szymanski Media's
 * Bento with audience:operator, the tag the operator newsletter's segment is built on. It never
 * asks which audience: a new sign-up here is an operator, but someone already tagged builder stays
 * a builder, because Bento keeps one audience tag per person and nobody needs both newsletters
 * (Mark, November 19, 2026, after a web designer from one of his talks signed up here).
 *
 * Needs TURNSTILE_SECRET_KEY and the three BENTO_* secrets on the Pages project.
 */
import { currentAudience, subscribeToBento } from "../_shared/bento";

interface Env {
  TURNSTILE_SECRET_KEY: string;
  BENTO_PUBLISHABLE_KEY: string;
  BENTO_SECRET_KEY: string;
  BENTO_SITE_UUID: string;
}

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: { email?: string; first_name?: string; token?: string };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Something went wrong. Please try again." }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: "That email doesn't look right." }, 400);
  }
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

  // Bento names fields first_name; strip anything that could break out of a merge tag.
  const firstName = (body.first_name ?? "").replace(/[<>{}"\r\n]/g, "").trim().slice(0, 60);
  const fields: Record<string, string> = { signup_site: "motive11.com" };
  if (firstName) fields.first_name = firstName;

  context.waitUntil((async () => {
    const audience = (await currentAudience(context.env, email)) === "audience:builder" ? "audience:builder" : "audience:operator";
    await subscribeToBento(context.env, { email, event: "$newsletter", fields, tags: [audience] });
  })());
  return json({ success: true });
};
