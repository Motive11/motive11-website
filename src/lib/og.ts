import fs from "node:fs";
import path from "node:path";

/**
 * The share image for a page: public/og/<path>.jpg when scripts/og/generate.py made one for it,
 * else the home card. Checked at build time, so a page never points at a file that does not exist.
 */
export function ogFor(pathname: string): string {
  const slug = pathname.replace(/^\/+|\/+$/g, "") || "home";
  const rel = `/og/${slug}.jpg`;
  return fs.existsSync(path.join(process.cwd(), "public", rel)) ? rel : "/og/home.jpg";
}
