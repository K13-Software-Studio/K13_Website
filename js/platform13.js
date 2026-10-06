/* K13 Ship Run: a side-scrolling platformer on the workbench, built on the workbench card anatomy.
   You are a small orange 13 block with legs. Run, jump, stomp bugs, hit the 13 blocks from below for coins, mind the pits,
   reach the Ship it flag. Two short levels, drawn from tile maps. Best time and coins per level are kept on this device.
   Feel: variable jump height (hold to go higher, let go to cut it short), coyote time (0.10 s after leaving a ledge) and
   jump buffering (0.12 s before landing), a small corner nudge when your head clips a block edge, a stomp that bounces.
   The loop is a fixed 120 Hz step behind an accumulator; the canvas is 320 by 176 logical pixels drawn at a whole-number
   scale of the device pixels, so the pixel art stays crisp. The clock stops when the board loses focus, leaves the screen
   or the tab is hidden.
   prefers-reduced-motion: no block bumps, coin pop-ups, puffs, death hop, flag slide or panel rise, and the camera cuts
   instead of gliding. The game itself still plays.
   Keyboard (board focused): arrows or A/D move, Space, Up or W jump, Esc pauses, R restarts the level.
   Touch: Left, Right and Jump buttons under the board; they work together, so you can run and jump at once.
   The core (maps, physics, rules) sits between the CORE markers and touches no DOM, so Node can prove each level is beatable. */
(function(){
"use strict";

/* ===================================================== CORE-BEGIN ===================================================== */
var T=16, VW=320, VH=176, ROWS=11, DT=1/120, TAU=Math.PI*2;
var RUN=104, ACC_G=820, ACC_A=560, FRIC=900, TURN=2.2;
var V0=385, G_HOLD=1050, G_REL=3300, G_FALL=1750, MAXF=520, COY=.1, BUF=.12;
var P_HW=5, P_H=14, BOUNCE=250, BOUNCE_H=340, WALK=28, SLIDE=190, KICK_GRACE=.25;
var SOLID={"#":1,"B":1,"?":1,"U":1,"T":1};

function build(def){
  var w=def.w, g=[], r, c, ents=[], start={c:2,r:8}, coins=0;
  for(r=0;r<ROWS;r++){ g.push([]); for(c=0;c<w;c++) g[r].push(r>=9?"#":"."); }
  (def.pits||[]).forEach(function(p){ for(c=p[0];c<p[0]+p[1];c++){ g[9][c]="."; g[10][c]="."; } });
  def.items.forEach(function(it){
    var ch=it[0], c0=it[1], r0=it[2], n=it[3]||1, vert=it[4]==="v", i;
    for(i=0;i<n;i++){
      var cc=vert?c0:c0+i, rr=vert?r0+i:r0;
      if(ch==="P") start={c:cc,r:rr};
      else if(ch==="e"||ch==="s") ents.push({k:ch,c:cc,r:rr});
      else g[rr][cc]=ch;
    }
  });
  for(r=0;r<ROWS;r++) for(c=0;c<w;c++){ if(g[r][c]==="o"||g[r][c]==="?") coins++; }
  return {w:w,g:g,ents:ents,start:start,coins:coins};
}
var LEVELS=[
  {name:"Warm up",tip:"Run right, jump on bugs, bump the blocks from below. The flag is at the end.",w:84,pits:[[28,2],[52,3]],items:[
    ["P",2,8],["o",8,7,3],["B",11,6],["?",12,6],["B",13,6],["e",21,8],
    ["T",22,7,2,"v"],["T",23,7,2,"v"],["e",26,8],["o",28,6,2],
    ["B",33,6],["?",34,6],["B",35,6],["?",36,6],["B",37,6],["o",33,4,5],
    ["e",40,8],["e",43,8],["s",46,8],["o",52,6,3],["?",57,6],["e",60,8],
    ["#",62,8],["#",63,7,2,"v"],["#",64,6,3,"v"],["#",65,5,4,"v"],["o",69,7,3],["F",76,2,7,"v"]]},
  {name:"Crunch time",tip:"More pits, more bugs, one shell. Stomp a shell and it stops; touch it and it flies.",w:96,pits:[[22,3],[38,4],[58,5],[74,2]],items:[
    ["P",2,8],["o",7,8,3],["e",12,8],["e",15,8],["B",17,6],["?",18,6],["B",19,6],["?",18,3],
    ["o",22,6,3],["e",28,8],["e",30,8],["s",33,8],["o",38,6,4],
    ["T",45,6,3,"v"],["T",46,6,3,"v"],["e",49,8],["T",51,7,2,"v"],["T",52,7,2,"v"],["s",55,8],["?",56,5],
    ["#",60,8],["o",58,5,5],["B",65,5],["?",66,5],["B",67,5],["e",66,8],["e",69,8],["e",71,8],
    ["#",80,8],["#",81,7,2,"v"],["#",82,6,3,"v"],["#",83,5,4,"v"],["#",84,4,5,"v"],["o",86,6,3],["F",90,2,7,"v"]]}
];
LEVELS.forEach(function(L){ var b=build(L); L.w=b.w; L.proto=b; });

function newGame(li,deaths){
  var P=LEVELS[li].proto, g=P.g.map(function(row){ return row.slice(); }), st=P.start;
  return {li:li,w:P.w,g:g,total:P.coins,coins:0,deaths:deaths||0,tm:0,cam:0,
    p:{x:st.c*T+T/2,y:(st.r+1)*T,vx:0,vy:0,hw:P_HW,h:P_H,face:1,ground:false,coy:0,buf:0,run:0,dead:false},
    en:P.ents.map(function(e){ var s=e.k==="s";
      return {k:e.k,x:e.c*T+T/2,y:(e.r+1)*T,vx:0,vy:0,hw:7,h:12,dir:-1,st:"walk",t:0,act:0,gone:0,grace:0,run:0,s:s}; }),
    bump:{},pops:[],puffs:[],won:false,slide:0,dyingT:0,why:""};
}
function tileAt(G,c,r){ if(c<0||c>=G.w) return "#"; if(r<0||r>=ROWS) return "."; return G.g[r][c]; }
function solid(G,c,r){ return SOLID[tileAt(G,c,r)]===1; }

/* horizontal move; returns true when a wall stopped it */
function moveX(G,e,dt){
  e.x+=e.vx*dt;
  var t=e.y-e.h, b=e.y-.01, r0=Math.floor(t/T), r1=Math.floor(b/T), r, c;
  if(e.vx>0){ c=Math.floor((e.x+e.hw)/T); for(r=r0;r<=r1;r++) if(solid(G,c,r)){ e.x=c*T-e.hw-.001; e.vx=0; return true; } }
  else if(e.vx<0){ c=Math.floor((e.x-e.hw)/T); for(r=r0;r<=r1;r++) if(solid(G,c,r)){ e.x=(c+1)*T+e.hw+.001; e.vx=0; return true; } }
  return false;
}
/* vertical move; returns 1 on landing, 2 on a head hit (bump callback for the player), 0 otherwise */
function moveY(G,e,dt,bump){
  e.y+=e.vy*dt;
  var l=e.x-e.hw, rr=e.x+e.hw-.01, c0=Math.floor(l/T), c1=Math.floor(rr/T), c, r;
  if(e.vy>0){
    r=Math.floor(e.y/T);
    for(c=c0;c<=c1;c++) if(solid(G,c,r)&&e.y-e.vy*dt<=r*T+.5){ e.y=r*T; e.vy=0; return 1; }
  } else if(e.vy<0){
    r=Math.floor((e.y-e.h)/T);
    var s0=solid(G,c0,r), s1=c1!==c0&&solid(G,c1,r);
    if(s0||s1){
      if(bump&&c0!==c1){
        if(s0&&!s1&&(c0+1)*T-l<=5){ e.x+=(c0+1)*T-l+.01; return 0; }
        if(s1&&!s0&&rr-c1*T<=5){ e.x-=rr-c1*T+.01; return 0; }
      }
      e.y=(r+1)*T+e.h; e.vy=0;
      if(bump){ var hc=s0&&s1?Math.floor(e.x/T):(s0?c0:c1); bump(hc,r); }
      return 2;
    }
  }
  return 0;
}
function overlap(a,b){ return Math.abs(a.x-b.x)<a.hw+b.hw&&a.y>b.y-b.h&&a.y-a.h<b.y; }

function popCoin(G,c,r,ev){ G.coins++; G.pops.push({x:c*T+T/2,y:r*T,t:0}); ev.push("coin"); }
function bumpTile(G,c,r,ev){
  var ch=tileAt(G,c,r);
  if(ch!=="?"&&ch!=="B") return;
  G.bump[c+","+r]=0;
  if(ch==="?"){ G.g[r][c]="U"; popCoin(G,c,r,ev); ev.push("block"); } else ev.push("thud");
  G.en.forEach(function(e){ if(e.st!=="dead"&&e.st!=="squash"&&Math.abs(e.y-r*T)<3&&Math.abs(e.x-(c*T+T/2))<T){ kill(G,e,ev); } });
}
function kill(G,e,ev){ e.st="dead"; e.t=.5; e.vy=-170; e.vx=e.dir*50; ev.push("kill"); }
function die(G,why,ev){
  if(G.p.dead||G.won) return;
  G.p.dead=true; G.why=why; G.deaths++; G.dyingT=why==="pit"?.7:1; G.p.vx=0; G.p.vy=-290; ev.push("die");
}
function stomp(G,p,e,ev){ p.vy=-(G.jh?BOUNCE_H:BOUNCE); p.ground=false; p.coy=0;
  if(e.k==="b"||e.k==="e"){ e.st="squash"; e.t=.35; ev.push("stomp"); }
  else if(e.st==="walk"||e.st==="slide"){ e.st="shell"; e.vx=0; e.hw=6; e.h=9; ev.push("shell"); }
  else { e.st="slide"; e.dir=p.x<e.x?1:-1; e.grace=KICK_GRACE; ev.push("kick"); } }

/* inp: {l,r,j (held), jp (pressed this step)}. Events land in ev */
function tick(G,inp,dt,ev,calm){
  var p=G.p, i, e, c, r;
  G.cam+=0;
  if(p.dead){
    G.dyingT-=dt;
    if(!(calm&&G.why!=="pit")){ p.vy+=1500*dt; p.y+=p.vy*dt; }
    if(G.dyingT<=0) ev.push("respawn");
    return;
  }
  if(G.slide>0){ G.slide-=dt; p.vy=0; p.y=Math.min(p.y+90*dt,9*T); if(G.slide<=0){ G.won=true; ev.push("win"); } return; }
  G.tm+=dt; G.jh=inp.j;
  var ax=(inp.r?1:0)-(inp.l?1:0), acc=p.ground?ACC_G:ACC_A;
  if(ax){ var turn=(ax>0&&p.vx<0)||(ax<0&&p.vx>0); p.vx+=ax*acc*(turn?TURN:1)*dt; if(Math.abs(p.vx)>RUN) p.vx=ax*RUN; p.face=ax; }
  else if(p.vx){ var f=FRIC*dt; p.vx=Math.abs(p.vx)<=f?0:p.vx-(p.vx>0?f:-f); }
  /* coyote + buffer */
  p.coy=p.ground?COY:Math.max(0,p.coy-dt);
  p.buf=inp.jp?BUF:Math.max(0,p.buf-dt);
  if(p.buf>0&&p.coy>0){ p.vy=-V0; p.buf=0; p.coy=0; p.ground=false; ev.push("jump"); }
  var g=p.vy<0?(inp.j?G_HOLD:G_REL):G_FALL;
  p.vy=Math.min(MAXF,p.vy+g*dt);
  moveX(G,p,dt);
  var res=moveY(G,p,dt,function(c2,r2){ bumpTile(G,c2,r2,ev); });
  p.ground=res===1;
  if(p.ground) p.run+=Math.abs(p.vx)*dt; else p.run=0;
  /* coins on the map */
  var r0=Math.floor((p.y-p.h)/T), r1=Math.floor((p.y-.01)/T), c0=Math.floor((p.x-p.hw)/T), c1=Math.floor((p.x+p.hw)/T);
  for(r=r0;r<=r1;r++) for(c=c0;c<=c1;c++){
    var ch=tileAt(G,c,r);
    if(ch==="o"){ G.g[r][c]="."; G.coins++; ev.push("coin"); }
    else if(ch==="F"){ p.x=c*T+T/2-3; p.vx=0; ev.push("flag"); if(calm){ p.y=9*T; G.won=true; ev.push("win"); } else G.slide=.65; return; }
  }
  /* enemies */
  for(i=0;i<G.en.length;i++){ e=G.en[i]; enemy(G,e,dt,ev);
    if(e.gone||e.st==="dead"||e.st==="squash") continue;
    if(!overlap(p,e)) continue;
    var top=p.vy>0&&p.y-e.y+e.h<=9;
    if(e.st==="shell"){ if(top) stomp(G,p,e,ev); else { e.st="slide"; e.dir=p.x<e.x?1:-1; e.grace=KICK_GRACE; ev.push("kick"); } }
    else if(top) stomp(G,p,e,ev);
    else if(e.st==="slide"&&e.grace>0){ /* the kick that just happened */ }
    else { die(G,"bug",ev); return; }
  }
  G.en=G.en.filter(function(x){ return !x.gone; });
  for(var k in G.bump){ G.bump[k]+=dt; if(G.bump[k]>.15) delete G.bump[k]; }
  for(i=G.pops.length-1;i>=0;i--){ G.pops[i].t+=dt; if(G.pops[i].t>.5) G.pops.splice(i,1); }
  for(i=G.puffs.length-1;i>=0;i--){ G.puffs[i].t+=dt; if(G.puffs[i].t>.35) G.puffs.splice(i,1); }
  if(p.y>ROWS*T+24) die(G,"pit",ev);
}
function enemy(G,e,dt,ev){
  if(e.st==="dead"){ e.t-=dt; e.vy+=1500*dt; e.y+=e.vy*dt; e.x+=e.vx*dt; if(e.t<=0) e.gone=1; return; }
  if(e.st==="squash"){ e.t-=dt; if(e.t<=0) e.gone=1; return; }
  if(!e.act){ if(e.x<G.cam+VW+24) e.act=1; else return; }
  e.vy=Math.min(MAXF,e.vy+G_FALL*dt);
  e.vx=e.st==="walk"?e.dir*WALK:(e.st==="slide"?e.dir*SLIDE:0);
  if(moveX(G,e,dt)) e.dir=-e.dir;
  moveY(G,e,dt,null);
  if(e.grace>0) e.grace-=dt;
  if(e.y>ROWS*T+40) e.gone=1;
  if(e.st==="slide"){ for(var i=0;i<G.en.length;i++){ var o=G.en[i]; if(o!==e&&o.st!=="dead"&&o.st!=="squash"&&overlap(e,o)) kill(G,o,ev); } }
}
var CORE={LEVELS:LEVELS,newGame:newGame,tick:tick,T:T,VW:VW,VH:VH,DT:DT,tileAt:tileAt,solid:solid};
/* ====================================================== CORE-END ====================================================== */
if(typeof document==="undefined"){ if(typeof module!=="undefined") module.exports=CORE; return; }

var mount=document.querySelector('[data-game="platform13"]');
if(!mount) return;
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
var N=LEVELS.length;

/* card chrome: the same DOM and classes as card() in workbench.js */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Ship Run")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Run, jump, stomp the bugs, hit the 13 blocks from below. Reach the flag with your coins. Pits do not forgive."); instr.id="p13-i"; mount.appendChild(instr);
var stage=el("div","wb-stage p13-stage"); stage.setAttribute("aria-describedby","p13-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Restart this level"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Arrows or A and D run, Space, Up or W jump (hold for height), Esc pauses, R restarts. On a phone use the three buttons under the board. Best times are kept on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var top=el("div","p13-top");
var hLevel=txt("span","p13-chip",""), hCoins=txt("span","p13-chip",""), hTime=txt("span","p13-chip",""), hDeaths=txt("span","p13-chip p13-deaths",""), hBest=txt("span","p13-chip","");
top.appendChild(hLevel); top.appendChild(hCoins); top.appendChild(hTime); top.appendChild(hBest); top.appendChild(hDeaths); stage.appendChild(top);
var view=el("div","p13-view"); stage.appendChild(view);
var cv=el("canvas","p13-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Ship Run game board. Arrow keys or A and D run, Space jumps, Escape pauses.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var over=el("div","p13-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Level"); view.appendChild(over);

/* control bar, below the board: nothing ever sits over it */
var bar=el("div","p13-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Controls"); stage.appendChild(bar);
var ARW={left:'<path d="M15 5l-7 7 7 7"/>',right:'<path d="M9 5l7 7-7 7"/>',up:'<path d="M5 15l7-7 7 7"/>'};
function ctl(name,label,aria){
  var b=el("button","p13-btn p13-"+name,'<svg viewBox="0 0 24 24" aria-hidden="true">'+ARW[name==="jump"?"up":name]+'</svg><span>'+label+'</span>');
  b.type="button"; b.setAttribute("aria-label",aria); return b;
}
var bL=ctl("left","Left","Run left"), bR=ctl("right","Right","Run right"), bJ=ctl("jump","Jump","Jump, hold to jump higher");
var pad=el("div","p13-pad"); pad.appendChild(bL); pad.appendChild(bR); bar.appendChild(pad); bar.appendChild(bJ);
var lvRow=el("div","p13-lvrow"); lvRow.setAttribute("role","group"); lvRow.setAttribute("aria-label","Levels"); stage.appendChild(lvRow);
lvRow.appendChild(txt("span","p13-lab","Level"));
var lvBtns=LEVELS.map(function(lv,i){
  var b=txt("button","p13-lv",String(i+1)); b.type="button";
  b.addEventListener("click",function(){ loadLevel(i,true); });
  lvRow.appendChild(b); return b;
});
var bP=txt("button","p13-lv p13-pause","Pause"); bP.type="button"; bP.setAttribute("aria-label","Pause the game"); lvRow.appendChild(bP);

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store("k13_platform13")||"null"); if(s&&s.t&&s.t.length===N&&s.c&&s.c.length===N) return s; }catch(e){} return {t:LEVELS.map(function(){ return -1; }),c:LEVELS.map(function(){ return -1; })}; })();
function persist(){ store("k13_platform13",JSON.stringify(save)); }
var G=null, li=0, mode="ready", kb={l:0,r:0,j:0}, bt={l:0,r:0,j:0}, pulse={l:0,r:0,j:0}, jp=0;
var W=0, H=0, kscale=1, vis=false, raf=0, acc=0, last=0, pal=null, sig="", camSet=false;

function fmt(t){ var m=Math.floor(t/60), s=t-m*60; return m+":"+(s<10?"0":"")+s.toFixed(1); }
function refreshLevels(){
  lvBtns.forEach(function(b,i){
    var s=save.t[i];
    b.classList.toggle("done",s>=0); b.setAttribute("aria-pressed",String(i===li));
    b.setAttribute("aria-label","Level "+(i+1)+", "+LEVELS[i].name+(s>=0?", best "+fmt(s)+" with "+save.c[i]+" coins":", not cleared yet"));
  });
}
function hud(){
  if(!G) return;
  var s=[li,G.coins,Math.floor(G.tm*10),G.deaths].join("|"); if(s===sig) return; sig=s;
  hLevel.textContent=(li+1)+"/"+N+" "+LEVELS[li].name;
  hCoins.textContent="Coins "+G.coins+"/"+G.total;
  hTime.textContent="Time "+fmt(G.tm);
  hDeaths.textContent="Falls "+G.deaths;
  hBest.hidden=save.t[li]<0; hBest.textContent=save.t[li]>=0?"Best "+fmt(save.t[li])+" / "+save.c[li]+" coins":"";
}
function panel(title,sub,buttons){
  over.innerHTML=""; var p=el("div","p13-panel");
  p.appendChild(txt("div","p13-over-t",title)); if(sub) p.appendChild(txt("p","p13-over-s",sub));
  var row=el("div","p13-over-row");
  buttons.forEach(function(b){ var x=txt("button","p13-obtn"+(b.ghost?" ghost":""),b.label); x.type="button"; x.addEventListener("click",b.go); row.appendChild(x); });
  p.appendChild(row); over.appendChild(p); over.hidden=false;
  return row.firstChild;
}
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function loadLevel(i,focus){
  li=i; G=CORE.newGame(i,0); mode="ready"; camSet=false; sig=""; acc=0; jp=0; kb={l:0,r:0,j:0}; pulse={l:0,r:0,j:0};
  panel("Level "+(i+1)+": "+LEVELS[i].name,LEVELS[i].tip,[{label:"Start",go:function(){ begin(); }}]);
  hud(); refreshLevels(); fit(); wake();
  say("Level "+(i+1)+" of "+N+", "+LEVELS[i].name+". "+LEVELS[i].tip);
  if(focus) focusBoard();
}
function begin(){ if(!G||G.won) return; over.hidden=true; mode="play"; focusBoard(); last=0; wake(); }
function pause(why){ if(mode!=="play") return; mode="paused"; kb={l:0,r:0,j:0};
  panel("Paused",why||"The bugs wait for you.",[{label:"Continue",go:function(){ begin(); }}]); }
function restart(){ loadLevel(li,true); begin(); }
function won(){
  mode="won"; var t=G.tm, c=G.coins, nb="";
  var better=save.t[li]<0||t<save.t[li], morec=c>save.c[li];
  if(better) save.t[li]=t; if(morec) save.c[li]=c;
  if(better||morec){ persist(); nb=better?" New best time.":" New best coins."; }
  refreshLevels(); sig=""; hud();
  var sub="Level "+(li+1)+" in "+fmt(t)+", "+c+" of "+G.total+" coins, "+G.deaths+(G.deaths===1?" fall.":" falls.")+nb;
  if(li+1<N){
    var b=panel("Shipped.",sub+" Next: "+LEVELS[li+1].name+".",[{label:"Next level",go:function(){ loadLevel(li+1,true); begin(); }},{label:"Play again",ghost:true,go:function(){ loadLevel(li,true); begin(); }}]);
    say("Level "+(li+1)+" shipped. "+sub);
    setTimeout(function(){ try{ b.focus({preventScroll:true}); }catch(x){} },30);
  } else {
    var b2=panel("Both shipped.",sub+" That is the whole demo. The real thing has fewer pits.",[{label:"Play level 1 again",go:function(){ loadLevel(0,true); begin(); }},{label:"Replay this level",ghost:true,go:function(){ loadLevel(li,true); begin(); }}]);
    say("Both levels shipped. "+sub);
    setTimeout(function(){ try{ b2.focus({preventScroll:true}); }catch(x){} },30);
  }
}

/* ---------- input ---------- */
var KMAP={ArrowLeft:"l",ArrowRight:"r",a:"l",A:"l",d:"r",D:"r",ArrowUp:"j",w:"j",W:"j"," ":"j"};
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var k=KMAP[e.key];
  if(k){
    e.preventDefault();
    if(mode==="ready"||mode==="paused") begin();
    if(k==="j"&&!e.repeat&&!kb.j) jp=1;
    kb[k]=1;
  } else if(e.key==="Enter"){ if(mode==="ready"||mode==="paused"){ e.preventDefault(); begin(); } }
  else if(e.key==="Escape"){ if(mode==="play"){ e.preventDefault(); pause(); } }
  else if(e.key==="r"||e.key==="R"){ e.preventDefault(); restart(); }
});
cv.addEventListener("keyup",function(e){ var k=KMAP[e.key]; if(k) kb[k]=0; });
/* pause only when focus leaves the card altogether; tapping a control keeps it inside */
mount.addEventListener("focusout",function(e){
  if(mode==="play"&&!mount.contains(e.relatedTarget)) pause("You clicked away, so the clock stopped.");
  if(!mount.contains(e.relatedTarget)) kb={l:0,r:0,j:0};
});
cv.addEventListener("pointerdown",function(e){ if(e.button>0) return; focusBoard(); if(mode==="ready"||mode==="paused") begin(); });
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });
function hold(btn,k){
  btn.addEventListener("pointerdown",function(e){
    if(e.button>0) return; e.preventDefault();
    if(mode==="ready"||mode==="paused") begin();
    if(k==="j") jp=1;
    bt[k]=1; pulse[k]=k==="j"?.05:.1; btn.classList.add("on");
    try{ btn.setPointerCapture(e.pointerId); }catch(x){}
  });
  function up(){ bt[k]=0; btn.classList.remove("on"); }
  btn.addEventListener("pointerup",up); btn.addEventListener("pointercancel",up); btn.addEventListener("lostpointercapture",up);
  btn.addEventListener("mousedown",function(e){ e.preventDefault(); });
  btn.addEventListener("contextmenu",function(e){ e.preventDefault(); });
  /* a keyboard press on the button (Enter or Space) is a short tap: click with no pointer behind it */
  btn.addEventListener("click",function(e){
    if(e.detail!==0) return;
    if(mode==="ready"||mode==="paused") begin();
    pulse[k]=k==="j"?.32:.22; if(k==="j") jp=1;
  });
}
hold(bL,"l"); hold(bR,"r"); hold(bJ,"j");
bP.addEventListener("click",function(){ if(mode==="play") pause("Paused. Take your time."); else if(mode==="paused") begin(); });
reset.addEventListener("click",restart);

/* ---------- loop ---------- */
var EV=[], INP={l:0,r:0,j:0,jp:0};
function step(dt){
  if(pulse.l>0) pulse.l-=dt; if(pulse.r>0) pulse.r-=dt; if(pulse.j>0) pulse.j-=dt;
  INP.l=kb.l||bt.l||pulse.l>0; INP.r=kb.r||bt.r||pulse.r>0; INP.j=kb.j||bt.j||pulse.j>0; INP.jp=jp; jp=0;
  EV.length=0; CORE.tick(G,INP,dt,EV,calm());
  var p=G.p;
  EV.forEach(function(k){
    if(k==="coin"){ say(G.coins===G.total?"Every coin. Billable.":"Coin. "+G.coins+" of "+G.total+"."); }
    else if(k==="stomp"){ puff(p.x,p.y); say("Bug squashed."); }
    else if(k==="shell"){ puff(p.x,p.y); say("Shell. Stomp it again or leave it."); }
    else if(k==="kick"){ say("Kicked. It does not stop."); }
    else if(k==="kill"){ say("One less bug."); }
    else if(k==="flag"){ say("Flag. Ship it."); }
    else if(k==="die"){ say(G.why==="pit"?"Fell in. Back to the start.":"A bug got you. Back to the start."); }
    else if(k==="respawn"){ var d=G.deaths; G=CORE.newGame(li,d); camSet=false; sig=""; jp=0; }
    else if(k==="win"){ won(); }
  });
}
function puff(x,y){ if(!calm()&&G) G.puffs.push({x:x,y:y,t:0}); }
function frame(now){
  raf=0; if(!vis||!G) return;
  if(!last) last=now; var el2=Math.min(.1,(now-last)/1000); last=now;
  if(mode==="play"){ acc+=el2; while(acc>=DT){ step(DT); acc-=DT; if(mode!=="play"){ acc=0; break; } } }
  camera(el2); hud(); draw();
  if(vis&&mode==="play") raf=requestAnimationFrame(frame);
}
function wake(){ if(!raf&&vis){ last=0; raf=requestAnimationFrame(frame); } if(!vis||mode!=="play"){ camera(1); draw(); } }
function camera(dt){
  if(!G) return;
  var target=Math.max(0,Math.min(G.w*T-VW,G.p.x-128+G.p.face*10));
  if(!camSet||calm()){ G.cam=target; camSet=true; } else G.cam+=(target-G.cam)*Math.min(1,dt*7);
}

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement), dark=document.documentElement.getAttribute("data-theme")==="dark";
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  return {sky:v("--paper-3","#E9EDF7"),cloud:v("--paper-2","#FFFFFF"),hill:v("--wash-mint","#D6F0E6"),hill2:dark?"#12302A":"#BFE3D6",
    ink:v("--ink","#1F2023"),dark:dark,
    ground:dark?"#3B3D43":"#2B2C30",groundHi:dark?"#4A4D54":"#3C3E44",cap:dark?"#4F9E92":"#3C8A7E",
    brick:"#EA5E14",brickEdge:dark?"#8F3A0E":"#B94612",brickHi:"#F58A4B",face:"#FFF3E8",
    q:"#F0B429",qEdge:"#B7791F",used:dark?"#4A4C52":"#B3B5BB",usedEdge:dark?"#33353A":"#8C8E94",
    pipe:"#3C8A7E",pipeDk:"#23564E",pipeHi:"#6FB5A9",
    hero:"#EA5E14",heroEdge:dark?"#0C0C0E":"#1F2023",
    bug:dark?"#E9B58F":"#7A3A18",bugDk:dark?"#B9845C":"#4F2410",shell:dark?"#4F9E92":"#3C8A7E",shellHi:dark?"#7FC4B8":"#6FB5A9",
    coin:"#F0B429",coinEdge:"#B7791F",flag:"#EA5E14"};
}
new MutationObserver(function(){ pal=null; wake(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function fit(){
  var r=view.getBoundingClientRect(); if(!r.width) return;
  var dpr=Math.min(window.devicePixelRatio||1,2); W=r.width; H=r.height;
  kscale=Math.max(1,Math.min(8,Math.round(W*dpr/VW)));
  if(cv.width!==VW*kscale){ cv.width=VW*kscale; cv.height=VH*kscale; }
  draw();
}
var cx=0;
function R(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(Math.floor(x-cx),Math.floor(y),w,h); }
var GLY={"1":[2,6,2,2,7],"3":[7,1,3,1,7],"?":[7,1,3,0,2]};
function glyph(ch,x,y,c){ var g=GLY[ch], r, b; for(r=0;r<5;r++) for(b=0;b<3;b++) if(g[r]&(4>>b)) R(x+b,y+r,1,1,c); }
function blockTile(x,y,P,kind,off){
  y-=off;
  if(kind==="B"){ R(x,y,T,T,P.brickEdge); R(x+1,y+1,T-2,T-2,P.brick); R(x+1,y+1,T-2,1,P.brickHi); R(x+1,y+1,1,T-2,P.brickHi); glyph("1",x+4,y+5,P.face); glyph("3",x+9,y+5,P.face); }
  else if(kind==="?"){ R(x,y,T,T,P.qEdge); R(x+1,y+1,T-2,T-2,P.q); R(x+1,y+1,T-2,1,"#FFD866"); glyph("?",x+6,y+5,P.qEdge); R(x+2,y+2,1,1,P.qEdge); R(x+T-3,y+2,1,1,P.qEdge); R(x+2,y+T-3,1,1,P.qEdge); R(x+T-3,y+T-3,1,1,P.qEdge); }
  else { R(x,y,T,T,P.usedEdge); R(x+1,y+1,T-2,T-2,P.used); R(x+2,y+2,1,1,P.usedEdge); R(x+T-3,y+2,1,1,P.usedEdge); R(x+2,y+T-3,1,1,P.usedEdge); R(x+T-3,y+T-3,1,1,P.usedEdge); }
}
function drawHero(p,P,t){
  var x=Math.round(p.x), y=Math.round(p.y), air=!p.ground, ph=Math.floor(p.run/7)%2;
  R(x-7,y-14,14,12,P.heroEdge); R(x-6,y-13,12,10,P.hero);
  R(x-6,y-13,12,1,P.brickHi);
  var f=p.face>0?1:0, ex=f?x-1:x-5;
  R(ex,y-12,2,2,"#FFFFFF"); R(ex+4,y-12,2,2,"#FFFFFF");
  R(ex+(f?1:0),y-11,1,1,"#1F2023"); R(ex+4+(f?1:0),y-11,1,1,"#1F2023");
  glyph("1",x-3,y-9,P.face); glyph("3",x+1,y-9,P.face);
  if(air){ R(x-6,y-2,3,2,P.heroEdge); R(x+3,y-2,3,2,P.heroEdge); }
  else if(Math.abs(p.vx)>8){ R(x-5+ph*2,y-2,3,2,P.heroEdge); R(x+2-ph*2,y-2,3,2,P.heroEdge); }
  else { R(x-5,y-2,3,2,P.heroEdge); R(x+2,y-2,3,2,P.heroEdge); }
}
function drawEnemy(e,P,t){
  var x=Math.round(e.x), y=Math.round(e.y), ph=Math.floor((e.x+e.y)/6)%2;
  if(e.st==="squash"){ R(x-7,y-4,14,4,e.s?P.shell:P.bug); return; }
  var dead=e.st==="dead";
  if(e.k==="e"){
    R(x-6,y-9,12,6,P.bug); R(x-5,y-11,10,2,P.bug); R(x-4,y-12,8,1,P.bug);
    R(x-6,y-4,12,1,P.bugDk);
    R(x-4,y-9,3,3,"#FFFFFF"); R(x+1,y-9,3,3,"#FFFFFF"); R(x-3,y-8,1,2,"#1F2023"); R(x+2,y-8,1,2,"#1F2023");
    R(x-4,y-10,3,1,"#1F2023"); R(x+1,y-10,3,1,"#1F2023");
    if(!dead){ R(x-6+ph*2,y-3,4,3,P.bugDk); R(x+2-ph*2,y-3,4,3,P.bugDk); } else { R(x-6,y-3,4,3,P.bugDk); R(x+2,y-3,4,3,P.bugDk); }
  } else if(e.st==="walk"||dead){
    R(x-6,y-10,12,7,P.shell); R(x-5,y-11,10,1,P.shell); R(x-3,y-8,2,2,P.shellHi); R(x+1,y-9,2,2,P.shellHi);
    R(x+(e.dir>0?3:-7),y-12,4,4,P.bug); R(x+(e.dir>0?5:-6),y-11,1,1,"#FFFFFF");
    R(x-5+ph*2,y-3,3,3,P.bugDk); R(x+2-ph*2,y-3,3,3,P.bugDk);
  } else {
    var spin=e.st==="slide"&&Math.floor(t*20)%2;
    R(x-6,y-8,12,8,spin?P.shellHi:P.shell); R(x-5,y-9,10,1,P.shell); R(x-4,y-7,2,2,P.shellHi); R(x+1,y-6,2,2,spin?P.shell:P.shellHi); R(x-6,y-1,12,1,P.bugDk);
  }
}
function draw(){
  if(!G||!W) return;
  if(!pal) pal=palette();
  var P=pal, c, r, i, t=G.tm;
  ctx.setTransform(kscale,0,0,kscale,0,0); ctx.imageSmoothingEnabled=false;
  cx=Math.round(G.cam);
  ctx.fillStyle=P.sky; ctx.fillRect(0,0,VW,VH);
  /* far hills and clouds drift slower than the ground: depth without any extra motion */
  var hx, pxo, row;
  for(i=-1;i<4;i++){ hx=i*150-((cx*.25)%150)+20; for(row=0;row<7;row++){ ctx.fillStyle=P.hill2; ctx.fillRect(Math.floor(hx+row*5),144-row*6-6,Math.max(0,70-row*10),6); } }
  for(i=-1;i<5;i++){ hx=i*110-((cx*.5)%110)+10; for(row=0;row<5;row++){ ctx.fillStyle=P.hill; ctx.fillRect(Math.floor(hx+row*4),144-row*5-5,Math.max(0,52-row*8),5); } }
  for(i=-1;i<4;i++){ hx=i*140-((cx*.12)%140)+30; var cy=(i%2?30:16); ctx.fillStyle=P.cloud; ctx.fillRect(Math.floor(hx),cy+4,26,5); ctx.fillRect(Math.floor(hx+4),cy,16,5); ctx.fillRect(Math.floor(hx+16),cy+2,12,5); }
  /* tiles */
  var c0=Math.max(0,Math.floor(cx/T)), c1=Math.min(G.w-1,Math.floor((cx+VW)/T));
  for(r=0;r<ROWS;r++) for(c=c0;c<=c1;c++){
    var ch=G.g[r][c]; if(ch==="."||ch==="o") continue;
    var x=c*T, y=r*T, off=0, bk=G.bump[c+","+r];
    if(bk!==undefined&&!calm()) off=Math.round(Math.sin(Math.min(1,bk/.15)*Math.PI)*4);
    if(ch==="#"){
      var capd=!solidTop(G,c,r-1);
      R(x,y,T,T,P.ground); R(x,y+T-1,T,1,P.groundHi); R(x+T-1,y,1,T,P.groundHi); R(x+3,y+5,2,2,P.groundHi); R(x+10,y+11,2,2,P.groundHi);
      if(capd){ R(x,y,T,4,P.cap); R(x+2,y+4,2,1,P.cap); R(x+9,y+4,3,1,P.cap); }
    } else if(ch==="B"||ch==="?"||ch==="U") blockTile(x,y,P,ch,off);
    else if(ch==="T"){
      var cap=tileAt(G,c,r-1)!=="T", lft=tileAt(G,c-1,r)!=="T";
      R(x,y,T,T,P.pipeDk); R(x+1,y,T-2,T,P.pipe); if(lft) R(x+3,y,2,T,P.pipeHi);
      if(cap){ R(x-1,y,T+2,6,P.pipeDk); R(x,y+1,T,4,P.pipe); R(x+3,y+1,2,4,P.pipeHi); }
    } else if(ch==="F"){
      R(x+7,y,2,T,P.ink);
      if(tileAt(G,c,r-1)!=="F"){ R(x+6,y-2,4,3,P.ink); var wv=calm()?0:Math.round(Math.sin(t*6)*1);
        R(x+9,y+1,10,2,P.flag); R(x+9,y+3,9+wv,2,P.flag); R(x+9,y+5,7+wv,2,P.flag); R(x+9,y+7,4,1,P.flag); R(x+11,y+2,1,1,P.face); R(x+12,y+3,1,1,P.face); R(x+13,y+2,1,1,P.face); }
    }
  }
  /* map coins */
  var spin=calm()?1:Math.abs(Math.cos(t*5));
  for(r=0;r<ROWS;r++) for(c=c0;c<=c1;c++) if(G.g[r][c]==="o"){ var w=Math.max(2,Math.round(8*spin)); R(c*T+8-w/2,r*T+4,w,8,P.coinEdge); R(c*T+8-w/2+1,r*T+5,Math.max(1,w-2),6,P.coin); }
  for(i=0;i<G.en.length;i++) drawEnemy(G.en[i],P,t);
  if(!G.p.dead||!calm()||G.dyingT>.3) drawHero(G.p,P,t);
  /* pops: the coin that jumps out of a block, and a stomp puff */
  if(!calm()){
    for(i=0;i<G.pops.length;i++){ var q=G.pops[i], yy=q.y-8-Math.sin(Math.min(1,q.t/.5)*Math.PI)*28; R(q.x-3,yy,6,8,P.coinEdge); R(q.x-2,yy+1,4,6,P.coin); }
    for(i=0;i<G.puffs.length;i++){ var u=G.puffs[i], k=u.t/.35; ctx.globalAlpha=1-k; R(u.x-8-k*5,u.y-3-k*3,3,3,P.cloud); R(u.x+5+k*5,u.y-3-k*3,3,3,P.cloud); R(u.x-1,u.y-5-k*6,3,3,P.cloud); ctx.globalAlpha=1; }
  }
}
function solidTop(G,c,r){ return CORE.tileAt(G,c,r)==="#"; }

/* ---------- visibility, resize ---------- */
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else if(mode==="play") pause("The board left the screen, so the clock stopped."); },{threshold:.15}).observe(view);
document.addEventListener("visibilitychange",function(){ if(document.hidden&&mode==="play") pause(); });
var rz=0; window.addEventListener("resize",function(){ cancelAnimationFrame(rz); rz=requestAnimationFrame(fit); });
if(window.ResizeObserver) new ResizeObserver(function(){ fit(); }).observe(view);
if(mq.addEventListener) mq.addEventListener("change",function(){ wake(); });


/* ---------- boot: the first level not yet cleared ---------- */
var first=0; for(var si=0;si<N;si++){ if(save.t[si]<0){ first=si; break; } }
loadLevel(first,false);
})();
