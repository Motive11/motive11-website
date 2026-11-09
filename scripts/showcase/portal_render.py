"""Renders the portal slide from portal_capture.py's screens: a drawn cursor eases to each click at 60fps, so
the motion is smooth by construction (a live screen capture judders). Writes <work dir>/portal.mp4.

    C:/Users/marks/AIOS/.venv/Scripts/python.exe scripts/showcase/portal_render.py <work dir>
"""
import json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw

D = Path(sys.argv[1])
W, H, FPS = 1920, 1200, 60
K = W / 1440
shots = [Image.open(D / n).convert("RGB").resize((W, H), Image.LANCZOS)
         for n in ["s0_dashboard.png", "s1_leads.png", "s2_dd.png", "s3_proposal.png"]]
steps = json.loads((D / "steps.json").read_text())
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
    h = size
    return big.resize((int(big.width * h / big.height), h), Image.LANCZOS)


CUR = sprite()


def ease(t):
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


# (hold before moving, travel time) per click; final hold after the last screen appears
plan = [(0.6, 1.0), (0.7, 0.9), (1.5, 0.9)]
FINAL = 3.2
FADE = 0.2
start = (1150, 760)
pos = start
timeline = []
t = 0.0
for i, (hold, travel) in enumerate(plan):
    timeline.append(("hold", t, t + hold, i, pos, pos)); t += hold
    timeline.append(("move", t, t + travel, i, pos, targets[i])); t += travel
    timeline.append(("click", t, t + 0.12, i, targets[i], targets[i])); t += 0.12
    pos = targets[i]
    timeline.append(("fade", t, t + FADE, i, pos, pos)); t += FADE
timeline.append(("hold", t, t + FINAL, len(plan), pos, pos)); t += FINAL
total = t
clicks = [seg[1] for seg in timeline if seg[0] == "click"]

ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                       "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-tune", "stillimage",
                       "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(D / "portal.mp4")], stdin=subprocess.PIPE)
n = int(round(total * FPS))
for f in range(n):
    tt = f / FPS
    seg = next(s for s in timeline if s[1] <= tt < s[2]) if tt < timeline[-1][2] else timeline[-1]
    kind, a, b, i, p0, p1 = seg
    u = min(1, max(0, (tt - a) / (b - a)))
    if kind == "fade":
        frame = Image.blend(shots[i], shots[i + 1], ease(u))
    else:
        frame = shots[i].copy()
    if kind == "move":
        e = ease(u); x, y = p0[0] + (p1[0] - p0[0]) * e, p0[1] + (p1[1] - p0[1]) * e
    else:
        x, y = p1
    for c in clicks:
        r = (tt - c) / 0.45
        if 0 <= r <= 1:
            ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            d = ImageDraw.Draw(ov)
            rad = 10 + 26 * ease(r)
            d.ellipse([x - rad, y - rad, x + rad, y + rad], outline=(11, 87, 208, int(170 * (1 - r))), width=4)
            frame = Image.alpha_composite(frame.convert("RGBA"), ov).convert("RGB")
    press = kind == "click"
    cur = CUR.resize((int(CUR.width * 0.88), int(CUR.height * 0.88)), Image.LANCZOS) if press else CUR
    frame.paste(cur, (int(x) - 2, int(y) - 2), cur)
    ff.stdin.write(frame.tobytes())
ff.stdin.close(); ff.wait()
print(f"{total:.1f}s, {n} frames, {(D / 'portal.mp4').stat().st_size / 1e6:.2f} MB")
