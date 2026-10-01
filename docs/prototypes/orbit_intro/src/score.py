import sys,os; sys.path.insert(0,os.path.expanduser("~/.claude/skills/motion-vid/bin"))
from sfx import *
import sfx
T=13.6; init(T)
# bed: D minor in the dark room, Bb lift at the orbit's peak, D major when the lights come up
add(pad([hz(n) for n in (38,50,57,62,65)],8.0,0.05),0.2)
add(pad([hz(n) for n in (34,46,53,58,62)],3.0,0.045),6.9)
add(pad([hz(n) for n in (38,50,57,62,66,69)],2.2,0.05),11.9)
# the projector lens: a tick, a flicker, the slit opening
add(tick(2400,0.05,0.35),0.20); 
for k in range(4): add(tick(3600,0.02,0.18),0.50+k*0.03,pan=0.2)
add(whoosh(0.35,0.8,0.05,0.6,0.35),0.72)
add(shimmer(1.4,1800,0.06),1.0)
# macro: a heartbeat under the glasses
for tb in (1.5,2.0): add(kick(0.45),tb)
# crash zoom out
add(riser(0.6,0.55),2.4); add(whoosh(0.6,0.85,0.03,0.7,0.6),2.45); add(impact(2.2,0.95),3.0); add(sizzle(1.2,0.18),3.0)
# groove on the orbit, 120 BPM
kicks=[]
for i in range(8):
    tb=3.0+i*0.5; add(kick(0.8),tb); kicks.append(tb)
    add(hat(),tb+0.25,0.8,0.3); 
    if i%2==1: add(clap(),tb,0.55)
for i in range(16): add(hat(0.03),3.0+i*0.25+0.125,0.35,-0.3)
# swoops past the lens
for i,tb in enumerate((3.75,4.75,5.75,6.75)): add(whoosh(0.6,0.55,0.03,0.55,0.45),tb,pan=(-0.6 if i%2 else 0.6))
# plucks walking the chord on the swoops
for tb,n in ((4.0,62),(5.0,65),(6.0,69),(7.0,70)): add(pluck(hz(n),0.8,0.22),tb)
# crane: riser into the hang, then real silence
add(riser(1.0,0.5),7.0)
# dive and landing
add(whoosh(0.7,0.9,0.02,0.75,0.7),8.9); add(impact(2.5,1.0),9.6); add(sizzle(1.3,0.2),9.6)
for tb in (10.0,10.5,11.0,11.5): add(kick(0.5),tb)
add(shimmer(1.6,2600,0.08),9.9)
# the drone's motor: a soft hum that follows the camera
t=tt(9.6); f=190+25*np.sin(2*np.pi*0.23*t)+60*np.clip((t-7.0)/1.0,0,1)
ph=2*np.pi*np.cumsum(f)/SR; hum=(np.sin(ph)+0.4*np.sin(2*ph)+0.2*np.sin(3.01*ph))*(0.6+0.4*np.sin(2*np.pi*31*t))
env=np.clip((t-2.9)/0.3,0,1)*np.clip((8.0-t)/0.05,0,1); env+=np.clip((t-8.9)/0.1,0,1)*np.clip((9.6-t)/0.05,0,1)
add(lp(hum*env,0.08)*0.10,0.0)
duck(kicks+[3.0,9.6],0.35)
# lights up
add(whoosh(0.4,0.6,0.1,0.8,0.25),11.8)
for k,n in enumerate((74,78,81,86)): add(bell(hz(n),0.12),12.0+k*0.07,pan=-0.3+k*0.2)
add(click(),12.95,0.6); add(pluck(hz(62),1.2,0.25),12.95)
master("score.wav")
