import numpy as np, wave
SR=48000; DUR=35.0; N=int(SR*DUR); rng=np.random.default_rng(13)
L=np.zeros(N); R=np.zeros(N)
def add(sig,t,gain=1.0,pan=0.0):
    i=int(t*SR); n=min(len(sig),N-i)
    if n<=0: return
    l=np.cos((pan+1)*np.pi/4); r=np.sin((pan+1)*np.pi/4)
    L[i:i+n]+=sig[:n]*gain*l*1.414; R[i:i+n]+=sig[:n]*gain*r*1.414
def tt(d): return np.arange(int(d*SR))/SR
def lp(x,a):  # one-pole lowpass, a in (0,1) or array
    y=np.empty_like(x); s=0.0; a=np.broadcast_to(a,x.shape)
    for i in range(len(x)): s+=a[i]*(x[i]-s); y[i]=s
    return y
def noise(d): return rng.standard_normal(int(d*SR))
def kick(g=1.0):
    t=tt(0.45); f=45+110*np.exp(-t*28); ph=2*np.pi*np.cumsum(f)/SR
    return (np.sin(ph)*np.exp(-t*7)+0.3*noise(0.45)*np.exp(-t*300))*g
def hat(d=0.05):
    t=tt(d); n=noise(d); n=n-lp(n,0.35); return n*np.exp(-t*90)*0.35
def clap():
    t=tt(0.25); n=noise(0.25); n=lp(n,0.5)-lp(n,0.08)
    env=np.exp(-t*22)+0.6*np.exp(-((t-0.012)*400)**2)+0.5*np.exp(-((t-0.024)*400)**2)
    return n*env*0.8
def tick(f=3200,d=0.03,g=0.25):
    t=tt(d); return np.sin(2*np.pi*f*t)*np.exp(-t*220)*g+hat(d)*0.3
def whoosh(d,peak=0.6,lo=0.02,hi=0.5,g=0.5):
    t=tt(d); x=t/d; a=lo+(hi-lo)*np.sin(np.pi*np.clip(x/peak*0.5,0,1)) ; n=noise(d)
    y=lp(n,a)-lp(n,a*0.15); env=np.where(x<peak,(x/peak)**2,np.exp(-(x-peak)/(1-peak)*4))
    return y*env*g
def riser(d,g=0.5):
    t=tt(d); x=t/d; f=180+1400*x**2; ph=2*np.pi*np.cumsum(f)/SR
    n=noise(d); y=lp(n,0.02+0.5*x**2)
    return (0.25*np.sin(ph)+0.25*np.sin(ph*1.5)+y*0.9)*x**2.5*g
def impact(d=2.5,g=1.0):
    t=tt(d); f=32+90*np.exp(-t*12); ph=2*np.pi*np.cumsum(f)/SR
    sub=np.sin(ph)*np.exp(-t*1.6); n=noise(d); crash=(n-lp(n,0.2))*np.exp(-t*3.5)*0.35+lp(n,0.1)*np.exp(-t*9)*0.8
    return (sub*1.1+crash)*g
def pluck(f,d=0.5,g=0.3):
    t=tt(d); y=np.zeros_like(t)
    for h in range(1,7): y+=np.sin(2*np.pi*f*h*t)*np.exp(-t*(6+h*5))/h
    return y*g
def shimmer(d,f0=2400,g=0.15):
    t=tt(d); x=t/d; y=sum(np.sin(2*np.pi*(f0*k)*(1+0.5*x)*t) for k in (1,1.5,2.01))
    return y*np.sin(np.pi*x)*(0.6+0.4*np.sin(2*np.pi*14*t))*g
def pad(freqs,d,g=0.08):
    t=tt(d); y=np.zeros_like(t)
    for f in freqs:
        for dt in (-0.12,0.12):
            ff=f*2**(dt/12); y+=sum(np.sin(2*np.pi*ff*h*t+rng.random()*6)/h**1.6 for h in range(1,6))
    att=np.clip(t/0.4,0,1); rel=np.clip((d-t)/0.5,0,1); return y*att*rel*g
def hz(n): return 440*2**((n-69)/12)


def bell(f=1450,g=0.5):
    t=tt(2.2); y=np.zeros_like(t)
    for r,a,d in ((1,1,1.6),(2.76,.5,2.6),(5.4,.28,4.0),(8.93,.15,6.0)): y+=a*np.sin(2*np.pi*f*r*t)*np.exp(-t*d)
    y[:int(0.002*SR)]*=np.linspace(0,1,int(0.002*SR)); return y*g
def sizzle(d,g=0.3):
    t=tt(d); n=noise(d); y=n-lp(n,0.35); crack=(rng.random(len(t))<0.0009)*rng.standard_normal(len(t))*6
    crack=lp(crack,0.6); return (y*0.5+crack)*(0.6+0.4*np.sin(2*np.pi*0.7*t))*np.clip(t/0.3,0,1)*np.clip((d-t)/0.6,0,1)*g
def scratch(d=0.3,g=0.35):
    t=tt(d); n=noise(d); y=lp(n,0.3)-lp(n,0.08); return y*np.sin(np.pi*t/d)**0.5*g
def click():
    t=tt(0.04); n=noise(0.04); return (n-lp(n,0.4))*np.exp(-t*400)*0.9+np.sin(2*np.pi*1800*t)*np.exp(-t*300)*0.4
# warm bed: Fmaj7-ish groove 120bpm, rhodes-like plucks on offbeats
PROG=[(0,4.6,[53,60,64,69]),(4.6,11,[50,57,60,65,69]),(11,19.6,[46,53,57,62,65]),(19.6,28,[48,55,60,64,67]),(28,35,[53,60,64,67,69,72])]
for a,b,ns in PROG: add(pad([hz(n) for n in ns],b-a+0.5,0.035),a)
duck=np.ones(N)
def K(s,g=0.85):
    add(kick(),s,g); i=int(s*SR); m=min(int(0.22*SR),N-i); duck[i:i+m]=np.minimum(duck[i:i+m],0.45+0.55*np.linspace(0,1,m)**0.5)
for s in np.arange(4.5,31.0,0.5):
    if 27.9<=s<28.4: continue
    K(s)
for s in np.arange(4.75,31.0,0.5): add(hat(0.05),s,0.7,0.3)
for s in np.arange(11.0,31.0,0.25): add(hat(0.022),s+0.125,0.25,-0.3)
for s in np.arange(5.0,31.0,1.0): add(clap(),s,0.4)
roots=[(4.5,11,38),(11,19.6,34),(19.6,28,36),(28,31,41)]
for a,b,r in roots:
    for s in np.arange(a,b,0.25):
        t_=tt(0.21); f=hz(r)*(2 if int(s*4)%2 else 1); add(np.tanh(2*np.sin(2*np.pi*f*t_))*np.exp(-t_*9),s,0.17)
chordtones={0:[65,69,72,76],11:[62,65,69,74],19.6:[64,67,72,76],28:[65,69,72,77]}
for s in np.arange(4.75,31,1.0):
    k=max(x for x in chordtones if x<=s); 
    for j,n in enumerate(chordtones[k]): add(pluck(hz(n),0.5,0.07),s+j*0.004,1,-0.2+j*0.13)
L[:]*=duck; R[:]*=duck
# hook: sizzle + reveal
add(sizzle(4.6,0.35),0.0); add(pluck(hz(65),1.2,0.3),0.35); add(pluck(hz(72),1.2,0.25),1.55)
add(whoosh(0.6,0.6,g=0.6),4.05)
# pain
add(whoosh(0.5,0.6,0.02,0.25,0.35),4.3,1,0.5)
for st in (5.0,6.5,8.0): add(scratch(0.3),st+0.7,1,-0.3); add(bell(1450+ (st-5)*60,0.32),st+0.95,1,0.2)
add(whoosh(0.6,0.5,g=0.5),9.45); add(bell(1760,0.4),10.0)
# build cards
for i,st in enumerate([12.0,12.5,13.0,13.5,14.0,14.5]): add(pluck(hz([72,74,76,79,81,84][i]),0.4,0.2),st,1,-0.5+i*0.2)
for j in range(6): add(pluck(hz(88),0.25,0.12),12.8+j*0.14,1,-0.3+j*0.12)   # pins
add(click(),13.8,0.9)                                                       # order press
for i in range(38): add(tick(2800+rng.random()*500,0.015,0.14),14.0+0.3+i*0.035 if i<20 else 14.0+1.2+(i-20)*0.04,1,0.2)
for k,st in enumerate([15.1,15.6,16.1]): add(tick(1200,0.06,0.5),st,1,0)
add(impact(1.2,0.5),16.6); add(sizzle(1.4,0.25),16.6)                      # "Open." + confetti
add(whoosh(0.6,0.6,g=0.6),19.05)
# proof cuts
for i in range(7): s=19.6+i*0.75; add(whoosh(0.2,0.7,0.1,0.8,0.45),s-0.08,1,(-1)**i*0.5); add(hat(0.12),s,1.0)
add(whoosh(0.4,0.6,g=0.5),24.8)
for i in range(8): add(pluck(hz([72,76,79,84,72,76,79,84][i]),0.35,0.15),24.95+i*0.06,1,-0.5+i*0.13)
# bar
add(whoosh(0.5,0.6,g=0.5),26.25); add(kick(0.6),26.8)
for i in range(18): add(tick(2200+i*40,0.012,0.12),27.1+i*0.033,1,0.4)
# punch
add(whoosh(0.4,0.6,g=0.6),27.95)
add(impact(2.4,0.8),28.3); add(pluck(hz(65),1.6,0.3),28.3)
add(shimmer(1.0,2400,0.1),29.6)
add(pluck(hz(77),1.0,0.25),31.5); add(bell(1450,0.55),32.2)
add(shimmer(0.5,3000,0.06),33.0); add(shimmer(0.5,3000,0.05),34.6)
# --- cheap stereo reverb (FFT convolution)
def verb(x,d=1.6,seed=0):
    r=np.random.default_rng(seed); ir=r.standard_normal(int(d*SR))*np.exp(-np.arange(int(d*SR))/SR*4.0); ir=lp(ir,0.3)
    n=len(x)+len(ir); F=1<<(n-1).bit_length(); return np.fft.irfft(np.fft.rfft(x,F)*np.fft.rfft(ir,F),F)[:len(x)]
wl,wr=verb(L,seed=1),verb(R,seed=2); s=np.max(np.abs(np.r_[wl,wr]))/max(np.max(np.abs(L)),1e-9)
L=L+wl/s*0.28; R=R+wr/s*0.28
fade=np.clip((N-np.arange(N))/(0.5*SR),0,1); L*=fade; R*=fade
m=np.max(np.abs(np.r_[L,R])); L=np.tanh(L/m*1.4)/np.tanh(1.4)*0.89; R=np.tanh(R/m*1.4)/np.tanh(1.4)*0.89
pcm=(np.stack([L,R],1)*32767).astype('<i2')
with wave.open('score_ad.wav','wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok')
