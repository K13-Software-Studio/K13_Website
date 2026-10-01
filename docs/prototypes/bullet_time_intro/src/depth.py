import sys,numpy as np,torch
from PIL import Image
from transformers import pipeline
p=pipeline("depth-estimation",model="depth-anything/Depth-Anything-V2-Base-hf",device="mps")
for n in sys.argv[1:]:
    im=Image.open(f"src/f_{n}.png").convert("RGB")
    d=p(im)["predicted_depth"]
    d=torch.nn.functional.interpolate(d[None] if d.dim()==3 else d[None,None],size=im.size[::-1],mode="bicubic")[0,0].numpy()
    d=(d-d.min())/(d.max()-d.min())
    Image.fromarray((d*65535).astype(np.uint16)).save(f"depth/d_{n}.png")
    Image.fromarray((d*255).astype(np.uint8)).save(f"depth/v_{n}.png"); print("ok",n,flush=True)
