/**
 * Runs scripts/og/generate.py --missing after a local `npm run build`, so a page added without a share
 * image gets one the first time it is built. Never fails the build.
 *
 * Skipped on Cloudflare Pages and GitHub Actions: they have no AIOS venv (Playwright, ffmpeg, the
 * brand files), and a file written during a production build is thrown away with the checkout anyway.
 * The images only count once they are committed, which is why the new files are listed loudly at the end.
 */
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PYTHON = process.env.AIOS_PYTHON ?? "C:/Users/marks/AIOS/.venv/Scripts/python.exe";

if (process.env.CI || process.env.CF_PAGES) process.exit(0);
if (!existsSync(PYTHON)) {
  console.log(`\n  Share images: skipped, no AIOS python at ${PYTHON}. New pages keep the home card.\n`);
  process.exit(0);
}

try {
  const out = execFileSync(PYTHON, [join(ROOT, "scripts", "og", "generate.py"), "--missing"], { cwd: ROOT, encoding: "utf-8" });
  const made = out.split("\n").filter((l) => l.includes(" -> "));
  if (made.length) {
    console.log(`\n  Share images: made ${made.length} for pages that had none. Commit them with the page`);
    console.log("  (production builds only see committed files):\n");
    for (const l of made) console.log(`    ${l.split(" -> ")[1]}`);
    console.log("");
  } else {
    console.log(`\n  ${out.trim()}\n`);
  }
} catch (e) {
  console.log(`\n  Share images: generator failed, build is fine. Run scripts/og/generate.py --missing by hand.\n  ${e.message.split("\n")[0]}\n`);
}
