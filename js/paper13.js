/* K13 Bin It (js/paper13.js): the office paper toss on the workbench. Tokens come from css/site.css.
   Flick a scrapped draft into the wastebasket across the room. A desk fan changes the wind after every throw.
   Three places, each further away with a stronger fan: Your desk, The meeting room, The War Room.
   The throw is a flick: drag up on the board and let go. The direction of the drag aims, its length sets power.
   The ball flies in a pseudo-3D arc (it shrinks with distance, a shadow tracks it on the floor), the wind pushes it sideways,
   it can hit the rim and drop in or out. A basket adds one to the streak, a miss resets it. Best streak per place is kept.
   The throw physics sit between the CORE markers and touch no DOM; every place is proven makeable in every wind in Node.
   The loop is a fixed 120 Hz step behind an accumulator. It stops when the card leaves the screen or the tab is hidden,
   and a throw in flight pauses when the board loses focus.
   prefers-reduced-motion: no wind streaks, no spinning blades, no confetti, no trail, no wobble. The game still plays.
   Keyboard (board focused): Left/Right aim, Up/Down power, Space or Enter throws, R restarts, N next place.
   Touch and mouse: flick on the board. Every action is also a real labelled button under the board. */
(function(){
"use strict";

/* ===================================================== CORE-BEGIN ===================================================== */
var GRAV=9.81, ELEV=50*Math.PI/180, COSE=Math.cos(ELEV), SINE=Math.sin(ELEV), VMAX=11, H0=.7;
var RB=.09, RBIN=.46, HRIM=.55, FLOORIN=.07, WK=.4, AIMMAX=.45, AIMGAIN=.5, TAU=Math.PI*2;
var PLACES=[
  {name:"Your desk",short:"Desk",D:4.2,wmax:1.2,tip:"Four metres and a gentle fan. Learn the flick."},
  {name:"The meeting room",short:"Meeting room",D:5.6,wmax:2.4,tip:"Further out. The fan has opinions."},
  {name:"The War Room",short:"War Room",D:7,wmax:3.6,tip:"Seven metres. The fan is not on your side."}
];
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
/* a thrown ball: x is sideways (right is positive), z is away from the thrower, h is height, all in metres */
function launch(place,wind,aim,power){
  var v=VMAX*power;
  return {x:0,z:0,h:H0,vx:v*COSE*Math.sin(aim),vz:v*COSE*Math.cos(aim),vh:v*SINE,t:0,wind:wind,D:place.D,
    inb:false,rim:0,bounce:0,done:false,res:"",ev:[]};
}
function step(s,dt){
  if(s.done) return;
  var px=s.x, pz=s.z, ph=s.h, dx, dz, d, nx, nz, vr, f, cx, cz, hx, hz, dd, sg, ax, az, vn, k;
  s.vx+=s.wind*WK*dt; s.vh-=GRAV*dt;
  s.x+=s.vx*dt; s.z+=s.vz*dt; s.h+=s.vh*dt; s.t+=dt;
  dx=s.x; dz=s.z-s.D; d=Math.sqrt(dx*dx+dz*dz)||1e-6;
  if(s.inb){
    if(d>RBIN-RB){ nx=dx/d; nz=dz/d; s.x=nx*(RBIN-RB); s.z=s.D+nz*(RBIN-RB); vr=s.vx*nx+s.vz*nz;
      if(vr>0){ s.vx-=1.6*vr*nx; s.vz-=1.6*vr*nz; } }
    if(s.h<=FLOORIN+RB){ s.h=FLOORIN+RB; s.done=true; s.res="in"; s.ev.push("done"); }
    return;
  }
  if(s.vh<0&&ph>HRIM&&s.h<=HRIM){
    f=(ph-HRIM)/(ph-s.h); cx=px+(s.x-px)*f; cz=pz+(s.z-pz)*f; hx=cx; hz=cz-s.D; dd=Math.sqrt(hx*hx+hz*hz)||1e-6;
    if(dd<=RBIN-RB*.55){ s.inb=true; s.ev.push("in"); }
    else if(dd<RBIN+RB*.9&&s.rim<3){
      sg=dd>=RBIN?1:-1; ax=hx/dd*sg*.6; az=hz/dd*sg*.6;
      vn=s.vx*ax+s.vh*.8+s.vz*az;
      if(vn<0){ k=1.5*vn; s.vx-=k*ax; s.vh-=k*.8; s.vz-=k*az; }
      s.x=cx; s.z=cz; s.h=HRIM+.002; s.rim++; s.ev.push("rim");
    }
  }
  if(!s.inb&&s.h<HRIM){
    dx=s.x; dz=s.z-s.D; d=Math.sqrt(dx*dx+dz*dz)||1e-6;
    if(d<RBIN-.02+RB){ nx=dx/d; nz=dz/d; s.x=nx*(RBIN-.02+RB); s.z=s.D+nz*(RBIN-.02+RB); vr=s.vx*nx+s.vz*nz;
      if(vr<0){ s.vx-=1.5*vr*nx; s.vz-=1.5*vr*nz; } }
  }
  if(s.z>s.D+2.2){ s.z=s.D+2.2; s.vz=-s.vz*.3; }
  if(s.h<=RB){
    s.h=RB; s.vh=-s.vh*.45; s.vx*=.7; s.vz*=.7; s.bounce++;
    if(s.bounce>=3||Math.abs(s.vh)<1){ s.done=true; s.res="out"; s.ev.push("done"); }
  }
  if(s.t>6&&!s.done){ s.done=true; s.res="out"; s.ev.push("done"); }
}
function simulate(place,wind,aim,power){
  var s=launch(place,wind,aim,power), n=0;
  while(!s.done&&n<3000){ step(s,1/120); n++; }
  return s;
}
/* where the ball lands on the floor with no wind and no bin: the ring the player aims with */
function landing(aim,power){
  var v=VMAX*power, vh=v*SINE, t=(vh+Math.sqrt(vh*vh+2*GRAV*H0))/GRAV;
  return {x:v*COSE*Math.sin(aim)*t,z:v*COSE*Math.cos(aim)*t};
}
/* one wind for the next throw: never dead calm, always a number to read, rounded to a tenth */
function drawWind(place,r1,r2){
  var mag=Math.round(place.wmax*(.25+.75*r1)*10)/10;
  return r2<.5?-mag:mag;
}
var CORE={PLACES:PLACES,VMAX:VMAX,AIMMAX:AIMMAX,AIMGAIN:AIMGAIN,WK:WK,launch:launch,step:step,simulate:simulate,landing:landing,drawWind:drawWind};
/* ====================================================== CORE-END ====================================================== */
if(typeof document==="undefined"){ if(typeof module!=="undefined") module.exports=CORE; return; }

var mount=document.querySelector('[data-game="paper13"]');
if(!mount) return;
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
var NP=PLACES.length;
var DRAFTS=["v1_final_FINAL.pdf","logo_v7_REAL.ai","pitch_v2_final_final.key","moodboard_old.fig","hero_copy_v1.docx","template_scrapped.zip","homepage_v0_dont_use.psd","brief_v3_ignore_this.pdf"];

/* card chrome: the same DOM and classes as card() in workbench.js (head, instruction, stage, reset, status, footnote) */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Bin It")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Flick the rejected draft into the bin. The fan changes after every throw. The ring on the floor is where it lands with no wind, so lean against the fan."); instr.id="pt13-i"; mount.appendChild(instr);
var stage=el("div","wb-stage pt13-stage"); stage.setAttribute("aria-describedby","pt13-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Restart: streak back to zero"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Flick up on the board: the direction aims, the length sets power. Keys: left and right aim, up and down power, Space throws, R restarts, N is the next place. Your best streak in each place is kept on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var top=el("div","pt13-top");
var cWind=txt("span","pt13-chip pt13-wind",""), cStreak=txt("span","pt13-chip",""), cBest=txt("span","pt13-chip",""), cSet=txt("span","pt13-chip",""), cDraft=txt("span","pt13-chip pt13-draft","");
top.appendChild(cWind); top.appendChild(cStreak); top.appendChild(cBest); top.appendChild(cSet); top.appendChild(cDraft); stage.appendChild(top);
var view=el("div","pt13-view"); stage.appendChild(view);
var cv=el("canvas","pt13-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Bin It game board. Left and right arrows aim, up and down arrows set power, Space throws. Flick up with a finger or mouse to throw.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var toast=el("div","pt13-toast"); toast.hidden=true; toast.setAttribute("aria-hidden","true"); view.appendChild(toast);
var over=el("div","pt13-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Place"); view.appendChild(over);
var bar=el("div","pt13-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Controls"); stage.appendChild(bar);

function kbd(k){ return k?'<kbd class="pt13-key" aria-hidden="true">'+k+'</kbd>':""; }
function mk(cls,label,key,aria){ var b=el("button",cls,"<span>"+label+"</span>"+kbd(key)); b.type="button"; b.setAttribute("aria-label",aria); return b; }
var gAim=el("div","pt13-grp"); gAim.setAttribute("role","group"); gAim.setAttribute("aria-label","Aim");
var bAimL=mk("pt13-btn","Aim left","&larr;","Aim left"), bAimR=mk("pt13-btn","Aim right","&rarr;","Aim right");
gAim.appendChild(bAimL); gAim.appendChild(bAimR); bar.appendChild(gAim);
var gPow=el("div","pt13-grp"); gPow.setAttribute("role","group"); gPow.setAttribute("aria-label","Power");
var bPowD=mk("pt13-btn","Less power","&darr;","Less power"), bPowU=mk("pt13-btn","More power","&uarr;","More power");
gPow.appendChild(bPowD); gPow.appendChild(bPowU); bar.appendChild(gPow);
var bThrow=mk("pt13-btn pt13-throw","Throw","Space","Throw the paper"); bar.appendChild(bThrow);
var gPlace=el("div","pt13-grp pt13-places"); gPlace.setAttribute("role","group"); gPlace.setAttribute("aria-label","Place");
gPlace.appendChild(el("span","pt13-lab","Place"+kbd("N")));
var pBtns=PLACES.map(function(p,i){
  var b=txt("button","pt13-btn",p.short); b.type="button";
  b.setAttribute("aria-label","Place "+(i+1)+", "+p.name+", bin "+p.D+" metres away, wind up to "+p.wmax);
  b.addEventListener("click",function(){ if(i!==pi){ setPlace(i); focusBoard(); } });
  gPlace.appendChild(b); return b;
});
bar.appendChild(gPlace);

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store("k13_paper13")||"null"); if(s&&s.best&&s.best.length===NP) return s; }catch(e){} return {best:PLACES.map(function(){ return 0; })}; })();
function persist(){ store("k13_paper13",JSON.stringify(save)); }
var pi=0, wind=0, aim=0, pow=.55, streak=0, mode="intro", prevMode="ready", S=null, drag=null, draft=DRAFTS[0], resT=0, newBest=false;
var W=0, H=0, K=1, HY=0, vis=false, raf=0, acc=0, last=0, pal=null, sig="";
var fanAng=0, wob=0, wobT=0, trail=[], bits=[], streaks=[], sTick=0, trailN=0, bgc=document.createElement("canvas"), bgOk=false;
var ZC=2, CAMH=1.5;

function pxx(x,z){ return W/2+x*K/(z+ZC); }
function pyy(h,z){ return HY+(CAMH-h)*K/(z+ZC); }
function psc(z){ return K/(z+ZC); }
function rnd(){ return Math.random(); }
function newWind(){ return drawWind(PLACES[pi],rnd(),rnd()); }
function arrow(w){ return w<0?"←":"→"; }
function deg(a){ return Math.round(a*1800/Math.PI)/10; }

function hud(){
  var s=[pi,wind,streak,save.best[pi],aim.toFixed(4),pow.toFixed(3),draft].join("|"); if(s===sig) return; sig=s;
  cWind.textContent="Wind "+Math.abs(wind).toFixed(1)+" "+arrow(wind);
  cStreak.textContent="Streak "+streak; cBest.textContent="Best "+save.best[pi];
  var d=deg(aim); cSet.textContent="Aim "+Math.abs(d)+"°"+(d<0?" L":d>0?" R":"")+" · Power "+Math.round(pow*100);
  cDraft.textContent=draft;
  pBtns.forEach(function(b,i){ b.setAttribute("aria-pressed",String(i===pi)); });
}
function refreshBtns(){
  var on=mode==="ready";
  [bAimL,bAimR,bPowD,bPowU,bThrow].forEach(function(b){ b.disabled=!on; });
}
function say2(){ say("Place "+(pi+1)+" of "+NP+", "+PLACES[pi].name+". Bin "+PLACES[pi].D+" metres away. Wind "+Math.abs(wind).toFixed(1)+(wind<0?" to the left":" to the right")+". Aim "+Math.abs(deg(aim))+" degrees, power "+Math.round(pow*100)+"."); }

function panel(title,sub,buttons){
  over.innerHTML=""; var p=el("div","pt13-panel");
  p.appendChild(txt("div","pt13-over-t",title)); if(sub) p.appendChild(txt("p","pt13-over-s",sub));
  var row=el("div","pt13-over-row");
  buttons.forEach(function(b){ var x=txt("button","pt13-obtn"+(b.ghost?" ghost":""),b.label); x.type="button"; x.addEventListener("click",b.go); row.appendChild(x); });
  p.appendChild(row); over.appendChild(p); over.hidden=false;
  return row.firstChild;
}
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function ready(){ mode="ready"; S=null; trail.length=0; toast.hidden=true; draft=DRAFTS[Math.floor(rnd()*DRAFTS.length)]; refreshBtns(); sig=""; hud(); wake(); }
function begin(){
  over.hidden=true;
  if(mode==="paused"){ mode=prevMode; last=0; refreshBtns(); wake(); focusBoard(); return; }
  if(mode==="intro"){ ready(); say2(); focusBoard(); }
}
function setPlace(i){
  pi=i; streak=0; wind=newWind(); S=null; drag=null; mode="intro"; toast.hidden=true; bgOk=false; sig=""; refreshBtns();
  panel("Place "+(i+1)+": "+PLACES[i].name,PLACES[i].tip+" Bin at "+PLACES[i].D+" m, wind up to "+PLACES[i].wmax+".",[{label:"Start",go:function(){ begin(); }}]);
  hud(); say2(); fit(); wake();
}
function nextPlace(){ setPlace((pi+1)%NP); focusBoard(); }
function restart(){ streak=0; wind=newWind(); drag=null; if(mode==="fly"||mode==="result"||mode==="paused"){ over.hidden=true; } ready(); say("Restarted. Streak back to 0. Wind "+Math.abs(wind).toFixed(1)+(wind<0?" to the left.":" to the right.")); focusBoard(); }
function pause(why){
  if(mode!=="fly") return;
  prevMode=mode; mode="paused"; refreshBtns();
  panel("Paused",why||"The paper waits in mid air.",[{label:"Continue",go:function(){ begin(); }}]);
}

/* ---------- throwing ---------- */
function doThrow(){
  if(mode!=="ready") return;
  S=launch(PLACES[pi],wind,aim,pow); mode="fly"; acc=0; last=0; trail.length=0; trailN=0; toast.hidden=true; refreshBtns();
  say("Thrown. Power "+Math.round(pow*100)+", aim "+Math.abs(deg(aim))+" degrees"+(aim<0?" left":aim>0?" right":"")+", wind "+Math.abs(wind).toFixed(1)+(wind<0?" left.":" right."));
  wake();
}
function flash(txtMsg,good){ toast.textContent=txtMsg; toast.className="pt13-toast"+(good?" good":" bad"); toast.hidden=false; }
function settle(rimmed){
  var ok=S.res==="in", was=streak, msg;
  if(ok){
    streak++; newBest=false;
    if(streak>save.best[pi]){ save.best[pi]=streak; persist(); newBest=streak>1; }
    msg=rimmed?"Off the rim, then in.":["In.","Bin it.","Draft rejected.","Clean."][streak%4];
    flash(msg+" Streak "+streak+(newBest?". New best.":"."),true);
    say(msg+" Streak "+streak+(newBest?", a new best for "+PLACES[pi].name+".":"."));
    if(!calm()){ wob=1; wobT=0; spawnBits(); }
  } else {
    streak=0;
    msg=rimmed?"Rim, then out.":["Missed.","The bin was right there.","Off target."][Math.floor(rnd()*3)];
    flash(msg+(was?" Streak "+was+" is gone.":" Streak stays at 0."),false);
    say(msg+(was?" Streak back to 0, was "+was+".":" Try again."));
  }
  mode="result"; resT=.95; refreshBtns(); sig=""; hud();
}
function spawnBits(){
  var bx=pxx(0,PLACES[pi].D), by=pyy(HRIM,PLACES[pi].D), cs=["#F0B429","#4F9E92","#EA5E14","#F4EFE6"];
  for(var i=0;i<16;i++) bits.push({x:bx,y:by,vx:(rnd()-.5)*220,vy:-120-rnd()*220,r:rnd()*TAU,vr:(rnd()-.5)*12,c:cs[i%4],t:0});
}

/* ---------- input ---------- */
var AIMSTEP=.5*Math.PI/180;
function nudgeAim(d){ aim=clamp(aim+d,-AIMMAX,AIMMAX); sig=""; hud(); wake(); }
function nudgePow(d){ pow=clamp(Math.round((pow+d)*1000)/1000,.1,1); sig=""; hud(); wake(); }
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var big=e.shiftKey?4:1;
  if(mode==="intro"||mode==="paused"){ if(e.key===" "||e.key==="Enter"){ e.preventDefault(); begin(); } return; }
  if(e.key==="ArrowLeft"){ e.preventDefault(); if(mode==="ready") nudgeAim(-AIMSTEP*big); }
  else if(e.key==="ArrowRight"){ e.preventDefault(); if(mode==="ready") nudgeAim(AIMSTEP*big); }
  else if(e.key==="ArrowUp"){ e.preventDefault(); if(mode==="ready") nudgePow(.01*big); }
  else if(e.key==="ArrowDown"){ e.preventDefault(); if(mode==="ready") nudgePow(-.01*big); }
  else if(e.key===" "||e.key==="Enter"){ e.preventDefault(); if(!e.repeat) doThrow(); }
});
mount.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.target&&e.target.tagName==="BUTTON"&&(e.key===" "||e.key==="Enter")) return;
  if(e.key==="r"||e.key==="R"){ e.preventDefault(); restart(); }
  else if(e.key==="n"||e.key==="N"){ e.preventDefault(); nextPlace(); }
});
cv.addEventListener("blur",function(){ if(mode==="fly") pause("You clicked away, so the paper stopped in mid air."); });

/* the flick: drag up and let go. Direction aims, length is power. */
function flickSet(e){
  var dx=e.clientX-drag.x0, dy=e.clientY-drag.y0, len=Math.sqrt(dx*dx+dy*dy);
  drag.x=e.clientX; drag.y=e.clientY; drag.ok=(-dy>H*.06)&&len>H*.09;
  if(drag.ok){ aim=clamp(Math.atan2(dx,-dy)*AIMGAIN,-AIMMAX,AIMMAX); pow=clamp(len/(H*.7),.1,1); }
  sig=""; hud(); wake();
}
cv.addEventListener("pointerdown",function(e){
  if(e.button>0) return; e.preventDefault(); focusBoard();
  if(mode!=="ready") return;
  drag={id:e.pointerId,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,ok:false};
  try{ cv.setPointerCapture(e.pointerId); }catch(x){}
});
cv.addEventListener("pointermove",function(e){ if(drag&&drag.id===e.pointerId) flickSet(e); });
cv.addEventListener("pointerup",function(e){
  if(!drag||drag.id!==e.pointerId) return;
  flickSet(e); var ok=drag.ok; drag=null;
  if(ok&&mode==="ready") doThrow(); else if(mode==="ready"){ say("Too short. Flick up on the board, and let go to throw."); wake(); }
});
cv.addEventListener("pointercancel",function(){ drag=null; wake(); });
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });

/* the aim and power buttons repeat while held; a keyboard press arrives as a click with detail 0 */
function hold(btn,fn){
  var t1=0, t2=0, used=false;
  function stop(){ clearTimeout(t1); clearInterval(t2); }
  btn.addEventListener("pointerdown",function(e){ if(e.button>0||btn.disabled) return; used=true; fn(); stop(); t1=setTimeout(function(){ t2=setInterval(fn,60); },380); });
  ["pointerup","pointerleave","pointercancel","blur"].forEach(function(n){ btn.addEventListener(n,stop); });
  btn.addEventListener("click",function(e){ if(used&&e.detail>0){ used=false; return; } used=false; if(!btn.disabled) fn(); });
}
hold(bAimL,function(){ if(mode==="ready") nudgeAim(-AIMSTEP); });
hold(bAimR,function(){ if(mode==="ready") nudgeAim(AIMSTEP); });
hold(bPowD,function(){ if(mode==="ready") nudgePow(-.01); });
hold(bPowU,function(){ if(mode==="ready") nudgePow(.01); });
bThrow.addEventListener("click",function(){ doThrow(); focusBoard(); });
reset.addEventListener("click",restart);

/* ---------- loop ---------- */
var DT=1/120;
function frame(now){
  raf=0; if(!vis) return;
  if(!last) last=now; var dt=Math.min(.1,(now-last)/1000); last=now;
  var rimmed=false;
  if(mode==="fly"&&S){
    acc+=dt;
    while(acc>=DT&&mode==="fly"){
      step(S,DT); acc-=DT;
      if(!calm()&&(++trailN%6)===0){ trail.push({x:S.x,z:S.z,h:S.h}); if(trail.length>16) trail.shift(); }
      if(S.ev.length){
        S.ev.forEach(function(k){ if(k==="rim"){ wob=calm()?0:.6; wobT=0; } });
        if(S.done){ rimmed=S.rim>0; settle(rimmed); acc=0; break; }
        S.ev.length=0;
      }
    }
  } else if(mode==="result"){
    resT-=dt; if(resT<=0){ wind=newWind(); ready(); say2(); }
  }
  if(!calm()){
    fanAng+=dt*(2+Math.abs(wind)*2.2); wobT+=dt; if(wob>0) wob=Math.max(0,wob-dt*2.2);
    var w=Math.abs(wind)/PLACES[pi].wmax, need=w*34*dt; sTick+=need;
    while(sTick>=1){ sTick-=1; spawnStreak(); }
    for(var i=streaks.length-1;i>=0;i--){ var s=streaks[i]; s.x+=s.v*dt; s.t+=dt; if(s.t>s.life||s.x<-60||s.x>W+60) streaks.splice(i,1); }
    for(var j=bits.length-1;j>=0;j--){ var b=bits[j]; b.t+=dt; b.vy+=620*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.r+=b.vr*dt; if(b.t>1.1||b.y>H+10) bits.splice(j,1); }
  }
  hud(); draw();
  if(vis&&!calm()) raf=requestAnimationFrame(frame);
  else if(vis&&(mode==="fly"||mode==="result")) raf=requestAnimationFrame(frame);
}
function wake(){ if(!raf&&vis){ last=0; raf=requestAnimationFrame(frame); } if(!vis||calm()) draw(); }
function spawnStreak(){
  var dir=wind<0?-1:1, y=H*(.2+rnd()*.5);
  streaks.push({x:dir>0?W*.1:W*.9,y:y,v:dir*(240+rnd()*220),len:26+rnd()*40,t:0,life:.9+rnd()*1.2});
}

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement), dark=document.documentElement.getAttribute("data-theme")==="dark";
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  return {dark:dark,ink:v("--ink","#1F2023"),muted:v("--muted","#5D5F65"),blue:v("--blue","#B94612"),blue2:v("--blue-2","#EA5E14"),line:v("--line","rgba(31,32,35,.12)"),
    paper2:v("--paper-2","#FFFFFF"),paper3:v("--paper-3","#F3EEE6"),
    ball:dark?"#E6DFD0":"#FBF8F1",ballEdge:dark?"#4A463D":"#6B6558",jade:"#4F9E92",gold:"#F0B429"};
}
new MutationObserver(function(){ pal=null; bgOk=false; wake(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function fit(){
  var r=view.getBoundingClientRect(); if(!r.width||!r.height) return;
  var dprv=Math.min(window.devicePixelRatio||1,2); W=r.width; H=r.height;
  cv.width=Math.round(W*dprv); cv.height=Math.round(H*dprv); bgc.width=cv.width; bgc.height=cv.height; bgc.dprv=dprv; cv.dprv=dprv;
  K=Math.min(1.25*H,1.55*W); HY=.36*H; bgOk=false; draw();
}
function rrect(c,x,y,w,h,r){ r=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.arcTo(x+w,y,x+w,y+r,r); c.lineTo(x+w,y+h-r); c.arcTo(x+w,y+h,x+w-r,y+h,r);
  c.lineTo(x+r,y+h); c.arcTo(x,y+h,x,y+h-r,r); c.lineTo(x,y+r); c.arcTo(x,y,x+r,y,r); c.closePath(); }

/* the room: drawn once per size, place and theme into an offscreen canvas */
function buildBg(P){
  var c=bgc.getContext("2d"), pl=PLACES[pi], war=pi===2, D=pl.D, zw=D+2.2, mp=psc(zw), floorY=pyy(0,zw), i, xm, topY=floorY-2.8*mp;
  c.setTransform(bgc.dprv,0,0,bgc.dprv,0,0); c.clearRect(0,0,W,H);
  var ceil=war?(P.dark?"#101113":"#17181A"):(P.dark?"#141517":"#E4DED3");
  var wall=war?(P.dark?"#1B1C1F":"#2E2F34"):(P.dark?"#2A2B30":"#F1E4D6");
  var trim=war?"#0F1011":(P.dark?"#1A1B1E":"#D5C3AE");
  var f1=war?(P.dark?"#18191B":"#3C3D42"):(P.dark?"#222327":"#CDBA9F"), f2=war?(P.dark?"#151618":"#36373C"):(P.dark?"#1E1F23":"#C3AF93");
  c.fillStyle=ceil; c.fillRect(0,0,W,H);
  c.fillStyle=wall; c.fillRect(0,topY,W,floorY-topY);
  /* floor in one-metre bands, with plank lines running to the vanishing point */
  c.fillStyle=f1; c.fillRect(0,floorY,W,H-floorY);
  for(i=0;i<14;i++){ var za=zw-i, zb=zw-i-1; if(zb<-ZC+.4) break; var ya=pyy(0,za), yb=Math.min(H+4,pyy(0,zb));
    if(i%2){ c.fillStyle=f2; c.fillRect(0,ya,W,yb-ya); } }
  c.strokeStyle=war?"rgba(255,255,255,.05)":(P.dark?"rgba(255,255,255,.05)":"rgba(31,32,35,.08)"); c.lineWidth=1; c.beginPath();
  for(xm=-8;xm<=8;xm++){ c.moveTo(pxx(xm,zw),floorY); c.lineTo(pxx(xm,-1.2),pyy(0,-1.2)); } c.stroke();
  c.fillStyle=trim; c.fillRect(0,floorY-.12*mp,W,.12*mp);
  /* wall furniture in wall metres: x from the middle, height from the floor */
  function wx(m){ return W/2+m*mp; } function wy(m){ return floorY-m*mp; }
  function box(x0,h0,x1,h1,col){ c.fillStyle=col; c.fillRect(wx(x0),wy(h1),(x1-x0)*mp,(h1-h0)*mp); }
  function poster(cx,hb,w,h){
    var x=wx(cx-w/2), y=wy(hb+h); c.fillStyle=P.dark?"#0F1011":"#1F2023"; c.fillRect(x,y,w*mp,h*mp);
    c.strokeStyle=P.blue2; c.lineWidth=Math.max(1,.02*mp); c.strokeRect(x+.04*mp,y+.04*mp,(w-.08)*mp,(h-.08)*mp);
    c.fillStyle=P.blue2; c.textAlign="center"; c.textBaseline="middle"; c.font="700 "+(.46*h*mp)+"px Fraunces, Georgia, serif";
    if(war){ c.shadowColor=P.blue2; c.shadowBlur=.18*mp; } c.fillText("13",x+w*mp/2,y+h*mp*.5); c.shadowBlur=0;
  }
  function plant(cx,sc){
    var pw=.22*sc, x=wx(cx);
    c.fillStyle=P.dark?"#7A3010":"#B94612"; c.beginPath(); c.moveTo(wx(cx-pw),wy(.42*sc)); c.lineTo(wx(cx+pw),wy(.42*sc)); c.lineTo(wx(cx+pw*.7),wy(0)); c.lineTo(wx(cx-pw*.7),wy(0)); c.closePath(); c.fill();
    var ls=[[-.2,.62,.2,.45],[.2,.7,.2,.5],[0,.95,.18,.5],[-.12,1.2,.15,.42],[.15,1.15,.15,.4]];
    for(var q=0;q<ls.length;q++){ var l=ls[q]; c.fillStyle=q%2?"#3C8A7E":"#4F9E92"; c.beginPath();
      c.ellipse(x+l[0]*sc*mp,wy(l[1]*sc),l[2]*sc*mp,l[3]*sc*mp*.62,l[0]*1.4,0,TAU); c.fill(); }
  }
  function monitor(x0,hb,w,h,hot){
    box(x0+w*.42,hb-.1,x0+w*.58,hb,P.dark?"#0F1011":"#3A3B40");
    c.fillStyle=P.dark?"#0F1011":"#2A2B30"; rrect(c,wx(x0),wy(hb+h),w*mp,h*mp,.02*mp); c.fill();
    c.fillStyle=hot?(P.dark?"#12302B":"#173B35"):(P.dark?"#3A3B42":"#FBF8F1"); c.fillRect(wx(x0)+.025*mp,wy(hb+h)+.025*mp,(w-.05)*mp,(h-.05)*mp);
    c.fillStyle=hot?P.jade:P.blue2; for(var q=0;q<4;q++){ var bw=(w-.16)*(hot?(.25+.18*((q*5)%4)):(.35+.12*((q*3)%4))); c.fillRect(wx(x0)+.08*mp,wy(hb+h)+(.07+q*.075*h/.4)*mp,bw*mp,.02*mp+(hot?0:0)); }
  }
  if(pi===0){
    poster(1.05,1.35,.62,.86);
    box(-2.7,.7,-.55,.75,P.dark?"#4A3A2A":"#8B6B4A"); box(-2.55,0,-2.47,.7,P.dark?"#33291F":"#6B5238"); box(-.78,0,-.7,.7,P.dark?"#33291F":"#6B5238");
    monitor(-2.2,.85,.72,.46,false); box(-2.2,.75,-1.4,.78,P.dark?"#1A1B1E":"#4A4B50"); c.fillStyle=P.gold; c.fillRect(wx(-.95),wy(.75+.1),.08*mp,.1*mp);
    plant(2.2,1);
    c.fillStyle=P.dark?"#E6DFD0":"#FFFFFF"; c.fillRect(wx(-.1),wy(2.05),.34*mp,.34*mp); c.fillStyle=P.gold; c.fillRect(wx(.0),wy(1.97),.14*mp,.14*mp);
  } else if(pi===1){
    c.fillStyle=P.dark?"#C9C4B8":"#FDFDFB"; c.fillRect(wx(-2.1),wy(2.05),2.4*mp,1.15*mp);
    c.strokeStyle=P.dark?"#4A4B52":"#8A8D93"; c.lineWidth=Math.max(1.5,.04*mp); c.strokeRect(wx(-2.1),wy(2.05),2.4*mp,1.15*mp);
    c.strokeStyle=P.blue; c.lineWidth=Math.max(1,.025*mp); c.beginPath();
    [[-1.9,1.55,-.5,1.55],[-1.9,1.3,-1.1,1.3],[-1.9,1.08,-.7,1.08]].forEach(function(s){ c.moveTo(wx(s[0]),wy(s[1])); c.lineTo(wx(s[2]),wy(s[3])); }); c.stroke();
    c.fillStyle=P.ink; c.font="600 "+(.16*mp)+"px 'JetBrains Mono', monospace"; c.textAlign="left"; c.textBaseline="middle";
    if(.16*mp>=7){ c.fillText("v1  v2  v2_final",wx(-1.9),wy(1.85)); }
    poster(1.2,1.3,.62,.86);
    c.fillStyle=P.dark?"#E6DFD0":"#FFFFFF"; c.beginPath(); c.arc(wx(.55),wy(2.2),.2*mp,0,TAU); c.fill(); c.strokeStyle=P.dark?"#4A4B52":"#3A3B40"; c.lineWidth=Math.max(1,.03*mp); c.stroke();
    c.beginPath(); c.moveTo(wx(.55),wy(2.2)); c.lineTo(wx(.55),wy(2.33)); c.moveTo(wx(.55),wy(2.2)); c.lineTo(wx(.62),wy(2.18)); c.stroke();
    plant(2.5,1.1);
  } else {
    var xs=[-2.6,-1.5,-.4];
    for(i=0;i<3;i++){ monitor(xs[i],1.05,.95,.58,true); }
    box(-2.7,.95,-.3,1.0,P.dark?"#0F1011":"#222327");
    poster(1.3,1.1,.8,1.1);
    var nc=[P.gold,"#EA5E14","#4F9E92","#F4EFE6"];
    for(i=0;i<8;i++){ c.fillStyle=nc[i%4]; c.fillRect(wx(-2.55+(i%4)*.22),wy(2.05-Math.floor(i/4)*.2),.17*mp,.15*mp); }
  }
  c.setTransform(1,0,0,1,0,0);
  bgOk=true;
}

function drawFan(P){
  var dir=wind<0?-1:1, fs=Math.min(.085*H,.16*W), fx=dir<0?W*.88:W*.12, fy=H*.62;
  var w=Math.abs(wind)/PLACES[pi].wmax;
  ctx.save(); ctx.translate(fx,fy);
  /* little table, neck, base */
  ctx.fillStyle=P.dark?"#3A3B42":"#8B6B4A"; ctx.fillRect(-fs*1.3,fs*1.55,fs*2.6,fs*.2);
  ctx.fillStyle=P.dark?"#2A2B30":"#6B5238"; ctx.fillRect(-fs*1.1,fs*1.75,fs*.22,fs*1.2); ctx.fillRect(fs*.88,fs*1.75,fs*.22,fs*1.2);
  ctx.fillStyle=P.dark?"#0F1011":"#1F2023"; ctx.fillRect(-fs*.1,fs*.7,fs*.2,fs*.9);
  rrect(ctx,-fs*.6,fs*1.4,fs*1.2,fs*.18,fs*.08); ctx.fill();
  /* the cage faces the room, so it reads as a narrow ellipse */
  ctx.scale(.6,1); ctx.rotate(0);
  ctx.lineWidth=Math.max(2,fs*.1); ctx.strokeStyle=P.blue2; ctx.fillStyle=P.dark?"rgba(234,94,20,.12)":"rgba(185,70,18,.1)";
  ctx.beginPath(); ctx.arc(0,0,fs,0,TAU); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.rotate(fanAng); ctx.fillStyle=P.dark?"#1F2023":"#1F2023";
  for(var i=0;i<3;i++){ ctx.save(); ctx.rotate(i*TAU/3); ctx.beginPath(); ctx.ellipse(fs*.46,0,fs*.46,fs*.2,0,0,TAU); ctx.fill(); ctx.restore(); }
  ctx.restore();
  ctx.fillStyle=P.blue2; ctx.beginPath(); ctx.arc(0,0,fs*.17,0,TAU); ctx.fill();
  ctx.lineWidth=1; ctx.strokeStyle=P.blue2; ctx.globalAlpha=.55; ctx.beginPath(); ctx.arc(0,0,fs*.62,0,TAU); ctx.stroke();
  ctx.restore();
  /* the number on the table, so the eye ties the fan to the chip */
  ctx.save(); ctx.fillStyle=P.muted; ctx.font="500 "+Math.max(9,fs*.34)+"px 'JetBrains Mono', monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(Math.abs(wind).toFixed(1)+" "+arrow(wind),fx,fy+fs*1.95+fs*.3); ctx.restore();
  /* wind streaks */
  if(!calm()&&streaks.length){
    ctx.save(); ctx.lineCap="round"; ctx.lineWidth=Math.max(1.5,fs*.05); ctx.strokeStyle=P.dark?"#F4EFE6":P.blue2;
    for(i=0;i<streaks.length;i++){ var s=streaks[i], a=Math.min(1,s.t*5,(s.life-s.t)*3)*(.14+.22*w); ctx.globalAlpha=a;
      ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-(s.v>0?1:-1)*s.len,s.y); ctx.stroke(); }
    ctx.restore();
  }
}

function drawBin(P,part){
  var pl=PLACES[pi], D=pl.D, ps=psc(D), cx=pxx(0,D), gy=pyy(0,D), ty=pyy(HRIM,D), rt=RBIN*ps, rb=rt*.78, ryt=rt*.3, ryb=rb*.3;
  ctx.save();
  if(wob>0&&!calm()){ ctx.translate(cx,gy); ctx.rotate(Math.sin(wobT*34)*.07*wob); ctx.scale(1,1-.05*wob*Math.abs(Math.sin(wobT*26))); ctx.translate(-cx,-gy); }
  if(part==="back"){
    ctx.fillStyle=P.dark?"#050506":"#17181A"; ctx.beginPath(); ctx.ellipse(cx,ty,rt,ryt,0,0,TAU); ctx.fill();
  } else {
    ctx.fillStyle=P.dark?"#4A4B52":"#3A3B40";
    ctx.beginPath(); ctx.moveTo(cx-rt,ty); ctx.lineTo(cx-rb,gy); ctx.ellipse(cx,gy,rb,ryb,0,Math.PI,0,true); ctx.lineTo(cx+rt,ty); ctx.ellipse(cx,ty,rt,ryt,0,0,Math.PI,false); ctx.closePath(); ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,.1)"; ctx.lineWidth=1; ctx.beginPath();
    for(var i=-3;i<=3;i++){ var f=i/3.6; ctx.moveTo(cx+f*rt,ty+ryt*Math.sqrt(1-f*f)); ctx.lineTo(cx+f*rb,gy+ryb*Math.sqrt(1-f*f)); } ctx.stroke();
    /* sticky note on the front */
    var nw=rt*.7, nh=nw*.8, nx=cx-nw*.5, ny=ty+(gy-ty)*.38;
    ctx.save(); ctx.translate(cx,ny+nh/2); ctx.rotate(-.07); ctx.fillStyle=P.gold; ctx.fillRect(-nw/2,-nh/2,nw,nh);
    ctx.strokeStyle="rgba(31,32,35,.55)"; ctx.lineWidth=Math.max(1,ps*.018); ctx.beginPath();
    ctx.moveTo(-nw*.34,-nh*.18); ctx.lineTo(nw*.34,-nh*.18); ctx.moveTo(-nw*.34,nh*.12); ctx.lineTo(nw*.2,nh*.12); ctx.stroke(); ctx.restore();
    ctx.lineWidth=Math.max(2,ps*.035); ctx.strokeStyle=P.blue2; ctx.beginPath(); ctx.ellipse(cx,ty,rt,ryt,0,0,Math.PI,false); ctx.stroke();
  }
  ctx.restore();
}
function drawBall(P,x,y,r,rot){
  var rs=[1,.88,1.05,.9,1,.94,1.08,.9,.98,.86];
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.beginPath();
  for(var i=0;i<rs.length;i++){ var a=i/rs.length*TAU; ctx.lineTo(Math.cos(a)*r*rs[i],Math.sin(a)*r*rs[i]); } ctx.closePath();
  ctx.fillStyle=P.ball; ctx.fill(); ctx.lineWidth=Math.max(1,r*.12); ctx.strokeStyle=P.ballEdge; ctx.lineJoin="round"; ctx.stroke();
  if(r>5){ ctx.lineWidth=Math.max(.8,r*.07); ctx.globalAlpha=.55; ctx.beginPath();
    ctx.moveTo(-r*.6,-r*.2); ctx.lineTo(r*.1,r*.1); ctx.lineTo(r*.2,-r*.6); ctx.moveTo(r*.1,r*.1); ctx.lineTo(-r*.1,r*.7); ctx.moveTo(r*.1,r*.1); ctx.lineTo(r*.7,.3*r); ctx.stroke();
    ctx.globalAlpha=.8; ctx.strokeStyle=P.blue; ctx.beginPath(); ctx.moveTo(-r*.55,r*.3); ctx.lineTo(-r*.05,r*.4); ctx.stroke(); }
  ctx.restore();
}
function draw(){
  if(!W||!H) return;
  if(!pal) pal=palette();
  var P=pal, dprv=cv.dprv||1, pl=PLACES[pi], D=pl.D;
  if(!bgOk) buildBg(P);
  ctx.setTransform(dprv,0,0,dprv,0,0); ctx.clearRect(0,0,W,H);
  ctx.drawImage(bgc,0,0,W,H);
  drawFan(P);

  var showBall=mode!=="result"||(S&&S.res!=="in"), bx, by, br, rest=(mode==="ready"||mode==="intro"), s=S, i;
  /* the aim ring on the floor: where it lands with no wind */
  if(rest&&mode==="ready"){
    var L=landing(aim,pow), lx=pxx(L.x,L.z), ly=pyy(0,L.z), lr=.36*psc(L.z);
    ctx.save(); ctx.strokeStyle=P.blue2; ctx.lineWidth=2; ctx.setLineDash([5,6]); ctx.globalAlpha=.8; ctx.beginPath();
    var u0=.12; ctx.moveTo(pxx(L.x*u0,L.z*u0),pyy(0,L.z*u0)); ctx.lineTo(lx,ly); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=.95;
    ctx.beginPath(); ctx.ellipse(lx,ly,lr,lr*.34,0,0,TAU); ctx.stroke(); ctx.fillStyle=P.blue2; ctx.globalAlpha=.16; ctx.fill(); ctx.restore();
  }
  drawBin(P,"back");
  var ballFront=false;
  if(s&&showBall&&mode!=="intro"){
    var z=s.z, sc=psc(z), sx=pxx(s.x,z), sy=pyy(s.h,z), r=Math.max(3.5,RB*sc);
    if(!s.inb){ var sh=1/(1+s.h*.3); ctx.save(); ctx.globalAlpha=.3*sh; ctx.fillStyle="#000"; ctx.beginPath(); ctx.ellipse(pxx(s.x,z),pyy(0,z),r*1.25*sh,r*.4*sh,0,0,TAU); ctx.fill(); ctx.restore(); }
    if(!calm()&&trail.length){ ctx.save(); for(i=0;i<trail.length;i++){ var t=trail[i]; ctx.globalAlpha=(i+1)/trail.length*.35; ctx.fillStyle=P.ballEdge;
      ctx.beginPath(); ctx.arc(pxx(t.x,t.z),pyy(t.h,t.z),Math.max(1.5,RB*psc(t.z)*.45),0,TAU); ctx.fill(); } ctx.restore(); }
    ballFront=(z<D&&!s.inb);
    if(!ballFront) drawBall(P,sx,sy,r,s.t*(calm()?0:9));
    drawBin(P,"front");
    if(ballFront) drawBall(P,sx,sy,r,s.t*(calm()?0:9));
  } else {
    drawBin(P,"front");
    if(mode==="ready"||mode==="intro"||mode==="paused"&&!s){
      bx=pxx(0,0); by=pyy(H0,0); br=RB*psc(0);
      ctx.save(); ctx.globalAlpha=.3; ctx.fillStyle="#000"; ctx.beginPath(); ctx.ellipse(bx,by+br*2.6,br*1.1,br*.34,0,0,TAU); ctx.fill(); ctx.restore();
      drawBall(P,bx,by,br,-.3);
    }
  }
  /* confetti and the flick line */
  for(i=0;i<bits.length;i++){ var b=bits[i]; ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.r); ctx.globalAlpha=Math.max(0,1-b.t/1.1); ctx.fillStyle=b.c; ctx.fillRect(-4,-2.5,8,5); ctx.restore(); }
  if(drag&&drag.ok){ var rc=cv.getBoundingClientRect();
    ctx.save(); ctx.strokeStyle=P.blue2; ctx.lineWidth=3; ctx.lineCap="round"; ctx.globalAlpha=.7;
    ctx.beginPath(); ctx.moveTo(drag.x0-rc.left,drag.y0-rc.top); ctx.lineTo(drag.x-rc.left,drag.y-rc.top); ctx.stroke(); ctx.restore(); }
}

/* ---------- visibility, resize ---------- */
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else if(mode==="fly") pause("The board left the screen, so the paper stopped in mid air."); },{threshold:.15}).observe(view);
document.addEventListener("visibilitychange",function(){ if(document.hidden&&mode==="fly") pause(); });
var rz=0; window.addEventListener("resize",function(){ cancelAnimationFrame(rz); rz=requestAnimationFrame(fit); });
if(window.ResizeObserver) new ResizeObserver(function(){ fit(); }).observe(view);
if(mq.addEventListener) mq.addEventListener("change",function(){ streaks.length=0; bits.length=0; wake(); });

/* ---------- boot ---------- */
wind=newWind(); setPlace(0);
})();
