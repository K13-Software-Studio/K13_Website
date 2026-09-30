import sys, subprocess, time
from playwright.sync_api import sync_playwright
mode = sys.argv[1]  # "stills" or "video"
URL = "file://" + __import__('os').path.abspath("v2/reel_v2.html")
with sync_playwright() as p:
    b = p.chromium.launch(args=["--force-color-profile=srgb","--font-render-hinting=none"])
    pg = b.new_page(viewport={"width":1920,"height":1080}, device_scale_factor=1)
    errs=[]; pg.on("console", lambda m: m.type=="error" and errs.append(m.text)); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.evaluate("window.ready"); time.sleep(0.5)
    if mode=="stills":
        for t in [float(x) for x in sys.argv[2].split(",")]:
            pg.evaluate(f"render({t})"); pg.screenshot(path=f"still_{t:05.2f}.png")
    else:
        fps=int(sys.argv[2]); N=int(15*fps)
        ff=subprocess.Popen(["ffmpeg","-loglevel","error","-y","-f","image2pipe","-framerate",str(fps),"-i","-","-c:v","ffv1","raw.mkv"],stdin=subprocess.PIPE)
        t0=time.time()
        for i in range(N):
            pg.evaluate(f"render({i/fps})")
            ff.stdin.write(pg.screenshot(type="png"))
            if i%120==0: print(i, round(time.time()-t0,1), flush=True)
        ff.stdin.close(); ff.wait()
    print("errors:", errs)
    b.close()
