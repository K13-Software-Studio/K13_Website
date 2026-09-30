import numpy as np, wave
SR=48000; DUR=15.0; N=int(SR*DUR); rng=np.random.default_rng(13)
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

# --- music bed
chords=[(0.0,6.0,[50,57,62,66,69,76]),(6.0,10.0,[47,54,62,66,69,73]),(10.0,12.36,[43,55,59,62,66,69]),(12.36,15.0,[50,57,62,66,69,71,76])]
for a,b,ns in chords: add(pad([hz(n) for n in ns],b-a+0.4,0.045),a)
# groove
duck=np.ones(N)
for k in np.arange(1.5,11.51,0.5):
    add(kick(),k,0.9)
    i=int(k*SR); m=min(int(0.25*SR),N-i); duck[i:i+m]=np.minimum(duck[i:i+m],0.35+0.65*np.linspace(0,1,m)**0.5)
for h in np.arange(1.75,11.6,0.5): add(hat(0.06),h,0.9,0.3)
for h in np.arange(4.0,11.6,0.25): add(hat(0.03),h+0.125,0.35,-0.3)
for c in np.arange(4.5,11.6,1.0): add(clap(),c,0.55)
# bass 8ths
roots={(4.0,6.0):38,(6.0,10.0):35,(10.0,11.5):31}
for (a,b),n in roots.items():
    for s in np.arange(a,b,0.25):
        t=tt(0.22); f=hz(n)*(2 if int(s*4)%2 else 1); add(np.tanh(2*np.sin(2*np.pi*f*t))*np.exp(-t*9),s,0.22)
L*=duck; R*=duck
# --- sound design
for i in range(22): add(tick(2600+rng.random()*900),0.12+i*0.62/22,0.8,rng.uniform(-.3,.3))
add(riser(0.32,0.4),0.9); add(impact(1.2,0.7),1.22); add(whoosh(0.5,0.3,g=0.6),1.2)
for j,s in enumerate([1.5,2.0,2.5]): add(pluck(hz([74,78,81][j]),0.6,0.35),s,1,[-.3,0,.3][j])
add(shimmer(0.5,1800,0.08),2.95)
add(riser(0.5,0.6),3.5); add(whoosh(0.55,0.8,g=0.7),3.45); add(impact(1.5,0.8),4.0)
for i in range(14): add(tick(1800+i*60,0.02,0.18),4.0+i*0.035,1,-0.4)   # wireframe drawing
add(whoosh(0.45,0.5,g=0.55),4.62,1,0.5); add(pluck(hz(86),0.5,0.4),4.72)
add(pluck(hz(90),0.8,0.45),5.35,1,0.4); add(pluck(hz(97),0.8,0.25),5.43,1,0.4)
add(whoosh(0.6,0.6,g=0.8),5.65); add(impact(1.2,0.6),6.0)
for i in range(13): add(tick(3000+(i%3)*400,0.025,0.3),6.3+i*0.13,1,(-1)**i*0.35)
for i,c in enumerate([7.95,8.2,8.45,8.7,8.95,9.2]): add(kick(0.7),c); add(whoosh(0.18,0.7,0.1,0.8,0.5),c-0.08,1,(-1)**i*0.5); add(hat(0.12),c,1.2)
add(whoosh(0.6,0.6,g=0.8),9.4); add(impact(1.0,0.5),10.0)
for ci,st in enumerate([10.0,10.25,10.5]):
    s=st
    for k in range(18): s+=0.02+0.06*(k/18)**2; add(tick(2400+ci*500,0.015,0.2),s,1,[-.5,0,.5][ci])
add(whoosh(0.35,0.7,g=0.5),11.0); add(pluck(hz(81),0.7,0.4),11.3,1,-0.5); add(pluck(hz(85),0.7,0.4),11.38,1,0.5); add(shimmer(0.45,2200,0.08),11.6)
add(riser(0.9,0.9),11.46)
add(impact(2.6,1.3),12.36); add(pluck(hz(62),2.0,0.3),12.36); add(pluck(hz(74),2.0,0.2),12.36)
for i in range(15): add(tick(3500+rng.random()*1500,0.02,0.15),12.72+i*0.035,1,rng.uniform(-.6,.6))
add(shimmer(0.8,3200,0.14),13.3)
for i in range(15): add(tick(2800+rng.random()*600,0.02,0.2),13.95+i*0.4/15,1,0.2)

# --- cheap stereo reverb (FFT convolution)
def verb(x,d=1.6,seed=0):
    r=np.random.default_rng(seed); ir=r.standard_normal(int(d*SR))*np.exp(-np.arange(int(d*SR))/SR*4.0); ir=lp(ir,0.3)
    n=len(x)+len(ir); F=1<<(n-1).bit_length(); return np.fft.irfft(np.fft.rfft(x,F)*np.fft.rfft(ir,F),F)[:len(x)]
wl,wr=verb(L,seed=1),verb(R,seed=2); s=np.max(np.abs(np.r_[wl,wr]))/max(np.max(np.abs(L)),1e-9)
L=L+wl/s*0.28; R=R+wr/s*0.28
fade=np.clip((N-np.arange(N))/(0.5*SR),0,1); L*=fade; R*=fade
m=np.max(np.abs(np.r_[L,R])); L=np.tanh(L/m*1.4)/np.tanh(1.4)*0.89; R=np.tanh(R/m*1.4)/np.tanh(1.4)*0.89
pcm=(np.stack([L,R],1)*32767).astype('<i2')
with wave.open('score_v2.wav','wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok')
