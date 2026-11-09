"""Recordings for the home page showcase: a few seconds of each client site's live home page hero while
its own background video plays. No scrolling: a captured scroll judders (the screencast delivers frames
unevenly), and Mark rejected it on November 9, 2026. Only sites whose hero moves are here; the rest stay
stills in index.astro. Writes the still (src/assets/showcase/<slug>.webp, the
recording's first frame) and uploads the silent MP4 to R2 as motive11-media/showcase/<slug>-v<N>.mp4,
served at media.motive11.com. src/pages/index.astro points at those URLs.

Runs with Playwright from the AIOS venv and the Cloudflare token in AIOS state/.env, so it only runs on
Mark's machine:

    C:/Users/marks/AIOS/.venv/Scripts/python.exe scripts/showcase/record.py v3 --version 2
    C:/Users/marks/AIOS/.venv/Scripts/python.exe scripts/showcase/record.py --all --version 2 --no-upload

Then bump that site's -v<N> in index.astro and commit the new still with it.
"""
from __future__ import annotations

import argparse
import base64
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parents[2]
AIOS = Path("C:/Users/marks/AIOS")

SITES = {
    "v3": "https://valiant3communications.com",
    "qcl": "https://qualitychoicelandscaping.com",
    "bshf": "https://thebusstopsherefoundation.org",
}
SECONDS = 6

W, H, DSF = 1440, 900, 2

def capture(url: str, frames: Path) -> list[float]:
    stamps: list[float] = []
    with sync_playwright() as p:
        # Chrome, not Playwright's Chromium: Chromium ships without H.264, so the sites' mp4 heroes never play.
        browser = p.chromium.launch(channel="chrome", headless=True,
                                    args=["--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"])
        ctx = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=DSF)
        page = ctx.new_page()
        page.goto(url, wait_until="load", timeout=60000)
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        page.wait_for_timeout(2500)

        # CDP screencast instead of Playwright's record_video, whose fixed low-bitrate VP8 blurs small text.
        cdp = ctx.new_cdp_session(page)

        def on_frame(ev):
            (frames / f"{len(stamps):05d}.jpg").write_bytes(base64.b64decode(ev["data"]))
            stamps.append(ev["metadata"]["timestamp"])
            cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})

        cdp.on("Page.screencastFrame", on_frame)
        cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": W * DSF,
                                          "maxHeight": H * DSF, "everyNthFrame": 1})
        page.wait_for_timeout(SECONDS * 1000)
        cdp.send("Page.stopScreencast")
        page.wait_for_timeout(300)
        browser.close()
    return stamps


def encode(frames: Path, stamps: list[float], mp4: Path) -> None:
    # The screencast only sends a frame when the page changes, so each frame keeps its real duration.
    lines = []
    for i, ts in enumerate(stamps):
        dur = stamps[i + 1] - ts if i + 1 < len(stamps) else 0.5
        lines += [f"file '{i:05d}.jpg'", f"duration {max(dur, 0.001):.4f}"]
    lines.append(f"file '{len(stamps) - 1:05d}.jpg'")
    (frames / "list.txt").write_text("\n".join(lines))
    # The bitrate cap is for heroes full of fine detail: Sheffler's grass ran 10.6 MB uncapped at this CRF.
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "list.txt",
                    "-vf", "fps=30,scale=1920:1200:flags=lanczos,format=yuv420p", "-c:v", "libx264",
                    "-preset", "slow", "-crf", "26", "-maxrate", "2400k", "-bufsize", "4800k", "-an",
                    "-movflags", "+faststart", str(mp4)], check=True, cwd=frames)


def upload(mp4: Path, key: str) -> None:
    env = dict(os.environ)
    for line in (AIOS / "state" / ".env").read_text().splitlines():
        name, _, value = line.partition("=")
        if name in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"):
            env[name] = value.strip().strip('"')
    # AIOS's mission-control-worker is the one folder with wrangler installed; this repo has none.
    subprocess.run(["npx", "wrangler", "r2", "object", "put", f"motive11-media/{key}", "--file", str(mp4),
                    "--content-type", "video/mp4", "--cache-control", "public, max-age=31536000, immutable",
                    "--remote"], check=True, env=env, cwd=AIOS / "state" / "mission-control-worker", shell=True)


def published(name: str) -> bool:
    try:
        # Cloudflare answers Python's default User-Agent with 403. The query string keeps this check out of the
        # real URL's cache entry: the edge caches a 404, which then hides the file just uploaded.
        urllib.request.urlopen(urllib.request.Request(f"https://media.motive11.com/showcase/{name}?check={time.time():.0f}", method="HEAD",
                                                      headers={"User-Agent": "Mozilla/5.0 motive11-showcase"}))
        return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        raise


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("slugs", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--version", type=int, required=True, help="the N in <slug>-vN.mp4; never reuse a published one")
    ap.add_argument("--no-upload", action="store_true", help="keep the MP4 in the temp dir to look at first")
    args = ap.parse_args()
    slugs = list(SITES) if args.all else args.slugs
    if not slugs or set(slugs) - set(SITES):
        sys.exit("name a site or pass --all: " + ", ".join(SITES))
    for slug in slugs:
        name = f"{slug}-v{args.version}.mp4"
        # Published files are cached as immutable for a year, so overwriting one would leave visitors on the
        # old copy while the still changed under them.
        if not args.no_upload and published(name):
            sys.exit(f"{name} is already published; pass a higher --version")
        work = Path(tempfile.mkdtemp(prefix=f"showcase-{slug}-"))
        t0 = time.time()
        stamps = capture(SITES[slug], work)
        mp4 = work / name
        encode(work, stamps, mp4)
        # A trial run keeps its still in the temp dir: the committed one must stay frame one of the live video.
        still = (work if args.no_upload else REPO / "src" / "assets" / "showcase") / f"{slug}.webp"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(work / "00000.jpg"), "-c:v", "libwebp",
                        "-quality", "88", str(still)], check=True)
        size = mp4.stat().st_size / 1e6
        if args.no_upload:
            print(f"{slug}: {len(stamps)} frames, {size:.1f} MB, kept at {mp4}")
            continue
        upload(mp4, f"showcase/{mp4.name}")
        shutil.rmtree(work)
        print(f"{slug}: {len(stamps)} frames, {size:.1f} MB, https://media.motive11.com/showcase/{mp4.name} "
              f"({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
