/* K13 Deadline Run: the one-button cave flyer, on the workbench card anatomy.
   You are the orange 13 with a rotor. Hold to climb, let go to drop. The tunnel scrolls left and narrows slowly,
   and meeting, standup and scope blocks stand in it. Distance in metres is the score; the best is kept on this device.
   The world is 400 by 300 units drawn into a devicePixelRatio-crisp canvas (cap 2). The loop is a fixed 120 Hz step behind an accumulator.
   The clock stops when focus leaves the card, the board leaves the screen or the tab is hidden, so nobody crashes while looking away.
   prefers-reduced-motion: no smoke, no shake, no debris, no hover bob, rotor drawn still. The game itself still plays.
   Input: hold Space, Up or W (board focused), hold the mouse button or a finger anywhere on the board, or hold the big button below it.
   R restarts, Esc pauses. */
(function(){
"use strict";

var mount=document.querySelector('[data-game="heli13"]');
if(!mount) return;

var WW=400, HH=300, CX=96, PT=40;
var GRAV=640, LIFT=1180, VUP=250, VDN=310;
var HALF_W=11, HALF_H=6.5, OBS_W=56, TAU=Math.PI*2;
var DT=1/120, LOCK=650;

var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }

/* card chrome: the same DOM and classes as card() in workbench.js (head, instruction, stage, reset, status, footnote) */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Deadline Run")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","You are the orange 13 with a rotor. Hold to climb, let go to drop. The tunnel narrows. The meetings do not move."); instr.id="hl13-i"; mount.appendChild(instr);
var stage=el("div","wb-stage hl13-stage"); stage.setAttribute("aria-describedby","hl13-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Restart the run"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Hold Space or Up, or press and hold anywhere on the board, to climb. R restarts, Esc pauses. Your best distance is kept on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var top=el("div","hl13-top");
var hDist=txt("span","hl13-chip",""), hBest=txt("span","hl13-chip hl13-best",""), hRuns=txt("span","hl13-chip","");
top.appendChild(hDist); top.appendChild(hBest); top.appendChild(hRuns); stage.appendChild(top);
var view=el("div","hl13-view"); stage.appendChild(view);
var cv=el("canvas","hl13-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Deadline Run game board. Hold Space or the Up arrow to climb, release to drop. Press and hold on a touch screen.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var over=el("div","hl13-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Run result"); view.appendChild(over);
var bar=el("div","hl13-bar"); stage.appendChild(bar);
var holdBtn=txt("button","hl13-hold","Hold to climb"); holdBtn.type="button";
holdBtn.setAttribute("aria-label","Hold to climb, release to drop"); bar.appendChild(holdBtn);

/* ---------- state ---------- */
var best=parseInt(store("k13_heli13"),10); if(!(best>0)) best=0;
function persist(){ store("k13_heli13",String(best)); }
var mode="ready", runs=0, overAt=0;
var pts=[], obs=[], puffs=[], debris=[];
var sx=0, y=HH/2, vy=0, speed=125, t=0, flat=0, nextObs=600, puffT=0, shake=0, sig="", lastKm=0, cause="";
var holdKey=false, holdPtr=false, holdBtnOn=false;
var W=0, H=0, dprv=1, vis=false, raf=0, acc=0, last=0, pal=null;

function rnd(a,b){ return a+Math.random()*(b-a); }
function meters(){ return Math.floor(sx/10); }
function gapAt(m){ return Math.max(96,205-m*.18); }

/* ---------- the tunnel: points every 40 units, a centre line and a gap; obstacles sit on flat stretches so they are always passable ---------- */
function genTo(xmax){
  while(pts[pts.length-1].x<xmax){
    var p=pts[pts.length-1], x=p.x+PT, m=x/10, g=gapAt(m), c=p.c;
    if(flat>0){ flat--; }
    else if(x>nextObs){
      var gm=gapAt(m+4), kind=Math.random(), o;
      if(kind<.34) o={k:"hang",label:"MEETING",y:p.c-gm/2-4,h:gm*.46+4};
      else if(kind<.67) o={k:"floor",label:"STANDUP",y:p.c+gm/2-gm*.46,h:gm*.46+4};
      else o={k:"float",label:"SCOPE",y:p.c-gm*.17+rnd(-gm*.08,gm*.08),h:gm*.34};
      o.x=x-OBS_W/2; o.w=OBS_W; obs.push(o);
      flat=1; nextObs=x+rnd(170,250)-Math.min(40,m*.05);
    } else {
      var ms=26+Math.min(14,m*.02); c=p.c+rnd(-ms,ms)+(HH/2-p.c)*.06;
    }
    c=Math.max(g/2+16,Math.min(HH-g/2-16,c));
    pts.push({x:x,c:c,g:g});
  }
}
var EDGE={a:0,b:0};
function edges(x){
  var i=0; while(i<pts.length-2&&x>pts[i+1].x) i++;
  var a=pts[i], b=pts[i+1], f=Math.max(0,Math.min(1,(x-a.x)/(b.x-a.x)));
  var c=a.c+(b.c-a.c)*f, g=a.g+(b.g-a.g)*f;
  EDGE.a=c-g/2; EDGE.b=c+g/2; return EDGE;
}

function newRun(){
  pts=[{x:-PT,c:HH/2,g:gapAt(0)},{x:0,c:HH/2,g:gapAt(0)}]; obs=[]; puffs=[]; debris=[];
  sx=0; y=HH/2; vy=0; speed=125; t=0; flat=0; nextObs=600; puffT=0; shake=0; lastKm=0; cause=""; acc=0;
  holdKey=false; holdPtr=false; holdBtnOn=false;
  genTo(WW+PT*3);
  mode="ready"; over.hidden=true; sig=""; hud(); wake();
  say("Ready. Hold to climb, release to drop.");
}
function begin(){ if(mode==="over") newRun(); if(mode==="ready") say("Go. Hold to climb, release to drop."); mode="play"; over.hidden=true; last=0; acc=0; wake(); }
function press(){
  if(mode==="ready"||mode==="paused"){ begin(); return true; }
  if(mode==="over"){ if(performance.now()-overAt<LOCK) return false; newRun(); begin(); return true; }
  return mode==="play";
}
function pause(why){
  if(mode!=="play") return; mode="paused"; holdKey=holdPtr=holdBtnOn=false;
  panel("Paused",why||"The tunnel waits for you.","Continue",function(){ begin(); focusBoard(); });
  say("Paused. "+(why||""));
}
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function panel(title,sub,label,go){
  over.innerHTML=""; var p=el("div","hl13-panel");
  p.appendChild(txt("div","hl13-over-t",title)); if(sub) p.appendChild(txt("p","hl13-over-s",sub));
  var row=el("div","hl13-over-row"), x=txt("button","hl13-obtn",label); x.type="button"; x.addEventListener("click",go); row.appendChild(x);
  p.appendChild(row); over.appendChild(p); over.hidden=false;
}
function hud(){
  var m=meters(), b=Math.max(best,m), s=m+"|"+b+"|"+runs; if(s===sig) return; sig=s;
  hDist.textContent="Distance "+m+" m"; hBest.textContent="Best "+b+" m"; hRuns.textContent="Runs "+runs;
}

/* ---------- the step ---------- */
function holding(){ return holdKey||holdPtr||holdBtnOn; }
function crash(why,hitKind){
  mode="over"; overAt=performance.now(); holdKey=holdPtr=holdBtnOn=false;
  var m=meters(), fresh=m>best; if(fresh){ best=m; persist(); }
  runs++; sig=""; hud();
  if(!calm()){
    shake=.3;
    for(var i=0;i<16;i++){ var a=rnd(0,TAU), v=rnd(40,170); debris.push({x:sx+CX,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,l:rnd(.5,.9),c:i%3?"#EA5E14":"ink"}); }
  }
  var line=why==="wall"?"The tunnel wall was there the whole time.":hitKind==="MEETING"?"A meeting was in the way. It usually is.":hitKind==="STANDUP"?"The standup ran long and you hit it.":"Scope crept into your lane.";
  var sub=line+" "+(fresh&&m>0?"New best: "+m+" m.":"You flew "+m+" m. Best is "+best+" m.");
  panel(m+" m",sub,"Fly again",function(){ newRun(); focusBoard(); });
  say("Crashed at "+m+" metres. "+(fresh&&m>0?"New best. ":"Best is "+best+" metres. ")+"Press Space or the button to fly again.");
}
function hitTest(){
  var wx=sx+CX, top=y-HALF_H, bot=y+HALF_H, i, e;
  for(i=-1;i<=1;i+=.5){ e=edges(wx+i*HALF_W); if(top<e.a||bot>e.b) return "wall"; }
  for(i=0;i<obs.length;i++){ var o=obs[i];
    if(wx+HALF_W>o.x&&wx-HALF_W<o.x+o.w&&bot>o.y&&top<o.y+o.h) return o.label; }
  return "";
}
function step(dt){
  t+=dt;
  vy+=(holding()?-LIFT:GRAV)*dt; if(vy<-VUP) vy=-VUP; else if(vy>VDN) vy=VDN;
  y+=vy*dt;
  var m=meters(); speed=125+Math.min(65,m*.1); sx+=speed*dt;
  genTo(sx+WW+PT*3);
  while(pts.length>3&&pts[1].x<sx-60) pts.shift();
  while(obs.length&&obs[0].x+obs[0].w<sx-60) obs.shift();
  if(!calm()){ puffT-=dt; if(puffT<=0){ puffT=.035; puffs.push({x:sx+CX-14,y:y+1,l:.75,t:0,r:rnd(2.2,3.4)}); } }
  var why=hitTest();
  if(why){ crash(why==="wall"?"wall":"block",why); return; }
  var km=Math.floor(meters()/250); if(km>lastKm){ lastKm=km; say(km*250+" metres. Still flying."); }
}
function fxStep(d){
  var i;
  for(i=puffs.length-1;i>=0;i--){ var p=puffs[i]; p.t+=d; p.y-=14*d; if(p.t>p.l) puffs.splice(i,1); }
  for(i=debris.length-1;i>=0;i--){ var q=debris[i]; q.l-=d; q.vy+=420*d; q.x+=q.vx*d; q.y+=q.vy*d; if(q.l<=0) debris.splice(i,1); }
  if(shake>0) shake=Math.max(0,shake-d);
}
function frame(now){
  raf=0; if(!vis) return;
  if(!last) last=now; var d=Math.min(.1,(now-last)/1000); last=now;
  if(mode==="play"){ acc+=d; while(acc>=DT){ step(DT); acc-=DT; if(mode!=="play"){ acc=0; break; } } }
  else if(mode==="ready"&&!calm()) t+=d;
  fxStep(d);
  if(mode==="play"&&puffs.length>0&&calm()) puffs.length=0;
  hud(); draw();
  if(vis&&(mode==="play"||(mode==="ready"&&!calm())||puffs.length||debris.length||shake>0)) raf=requestAnimationFrame(frame);
}
function wake(){ if(!raf&&vis){ last=0; raf=requestAnimationFrame(frame); } if(!vis||calm()) draw(); }

/* ---------- input ---------- */
var KEYS={" ":1,ArrowUp:1,w:1,W:1};
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(KEYS[e.key]){ e.preventDefault(); if(!e.repeat) press(); holdKey=true; }
  else if(e.key==="Enter"){ e.preventDefault(); if(mode!=="play") press(); }
  else if(e.key==="Escape"){ if(mode==="play"){ e.preventDefault(); pause(); } }
});
cv.addEventListener("keyup",function(e){ if(KEYS[e.key]){ e.preventDefault(); holdKey=false; } });
mount.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if((e.key==="r"||e.key==="R")&&e.target===cv){ e.preventDefault(); newRun(); }
});
cv.addEventListener("pointerdown",function(e){
  if(e.button>0) return; e.preventDefault(); focusBoard();
  if(!press()) return;
  holdPtr=true; try{ cv.setPointerCapture(e.pointerId); }catch(x){}
});
function liftPtr(){ holdPtr=false; }
cv.addEventListener("pointerup",liftPtr); cv.addEventListener("pointercancel",liftPtr); cv.addEventListener("lostpointercapture",liftPtr);
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });

/* the big button: a real button, pointer hold works, Space or Enter held while it is focused works, a plain click (screen reader) gives one short climb */
var btnPtrAt=0;
holdBtn.addEventListener("pointerdown",function(e){
  if(e.button>0) return; e.preventDefault(); btnPtrAt=performance.now();
  if(!press()) return;
  holdBtnOn=true; holdBtn.classList.add("on"); try{ holdBtn.setPointerCapture(e.pointerId); }catch(x){}
});
function liftBtn(){ holdBtnOn=false; holdBtn.classList.remove("on"); }
holdBtn.addEventListener("pointerup",liftBtn); holdBtn.addEventListener("pointercancel",liftBtn); holdBtn.addEventListener("lostpointercapture",liftBtn);
holdBtn.addEventListener("contextmenu",function(e){ e.preventDefault(); });
holdBtn.addEventListener("keydown",function(e){
  if(e.key===" "||e.key==="Enter"){ e.preventDefault(); if(!e.repeat) press(); holdBtnOn=true; holdBtn.classList.add("on"); }
});
holdBtn.addEventListener("keyup",function(e){ if(e.key===" "||e.key==="Enter"){ e.preventDefault(); liftBtn(); } });
holdBtn.addEventListener("click",function(){
  if(performance.now()-btnPtrAt<700) return;
  if(!press()) return; holdBtnOn=true; setTimeout(liftBtn,320);
});
holdBtn.addEventListener("blur",liftBtn);
reset.addEventListener("click",function(){ newRun(); focusBoard(); });
/* leaving the card stops the clock; moving between the board and its own buttons does not */
mount.addEventListener("focusout",function(e){
  holdKey=false;
  if(mode==="play"&&!(e.relatedTarget&&mount.contains(e.relatedTarget))) pause("You clicked away, so the clock stopped.");
});

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement), dark=document.documentElement.getAttribute("data-theme")==="dark";
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  return {air:v("--paper-2","#FFFFFF"),hatch:v("--line","rgba(31,32,35,.12)"),grid:v("--line","rgba(31,32,35,.12)"),
    ink:v("--ink","#1F2023"),paper:v("--paper-2","#FFFFFF"),muted:v("--muted","#5D5F65"),dark:dark};
}
new MutationObserver(function(){ pal=null; wake(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function fit(){
  var r=view.getBoundingClientRect(); if(!r.width) return;
  dprv=Math.min(window.devicePixelRatio||1,2); W=r.width; H=r.height;
  cv.width=Math.round(W*dprv); cv.height=Math.round(H*dprv); draw();
}
function rr(x,y0,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y0); ctx.arcTo(x+w,y0,x+w,y0+h,r); ctx.arcTo(x+w,y0+h,x,y0+h,r); ctx.arcTo(x,y0+h,x,y0,r); ctx.arcTo(x,y0,x+w,y0,r); ctx.closePath(); }
function draw(){
  if(!W) return; if(!pal) pal=palette();
  var P=pal, s=W/WW, i, p;
  ctx.setTransform(dprv*s,0,0,dprv*s,0,0); ctx.clearRect(0,0,WW,HH);
  if(shake>0&&!calm()) ctx.translate(rnd(-1,1)*shake*14,rnd(-1,1)*shake*14);
  ctx.fillStyle=P.air; ctx.fillRect(-20,-20,WW+40,HH+40);
  /* scrolling posts in the air: the sense of speed */
  ctx.strokeStyle=P.grid; ctx.lineWidth=1; ctx.beginPath();
  for(var gx=-(sx%50);gx<WW+50;gx+=50){ ctx.moveTo(gx,0); ctx.lineTo(gx,HH); } ctx.stroke();
  /* walls with a drafting hatch that moves with the world */
  var n=pts.length, a=pts[0], b=pts[n-1];
  ctx.beginPath(); ctx.moveTo(a.x-sx,-20);
  for(i=0;i<n;i++){ p=pts[i]; ctx.lineTo(p.x-sx,p.c-p.g/2); }
  ctx.lineTo(b.x-sx,-20); ctx.closePath();
  ctx.moveTo(a.x-sx,HH+20);
  for(i=0;i<n;i++){ p=pts[i]; ctx.lineTo(p.x-sx,p.c+p.g/2); }
  ctx.lineTo(b.x-sx,HH+20); ctx.closePath();
  ctx.fillStyle=P.air; ctx.fill(); ctx.globalAlpha=.09; ctx.fillStyle=P.ink; ctx.fill(); ctx.globalAlpha=1;
  ctx.save(); ctx.clip(); ctx.strokeStyle=P.hatch; ctx.lineWidth=1; ctx.beginPath();
  var sh=sx%10;
  for(var k=-HH-20;k<WW+20;k+=10){ ctx.moveTo(k-sh,HH+20); ctx.lineTo(k-sh+HH+40,-20); } ctx.stroke(); ctx.restore();
  ctx.strokeStyle=P.ink; ctx.lineWidth=2.6; ctx.lineJoin="round"; ctx.beginPath();
  for(i=0;i<n;i++){ p=pts[i]; if(i) ctx.lineTo(p.x-sx,p.c-p.g/2); else ctx.moveTo(p.x-sx,p.c-p.g/2); }
  ctx.stroke(); ctx.beginPath();
  for(i=0;i<n;i++){ p=pts[i]; if(i) ctx.lineTo(p.x-sx,p.c+p.g/2); else ctx.moveTo(p.x-sx,p.c+p.g/2); }
  ctx.stroke();
  /* meeting, standup and scope blocks */
  ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.font="500 9.5px 'JetBrains Mono',monospace";
  for(i=0;i<obs.length;i++){ var o=obs[i], ox=o.x-sx; if(ox>WW+10||ox+o.w<-10) continue;
    rr(ox,o.y,o.w,o.h,4); ctx.fillStyle=P.ink; ctx.fill();
    var vy0=Math.max(o.y,0), vy1=Math.min(o.y+o.h,HH), ty=o.k==="hang"?o.y+o.h-13:o.k==="floor"?o.y+13:o.y+o.h/2;
    if(vy1-vy0>14){ ctx.fillStyle=P.paper; ctx.fillText(o.label,ox+o.w/2,ty); } }
  /* smoke, then the craft */
  for(i=0;i<puffs.length;i++){ var u=puffs[i], f=u.t/u.l; ctx.globalAlpha=(1-f)*.55; ctx.beginPath(); ctx.arc(u.x-sx,u.y,u.r*(1+f*1.6),0,TAU); ctx.fillStyle=P.muted; ctx.fill(); }
  ctx.globalAlpha=1;
  if(mode!=="over"||calm()||debris.length===0) craft(P);
  for(i=0;i<debris.length;i++){ var d=debris[i]; ctx.globalAlpha=Math.min(1,d.l*2.2); ctx.fillStyle=d.c==="ink"?P.ink:d.c; ctx.fillRect(d.x-sx-2,d.y-2,4,4); }
  ctx.globalAlpha=1;
  if(mode==="ready"){
    ctx.fillStyle=P.muted; ctx.font="500 11px 'JetBrains Mono',monospace"; ctx.textAlign="center";
    ctx.fillText("HOLD TO CLIMB",WW/2+30,y-46); ctx.fillText("LET GO TO DROP",WW/2+30,y-30);
  }
}
function craft(P){
  var yy=y+(mode==="ready"&&!calm()?Math.sin(t*2.4)*4:0), tilt=calm()?0:Math.max(-.4,Math.min(.4,vy/VDN*.5));
  ctx.save(); ctx.translate(CX,yy); ctx.rotate(tilt); ctx.lineJoin="round"; ctx.lineCap="round";
  ctx.strokeStyle=P.ink; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.moveTo(-12,-1); ctx.lineTo(-25,-7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-25,-4); ctx.lineTo(-25,-11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(0,-13); ctx.stroke();
  var bw=calm()?17:17*Math.abs(Math.cos(t*38))+2;
  ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(-bw,-13.5); ctx.lineTo(bw,-13.5); ctx.stroke();
  rr(-15,-9,30,18,6); ctx.fillStyle="#EA5E14"; ctx.fill(); ctx.lineWidth=1.8; ctx.stroke();
  ctx.fillStyle="#FFFFFF"; ctx.font="700 10.5px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("13",0,.5);
  ctx.restore();
}

/* ---------- visibility, resize ---------- */
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else if(mode==="play") pause("The board left the screen, so the clock stopped."); },{threshold:.15}).observe(view);
document.addEventListener("visibilitychange",function(){ if(document.hidden&&mode==="play") pause(); });
var rz=0; window.addEventListener("resize",function(){ cancelAnimationFrame(rz); rz=requestAnimationFrame(fit); });
if(window.ResizeObserver) new ResizeObserver(function(){ fit(); }).observe(view);
if(mq.addEventListener) mq.addEventListener("change",function(){ puffs.length=0; debris.length=0; shake=0; wake(); });

newRun();
})();
