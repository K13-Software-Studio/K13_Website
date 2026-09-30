import numpy as np, wave
SR=48000; DUR=20.0; N=int(SR*DUR); rng=np.random.default_rng(13)
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


def click():
    t=tt(0.04); n=noise(0.04); return (n-lp(n,0.4))*np.exp(-t*400)*0.9+np.sin(2*np.pi*1800*t)*np.exp(-t*300)*0.4
def revswell(d,g=0.6):
    x=impact(d,1.0)[::-1]; return x*g
# A: one button (0-2.7) : airy pad, cursor, hover, press
add(pad([hz(n) for n in (50,57,64,69)],5.6,0.03),0.0)
add(pluck(hz(74),0.8,0.25),0.18)
for i in range(20): add(tick(3000+rng.random()*600,0.015,0.15),0.5+i*0.022,1,0.1)
add(whoosh(0.9,0.5,0.01,0.12,0.18),0.9,1,0.4)
add(tick(2200,0.03,0.4),1.8); add(click(),2.18,0.8)
add(revswell(0.5,0.5),2.2)
# B: exploded (2.6-5.4)
add(whoosh(0.8,0.6,g=0.5),2.55)
scale=[62,64,66,69,71,74,76,78]
for i,n in enumerate(scale): add(pluck(hz(n),0.9,0.3),2.95+i*0.07,1,-0.6+i*0.17)
for i in range(8):
    for k in range(10): add(tick(2800+i*120,0.012,0.1),3.55+i*0.11+k*0.03,1,0.4)
add(riser(0.95,0.8),4.5); add(whoosh(0.6,0.85,g=0.8),4.9)
# C: under the hood (5.4-10.1) at 132 bpm
add(impact(1.4,0.9),5.42)
b=60/132; t0=5.42
duck=np.ones(N)
k=t0
while k<10.0:
    add(kick(),k,0.9); i=int(k*SR); m=min(int(0.2*SR),N-i); duck[i:i+m]=np.minimum(duck[i:i+m],0.4+0.6*np.linspace(0,1,m)**0.5); k+=b
k=t0
while k<10.0:
    add(hat(0.04),k+b/2,0.9,0.3); add(hat(0.025),k+b/4,0.3,-0.3); add(hat(0.025),k+3*b/4,0.3,-0.3); k+=b
k=t0+b
while k<10.0: add(clap(),k,0.5); k+=2*b
for i,s in enumerate(np.arange(t0,10.0,b/2)):
    tt_=tt(0.2); f=hz([38,38,45,43][int(i/8)%4])*(2 if i%2 else 1); add(np.tanh(2.5*np.sin(2*np.pi*f*tt_))*np.exp(-tt_*10),s,0.2)
for i in range(9): add(tick(2400+i*150,0.02,0.3),5.45+[4,1,7,3,5,0,8,2,6][i]*0.11,1,(-1)**i*0.5)
add(pad([hz(n) for n in (45,52,57,60,64)],4.8,0.03),5.4)
add(riser(1.2,0.6),8.2); add(whoosh(1.0,0.5,g=0.5),8.3)
for i in range(30): add(tick(1500+rng.random()*2500,0.015,0.12),8.3+rng.random()*1.2,1,rng.uniform(-.8,.8))
L[:]*=duck; R[:]*=duck
# D: implosion (10.05-10.8) then silence, dot, button, click
add(revswell(0.75,0.9),10.05); add(riser(0.7,0.7),10.05)
add(pluck(hz(86),0.6,0.2),11.12)
add(pluck(hz(74),0.9,0.3),11.45); add(whoosh(0.45,0.5,0.01,0.12,0.15),11.45,1,0.5)
add(tick(2200,0.03,0.35),11.9); add(click(),12.0,1.1)
# E: punchline
add(impact(3.0,0.9),12.05); add(pad([hz(n) for n in (50,57,62,66,69,74)],4.3,0.05),12.05)
add(pluck(hz(62),2.4,0.35),12.05); add(pluck(hz(69),2.4,0.25),12.08)
for i in range(27): add(tick(2800+rng.random()*600,0.015,0.15),12.4+i*0.55/27,1,0)
add(pluck(hz(78),1.2,0.25),12.95); add(pluck(hz(81),1.2,0.25),13.37)
# F: lockup
add(whoosh(0.5,0.7,g=0.5),15.85); add(impact(3.0,1.1),16.35)
add(pad([hz(n) for n in (43,50,55,59,62,69)],3.7,0.05),16.35)
for i in range(15): add(tick(3500+rng.random()*1500,0.02,0.15),16.71+i*0.035,1,rng.uniform(-.6,.6))
add(shimmer(0.8,3200,0.14),17.3)
for i in range(15): add(tick(2800+rng.random()*600,0.02,0.2),17.95+i*0.4/15,1,0.2)
# --- cheap stereo reverb (FFT convolution)
def verb(x,d=1.6,seed=0):
    r=np.random.default_rng(seed); ir=r.standard_normal(int(d*SR))*np.exp(-np.arange(int(d*SR))/SR*4.0); ir=lp(ir,0.3)
    n=len(x)+len(ir); F=1<<(n-1).bit_length(); return np.fft.irfft(np.fft.rfft(x,F)*np.fft.rfft(ir,F),F)[:len(x)]
wl,wr=verb(L,seed=1),verb(R,seed=2); s=np.max(np.abs(np.r_[wl,wr]))/max(np.max(np.abs(L)),1e-9)
L=L+wl/s*0.28; R=R+wr/s*0.28
fade=np.clip((N-np.arange(N))/(0.5*SR),0,1); L*=fade; R*=fade
m=np.max(np.abs(np.r_[L,R])); L=np.tanh(L/m*1.4)/np.tanh(1.4)*0.89; R=np.tanh(R/m*1.4)/np.tanh(1.4)*0.89
pcm=(np.stack([L,R],1)*32767).astype('<i2')
with wave.open('score_v3.wav','wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok')
