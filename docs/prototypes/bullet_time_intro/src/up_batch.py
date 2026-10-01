"""Local 4x upscale with Real-ESRGAN (x4plus weights), no basicsr dependency.

  ~/.k13/rembg-venv/bin/python scripts/upscale_x4.py in.png out.png [tile=256]
Use when a hosted image tool refuses the character (filter) and the 4K sheet step cannot run there.
Weights: ~/.k13/models/RealESRGAN_x4plus.pth (official release). Runs on Apple MPS if available.
"""
import sys, torch, torch.nn as nn, torch.nn.functional as F, numpy as np
from PIL import Image
class RDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__()
        s.c1=nn.Conv2d(nf,gc,3,1,1); s.c2=nn.Conv2d(nf+gc,gc,3,1,1); s.c3=nn.Conv2d(nf+2*gc,gc,3,1,1); s.c4=nn.Conv2d(nf+3*gc,gc,3,1,1); s.c5=nn.Conv2d(nf+4*gc,nf,3,1,1); s.l=nn.LeakyReLU(0.2,True)
    def forward(s,x):
        x1=s.l(s.c1(x)); x2=s.l(s.c2(torch.cat((x,x1),1))); x3=s.l(s.c3(torch.cat((x,x1,x2),1))); x4=s.l(s.c4(torch.cat((x,x1,x2,x3),1))); x5=s.c5(torch.cat((x,x1,x2,x3,x4),1)); return x5*0.2+x
class RRDB(nn.Module):
    def __init__(s,nf,gc=32):
        super().__init__(); s.rdb1=RDB(nf,gc); s.rdb2=RDB(nf,gc); s.rdb3=RDB(nf,gc)
    def forward(s,x): return s.rdb3(s.rdb2(s.rdb1(x)))*0.2+x
class RRDBNet(nn.Module):
    def __init__(s,nin=3,nout=3,nf=64,nb=23,gc=32):
        super().__init__(); s.conv_first=nn.Conv2d(nin,nf,3,1,1); s.body=nn.Sequential(*[RRDB(nf,gc) for _ in range(nb)]); s.conv_body=nn.Conv2d(nf,nf,3,1,1)
        s.conv_up1=nn.Conv2d(nf,nf,3,1,1); s.conv_up2=nn.Conv2d(nf,nf,3,1,1); s.conv_hr=nn.Conv2d(nf,nf,3,1,1); s.conv_last=nn.Conv2d(nf,nout,3,1,1); s.l=nn.LeakyReLU(0.2,True)
    def forward(s,x):
        f=s.conv_first(x); f=s.conv_body(s.body(f))+f
        f=s.l(s.conv_up1(F.interpolate(f,scale_factor=2,mode="nearest"))); f=s.l(s.conv_up2(F.interpolate(f,scale_factor=2,mode="nearest"))); return s.conv_last(s.l(s.conv_hr(f)))

import os,glob,time
dev = "mps" if torch.backends.mps.is_available() else "cpu"
net = RRDBNet(); sd = torch.load(os.path.expanduser("~/.k13/models/RealESRGAN_x4plus.pth"), map_location="cpu")
sd = sd.get("params_ema", sd.get("params", sd))
mapped = {k.replace(".conv1.", ".c1.").replace(".conv2.", ".c2.").replace(".conv3.", ".c3.").replace(".conv4.", ".c4.").replace(".conv5.", ".c5."):v for k,v in sd.items()}
net.load_state_dict(mapped, strict=True); net.eval().to(dev)
TILE=320;pad=16
files=[f"src/f_{i:03d}.png" for i in list(range(147,241))+list(range(84,147))]; t0=time.time()
for i,src in enumerate(files):
    dst="up/"+os.path.basename(src).replace(".png",".jpg")
    if os.path.exists(dst): continue
    rgb=np.array(Image.open(src).convert("RGB")).astype(np.float32)/255.0; H,W=rgb.shape[:2]; out=np.zeros((H*4,W*4,3),np.float32)
    with torch.no_grad():
        for y in range(0,H,TILE):
            for x in range(0,W,TILE):
                y0,y1=max(0,y-pad),min(H,y+TILE+pad); x0,x1=max(0,x-pad),min(W,x+TILE+pad)
                t=torch.from_numpy(rgb[y0:y1,x0:x1]).permute(2,0,1).unsqueeze(0).to(dev)
                o=net(t).clamp(0,1)[0].permute(1,2,0).cpu().numpy()
                oy0,ox0=(y-y0)*4,(x-x0)*4; oy1,ox1=oy0+min(TILE,H-y)*4,ox0+min(TILE,W-x)*4
                out[y*4:y*4+(oy1-oy0),x*4:x*4+(ox1-ox0)]=o[oy0:oy1,ox0:ox1]
    big=Image.fromarray((out*255).round().astype(np.uint8))
    # blend with a plain lanczos upscale so clay keeps its softness (ESRGAN alone reads plastic)
    soft=Image.open(src).convert("RGB").resize(big.size,Image.LANCZOS)
    big=Image.blend(soft,big,0.7)
    big.save("up4/"+os.path.basename(src).replace(".png",".png")) if os.path.basename(src) in os.environ.get("KEEP4","").split(",") else None
    big.resize((2560,1440),Image.LANCZOS).save(dst,quality=93)
    if i%10==0: print(i,len(files),round(time.time()-t0),flush=True)
print("DONE",flush=True)
