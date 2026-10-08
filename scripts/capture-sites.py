#!/usr/bin/env python3
"""capture-sites: the Workbench World's site screens, captured from the 13 LIVE public sites (docs/WORKBENCH_WORLD_4.md).

WRITES (assets/world/sites/)
  <key>-full.webp   full-page capture at 1280 px wide, scaled to 720 px wide, height capped at MAX_FULL_H, kept under ~600 KB
  <key>-<n>.webp    2 to 4 small images per site (an <img> or a hero block shot from the rendered page), max 600 px wide,
                    kept under ~120 KB. n starts at 1.
  manifest.json     what was captured: sizes in px and bytes, alt text, and the page each came from.
                    data/world-shops.json carries the same w/h; sync-world.py and check-world-data.js read the files.

RE-RUNNABLE
  python3 scripts/capture-sites.py                 every site
  python3 scripts/capture-sites.py cosmos egg      only these keys
  It overwrites that site's files, prints what it captured and what it skipped (and why), and exits 0 even when a site
  is down (the old files stay). Needs: pip install playwright pillow ; playwright install chromium.

PUBLIC ONLY: these are the 13 public Work sites, loaded the way any visitor loads them. Nothing is logged into, no form
is sent, no setting of any site is changed. A cookie banner is dismissed with its own Decline / Accept button when one shows.
"""
import io
import json
import os
import re
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "world", "sites")

SITES = {
    "thg": "https://tigerhospitalitygroup.com",
    "lavida": "https://lavida.fit",
    "miramar": "https://miramarfoodhall.com",
    "cengo": "https://cengo.party",
    "station8": "https://station8publicmarket.com",
    "globalfork": "https://globalforkfh.com",
    "egg": "https://egg.k13projects.com",
    "tmb": "https://tmb.k13projects.com",
    "baa": "https://www.atelierbaa.com/",
    "barfix": "https://bfx.k13projects.com",
    "lobsterlab": "https://lobsterlab.us",
    "cosmos": "https://cosmos.k13projects.com",
    "carlos": "https://carlos.k13projects.com",
}

VIEW_W = 1280
FULL_W = 720
SCALE = FULL_W / VIEW_W
MAX_FULL_H = 9000                       # cap on the scaled capture
MAX_FULL_BYTES = 600 * 1024
SMALL_W = 600
SMALL_BYTES = 120 * 1024
WANT_SMALL = 3                          # 2 to 4 are accepted; we aim for 3

# Optional per-site hints. "shots" are CSS selectors tried first for the small images (a hero block, a card); "alts" are
# the alt texts used for them, in order. Everything else is found by size from the page's own images.
HINTS = {}

COOKIE_WORDS = re.compile(r"^(decline|reject|reject all|no thanks|accept|accept all|got it|ok|okay|i agree|allow all)$", re.I)

JS_IMAGES = """() => {
  const out = [];
  const seen = new Set();
  document.querySelectorAll('img').forEach(im => {
    const r = im.getBoundingClientRect();
    const cs = getComputedStyle(im);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    const src = im.currentSrc || im.src;
    if (!src || src.startsWith('data:') || /\\.svg(\\?|$)/i.test(src) || seen.has(src)) return;
    if (im.naturalWidth < 300 || r.width < 220 || r.height < 140) return;
    if (/logo|icon|avatar|sprite|favicon|badge/i.test(src + ' ' + (im.alt || '') + ' ' + im.className)) return;
    seen.add(src);
    out.push({src, alt: (im.alt || '').trim(), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height,
              nw: im.naturalWidth, nh: im.naturalHeight});
  });
  return out;
}"""


def webp_under(img, max_bytes, start_q=72, floor_q=28):
    """Smallest-loss webp under max_bytes: lower quality, then lower size, until it fits."""
    q = start_q
    cur = img
    while True:
        buf = io.BytesIO()
        cur.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= max_bytes:
            return buf.getvalue(), cur.size
        if q > floor_q:
            q -= 8
        else:
            w, h = cur.size
            cur = cur.resize((int(w * 0.9), int(h * 0.9)), Image.LANCZOS)
            q = start_q - 16


def dismiss_banners(pg):
    """Click a cookie banner's own button (prefers a decline). Never touches anything else."""
    try:
        btns = pg.locator("button, a[role=button]").all()
    except Exception:
        return
    pick = None
    for b in btns:
        try:
            t = (b.inner_text(timeout=300) or "").strip()
            if COOKIE_WORDS.match(t) and b.is_visible():
                if re.match(r"^(decline|reject|reject all|no thanks)$", t, re.I):
                    pick = b
                    break
                pick = pick or b
        except Exception:
            continue
    if pick:
        try:
            pick.click(timeout=1500)
            pg.wait_for_timeout(500)
        except Exception:
            pass


def settle(pg):
    """Scroll the whole page in steps so lazy images and reveal-on-scroll blocks load, then wait for fonts and images."""
    h = pg.evaluate("document.documentElement.scrollHeight")
    y = 0
    while y < min(h, 26000):
        pg.evaluate("window.scrollTo(0,%d)" % y)
        pg.wait_for_timeout(140)
        y += 450
        h = pg.evaluate("document.documentElement.scrollHeight")
    pg.evaluate("window.scrollTo(0,0)")
    pg.wait_for_timeout(500)
    try:
        pg.evaluate("document.fonts.ready")
        pg.evaluate("""Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 4000); })))""")
    except Exception:
        pass
    pg.wait_for_timeout(600)


def shot_png(locator_or_page, **kw):
    return Image.open(io.BytesIO(locator_or_page.screenshot(**kw))).convert("RGB")


def capture_site(browser, key, url, report):
    os.makedirs(OUT, exist_ok=True)
    ctx = browser.new_context(viewport={"width": VIEW_W, "height": 900}, device_scale_factor=1,
                              reduced_motion="reduce", locale="en-US")
    pg = ctx.new_page()
    try:
        try:
            pg.goto(url, wait_until="load", timeout=45000)
        except Exception as e:
            report["skipped"].append("%s: page did not finish loading (%s); using what rendered" % (key, str(e)[:60]))
        pg.wait_for_timeout(2500)
        dismiss_banners(pg)
        settle(pg)
        dismiss_banners(pg)
        manifest = {"key": key, "page": url}

        # ----- full page
        total = pg.evaluate("document.documentElement.scrollHeight")
        clip_h = min(total, int(MAX_FULL_H / SCALE))
        full = shot_png(pg, full_page=True, clip={"x": 0, "y": 0, "width": VIEW_W, "height": clip_h}, animations="disabled")
        full = full.resize((FULL_W, max(1, int(round(full.height * SCALE)))), Image.LANCZOS)
        data, size = webp_under(full, MAX_FULL_BYTES)
        with open(os.path.join(OUT, key + "-full.webp"), "wb") as f:
            f.write(data)
        manifest["full"] = {"src": "/assets/world/sites/%s-full.webp" % key, "w": size[0], "h": size[1], "bytes": len(data),
                            "cut": clip_h < total}
        report["done"].append("%s full %dx%d %d KB%s" % (key, size[0], size[1], len(data) // 1024,
                                                           " (page cut at the cap)" if clip_h < total else ""))

        # ----- small images
        for old in os.listdir(OUT):
            if re.match(r"^%s-\d\.webp$" % re.escape(key), old):
                os.remove(os.path.join(OUT, old))
        small = []
        hint = HINTS.get(key, {})
        for i, sel in enumerate(hint.get("shots", [])):
            try:
                loc = pg.locator(sel).first
                loc.scroll_into_view_if_needed(timeout=2000)
                pg.wait_for_timeout(400)
                small.append((shot_png(loc, animations="disabled"), (hint.get("alts") or [""] * 9)[i] or key + " detail"))
            except Exception as e:
                report["skipped"].append("%s: hint %s not shot (%s)" % (key, sel, str(e)[:50]))
        if len(small) < WANT_SMALL:
            cands = pg.evaluate(JS_IMAGES)
            cands.sort(key=lambda c: -(c["w"] * c["h"]))
            for c in cands:
                if len(small) >= WANT_SMALL:
                    break
                try:
                    pg.evaluate("window.scrollTo(0,%d)" % max(0, c["y"] - 200))
                    pg.wait_for_timeout(350)
                    loc = pg.evaluate_handle(
                        "(src) => [...document.images].find(i => (i.currentSrc||i.src) === src)", c["src"]).as_element()
                    if loc is None:
                        continue
                    im = shot_png(loc, animations="disabled")
                    if im.width < 160 or im.height < 100:
                        continue
                    small.append((im, c["alt"] or key + " photo"))
                except Exception as e:
                    report["skipped"].append("%s: image %s not shot (%s)" % (key, c["src"][-40:], str(e)[:50]))
        uniq, seen_px = [], set()
        for im, alt in small:        # an image hidden behind a sticky hero shoots as the hero again: keep each look once
            sig = im.resize((16, 16)).tobytes()
            if sig not in seen_px:
                seen_px.add(sig)
                uniq.append((im, alt))
        if len(uniq) < len(small):
            report["skipped"].append("%s: %d duplicate shot(s) dropped" % (key, len(small) - len(uniq)))
        small = uniq
        if len(small) < 3:
            # fill up: hero and a mid-page viewport, shot from the rendered page
            for frac in (0.0, 0.35, 0.7):
                if len(small) >= 3:
                    break
                pg.evaluate("window.scrollTo(0,%d)" % int(total * frac))
                pg.wait_for_timeout(500)
                small.append((shot_png(pg, animations="disabled"), key + " page view"))
                if len(small) > 1 and small[-1][0].resize((16, 16)).tobytes() in [x[0].resize((16, 16)).tobytes() for x in small[:-1]]:
                    small.pop()
        manifest["images"] = []
        for n, (im, alt) in enumerate(small[:4], 1):
            if im.width > SMALL_W:
                im = im.resize((SMALL_W, int(round(im.height * SMALL_W / im.width))), Image.LANCZOS)
            data, size = webp_under(im, SMALL_BYTES, start_q=78)
            name = "%s-%d.webp" % (key, n)
            with open(os.path.join(OUT, name), "wb") as f:
                f.write(data)
            manifest["images"].append({"src": "/assets/world/sites/" + name, "w": size[0], "h": size[1], "bytes": len(data),
                                       "alt": alt[:120]})
            report["done"].append("%s %s %dx%d %d KB" % (key, name, size[0], size[1], len(data) // 1024))
        return manifest
    finally:
        ctx.close()


def main():
    keys = [a for a in sys.argv[1:] if not a.startswith("-")] or list(SITES)
    bad = [k for k in keys if k not in SITES]
    if bad:
        print("unknown key(s): " + ", ".join(bad) + "  (known: " + ", ".join(SITES) + ")")
        sys.exit(2)
    report = {"done": [], "skipped": []}
    mpath = os.path.join(OUT, "manifest.json")
    manifest = {}
    if os.path.exists(mpath):
        manifest = json.load(open(mpath, encoding="utf-8"))
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for k in keys:
            try:
                manifest[k] = capture_site(browser, k, SITES[k], report)
            except Exception as e:
                report["skipped"].append("%s: capture failed (%s); old files kept" % (k, str(e)[:90]))
        browser.close()
    os.makedirs(OUT, exist_ok=True)
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False, sort_keys=True)
    print("captured:")
    for l in report["done"]:
        print("  " + l)
    if report["skipped"]:
        print("skipped, and why:")
        for l in report["skipped"]:
            print("  - " + l)


if __name__ == "__main__":
    main()
