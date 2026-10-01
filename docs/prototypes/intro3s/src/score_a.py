import sys,os; sys.path.insert(0,os.path.expanduser("~/.claude/skills/motion-vid/bin"))
from sfx import *
init(3.0)
# the pencil: a dry scratch for every stroke the hand draws
for a,b in ((0.00,0.42),(0.30,0.48),(0.42,0.56),(0.48,0.62),(0.54,0.68),(0.60,0.72),(0.66,0.80),(0.70,0.84),(0.62,0.86)):
    add(scratch(b-a,0.16),a,pan=-0.4+a)
add(pad([hz(n) for n in (50,57,62,66)],1.9,0.035),0.0)
# each sketch lands as the real thing: plucks walking up the chord
for t,n in ((0.92,62),(1.00,66),(1.02,69),(1.08,74),(1.18,78)): add(pluck(hz(n),0.7,0.2),t,pan=(n-70)/20)
add(click(),0.95,0.4)
# the window opens into the page
add(whoosh(0.8,0.7,0.03,0.6,0.45),1.75)
add(pad([hz(n) for n in (38,50,57,62,66,69)],1.2,0.05),1.9)
for k,n in enumerate((74,78,81)): add(bell(hz(n),0.09),2.5+k*0.05,pan=-0.2+k*0.2)
master("score_a.wav",fade=0.3)
