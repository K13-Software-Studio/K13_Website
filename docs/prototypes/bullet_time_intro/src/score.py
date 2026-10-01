import sys,os; sys.path.insert(0,os.path.expanduser("~/.claude/skills/motion-vid/bin"))
from sfx import *
T=14.0; init(T)
def rev(x): return x[::-1].copy()
def sub(d,f=41.2,g=.5):
    t=tt(d); return np.sin(2*np.pi*f*t)*np.sin(np.pi*t/d)**1.5*g
def timestop(g=1.0):  # a reversed cymbal sucked in, then a dull thump: time stops
    n=noise(0.7); c=(n-lp(n,0.25))*np.exp(-tt(0.7)*5)
    return rev(c)*0.5*g
# bed
add(pad([hz(n) for n in (38,50,57,62,65)],6.0,0.045),0.3)
add(pad([hz(n) for n in (34,46,53,58,62)],3.4,0.05),5.6)
add(pad([hz(n) for n in (36,48,55,60,64)],3.2,0.05),8.5)
add(pad([hz(n) for n in (38,50,57,62,66,69)],2.3,0.055),11.7)
# lens and slit
add(tick(2400,0.05,0.35),0.20)
for k in range(4): add(tick(3600,0.02,0.16),0.50+k*0.03,pan=0.2)
add(whoosh(0.4,0.8,0.05,0.6,0.35),0.55)
# the build: a pulse, the slab, the embossing
for i in range(4): add(kick(0.35),1.0+i*0.5); add(hat(0.03),1.25+i*0.5,0.3,0.3)
add(impact(1.2,0.35),1.4); add(shimmer(0.9,2000,0.06),2.4)
# FREEZE A
add(timestop(0.8),2.3); add(impact(1.6,0.8),3.0); add(sub(1.0,41.2,0.35),3.0)
add(shimmer(1.0,3200,0.035),3.0)
# release, ramp into the carve
add(clap(),4.0,0.7); add(whoosh(0.5,0.4,0.05,0.7,0.5),4.0); add(riser(0.9,0.5),4.05)
kicks=[4.0,4.5]
for tb in kicks: add(kick(0.8),tb)
for i in range(8): add(hat(0.03),4.0+i*0.125,0.35,-0.2)
add(impact(1.4,0.7),4.9)
# slow motion: everything drops in pitch and air
add(whoosh(1.0,0.3,0.01,0.25,0.5),5.0); add(sizzle(1.0,0.22),5.0)
# FREEZE B: the hero. time stops, a heartbeat, the room breathes
add(timestop(1.0),5.3); add(impact(2.4,1.0),6.0); add(sub(2.4,36.7,0.45),6.0)
add(shimmer(2.4,2600,0.05),6.05)
for tb in (6.5,7.0,7.5,8.0): add(kick(0.45),tb); add(kick(0.25),tb+0.18)
add(pluck(hz(74),1.2,0.16),7.2,pan=-0.3); add(pluck(hz(77),1.2,0.14),7.7,pan=0.3)
add(rev(whoosh(0.5,0.8,0.05,0.7,0.6)),8.0)
# release: the drop
add(impact(2.6,1.0),8.5); add(clap(),8.5,0.8)
for i in range(8):
    tb=8.5+i*0.5; add(kick(0.85),tb); kicks.append(tb); add(hat(),tb+0.25,0.8,0.3)
    if i%2==1: add(clap(),tb,0.5)
for i in range(14): add(hat(0.03),8.5+i*0.25+0.125,0.3,-0.3)
# salute motif, D minor walking up
for tb,n in ((9.5,62),(10.0,65),(10.5,69),(11.0,72)): add(pluck(hz(n),0.8,0.22),tb)
# chisel
add(scratch(0.65,0.4),10.9); add(sizzle(0.8,0.25),10.9)
for k in range(9): add(tick(5200-k*200,0.015,0.12),10.9+k*0.07,pan=-0.6+k*0.15)
# glint, lights up
add(riser(0.7,0.45),11.45); add(shimmer(0.8,3600,0.08),11.55)
duck(kicks+[3.0,6.0,8.5],0.35)
add(whoosh(0.4,0.6,0.1,0.8,0.3),11.95)
for k,n in enumerate((74,78,81,86)): add(bell(hz(n),0.12),12.1+k*0.07,pan=-0.3+k*0.2)
add(click(),12.95,0.6); add(pluck(hz(62),1.4,0.25),13.05); add(pluck(hz(69),1.2,0.18),13.2)
master("score.wav")
