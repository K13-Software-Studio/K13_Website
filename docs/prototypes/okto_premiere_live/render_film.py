import sys, subprocess, time, os, json
from playwright.sync_api import sync_playwright
mode=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(args=["--force-color-profile=srgb","--font-render-hinting=none","--autoplay-policy=no-user-gesture-required"])
    pg=b.new_page(viewport={"width":1920,"height":1080})
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type=="error" and errs.append(m.text))
    pg.goto("file://"+os.path.abspath("film.html")); total=pg.evaluate("window.ready"); time.sleep(0.4)
    json.dump(pg.evaluate("window.TL"),open("timeline.json","w")); print("TOTAL",total)
    if mode=="stills":
        for t in [float(x) for x in sys.argv[2].split(",")]:
            pg.evaluate(f"renderAsync({t})"); pg.screenshot(path=f"s_{t:05.2f}.png")
    else:
        fps=int(sys.argv[2]); N=int(total*fps)
        ff=subprocess.Popen(["ffmpeg","-loglevel","error","-y","-f","image2pipe","-framerate",str(fps),"-i","-","-c:v","ffv1","raw_film.mkv"],stdin=subprocess.PIPE)
        t0=time.time()
        for i in range(N):
            pg.evaluate(f"renderAsync({i/fps})"); ff.stdin.write(pg.screenshot(type="png"))
            if i%600==0: print(i,N,round(time.time()-t0),flush=True)
        ff.stdin.close(); ff.wait()
    print("errors:",errs[:5]); b.close()
