"""Screens for the home page's portal slide, from the LOCAL demo copy only (projects/motive11/portal-demo on
localhost:3002, database "Clayhorn Demo"), never Sheffler's live portal. Signs in as demo@clayhornsurvey.com
(password in DEMO_PORTAL_PASSWORD), shows Sheffler's logo in place of Clayhorn's by answering the logo request in
the browser, adds a "Demo data" pill, and blocks every database write, so the demo's data never changes.
Clicks Leads, a lead's Due Diligence tab, then Edit Proposal, and saves a screenshot after each plus the click
points. portal_render.py turns them into the video.

    DEMO_PORTAL_PASSWORD=... C:/Users/marks/AIOS/.venv/Scripts/python.exe scripts/showcase/portal_capture.py <work dir>
"""
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

D = Path(sys.argv[1])
D.mkdir(parents=True, exist_ok=True)
pw = os.environ["DEMO_PORTAL_PASSWORD"]
LOGO = Path("C:/Users/marks/projects/motive11/clients/sheffler-company/portal/public/sheffler-logo.png").read_bytes()
BASE = "http://localhost:3002"
DEMO_DB = "wchbqdgvrmrkxrchjuhz.supabase.co"

PILL = """
(() => {
  const add = () => {
    if (document.getElementById('__demo')) return;
    const s = document.createElement('style');
    s.textContent = 'nextjs-portal{display:none!important}#__demo{position:fixed;bottom:24px;left:24px;z-index:2147483647;display:flex;align-items:center;gap:8px;padding:6px 13px 6px 11px;border-radius:999px;background:#1e1e1f;color:#fff;font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.18)}#__demo i{width:7px;height:7px;border-radius:50%;background:#ff6a1a}';
    document.head.appendChild(s);
    const d = document.createElement('div'); d.id = '__demo'; d.innerHTML = '<i></i>Demo data';
    document.body.appendChild(d);
  };
  const hideSaveError = () => {
    for (const el of document.querySelectorAll('span,div,p')) {
      if (el.childElementCount <= 1 && /^[^A-Za-z]*Couldn.t save/.test(el.textContent || '')) el.style.visibility = 'hidden';
    }
  };
  const both = () => { add(); hideSaveError(); };
  const go = () => { both(); new MutationObserver(both).observe(document.body, {childList: true, subtree: true, characterData: true}); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
"""

# Opening the editor takes an edit lock with a heartbeat; aborting those PATCHes is what keeps the demo untouched.
blocked, foreign = [], []
armed = False


def guard(route):
    req = route.request
    # The demo's own server writes too (activity pings, server actions, API routes), with its service key, so
    # once signed in only plain reads go through to it. Signing in itself needs its POSTs.
    to_db = DEMO_DB in req.url and "/auth/v1/token" not in req.url
    to_app = req.url.startswith(BASE) and armed
    if (to_db or to_app) and req.method in ("POST", "PATCH", "PUT", "DELETE"):
        blocked.append(f"{req.method} {urlsplit(req.url).netloc[:9]} {urlsplit(req.url).path[:60]}")
        return route.abort()
    return route.fallback()


steps = []
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    ctx.route("**/clayhorn-logo.svg", lambda r: r.fulfill(body=LOGO, content_type="image/png"))
    ctx.route(f"https://{DEMO_DB}/**", guard)
    ctx.route(BASE + "/**", guard)
    ctx.on("request", lambda r: foreign.append(r.url) if any(h in r.url for h in ("wvkezjped", "shefflerco", "vercel.app")) else None)
    ctx.add_init_script(PILL)
    pg = ctx.new_page()
    pg.goto(BASE + "/login", wait_until="networkidle"); pg.wait_for_timeout(1500)
    pg.fill("input[type=email]", "demo@clayhornsurvey.com"); pg.fill("input[type=password]", pw)
    pg.click("button[type=submit]"); pg.wait_for_url(lambda u: "/login" not in u, timeout=30000)
    pg.wait_for_timeout(3000)
    armed = True
    pg.goto(BASE + "/", wait_until="load"); pg.wait_for_timeout(4000)

    plan = [
        ("leads", "Leads", 0, 3500),
        ("dd", "Due Diligence", 300, 4000),
        ("proposal", "Edit Proposal", 300, 8000),
    ]
    FIND = """([text, minY]) => {
      const els = [...document.querySelectorAll('a,button,[role=tab]')].filter(e => e.offsetParent && e.innerText.trim().split(String.fromCharCode(10))[0].trim() === text);
      const hit = els.map(e => e.getBoundingClientRect()).find(r => r.top >= minY && r.width > 0);
      return hit ? {x: hit.x + hit.width / 2, y: hit.y + hit.height / 2} : null;
    }"""
    pg.screenshot(path=str(D / "s0_dashboard.png"))
    for name, text, min_y, wait in plan:
        pt = None
        for _ in range(30):
            pt = pg.evaluate(FIND, [text, min_y])
            if pt: break
            pg.wait_for_timeout(500)
        if not pt:
            raise SystemExit(f"no visible '{text}' below y={min_y}")
        steps.append({"name": name, **pt})
        pg.mouse.click(pt["x"], pt["y"]); pg.wait_for_timeout(1500)
        for _ in range(40):
            if "Loading" not in pg.inner_text("body"): break
            pg.wait_for_timeout(500)
        pg.wait_for_timeout(wait)
        pg.screenshot(path=str(D / f"s{len(steps)}_{name}.png"))
    b.close()

(D / "steps.json").write_text(json.dumps(steps, indent=1))
print("steps:", steps)
print("writes blocked:", blocked)
print("non-demo hosts:", foreign)
