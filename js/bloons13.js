/* K13 Pop 13: a small tower defense on the workbench. Bugs float down a winding road toward prod, you place two kinds of tower,
   the towers fire on their own, and every popped layer pays. Tough bugs are layered: popping one reveals a weaker one underneath,
   and the colour you see is the layer it is on. Eight waves, one map, a Start wave button, a 1x/2x/3x speed toggle.
   Built on the workbench card anatomy (head, instruction, stage, reset pill, status line, footnote), like Angry 13 and The Hardest Ship.
   The loop is a fixed 60 Hz step behind an accumulator and draws to a devicePixelRatio-crisp canvas (cap 2). It stops when the card
   leaves the screen or the tab is hidden, and a running wave pauses when focus leaves the card.
   prefers-reduced-motion: no particles, rings, panel rise or pulses. The game itself still plays.
   Keyboard (board focused): arrows move the cursor (Shift jumps), 1 and 2 pick a tower, Enter or Space places or selects,
   U upgrades, X sells, G starts the wave, F changes speed, P or Esc pauses.
   Touch: tap a spot to place the armed tower, tap a tower to select it. Every action is also a real labelled button. */
(function(){
"use strict";

var mount=document.querySelector('[data-game="bloons13"]');
if(!mount) return;

var VW=560, VH=350, STEP=1/60, TAU=Math.PI*2, LANE=22, NWAVES=8, KEY="k13.bloons13.best";
var PATH=[[-20,45],[510,45],[510,127],[50,127],[50,209],[510,209],[510,291],[-20,291]];
var SPD=[0,70,91,112,140,52];            /* px per second by layer */
var BR=[0,9,9.5,10,10.5,15];             /* bug radius by layer */
var TOWERS={
  dart:{name:"Linter",cost:50,up:[40,75],range:[96,112,128],cd:[.85,.62,.42],blurb:"One bug at a time, far away."},
  tack:{name:"Hotfix",cost:90,up:[60,100],range:[58,66,74],cd:[1.3,.95,.65],blurb:"Eight shots all round, close in."}
};
/* waves: groups of [layer, count, gap seconds] */
var WAVES=[
  [[1,12,.8]],
  [[1,20,.5]],
  [[1,12,.5],[2,14,.55]],
  [[2,26,.38]],
  [[2,16,.4],[3,16,.45]],
  [[3,30,.34]],
  [[3,20,.35],[4,18,.4]],
  [[4,30,.3],[5,2,2.5]]
];

/* ---------- path geometry ---------- */
var SEG=[], TOTAL=0;
(function(){ for(var i=0;i<PATH.length-1;i++){ var a=PATH[i], b=PATH[i+1], l=Math.hypot(b[0]-a[0],b[1]-a[1]); SEG.push({a:a,b:b,l:l,s:TOTAL}); TOTAL+=l; } })();
function at(d,out){
  for(var i=0;i<SEG.length;i++){ var g=SEG[i]; if(d<=g.s+g.l||i===SEG.length-1){ var t=Math.max(0,Math.min(1,(d-g.s)/g.l)); out.x=g.a[0]+(g.b[0]-g.a[0])*t; out.y=g.a[1]+(g.b[1]-g.a[1])*t; return out; } }
  return out;
}
function roadDist(x,y){
  var best=1e9;
  for(var i=0;i<SEG.length;i++){ var g=SEG[i], dx=g.b[0]-g.a[0], dy=g.b[1]-g.a[1], t=((x-g.a[0])*dx+(y-g.a[1])*dy)/(g.l*g.l);
    t=Math.max(0,Math.min(1,t)); var d=Math.hypot(x-(g.a[0]+dx*t),y-(g.a[1]+dy*t)); if(d<best) best=d; }
  return best;
}

/* ---------- small DOM helpers ---------- */
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
function btn(cls,label,aria){ var b=el("button",cls); b.type="button"; b.textContent=label; if(aria) b.setAttribute("aria-label",aria); return b; }

/* ---------- card chrome ---------- */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Pop 13")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Bugs float down the road toward prod. Place towers beside it, start the wave, and pop every layer before the bugs get through."); instr.id="b13-i"; mount.appendChild(instr);
var stage=el("div","wb-stage b13-stage"); stage.setAttribute("aria-describedby","b13-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Restart the game"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Tap a spot beside the road to place the armed tower, tap a tower to upgrade or sell it. Keys with the board focused: arrows move, 1 and 2 pick a tower, Enter places, U upgrades, X sells, G starts the wave, F changes speed, P pauses. Your best wave is kept on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var top=el("div","b13-top");
var cWave=txt("span","b13-chip",""), cCash=txt("span","b13-chip",""), cLives=txt("span","b13-chip b13-lives",""), cBest=txt("span","b13-chip","");
top.appendChild(cWave); top.appendChild(cCash); top.appendChild(cLives); top.appendChild(cBest); stage.appendChild(top);
var view=el("div","b13-view"); stage.appendChild(view);
var cv=el("canvas","b13-cv"); cv.tabIndex=0; cv.setAttribute("role","application");
cv.setAttribute("aria-label","Pop 13 board. Arrows move the cursor, 1 and 2 pick a tower, Enter places or selects, U upgrades, X sells, G starts the wave.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var over=el("div","b13-over"); over.hidden=true; view.appendChild(over);

var bar=el("div","b13-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Pop 13 controls"); stage.appendChild(bar);
var bDart=btn("b13-b b13-tw",""), bTack=btn("b13-b b13-tw","");
var bUp=btn("b13-b",""), bSell=btn("b13-b","");
var bPause=btn("b13-b","Pause","Pause the wave"), bSpeed=btn("b13-b","Speed 1x","Change speed, now 1x"), bGo=btn("b13-b b13-go","");
var grpA=el("div","b13-grp"), grpB=el("div","b13-grp b13-grp-r");
grpA.appendChild(bDart); grpA.appendChild(bTack); grpA.appendChild(bUp); grpA.appendChild(bSell);
grpB.appendChild(bPause); grpB.appendChild(bSpeed); grpB.appendChild(bGo);
bar.appendChild(grpA); bar.appendChild(grpB);

/* ---------- state ---------- */
var G=null, fx=[], pal=null, W=0, H=0, dprv=1, sc=1, ox=0, oy=0, vis=true;
var hover=null, kx=VW/2, ky=VH/2, kbd=false, bestWave=parseInt(store(KEY),10)||0, lastLeakSay=0;
function newGame(){
  return {wave:0,money:200,lives:20,towers:[],bloons:[],proj:[],queue:[],wt:0,running:false,paused:false,over:null,
    sel:-1,armed:"dart",speed:1,acc:0,leaks:0,reached:0};
}
G=newGame();

function tCost(t){ var s=TOWERS[t.k], c=s.cost, i; for(i=0;i<t.lv-1;i++) c+=s.up[i]; return c; }
function sellValue(t){ return Math.floor(tCost(t)*.7); }
function stat(t){ var s=TOWERS[t.k]; return {range:s.range[t.lv-1],cd:s.cd[t.lv-1]}; }

/* ---------- controls ---------- */
function hud(){
  cWave.textContent="Wave "+Math.max(G.wave,G.running?G.wave:G.wave)+" of "+NWAVES;
  cCash.textContent="Budget "+G.money;
  cLives.textContent="Leaks left "+G.lives;
  cBest.textContent="Best wave "+bestWave;
  bDart.textContent=TOWERS.dart.name+" "+TOWERS.dart.cost; bTack.textContent=TOWERS.tack.name+" "+TOWERS.tack.cost;
  bDart.setAttribute("aria-label","Arm the "+TOWERS.dart.name+" for "+TOWERS.dart.cost+". "+TOWERS.dart.blurb);
  bTack.setAttribute("aria-label","Arm the "+TOWERS.tack.name+" for "+TOWERS.tack.cost+". "+TOWERS.tack.blurb);
  bDart.setAttribute("aria-pressed",G.armed==="dart"?"true":"false"); bTack.setAttribute("aria-pressed",G.armed==="tack"?"true":"false");
  bDart.classList.toggle("poor",G.money<TOWERS.dart.cost); bTack.classList.toggle("poor",G.money<TOWERS.tack.cost);
  var t=G.sel>=0?G.towers[G.sel]:null;
  if(t){
    var s=TOWERS[t.k];
    bUp.disabled=t.lv>=3||G.over!==null; bUp.textContent=t.lv>=3?"Maxed":"Upgrade "+s.up[t.lv-1];
    bUp.setAttribute("aria-label",t.lv>=3?"This tower is at its top level":"Upgrade the "+s.name+" for "+s.up[t.lv-1]);
    bSell.disabled=G.over!==null; bSell.textContent="Sell "+sellValue(t); bSell.setAttribute("aria-label","Sell the "+s.name+" for "+sellValue(t));
    bUp.classList.toggle("poor",t.lv<3&&G.money<s.up[t.lv-1]);
  } else {
    bUp.disabled=true; bSell.disabled=true; bUp.textContent="Upgrade"; bSell.textContent="Sell";
    bUp.setAttribute("aria-label","Upgrade (select a tower first)"); bSell.setAttribute("aria-label","Sell (select a tower first)"); bUp.classList.remove("poor");
  }
  bPause.disabled=!(G.running||G.paused)||G.over!==null; bPause.textContent=G.paused?"Resume":"Pause"; bPause.setAttribute("aria-label",G.paused?"Resume the wave":"Pause the wave");
  bSpeed.textContent="Speed "+G.speed+"x"; bSpeed.setAttribute("aria-label","Change speed, now "+G.speed+"x");
  var next=Math.min(G.wave+1,NWAVES);
  bGo.disabled=G.running||G.over!==null; bGo.textContent=G.running?"Wave "+G.wave+" running":"Start wave "+next;
  bGo.setAttribute("aria-label",G.running?"Wave "+G.wave+" is running":"Start wave "+next);
}
function arm(k){
  if(G.over) return;
  G.armed=G.armed===k?null:k; G.sel=-1; hud(); wake();
  if(G.armed){ var s=TOWERS[k]; say(s.name+" armed, "+s.cost+". "+s.blurb+" "+(G.money<s.cost?"Budget is short by "+(s.cost-G.money)+".":"Tap beside the road to place it.")); }
  else say("Nothing armed. Tap a tower to upgrade or sell it.");
}
function canPlace(x,y,k){
  if(x<12||x>VW-12||y<12||y>VH-12) return "Keep it on the board.";
  if(roadDist(x,y)<LANE-1) return "Too close to the road. Towers sit beside it.";
  for(var i=0;i<G.towers.length;i++) if(Math.hypot(G.towers[i].x-x,G.towers[i].y-y)<25) return "Too close to another tower.";
  if(G.money<TOWERS[k].cost) return "Budget is short by "+(TOWERS[k].cost-G.money)+".";
  return "";
}
function place(x,y){
  if(!G.armed||G.over) return;
  var why=canPlace(x,y,G.armed); if(why){ say(why); return; }
  var s=TOWERS[G.armed];
  G.towers.push({k:G.armed,x:x,y:y,lv:1,cd:.2,ang:-Math.PI/2,flash:0});
  G.money-=s.cost; G.sel=-1; if(G.money<s.cost) G.armed=null; hud();
  if(!calm()) fx.push({k:"ring",x:x,y:y,r:4,mr:26,t:0,life:.35,c:"o"});
  say(s.name+" placed. "+(G.running?"It fires by itself.":"Start wave "+Math.min(G.wave+1,NWAVES)+" when you are ready.")+(G.armed?" Still armed: tap again for another, or tap a tower to upgrade it.":" Tap a tower to upgrade or sell it."));
  wake();
}
function select(i){
  G.sel=i; G.armed=null; hud();
  if(i>=0){ var t=G.towers[i], s=TOWERS[t.k]; say(s.name+", level "+t.lv+" of 3. "+(t.lv<3?"Upgrade "+s.up[t.lv-1]+" or sell "+sellValue(t)+".":"Top level. Sell "+sellValue(t)+" if you need the budget.")); }
  wake();
}
function upgrade(){
  var t=G.sel>=0?G.towers[G.sel]:null; if(!t||G.over) return;
  if(t.lv>=3){ say("Already at the top level."); return; }
  var s=TOWERS[t.k], c=s.up[t.lv-1];
  if(G.money<c){ say("Budget is short by "+(c-G.money)+"."); return; }
  G.money-=c; t.lv++; hud();
  if(!calm()) fx.push({k:"ring",x:t.x,y:t.y,r:6,mr:stat(t).range,t:0,life:.45,c:"o"});
  say(s.name+" is level "+t.lv+". Range and fire rate went up."+(t.lv<3?" One more upgrade is open.":"")); wake();
}
function sell(){
  var t=G.sel>=0?G.towers[G.sel]:null; if(!t||G.over) return;
  var v=sellValue(t); G.money+=v; G.towers.splice(G.sel,1); G.sel=-1; hud(); say("Sold for "+v+". Pick a tower and place it somewhere better."); wake();
}
function startWave(){
  if(G.running||G.over||G.wave>=NWAVES) return;
  G.wave++; G.reached=G.wave; if(G.wave>bestWave){ bestWave=G.wave; store(KEY,String(bestWave)); }
  G.queue=[]; var t=.5, gi, n, g;
  for(gi=0;gi<WAVES[G.wave-1].length;gi++){ g=WAVES[G.wave-1][gi]; for(n=0;n<g[1];n++){ G.queue.push({at:t,l:g[0]}); t+=g[2]; } t+=1; }
  G.wt=0; G.running=true; G.paused=false; G.acc=0; hud();
  say("Wave "+G.wave+" of "+NWAVES+" is on its way."+(G.wave===NWAVES?" Scope creep is in this one.":"")); focusBoard(); wake();
}
function cycleSpeed(){ G.speed=G.speed%3+1; hud(); }
function pause(why){
  if(!G.running||G.paused||G.over) return;
  G.paused=true; hud(); showPause(why||"Paused. Nothing moves until you resume."); say(why||"Paused."); wake();
}
function resume(){
  if(!G.paused) return;
  G.paused=false; over.hidden=true; hud(); say("Back on. Wave "+G.wave+" is running."); focusBoard(); wake();
}
function restart(){
  G=newGame(); fx.length=0; over.hidden=true; hover=null; hud();
  say("Fresh board, 200 budget. A Linter is armed: tap beside the road to place it, then start wave 1."); focusBoard(); wake();
}
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }

/* ---------- the panel (paused, lost, shipped) ---------- */
function panel(title,sub,buttons){
  over.innerHTML=""; var p=el("div","b13-panel"); p.setAttribute("role","dialog"); p.setAttribute("aria-label",title);
  p.appendChild(txt("div","b13-over-t",title)); p.appendChild(txt("div","b13-over-s",sub));
  var row=el("div","b13-over-row"), first=null;
  buttons.forEach(function(d){ var b=btn("b13-obtn"+(d.ghost?" ghost":""),d.label); b.addEventListener("click",d.fn); row.appendChild(b); if(!first) first=b; });
  p.appendChild(row); over.appendChild(p); over.hidden=false;
  setTimeout(function(){ try{ first.focus({preventScroll:true}); }catch(x){} },30);
}
function showPause(why){ panel("Paused",why,[{label:"Resume",fn:resume},{label:"Restart",ghost:true,fn:restart}]); }
function finish(kind){
  G.over=kind; G.running=false; hud();
  if(kind==="lose"){
    say("Prod is down at wave "+G.reached+". Best wave "+bestWave+". Try again with a different spread of towers.");
    panel("Prod is down","The bugs got through on wave "+G.reached+" of "+NWAVES+". Best wave so far: "+bestWave+".",[{label:"Try again",fn:restart}]);
  } else {
    say("All "+NWAVES+" waves shipped with "+G.leaks+" leak"+(G.leaks===1?"":"s")+". Play again for a cleaner run.");
    panel("Shipped","All "+NWAVES+" waves held. "+G.leaks+" bug"+(G.leaks===1?"":"s")+" got through.",[{label:"Play again",fn:restart}]);
  }
}

/* ---------- simulation ---------- */
var tmp={x:0,y:0};
function burst(x,y,c,n){
  if(calm()) return;
  for(var i=0;i<n;i++){ var a=Math.random()*TAU, v=40+Math.random()*70; fx.push({k:"dot",x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0,life:.35+Math.random()*.2,c:c}); }
}
function pop(b){
  var old=b.l; b.l--; G.money+=1;
  burst(b.x,b.y,old,old===5?7:5);
  if(b.l<=0) b.dead=true;
}
function step(dt){
  var i, j, b, t, p;
  G.wt+=dt;
  while(G.queue.length&&G.queue[0].at<=G.wt){ var q=G.queue.shift(); G.bloons.push({d:0,l:q.l,x:PATH[0][0],y:PATH[0][1],dead:false});
    if(q.l===5) say("Scope creep just walked in. It has five layers."); }
  for(i=0;i<G.bloons.length;i++){
    b=G.bloons[i]; b.d+=SPD[b.l]*dt; at(b.d,tmp); b.x=tmp.x; b.y=tmp.y;
    if(b.d>=TOTAL){
      b.dead=true; G.lives-=b.l; G.leaks++;
      if(!calm()) fx.push({k:"ring",x:PATH[PATH.length-1][0]+22,y:PATH[PATH.length-1][1],r:4,mr:30,t:0,life:.5,c:"o"});
      cLives.classList.remove("hit"); void cLives.offsetWidth; if(!calm()) cLives.classList.add("hit");
      if(G.lives>0&&G.wt-lastLeakSay>1.5){ lastLeakSay=G.wt; say("A bug reached prod. "+G.lives+" leak"+(G.lives===1?"":"s")+" left."); }
    }
  }
  for(i=0;i<G.towers.length;i++){
    t=G.towers[i]; t.cd-=dt; if(t.flash>0) t.flash-=dt;
    if(t.cd>0) continue;
    var st=stat(t), best=null, bd=-1;
    for(j=0;j<G.bloons.length;j++){ b=G.bloons[j]; if(b.dead) continue;
      if(Math.hypot(b.x-t.x,b.y-t.y)<=st.range+BR[b.l]&&b.d>bd){ bd=b.d; best=b; } }
    if(!best) continue;
    t.ang=Math.atan2(best.y-t.y,best.x-t.x); t.cd=st.cd; t.flash=.08;
    if(t.k==="dart") G.proj.push({k:0,x:t.x,y:t.y,tg:best,life:1.2});
    else { var n=t.lv>=3?12:8, a; for(a=0;a<n;a++){ var an=a/n*TAU+t.lv*.1; G.proj.push({k:1,x:t.x,y:t.y,vx:Math.cos(an)*320,vy:Math.sin(an)*320,life:(st.range+4)/320}); } }
  }
  for(i=0;i<G.proj.length;i++){
    p=G.proj[i]; p.life-=dt; if(p.life<=0){ p.dead=true; continue; }
    if(p.k===0){
      if(!p.tg||p.tg.dead){ var nb=null, nd=140; for(j=0;j<G.bloons.length;j++){ b=G.bloons[j]; if(b.dead) continue; var dd=Math.hypot(b.x-p.x,b.y-p.y); if(dd<nd){ nd=dd; nb=b; } }
        if(!nb){ p.dead=true; continue; } p.tg=nb; }
      var dx=p.tg.x-p.x, dy=p.tg.y-p.y, dl=Math.hypot(dx,dy)||1, mv=540*dt;
      if(dl<=mv+BR[p.tg.l]){ pop(p.tg); p.dead=true; continue; }
      p.x+=dx/dl*mv; p.y+=dy/dl*mv; p.a=Math.atan2(dy,dx);
    } else {
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.a=Math.atan2(p.vy,p.vx);
      for(j=0;j<G.bloons.length;j++){ b=G.bloons[j]; if(b.dead) continue; if(Math.hypot(b.x-p.x,b.y-p.y)<BR[b.l]+3){ pop(b); p.dead=true; break; } }
    }
  }
  G.bloons=G.bloons.filter(function(o){ return !o.dead; }); G.proj=G.proj.filter(function(o){ return !o.dead; });
  if(G.lives<=0){ G.lives=0; hud(); finish("lose"); return; }
  if(G.running&&!G.queue.length&&!G.bloons.length){
    G.running=false; var bonus=20+G.wave*5; G.money+=bonus;
    if(G.wave>=NWAVES){ hud(); finish("win"); return; }
    hud(); say("Wave "+G.wave+" cleared. +"+bonus+" budget. Spend it, then start wave "+(G.wave+1)+".");
    bGo.classList.remove("ready"); void bGo.offsetWidth; if(!calm()) bGo.classList.add("ready");
  }
  hudLight();
}
var hudTick=0;
function hudLight(){ cCash.textContent="Budget "+G.money; cLives.textContent="Leaks left "+G.lives; if(++hudTick%12===0) hud(); }

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement), dark=document.documentElement.getAttribute("data-theme")==="dark";
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  var orange=v("--blue","#B94612");
  return {bg:v("--paper-3","#F3F0E9"),road:v("--paper-2","#FFFFFF"),roadEdge:v("--line-2","rgba(31,32,35,.22)"),dot:v("--line","rgba(31,32,35,.12)"),
    ink:v("--ink","#1F2023"),muted:v("--muted","#5D5F65"),orange:orange,orange2:v("--blue-2","#EA5E14"),rim:v("--paper-2","#FFFFFF"),
    layer:[null,orange,dark?"#6C9BC4":"#4A7BA6",dark?"#4F9E92":"#3C8A7E",dark?"#E0B04A":"#C9962B",dark?"#C9CACF":"#1F2023"],dark:dark};
}
new MutationObserver(function(){ pal=null; wake(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function fit(){
  var r=view.getBoundingClientRect(); if(!r.width) return;
  dprv=Math.min(window.devicePixelRatio||1,2); W=r.width; H=r.height;
  cv.width=Math.round(W*dprv); cv.height=Math.round(H*dprv);
  sc=Math.min(W/VW,H/VH); ox=(W-VW*sc)/2; oy=(H-VH*sc)/2; draw();
}
function ell(x,y,rx,ry){ ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,TAU); }
function drawBloon(b,P){
  var r=BR[b.l], c=P.layer[b.l];
  ctx.strokeStyle=P.muted; ctx.lineWidth=1; ctx.globalAlpha=.55; ctx.beginPath(); ctx.moveTo(b.x,b.y+r); ctx.lineTo(b.x+2,b.y+r+6); ctx.globalAlpha=1; ctx.stroke();
  ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(b.x,b.y+r+1); ctx.lineTo(b.x-2.4,b.y+r+4); ctx.lineTo(b.x+2.4,b.y+r+4); ctx.closePath(); ctx.fill();
  ell(b.x,b.y,r*.88,r); ctx.fillStyle=c; ctx.fill(); ctx.strokeStyle=P.dark?"rgba(0,0,0,.5)":"rgba(31,32,35,.55)"; ctx.lineWidth=1.1; ctx.stroke();
  if(b.l>1){ ell(b.x,b.y+r*.08,r*.46,r*.52); ctx.fillStyle=P.layer[b.l-1]; ctx.fill(); }
  ell(b.x-r*.32,b.y-r*.36,r*.18,r*.3); ctx.fillStyle="rgba(255,255,255,.4)"; ctx.fill();
}
function drawTower(t,P,sel){
  var s=11;
  if(sel){ var st=stat(t); ctx.beginPath(); ctx.arc(t.x,t.y,st.range,0,TAU); ctx.fillStyle=P.dark?"rgba(255,255,255,.06)":"rgba(31,32,35,.05)"; ctx.fill(); ctx.strokeStyle=P.orange; ctx.lineWidth=1.4; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(t.x,t.y,s,0,TAU); ctx.fillStyle=P.ink; ctx.fill(); ctx.strokeStyle=P.rim; ctx.lineWidth=2; ctx.stroke();
  ctx.save(); ctx.translate(t.x,t.y);
  if(t.k==="dart"){ ctx.rotate(t.ang); ctx.fillStyle=t.flash>0?P.orange2:P.orange; ctx.fillRect(0,-2.4,s+4,4.8); ctx.beginPath(); ctx.arc(0,0,4.2,0,TAU); ctx.fillStyle=P.rim; ctx.fill(); }
  else { ctx.fillStyle=t.flash>0?P.orange2:P.orange; var k; for(k=0;k<4;k++){ ctx.rotate(Math.PI/4); ctx.fillRect(-1.8,-s+2,3.6,s*2-4); } ctx.beginPath(); ctx.arc(0,0,3.4,0,TAU); ctx.fillStyle=P.rim; ctx.fill(); }
  ctx.restore();
  for(var i=0;i<t.lv;i++){ ctx.beginPath(); ctx.arc(t.x+(i-(t.lv-1)/2)*5,t.y+s+5,1.7,0,TAU); ctx.fillStyle=P.orange; ctx.fill(); }
}
function draw(){
  if(!W) return;
  if(!pal) pal=palette();
  var P=pal, i, k, t;
  ctx.setTransform(dprv,0,0,dprv,0,0); ctx.clearRect(0,0,W,H); ctx.fillStyle=P.bg; ctx.fillRect(0,0,W,H);
  ctx.setTransform(dprv*sc,0,0,dprv*sc,ox*dprv,oy*dprv);
  ctx.fillStyle=P.dot; var x, y; for(x=20;x<VW;x+=40) for(y=20;y<VH;y+=40){ ctx.fillRect(x-.7,y-.7,1.4,1.4); }
  /* the road */
  ctx.lineJoin="round"; ctx.lineCap="butt"; ctx.beginPath(); ctx.moveTo(PATH[0][0],PATH[0][1]); for(i=1;i<PATH.length;i++) ctx.lineTo(PATH[i][0],PATH[i][1]);
  ctx.strokeStyle=P.roadEdge; ctx.lineWidth=LANE+3; ctx.stroke(); ctx.strokeStyle=P.road; ctx.lineWidth=LANE; ctx.stroke();
  ctx.fillStyle=P.muted; ctx.font="500 9px 'JetBrains Mono',monospace"; ctx.textBaseline="middle";
  ctx.textAlign="left"; ctx.fillText("BACKLOG",8,45-LANE/2-7); ctx.fillText("PROD",8,291+LANE/2+8);
  /* towers */
  for(i=0;i<G.towers.length;i++) drawTower(G.towers[i],P,i===G.sel);
  /* ghost */
  var gp=kbd?{x:kx,y:ky}:hover;
  if(gp&&G.armed&&!G.over){
    var why=canPlace(gp.x,gp.y,G.armed), ok=!why||why.indexOf("Budget")===0, rng=TOWERS[G.armed].range[0];
    ctx.globalAlpha=ok&&!why?1:.55; ctx.beginPath(); ctx.arc(gp.x,gp.y,rng,0,TAU); ctx.fillStyle=P.dark?"rgba(255,255,255,.06)":"rgba(31,32,35,.05)"; ctx.fill();
    ctx.setLineDash(why?[4,4]:[]); ctx.strokeStyle=why?P.muted:P.orange; ctx.lineWidth=1.4; ctx.stroke(); ctx.setLineDash([]);
    drawTower({k:G.armed,x:gp.x,y:gp.y,lv:1,ang:-Math.PI/2,flash:0},P,false); ctx.globalAlpha=1;
  } else if(kbd&&document.activeElement===cv&&!G.over){
    ctx.strokeStyle=P.orange; ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(kx,ky,8,0,TAU); ctx.moveTo(kx-12,ky); ctx.lineTo(kx+12,ky); ctx.moveTo(kx,ky-12); ctx.lineTo(kx,ky+12); ctx.stroke();
  }
  /* bugs, shots */
  for(i=0;i<G.bloons.length;i++) drawBloon(G.bloons[i],P);
  for(i=0;i<G.proj.length;i++){ var p=G.proj[i]; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a||0); ctx.fillStyle=P.ink; ctx.fillRect(-4,-1,8,2); ctx.fillStyle=P.orange2; ctx.fillRect(2,-1.4,2.6,2.8); ctx.restore(); }
  /* effects */
  for(i=0;i<fx.length;i++){ var f=fx[i], u=f.t/f.life;
    if(f.k==="dot"){ ctx.globalAlpha=1-u; ctx.fillStyle=typeof f.c==="number"?P.layer[f.c]:P.orange; ctx.beginPath(); ctx.arc(f.x,f.y,2.2*(1-u*.5),0,TAU); ctx.fill(); ctx.globalAlpha=1; }
    else { ctx.globalAlpha=(1-u)*.8; ctx.strokeStyle=P.orange; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(f.x,f.y,f.r+(f.mr-f.r)*u,0,TAU); ctx.stroke(); ctx.globalAlpha=1; }
  }
  /* idle hint: a quiet pulse on the board when nothing is placed yet */
  if(!G.towers.length&&!G.running&&!G.over&&G.armed){ ctx.fillStyle=P.muted; ctx.font="500 11px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.fillText("TAP BESIDE THE ROAD TO PLACE A "+TOWERS[G.armed].name.toUpperCase(),VW/2,VH-14); }
}

/* ---------- loop ---------- */
var raf=0, last=0;
function wake(){ if(!raf){ last=0; raf=requestAnimationFrame(frame); } }
function frame(ts){
  raf=0;
  if(!vis||document.hidden){ draw(); return; }
  var dt=last?Math.min(.1,(ts-last)/1000):0; last=ts;
  if(G.running&&!G.paused){ G.acc+=dt*G.speed; var n=0; while(G.acc>=STEP&&n<24){ step(STEP); G.acc-=STEP; n++; if(!G.running) break; } if(G.acc>STEP) G.acc=0; }
  for(var i=fx.length-1;i>=0;i--){ var f=fx[i]; f.t+=dt; if(f.k==="dot"){ f.x+=f.vx*dt; f.y+=f.vy*dt; } if(f.t>=f.life) fx.splice(i,1); }
  draw();
  if((G.running&&!G.paused)||fx.length) raf=requestAnimationFrame(frame); else last=0;
}

/* ---------- input ---------- */
function toBoard(e){ var r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left-ox)/sc,y:(e.clientY-r.top-oy)/sc}; }
function towerAt(x,y){ var best=-1, bd=19, i; for(i=0;i<G.towers.length;i++){ var d=Math.hypot(G.towers[i].x-x,G.towers[i].y-y); if(d<bd){ bd=d; best=i; } } return best; }
function act(x,y){
  if(G.over||G.paused) return;
  var i=towerAt(x,y);
  if(i>=0){ select(i); return; }
  if(G.armed) place(x,y); else if(G.sel>=0){ select(-1); say("Nothing selected. Pick a tower to place."); }
}
cv.addEventListener("pointermove",function(e){ if(e.pointerType==="touch") return; kbd=false; hover=toBoard(e); wake(); });
cv.addEventListener("pointerleave",function(){ hover=null; wake(); });
cv.addEventListener("pointerdown",function(e){
  if(e.button>0) return; e.preventDefault(); focusBoard(); kbd=false;
  var p=toBoard(e); hover=e.pointerType==="touch"?null:p; act(p.x,p.y);
});
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var k=e.key, stp=e.shiftKey?40:14, used=true;
  if(k==="ArrowLeft") kx=Math.max(0,kx-stp); else if(k==="ArrowRight") kx=Math.min(VW,kx+stp);
  else if(k==="ArrowUp") ky=Math.max(0,ky-stp); else if(k==="ArrowDown") ky=Math.min(VH,ky+stp);
  else if(k==="1") arm("dart"); else if(k==="2") arm("tack");
  else if(k==="Enter"||k===" "){ if(!G.over&&!G.paused) act(kx,ky); }
  else if(k==="u"||k==="U") upgrade(); else if(k==="x"||k==="X"||k==="Delete"||k==="Backspace") sell();
  else if(k==="g"||k==="G") startWave(); else if(k==="f"||k==="F") cycleSpeed();
  else if(k==="p"||k==="P"||k==="Escape"){ if(G.paused) resume(); else pause(); }
  else used=false;
  if(!used) return;
  e.preventDefault(); if(k.indexOf("Arrow")===0){ kbd=true; hover=null; wake(); }
});
var inside=false;
mount.addEventListener("pointerdown",function(){ inside=true; setTimeout(function(){ inside=false; },400); },true);
mount.addEventListener("focusout",function(e){
  if(inside) return;
  var to=e.relatedTarget; if(to&&mount.contains(to)) return;
  if(G.running&&!G.paused) pause("You looked away, so the wave stopped.");
});
bDart.addEventListener("click",function(){ arm("dart"); });
bTack.addEventListener("click",function(){ arm("tack"); });
bUp.addEventListener("click",upgrade); bSell.addEventListener("click",sell);
bPause.addEventListener("click",function(){ if(G.paused) resume(); else pause(); });
bSpeed.addEventListener("click",cycleSpeed); bGo.addEventListener("click",startWave); reset.addEventListener("click",restart);

/* ---------- visibility, resize ---------- */
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else if(G.running&&!G.paused) pause("The board left the screen, so the wave stopped."); },{threshold:.15}).observe(view);
document.addEventListener("visibilitychange",function(){ if(document.hidden&&G.running&&!G.paused) pause("The tab was hidden, so the wave stopped."); });
var rz=0; window.addEventListener("resize",function(){ cancelAnimationFrame(rz); rz=requestAnimationFrame(fit); });
if(window.ResizeObserver) new ResizeObserver(function(){ fit(); }).observe(view);
if(mq.addEventListener) mq.addEventListener("change",function(){ fx.length=0; wake(); });

/* ---------- boot ---------- */
hud();
say("200 budget and a Linter armed. Tap beside the road to place it, then start wave 1.");
fit(); wake();
})();
