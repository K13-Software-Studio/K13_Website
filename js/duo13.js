/* K13 Design & Code: a two-player co-op puzzle platformer for one keyboard, built on the workbench card anatomy.
   Design (orange) can stand in fire. Code (jade) can stand in water. Sludge kills both. A plate holds a door open only while
   somebody stands on it, so the two have to take turns holding it. Each collects only its own gems. Both must reach their own exit.
   Two small levels, each one needs the hand-over once. Best times are kept on this device.
   The loop is a fixed 120 Hz step behind an accumulator and draws to a devicePixelRatio-crisp canvas. The clock stops when the
   board loses focus, the card leaves the screen or the tab is hidden, so nobody dies while looking away.
   prefers-reduced-motion: no shake, no particles, no bobbing, doors snap. The game itself still plays.
   Keyboard (board focused): Design is WASD (W jumps), Code is the arrows (Up jumps), both at once. Tab hands the arrow keys to the
   other character, for solo play. R restarts the level, N goes to the next, Esc pauses and lets you leave the board.
   Touch: Left, Right, Jump and Switch buttons under the board, each 44px or more, several at once.
   The core (levels, collisions, rules) sits between the CORE markers and touches no DOM. */
(function(){
"use strict";

/* ===================================================== CORE-BEGIN ===================================================== */
var COLS=20, ROWS=12, HW=.3, HT=.8, GRAV=42, JV=14.6, MOVE=6.2, ACC=70, VMAX=20, DEAD_T=.55, DT=1/120;

/* map legend: # wall . air | f fire pool, w water pool, s sludge | 1 plate, a plate in fire, b plate in water (all open door 1) | X door 1
   D Design start, C Code start | E Design exit, e Code exit | o orange gem (Design's), j jade gem (Code's) */
var LEVELS=[
  {name:"Hello, pair",tip:"The door stays open only while someone stands on a plate. There is one plate on each side. Hold one, send your partner through, then swap.",
   rows:[
    "####################",
    "#.........#........#",
    "#.........#........#",
    "#.........#........#",
    "#.........#........#",
    "#.........#........#",
    "#.........X........#",
    "#.........X........#",
    "#...o.j...X...oj.Ee#",
    "#.DC....1.X.1....Ee#",
    "####ffww######ss####",
    "####################"]},
  {name:"Hot and cold",tip:"The fire plate is Design's, the water plate is Code's. Whoever holds a plate keeps the door open for the other.",
   rows:[
    "####################",
    "#.........#........#",
    "#.........#........#",
    "#.........#........#",
    "#.........#.....E.e#",
    "#.........#.....E.e#",
    "#.........X.....####",
    "#.........X.....####",
    "#...oj....X....#####",
    "#DC.......X....#####",
    "####ss##a####b######",
    "####################"]}
];
var N=LEVELS.length;

function parse(def){
  var n=COLS*ROWS, L={name:def.name,tip:def.tip,g:new Uint8Array(n),dr:new Uint8Array(n),pl:new Uint8Array(n),ex:new Uint8Array(n),
    gems:[],spawn:[null,null],plates:[],doors:[],box:{}}, r, c, ch, i;
  for(r=0;r<ROWS;r++) for(c=0;c<COLS;c++){
    ch=def.rows[r].charAt(c); i=r*COLS+c;
    if(ch==="#") L.g[i]=1; else if(ch==="f") L.g[i]=2; else if(ch==="w") L.g[i]=3; else if(ch==="s") L.g[i]=4;
    else if(ch==="a"){ L.g[i]=2; L.pl[i]=1; } else if(ch==="b"){ L.g[i]=3; L.pl[i]=1; } else if(ch==="1") L.pl[i]=1;
    else if(ch==="X") L.dr[i]=1;
    else if(ch==="D") L.spawn[0]={c:c,r:r}; else if(ch==="C") L.spawn[1]={c:c,r:r};
    else if(ch==="E") L.ex[i]=1; else if(ch==="e") L.ex[i]=2;
    else if(ch==="o") L.gems.push({c:c,r:r,w:0}); else if(ch==="j") L.gems.push({c:c,r:r,w:1});
    if(L.pl[i]) L.plates.push({c:c,r:r,id:1});
    if(L.dr[i]){ L.doors.push({c:c,r:r,id:1}); var b=L.box[1]||(L.box[1]={c:c,r0:r,r1:r}); b.r0=Math.min(b.r0,r); b.r1=Math.max(b.r1,r); }
  }
  return L;
}
var PARSED=LEVELS.map(parse);
function mk(L,w){ var s=L.spawn[w]; return {x:s.c+.5,y:s.r+1,vx:0,vy:0,g:false,face:w?-1:1}; }
function newGame(li){
  var L=PARSED[li], S={li:li,L:L,ch:[mk(L,0),mk(L,1)],got:L.gems.map(function(){ return 0; }),open:[0,0],on:L.plates.map(function(){ return 0; }),
    t:0,deaths:0,dead:0,who:-1,cause:0,won:false};
  return S;
}
function respawn(S){ S.ch=[mk(S.L,0),mk(S.L,1)]; S.got=S.L.gems.map(function(){ return 0; }); S.dead=0; S.who=-1; S.cause=0; }
function solid(S,c,r){
  if(c<0||r<0||c>=COLS||r>=ROWS) return true;
  var i=r*COLS+c; if(S.L.g[i]===1) return true;
  var d=S.L.dr[i]; return d?!S.open[d]:false;
}
function hits(S,x,y){
  var c0=Math.floor(x-HW+1e-6), c1=Math.floor(x+HW-1e-6), r0=Math.floor(y-HT+1e-6), r1=Math.floor(y-1e-6), c, r;
  for(r=r0;r<=r1;r++) for(c=c0;c<=c1;c++) if(solid(S,c,r)) return true;
  return false;
}
function overlapsDoor(ch,d){ return ch.x+HW>d.c+.001&&ch.x-HW<d.c+1-.001&&ch.y>d.r+.001&&ch.y-HT<d.r+1-.001; }
function updateDoors(S,ev){
  var L=S.L, want=[0,0], i, w, p, d, on;
  for(i=0;i<L.plates.length;i++){
    p=L.plates[i]; on=0;
    for(w=0;w<2;w++){ var ch=S.ch[w]; if(ch.g&&Math.floor(ch.x)===p.c&&Math.floor(ch.y-.05)===p.r) on=1; }
    S.on[i]=on; if(on) want[p.id]=1;
  }
  /* a door never closes on somebody standing in it */
  for(i=0;i<L.doors.length;i++){ d=L.doors[i]; for(w=0;w<2;w++) if(overlapsDoor(S.ch[w],d)) want[d.id]=1; }
  for(i=1;i<want.length;i++) if(want[i]!==S.open[i]){ S.open[i]=want[i]; ev.push({k:want[i]?"open":"shut"}); }
}
function stepChar(S,ch,inp,dt){
  var tv=((inp.r?1:0)-(inp.l?1:0))*MOVE, dv=ACC*dt;
  ch.vx=ch.vx<tv?Math.min(tv,ch.vx+dv):Math.max(tv,ch.vx-dv);
  if(tv) ch.face=tv>0?1:-1;
  if(inp.j&&ch.g){ ch.vy=-JV; ch.g=false; }
  ch.vy=Math.min(VMAX,ch.vy+GRAV*dt);
  var nx=ch.x+ch.vx*dt, ny, c;
  if(!hits(S,nx,ch.y)) ch.x=nx;
  else { if(ch.vx>0){ c=Math.floor(nx+HW); ch.x=c-HW-1e-4; } else if(ch.vx<0){ c=Math.floor(nx-HW); ch.x=c+1+HW+1e-4; } ch.vx=0; }
  ny=ch.y+ch.vy*dt; ch.g=false;
  if(!hits(S,ch.x,ny)) ch.y=ny;
  else { if(ch.vy>0){ ch.y=Math.floor(ny); ch.g=true; } else if(ch.vy<0){ ch.y=Math.floor(ny-HT)+1+HT+1e-4; } ch.vy=0; }
}
/* what is under the feet: 0 nothing, 2 fire, 3 water, 4 sludge. Design (0) dies in water, Code (1) dies in fire, both in sludge. */
function hazard(S,w){
  var ch=S.ch[w], k=S.L.g[Math.floor(ch.y-.05)*COLS+Math.floor(ch.x)];
  if(k===4) return 4; if(w===0&&k===3) return 3; if(w===1&&k===2) return 2; return 0;
}
function inExit(S,w){ var ch=S.ch[w]; return S.L.ex[Math.floor(ch.y-HT/2)*COLS+Math.floor(ch.x)]===w+1; }
function tick(S,inp,dt,ev){
  if(S.won) return;
  if(S.dead>0){ S.dead-=dt; if(S.dead<=0){ respawn(S); ev.push({k:"respawn"}); } return; }
  S.t+=dt; updateDoors(S,ev);
  var w, i, ch, k;
  for(w=0;w<2;w++) stepChar(S,S.ch[w],inp[w],dt);
  for(w=0;w<2;w++){ k=hazard(S,w); if(k){ S.dead=DEAD_T; S.deaths++; S.who=w; S.cause=k; ev.push({k:"die",w:w,x:S.ch[w].x,y:S.ch[w].y-HT/2}); return; } }
  for(i=0;i<S.L.gems.length;i++){
    var gm=S.L.gems[i]; if(S.got[i]) continue; ch=S.ch[gm.w];
    var nx=Math.max(ch.x-HW,Math.min(gm.c+.5,ch.x+HW)), ny=Math.max(ch.y-HT,Math.min(gm.r+.5,ch.y));
    if((nx-gm.c-.5)*(nx-gm.c-.5)+(ny-gm.r-.5)*(ny-gm.r-.5)<.28*.28){ S.got[i]=1; ev.push({k:"gem",w:gm.w,x:gm.c+.5,y:gm.r+.5}); }
  }
  if(inExit(S,0)&&inExit(S,1)){ S.won=true; ev.push({k:"win"}); }
}
var CORE={COLS:COLS,ROWS:ROWS,HW:HW,HT:HT,DT:DT,LEVELS:LEVELS,N:N,parse:parse,newGame:newGame,tick:tick,hazard:hazard,inExit:inExit,solid:solid};
/* ====================================================== CORE-END ====================================================== */
if(typeof document==="undefined"){ if(typeof module!=="undefined") module.exports=CORE; return; }

var mount=document.querySelector('[data-game="duo13"]');
if(!mount) return;
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
var NAMES=["Design","Code"];

/* card chrome: the same DOM and classes as card() in workbench.js (head, instruction, stage, reset, status, footnote) */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Design & Code")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Two of you, one keyboard. Design (orange) stands in fire, Code (jade) stands in water, sludge takes both. Nothing ships until you both reach your own door."); instr.id="d13-i"; mount.appendChild(instr);
var stage=el("div","wb-stage d13-stage"); stage.setAttribute("aria-describedby","d13-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Restart this level"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Design: W A D. Code: arrow keys. While playing, Tab hands the arrows to the other one for solo play. R restarts, N is the next level, Esc pauses and lets you leave the board. Best times stay on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var top=el("div","d13-top");
var hLevel=txt("span","d13-chip",""), hGems=txt("span","d13-chip",""), hTime=txt("span","d13-chip",""), hDeaths=txt("span","d13-chip d13-deaths",""), hBest=txt("span","d13-chip","");
top.appendChild(hLevel); top.appendChild(hGems); top.appendChild(hTime); top.appendChild(hDeaths); top.appendChild(hBest); stage.appendChild(top);
var view=el("div","d13-view"); stage.appendChild(view);
var cv=el("canvas","d13-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Design and Code game board. Design moves with W, A, D. Code moves with the arrow keys. Tab hands the arrow keys to the other character.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var over=el("div","d13-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Level"); view.appendChild(over);

/* controls under the board: nothing sits on the canvas, so nothing can cover a button */
var bar=el("div","d13-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Controls"); stage.appendChild(bar);
var pad=el("div","d13-pad"); bar.appendChild(pad);
function ctl(label,aria,cls){ var b=txt("button","d13-btn"+(cls?" "+cls:""),label); b.type="button"; b.setAttribute("aria-label",aria); return b; }
var bLeft=ctl("Left","Move left"), bRight=ctl("Right","Move right"), bJump=ctl("Jump","Jump"), bSwitch=ctl("Switch","Switch character","d13-sw");
var swName=txt("span","d13-swn",""); bSwitch.appendChild(swName);
pad.appendChild(bLeft); pad.appendChild(bRight); pad.appendChild(bJump); pad.appendChild(bSwitch);
var lvs=el("div","d13-lvs"); lvs.setAttribute("role","group"); lvs.setAttribute("aria-label","Levels"); bar.appendChild(lvs);
lvs.appendChild(txt("span","d13-lab","Level"));
var lvBtns=LEVELS.map(function(lv,i){
  var b=txt("button","d13-lv",String(i+1)); b.type="button";
  b.addEventListener("click",function(){ if(!b.disabled){ loadLevel(i); focusBoard(); } });
  lvs.appendChild(b); return b;
});

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store("k13_duo13")||"null"); if(s&&s.best&&s.best.length===N&&typeof s.deaths==="number") return s; }catch(e){} return {best:LEVELS.map(function(){ return -1; }),deaths:0}; })();
function persist(){ store("k13_duo13",JSON.stringify(save)); }
var S=null, mode="ready", keys={}, touch={l:{},r:{},j:{}}, pulse={l:0,r:0,j:0}, owner=1;
var W=0, H=0, ppu=30, ox=0, oy=0, dprv=1, vis=false, raf=0, acc=0, last=0, pal=null, fx=[], da=[0,0], anim=0, shake=0, sig="", told=0, pulseT=0;

function unlocked(i){ return i===0||save.best[i-1]>=0; }
function fmt(t){ var m=Math.floor(t/60), s=t-m*60; return m+":"+(s<10?"0":"")+s.toFixed(1); }
function refreshLevels(){
  lvBtns.forEach(function(b,i){
    var ok=unlocked(i), s=save.best[i];
    b.disabled=!ok; b.classList.toggle("done",s>=0); b.setAttribute("aria-pressed",String(!!S&&S.li===i));
    b.setAttribute("aria-label","Level "+(i+1)+", "+LEVELS[i].name+(ok?(s>=0?", cleared, best "+fmt(s):", not cleared yet"):", locked until level "+i+" is cleared"));
  });
}
function refreshOwner(){
  swName.textContent="Now "+NAMES[owner];
  bSwitch.setAttribute("aria-label","Switch character. The arrow keys and these buttons move "+NAMES[owner]+" now.");
  stage.setAttribute("data-owner",NAMES[owner].toLowerCase());
}
function hud(){
  if(!S) return;
  var got=0; S.got.forEach(function(v){ if(v) got++; });
  var s=[S.li,S.deaths,got,Math.floor(S.t*10),save.deaths].join("|"); if(s===sig) return; sig=s;
  hLevel.textContent=(S.li+1)+"/"+N+" "+S.L.name;
  hGems.textContent="Gems "+got+"/"+S.got.length;
  hTime.textContent="Time "+fmt(S.t);
  hDeaths.textContent="Deaths "+S.deaths;
  var b=save.best[S.li]; hBest.textContent=b>=0?"Best "+fmt(b):"No best yet";
}
function panel(title,sub,buttons){
  over.innerHTML=""; var p=el("div","d13-panel");
  p.appendChild(txt("div","d13-over-t",title)); if(sub) p.appendChild(txt("p","d13-over-s",sub));
  var row=el("div","d13-over-row");
  buttons.forEach(function(b){ var x=txt("button","d13-obtn"+(b.ghost?" ghost":""),b.label); x.type="button"; x.addEventListener("click",b.go); row.appendChild(x); });
  p.appendChild(row); over.appendChild(p); over.hidden=false;
  return row.firstChild;
}
function clearInput(){ keys={}; ["l","r","j"].forEach(function(k){ Object.keys(touch[k]).forEach(function(id){ delete touch[k][id]; }); }); pulse.l=pulse.r=pulse.j=0; bLeft.classList.remove("held"); bRight.classList.remove("held"); bJump.classList.remove("held"); }
function loadLevel(i){
  S=newGame(i); mode="ready"; fx.length=0; da=[0,0]; shake=0; sig=""; told=0; owner=1; clearInput();
  panel("Level "+(i+1)+": "+S.L.name,S.L.tip,[{label:"Start",go:function(){ begin(); }}]);
  hud(); refreshLevels(); refreshOwner(); fit(); wake();
  say("Level "+(i+1)+" of "+N+", "+S.L.name+". Press Start, or any move key. "+S.got.length+" gems on the way, two for each of you, all optional.");
}
function begin(){ if(!S||S.won) return; over.hidden=true; mode="play"; focusBoard(); last=0; wake(); }
function pause(why,focusPanel){ if(mode!=="play") return; mode="paused"; clearInput();
  var b=panel("Paused",why||"The clock waits for you.",[{label:"Continue",go:function(){ begin(); }}]);
  if(focusPanel) try{ b.focus({preventScroll:true}); }catch(x){} }
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function nextLevel(){ if(S&&S.li+1<N&&unlocked(S.li+1)){ loadLevel(S.li+1); focusBoard(); } }
function restart(){ if(S){ loadLevel(S.li); begin(); } }
function switchWho(){ owner=1-owner; clearInput(); refreshOwner(); say("The arrow keys and the buttons move "+NAMES[owner]+" now."); wake(); }

function won(){
  mode="won"; clearInput(); var li=S.li, d=S.deaths, t=Math.round(S.t*10)/10, fresh=save.best[li]<0||t<save.best[li];
  if(fresh) save.best[li]=t; persist(); refreshLevels(); hud();
  var line="Level "+(li+1)+" shipped in "+fmt(t)+" with "+d+(d===1?" death. ":" deaths. ")+(fresh?"New best.":"Best is "+fmt(save.best[li])+".");
  if(li+1<N){
    var b=panel("It ships.",line+" Next: "+LEVELS[li+1].name+".",[{label:"Next level",go:function(){ loadLevel(li+1); begin(); }},{label:"Play again",ghost:true,go:function(){ loadLevel(li); begin(); }}]);
    say(line+" Press N or the button for "+LEVELS[li+1].name+".");
    setTimeout(function(){ try{ b.focus({preventScroll:true}); }catch(x){} },30);
  } else {
    panel("Both levels shipped.","Nobody ships alone. "+line,[{label:"Play level 1 again",go:function(){ loadLevel(0); begin(); }},{label:"Replay this one",ghost:true,go:function(){ loadLevel(li); begin(); }}]);
    say("Both levels cleared. "+line);
  }
}

/* ---------- input ---------- */
var KEYMAP={KeyA:"wl",KeyD:"wr",KeyW:"wj",ArrowLeft:"al",ArrowRight:"ar",ArrowUp:"aj",Space:"aj"};
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var k=KEYMAP[e.code];
  if(k){ e.preventDefault(); keys[k]=1; if(mode==="ready"||mode==="paused") begin(); }
  /* Tab swaps characters only while a level is running; before the start and when paused it moves focus on as usual, so the board never traps the keyboard */
  else if(e.code==="Tab"&&!e.shiftKey&&mode==="play"){ e.preventDefault(); if(!e.repeat) switchWho(); }
  else if(e.code==="Enter"){ if(mode!=="play"&&mode!=="won"){ e.preventDefault(); begin(); } }
  else if(e.code==="Escape"){ if(mode==="play"){ e.preventDefault(); pause("Paused. Tab now moves on to the buttons.",true); } }
});
cv.addEventListener("keyup",function(e){ var k=KEYMAP[e.code]; if(k) keys[k]=0; });
mount.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var t=e.target; if(t&&t.tagName==="BUTTON"&&(e.code==="Enter"||e.code==="Space")) return;
  if(e.code==="KeyR"){ e.preventDefault(); restart(); }
  else if(e.code==="KeyN"){ e.preventDefault(); nextLevel(); }
});
cv.addEventListener("blur",function(){ if(mode==="play") pause("You clicked away, so the clock stopped."); keys={}; });
cv.addEventListener("pointerdown",function(){ focusBoard(); if(mode==="ready"||mode==="paused") begin(); });
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });

/* touch and mouse buttons: hold to move, several at once. A keyboard click (detail 0) gives a short tap instead. */
function hold(btn,key){
  var held=touch[key];
  btn.addEventListener("pointerdown",function(e){
    if(e.button>0) return; e.preventDefault();
    if(mode==="ready"||mode==="paused") begin();
    held[e.pointerId]=1; btn.classList.add("held");
    try{ btn.setPointerCapture(e.pointerId); }catch(x){}
  });
  function up(e){ delete held[e.pointerId]; if(!Object.keys(held).length) btn.classList.remove("held"); }
  btn.addEventListener("pointerup",up); btn.addEventListener("pointercancel",up); btn.addEventListener("lostpointercapture",up);
  btn.addEventListener("mousedown",function(e){ e.preventDefault(); });
  btn.addEventListener("contextmenu",function(e){ e.preventDefault(); });
  btn.addEventListener("click",function(e){ if(e.detail===0){ if(mode==="ready"||mode==="paused") begin(); pulse[key]=key==="j"?.06:.18; wake(); } });
}
hold(bLeft,"l"); hold(bRight,"r"); hold(bJump,"j");
bSwitch.addEventListener("mousedown",function(e){ e.preventDefault(); });
bSwitch.addEventListener("click",function(){ switchWho(); });
reset.addEventListener("click",restart);

function pressed(m){ return Object.keys(m).length>0; }
function inputs(){
  var d={l:0,r:0,j:0}, c={l:0,r:0,j:0}, me=owner?c:d;
  d.l=keys.wl?1:0; d.r=keys.wr?1:0; d.j=keys.wj?1:0;
  me.l=me.l||keys.al?1:0; me.r=me.r||keys.ar?1:0; me.j=me.j||keys.aj?1:0;
  if(pressed(touch.l)||pulse.l>0) me.l=1; if(pressed(touch.r)||pulse.r>0) me.r=1; if(pressed(touch.j)||pulse.j>0) me.j=1;
  return [d,c];
}

/* ---------- loop ---------- */
var EV=[];
function step(dt){
  if(pulse.l>0) pulse.l-=dt; if(pulse.r>0) pulse.r-=dt; if(pulse.j>0) pulse.j-=dt;
  EV.length=0; tick(S,inputs(),dt,EV);
  EV.forEach(function(e){
    if(e.k==="gem"){ var got=S.got.filter(Boolean).length; burst(e.x,e.y,e.w?"jade":"fire");
      say(NAMES[e.w]+" has "+S.got.filter(function(v,i){ return v&&S.L.gems[i].w===e.w; }).length+" of "+S.L.gems.filter(function(g){ return g.w===e.w; }).length+" gems. Gems are optional.");
      if(got===S.got.length) say("Every gem in. The doors are what is left."); }
    else if(e.k==="die"){ save.deaths++; persist(); burst(e.x,e.y,e.w?"jade":"fire",true); shake=calm()?0:.3;
      say(S.cause===4?"Sludge, and it does not pick favourites. Back to the start.":(NAMES[e.w]+" met the "+(S.cause===3?"water":"fire")+". Back to the start.")); }
    else if(e.k==="respawn"){ say("Back at the start. The clock kept going."); }
    else if(e.k==="open"){ var bx=S.L.box[1]; if(bx&&!calm()) fx.push({x:bx.c+.5,y:(bx.r0+bx.r1+1)/2,c:"ink",t:0,s:1.1}); if(!told){ told=1; say("Door open. It stays open only while someone stands on a plate."); } }
    else if(e.k==="win"){ won(); }
  });
}
function burst(x,y,c,big){ if(!calm()) fx.push({x:x,y:y,c:c,t:0,s:big?1.5:.9,b:big?1:0}); }
function frame(now){
  raf=0; if(!vis||!S) return;
  if(!last) last=now; var dt=Math.min(.1,(now-last)/1000); last=now;
  if(mode==="play"){ acc+=dt; while(acc>=DT){ step(DT); acc-=DT; if(mode!=="play"){ acc=0; break; } } }
  if(!calm()&&(mode==="play"||mode==="ready")) anim+=dt;
  var id, tgt;
  for(id=1;id<S.open.length;id++){ tgt=S.open[id]; da[id]=calm()?tgt:(tgt>da[id]?Math.min(tgt,da[id]+dt/.22):Math.max(tgt,da[id]-dt/.22)); }
  for(var i=fx.length-1;i>=0;i--){ fx[i].t+=dt; if(fx[i].t>.6) fx.splice(i,1); }
  if(shake>0) shake=Math.max(0,shake-dt);
  hud(); draw();
  if(vis&&(mode==="play"||(mode==="ready"&&!calm())||fx.length||shake>0||(da[1]>0&&da[1]<1))) raf=requestAnimationFrame(frame);
}
function wake(){ if(!raf&&vis){ last=0; raf=requestAnimationFrame(frame); } if(!vis||calm()) draw(); }

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement), dark=document.documentElement.getAttribute("data-theme")==="dark";
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  return {bg:v("--paper-3","#E9EDF7"),dot:v("--line","rgba(31,32,35,.12)"),ink:v("--ink","#1F2023"),muted:v("--muted","#5D5F65"),paper:v("--paper-2","#FFFFFF"),
    wall:dark?"#3B3D42":"#33353A",wallHi:dark?"#4B4D53":"#46484E",
    fire:"#EA5E14",fireHi:"#F59A5E",fireDeep:"#B94612",water:"#4F9E92",waterHi:"#8CC8BD",waterDeep:"#3C8A7E",
    sludge:dark?"#0B0B0D":"#141517",sludgeHi:"#7A7C82",door:dark?"#8D9097":"#6B6E75",doorHi:dark?"#B1B2B6":"#8E9198",
    exitD:v("--wash-blue","#FCE0CC"),exitC:v("--wash-mint","#D6F0E6"),dark:dark};
}
new MutationObserver(function(){ pal=null; wake(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function fit(){
  var r=view.getBoundingClientRect(); if(!r.width) return;
  dprv=Math.min(window.devicePixelRatio||1,2); W=r.width; H=r.height;
  cv.width=Math.round(W*dprv); cv.height=Math.round(H*dprv);
  ppu=Math.min(W/COLS,H/ROWS); ox=(W-ppu*COLS)/2; oy=(H-ppu*ROWS)/2; draw();
}
function sx(x){ return ox+x*ppu; } function sy(y){ return oy+y*ppu; }
function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function col(P,c){ return c==="jade"?P.water:c==="fire"?P.fire:P.ink; }
function draw(){
  if(!S||!W) return;
  if(!pal) pal=palette();
  var P=pal, L=S.L, u=ppu, r, c, k, i, z;
  ctx.setTransform(dprv,0,0,dprv,0,0); ctx.clearRect(0,0,W,H);
  ctx.fillStyle=P.bg; ctx.fillRect(0,0,W,H);
  ctx.save();
  if(shake>0){ var a=shake/.3*u*.14; ctx.translate((Math.random()-.5)*2*a,(Math.random()-.5)*2*a); }
  /* quiet drafting dots in the air */
  ctx.fillStyle=P.dot;
  for(r=1;r<ROWS-1;r++) for(c=1;c<COLS-1;c++) if(!L.g[r*COLS+c]) ctx.fillRect(Math.round(sx(c)),Math.round(sy(r)),1,1);
  /* walls */
  for(r=0;r<ROWS;r++) for(c=0;c<COLS;c++){
    if(L.g[r*COLS+c]!==1) continue;
    ctx.fillStyle=P.wall; ctx.fillRect(Math.floor(sx(c)),Math.floor(sy(r)),Math.ceil(u)+1,Math.ceil(u)+1);
  }
  /* a thin lighter rim where a wall meets the air, so the shapes read */
  ctx.save(); ctx.strokeStyle=P.wallHi; ctx.lineWidth=Math.max(1,u*.06); ctx.beginPath();
  for(r=0;r<ROWS;r++) for(c=0;c<COLS;c++){
    if(L.g[r*COLS+c]!==1) continue; var x0=sx(c), y0=sy(r), x1=sx(c+1), y1=sy(r+1);
    if(r>0&&L.g[(r-1)*COLS+c]!==1){ ctx.moveTo(x0,y0+.5); ctx.lineTo(x1,y0+.5); }
  }
  ctx.stroke(); ctx.restore();
  /* pools: liquid with a moving surface, sludge with bubbles */
  for(r=0;r<ROWS;r++) for(c=0;c<COLS;c++){
    k=L.g[r*COLS+c]; if(k<2) continue;
    var px=sx(c), py=sy(r), main=k===2?P.fire:k===3?P.water:P.sludge, hi=k===2?P.fireHi:k===3?P.waterHi:P.sludgeHi;
    var wob=calm()?0:Math.sin(anim*3+c*1.7)*u*.04, top=py+u*.16+wob;
    ctx.fillStyle=main; ctx.fillRect(Math.floor(px),Math.floor(top),Math.ceil(u)+1,Math.ceil(py+u-top)+1);
    ctx.fillStyle=hi; ctx.fillRect(Math.floor(px),Math.floor(top),Math.ceil(u)+1,Math.max(2,u*.1));
    if(k===4){ var bb=calm()?0:(anim*.8+c*.37)%1; ctx.beginPath(); ctx.arc(px+u*.5,py+u*(.75-bb*.3),u*.08,0,Math.PI*2); ctx.fillStyle=hi; ctx.fill(); }
  }
  /* plates */
  for(i=0;i<L.plates.length;i++){
    var p=L.plates[i], on=S.on[i], ph=u*(on?.07:.16);
    var wide=u*.84, bx0=sx(p.c)+(u-wide)/2, by0=sy(p.r+1)-ph;
    ctx.fillStyle=on?P.ink:P.paper; ctx.strokeStyle=P.ink; ctx.lineWidth=Math.max(1.2,u*.06);
    rr(bx0,by0,wide,ph,Math.min(ph/2,3)); ctx.fill(); ctx.stroke();
    if(!on){ ctx.fillStyle=P.fire; ctx.fillRect(bx0+wide*.3,by0+ph*.3,wide*.4,Math.max(1,ph*.4)); }
  }
  /* exits */
  var gx={};
  for(r=0;r<ROWS;r++) for(c=0;c<COLS;c++){ z=L.ex[r*COLS+c]; if(!z) continue; var g=gx[z]||(gx[z]={c:c,r0:r,r1:r}); g.r0=Math.min(g.r0,r); g.r1=Math.max(g.r1,r); }
  Object.keys(gx).forEach(function(key){
    var g=gx[key], w=+key-1, ex0=sx(g.c)+u*.1, ey0=sy(g.r0)+u*.1, ew=u*.8, eh=(g.r1-g.r0+1)*u-u*.1;
    ctx.fillStyle=w?P.exitC:P.exitD; ctx.strokeStyle=w?P.water:P.fire; ctx.lineWidth=Math.max(2,u*.1);
    rr(ex0,ey0,ew,eh,u*.3); ctx.fill(); ctx.stroke();
    if(u>=11){ ctx.fillStyle=w?P.waterDeep:P.fireDeep; ctx.font="600 "+Math.max(9,Math.min(u*.42,14))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(w?"C":"D",ex0+ew/2,ey0+eh*.5); }
  });
  /* doors: they slide up into the wall when a plate is held */
  Object.keys(L.box).forEach(function(id){
    var b=L.box[id], dh=(b.r1-b.r0+1)*u, vh=dh*(1-(da[id]||0)); if(vh<1) return;
    var dx=sx(b.c)+u*.08, dy=sy(b.r0), dw=u*.84;
    ctx.fillStyle=P.door; ctx.fillRect(dx,dy,dw,vh);
    ctx.strokeStyle=P.doorHi; ctx.lineWidth=Math.max(1,u*.05); ctx.beginPath();
    for(var yy=dy+u*.5;yy<dy+vh-1;yy+=u*.5){ ctx.moveTo(dx+2,yy); ctx.lineTo(dx+dw-2,yy); } ctx.stroke();
    ctx.strokeStyle=P.ink; ctx.lineWidth=Math.max(1.2,u*.06); ctx.strokeRect(dx,dy,dw,vh);
  });
  /* gems */
  for(i=0;i<L.gems.length;i++){
    if(S.got[i]) continue; var gm=L.gems[i], bob=calm()?0:Math.sin(anim*3+i)*u*.05, gcx=sx(gm.c+.5), gcy=sy(gm.r+.5)+bob, gr=u*.3;
    ctx.beginPath(); ctx.moveTo(gcx,gcy-gr); ctx.lineTo(gcx+gr*.85,gcy); ctx.lineTo(gcx,gcy+gr); ctx.lineTo(gcx-gr*.85,gcy); ctx.closePath();
    ctx.fillStyle=gm.w?P.water:P.fire; ctx.fill(); ctx.lineWidth=Math.max(1.2,u*.055); ctx.strokeStyle=P.ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gcx-gr*.1,gcy-gr*.6); ctx.lineTo(gcx+gr*.35,gcy-gr*.05); ctx.strokeStyle="rgba(255,255,255,.85)"; ctx.lineWidth=Math.max(1,u*.05); ctx.stroke();
  }
  /* the two of them */
  for(i=1;i>=0;i--) drawChar(P,i,u);
  /* the one the arrow keys move wears a small marker */
  var oc=S.ch[owner];
  if(!(S.dead>0)){ var mb=calm()?0:Math.sin(anim*5)*u*.06, mx=sx(oc.x), my=sy(oc.y-HT)-u*.28+mb, ms=u*.2;
    ctx.beginPath(); ctx.moveTo(mx-ms,my-ms); ctx.lineTo(mx+ms,my-ms); ctx.lineTo(mx,my+ms*.6); ctx.closePath(); ctx.fillStyle=P.ink; ctx.fill(); }
  /* rings and puffs */
  for(i=0;i<fx.length;i++){ var f=fx[i], t=f.t/.6; ctx.save(); ctx.globalAlpha=1-t; ctx.strokeStyle=col(P,f.c); ctx.fillStyle=col(P,f.c); ctx.lineWidth=Math.max(2,u*.08);
    ctx.beginPath(); ctx.arc(sx(f.x),sy(f.y),u*(.3+t*f.s),0,Math.PI*2); ctx.stroke();
    if(f.b){ for(var q=0;q<8;q++){ var an=q*Math.PI/4+.4, dd=u*(.2+t*1.2); ctx.fillRect(sx(f.x)+Math.cos(an)*dd-u*.07,sy(f.y)+Math.sin(an)*dd-u*.07,u*.14,u*.14); } }
    ctx.restore(); }
  ctx.restore();
}
function drawChar(P,w,u){
  var ch=S.ch[w], dead=S.dead>0&&S.who>=0;
  if(dead&&S.who===w&&S.dead<DEAD_T-.12) return;
  var x0=sx(ch.x-HW), y0=sy(ch.y-HT), bw=u*HW*2, bh=u*HT;
  ctx.save(); if(dead&&S.who!==w) ctx.globalAlpha=.55;
  ctx.fillStyle=w?P.water:P.fire; ctx.strokeStyle=P.ink; ctx.lineWidth=Math.max(1.5,u*.07);
  rr(x0,y0,bw,bh,w?u*.08:u*.22); ctx.fill(); ctx.stroke();
  /* Design wears a pencil tip, Code wears a flat cap, so the two read apart without the colour */
  ctx.fillStyle=P.ink;
  if(w){ ctx.fillRect(x0-u*.04,y0-u*.04,bw+u*.08,Math.max(2,u*.1)); }
  else { ctx.beginPath(); ctx.moveTo(x0+bw*.3,y0+1); ctx.lineTo(x0+bw*.5,y0-u*.2); ctx.lineTo(x0+bw*.7,y0+1); ctx.closePath(); ctx.fill(); }
  /* eyes look the way they walk */
  var ey=y0+bh*.34, ex=x0+bw*.5+ch.face*bw*.1, er=Math.max(1.4,u*.075);
  ctx.fillStyle="#FFFFFF"; ctx.beginPath(); ctx.arc(ex-bw*.2,ey,er*1.5,0,Math.PI*2); ctx.arc(ex+bw*.2,ey,er*1.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=P.ink; ctx.beginPath(); ctx.arc(ex-bw*.2+ch.face*er*.5,ey,er*.8,0,Math.PI*2); ctx.arc(ex+bw*.2+ch.face*er*.5,ey,er*.8,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ---------- visibility, resize ---------- */
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else if(mode==="play") pause("The board left the screen, so the clock stopped."); },{threshold:.15}).observe(view);
document.addEventListener("visibilitychange",function(){ if(document.hidden&&mode==="play") pause(); });
var rz=0; window.addEventListener("resize",function(){ cancelAnimationFrame(rz); rz=requestAnimationFrame(fit); });
if(window.ResizeObserver) new ResizeObserver(function(){ fit(); }).observe(view);
if(mq.addEventListener) mq.addEventListener("change",function(){ fx.length=0; shake=0; wake(); });

/* ---------- boot: the first level not yet cleared ---------- */
var start=0; for(var si=0;si<N;si++){ if(unlocked(si)&&save.best[si]<0){ start=si; break; } }
S=newGame(start); refreshLevels(); hud();
loadLevel(start);
})();
