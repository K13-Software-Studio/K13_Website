import time, os, shutil, sys
from playwright.sync_api import sync_playwright
SITES={"tiger":"https://tigerhospitalitygroup.com","lobster":"https://lobsterlab.us","lavida":"https://lavida.fit","eggout":"https://egg.k13projects.com",
 "cosmos":"https://cosmos.k13projects.com","miramar":"https://miramarfoodhall.com","station8":"https://station8publicmarket.com","globalfork":"https://globalforkfh.com"}
only=sys.argv[1:] or list(SITES)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    for k in only:
        u=SITES[k]; d=f"raw_{k}"; shutil.rmtree(d,ignore_errors=True)
        ctx=b.new_context(viewport={"width":1440,"height":878},record_video_dir=d,record_video_size={"width":1440,"height":878})
        pg=ctx.new_page(); t0=time.time()
        try: pg.goto(u,wait_until="commit",timeout=30000)
        except Exception as e: print(k,"goto err",e)
        time.sleep(10); ctx.close()
        f=[x for x in os.listdir(d) if x.endswith('.webm')][0]; os.rename(f"{d}/{f}",f"{k}.webm"); shutil.rmtree(d)
        print(k,"ok",round(time.time()-t0,1),flush=True)
    b.close()
