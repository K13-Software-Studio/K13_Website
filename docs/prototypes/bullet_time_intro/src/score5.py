import sys,os; sys.path.insert(0,os.path.expanduser("~/.claude/skills/motion-vid/bin"))
from sfx import *
init(5.0)
def rev(x): return x[::-1].copy()
add(pad([hz(n) for n in (38,50,57,62,65)],3.1,0.05),0.0)
add(pad([hz(n) for n in (38,50,57,62,66,69)],1.2,0.055),3.8)
add(tick(2400,0.05,0.35),0.03); add(whoosh(0.25,0.8,0.05,0.6,0.35),0.05)
kicks=[]
for i in range(3): tb=0.25+i*0.25; add(kick(0.6),tb); kicks.append(tb); add(hat(0.03),tb+0.125,0.35,0.3)
add(riser(0.45,0.5),0.95); add(whoosh(0.4,0.5,0.05,0.7,0.5),1.0); add(sizzle(0.6,0.2),1.3)
# freeze
n=noise(0.5); c=(n-lp(n,0.25))*np.exp(-tt(0.5)*6); add(rev(c)*0.45,1.25)
add(impact(1.8,1.0),1.75); add(shimmer(1.2,2600,0.05),1.8)
for tb in (2.25,2.75): add(kick(0.45),tb); add(kick(0.25),tb+0.18)
add(rev(whoosh(0.35,0.8,0.05,0.7,0.6)),2.65)
# release
add(impact(1.8,0.9),3.0); add(clap(),3.0,0.7)
for i in range(4): tb=3.0+i*0.25; add(kick(0.7),tb); kicks.append(tb); add(hat(),tb+0.125,0.6,0.3)
add(riser(0.4,0.4),3.6); add(shimmer(0.5,3600,0.08),3.8)
duck(kicks+[1.75,3.0],0.35)
for k,m in enumerate((74,78,81,86)): add(bell(hz(m),0.11),4.05+k*0.05,pan=-0.3+k*0.2)
for k in range(7): add(tick(3000+k*250,0.015,0.12),4.26+k*0.07,pan=-0.5+k*0.15)
add(pluck(hz(62),0.8,0.22),4.4)
master("score5.wav",fade=0.25)
