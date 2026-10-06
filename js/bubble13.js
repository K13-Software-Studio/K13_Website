/* K13 Scope Pop: a bubble-splitting arcade game, twelve levels, four guns and drops, built on the workbench card anatomy.
   The bubbles are feature requests. Poke one with the line and it splits into two smaller requests, down to the smallest, which pop.
   Each size bounces to its own fixed height (bigger ones higher), the way the classic does. Touch a bubble and you lose a life.
   The loop is a fixed 120 Hz step behind an accumulator, draws to a devicePixelRatio-crisp canvas (capped at 2), stops while
   the card is off screen or the tab is hidden, and pauses when focus leaves the board during play.
   prefers-reduced-motion: no particles, no score pop-ups, no blinking. Still fully playable.
   Keyboard (canvas focused): Left/Right or A/D move, Space or Up fires (hold it for rapid fire), R retries, N goes to the next level.
   Touch: real Left, Fire and Right buttons under the board. Every control is a real labelled button.
   World units: the board is always 10 units tall; the width follows the card. */
(function(){
"use strict";

var mount=document.querySelector('[data-game="bubble13"]');
if(!mount) return;

var DT=1/120, G=22, FY=9.3, TOP=0, PSPEED=7.2, PW=.8, PH=1.15, HSPEED=15;
var R=[1.75,1.3,.9,.6,.36];       /* radius per size: huge, big, medium, small, tiny */
var RISE=[6.8,6,5,4,3];           /* bounce height per size, in units: constant, so each size always bounces to the same height */
var VX=[2.2,2.6,3,3.4,3.8];       /* horizontal speed per size */
var SCORE=[25,50,100,150,250];
var COL=["#B94612","#EA5E14","#F0B429","#4F9E92","#1F2023"];
var LABEL=["a whole platform","also: a portal","and a blog","tweak",""];
var TINY=4;
/* guns: how many shots may be up at once, and what a shot is */
var GUNS={line:{name:"Line",max:1},dbl:{name:"Double line",max:2},sticky:{name:"Sticky line",max:1},rapid:{name:"Rapid fire",max:7}};
/* drops: a popped request sometimes leaves something behind; walk into it to take it */
var DROPS={dbl:{lab:"DOUBLE",say:"Double line. Two lines up at once.",w:3},sticky:{lab:"STICKY",say:"Sticky line. It hangs at the top for a moment.",w:3},
  rapid:{lab:"RAPID",say:"Rapid fire. Hold fire.",w:3},shield:{lab:"SHIELD",say:"Shield. The next hit is free.",w:2},
  freeze:{lab:"FREEZE",say:"Freeze. Every request stops for three seconds.",w:2},clock:{lab:"+10s",say:"Ten more seconds.",w:2},
  boom:{lab:"BOOM",say:"Dynamite. Everything splits once.",w:1}};
var DROP_P=.2, BSPEED=17, STICK_T=2.6, RAPID_GAP=.13;
var INK="#1F2023";
/* levels: bubbles as [size, x as a share of the width, direction]; blocks as {x: centre share, w: width in units, y0, y1, label};
   gun: the gun you start with; time in seconds */
var FREEZE={x:.5,w:.6,y0:0,y1:5.4,label:"SCOPE FREEZE"};
var LEVELS=[
  {name:"First request",tip:"One big one. Poke it.",time:50,b:[[1,.25,1]]},
  {name:"Scope freeze",tip:"The block stops the line. Use it as cover.",time:65,blocks:[FREEZE],b:[[2,.2,1],[2,.8,-1]]},
  {name:"Two big ones",tip:"Two at once. Clear the smaller ones first.",time:80,b:[[1,.22,1],[1,.78,-1]]},
  {name:"Stakeholders",tip:"Four of them, and you start with a double line.",time:70,gun:"dbl",b:[[2,.12,1],[2,.38,-1],[2,.62,1],[2,.88,-1]]},
  {name:"Two teams",tip:"Two walls, three rooms. Walk under them.",time:90,blocks:[{x:.34,w:.5,y0:0,y1:5.6},{x:.66,w:.5,y0:0,y1:5.6}],b:[[1,.15,1],[2,.5,1],[1,.85,-1]]},
  {name:"The shelf",tip:"A shelf in the middle. Lines stop under it, requests bounce off it.",time:90,blocks:[{x:.5,w:6,y0:4.2,y1:4.6,label:"BACKLOG"}],b:[[1,.2,1],[1,.8,-1]]},
  {name:"Quick wins",tip:"A dozen small things. Rapid fire, hold the button.",time:45,gun:"rapid",b:[[3,.08,1],[3,.2,-1],[3,.32,1],[3,.44,-1],[3,.56,1],[3,.68,-1],[3,.8,1],[3,.92,-1],[4,.15,1],[4,.5,-1],[4,.85,1],[4,.65,-1]]},
  {name:"Big client",tip:"The biggest request yet. Start with a sticky line.",time:100,gun:"sticky",b:[[0,.3,1]]},
  {name:"Freeze and shelves",tip:"The freeze block and two shelves. Cover is everywhere, so is the ceiling.",time:110,blocks:[FREEZE,{x:.2,w:3,y0:3.6,y1:4},{x:.8,w:3,y0:3.6,y1:4}],b:[[1,.15,1],[1,.85,-1],[2,.4,1]]},
  {name:"Pile-up",tip:"Three big ones and a wall. Keep moving.",time:120,blocks:[{x:.5,w:.5,y0:0,y1:4.8}],b:[[1,.15,1],[1,.4,-1],[1,.85,-1]]},
  {name:"Enterprise",tip:"Two of the biggest. It is a lot. Grab every drop.",time:130,b:[[0,.25,1],[0,.75,-1]]},
  {name:"Launch day",tip:"Everything at once, the night before launch. Ship it.",time:150,blocks:[FREEZE,{x:.18,w:2.6,y0:4,y1:4.4},{x:.82,w:2.6,y0:4,y1:4.4}],b:[[0,.35,1],[1,.72,-1],[1,.9,-1],[2,.08,1]]}
];
var NL=LEVELS.length;

function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
function pl(n,w){ return n+" "+w+(n===1?"":"s"); }
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }

/* ---------- card chrome: the same DOM and classes as card() in workbench.js ---------- */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Scope Pop")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Fire the line straight up. Every request you poke splits into two smaller ones. Clear the board before the clock does."); instr.id="bt-i"; mount.appendChild(instr);
var stage=el("div","wb-stage bt-stage"); stage.setAttribute("aria-describedby","bt-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Retry</span>');
reset.type="button"; reset.setAttribute("aria-label","Retry this level"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Left and Right (or A and D) walk, Space or Up fires (hold it with rapid fire), R retries, N is the next level. Walk into a drop to take it. On a phone use the buttons. Progress is kept on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var view=el("div","bt-view"); stage.appendChild(view);
var cv=el("canvas","bt-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Scope Pop game board. Click it, then use the Left and Right arrow keys to walk and Space to fire the line up.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var hud=el("div","bt-hud");
var hLevel=txt("span","bt-chip",""), hLives=txt("span","bt-chip",""), hLeft=txt("span","bt-chip",""), hTime=txt("span","bt-chip",""), hScore=txt("span","bt-chip",""), hGun=txt("span","bt-chip bt-gun","");
[hLevel,hGun,hLives,hLeft,hTime,hScore].forEach(function(c){ hud.appendChild(c); }); view.appendChild(hud);
var over=el("div","bt-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Game message"); view.appendChild(over);

var bar=el("div","bt-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Scope Pop controls"); stage.appendChild(bar);
function btn(label,aria,cls){ var b=txt("button",cls||"bt-btn",label); b.type="button"; if(aria) b.setAttribute("aria-label",aria); return b; }
var lvWrap=el("div","bt-grp bt-levels"); lvWrap.setAttribute("role","group"); lvWrap.setAttribute("aria-label","Level");
lvWrap.appendChild(txt("span","bt-lab","Level"));
var lvBtns=LEVELS.map(function(x,i){ return i; }).map(function(i){ var b=btn("","Level "+(i+1)); b.addEventListener("click",function(){ if(!b.disabled){ loadLevel(i,true); focusBoard(); } }); lvWrap.appendChild(b); return b; });
bar.appendChild(lvWrap);
var pads=el("div","bt-pads"); bar.appendChild(pads);
var leftBtn=btn("Left","Walk left","bt-pad"), fireBtn=btn("Fire","Fire the line up","bt-pad bt-fire"), rightBtn=btn("Right","Walk right","bt-pad");
pads.appendChild(leftBtn); pads.appendChild(fireBtn); pads.appendChild(rightBtn);

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store("k13_bubble13")||"null"); if(s&&s.best&&s.best.length){ while(s.best.length<NL) s.best.push(0); s.best.length=NL; return s; } }catch(e){} return {best:LEVELS.map(function(){ return 0; })}; })();
function persist(){ store("k13_bubble13",JSON.stringify(save)); }
var keyL=false,keyR=false,padL=false,padR=false,keyF=false,padF=false;
var g=null;                           /* the level in play */
var W=0,H=0,ppu=40,WW=16,dprv=1,vis=false,on=false,raf=0,acc=0,last=0,pal=null,focused=false;
var parts=[],pops=[],walkT=0;

function unlocked(i){ return i===0||save.best[i-1]>0; }
function refreshChips(){
  lvBtns.forEach(function(b,i){
    var s=save.best[i], ok=unlocked(i);
    b.textContent=(i+1)+(s?" ✓":""); b.disabled=!ok; b.setAttribute("aria-pressed",String(!!g&&g.li===i));
    b.setAttribute("aria-label","Level "+(i+1)+(ok?(s?", cleared, best score "+s:", not cleared yet"):", locked, clear level "+i+" first"));
  });
}
function hudUpdate(){
  if(!g) return;
  hLevel.textContent="Level "+(g.li+1)+" of "+NL; hLives.textContent="Lives "+g.lives+(g.shield?" + shield":"");
  hGun.textContent=GUNS[g.gun].name+(g.freeze>0?", frozen":"");
  hLeft.textContent="Requests "+g.bubbles.length; hTime.textContent="Time "+Math.max(0,Math.ceil(g.time)); hScore.textContent="Score "+g.score;
}

function newBubble(size,x,y,dir,vy){ return {s:size,r:R[size],x:x,y:y,vx:VX[size]*dir,vy:vy||0}; }
function loadLevel(i,announce){
  var d=LEVELS[i], k;
  g={li:i,d:d,state:"ready",time:d.time,lives:d.lives||3,score:0,bubbles:[],px:WW/2,dir:1,shots:[],drops:[],gun:d.gun||"line",gap:0,shield:false,freeze:0,inv:0,ev:[]};
  for(k=0;k<d.b.length;k++){ var s=d.b[k]; g.bubbles.push(newBubble(s[0],s[1]*WW,R[s[0]]+.6,s[2],0)); }
  parts.length=0; pops.length=0; over.hidden=true; over.innerHTML="";
  hudUpdate(); refreshChips(); controlsUpdate();
  if(announce!==false) say("Level "+(i+1)+" of "+NL+", "+d.name+". "+d.tip+" "+pl(g.bubbles.length,"request")+", "+d.time+" seconds. Walk or fire to start.");
  fit(); wake();
}
function controlsUpdate(){
  var live=!!g&&(g.state==="ready"||g.state==="play");
  fireBtn.disabled=!live; leftBtn.disabled=!live; rightBtn.disabled=!live;
}

/* ---------- the rules ---------- */
function begin(){ if(g.state==="ready"){ g.state="play"; g.ev.push({t:"start"}); } }
function fire(){
  if(!g||(g.state!=="ready"&&g.state!=="play")) return;
  begin();
  var G1=GUNS[g.gun], n=0, i;
  for(i=0;i<g.shots.length;i++) if(g.shots[i].k===(g.gun==="rapid"?"bullet":"line")) n++;
  if(n>=G1.max||g.gap>0) return;
  if(g.gun==="rapid"){ g.shots.push({k:"bullet",x:g.px+(g.dir*.12),y:FY-PH}); g.gap=RAPID_GAP; }
  else g.shots.push({k:"line",x:g.px,tip:FY,sticky:g.gun==="sticky",stuck:0});
  wake();
}
/* blocks in world units: their x is a share of the board width, so they follow the card */
function blocks(){ var out=[], d=g.d.blocks||[]; for(var i=0;i<d.length;i++){ var b=d[i], cx=b.x*WW; out.push({x0:cx-b.w/2,x1:cx+b.w/2,y0:b.y0,y1:b.y1,label:b.label}); } return out; }
function hitBubble(b){
  var i=g.bubbles.indexOf(b); if(i<0) return;
  g.bubbles.splice(i,1); g.score+=SCORE[b.s];
  if(b.s<TINY){ var c=b.s+1; g.bubbles.push(newBubble(c,b.x-.15,b.y,-1,-8)); g.bubbles.push(newBubble(c,b.x+.15,b.y,1,-8)); g.ev.push({t:"split",b:b}); }
  else g.ev.push({t:"pop",b:b});
  if(Math.random()<DROP_P) drop(b.x,b.y);
}
function drop(x,y){
  var keys=Object.keys(DROPS), tot=0, i, r;
  for(i=0;i<keys.length;i++) if(keys[i]!==g.gun) tot+=DROPS[keys[i]].w;
  r=Math.random()*tot;
  for(i=0;i<keys.length;i++){ if(keys[i]===g.gun) continue; r-=DROPS[keys[i]].w; if(r<=0) break; }
  g.drops.push({k:keys[Math.min(i,keys.length-1)],x:clamp(x,.8,WW-.8),y:y,vy:0,life:7});
}
function take(k){
  var D=DROPS[k];
  if(GUNS[k]){ g.gun=k; g.shots.length=0; }
  else if(k==="shield") g.shield=true;
  else if(k==="freeze") g.freeze=3;
  else if(k==="clock") g.time+=10;
  else if(k==="boom"){ var list=g.bubbles.filter(function(b){ return b.s<TINY; }); for(var i=0;i<list.length;i++) hitBubble(list[i]); }
  g.ev.push({t:"take",k:k,s:D.say});
}
function lineHits(x,y0,y1){
  for(var i=0;i<g.bubbles.length;i++){ var b=g.bubbles[i], cy=clamp(b.y,y0,y1), dx=b.x-x, dy=b.y-cy; if(dx*dx+dy*dy<b.r*b.r) return b; }
  return null;
}
function blockedAt(bl,x,tip){ for(var i=0;i<bl.length;i++){ var w=bl[i]; if(x>=w.x0&&x<=w.x1&&tip<=w.y1&&tip>=w.y0-.2) return w; } return null; }
function circleRect(b,w){
  var cx=clamp(b.x,w.x0,w.x1), cy=clamp(b.y,w.y0,w.y1), dx=b.x-cx, dy=b.y-cy, d2=dx*dx+dy*dy;
  if(d2>=b.r*b.r) return;
  if(d2===0){ b.x=w.x0-b.r; b.vx=-Math.abs(b.vx); return; }
  var d=Math.sqrt(d2), nx=dx/d, ny=dy/d, pen=b.r-d;
  b.x+=nx*pen; b.y+=ny*pen;
  if(Math.abs(nx)>Math.abs(ny)) b.vx=nx>0?Math.abs(b.vx):-Math.abs(b.vx); else b.vy=ny>0?Math.abs(b.vy):-Math.abs(b.vy);
}
function stepBubble(b,dt,bl){
  b.vy+=G*dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
  if(b.x-b.r<0){ b.x=b.r; b.vx=Math.abs(b.vx); }
  if(b.x+b.r>WW){ b.x=WW-b.r; b.vx=-Math.abs(b.vx); }
  if(b.y-b.r<TOP){ b.y=TOP+b.r; b.vy=Math.abs(b.vy)*.3; }
  if(b.y+b.r>FY){ b.y=FY-b.r; b.vy=-Math.sqrt(2*G*RISE[b.s]); }
  for(var i=0;i<bl.length;i++) circleRect(b,bl[i]);
}
function step(dt){
  if(g.state!=="ready"&&g.state!=="play") return;
  var dir=((keyL||padL)?-1:0)+((keyR||padR)?1:0), i, j, bl=blocks();
  if(dir){ begin(); g.dir=dir; g.px=clamp(g.px+dir*PSPEED*dt,PW/2+.05,WW-PW/2-.05); walkT+=dt; }
  if(g.state!=="play") return;
  g.time-=dt; if(g.inv>0) g.inv-=dt; if(g.gap>0) g.gap-=dt;
  if(g.time<=0){ g.time=0; g.state="lost"; g.ev.push({t:"lost",why:"time"}); return; }
  if(g.gun==="rapid"&&(keyF||padF)) fire();
  if(g.freeze>0) g.freeze-=dt; else for(i=0;i<g.bubbles.length;i++) stepBubble(g.bubbles[i],dt,bl);
  /* shots: a line climbs from the floor (a sticky one hangs where it stops), a bullet is a short bolt */
  for(j=g.shots.length-1;j>=0;j--){
    var h=g.shots[j], hit=null, gone=false;
    if(h.k==="bullet"){
      h.y-=BSPEED*dt;
      if(h.y<=TOP||blockedAt(bl,h.x,h.y)) gone=true;
      else if((hit=lineHits(h.x,h.y,h.y+.45))){ hitBubble(hit); gone=true; }
    } else {
      if(h.stuck>0){ h.stuck-=dt; if(h.stuck<=0) gone=true; }
      else { h.tip-=HSPEED*dt; var wb=blockedAt(bl,h.x,h.tip);
        if(wb||h.tip<=TOP){ if(h.sticky){ h.tip=wb?wb.y1:TOP; h.stuck=STICK_T; } else { gone=true; if(wb) g.ev.push({t:"blocked",w:wb}); } } }
      if(!gone&&(hit=lineHits(h.x,h.tip,FY))){ hitBubble(hit); gone=true; }
    }
    if(gone) g.shots.splice(j,1);
  }
  /* drops fall to the floor, wait a few seconds, and go */
  for(i=g.drops.length-1;i>=0;i--){ var dp=g.drops[i];
    if(dp.y<FY-.35){ dp.vy+=G*.5*dt; dp.y=Math.min(FY-.35,dp.y+dp.vy*dt); } else dp.life-=dt;
    if(dp.life<=0){ g.drops.splice(i,1); continue; }
    if(Math.abs(dp.x-g.px)<PW/2+.5&&dp.y>FY-PH-.4){ g.drops.splice(i,1); take(dp.k); } }
  if(g.bubbles.length===0){
    g.state="won"; g.bonus=Math.round(g.time)*10; g.score+=g.bonus; g.ev.push({t:"won"}); return;
  }
  if(g.inv<=0){
    var x0=g.px-PW/2+.08, x1=g.px+PW/2-.08, y0=FY-PH+.1;
    for(i=0;i<g.bubbles.length;i++){
      var q=g.bubbles[i], px=clamp(q.x,x0,x1), py=clamp(q.y,y0,FY), ex=q.x-px, ey=q.y-py;
      if(ex*ex+ey*ey<q.r*q.r){
        if(g.shield){ g.shield=false; g.inv=1.4; g.ev.push({t:"shield"}); break; }
        g.lives--; g.inv=1.8; g.gun=g.d.gun||"line"; g.shots.length=0; g.ev.push({t:"hit"});
        if(g.lives<=0){ g.state="lost"; g.ev.push({t:"lost",why:"lives"}); }
        break;
      }
    }
  }
}

/* ---------- input ---------- */
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
cv.addEventListener("pointerdown",function(){ focusBoard(); if(g&&g.state==="paused") resume(); });
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var k=e.key;
  if(g&&g.state==="paused"&&k!=="Tab"){ e.preventDefault(); resume(); return; }
  if(k==="ArrowLeft"||k==="a"||k==="A"){ e.preventDefault(); keyL=true; wake(); }
  else if(k==="ArrowRight"||k==="d"||k==="D"){ e.preventDefault(); keyR=true; wake(); }
  else if(k===" "||k==="ArrowUp"||k==="w"||k==="W"){ e.preventDefault(); keyF=true; if(!e.repeat) fire(); wake(); }
  else if(k==="r"||k==="R"){ e.preventDefault(); retry(); }
  else if(k==="n"||k==="N"){ e.preventDefault(); nextLevel(); }
});
cv.addEventListener("keyup",function(e){
  var k=e.key;
  if(k==="ArrowLeft"||k==="a"||k==="A") keyL=false;
  else if(k==="ArrowRight"||k==="d"||k==="D") keyR=false;
  else if(k===" "||k==="ArrowUp"||k==="w"||k==="W") keyF=false;
});
function releaseKeys(){ keyL=keyR=keyF=padF=false; }
function holdPad(b,side){
  function set(v){ if(side==="l") padL=v; else padR=v; b.classList.toggle("on",v); if(v) wake(); }
  b.addEventListener("pointerdown",function(e){ if(e.button>0||b.disabled) return; e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(x){} set(true); });
  ["pointerup","pointercancel","lostpointercapture","blur"].forEach(function(n){ b.addEventListener(n,function(){ set(false); }); });
  b.addEventListener("keydown",function(e){ if((e.key===" "||e.key==="Enter")&&!e.repeat){ e.preventDefault(); set(true); } });
  b.addEventListener("keyup",function(e){ if(e.key===" "||e.key==="Enter") set(false); });
}
holdPad(leftBtn,"l"); holdPad(rightBtn,"r");
fireBtn.addEventListener("pointerdown",function(e){ if(e.button>0||fireBtn.disabled) return; e.preventDefault(); fireBtn.classList.add("on"); padF=true; fire(); wake(); });
["pointerup","pointercancel","pointerleave"].forEach(function(n){ fireBtn.addEventListener(n,function(){ fireBtn.classList.remove("on"); padF=false; }); });
fireBtn.addEventListener("click",function(e){ if(e.detail===0) fire(); });
function retry(){ if(!g) return; loadLevel(g.li,false); say("Retrying level "+(g.li+1)+". "+pl(g.bubbles.length,"request")+", "+g.d.time+" seconds. Walk or fire to start."); focusBoard(); }
function nextLevel(){ if(!g) return; var n=g.li+1; if(n<NL&&(g.state==="won"||unlocked(n))){ loadLevel(n,true); focusBoard(); } }
reset.addEventListener("click",retry);

/* ---------- pause: focus leaving the board during play, the tab hiding, the card scrolling away ---------- */
function pause(msg){
  if(!g||g.state!=="play") return;
  g.state="paused"; releaseKeys(); padL=padR=false; leftBtn.classList.remove("on"); rightBtn.classList.remove("on");
  over.innerHTML=""; var panel=el("div","bt-panel"), row=el("div","bt-over-row"), b=txt("button","bt-obtn","Keep going");
  b.type="button"; b.addEventListener("click",function(){ resume(); });
  panel.appendChild(txt("h4","bt-over-t","Paused")); panel.appendChild(txt("p","bt-over-s",msg||"The clock is stopped. Click the board or press any key to carry on."));
  row.appendChild(b); panel.appendChild(row); over.appendChild(panel); over.hidden=false;
  say("Paused. The clock is stopped."); draw();
}
function resume(){
  if(!g||g.state!=="paused") return;
  g.state="play"; over.hidden=true; over.innerHTML=""; say("Back on. "+pl(g.bubbles.length,"request")+" left."); focusBoard(); wake();
}
mount.addEventListener("focusout",function(e){
  var to=e.relatedTarget;
  if(to&&mount.contains(to)) return;
  if(g&&g.state==="play"&&!to) setTimeout(function(){ if(!mount.contains(document.activeElement)) pause(); },0);
  else if(g&&g.state==="play") pause();
});

/* ---------- results ---------- */
function showOver(won,why){
  over.innerHTML=""; var panel=el("div","bt-panel"), h=txt("h4","bt-over-t",""), sub=txt("p","bt-over-s",""), row=el("div","bt-over-row"), primary;
  function ob(label,cls,fn){ var b=txt("button","bt-obtn "+(cls||""),label); b.type="button"; b.addEventListener("click",fn); row.appendChild(b); return b; }
  if(won){
    var all=g.li===NL-1&&save.best.every(function(s){ return s>0; });
    h.textContent=all?"Backlog cleared":"Level "+(g.li+1)+" clear";
    sub.textContent="Score "+g.score+", "+Math.round(g.time)+(Math.round(g.time)===1?" second":" seconds")+" left on the clock"+(all?". All "+NL+" levels done. The backlog is empty, for about a day.":".");
    panel.appendChild(h); panel.appendChild(sub);
    primary=g.li===NL-1?ob("Play again","",function(){ loadLevel(0,true); focusBoard(); }):ob("Next level","",nextLevel);
    ob("Retry for a better score","ghost",retry);
  } else {
    h.textContent=why==="time"?"Out of time":"Out of lives";
    sub.textContent=why==="time"?pl(g.bubbles.length,"request")+" still open. Same level, fresh clock.":pl(g.bubbles.length,"request")+" still open. Same level, three fresh lives.";
    panel.appendChild(h); panel.appendChild(sub); primary=ob("Retry","",retry);
  }
  panel.appendChild(row); over.appendChild(panel); over.hidden=false;
  controlsUpdate();
  setTimeout(function(){ try{ primary.focus({preventScroll:true}); }catch(x){} },30);
}

/* ---------- events to words, particles, panels ---------- */
function burst(b){
  if(calm()) return;
  for(var i=0;i<(b.s===3?8:14)&&parts.length<160;i++){ var a=Math.random()*6.28, sp=1.5+Math.random()*4.5;
    parts.push({x:b.x,y:b.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:.6+Math.random()*.4,t:0,c:COL[b.s],s:.1+Math.random()*.12,r:Math.random()*6}); }
  pops.push({x:b.x,y:b.y-b.r,t:0,s:"+"+SCORE[b.s]});
}
function drain(){
  var evs=g.ev.splice(0,g.ev.length);
  for(var i=0;i<evs.length;i++){ var e=evs[i];
    if(e.t==="split"){ burst(e.b); say("Split. "+pl(g.bubbles.length,"request")+" left."); }
    else if(e.t==="pop"){ burst(e.b); say(g.bubbles.length?"Popped. "+pl(g.bubbles.length,"request")+" left.":"Last request popped."); }
    else if(e.t==="hit"){ say(g.lives>0?"A request landed on you. "+(g.lives===1?"1 life":g.lives+" lives")+" left.":"A request landed on you. No lives left."); }
    else if(e.t==="blocked"){ say(e.w&&e.w.label?"The "+e.w.label.toLowerCase()+" stopped the line.":"The wall stopped the line."); }
    else if(e.t==="take"){ say(e.s); if(!calm()) pops.push({x:g.px,y:FY-PH-.3,t:0,s:DROPS[e.k].lab}); }
    else if(e.t==="shield"){ say("The shield took that one. Next hit counts."); }
    else if(e.t==="start"){ say("Go. "+pl(g.bubbles.length,"request")+", "+g.d.time+" seconds."); }
    else if(e.t==="won"){
      if(g.score>save.best[g.li]) save.best[g.li]=g.score;
      persist(); refreshChips();
      say("Level "+(g.li+1)+" clear. Score "+g.score+", "+Math.round(g.time)+" seconds left."); showOver(true);
    } else if(e.t==="lost"){
      say(e.why==="time"?"Out of time. "+pl(g.bubbles.length,"request")+" still open. Press R to retry.":"Out of lives. "+pl(g.bubbles.length,"request")+" still open. Press R to retry.");
      showOver(false,e.why);
    }
  }
}
function fx(dt){
  var i;
  for(i=parts.length-1;i>=0;i--){ var p=parts[i]; p.t+=dt; if(p.t>p.life){ parts.splice(i,1); continue; } p.vy+=G*.6*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.r+=dt*6; }
  for(i=pops.length-1;i>=0;i--){ pops[i].t+=dt; if(pops[i].t>.9) pops.splice(i,1); }
}

/* ---------- the loop ---------- */
function busy(){ return !!g&&(g.state==="play"||parts.length>0||pops.length>0||(g.state==="ready"&&(keyL||keyR||padL||padR))); }
function frame(t){
  raf=0; if(!vis||document.hidden){ on=false; return; }
  var dt=Math.min(.05,(t-last)/1000); last=t; acc+=dt; var n=0;
  while(acc>=DT&&n<8){ step(DT); acc-=DT; n++; } if(n===8) acc=0;
  fx(dt); drain(); hudUpdate(); draw();
  if(!busy()){ on=false; return; }
  raf=window.requestAnimationFrame(frame);
}
function wake(){ if(on||!vis||document.hidden||!g){ if(g&&vis&&W) draw(); return; } if(!W&&!fit()) return; on=true; acc=0; last=performance.now(); raf=window.requestAnimationFrame(frame); }
function stopLoop(){ if(raf){ window.cancelAnimationFrame(raf); raf=0; } on=false; }
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else{ stopLoop(); pause("You scrolled away, so the clock stopped. Click the board or press any key to carry on."); } },{threshold:0}).observe(stage);
document.addEventListener("visibilitychange",function(){ if(document.hidden){ stopLoop(); pause("The tab was hidden, so the clock stopped. Click the board or press any key to carry on."); } else wake(); });
if(window.ResizeObserver) new ResizeObserver(function(){ if(fit()) wake(); }).observe(view); else window.addEventListener("resize",function(){ if(fit()) wake(); });
new MutationObserver(function(){ pal=null; if(vis) draw(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
if(mq.addEventListener) mq.addEventListener("change",function(){ if(vis) wake(); });

function fit(){
  var w=view.clientWidth, h=view.clientHeight; if(!w||!h) return false;
  dprv=Math.min(window.devicePixelRatio||1,2);
  var pw=Math.round(w*dprv), ph=Math.round(h*dprv);
  if(cv.width!==pw||cv.height!==ph){ cv.width=pw; cv.height=ph; }
  W=w; H=h; ppu=h/10; var nw=w/ppu;
  if(g&&Math.abs(nw-WW)>.001){
    var k=nw/WW; g.px=clamp(g.px*k,PW/2+.05,nw-PW/2-.05);
    for(var i=0;i<g.bubbles.length;i++){ var b=g.bubbles[i]; b.x=clamp(b.x*k,b.r,nw-b.r); }
    for(var j=0;j<g.shots.length;j++) g.shots[j].x=clamp(g.shots[j].x*k,0,nw);
    for(j=0;j<g.drops.length;j++) g.drops[j].x=clamp(g.drops[j].x*k,.8,nw-.8);
  }
  WW=nw;
  if(g) draw(); return true;
}

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement);
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  return {bg:v("--paper-3","#E9EDF7"),ink:v("--ink","#1F2023"),or:v("--blue","#B94612"),or2:v("--blue-2","#EA5E14"),line:v("--line-2","rgba(31,32,35,.22)"),muted:v("--muted","#5D5F65"),paper:v("--paper-2","#FFFFFF")};
}
function sx(x){ return x*ppu; } function sy(y){ return y*ppu; }
function drawBubble(b){
  var x=sx(b.x), y=sy(b.y), r=b.r*ppu;
  ctx.save(); ctx.fillStyle=COL[b.s]; ctx.strokeStyle=INK; ctx.lineWidth=Math.max(1.5,ppu*.05);
  ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill(); ctx.stroke();
  ctx.globalAlpha=b.s===3?.35:.5; ctx.strokeStyle="#FFFFFF"; ctx.lineWidth=Math.max(2,ppu*.07); ctx.lineCap="round";
  ctx.beginPath(); ctx.arc(x,y,r*.72,3.5,4.4); ctx.stroke();
  ctx.globalAlpha=1;
  if(g.freeze>0){ ctx.globalAlpha=.45; ctx.fillStyle="#FFFFFF"; ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill(); ctx.globalAlpha=1; }
  if(b.s<TINY){
    ctx.fillStyle=b.s===0?"#FFFFFF":INK; var fs=Math.max(9,Math.round(r*(b.s<=1?.2:b.s===2?.22:.3)));
    ctx.font="600 "+fs+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(LABEL[b.s],x,y+r*.08);
  }
  ctx.restore();
}
function drawPlayer(){
  var blink=g.inv>0&&(calm()||Math.floor(g.inv*10)%2===0);
  var x=sx(g.px), y=sy(FY), w=PW*ppu, h=PH*ppu, lw=Math.max(1.5,ppu*.05), leg=h*.2, swing=!calm()&&(keyL||keyR||padL||padR)&&g.state==="play"?Math.sin(walkT*18)*w*.12:0;
  ctx.save(); if(blink) ctx.globalAlpha=.45;
  ctx.strokeStyle=INK; ctx.lineWidth=lw; ctx.lineJoin="round";
  ctx.fillStyle=INK; ctx.fillRect(x-w*.32+swing,y-leg,w*.2,leg); ctx.fillRect(x+w*.12-swing,y-leg,w*.2,leg);
  ctx.fillStyle="#EA5E14"; ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(x-w/2,y-h,w,h-leg*.7,w*.18); else ctx.rect(x-w/2,y-h,w,h-leg*.7);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle=INK; ctx.font="700 "+Math.round(w*.5)+"px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText("13",x,y-h*.52);
  ctx.restore();
}
function draw(){
  if(!g||!W) return;
  if(!pal) pal=palette();
  var P=pal, i, bl=blocks();
  ctx.setTransform(dprv,0,0,dprv,0,0); ctx.clearRect(0,0,W,H);
  ctx.fillStyle=P.bg; ctx.fillRect(0,0,W,H);
  /* a backlog of wireframe tickets behind the action */
  ctx.save(); ctx.strokeStyle=P.line; ctx.globalAlpha=.5; ctx.lineWidth=1;
  var tw=2.6*ppu, th=1.5*ppu, cols=Math.ceil(WW/3.2);
  for(i=0;i<cols;i++){ for(var j=0;j<2;j++){ var bx=(i*3.2+.3+(j?1.1:0))*ppu, by=(1.2+j*2.6)*ppu;
    ctx.strokeRect(bx,by,tw,th); ctx.beginPath(); ctx.moveTo(bx+tw*.1,by+th*.3); ctx.lineTo(bx+tw*.7,by+th*.3); ctx.moveTo(bx+tw*.1,by+th*.55); ctx.lineTo(bx+tw*.5,by+th*.55); ctx.stroke(); } }
  ctx.restore();
  /* floor */
  var fy=sy(FY); ctx.fillStyle=P.ink; ctx.globalAlpha=.14; ctx.fillRect(0,fy,W,H-fy); ctx.globalAlpha=1; ctx.fillStyle=P.ink; ctx.fillRect(0,fy,W,Math.max(2,ppu*.07));
  ctx.strokeStyle=P.ink; ctx.globalAlpha=.3; ctx.lineWidth=1; ctx.beginPath();
  for(var x=0;x<WW+1;x+=1.2){ ctx.moveTo(sx(x),fy+ppu*.22); ctx.lineTo(sx(x)-ppu*.25,fy+ppu*.6); } ctx.stroke(); ctx.globalAlpha=1;
  /* blocks: walls hang from the top, shelves float */
  for(i=0;i<bl.length;i++){ var w=bl[i], wx=sx(w.x0), ww=(w.x1-w.x0)*ppu, wy=sy(w.y0), wh=(w.y1-w.y0)*ppu;
    ctx.fillStyle=P.ink; ctx.fillRect(wx,wy,ww,wh);
    if(w.label){ ctx.save(); ctx.translate(wx+ww/2,wy+wh/2); if(wh>ww) ctx.rotate(-Math.PI/2); ctx.fillStyle=P.bg; ctx.font="600 "+Math.max(8,Math.round(Math.min(ppu*.26,Math.min(ww,wh)*.7)))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(w.label,0,0); ctx.restore(); } }
  /* shots */
  for(i=0;i<g.shots.length;i++){ var h=g.shots[i], hx=sx(h.x);
    ctx.save(); ctx.lineCap="round";
    if(h.k==="bullet"){ ctx.strokeStyle=P.or2; ctx.lineWidth=Math.max(3,ppu*.12); ctx.beginPath(); ctx.moveTo(hx,sy(h.y)); ctx.lineTo(hx,sy(h.y+.45)); ctx.stroke(); }
    else { var ty=sy(h.tip); ctx.strokeStyle=h.sticky?P.or2:P.ink; ctx.lineWidth=Math.max(2,ppu*(h.sticky?.09:.07));
      if(h.stuck>0&&!calm()&&h.stuck<.8&&Math.floor(h.stuck*10)%2===0) ctx.globalAlpha=.4;
      ctx.beginPath(); ctx.moveTo(hx,fy); ctx.lineTo(hx,ty); ctx.stroke();
      ctx.fillStyle=P.or2; ctx.beginPath(); ctx.moveTo(hx,ty-ppu*.22); ctx.lineTo(hx-ppu*.13,ty+ppu*.08); ctx.lineTo(hx+ppu*.13,ty+ppu*.08); ctx.closePath(); ctx.fill(); }
    ctx.restore(); }
  /* drops: a labelled capsule; it blinks in its last two seconds */
  for(i=0;i<g.drops.length;i++){ var dp=g.drops[i]; if(dp.life<2&&!calm()&&Math.floor(dp.life*8)%2===0) continue;
    var cw=1.35*ppu, ch=.6*ppu, cx=sx(dp.x)-cw/2, cy=sy(dp.y)-ch/2;
    ctx.save(); ctx.fillStyle=P.paper; ctx.strokeStyle=GUNS[dp.k]?P.or2:INK; ctx.lineWidth=Math.max(1.5,ppu*.05);
    ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(cx,cy,cw,ch,ch/2); else ctx.rect(cx,cy,cw,ch); ctx.fill(); ctx.stroke();
    ctx.fillStyle=GUNS[dp.k]?P.or:P.ink; ctx.font="700 "+Math.max(8,Math.round(ppu*.24))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(DROPS[dp.k].lab,cx+cw/2,cy+ch/2+1);
    ctx.restore(); }
  for(i=0;i<g.bubbles.length;i++) drawBubble(g.bubbles[i]);
  drawPlayer();
  if(g.shield){ ctx.save(); ctx.strokeStyle="#4F9E92"; ctx.lineWidth=Math.max(2,ppu*.08); ctx.globalAlpha=.85; ctx.beginPath(); ctx.arc(sx(g.px),sy(FY-PH*.5),PH*.85*ppu,0,6.2832); ctx.stroke(); ctx.restore(); }
  for(i=0;i<parts.length;i++){ var q=parts[i]; ctx.save(); ctx.globalAlpha=Math.max(0,1-q.t/q.life); ctx.translate(sx(q.x),sy(q.y)); ctx.rotate(q.r); ctx.fillStyle=q.c; var s=q.s*ppu; ctx.fillRect(-s/2,-s/2,s,s); ctx.restore(); }
  for(i=0;i<pops.length;i++){ var o=pops[i]; ctx.save(); ctx.globalAlpha=Math.max(0,1-o.t/.9); ctx.fillStyle=P.ink; ctx.font="600 "+Math.max(12,Math.round(ppu*.4))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.fillText(o.s,sx(o.x),sy(o.y)-o.t*ppu*1.1); ctx.restore(); }
  if(g.state==="ready"){ ctx.save(); ctx.fillStyle=P.muted; ctx.font="500 "+Math.max(11,Math.round(ppu*.34))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.fillText("walk or fire to start the clock",W/2,sy(FY-PH-.5)); ctx.restore(); }
}

/* ---------- boot ---------- */
var start=0; for(var si=0;si<NL;si++){ if(unlocked(si)&&save.best[si]===0){ start=si; break; } }
if(document.fonts&&document.fonts.load) document.fonts.load("700 40px Fraunces").then(function(){ if(vis&&W) draw(); },function(){});
loadLevel(start,false);
say("Scope Pop. "+NL+" levels. Level "+(start+1)+" is up: "+pl(g.bubbles.length,"request")+", "+g.d.time+" seconds. Click the board, then walk or press Space to start.");
})();
