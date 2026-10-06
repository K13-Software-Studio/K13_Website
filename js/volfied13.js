/* K13 Reveal 13: a territory-claiming game (the classic Volfied / Qix idea), twelve levels (one real K13 site under each), built on the workbench card anatomy.
   The board is a blank wireframe template. Ride the claimed edge, push off it to draw a line, close the line on the edge and the
   side WITHOUT the template boss is claimed, and the real finished site shows through. Claim 75 to 80 percent to clear a level.
   The boss (a stock template window) bounces around the open area; touching your unfinished line costs a life. From level 2
   sparks crawl along the claimed edge. The reveal is a real K13 project screenshot per level (same-origin images).
   Cell grid, flood fill from the boss's cell decides what is claimed. The loop is a fixed 120 Hz step behind an accumulator and draws
   to a devicePixelRatio-crisp canvas. It stops while the card is off screen or the tab is hidden, and the game pauses when focus
   leaves the card during play.
   prefers-reduced-motion: no shake, no flash, no particles, no score pop-ups, no idle boss before the start. Fully playable.
   Keyboard (board focused): arrows or WASD move, R restarts the level, N goes to the next unlocked level, Esc pauses.
   Touch: drag anywhere on the board like a joystick. Labelled on-screen direction buttons exist for every input type.
   The core (grid, rules, levels) sits between the CORE markers and touches no DOM. */
(function(){
"use strict";

/* ===================================================== CORE-BEGIN ===================================================== */
var COLS=48, ROWS=30, N=COLS*ROWS, PSPEED=22, SPARKV=11, BOSSR=1.3, LIVES=3, INTERIOR=(COLS-2)*(ROWS-2);
var LEVELS=[
  {name:"Egg & Out",img:"eggout-live",crop:.935,goal:.75,boss:8,sparks:0,tip:"Shave a strip off the edge, then get back to the wall. Small bites count."},
  {name:"Station 8",img:"station8-live",goal:.78,boss:10,sparks:1,tip:"A spark rides the edge now. Keep moving, and do not park beside it."},
  {name:"Lobster Lab",img:"lobsterlab-live",goal:.8,boss:12,sparks:2,tip:"Two sparks and a quicker template. Cut it in halves and leave the boss the small one."},
  {name:"Miramar Food Hall",img:"miramar-live",goal:.8,boss:12,sparks:2,tip:"Same speed, bigger appetite. Take the corners first, they are the cheapest."},
  {name:"Global Fork",img:"globalfork-live",goal:.8,boss:13,sparks:2,tip:"The template got quicker. Short trips, straight back to the wall."},
  {name:"La Vida",img:"lavida-live",goal:.8,boss:13,sparks:3,tip:"Three sparks now. Watch where they are before you leave the edge."},
  {name:"BarFix",img:"barfix-live",goal:.8,boss:14,sparks:3,tip:"Pin the template in a corner and the rest of the page is yours."},
  {name:"CENGO",img:"cengo-live",goal:.82,boss:14,sparks:3,tip:"A darker page, the same rules. Bite, wall, bite."},
  {name:"Carlos Almaraz",img:"carlos-live",goal:.82,boss:15,sparks:3,tip:"A painter's page. Cut long thin strips, the template hates corridors."},
  {name:"Trust Me Bro",img:"trustmebro-live",goal:.82,boss:15,sparks:4,tip:"Four sparks on the edge. Leave the wall when they are far, not when it is clear."},
  {name:"baa atelier",img:"baa-stop",goal:.85,boss:16,sparks:4,tip:"Eighty-five percent. Every cell counts here."},
  {name:"Tiger Hospitality",img:"thg-hero",goal:.85,boss:16,sparks:4,tip:"The last page. Fastest template, most sparks, highest bar."}
];
var NL=LEVELS.length;
var DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
function rnd(){ return Math.random(); }
function inb(x,y){ return x>=0&&y>=0&&x<COLS&&y<ROWS; }
function cellAt(G,x,y){ x=Math.floor(x); y=Math.floor(y); return inb(x,y)?G.grid[y*COLS+x]:1; }
function isEdge(G,x,y){
  if(G.grid[y*COLS+x]!==1) return false;
  for(var j=-1;j<=1;j++) for(var i=-1;i<=1;i++){ var a=x+i, b=y+j; if((i||j)&&inb(a,b)&&G.grid[b*COLS+a]===0) return true; }
  return false;
}
function rotate(G,a){ var c=Math.cos(a), s=Math.sin(a), x=G.vx*c-G.vy*s, y=G.vx*s+G.vy*c; G.vx=x; G.vy=y; }
function keepSweep(G){ /* never let the boss settle into a straight line along an axis */
  var sp=G.L.boss, ax=Math.abs(G.vx)/sp, ay=Math.abs(G.vy)/sp;
  if(ax<.28||ay<.28) rotate(G,(ax<ay?1:-1)*(G.vx*G.vy>=0?1:-1)*.5);
}
function nearestOpen(G,x,y){
  for(var r=0;r<=8;r++) for(var j=-r;j<=r;j++) for(var i=-r;i<=r;i++){
    if(Math.max(Math.abs(i),Math.abs(j))!==r) continue; var a=x+i, b=y+j;
    if(inb(a,b)&&G.grid[b*COLS+a]===0) return [a,b]; }
  for(var k=0;k<N;k++) if(G.grid[k]===0) return [k%COLS,Math.floor(k/COLS)];
  return null;
}
function farEdge(G,fromX,fromY,minD){
  for(var t=0;t<80;t++){ var x=Math.floor(rnd()*COLS), y=Math.floor(rnd()*ROWS);
    if(isEdge(G,x,y)&&Math.abs(x-fromX)+Math.abs(y-fromY)>=minD) return [x,y]; }
  return null;
}
function mkSpark(x,y){ return {x:x,y:y,nx:x,ny:y,f:1,dx:0,dy:0}; }

function newGame(li){
  var L=LEVELS[li], grid=new Uint8Array(N), x, y;
  for(y=0;y<ROWS;y++) for(x=0;x<COLS;x++) grid[y*COLS+x]=(x===0||y===0||x===COLS-1||y===ROWS-1)?1:0;
  var sp=L.boss, a=-.9-rnd()*.7;
  var G={li:li,L:L,grid:grid,px:COLS>>1,py:ROWS-1,ox:COLS>>1,oy:ROWS-1,drawing:false,trail:[],pAcc:1,
    bx:COLS*.5,by:ROWS*.4,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,turn:1,
    sparks:[],respawn:[],lives:LIVES,hurt:0,safe:0,got:0,pct:0,won:false,lost:false,t:0};
  if(L.sparks>0) G.sparks.push(mkSpark(COLS-1,0));
  if(L.sparks>1) G.sparks.push(mkSpark(0,0));
  if(L.sparks>2) G.sparks.push(mkSpark(0,ROWS>>1));
  if(L.sparks>3) G.sparks.push(mkSpark(COLS-1,ROWS>>1));
  return G;
}

function bossCell(G){
  var x=Math.floor(G.bx), y=Math.floor(G.by);
  if(inb(x,y)&&G.grid[y*COLS+x]===0) return [x,y];
  var c=nearestOpen(G,x,y); if(c){ G.bx=c[0]+.5; G.by=c[1]+.5; } return c;
}
function countClaimed(G){ var n=0; for(var y=1;y<ROWS-1;y++) for(var x=1;x<COLS-1;x++) if(G.grid[y*COLS+x]===1) n++; return n; }

function finishTrail(G,EV){
  var newly=G.trail.slice(), i, prev=G.pct;
  G.trail=[]; G.drawing=false;
  for(i=0;i<newly.length;i++) G.grid[newly[i]]=1;
  var c=bossCell(G);
  if(c){
    var mark=new Uint8Array(N), stack=[c[1]*COLS+c[0]]; mark[stack[0]]=1;
    while(stack.length){ var k=stack.pop(), kx=k%COLS, ky=(k-kx)/COLS;
      for(var d=0;d<4;d++){ var a=kx+DIRS[d][0], b=ky+DIRS[d][1]; if(!inb(a,b)) continue; var q=b*COLS+a;
        if(G.grid[q]===0&&!mark[q]){ mark[q]=1; stack.push(q); } } }
    for(i=0;i<N;i++) if(G.grid[i]===0&&!mark[i]){ G.grid[i]=1; newly.push(i); }
  }
  G.got=countClaimed(G); G.pct=G.got/INTERIOR;
  if(G.pct>=G.L.goal||!c){
    for(i=0;i<N;i++) if(G.grid[i]===0){ G.grid[i]=1; newly.push(i); }
    G.got=INTERIOR; G.pct=1; G.won=true; G.sparks.length=0; G.respawn.length=0;
    EV.push({t:"claim",gain:G.pct-prev,cells:newly}); EV.push({t:"won"});
  } else EV.push({t:"claim",gain:G.pct-prev,cells:newly});
}

function loseLife(G,EV,why){
  for(var i=0;i<G.trail.length;i++) G.grid[G.trail[i]]=0;
  G.trail=[]; G.drawing=false; G.px=G.ox; G.py=G.oy; G.lives--; G.hurt=.9; G.safe=1.8; G.pAcc=0;
  EV.push({t:"hurt",why:why});
  if(G.lives<=0){ G.lost=true; EV.push({t:"lost"}); }
}

function tryMove(G,dx,dy,EV){
  var nx=G.px+dx, ny=G.py+dy; if(!inb(nx,ny)) return false;
  var t=G.grid[ny*COLS+nx];
  if(G.drawing){
    if(t===2) return false;
    if(t===1){ G.px=nx; G.py=ny; finishTrail(G,EV); return true; }
    G.grid[ny*COLS+nx]=2; G.trail.push(ny*COLS+nx); G.px=nx; G.py=ny; return true;
  }
  if(t===1){ if(isEdge(G,nx,ny)||!isEdge(G,G.px,G.py)){ G.px=nx; G.py=ny; return true; } return false; }
  G.ox=G.px; G.oy=G.py; G.drawing=true; G.trail=[ny*COLS+nx]; G.grid[ny*COLS+nx]=2; G.px=nx; G.py=ny;
  EV.push({t:"start"}); return true;
}
function movePlayer(G,dir,dt,EV){
  if(!dir[0]&&!dir[1]){ G.pAcc=1; return; }
  G.pAcc+=PSPEED*dt;
  while(G.pAcc>=1&&!G.won&&!G.lost&&G.hurt<=0){ G.pAcc-=1; if(!tryMove(G,dir[0],dir[1],EV)){ G.pAcc=0; break; } }
}

function moveBoss(G,dt){
  G.turn-=dt; if(G.turn<=0){ rotate(G,(rnd()-.5)*1.1); keepSweep(G); G.turn=.6+rnd()*1.2; }
  if(cellAt(G,G.bx,G.by)===1){ var c=nearestOpen(G,Math.floor(G.bx),Math.floor(G.by)); if(c){ G.bx=c[0]+.5; G.by=c[1]+.5; } }
  var h=.7, nx=G.bx+G.vx*dt, ny=G.by+G.vy*dt, sx=G.vx>0?h:-h, sy=G.vy>0?h:-h, bx=false, by=false;
  if(cellAt(G,nx+sx,G.by)===1){ G.vx=-G.vx; bx=true; } else G.bx=nx;
  if(cellAt(G,G.bx,ny+sy)===1){ G.vy=-G.vy; by=true; } else G.by=ny;
  if(!bx&&!by&&cellAt(G,G.bx+sx,G.by+sy)===1){ G.vx=-G.vx; G.vy=-G.vy; bx=true; }
  if(bx||by){ rotate(G,(rnd()-.5)*.3); keepSweep(G); }
}

function sparkPick(G,s){
  var opts=[], i;
  for(i=0;i<4;i++){ var a=s.x+DIRS[i][0], b=s.y+DIRS[i][1];
    if(inb(a,b)&&isEdge(G,a,b)&&!(DIRS[i][0]===-s.dx&&DIRS[i][1]===-s.dy&&(s.dx||s.dy))) opts.push(DIRS[i]); }
  if(!opts.length){ for(i=0;i<4;i++){ var a2=s.x+DIRS[i][0], b2=s.y+DIRS[i][1]; if(inb(a2,b2)&&isEdge(G,a2,b2)) opts.push(DIRS[i]); } }
  if(!opts.length) return null;
  if(opts.length===1||rnd()>.55) return opts[Math.floor(rnd()*opts.length)];
  var best=opts[0], bd=1e9;
  opts.forEach(function(o){ var d=Math.abs(s.x+o[0]-G.px)+Math.abs(s.y+o[1]-G.py); if(d<bd){ bd=d; best=o; } });
  return best;
}
function moveSparks(G,dt){
  var i, s, dead;
  for(i=G.sparks.length-1;i>=0;i--){ s=G.sparks[i]; dead=false; s.f+=SPARKV*dt;
    while(s.f>=1&&!dead){
      s.x=s.nx; s.y=s.ny; s.f-=1;
      if(!isEdge(G,s.x,s.y)){ dead=true; break; }
      var o=sparkPick(G,s); if(!o){ dead=true; break; }
      s.dx=o[0]; s.dy=o[1]; s.nx=s.x+o[0]; s.ny=s.y+o[1];
    }
    if(!dead&&(s.nx!==s.x||s.ny!==s.y)&&!isEdge(G,s.nx,s.ny)) dead=true;
    if(dead){ G.sparks.splice(i,1); G.respawn.push(5); }
  }
  for(i=G.respawn.length-1;i>=0;i--){ G.respawn[i]-=dt;
    if(G.respawn[i]<=0){ var c=farEdge(G,G.px,G.py,18); if(c){ G.sparks.push(mkSpark(c[0],c[1])); G.respawn.splice(i,1); } else G.respawn[i]=1; } }
}
function sparkPos(s){ var f=Math.min(1,s.f); return {x:s.x+(s.nx-s.x)*f+.5,y:s.y+(s.ny-s.y)*f+.5}; }

function checkHits(G,EV){
  var i, j, bx=Math.floor(G.bx), by=Math.floor(G.by), R=BOSSR+.35;
  for(j=by-2;j<=by+2;j++) for(i=bx-2;i<=bx+2;i++){
    if(!inb(i,j)||G.grid[j*COLS+i]!==2) continue;
    var dx=i+.5-G.bx, dy=j+.5-G.by; if(dx*dx+dy*dy<R*R){ loseLife(G,EV,"line"); return; } }
  if(G.drawing){ var pdx=G.px+.5-G.bx, pdy=G.py+.5-G.by; if(pdx*pdx+pdy*pdy<(BOSSR+.3)*(BOSSR+.3)){ loseLife(G,EV,"line"); return; }
    var open=0; for(i=0;i<4;i++){ var a=G.px+DIRS[i][0], b=G.py+DIRS[i][1]; if(inb(a,b)&&G.grid[b*COLS+a]!==2) open++; }
    if(!open){ loseLife(G,EV,"trapped"); return; } }
  if(G.safe<=0) for(i=0;i<G.sparks.length;i++){ var sp=sparkPos(G.sparks[i]), sx=sp.x-(G.px+.5), sy=sp.y-(G.py+.5);
    if(sx*sx+sy*sy<1.1){ loseLife(G,EV,"spark"); return; } }
}

function step(G,dir,dt,EV){
  if(G.won||G.lost) return;
  if(G.hurt>0){ G.hurt-=dt; return; }
  G.t+=dt; if(G.safe>0) G.safe-=dt;
  movePlayer(G,dir,dt,EV); if(G.won) return;
  moveBoss(G,dt); moveSparks(G,dt); checkHits(G,EV);
}
/* ====================================================== CORE-END ====================================================== */

/* ============================================================ the card, the canvas, the controls ============================================================ */
var mount=document.querySelector('[data-game="volfied13"]');
if(!mount) return;
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
function lv(n){ return n+(n===1?" life":" lives"); }

/* card chrome: the same DOM and classes as card() in workbench.js (head, instruction, stage, reset, status, footnote) */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Reveal 13")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Ride the edge, push off it to draw a line, close it on the edge. You keep the side without the template, and the real site shows through. Claim 75 to 80% to clear a level."); instr.id="vf-i"; mount.appendChild(instr);
var stage=el("div","wb-stage vf-stage"); stage.setAttribute("aria-describedby","vf-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Retry</span>');
reset.type="button"; reset.setAttribute("aria-label","Retry this level"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Arrows or WASD move, Esc pauses, R retries, N is the next level. Touch: drag on the board. Progress is kept on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var hud=el("div","vf-hud");
var hLevel=txt("span","vf-chip",""), hClaim=txt("span","vf-chip",""), hLives=txt("span","vf-chip","");
hud.appendChild(hLevel); hud.appendChild(hClaim); hud.appendChild(hLives); stage.appendChild(hud);
var view=el("div","vf-view"); stage.appendChild(view);
var cv=el("canvas","vf-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Reveal 13 game board. Use the arrow keys or WASD to ride the edge and draw lines, or drag on the board, or use the direction buttons below.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var tpl=document.createElement("canvas"), tctx=tpl.getContext("2d"), rev=document.createElement("canvas"), rctx=rev.getContext("2d"), fl=document.createElement("canvas"), fctx=fl.getContext("2d");
var over=el("div","vf-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Level status"); view.appendChild(over);
var after=el("div","vf-after"); after.hidden=true; after.setAttribute("role","group"); after.setAttribute("aria-label","Level result"); stage.appendChild(after);

var bar=el("div","vf-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Reveal 13 controls"); stage.appendChild(bar);
function btn(label,aria,cls){ var b=txt("button","vf-btn "+(cls||""),label); b.type="button"; if(aria) b.setAttribute("aria-label",aria); return b; }
var lvWrap=el("div","vf-grp"); lvWrap.setAttribute("role","group"); lvWrap.setAttribute("aria-label","Level");
var lvBtns=LEVELS.map(function(x,i){ return i; }).map(function(i){ var b=btn("","Level "+(i+1)); b.addEventListener("click",function(){ if(!b.disabled){ loadLevel(i,true); focusBoard(); } }); lvWrap.appendChild(b); return b; });
bar.appendChild(lvWrap);
var pad=el("div","vf-pad"); pad.setAttribute("role","group"); pad.setAttribute("aria-label","Direction buttons, hold to move");
var PADS=[["←","Move left",[-1,0]],["↑","Move up",[0,-1]],["↓","Move down",[0,1]],["→","Move right",[1,0]]];
var padHeld=null, pulse={t:0,d:[0,0]};
PADS.forEach(function(p){
  var b=btn(p[0],p[1]+", hold to keep going","vf-key"); pad.appendChild(b);
  b.addEventListener("pointerdown",function(e){
    if(e.button>0) return; e.preventDefault(); if(mode==="ready"||mode==="paused") begin(); if(mode!=="play") return;
    padHeld={d:p[2],id:e.pointerId}; try{ b.setPointerCapture(e.pointerId); }catch(x){} wake();
  });
  function up(e){ if(padHeld&&padHeld.id===e.pointerId) padHeld=null; }
  b.addEventListener("pointerup",up); b.addEventListener("pointercancel",up);
  b.addEventListener("contextmenu",function(e){ e.preventDefault(); });
  b.addEventListener("click",function(e){ if(e.detail===0){ if(mode==="ready"||mode==="paused") begin(); if(mode==="play"){ pulse={t:.3,d:p[2]}; wake(); } } });
});
bar.appendChild(pad);

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store("k13_volfied13")||"null"); if(s&&s.best&&s.best.length){ while(s.best.length<NL) s.best.push(0); s.best.length=NL; return s; } }catch(e){} return {best:LEVELS.map(function(){ return 0; })}; })();
function persist(){ store("k13_volfied13",JSON.stringify(save)); }
var G=null, mode="ready", keysDown=[], stick=null, imgs={};
var W=0,H=0,cw=10,ch=10,dprv=1,vis=false,raf=0,acc=0,last=0,pal=null,shake=0,flashT=0,tplDirty=true,revDirty=true;
var parts=[], pops=[], EV=[], sig="";
var DT=1/120;

function unlocked(i){ return i===0||save.best[i-1]>0; }
function stars(n){ return "★★★".slice(0,n)+"☆☆☆".slice(0,3-n); }
function goalPct(){ return Math.round(G.L.goal*100); }
function pctNow(){ return Math.floor(G.pct*100+1e-9); }
function refreshChips(){
  lvBtns.forEach(function(b,i){
    var s=save.best[i], ok=unlocked(i);
    b.textContent=(i+1)+" "+stars(s); b.disabled=!ok; b.setAttribute("aria-pressed",String(!!G&&G.li===i));
    b.setAttribute("aria-label","Level "+(i+1)+(ok?(s?", best "+s+(s===1?" star":" stars"):", not cleared yet"):", locked, clear level "+i+" first"));
  });
}
function hudUpdate(){
  if(!G) return;
  var s=[G.li,pctNow(),G.lives].join("|"); if(s===sig) return; sig=s;
  hLevel.textContent="Level "+(G.li+1)+" of "+NL; hClaim.textContent="Claimed "+pctNow()+"% of "+goalPct()+"%"; hLives.textContent="Lives "+G.lives;
}
function panel(title,sub,btns,focus){
  over.innerHTML="";
  var p=el("div","vf-panel"), first=null, row=el("div","vf-over-row");
  p.appendChild(txt("h4","vf-over-t",title)); p.appendChild(txt("p","vf-over-s",sub));
  btns.forEach(function(b){ var x=txt("button","vf-obtn"+(b.ghost?" ghost":""),b.label); x.type="button"; x.addEventListener("click",b.go); row.appendChild(x); if(!first) first=x; });
  p.appendChild(row); over.appendChild(p); over.hidden=false;
  if(focus) setTimeout(function(){ try{ first.focus({preventScroll:true}); }catch(x){} },30);
  return first;
}
function loadLevel(i,announce){
  G=newGame(i); mode="ready"; parts.length=0; pops.length=0; keysDown=[]; stick=null; padHeld=null; pulse.t=0; shake=0; flashT=0; sig=""; EV.length=0;
  after.hidden=true; after.innerHTML=""; revDirty=true; fctx.setTransform(1,0,0,1,0,0); fctx.clearRect(0,0,fl.width,fl.height);
  panel("Level "+(i+1)+" of "+NL,"Under the template: "+G.L.name+". Claim "+goalPct()+"% to see it all. "+G.L.tip,[{label:"Start",go:function(){ begin(); focusBoard(); }}]);
  hudUpdate(); refreshChips(); fit(); wake();
  if(announce!==false) say("Level "+(i+1)+" of "+NL+", "+G.L.name+". Claim "+goalPct()+" percent. "+G.L.tip+" Press an arrow key or Start.");
}
var PEEK=.7, peekT=0;
function begin(){ if(!G||G.won||G.lost) return; over.hidden=true; if(mode==="ready") peekT=calm()?0:PEEK; mode="play"; last=0; focusBoard(); wake(); }
function pause(why){ if(mode!=="play") return; mode="paused"; keysDown=[]; stick=null; padHeld=null;
  panel("Paused",why||"The template waits for you.",[{label:"Continue",go:function(){ begin(); }}],true); say("Paused. Press an arrow key or Continue."); }
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function retry(){ if(!G) return; var i=G.li; loadLevel(i,false); say("Retrying level "+(i+1)+". Claim "+goalPct()+" percent."); focusBoard(); }
function nextLevel(){ if(!G) return; var n=G.li+1; if(n<NL&&unlocked(n)){ loadLevel(n,true); focusBoard(); } }
reset.addEventListener("click",retry);

/* ---------- input ---------- */
var KD={arrowleft:[-1,0],arrowright:[1,0],arrowup:[0,-1],arrowdown:[0,1],a:[-1,0],d:[1,0],w:[0,-1],s:[0,1]};
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var k=e.key.length===1?e.key.toLowerCase():e.key.toLowerCase();
  if(KD[k]){ e.preventDefault(); if(keysDown.indexOf(k)<0) keysDown.push(k); if(mode==="ready"||mode==="paused") begin(); wake(); }
  else if(e.key===" "||e.key==="Enter"){ if(mode==="ready"||mode==="paused"){ e.preventDefault(); begin(); } }
  else if(e.key==="Escape"){ if(mode==="play"){ e.preventDefault(); pause(); } }
});
cv.addEventListener("keyup",function(e){ var k=e.key.toLowerCase(), i=keysDown.indexOf(k); if(i>=0) keysDown.splice(i,1); });
mount.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key==="r"||e.key==="R"){ e.preventDefault(); retry(); }
  else if(e.key==="n"||e.key==="N"){ e.preventDefault(); nextLevel(); }
});
mount.addEventListener("focusout",function(e){
  if(mode!=="play") return; var to=e.relatedTarget;
  if(!to||!mount.contains(to)) pause("You clicked away, so the template stopped.");
});
window.addEventListener("blur",function(){ keysDown=[]; padHeld=null; stick=null; });
function curDir(){
  if(pulse.t>0) return pulse.d;
  if(padHeld) return padHeld.d;
  if(stick&&stick.d) return stick.d;
  return keysDown.length?KD[keysDown[keysDown.length-1]]:[0,0];
}
/* touch and mouse: drag like a joystick; the anchor follows the finger so a quick turn is a short drag */
var STICK_DEAD=9, STICK_MAX=34;
cv.addEventListener("pointerdown",function(e){
  if(e.button>0) return; e.preventDefault(); focusBoard();
  if(mode==="ready"||mode==="paused") begin();
  if(mode!=="play") return;
  stick={id:e.pointerId,x0:e.clientX,y0:e.clientY,d:null};
  try{ cv.setPointerCapture(e.pointerId); }catch(x){} wake();
});
cv.addEventListener("pointermove",function(e){
  if(!stick||stick.id!==e.pointerId) return;
  var dx=e.clientX-stick.x0, dy=e.clientY-stick.y0, L=Math.hypot(dx,dy);
  if(L>STICK_MAX){ stick.x0=e.clientX-dx/L*STICK_MAX; stick.y0=e.clientY-dy/L*STICK_MAX; dx=e.clientX-stick.x0; dy=e.clientY-stick.y0; L=STICK_MAX; }
  if(L<STICK_DEAD) return;
  stick.d=Math.abs(dx)>Math.abs(dy)?[dx>0?1:-1,0]:[0,dy>0?1:-1];
});
function lift(e){ if(stick&&stick.id===e.pointerId) stick=null; }
cv.addEventListener("pointerup",lift); cv.addEventListener("pointercancel",lift);
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });

/* ---------- results ---------- */
function showAfter(){
  after.innerHTML=""; after.hidden=false;
  var li=G.li, st=G.lives, last=li===NL-1, all=last&&save.best.every(function(s){ return s>0; }), total=save.best.reduce(function(a,b){ return a+b; },0);
  var box=el("div","vf-after-t");
  box.appendChild(txt("h4","vf-over-t",all?"All "+NL+", revealed":"Level "+(li+1)+" clear"));
  box.appendChild(txt("p","vf-over-s",G.L.name+", live. "+pctNow()+"% claimed, "+lv(st)+" left, "+Math.max(1,Math.round(G.t))+(Math.round(G.t)<=1?" second.":" seconds.")+(all?" "+total+" of "+(NL*3)+" stars in all.":"")));
  after.appendChild(box);
  var row=el("div","vf-over-row"), first;
  function ob(label,cls,fn){ var b=txt("button","vf-obtn "+(cls||""),label); b.type="button"; b.addEventListener("click",fn); row.appendChild(b); return b; }
  first=last?ob("Play again","",function(){ loadLevel(0,true); focusBoard(); }):ob("Next level","",nextLevel);
  ob("Retry for more stars","ghost",retry);
  after.appendChild(row);
  setTimeout(function(){ try{ first.focus({preventScroll:true}); }catch(x){} },30);
}
function handle(e){
  if(e.t==="start"){ if(!calm()) burst(G.ox+.5,G.oy+.5,"#EA5E14",5); }
  else if(e.t==="claim"){
    var gain=Math.max(0,Math.round(e.gain*100));
    revDirty=true; paintFlash(e.cells);
    if(!calm()){ flashT=.45; var cx=0, cy=0; e.cells.forEach(function(c){ cx+=c%COLS; cy+=Math.floor(c/COLS); }); cx=cx/e.cells.length+.5; cy=cy/e.cells.length+.5;
      pops.push({x:cx*cw,y:cy*ch,t:0,s:"+"+gain+"%"}); burst(G.px+.5,G.py+.5,"#FFFFFF",10); burst(G.px+.5,G.py+.5,"#EA5E14",8); }
    if(!G.won) say("Claimed "+gain+" percent. "+pctNow()+" of "+goalPct()+" percent.");
  }
  else if(e.t==="hurt"){
    if(!calm()) shake=.25;
    parts.length=0; if(!calm()){ burst(G.bx,G.by,"#1F2023",10); }
    var why=e.why==="spark"?"A spark got you.":e.why==="trapped"?"You boxed yourself in.":"The template touched your line.";
    if(!G.lost) say(why+" "+lv(G.lives)+" left. Back to where the line began.");
  }
  else if(e.t==="won"){
    mode="won"; var li=G.li;
    if(G.lives>save.best[li]) save.best[li]=G.lives; persist(); refreshChips(); hudUpdate();
    var all=li===NL-1&&save.best.every(function(s){ return s>0; });
    say((all?"All "+NL+" levels clear. ":"Level "+(li+1)+" clear. ")+G.L.name+", live, from template to the real thing. "+lv(G.lives)+" left.");
    setTimeout(showAfter,calm()?0:700);
  }
  else if(e.t==="lost"){
    mode="lost"; hudUpdate();
    var where=pctNow();
    say("Out of lives. "+where+" percent claimed, you needed "+goalPct()+". Press R to retry.");
    setTimeout(function(){ if(mode==="lost") panel("Out of lives",where+"% claimed, "+goalPct()+"% needed. Same template, fresh lives.",[{label:"Retry",go:retry}],true); },calm()?0:600);
  }
}

/* ---------- the loop ---------- */
function burst(x,y,c,n){ for(var i=0;i<(n||8)&&parts.length<120;i++){ var a=Math.random()*6.28, sp=40+Math.random()*120;
  parts.push({x:x*cw,y:y*ch,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.45+Math.random()*.35,t:0,c:c,s:2+Math.random()*3}); } }
function fx(dt){
  shake=Math.max(0,shake-dt*.8); if(flashT>0) flashT=Math.max(0,flashT-dt);
  for(var i=parts.length-1;i>=0;i--){ var p=parts[i]; p.t+=dt; if(p.t>p.life){ parts.splice(i,1); continue; } p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=140*dt; }
  for(i=pops.length-1;i>=0;i--){ pops[i].t+=dt; if(pops[i].t>1) pops.splice(i,1); }
}
function stepOnce(dt){
  if(pulse.t>0) pulse.t-=dt;
  EV.length=0; step(G,curDir(),dt,EV);
  for(var i=0;i<EV.length;i++) handle(EV[i]);
}
function idleBoss(dt){ if(G&&!G.won) moveBoss(G,dt); }
function busy(){ return mode==="play"||(mode==="ready"&&!calm())||parts.length>0||pops.length>0||shake>0||flashT>0; }
function frame(now){
  raf=0; if(!vis||document.hidden||!G) return;
  if(!last) last=now; var dt=Math.min(.05,(now-last)/1000); last=now; if(peekT>0) peekT=Math.max(0,peekT-dt);
  if(mode==="play"){ acc+=dt; var n=0; while(acc>=DT&&n<12){ stepOnce(DT); acc-=DT; n++; if(mode!=="play") break; } if(n===12) acc=0; }
  else if(mode==="ready"&&!calm()){ idleBoss(dt); }
  fx(dt); hudUpdate(); draw();
  if(busy()) raf=window.requestAnimationFrame(frame);
}
function wake(){
  if(!vis||document.hidden||!G){ return; }
  if(!W&&!fit()) return;
  if(!raf){ last=0; acc=0; raf=window.requestAnimationFrame(frame); }
}
function stopLoop(){ if(raf){ window.cancelAnimationFrame(raf); raf=0; } }
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else stopLoop(); },{threshold:0}).observe(stage);
document.addEventListener("visibilitychange",function(){ if(document.hidden) stopLoop(); else wake(); });
if(window.ResizeObserver) new ResizeObserver(function(){ if(fit()) wake(); }).observe(view); else window.addEventListener("resize",function(){ if(fit()) wake(); });
new MutationObserver(function(){ pal=null; tplDirty=true; revDirty=true; if(vis) draw(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
if(mq.addEventListener) mq.addEventListener("change",function(){ if(vis) wake(); });

function fit(){
  var w=view.clientWidth, h=view.clientHeight; if(!w||!h) return false;
  dprv=Math.min(window.devicePixelRatio||1,2);
  var pw=Math.round(w*dprv), ph=Math.round(h*dprv);
  if(cv.width!==pw||cv.height!==ph){ cv.width=pw; cv.height=ph; tpl.width=rev.width=fl.width=pw; tpl.height=rev.height=fl.height=ph; tplDirty=revDirty=true; if(G) paintFlashAll(); }
  W=w; H=h; cw=w/COLS; ch=h/ROWS;
  if(G) draw(); return true;
}

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement);
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  return {bg:v("--paper-3","#E9EDF7"),card:v("--paper-2","#FFFFFF"),ink:v("--ink","#1F2023"),or:v("--blue","#B94612"),or2:v("--blue-2","#EA5E14"),
    line:v("--line","rgba(31,32,35,.12)"),line2:v("--line-2","rgba(31,32,35,.22)"),muted:v("--muted","#5D5F65"),faint:v("--faint","#6C6E74"),wash:v("--wash-peach","#FFE3D2")};
}
function imgFor(){
  var L=G.L, big=cv.width>800, key=L.img+(big?"-1500":"-750"), alt=L.img+(big?"-750":"-1500");
  function load(k){ if(!imgs[k]){ var im=new Image(); imgs[k]=im; im.onload=function(){ revDirty=true; if(vis) draw(); }; im.src="/assets/shots/webp/"+k+".webp"; } return imgs[k]; }
  var a=load(key); if(a.complete&&a.naturalWidth) return a;
  var b=imgs[alt]; return b&&b.complete&&b.naturalWidth?b:null;
}
function buildTemplate(){
  var P=pal, c=tctx, w=W, h=H, i;
  c.setTransform(dprv,0,0,dprv,0,0); c.clearRect(0,0,w,h);
  c.fillStyle=P.bg; c.fillRect(0,0,w,h);
  c.strokeStyle=P.line; c.lineWidth=1; c.beginPath();
  for(i=4;i<COLS;i+=4){ c.moveTo(Math.round(i*cw)+.5,0); c.lineTo(Math.round(i*cw)+.5,h); }
  for(i=4;i<ROWS;i+=4){ c.moveTo(0,Math.round(i*ch)+.5); c.lineTo(w,Math.round(i*ch)+.5); }
  c.stroke();
  function box(x,y,bw,bh,fill){ c.fillStyle=fill||P.card; c.fillRect(x*w,y*h,bw*w,bh*h); c.strokeStyle=P.line2; c.lineWidth=1; c.strokeRect(Math.round(x*w)+.5,Math.round(y*h)+.5,bw*w,bh*h); }
  function bar(x,y,bw,bh){ c.fillStyle=P.line2; c.fillRect(x*w,y*h,bw*w,Math.max(2,bh*h)); }
  function cross(x,y,bw,bh){ c.strokeStyle=P.line2; c.lineWidth=1; c.beginPath(); c.moveTo(x*w,y*h); c.lineTo((x+bw)*w,(y+bh)*h); c.moveTo((x+bw)*w,y*h); c.lineTo(x*w,(y+bh)*h); c.stroke(); }
  var fs=Math.max(8,Math.min(13,w*.016));
  function label(s,x,y,al){ c.fillStyle=P.faint; c.font="500 "+fs+"px 'JetBrains Mono',monospace"; c.textAlign=al||"center"; c.textBaseline="middle"; c.fillText(s,x*w,y*h); }
  box(.03,.05,.94,.09); box(.045,.065,.07,.06,P.bg); label("LOGO",.08,.095);
  bar(.62,.088,.07,.014); bar(.72,.088,.07,.014); bar(.82,.088,.07,.014);
  box(.03,.18,.94,.38); cross(.03,.18,.94,.38); box(.34,.32,.32,.1); label("HERO IMAGE HERE",.5,.37);
  bar(.03,.61,.34,.035); bar(.03,.68,.58,.014); bar(.03,.71,.5,.014);
  for(i=0;i<3;i++){ var x=.03+i*.325; box(x,.76,.29,.2); box(x+.012,.775,.266,.09,P.bg); cross(x+.012,.775,.266,.09); bar(x+.012,.9,.18,.012); bar(x+.012,.925,.12,.012); }
  label("LOREM IPSUM DOLOR SIT AMET",.97,.645,"right");
  tplDirty=false;
}
function paintFlashAll(){ fctx.setTransform(1,0,0,1,0,0); fctx.clearRect(0,0,fl.width,fl.height); }
function paintFlash(cells){
  fctx.setTransform(dprv,0,0,dprv,0,0); fctx.clearRect(0,0,W,H); fctx.fillStyle="#FFFFFF";
  for(var i=0;i<cells.length;i++){ var c=cells[i], x=c%COLS, y=(c-x)/COLS; fctx.fillRect(x*cw-.3,y*ch-.3,cw+.6,ch+.6); }
}
function buildReveal(){
  var P=pal, c=rctx, x, y, s, grid=G.grid;
  c.setTransform(dprv,0,0,dprv,0,0); c.clearRect(0,0,W,H);
  c.save(); c.beginPath();
  for(y=0;y<ROWS;y++){ x=0; while(x<COLS){ if(grid[y*COLS+x]===1){ s=x; while(x<COLS&&grid[y*COLS+x]===1) x++; c.rect(s*cw-.3,y*ch-.3,(x-s)*cw+.6,ch+.6); } else x++; } }
  c.clip();
  var im=imgFor();
  if(im) c.drawImage(im,0,0,im.naturalWidth,im.naturalHeight*(G.L.crop||1),0,0,W,H); else { c.fillStyle=P.wash; c.fillRect(0,0,W,H); }
  c.restore();
  /* the wall: a line between claimed ground and open ground, light under dark so it reads on any picture */
  c.beginPath();
  for(y=0;y<ROWS;y++) for(x=0;x<COLS;x++){ if(grid[y*COLS+x]!==1) continue;
    if(x+1<COLS&&grid[y*COLS+x+1]!==1){ c.moveTo((x+1)*cw,y*ch); c.lineTo((x+1)*cw,(y+1)*ch); }
    if(x>0&&grid[y*COLS+x-1]!==1){ c.moveTo(x*cw,y*ch); c.lineTo(x*cw,(y+1)*ch); }
    if(y+1<ROWS&&grid[(y+1)*COLS+x]!==1){ c.moveTo(x*cw,(y+1)*ch); c.lineTo((x+1)*cw,(y+1)*ch); }
    if(y>0&&grid[(y-1)*COLS+x]!==1){ c.moveTo(x*cw,y*ch); c.lineTo((x+1)*cw,y*ch); } }
  c.lineCap="butt"; c.strokeStyle="rgba(255,255,255,.9)"; c.lineWidth=4; c.stroke(); c.strokeStyle="#1F2023"; c.lineWidth=2; c.stroke();
  revDirty=false;
}
function drawBoss(t){
  var bw=Math.max(cw*3.2,22), bh=bw*.72, x=G.bx*cw, y=G.by*ch, tilt=calm()?0:Math.sin(t*3.2)*.07;
  var lw=Math.max(1.5,bw*.06);
  ctx.save(); ctx.translate(x,y); ctx.rotate(tilt); ctx.lineJoin="round"; ctx.lineWidth=lw; ctx.strokeStyle="#1F2023";
  ctx.shadowColor="rgba(31,32,35,.35)"; ctx.shadowBlur=calm()?0:6; ctx.shadowOffsetY=2;
  ctx.fillStyle="#FFFFFF"; ctx.fillRect(-bw/2,-bh/2,bw,bh); ctx.shadowColor="transparent"; ctx.strokeRect(-bw/2,-bh/2,bw,bh);
  ctx.fillStyle="#B94612"; ctx.fillRect(-bw/2,-bh/2,bw,bh*.24); ctx.strokeRect(-bw/2,-bh/2,bw,bh*.24);
  ctx.fillStyle="#FFFFFF"; for(var d=0;d<3;d++){ ctx.beginPath(); ctx.arc(-bw/2+bw*.1+d*bw*.085,-bh/2+bh*.12,Math.max(1,bh*.04),0,6.28); ctx.fill(); }
  var ex=bw*.2, ey=bh*.06, e=bh*.08; ctx.strokeStyle="#1F2023"; ctx.lineWidth=Math.max(1.2,lw*.8); ctx.beginPath();
  [-ex,ex].forEach(function(cx){ ctx.moveTo(cx-e,ey-e); ctx.lineTo(cx+e,ey+e); ctx.moveTo(cx+e,ey-e); ctx.lineTo(cx-e,ey+e); });
  ctx.moveTo(-bw*.12,bh*.3); ctx.lineTo(bw*.12,bh*.3); ctx.stroke();
  ctx.restore();
}
function draw(){
  if(!G||!W) return;
  if(!pal) pal=palette();
  if(tplDirty) buildTemplate();
  if(revDirty) buildReveal();
  var P=pal, i, sh=shake>0&&!calm()?shake:0;
  ctx.setTransform(dprv,0,0,dprv,0,0); ctx.clearRect(0,0,W,H);
  ctx.save(); if(sh) ctx.translate((Math.random()-.5)*sh*14,(Math.random()-.5)*sh*14);
  ctx.drawImage(tpl,0,0,W,H); ctx.drawImage(rev,0,0,W,H);
  /* the peek: before a level starts the whole site shows, so you know what is under the template; it fades under once you start */
  var pim=(mode==="ready"||peekT>0)?imgFor():null;
  if(pim){ ctx.globalAlpha=mode==="ready"?1:Math.min(1,peekT/PEEK); ctx.drawImage(pim,0,0,pim.naturalWidth,pim.naturalHeight*(G.L.crop||1),0,0,W,H); ctx.globalAlpha=1; }
  if(flashT>0&&!calm()){ ctx.globalAlpha=flashT/.45*.7; ctx.drawImage(fl,0,0,W,H); ctx.globalAlpha=1; }
  /* the unfinished line */
  ctx.fillStyle=P.or2;
  for(i=0;i<G.trail.length;i++){ var c=G.trail[i], x=c%COLS, y=(c-x)/COLS; ctx.fillRect(x*cw,y*ch,cw+.4,ch+.4); }
  ctx.strokeStyle="#1F2023"; ctx.lineWidth=1;
  /* sparks */
  for(i=0;i<G.sparks.length;i++){ var sp=sparkPos(G.sparks[i]), r=Math.max(cw*.95,6), sx=sp.x*cw, sy=sp.y*ch;
    ctx.save(); ctx.translate(sx,sy); ctx.rotate(calm()?.785:G.t*4+i); ctx.fillStyle="#1F2023"; ctx.strokeStyle="#FFFFFF"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.rect(-r*.7,-r*.7,r*1.4,r*1.4); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#EA5E14"; ctx.beginPath(); ctx.arc(0,0,r*.28,0,6.28); ctx.fill(); ctx.restore(); }
  drawBoss(G.t+(mode==="ready"?performance.now()/1000:0));
  /* the player: a graphite square with an orange ring; it blinks while it is safe after a hit */
  var blink=!calm()&&mode==="play"&&(G.hurt>0||G.safe>0)&&Math.floor(performance.now()/90)%2===0;
  if(!blink){ var ps=Math.max(cw*1.9,12), px=(G.px+.5)*cw, py=(G.py+.5)*ch;
    ctx.fillStyle="#FFFFFF"; ctx.fillRect(px-ps/2-2,py-ps/2-2,ps+4,ps+4);
    ctx.fillStyle="#1F2023"; ctx.fillRect(px-ps/2,py-ps/2,ps,ps);
    ctx.strokeStyle=P.or2; ctx.lineWidth=2; ctx.strokeRect(px-ps/2+1,py-ps/2+1,ps-2,ps-2); }
  for(i=0;i<parts.length;i++){ var q=parts[i]; ctx.globalAlpha=Math.max(0,1-q.t/q.life); ctx.fillStyle=q.c; ctx.fillRect(q.x-q.s/2,q.y-q.s/2,q.s,q.s); }
  ctx.globalAlpha=1;
  for(i=0;i<pops.length;i++){ var o=pops[i]; ctx.globalAlpha=Math.max(0,1-o.t); ctx.font="600 "+Math.max(13,Math.round(cw*2.4))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.lineWidth=4; ctx.strokeStyle="#FFFFFF"; ctx.strokeText(o.s,o.x,o.y-o.t*ch*4); ctx.fillStyle="#1F2023"; ctx.fillText(o.s,o.x,o.y-o.t*ch*4); }
  ctx.globalAlpha=1; ctx.restore();
}

/* ---------- boot ---------- */
var start=0; for(var si=0;si<NL;si++){ if(unlocked(si)&&save.best[si]===0){ start=si; break; } }
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ tplDirty=true; if(vis&&W) draw(); },function(){});
loadLevel(start,false);
say("Reveal 13. "+NL+" levels, "+NL+" real K13 sites. Level "+(start+1)+" is up: claim "+goalPct()+" percent. Press an arrow key to start.");
})();
