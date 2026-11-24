"""The home page's AIOS slide: clicks through the fictional Halden Roofing & Exteriors demo on
demo.motive11.com (its pack lives in AIOS entities/motive11/showcase/halden-demo-pack, published public),
screenshots each screen, then draws a cursor easing between the clicks at 60fps, the same way
portal_render.py does, because a live screen capture judders. Writes <work dir>/aios.mp4, the phone copy
aios-m.mp4, and the first frame as aios.png for the still.

    C:/Users/marks/AIOS/.venv/Scripts/python.exe scripts/showcase/aios_demo.py <work dir>
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

D = Path(sys.argv[1])
D.mkdir(parents=True, exist_ok=True)
BASE = "https://demo.motive11.com/halden-roofing"

# (screen name, how to find what gets clicked to reach it, ms to settle)
PLAN = [
    ("jobs", lambda pg: pg.locator('aside a[href="/halden-roofing/work"], nav a[href="/halden-roofing/work"]').first, 3000),
    ("job", lambda pg: pg.get_by_text("Okafor: storm siding repair", exact=False).first, 3000),
    ("drafts", lambda pg: pg.locator('aside a[href="/halden-roofing/drafts"], nav a[href="/halden-roofing/drafts"]').first, 3000),
    ("knowledge", lambda pg: pg.locator('aside a[href="/halden-roofing/aios"], nav a[href="/halden-roofing/aios"]').first, 3000),
]

steps = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    pg = ctx.new_page()
    pg.goto(BASE, wait_until="networkidle")
    pg.wait_for_timeout(2500)
    pg.screenshot(path=str(D / "s0_today.png"))
    for i, (name, find, settle) in enumerate(PLAN, 1):
        el = find(pg)
        el.scroll_into_view_if_needed()
        box = el.bounding_box()
        pt = {"x": box["x"] + min(box["width"] / 2, 60), "y": box["y"] + box["height"] / 2}
        steps.append(pt)
        pg.mouse.click(pt["x"], pt["y"])
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(settle)
        pg.screenshot(path=str(D / f"s{i}_{name}.png"))
    b.close()
(D / "steps.json").write_text(json.dumps(steps, indent=1))

W, H, FPS = 1920, 1200, 60
K = W / 1440
names = ["s0_today.png"] + [f"s{i}_{n}.png" for i, (n, _, _) in enumerate(PLAN, 1)]
shots = [Image.open(D / n).convert("RGB").resize((W, H), Image.LANCZOS) for n in names]
targets = [(s["x"] * K, s["y"] * K) for s in steps]


def sprite(scale=4, size=30):
    pts = [(0, 0), (0, 22), (5, 17), (9, 26), (12.5, 24.5), (8.6, 15.8), (15.5, 15.8)]
    big = Image.new("RGBA", (int(20 * scale), int(30 * scale)), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    sp = [(x * scale + 2 * scale, y * scale + 2 * scale) for x, y in pts]
    d.polygon(sp, fill=(0, 0, 0, 255))
    inner = [(x * scale * 0.82 + 2 * scale + 1.3 * scale, y * scale * 0.82 + 2 * scale + 2.6 * scale) for x, y in pts]
    d.polygon(inner, fill=(255, 255, 255, 255))
    d.line(sp + [sp[0]], fill=(0, 0, 0, 255), width=int(1.6 * scale))
    return big.resize((int(big.width * size / big.height), size), Image.LANCZOS)


CUR = sprite()


def ease(t):
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


plan = [(1.2, 1.0), (1.4, 0.9), (1.8, 0.9), (1.8, 0.9)]
FINAL, FADE = 3.0, 0.2
pos = (1150, 760)
timeline, t = [], 0.0
for i, (hold, travel) in enumerate(plan):
    timeline.append(("hold", t, t + hold, i, pos, pos)); t += hold
    timeline.append(("move", t, t + travel, i, pos, targets[i])); t += travel
    timeline.append(("click", t, t + 0.12, i, targets[i], targets[i])); t += 0.12
    pos = targets[i]
    timeline.append(("fade", t, t + FADE, i, pos, pos)); t += FADE
timeline.append(("hold", t, t + FINAL, len(plan), pos, pos)); t += FINAL
total = t
clicks = [s[1] for s in timeline if s[0] == "click"]

ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                       "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-tune", "stillimage",
                       "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(D / "aios.mp4")], stdin=subprocess.PIPE)
n = int(round(total * FPS))
for f in range(n):
    tt = f / FPS
    seg = next(s for s in timeline if s[1] <= tt < s[2]) if tt < timeline[-1][2] else timeline[-1]
    kind, a, b2, i, p0, p1 = seg
    u = min(1, max(0, (tt - a) / (b2 - a)))
    frame = Image.blend(shots[i], shots[i + 1], ease(u)) if kind == "fade" else shots[i].copy()
    if kind == "move":
        e = ease(u); x, y = p0[0] + (p1[0] - p0[0]) * e, p0[1] + (p1[1] - p0[1]) * e
    else:
        x, y = p1
    for c in clicks:
        r = (tt - c) / 0.45
        if 0 <= r <= 1:
            ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            dr = ImageDraw.Draw(ov)
            rad = 10 + 26 * ease(r)
            dr.ellipse([x - rad, y - rad, x + rad, y + rad], outline=(11, 87, 208, int(170 * (1 - r))), width=4)
            frame = Image.alpha_composite(frame.convert("RGBA"), ov).convert("RGB")
    cur = CUR.resize((int(CUR.width * 0.88), int(CUR.height * 0.88)), Image.LANCZOS) if kind == "click" else CUR
    frame.paste(cur, (int(x) - 2, int(y) - 2), cur)
    if f == 0:
        frame.save(D / "aios.png")
    ff.stdin.write(frame.tobytes())
ff.stdin.close(); ff.wait()
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(D / "aios.mp4"), "-vf", "scale=1280:800:flags=lanczos,format=yuv420p",
                "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-profile:v", "high", "-level:v", "4.2", "-maxrate", "1800k",
                "-bufsize", "3600k", "-an", "-movflags", "+faststart", str(D / "aios-m.mp4")], check=True)
print(f"{total:.1f}s, {n} frames, {(D / 'aios.mp4').stat().st_size / 1e6:.2f} MB")
