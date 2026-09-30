import numpy as np, wave
SR=48000; DUR=66.0; N=int(SR*DUR); rng=np.random.default_rng(13)
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

import json
TLd=json.load(open('timeline.json')); EV=TLd['EVTS']
E={}
for e in EV: E.setdefault(e['k'],[]).append(e['t'])
FL=E.get('flip',[]); LIVE=E['live'][0]; SCR=E['scroll'][0]; A2=E['act2'][0]; PAGE=E['page']; PAGES=E['pages'][0]; CLOSE=E['close'][0]; SHUT=E['shut'][0]; OPEN=E['open'][0]
TOT=OPEN+2.9
def horn(d,f=73.4,g=0.3):
    t=tt(d); y=np.zeros_like(t)
    for h in range(1,12): y+=np.sin(2*np.pi*f*h*t+0.3*h)/h**1.1
    y+=0.6*sum(np.sin(2*np.pi*f*1.5*h*t)/h**1.3 for h in range(1,8))
    y=lp(y,0.06); env=np.clip(t/0.6,0,1)*np.clip((d-t)/1.2,0,1); return y*env*g
def sea(d,g=0.12):
    t=tt(d); n=noise(d); y=lp(n,0.02)+0.4*(lp(n,0.08)-lp(n,0.02)); sw=0.55+0.45*np.sin(2*np.pi*0.11*t)**2
    return y*sw*g
add(sea(TOT,0.5),0.0,1,-0.3); add(sea(TOT,0.5),0.0,1,0.3)
# harmony
CH=[(0,5.4,[50,57,62,66,69]),(5.4,15,[47,54,62,66,69]),(15,LIVE,[43,55,59,62,66]),(LIVE,A2,[45,52,57,61,64,69]),(A2,PAGE[0],[47,54,62,66,69,73]),(PAGE[0],PAGE[2],[43,55,59,62,66,71]),(PAGE[2],CLOSE,[45,52,57,61,64,69]),(CLOSE,OPEN,[38,50,57,62]),(OPEN,TOT,[50,57,62,66,69,74])]
for a,b,ns in CH: add(pad([hz(n) for n in ns],b-a+0.8,0.035),a)
add(horn(3.2,73.4,0.28),0.3); add(shimmer(1.0,2400,0.07),1.3)
# flips: wood tick + rising pentatonic pluck
PEN=[62,64,66,69,71,74,76,78,81,83,86]
for i,t0 in enumerate(FL):
    add(tick(1100,0.05,0.35),t0,1,0); add(tick(2400,0.02,0.15),t0+0.21,1,0.2)
    add(pluck(hz(PEN[(i*2)%len(PEN)]),0.7,0.16),t0+0.3,1,(-1)**i*0.4)
for t0 in E['land']: add(whoosh(0.7,0.6,0.02,0.3,0.45),t0,1,0.3); add(kick(0.45),t0+0.7)
# the live pulse through act two
duck=np.ones(N); s=LIVE
while s<CLOSE-0.3:
    add(kick(0.55),s); i=int(s*SR); m=min(int(0.2*SR),N-i); duck[i:i+m]=np.minimum(duck[i:i+m],0.55+0.45*np.linspace(0,1,m)**0.5)
    add(hat(0.03),s+0.3,0.35,0.3); s+=0.6
s=LIVE
while s<CLOSE-0.3:
    t_=tt(0.3); r=45 if s<A2 else 43; add(np.tanh(1.6*np.sin(2*np.pi*hz(r)*t_))*np.exp(-t_*6),s,0.14); s+=1.2
L[:]*=duck; R[:]*=duck
add(riser(0.9,0.5),LIVE-0.8); add(impact(1.6,0.5),LIVE); add(shimmer(1.2,1800,0.07),LIVE+0.3)
add(whoosh(0.8,0.5,g=0.4),SCR)
add(whoosh(0.6,0.6,g=0.45),A2)
for p in PAGE: add(whoosh(0.5,0.6,0.02,0.4,0.5),p-0.1,1,-0.4); add(impact(1.0,0.45),p+0.3)
for k in (0.2,0.95,1.7): add(whoosh(0.3,0.5,0.05,0.6,0.35),PAGES+k-0.1,1,0.5)
# ending
add(whoosh(1.2,0.7,0.01,0.15,0.35),CLOSE+1.0)
add(kick(0.5),SHUT-0.1)
for j,d in enumerate([0.2,0.35,0.75,0.9,1.25]): add(pluck(hz([74,78,81,86,90][j]),0.9,0.18),SHUT+d,1,-0.3+j*0.15)
add(shimmer(0.7,3200,0.1),SHUT+1.6)
add(riser(1.0,0.6),OPEN-0.2); add(impact(2.8,0.8),OPEN+0.85); add(horn(2.6,73.4,0.3),OPEN+0.8); add(pluck(hz(62),2,0.25),OPEN+0.85)
# --- cheap stereo reverb (FFT convolution)
def verb(x,d=1.6,seed=0):
    r=np.random.default_rng(seed); ir=r.standard_normal(int(d*SR))*np.exp(-np.arange(int(d*SR))/SR*4.0); ir=lp(ir,0.3)
    n=len(x)+len(ir); F=1<<(n-1).bit_length(); return np.fft.irfft(np.fft.rfft(x,F)*np.fft.rfft(ir,F),F)[:len(x)]
wl,wr=verb(L,seed=1),verb(R,seed=2); s=np.max(np.abs(np.r_[wl,wr]))/max(np.max(np.abs(L)),1e-9)
L=L+wl/s*0.28; R=R+wr/s*0.28
fade=np.clip((N-np.arange(N))/(0.5*SR),0,1); L*=fade; R*=fade
m=np.max(np.abs(np.r_[L,R])); L=np.tanh(L/m*1.4)/np.tanh(1.4)*0.89; R=np.tanh(R/m*1.4)/np.tanh(1.4)*0.89
pcm=(np.stack([L,R],1)*32767).astype('<i2')
with wave.open('score_okto.wav','wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok')
