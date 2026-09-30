import time, os, shutil, sys
from playwright.sync_api import sync_playwright
BASE="https://okto.k13projects.com"
def shoot(b,name,path,actions,dur):
    d="tmp_"+name; shutil.rmtree(d,ignore_errors=True)
    ctx=b.new_context(viewport={"width":1440,"height":900},record_video_dir=d,record_video_size={"width":1440,"height":900})
    pg=ctx.new_page(); pg.mouse.move(1200,820)
    pg.goto(BASE+path,wait_until="commit",timeout=45000)
    try: pg.screenshot(path=f"ping_{name}.png")   # screencast scale ping (house gotcha)
    except Exception as e: print("ping",e)
    t0=time.time(); actions(pg); rest=dur-(time.time()-t0)
    if rest>0: time.sleep(rest)
    ctx.close(); f=[x for x in os.listdir(d) if x.endswith('.webm')][0]; os.rename(f"{d}/{f}",f"{name}.webm"); shutil.rmtree(d); print(name,"ok",flush=True)
def none(pg): pass
def ships(pg):
    pg.wait_for_load_state("networkidle",timeout=30000); time.sleep(1.5)
    h=pg.evaluate("""()=>{const el=[...document.querySelectorAll('h2,h3')].find(e=>/to scale/i.test(e.textContent));if(!el)return -1;const y=el.getBoundingClientRect().top+scrollY-80;return y}""")
    print("ships heading y",h)
    if h and h>0:
        for i in range(30): pg.mouse.wheel(0,max(1,h/30)); time.sleep(0.05)
    time.sleep(1.2)
    for x,y in [(300,560),(420,620),(520,700),(420,760),(300,700)]: pg.mouse.move(x,y,steps=12); time.sleep(0.5)
def scroll(pg):
    pg.wait_for_load_state("networkidle",timeout=30000)
    pg.wait_for_function("()=>{const c=document.querySelector('canvas');return c&&c.getBoundingClientRect().width>200}",timeout=40000)
    time.sleep(4.0)
    for i in range(220): pg.mouse.wheel(0,50); time.sleep(0.06)
def team(pg):
    pg.wait_for_load_state("networkidle",timeout=30000); time.sleep(2.0)
    for i in range(14): pg.mouse.wheel(0,40); time.sleep(0.06)
    for x in [300,520,740,960,1180]: pg.mouse.move(x,560,steps=10); time.sleep(0.45)
only=sys.argv[1:]
JOBS={"home":("/",none,24),"ships":("/services",ships,11),"scroll":("/",scroll,34),"team":("/team",team,9)}
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist","--autoplay-policy=no-user-gesture-required"])
    for k,(path,act,dur) in JOBS.items():
        if only and k not in only: continue
        shoot(b,k,path,act,dur)
    b.close()
