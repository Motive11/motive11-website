"""Share (Open Graph) images for motive11.com: one per page, Mark's full-body photo on the right, the
page's own title and line on the left, written to public/og/<path>.jpg. Same layout as
markszymanski.co's scripts/og, in Motive11's brand.

src/lib/og.ts makes Head.astro use public/og/<path>.jpg for a page when it exists, else the home card.
Reads titles and descriptions from a built dist/, so run `npm run build` first. Runs with Playwright
from the AIOS venv (no npm dependency added) and reads the brand (colors, logo, font) and the photo
from AIOS, so it only runs on Mark's machine; the site itself builds without AIOS:

    C:/Users/marks/AIOS/.venv/Scripts/python.exe scripts/og/generate.py                   # every page
    C:/Users/marks/AIOS/.venv/Scripts/python.exe scripts/og/generate.py / /case-studies   # the home card, and paths starting with /case-studies
    C:/Users/marks/AIOS/.venv/Scripts/python.exe scripts/og/generate.py --missing         # only pages with no image yet

From Git Bash, prefix MSYS_NO_PATHCONV=1: it otherwise rewrites "/about" into a Windows path, nothing
matches, and the run says every page has an image without rendering anything.

`npm run build` runs the --missing pass by itself (scripts/og/postbuild.mjs); commit the new files in
public/og/ with the page.
"""
from __future__ import annotations

import html
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST, OUT = ROOT / "dist", ROOT / "public" / "og"
TEMPLATE = Path(__file__).with_name("template.html")
OVERRIDES = json.loads(Path(__file__).with_name("pages.json").read_text(encoding="utf-8"))
AIOS = Path(os.environ.get("AIOS_ROOT", "C:/Users/marks/AIOS"))
BRAND = AIOS / "entities" / "motive11" / "brand"
PHOTO = AIOS / "entities" / "szymanski-media" / "brand" / "faces" / "mark-fullbody.png"

COLLECTIONS = {"/case-studies/": "Case study", "/fractional/": "Fractional"}
# Nobody shares these; they keep the home card. /book itself redirects home.
SKIP = {"/ai-policy", "/cookie-policy", "/disclaimer", "/privacy", "/terms", "/me", "/book"}
SUFFIX = re.compile(r"\s*[|\u2014\u2013-]\s*Motive11\s*$")


def brand() -> dict:
    b = json.loads((BRAND / "brand.json").read_text(encoding="utf-8"))
    return {"bg": b["colors"]["bg"], "fg": b["colors"]["fg"], "accent": b["colors"]["orange"],
            "glow": b["backdrop"]["glow"], "font": b["fonts"]["source"],
            "logo": (BRAND / b["logos"]["on_dark"]).as_uri(), "photo": PHOTO.as_uri()}


def pages() -> list[dict]:
    out = []
    for f in sorted(DIST.rglob("index.html")):
        h = f.read_text(encoding="utf-8", errors="ignore")
        t = re.search(r"<title>([^<]*)</title>", h)
        d = re.search(r'<meta name="description" content="([^"]*)"', h)
        rel = f.parent.relative_to(DIST).as_posix()
        out.append({"path": "/" if rel == "." else f"/{rel}", "title": html.unescape(t.group(1)) if t else "",
                    "desc": html.unescape(d.group(1)) if d else ""})
    return out


def first_sentence(text: str, limit: int = 120) -> str:
    # A short opener says nothing alone, so keep adding sentences until the line carries something.
    parts, s = re.split(r"(?<=[.!?])\s", text.strip()), ""
    for part in parts:
        s = f"{s} {part}".strip()
        if len(s) >= 40:
            break
    if len(s) <= limit:
        return s
    return s[:limit].rsplit(" ", 1)[0].rstrip(",;:") + "..."


def card(p: dict) -> dict | None:
    path = p["path"]
    if path in SKIP:
        return None
    o = OVERRIDES.get(path, {})
    tag = next((label for pre, label in COLLECTIONS.items() if path.startswith(pre)), "")
    title = SUFFIX.sub("", p["title"]).strip()
    # The tag already says what kind of page it is, so the title keeps only the name.
    title = re.sub(r"\s+Case Study$", "", title)
    if tag == "Fractional":
        title = re.sub(r"^Fractional AI and Systems Lead:\s*", "", title)
    line = first_sentence(re.sub(r"\s*[\u2014\u2013]\s*", ", ", p["desc"]))
    return {"path": path, "tag": o.get("tag", tag), "title": o.get("title", title), "line": o.get("line", line),
            "home": o.get("home", False), "site": o.get("site")}


def out_file(path: str) -> Path:
    return OUT / ("home.jpg" if path == "/" else f"{path.strip('/')}.jpg")


def main() -> int:
    missing = "--missing" in sys.argv
    prefixes = [a for a in sys.argv[1:] if a != "--missing"]
    cards = [c for c in (card(p) for p in pages()) if c and (not prefixes or any(
        c["path"] == x if x == "/" else c["path"].startswith(x) for x in prefixes))]
    if missing:
        cards = [c for c in cards if not out_file(c["path"]).exists()]
    if not cards:
        print("Share images: every page has one.")
        return 0
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=3)
        page.goto(TEMPLATE.as_uri())
        page.evaluate("b => window.setBrand(b)", brand())
        page.wait_for_load_state("networkidle")
        page.evaluate("() => document.fonts.ready")
        for c in cards:
            page.evaluate("c => window.setCard(c)", c)
            page.wait_for_timeout(60)
            dest = out_file(c["path"])
            dest.parent.mkdir(parents=True, exist_ok=True)
            png = dest.with_suffix(".png")
            page.screenshot(path=str(png))
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(png), "-q:v", "3", str(dest)], check=True)
            png.unlink()
            print(f"{c['path']} -> {dest.relative_to(ROOT).as_posix()}")
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
