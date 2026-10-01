#!/usr/bin/env python3
"""motion-vid render harness.
Usage:
  render.py stills <film.html> 1.0,4.5,9.2        -> s_01.00.png ... + sheet.png (contact sheet)
  render.py video  <film.html> [fps=120] [out.mkv] -> lossless FFV1 frames at fps
The film must expose window.ready (promise -> total seconds) and window.renderAsync(t)
(or window.render(t)). If the film exposes window.TL it is written to timeline.json
so the score can be composed from the same events."""
import sys, subprocess, time, os, json, glob
from playwright.sync_api import sync_playwright
mode, film = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-angle=metal","--enable-gpu","--allow-file-access-from-files","--force-color-profile=srgb", "--font-render-hinting=none",
                               "--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
    pg.goto("file://" + os.path.abspath(film))
    total = pg.evaluate("window.ready")
    time.sleep(0.4)
    fn = "renderAsync" if pg.evaluate("typeof window.renderAsync==='function'") else "render"
    tl = pg.evaluate("window.TL||null")
    if tl: json.dump(tl, open("timeline.json", "w"))
    print("TOTAL", total, "via", fn)
    if mode == "stills":
        for f in glob.glob("s_*.png"): os.remove(f)
        for t in [float(x) for x in sys.argv[3].split(",")]:
            pg.evaluate(f"{fn}({t})"); pg.screenshot(path=f"s_{t:05.2f}.png")
        n = len(sys.argv[3].split(",")); cols = 3; rows = (n + cols - 1) // cols
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-pattern_type", "glob", "-i", "s_*.png",
                        "-filter_complex", f"scale=640:-1,tile={cols}x{rows}:padding=6", "-frames:v", "1", "sheet.png"])
    else:
        fps = int(sys.argv[3]) if len(sys.argv) > 3 else 120
        out = sys.argv[4] if len(sys.argv) > 4 else "raw.mkv"
        N = int(float(total) * fps)
        ff = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(fps),
                               "-i", "-", "-c:v", "ffv1", out], stdin=subprocess.PIPE)
        t0 = time.time()
        for i in range(N):
            pg.evaluate(f"{fn}({i/fps})"); ff.stdin.write(pg.screenshot(type="png"))
            if i % 600 == 0: print(i, "/", N, round(time.time() - t0), "s", flush=True)
        ff.stdin.close(); ff.wait()
    print("errors:", errs[:5])
    b.close()
