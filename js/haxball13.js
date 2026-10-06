/* K13 Kickoff (js/haxball13.js): top-down physics football on the workbench. Tokens come from css/site.css.
   Players are circles that glide (acceleration, then damping), the ball is a circle with elastic contacts, the kick button
   hits the ball when it is within reach and the player's ring lights while kick is held. Two goals with posts, a kickoff
   after every goal, first to 3 or the better score at 3:00 (level at full time: next goal wins).
   Modes: 1 vs CPU (Template FC steers, positions between ball and goal, and shoots) or 2 players on one keyboard.
   The loop is a fixed 60 Hz step behind an accumulator (two sub-steps each, so a fast ball never tunnels a wall) and draws to a
   devicePixelRatio-crisp canvas. The clock stops when the board loses focus, the card leaves the screen or the tab is hidden.
   prefers-reduced-motion: no particles, no rings, no panel rise, no idle motion. The game itself still plays.
   Keyboard (board focused): 1P arrows or WASD move, X or Space kick. 2P: Gangaa WASD + Space (or Left Shift), Gurkan arrows +
   Enter (or / or .). R restarts, Esc or P pauses. Touch: drag on the left half of the board to steer, press and hold the right
   half or the Kick button to kick. */
(function(){
"use strict";

var mount=document.querySelector('[data-game="haxball13"]');
if(!mount) return;

/* ---------- the pitch, in world units (one unit is about one screen pixel at 812 wide) ---------- */
var WW=812, WH=380, PX0=36, PX1=776, PY0=20, PY1=360, CY=190, GH=64, GD=26, MID=(PX0+PX1)/2, CR=70;
var PR=15, BR=10, POST=5, REACH=5;
var ACC=.1, ACC_K=.07, DAMP=.96, BDAMP=.99, KICK=5, BMAX=10, WALL_E=.55, HIT_E=.5;
var DT=1/60, WIN=3, MATCH=180, GOAL_T=1.7;

var SEGS=[
  [PX0,PY0,PX1,PY0],[PX0,PY1,PX1,PY1],
  [PX0,PY0,PX0,CY-GH],[PX0,CY+GH,PX0,PY1],[PX1,PY0,PX1,CY-GH],[PX1,CY+GH,PX1,PY1],
  [PX0-GD,CY-GH,PX0,CY-GH],[PX0-GD,CY+GH,PX0,CY+GH],[PX0-GD,CY-GH,PX0-GD,CY+GH],
  [PX1,CY-GH,PX1+GD,CY-GH],[PX1,CY+GH,PX1+GD,CY+GH],[PX1+GD,CY-GH,PX1+GD,CY+GH]
];
var POSTS=[PX0,PX1].reduce(function(a,x){ a.push({x:x,y:CY-GH,vx:0,vy:0,r:POST,im:0},{x:x,y:CY+GH,vx:0,vy:0,r:POST,im:0}); return a; },[]);

/* ---------- small helpers ---------- */
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
function clamp(v,a,b){ return v<a?a:v>b?b:v; }

/* ---------- card chrome: the same DOM and classes as card() in workbench.js ---------- */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","K13 Kickoff")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Put it in their goal before they put it in yours. First to 3, or the better score at 3:00. Hold kick near the ball and your ring lights."); instr.id="hx-i"; mount.appendChild(instr);
var stage=el("div","wb-stage hx-stage"); stage.setAttribute("aria-describedby","hx-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Restart the match"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Gangaa: WASD and Space. Gürkan: arrows and Enter. Playing alone, either set works, and so does X. On a phone, drag the left half to steer and hold the right half to kick. Your record stays on this device. For Gangaa and Gürkan, who know exactly how this should feel."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var top=el("div","hx-top");
var hA=txt("span","hx-chip hx-a",""), hClock=txt("span","hx-chip hx-clock",""), hB=txt("span","hx-chip hx-b",""), hRec=txt("span","hx-chip hx-rec","");
top.appendChild(hA); top.appendChild(hClock); top.appendChild(hB); top.appendChild(hRec); stage.appendChild(top);
var view=el("div","hx-view"); stage.appendChild(view);
var cv=el("canvas","hx-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","K13 Kickoff pitch. Orange on the left, graphite on the right. Arrow keys or WASD move, X or Space kick. Drag on a touch screen.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var over=el("div","hx-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Match"); view.appendChild(over);
var bar=el("div","hx-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Controls"); stage.appendChild(bar);
bar.appendChild(txt("span","hx-lab","Mode"));
var bOne=txt("button","hx-btn","1 vs CPU"), bTwo=txt("button","hx-btn","2 players");
bOne.type="button"; bTwo.type="button"; bar.appendChild(bOne); bar.appendChild(bTwo);
var bPause=txt("button","hx-btn hx-pause","Pause"); bPause.type="button"; bar.appendChild(bPause);
var bKick=txt("button","hx-btn hx-kick","Kick"); bKick.type="button"; bKick.setAttribute("aria-label","Kick, hold it while the ball is within reach"); bar.appendChild(bKick);

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store("k13_haxball13")||"null"); if(s&&s.cpu&&s.cpu.length===2&&s.two&&s.two.length===2&&(s.mode==="1p"||s.mode==="2p")) return s; }catch(e){} return {mode:"1p",cpu:[0,0],two:[0,0]}; })();
function persist(){ store("k13_haxball13",JSON.stringify(save)); }
var NAMES={"1p":["You","Template FC"],"2p":["Gangaa","Gürkan"]};
var game="ready", phase="kickoff", phaseT=0, kickTeam=0, score=[0,0], clock=MATCH, sudden=false, lastScorer=-1, finished=false;
var P=[mkP(0),mkP(1)], B={x:MID,y:CY,vx:0,vy:0,r:BR,im:1,ang:0};
var keys={}, latch=[0,0], touch={kick:false,stick:null,kickId:-1}, fx=[], W=0, H=0, sc=1, dprv=1, vis=false, raf=0, acc=0, last=0, pal=null, inp=[{ax:0,ay:0,kick:false},{ax:0,ay:0,kick:false}];
var aiS={cd:0,tx:PX1-90,ty:CY,kick:false,aim:0,err:0,n:0};

function mkP(team){ return {x:0,y:0,vx:0,vy:0,r:PR,im:.5,team:team,kick:false,kicked:false,ring:0}; }
function names(){ return NAMES[save.mode]; }
function placeKickoff(kt){
  kickTeam=kt; phase="kickoff"; phaseT=0; aiS.cd=0;
  P[0].x=PX0+(PX1-PX0)*.25; P[1].x=PX1-(PX1-PX0)*.25;
  P[0].y=CY; P[1].y=CY;
  P.forEach(function(p){ p.vx=0; p.vy=0; p.kick=false; p.kicked=false; });
  B.x=MID; B.y=CY; B.vx=0; B.vy=0;
}
function newMatch(){
  score=[0,0]; clock=MATCH; sudden=false; lastScorer=-1; finished=false; fx.length=0; keys={}; latch=[0,0]; touch.kick=false; touch.stick=null;
  placeKickoff(0); hud();
}

/* ---------- physics ---------- */
function hit(a,b,e){
  var dx=b.x-a.x, dy=b.y-a.y, rr=a.r+b.r, d2=dx*dx+dy*dy;
  if(d2>=rr*rr||d2===0) return false;
  var d=Math.sqrt(d2), nx=dx/d, ny=dy/d, sm=a.im+b.im, pen=rr-d;
  a.x-=nx*pen*a.im/sm; a.y-=ny*pen*a.im/sm; b.x+=nx*pen*b.im/sm; b.y+=ny*pen*b.im/sm;
  var vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(vn<0){ var j=-(1+e)*vn/sm; a.vx-=j*a.im*nx; a.vy-=j*a.im*ny; b.vx+=j*b.im*nx; b.vy+=j*b.im*ny; }
  return true;
}
function wall(o,s){
  var ax=s[0], ay=s[1], dx=s[2]-ax, dy=s[3]-ay, t=clamp(((o.x-ax)*dx+(o.y-ay)*dy)/(dx*dx+dy*dy),0,1);
  var nx=o.x-(ax+dx*t), ny=o.y-(ay+dy*t), d=Math.sqrt(nx*nx+ny*ny);
  if(d>=o.r||d===0) return;
  nx/=d; ny/=d; o.x+=nx*(o.r-d); o.y+=ny*(o.r-d);
  var vn=o.vx*nx+o.vy*ny; if(vn<0){ o.vx-=(1+WALL_E)*vn*nx; o.vy-=(1+WALL_E)*vn*ny; }
}
function solid(o){ var i; for(i=0;i<SEGS.length;i++) wall(o,SEGS[i]); for(i=0;i<POSTS.length;i++) hit(POSTS[i],o,HIT_E); }

function kickCheck(p,i){
  if(!p.kick){ p.kicked=false; return; }
  if(p.kicked) return;
  var dx=B.x-p.x, dy=B.y-p.y, d=Math.sqrt(dx*dx+dy*dy);
  if(d<=p.r+B.r+REACH&&d>0){
    B.vx+=dx/d*KICK; B.vy+=dy/d*KICK; p.kicked=true;
    if(!calm()) fx.push({k:"ring",x:B.x,y:B.y,t:0,c:i});
  }
}
function step(){
  var i, p, live=phase!=="goal";
  for(i=0;i<2;i++){
    p=P[i]; var I=inp[i];
    p.kick=live&&I.kick; if(!live){ I.ax=0; I.ay=0; }
    var m=Math.sqrt(I.ax*I.ax+I.ay*I.ay), a=p.kick?ACC_K:ACC; if(m>1){ I.ax/=m; I.ay/=m; }
    p.vx+=I.ax*a; p.vy+=I.ay*a; p.vx*=DAMP; p.vy*=DAMP;
    p.ring=p.kick?1:0;
  }
  for(i=0;i<2;i++) kickCheck(P[i],i);
  B.vx*=BDAMP; B.vy*=BDAMP;
  var bs=Math.sqrt(B.vx*B.vx+B.vy*B.vy); if(bs>BMAX){ B.vx*=BMAX/bs; B.vy*=BMAX/bs; }
  var s, n;
  for(s=0;s<2;s++){
    P.forEach(function(q){ q.x+=q.vx*.5; q.y+=q.vy*.5; }); B.x+=B.vx*.5; B.y+=B.vy*.5;
    for(n=0;n<2;n++){
      hit(P[0],P[1],HIT_E); hit(P[0],B,HIT_E); hit(P[1],B,HIT_E);
      solid(P[0]); solid(P[1]); solid(B);
      if(phase==="kickoff") lockCircle();
    }
  }
  B.ang+=(B.vx*.06);
  if(phase==="kickoff"&&Math.sqrt(B.vx*B.vx+B.vy*B.vy)>.15){ phase="live"; say("Ball is live. Clock running."); }
  if(phase==="live"){
    if(!sudden){ clock-=DT; if(clock<=0){ clock=0; fullTime(); } }
    if(B.x+B.r<PX0) goal(1); else if(B.x-B.r>PX1) goal(0);
  } else if(phase==="goal"){
    phaseT-=DT; if(phaseT<=0) afterGoal();
  }
}
/* before the first touch the side that did not kick off stays out of the centre circle */
function lockCircle(){
  var q=P[1-kickTeam], dx=q.x-MID, dy=q.y-CY, d=Math.sqrt(dx*dx+dy*dy), lim=CR+q.r;
  if(d<lim){ if(d===0){ dx=kickTeam?-1:1; dy=0; d=1; } var nx=dx/d, ny=dy/d; q.x=MID+nx*lim; q.y=CY+ny*lim; var vn=q.vx*nx+q.vy*ny; if(vn<0){ q.vx-=vn*nx; q.vy-=vn*ny; } }
}
function fullTime(){
  if(score[0]!==score[1]){ finish(); return; }
  sudden=true; say("Level at full time. Next goal wins.");
}
function goal(team){
  score[team]++; lastScorer=team; phase="goal"; phaseT=GOAL_T; hud();
  var n=names();
  if(!calm()) for(var i=0;i<26;i++){ var a=Math.random()*Math.PI*2, v=1+Math.random()*3.2; fx.push({k:"dot",x:team?PX1+GD*.5:PX0-GD*.5,y:CY,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0,c:team}); }
  say("Goal, "+n[team]+". "+score[0]+" to "+score[1]+".");
  if(score[team]>=WIN||sudden) finished=true;
}
function afterGoal(){
  if(finished){ finish(); return; }
  placeKickoff(1-lastScorer); say("Kickoff, "+names()[kickTeam]+". The other side stays out of the circle until the ball moves.");
}
function finish(){
  game="over"; finished=true; var n=names(), w=score[0]>score[1]?0:1, one=save.mode==="1p";
  var rec=one?save.cpu:save.two; rec[w===0?0:1]+=1; persist(); hud();
  var title, sub=score[w]+" to "+score[1-w]+". ";
  if(one) title=w===0?"You win.":"Template FC wins.";
  else title=n[w]+" wins.";
  if(one) sub+=w===0?"The template did not see that coming.":"A template did that. It happens to the best of us.";
  else sub+="Series: "+n[0]+" "+rec[0]+", "+n[1]+" "+rec[1]+".";
  panel(title,sub,[{label:"Play again",go:function(){ restart(); }},{label:one?"Try 2 players":"Try 1 vs CPU",ghost:true,go:function(){ setMode(one?"2p":"1p"); }}]);
  say(title+" "+sub);
}

/* ---------- Template FC: chase, line up behind the ball, shoot; drop back between ball and goal when the other side has it ---------- */
function think(p,o){
  var dx=B.x-p.x, dy=B.y-p.y, dB=Math.sqrt(dx*dx+dy*dy), ox=B.x-o.x, oy=B.y-o.y, dO=Math.sqrt(ox*ox+oy*oy), R=p.r+B.r;
  aiS.aim=o.y<CY?1:-1; aiS.err=(Math.random()-.5)*.14;
  if(phase==="kickoff"&&kickTeam===0){ aiS.tx=MID+120; aiS.ty=CY; aiS.kick=false; return; }
  var lead=Math.min(14,dB/4), bx=B.x+B.vx*lead, by=B.y+B.vy*lead;
  var gy=CY+aiS.aim*34, tx=PX0-bx, ty=gy-by, tl=Math.sqrt(tx*tx+ty*ty)||1;
  var c=Math.cos(aiS.err), s=Math.sin(aiS.err), ux=(tx*c-ty*s)/tl, uy=(tx*s+ty*c)/tl;
  var defend=B.x<MID-50&&dO<dB-20&&dO<170;
  aiS.kick=false;
  if(defend){
    var gx=PX1-B.x, gyy=CY-B.y, gl=Math.sqrt(gx*gx+gyy*gyy)||1, back=clamp(gl/2.2,70,200);
    aiS.tx=Math.max(MID+30,PX1-gx/gl*back); aiS.ty=clamp(CY-gyy/gl*back,PY0+PR,PY1-PR);
    if(dB<=R+REACH) aiS.kick=true;
    return;
  }
  /* a ball hugging a wall cannot be lined up from behind: charge it and tap kick, so it rebounds out of the corner */
  if(bx<PX1-120&&(by<PY0+34||by>PY1-34||(bx<PX0+34&&Math.abs(by-CY)>GH-4))){
    aiS.tx=clamp(bx,PX0+PR,PX1-PR); aiS.ty=clamp(by,PY0+PR,PY1-PR); aiS.kick=dB<=R+REACH&&(++aiS.n%2===0); return;
  }
  var rel=(p.x-bx)*(-ux)+(p.y-by)*(-uy);
  if(rel>8){
    var lat=Math.abs((p.x-bx)*(-uy)+(p.y-by)*ux);
    if(dB<R+36&&lat<R){ aiS.tx=bx+ux*40; aiS.ty=by+uy*40; }
    else { aiS.tx=bx-ux*(R+10); aiS.ty=by-uy*(R+10); }
  } else {
    var px=-uy, py=ux, side=((p.x-bx)*px+(p.y-by)*py)>=0?1:-1;
    aiS.tx=bx+px*side*(R+34)-ux*30; aiS.ty=by+py*side*(R+34)-uy*30;
  }
  aiS.tx=clamp(aiS.tx,PX0+PR,PX1-PR); aiS.ty=clamp(aiS.ty,PY0+PR,PY1-PR);
  if(dB<=R+REACH){
    var al=(dx*ux+dy*uy)/(dB||1);
    if(al>.72||(B.x>PX1-170&&dx<0)) aiS.kick=true;
  }
}
function aiInput(p,o){
  if(--aiS.cd<=0){ aiS.cd=5; think(p,o); }
  var dx=aiS.tx-p.x, dy=aiS.ty-p.y, d=Math.sqrt(dx*dx+dy*dy), ax=0, ay=0;
  if(d>2){ var sp=Math.min(1,d/45); ax=dx/d*sp; ay=dy/d*sp; }
  if(d<60){ ax-=p.vx*.28; ay-=p.vy*.28; }
  return {ax:ax*.94,ay:ay*.94,kick:aiS.kick};
}

/* ---------- input ---------- */
var K1U={KeyW:1},K1D={KeyS:1},K1L={KeyA:1},K1R={KeyD:1}, K2U={ArrowUp:1},K2D={ArrowDown:1},K2L={ArrowLeft:1},K2R={ArrowRight:1};
var KK1={Space:1,ShiftLeft:1}, KK2={Enter:1,Slash:1,Period:1,ShiftRight:1}, KKX={KeyX:1};
function merge(a,b){ var o={}, k; for(k in a) o[k]=1; for(k in b) o[k]=1; return o; }
var MU=merge(K1U,K2U), MD=merge(K1D,K2D), ML=merge(K1L,K2L), MR=merge(K1R,K2R);
var HANDLED={};
[K1U,K1D,K1L,K1R,K2U,K2D,K2L,K2R,KK1,KK2,KKX].forEach(function(m){ for(var k in m) HANDLED[k]=1; });
function any(set){ for(var k in set) if(keys[k]) return true; return false; }
function axis(U,D,L,R){ return {x:(any(R)?1:0)-(any(L)?1:0),y:(any(D)?1:0)-(any(U)?1:0)}; }
function stickVec(){
  var s=touch.stick; if(!s||!s.on) return null;
  var dx=s.x-s.x0, dy=s.y-s.y0, L=Math.sqrt(dx*dx+dy*dy); if(L<7) return {x:0,y:0};
  var m=Math.min(1,L/42); return {x:dx/L*m,y:dy/L*m};
}
function readInputs(){
  var one=save.mode==="1p", a1, a2, k1, k2;
  if(one){
    a1=axis(MU,MD,ML,MR);
    k1=any(KK1)||any(KK2)||any(KKX);
  } else {
    a1=axis(K1U,K1D,K1L,K1R); a2=axis(K2U,K2D,K2L,K2R); k1=any(KK1); k2=any(KK2);
  }
  var sv=stickVec(); if(sv&&(sv.x||sv.y)) a1={x:sv.x,y:sv.y};
  k1=k1||touch.kick||latch[0]>0;
  inp[0].ax=a1.x; inp[0].ay=a1.y; inp[0].kick=k1;
  if(one){ var c=aiInput(P[1],P[0]); inp[1].ax=c.ax; inp[1].ay=c.ay; inp[1].kick=c.kick; }
  else { inp[1].ax=a2.x; inp[1].ay=a2.y; inp[1].kick=k2||latch[1]>0; }
  if(latch[0]>0) latch[0]--; if(latch[1]>0) latch[1]--;
}

cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(HANDLED[e.code]){
    e.preventDefault(); keys[e.code]=1;
    if(KK1[e.code]||KKX[e.code]) latch[0]=6; if(KK2[e.code]) latch[save.mode==="1p"?0:1]=6;
    if(game==="ready"||game==="paused") begin();
  } else if(e.code==="Escape"||e.code==="KeyP"){ if(game==="play"){ e.preventDefault(); pause(); } }
  else if(e.code==="KeyR"){ e.preventDefault(); restart(); }
});
cv.addEventListener("keyup",function(e){ if(HANDLED[e.code]){ e.preventDefault(); keys[e.code]=0; } });
/* a press on this card's own buttons moves focus off the board; that is not "clicking away" */
var ownPress=0;
stage.addEventListener("pointerdown",function(e){ if(e.target!==cv){ ownPress=Date.now(); } },true);
cv.addEventListener("blur",function(e){
  keys={}; touch.stick=null; touch.kick=false;
  if(game==="play"&&Date.now()-ownPress>600&&!(e.relatedTarget&&e.relatedTarget===bKick)) pause("You clicked away, so the clock stopped.");
});
cv.addEventListener("pointerdown",function(e){
  if(e.button>0) return; e.preventDefault(); focusBoard();
  if(game==="ready"||game==="paused") begin();
  if(game!=="play") return;
  var r=cv.getBoundingClientRect(), left=e.clientX-r.left<r.width*.5;
  if(left&&!touch.stick){ touch.stick={on:true,id:e.pointerId,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY}; }
  else if(!left&&!touch.kick){ touch.kick=true; touch.kickId=e.pointerId; latch[0]=6; }
  try{ cv.setPointerCapture(e.pointerId); }catch(x){}
});
cv.addEventListener("pointermove",function(e){ var s=touch.stick; if(s&&s.id===e.pointerId){ s.x=e.clientX; s.y=e.clientY; } });
function lift(e){ if(touch.stick&&touch.stick.id===e.pointerId) touch.stick=null; if(touch.kick&&touch.kickId===e.pointerId) touch.kick=false; }
cv.addEventListener("pointerup",lift); cv.addEventListener("pointercancel",lift);
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });

/* the Kick button: hold it for a held kick, tap it for a short one, Enter or Space on it works too */
var bkId=-1;
bKick.addEventListener("mousedown",function(e){ e.preventDefault(); });
bKick.addEventListener("pointerdown",function(e){
  if(e.button>0) return; e.preventDefault(); if(game==="ready"||game==="paused") begin();
  touch.kick=true; bkId=e.pointerId; latch[0]=6; try{ bKick.setPointerCapture(e.pointerId); }catch(x){}
});
function bkLift(e){ if(bkId===e.pointerId){ touch.kick=false; bkId=-1; } }
bKick.addEventListener("pointerup",bkLift); bKick.addEventListener("pointercancel",bkLift);
bKick.addEventListener("click",function(e){ if(e.detail===0){ if(game==="ready"||game==="paused") begin(); latch[0]=8; } });
bKick.addEventListener("contextmenu",function(e){ e.preventDefault(); });

function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function panel(title,sub,buttons){
  over.innerHTML=""; var p=el("div","hx-panel");
  p.appendChild(txt("div","hx-over-t",title)); if(sub) p.appendChild(txt("p","hx-over-s",sub));
  var row=el("div","hx-over-row");
  buttons.forEach(function(b){ var x=txt("button","hx-obtn"+(b.ghost?" ghost":""),b.label); x.type="button"; x.addEventListener("click",b.go); row.appendChild(x); });
  p.appendChild(row); over.appendChild(p); over.hidden=false;
  return row.firstChild;
}
function readyPanel(){
  var n=names(), one=save.mode==="1p";
  var b=panel("K13 Kickoff",one?"You are orange, on the left. Template FC defends the right goal. Move with the arrows or WASD, kick with X or Space.":"Gangaa is orange on the left, Gürkan is graphite on the right. One keyboard, two sets of keys, first to "+WIN+".",[{label:"Kick off",go:function(){ begin(); }}]);
  say(one?"1 vs CPU. "+n[0]+" against "+n[1]+". Press Kick off or any move key.":"2 players. "+n[0]+" against "+n[1]+". Press Kick off or any move key.");
  return b;
}
function begin(){
  if(finished&&game==="over") return;
  over.hidden=true; if(game!=="paused") say("Kickoff, "+names()[kickTeam]+".");
  game="play"; focusBoard(); last=0; refreshBar(); wake();
}
function pause(why){
  if(game!=="play") return; game="paused"; keys={}; touch.stick=null; touch.kick=false;
  panel("Paused",why||"The ball waits for you.",[{label:"Continue",go:function(){ begin(); }}]); refreshBar();
}
function restart(){ newMatch(); begin(); }
function setMode(m){
  save.mode=m; persist(); game="ready"; newMatch(); readyPanel(); refreshBar(); hud(); wake(); draw();
}
bOne.addEventListener("click",function(){ if(save.mode!=="1p") setMode("1p"); });
bTwo.addEventListener("click",function(){ if(save.mode!=="2p") setMode("2p"); });
bPause.addEventListener("click",function(){ if(game==="play") pause("You paused it."); else if(game==="paused"||game==="ready") begin(); });
reset.addEventListener("click",restart);
function refreshBar(){
  bOne.setAttribute("aria-pressed",String(save.mode==="1p")); bTwo.setAttribute("aria-pressed",String(save.mode==="2p"));
  bPause.textContent=game==="paused"?"Resume":game==="ready"?"Start":"Pause";
  bPause.disabled=game==="over";
}
function fmt(t){ var s=Math.ceil(t); return Math.floor(s/60)+":"+(s%60<10?"0":"")+(s%60); }
var sig="";
function hud(){
  var n=names(), rec=save.mode==="1p"?save.cpu:save.two;
  var s=[score[0],score[1],sudden?"s":Math.ceil(clock),save.mode,rec[0],rec[1]].join("|"); if(s===sig) return; sig=s;
  hA.textContent=n[0]+" "+score[0]; hB.textContent=n[1]+" "+score[1];
  hClock.textContent=sudden?"Next goal wins":fmt(clock);
  hRec.textContent="Record "+rec[0]+" to "+rec[1];
  hA.setAttribute("aria-label",n[0]+" "+score[0]); hB.setAttribute("aria-label",n[1]+" "+score[1]);
}

/* ---------- loop ---------- */
function frame(now){
  raf=0; if(!vis) return;
  if(!last) last=now; var el2=Math.min(.1,(now-last)/1000); last=now;
  if(game==="play"){ acc+=el2; while(acc>=DT){ readInputs(); step(); acc-=DT; if(game!=="play"){ acc=0; break; } } }
  for(var i=fx.length-1;i>=0;i--){ var f=fx[i]; f.t+=el2; if(f.k==="dot"){ f.x+=f.vx*el2*60; f.y+=f.vy*el2*60; f.vx*=.96; f.vy*=.96; } if(f.t>(f.k==="ring"?.3:.9)) fx.splice(i,1); }
  hud(); draw();
  if(vis&&(game==="play"||fx.length)) raf=requestAnimationFrame(frame);
}
function wake(){ if(!raf&&vis){ last=0; raf=requestAnimationFrame(frame); } draw(); }

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement), dark=document.documentElement.getAttribute("data-theme")==="dark";
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  return {orange:v("--blue-2","#EA5E14"),graph:"#1F2023",ink:v("--ink","#1F2023"),paper:v("--paper-2","#FFFFFF"),
    g1:dark?"#2D352E":"#CFD9CA",g2:dark?"#293029":"#C7D2C2",apron:dark?"#222823":"#BAC6B5",
    chalk:dark?"rgba(236,238,232,.5)":"rgba(255,255,255,.9)",chalk2:dark?"rgba(236,238,232,.16)":"rgba(255,255,255,.4)",
    ball:"#F6F2EA",ringc:"#FFFFFF",lab:v("--muted","#5D5F65"),dark:dark};
}
new MutationObserver(function(){ pal=null; wake(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function fit(){
  var r=view.getBoundingClientRect(); if(!r.width) return;
  dprv=Math.min(window.devicePixelRatio||1,2); W=r.width; H=r.height; sc=W/WW;
  cv.width=Math.round(W*dprv); cv.height=Math.round(H*dprv); draw();
}
function teamCol(t){ return t===0?pal.orange:pal.graph; }
function draw(){
  if(!W) return; if(!pal) pal=palette();
  var c=pal, i, lw=Math.max(1.5,1.4/sc);
  ctx.setTransform(dprv*sc,0,0,dprv*sc,0,0); ctx.clearRect(0,0,WW,WH);
  ctx.fillStyle=c.apron; ctx.fillRect(0,0,WW,WH);
  /* grass bands */
  var bw=(PX1-PX0)/10; for(i=0;i<10;i++){ ctx.fillStyle=i%2?c.g2:c.g1; ctx.fillRect(PX0+i*bw,PY0,bw+.5,PY1-PY0); }
  /* the nets: each goal tinted in the colour of the side that defends it */
  [[PX0-GD,0],[PX1,1]].forEach(function(g){
    ctx.save(); ctx.fillStyle=c.g1; ctx.fillRect(g[0],CY-GH,GD,GH*2);
    ctx.globalAlpha=.2; ctx.fillStyle=teamCol(g[1]===1?1:0); ctx.fillRect(g[0],CY-GH,GD,GH*2); ctx.globalAlpha=1;
    ctx.strokeStyle=c.chalk2; ctx.lineWidth=1; ctx.beginPath();
    for(var x=g[0]+6;x<g[0]+GD;x+=6){ ctx.moveTo(x,CY-GH); ctx.lineTo(x,CY+GH); }
    for(var y=CY-GH+8;y<CY+GH;y+=8){ ctx.moveTo(g[0],y); ctx.lineTo(g[0]+GD,y); }
    ctx.stroke(); ctx.restore();
  });
  /* chalk */
  ctx.strokeStyle=c.chalk; ctx.lineWidth=lw; ctx.lineJoin="round"; ctx.beginPath();
  ctx.moveTo(MID,PY0); ctx.lineTo(MID,PY1);
  ctx.moveTo(PX0,CY-100); ctx.lineTo(PX0+70,CY-100); ctx.lineTo(PX0+70,CY+100); ctx.lineTo(PX0,CY+100);
  ctx.moveTo(PX1,CY-100); ctx.lineTo(PX1-70,CY-100); ctx.lineTo(PX1-70,CY+100); ctx.lineTo(PX1,CY+100);
  ctx.stroke();
  /* the centre circle doubles as the kickoff cue: it takes the colour of the side that kicks off */
  ctx.beginPath(); ctx.arc(MID,CY,CR,0,Math.PI*2);
  if(phase==="kickoff"&&game!=="over"){ ctx.save(); ctx.strokeStyle=teamCol(kickTeam); ctx.lineWidth=lw*2.2; ctx.globalAlpha=calm()?.9:.55+.35*Math.sin(Date.now()/260); ctx.stroke(); ctx.restore(); }
  else ctx.stroke();
  ctx.beginPath(); ctx.arc(MID,CY,3,0,Math.PI*2); ctx.fillStyle=c.chalk; ctx.fill();
  /* boundary, with the goal mouths open */
  ctx.strokeStyle=c.chalk; ctx.lineWidth=lw*1.6; ctx.beginPath();
  SEGS.forEach(function(s){ ctx.moveTo(s[0],s[1]); ctx.lineTo(s[2],s[3]); }); ctx.stroke();
  /* posts */
  POSTS.forEach(function(p){ ctx.beginPath(); ctx.arc(p.x,p.y,POST,0,Math.PI*2); ctx.fillStyle="#F6F2EA"; ctx.fill(); ctx.lineWidth=lw*1.2; ctx.strokeStyle=c.graph; ctx.stroke(); });
  /* players */
  var one=save.mode==="1p", lab=one?["Y","T"]:["1","2"], showLab=PR*sc>=8;
  for(i=0;i<2;i++){
    var p=P[i];
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=teamCol(i); ctx.fill();
    ctx.lineWidth=lw*1.6; ctx.strokeStyle=i===0?c.graph:c.chalk; if(i===1&&!c.dark) ctx.strokeStyle="#FFFFFF"; ctx.stroke();
    if(p.ring){ ctx.beginPath(); ctx.arc(p.x,p.y,p.r+2.5,0,Math.PI*2); ctx.lineWidth=lw*2.2; ctx.strokeStyle=c.ringc; ctx.stroke(); }
    if(showLab){ ctx.fillStyle=i===0?c.graph:"#F6F2EA"; ctx.font="600 "+Math.round(p.r*.95)+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(lab[i],p.x,p.y+1); }
  }
  /* ball */
  ctx.save(); ctx.translate(B.x,B.y); ctx.rotate(B.ang);
  ctx.beginPath(); ctx.arc(0,0,B.r,0,Math.PI*2); ctx.fillStyle=c.ball; ctx.fill(); ctx.lineWidth=lw*1.4; ctx.strokeStyle=c.graph; ctx.stroke();
  ctx.fillStyle=c.graph; ctx.beginPath(); for(i=0;i<5;i++){ var a=i/5*Math.PI*2-Math.PI/2; ctx.lineTo(Math.cos(a)*B.r*.5,Math.sin(a)*B.r*.5); } ctx.closePath(); ctx.fill();
  ctx.restore();
  /* kicks and goals */
  for(i=0;i<fx.length;i++){ var f=fx[i];
    if(f.k==="ring"){ var t=f.t/.3; ctx.save(); ctx.globalAlpha=1-t; ctx.strokeStyle=c.ringc; ctx.lineWidth=lw*1.6; ctx.beginPath(); ctx.arc(f.x,f.y,B.r+t*16,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
    else { ctx.save(); ctx.globalAlpha=Math.max(0,1-f.t/.9); ctx.fillStyle=f.c===0?c.orange:c.paper; ctx.beginPath(); ctx.arc(f.x,f.y,3,0,Math.PI*2); ctx.fill(); ctx.restore(); }
  }
  /* the goal banner sits mid-pitch and names the scorer, so the eye does not have to hunt for who scored */
  if(phase==="goal"){
    var n=names()[lastScorer]+" scores", fs=26; ctx.save(); ctx.font="600 "+fs+"px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    var w=ctx.measureText(n).width+44, x=MID-w/2, y=CY-26, h=52, rr=26;
    ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath();
    ctx.fillStyle=teamCol(lastScorer); ctx.fill(); ctx.lineWidth=lw*1.6; ctx.strokeStyle=lastScorer===0?c.graph:c.chalk; ctx.stroke();
    ctx.fillStyle=lastScorer===0?c.graph:"#F6F2EA"; ctx.fillText(n,MID,CY+1); ctx.restore();
  }
  /* the touch stick */
  var s=touch.stick; if(s&&s.on){ var rc=cv.getBoundingClientRect(), px=(s.x0-rc.left)/sc, py=(s.y0-rc.top)/sc; ctx.save(); ctx.strokeStyle=c.ink; ctx.globalAlpha=.5; ctx.lineWidth=2/sc;
    ctx.beginPath(); ctx.arc(px,py,42/sc,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(px+clamp(s.x-s.x0,-42,42)/sc,py+clamp(s.y-s.y0,-42,42)/sc,12/sc,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
}

/* ---------- visibility, resize ---------- */
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else if(game==="play") pause("The board left the screen, so the clock stopped."); },{threshold:.15}).observe(view);
document.addEventListener("visibilitychange",function(){ if(document.hidden&&game==="play") pause(); });
var rz=0; window.addEventListener("resize",function(){ cancelAnimationFrame(rz); rz=requestAnimationFrame(fit); });
if(window.ResizeObserver) new ResizeObserver(function(){ fit(); }).observe(view);
if(mq.addEventListener) mq.addEventListener("change",function(){ fx.length=0; wake(); });

/* ---------- boot ---------- */
newMatch(); refreshBar(); readyPanel(); hud();
})();
