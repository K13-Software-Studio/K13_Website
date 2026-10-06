/* K13 The Hardest Ship: a maze-dodging game in thirteen levels, built on the workbench card anatomy.
   You are the small orange square. Get from I wish to It works, pick up every requirement on the way, never touch a bug.
   Bugs keep a fixed rhythm, so every level can be read and beaten, and every death is counted.
   Each level is proven beatable by scripts/hardest13-solve.js, which runs this same core in Node and searches for a route.
   The loop is a fixed 120 Hz step behind an accumulator and draws to a devicePixelRatio-crisp canvas. The clock stops when the
   board loses focus, the card leaves the screen or the tab is hidden, so nobody dies while looking away.
   prefers-reduced-motion: no idle bug motion before you start, no rings, no pulses, no panel rise. The game itself still plays.
   Keyboard (board focused): arrows or WASD move, R restarts the level, N goes to the next unlocked level, Esc pauses.
   Touch: drag anywhere on the board and the square follows the direction of the drag, like a joystick.
   The core (levels, collisions, rules) sits between the CORE markers and touches no DOM. */
(function(){
"use strict";

/* ===================================================== CORE-BEGIN ===================================================== */
var COLS=20, ROWS=11, SPEED=3.5, PH=.31, HIT=.27, ER=.2, CR=.22, DEAD_T=.5, TAU=Math.PI*2;

/* bug builders. A path bug runs a polyline (closed: loops, open: there and back) once per T seconds, starting at phase o.
   An orbit bug circles (cx,cy) at radius r once per T seconds (negative T turns the other way), starting at angle a turns. */
function path(pts,T,o,closed){ return {k:"p",pts:pts,T:T,o:o||0,closed:!!closed}; }
function orb(cx,cy,r,T,a){ return {k:"o",cx:cx,cy:cy,r:r,T:T,a:a||0}; }
function cols(xs,y0,y1,T,alt,o){ return xs.map(function(x,i){ return path([[x,y0],[x,y1]],T,(o||0)+(alt&&i%2?.5:0)); }); }
function rows(ys,x0,x1,T,alt,o){ return ys.map(function(y,i){ return path([[x0,y],[x1,y]],T,(o||0)+(alt&&i%2?.5:0)); }); }
function arms(cx,cy,n,step,T,k,a){ var out=[orb(cx,cy,0,T,0)]; for(var j=0;j<k;j++) for(var i=1;i<=n;i++) out.push(orb(cx,cy,i*step,T,(a||0)+j/k)); return out; }
function ring(cx,cy,r,n,T,a){ var out=[]; for(var i=0;i<n;i++) out.push(orb(cx,cy,r,T,(a||0)+i/n)); return out; }
function train(pts,n,T,o){ var out=[]; for(var i=0;i<n;i++) out.push(path(pts,T,(o||0)+i/n,true)); return out; }
function around(c,r,n,T,o){ var d=.32; return train([[c-d,r-d],[c+1+d,r-d],[c+1+d,r+1+d],[c-d,r+1+d]],n,T,o); }
function cat(){ return [].concat.apply([],arguments); }

/* the map: # wall, . floor, S I wish (start), E It works (finish), C saved (checkpoint), o a requirement on a floor tile */
var LEVELS=[
  {name:"Kickoff",tip:"Bugs keep their rhythm. Watch one pass, then go.",map:[
    "####################",
    "####################",
    "#####..........#####",
    "#SS..............EE#",
    "#SS..............EE#",
    "#SS..............EE#",
    "#SS..............EE#",
    "#SS..............EE#",
    "#####..........#####",
    "####################",
    "####################"],
   en:cols([6,8,10,12,14],2.3,8.7,3.2,true)},

  {name:"Requirements",tip:"Collect every requirement before you finish. No exceptions.",map:[
    "####################",
    "####################",
    "####o..........o####",
    "###..............###",
    "#SS..............EE#",
    "#SS..............EE#",
    "#SS..............EE#",
    "###..............###",
    "####o..........o####",
    "####################",
    "####################"],
   en:rows([3.5,4.5,5.5,6.5,7.5],3.3,16.7,4.6,true)},

  {name:"Scope creep",tip:"It only ever grows. Ride around it, not through it.",map:[
    "####################",
    "####............####",
    "####............####",
    "####............####",
    "#SS..............EE#",
    "#SS..............EE#",
    "#SS..............EE#",
    "####............####",
    "####............####",
    "####............####",
    "####################"],
   coins:[[10,1.5],[10,9.5]],
   en:arms(10,5.5,4,1,6.5,4)},

  {name:"Standup",tip:"Everyone goes round once. Go with the flow.",map:[
    "####################",
    "###..............###",
    "###..............###",
    "###..##########..###",
    "#SS..##########..EE#",
    "#SS..##########..EE#",
    "#SS..##########..EE#",
    "###..##########..###",
    "###..............###",
    "###..............###",
    "####################"],
   coins:[[10,1.5],[10,9.5]],
   en:cat(train([[3.5,1.5],[16.5,1.5],[16.5,9.5],[3.5,9.5]],5,12),
          train([[4.5,2.5],[15.5,2.5],[15.5,8.5],[4.5,8.5]],5,12))},

  {name:"Feedback loop",tip:"Three rounds of it. The C tiles save your progress.",map:[
    "####################",
    "#SS..............###",
    "#SS..............###",
    "###############CC###",
    "##...............###",
    "##...............###",
    "##CC################",
    "##...............EE#",
    "##...............EE#",
    "####################",
    "####################"],
   coins:[[9,7.5],[13,8.5]],
   en:cat(cols([5,7,9,11,13],1.25,2.75,1.4,true),
          rows([4.5],2.5,16.5,4),rows([5.5],2.5,16.5,4,false,.5),
          rows([4.5],2.5,16.5,3,false,.25),
          orb(7,8,.75,1.8),orb(11,8,.75,-1.8),orb(15,8,.75,1.8))},

  {name:"Crunch",tip:"Everything moves at once. Find the beat between them.",map:[
    "####################",
    "####################",
    "###..............###",
    "###..............###",
    "#SS..............EE#",
    "#SS..............EE#",
    "#SS..............EE#",
    "###..............###",
    "###..............###",
    "####################",
    "####################"],
   coins:[[6,6.5],[10,4.5],[14,6.5]],
   en:(function(){ var o=[]; [5,7,9,11,13,15].forEach(function(x){ [3.5,5.5,7.5].forEach(function(y){ o.push(orb(x,y,.85,2.2)); }); }); return o; })()},

  {name:"Code review",tip:"Two reviewers, turning opposite ways. The gap between them is yours.",map:[
    "####################",
    "###..............###",
    "###..............###",
    "###..............###",
    "#SS..............EE#",
    "#SS..............EE#",
    "#SS..............EE#",
    "###..............###",
    "###..............###",
    "###..............###",
    "####################"],
   coins:[[10,5.5],[7,3],[13,8]],
   en:cat(arms(7,5.5,4,.8,4.6,2),arms(13,5.5,4,.8,-4.6,2,.25))},

  {name:"Merge conflict",tip:"Two streams cross. Wait for the gap in both.",map:[
    "####################",
    "###..............###",
    "###..............###",
    "###..............###",
    "#SS..............EE#",
    "#SS..............EE#",
    "#SS..............EE#",
    "###..............###",
    "###..............###",
    "###..............###",
    "####################"],
   coins:[[8,1.6],[12,9.4]],
   en:cat(cols([5.5,8.5,11.5,14.5],1.3,9.7,3,true),rows([3.5,5.5,7.5],3.3,16.7,4,true))},

  {name:"Hotfix",tip:"Narrow halls. Duck into a doorway and let it pass.",map:[
    "####################",
    "#####.#.#.#.#.#.####",
    "#SS..............C##",
    "####.#.#.#.#.#.##C##",
    "#################C##",
    "##C..............C##",
    "##C##.#.#.#.#.#.####",
    "##C#################",
    "##C..............EE#",
    "####.#.#.#.#.#.#####",
    "####################"],
   coins:[[9.5,1.5],[8.5,9.5]],
   en:cat(rows([2.5],3.5,16.5,3.4),rows([5.5],3.5,16.5,3.8),rows([5.5],3.5,16.5,2.8,false,.5),
          rows([8.5],3.5,16.5,3.6),rows([8.5],3.5,16.5,2.6,false,.4))},

  {name:"Deadline",tip:"Rings close in on the one thing that matters. Get it and get out.",map:[
    "####################",
    "####............####",
    "####............####",
    "####............####",
    "#SS..............EE#",
    "#SS..............EE#",
    "#SS..............EE#",
    "####............####",
    "####............####",
    "####............####",
    "####################"],
   coins:[[10,5.5]],
   en:cat(ring(10,5.5,1.6,7,-4),ring(10,5.5,3,12,6.5),ring(10,5.5,4.4,16,-10))},

  {name:"Pixel push",tip:"Every pillar has someone circling it. Slip between the laps.",map:[
    "####################",
    "####################",
    "###..............###",
    "###..#...#...#...###",
    "#SS..............EE#",
    "#SS....#...#.....EE#",
    "#SS..............EE#",
    "###..#...#...#...###",
    "###..............###",
    "####################",
    "####################"],
   coins:[[7.5,3.5],[9.5,5.5],[12.5,7.5]],
   en:cat(around(5,3,2,2.2),around(9,3,2,-2.2),around(13,3,2,2.2),
          around(7,5,2,2.2,.25),around(11,5,2,-2.2,.25),
          around(5,7,2,-2.2),around(9,7,2,2.2),around(13,7,2,-2.2))},

  {name:"Launch window",tip:"Three rooms, three problems. Each doorway saves you.",map:[
    "####################",
    "#......##....##....#",
    "#......##....##....#",
    "#......##....##....#",
    "#SS....CC....CC..EE#",
    "#SS....CC....CC..EE#",
    "#SS....CC....CC..EE#",
    "#......##....##....#",
    "#......##....##....#",
    "#......##....##....#",
    "####################"],
   coins:[[1.5,1.5],[1.5,9.5],[10.5,1.5],[11.5,9.5],[18.5,1.5],[18.5,9.5]],
   en:cat(rows([2.5,8.5],1.3,6.7,2.3,true),cols([4.5],1.3,9.7,2.4),
          arms(11,5.5,3,1.05,4.8,2),
          rows([2.5,8.5],15.3,18.7,2,true),rows([3.5,7.5],15.3,18.7,2,true,.25))},

  {name:"It works",tip:"The finish is in the middle, inside everything. Ship it.",map:[
    "####################",
    "#o................o#",
    "#..................#",
    "#..................#",
    "#SS................#",
    "#SS......EE........#",
    "#SS................#",
    "#..................#",
    "#..................#",
    "#o................o#",
    "####################"],
   en:cat(ring(10,5.5,2,9,4.6),ring(10,5.5,3.4,12,-7),
          cols([4],1.3,9.7,2.3),cols([16],1.3,9.7,2.3,false,.5),
          rows([2.5,8.5],4.5,15.5,3.8,true))}
];

function prep(e){
  if(e.k!=="p") return e;
  var p=e.pts.slice(), L=[0], i; if(e.closed) p.push(p[0]);
  for(i=1;i<p.length;i++) L.push(L[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));
  e.P=p; e.L=L; e.len=L[L.length-1]; return e;
}
function epos(e,t,out){
  if(e.k==="o"){ var a=TAU*(e.a+t/e.T); out.x=e.cx+e.r*Math.cos(a); out.y=e.cy+e.r*Math.sin(a); return out; }
  var u=t/e.T+e.o; u-=Math.floor(u); if(!e.closed) u=u<.5?u*2:2-u*2;
  var d=u*e.len, P=e.P, L=e.L, i=1; while(i<L.length-1&&L[i]<d) i++;
  var s=L[i]-L[i-1], f=s>0?(d-L[i-1])/s:0;
  out.x=P[i-1][0]+(P[i][0]-P[i-1][0])*f; out.y=P[i-1][1]+(P[i][1]-P[i-1][1])*f; return out;
}
var CODE={"#":0,".":1,"o":1,"S":2,"E":3,"C":4};
function parse(lv){
  var g=new Uint8Array(COLS*ROWS), cid=new Int16Array(COLS*ROWS).fill(-1), coins=[], sx=0, sy=0, sn=0, r, c;
  for(r=0;r<ROWS;r++) for(c=0;c<COLS;c++){
    var ch=lv.map[r].charAt(c); g[r*COLS+c]=CODE[ch]||0;
    if(ch==="o") coins.push({x:c+.5,y:r+.5});
    if(ch==="S"){ sx+=c+.5; sy+=r+.5; sn++; }
  }
  (lv.coins||[]).forEach(function(p){ coins.push({x:p[0],y:p[1]}); });
  /* checkpoints: each connected run of C tiles is one save point, respawning at its middle */
  var cps=[];
  for(r=0;r<ROWS;r++) for(c=0;c<COLS;c++){
    if(g[r*COLS+c]!==4||cid[r*COLS+c]>=0) continue;
    var id=cps.length, st=[[c,r]], ax=0, ay=0, n=0; cid[r*COLS+c]=id;
    while(st.length){ var q=st.pop(); ax+=q[0]+.5; ay+=q[1]+.5; n++;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){ var x=q[0]+d[0], y=q[1]+d[1];
        if(x>=0&&y>=0&&x<COLS&&y<ROWS&&g[y*COLS+x]===4&&cid[y*COLS+x]<0){ cid[y*COLS+x]=id; st.push([x,y]); } }); }
    cps.push({x:ax/n,y:ay/n});
  }
  return {name:lv.name,tip:lv.tip,g:g,cid:cid,cps:cps,coins:coins,sx:sx/sn,sy:sy/sn,en:lv.en.map(prep)};
}
function tile(L,c,r){ return c<0||r<0||c>=COLS||r>=ROWS?0:L.g[r*COLS+c]; }
function blocked(L,x,y){
  var c0=Math.floor(x-PH), c1=Math.floor(x+PH-1e-7), r0=Math.floor(y-PH), r1=Math.floor(y+PH-1e-7), r, c;
  for(r=r0;r<=r1;r++) for(c=c0;c<=c1;c++) if(!tile(L,c,r)) return true;
  return false;
}
/* circle against the player's box: the box is a touch smaller than drawn, so a graze you can see is a graze you survive */
function boxCircle(x,y,h,px,py,r){ var dx=Math.max(Math.abs(px-x)-h,0), dy=Math.max(Math.abs(py-y)-h,0); return dx*dx+dy*dy<r*r; }
var TMP={x:0,y:0};
function hitAt(L,x,y,t,m){
  for(var i=0;i<L.en.length;i++){ epos(L.en[i],t,TMP); if(boxCircle(x,y,HIT,TMP.x,TMP.y,ER+(m||0))) return true; }
  return false;
}
function newGame(li){
  var L=parse(LEVELS[li]);
  return {li:li,L:L,t:0,x:L.sx,y:L.sy,rx:L.sx,ry:L.sy,got:L.coins.map(function(){ return 0; }),deaths:0,dead:0,won:false,cp:-1};
}
function haveAll(G){ for(var i=0;i<G.got.length;i++) if(!G.got[i]) return false; return true; }
function move(G,dx,dy){
  if(!dx&&!dy) return;
  var L=G.L, nx=G.x+dx, ny=G.y+dy;
  if(!blocked(L,nx,ny)){ G.x=nx; G.y=ny; return; }
  if(dx>0) nx=Math.floor(nx+PH)-PH-1e-6; else if(dx<0) nx=Math.floor(nx-PH)+1+PH+1e-6;
  if(dy>0) ny=Math.floor(ny+PH)-PH-1e-6; else if(dy<0) ny=Math.floor(ny-PH)+1+PH+1e-6;
  if(!blocked(L,nx,ny)){ G.x=nx; G.y=ny; }
}
/* one fixed step. ix, iy are -1, 0 or 1. Events land in ev: coin, save, die, spawn, win */
function tick(G,ix,iy,dt,ev){
  G.t+=dt;
  if(G.won) return;
  if(G.dead>0){ G.dead-=dt; if(G.dead<=0){ G.dead=0; G.x=G.rx; G.y=G.ry; ev.push("spawn"); } return; }
  move(G,ix*SPEED*dt,0); move(G,0,iy*SPEED*dt);
  var L=G.L, i;
  for(i=0;i<L.coins.length;i++) if(!G.got[i]&&boxCircle(G.x,G.y,PH,L.coins[i].x,L.coins[i].y,CR)){ G.got[i]=1; ev.push("coin"); }
  var c=Math.floor(G.x), r=Math.floor(G.y), z=tile(L,c,r);
  if(z===4){ var id=L.cid[r*COLS+c]; if(id!==G.cp){ G.cp=id; G.rx=L.cps[id].x; G.ry=L.cps[id].y; for(i=0;i<G.got.length;i++) if(G.got[i]) G.got[i]=2; ev.push("save"); } }
  if(z===3&&haveAll(G)){ G.won=true; ev.push("win"); return; }
  if(hitAt(L,G.x,G.y,G.t,0)){ G.deaths++; G.dead=DEAD_T; for(i=0;i<G.got.length;i++) if(G.got[i]===1) G.got[i]=0; ev.push("die"); }
}
var CORE={COLS:COLS,ROWS:ROWS,SPEED:SPEED,PH:PH,HIT:HIT,ER:ER,CR:CR,LEVELS:LEVELS,parse:parse,tile:tile,blocked:blocked,hitAt:hitAt,boxCircle:boxCircle,epos:epos,newGame:newGame,tick:tick};
/* ====================================================== CORE-END ====================================================== */
if(typeof document==="undefined"){ if(typeof module!=="undefined") module.exports=CORE; return; }

var mount=document.querySelector('[data-game="hardest13"]');
if(!mount) return;
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
var N=LEVELS.length;

/* card chrome: the same DOM and classes as card() in workbench.js (head, instruction, stage, reset, status, footnote) */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","The Hardest Ship")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Get from I wish to It works. Pick up every requirement on the way. Touch a bug and you start over."); instr.id="h13-i"; mount.appendChild(instr);
var stage=el("div","wb-stage h13-stage"); stage.setAttribute("aria-describedby","h13-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Restart this level"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Arrows or WASD move, R restarts, N is the next level, Esc pauses. On a phone, drag anywhere on the board to steer. Progress and every death are kept on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var top=el("div","h13-top");
var hLevel=txt("span","h13-chip",""), hDeaths=txt("span","h13-chip h13-deaths",""), hReq=txt("span","h13-chip","");
top.appendChild(hLevel); top.appendChild(hReq); top.appendChild(hDeaths); stage.appendChild(top);
var view=el("div","h13-view"); stage.appendChild(view);
var cv=el("canvas","h13-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","The Hardest Ship game board. Arrow keys or WASD move the square. Drag on a touch screen.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var over=el("div","h13-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Level"); view.appendChild(over);
var bar=el("div","h13-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Levels"); stage.appendChild(bar);
bar.appendChild(txt("span","h13-lab","Level"));
var lvBtns=LEVELS.map(function(lv,i){
  var b=txt("button","h13-lv",String(i+1)); b.type="button";
  b.addEventListener("click",function(){ if(!b.disabled){ loadLevel(i); focusBoard(); } });
  bar.appendChild(b); return b;
});

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store("k13_hardest13")||"null"); if(s&&s.best&&s.best.length===N&&typeof s.deaths==="number") return s; }catch(e){} return {best:LEVELS.map(function(){ return -1; }),deaths:0}; })();
function persist(){ store("k13_hardest13",JSON.stringify(save)); }
var G=null, mode="ready", keys={}, stick=null, W=0, H=0, ppu=30, ox=0, oy=0, dprv=1, vis=false, raf=0, acc=0, last=0, pal=null;
var fx=[], winGlow=0, sig="";

function unlocked(i){ return i===0||save.best[i-1]>=0; }
function refreshLevels(){
  lvBtns.forEach(function(b,i){
    var ok=unlocked(i), s=save.best[i];
    b.disabled=!ok; b.classList.toggle("done",s>=0); b.setAttribute("aria-pressed",String(!!G&&G.li===i));
    b.setAttribute("aria-label","Level "+(i+1)+", "+LEVELS[i].name+(ok?(s>=0?", cleared with "+s+(s===1?" death":" deaths")+" at best":", not cleared yet"):", locked"));
  });
}
function hud(){
  if(!G) return;
  var got=0; G.got.forEach(function(v){ if(v) got++; });
  var s=[G.li,G.deaths,got].join("|"); if(s===sig) return; sig=s;
  hLevel.textContent=(G.li+1)+"/"+N+" "+G.L.name;
  hDeaths.textContent="Deaths "+(save.deaths);
  hReq.hidden=!G.got.length; hReq.textContent="Requirements "+got+"/"+G.got.length;
}
function panel(title,sub,buttons){
  over.innerHTML=""; var p=el("div","h13-panel");
  p.appendChild(txt("div","h13-over-t",title)); if(sub) p.appendChild(txt("p","h13-over-s",sub));
  var row=el("div","h13-over-row");
  buttons.forEach(function(b){ var x=txt("button","h13-obtn"+(b.ghost?" ghost":""),b.label); x.type="button"; x.addEventListener("click",b.go); row.appendChild(x); });
  p.appendChild(row); over.appendChild(p); over.hidden=false;
  return row.firstChild;
}
function loadLevel(i){
  G=newGame(i); mode="ready"; fx.length=0; winGlow=0; sig=""; keys={}; stick=null;
  panel("Level "+(i+1)+": "+G.L.name,G.L.tip,[{label:"Start",go:function(){ begin(); }}]);
  hud(); refreshLevels(); fit(); wake();
  say("Level "+(i+1)+" of "+N+", "+G.L.name+". "+G.L.tip+(G.got.length?" "+G.got.length+" requirements to collect.":""));
}
function begin(){ if(!G||G.won) return; over.hidden=true; mode="play"; focusBoard(); last=0; wake(); }
function pause(why){ if(mode!=="play") return; mode="paused"; keys={}; stick=null;
  panel("Paused",why||"The bugs wait for you.",[{label:"Continue",go:function(){ begin(); }}]); }
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function nextLevel(){ if(G&&G.li+1<N&&unlocked(G.li+1)){ loadLevel(G.li+1); focusBoard(); } }

function won(){
  mode="won"; var li=G.li, d=G.deaths;
  if(save.best[li]<0||d<save.best[li]) save.best[li]=d; persist(); refreshLevels();
  if(li+1<N){
    var b=panel("It works.","Level "+(li+1)+" shipped with "+d+(d===1?" death.":" deaths.")+" Next up: "+LEVELS[li+1].name+".",
      [{label:"Next level",go:function(){ loadLevel(li+1); begin(); }},{label:"Play again",ghost:true,go:function(){ loadLevel(li); begin(); }}]);
    say("Level "+(li+1)+" cleared with "+d+(d===1?" death.":" deaths.")+" Press N or the button for "+LEVELS[li+1].name+".");
    setTimeout(function(){ try{ b.focus({preventScroll:true}); }catch(x){} },30);
  } else {
    panel("All 13 shipped.","From I wish to it works, the hard way. "+save.deaths+(save.deaths===1?" death":" deaths")+" along the road.",
      [{label:"Play level 1 again",go:function(){ loadLevel(0); begin(); }}]);
    say("All thirteen levels cleared. "+save.deaths+" deaths in total.");
  }
}

/* ---------- input ---------- */
var KEYS={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],a:[-1,0],d:[1,0],w:[0,-1],s:[0,1],A:[-1,0],D:[1,0],W:[0,-1],S:[0,1]};
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(KEYS[e.key]){ e.preventDefault(); keys[e.key.toLowerCase()]=1; if(mode==="ready"||mode==="paused") begin(); }
  else if(e.key===" "||e.key==="Enter"){ if(mode!=="play"&&mode!=="won"){ e.preventDefault(); begin(); } }
  else if(e.key==="Escape"){ if(mode==="play"){ e.preventDefault(); pause(); } }
});
cv.addEventListener("keyup",function(e){ if(KEYS[e.key]) keys[e.key.toLowerCase()]=0; });
mount.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key==="r"||e.key==="R"){ e.preventDefault(); restart(); }
  else if(e.key==="n"||e.key==="N"){ e.preventDefault(); nextLevel(); }
});
cv.addEventListener("blur",function(){ if(mode==="play") pause("You clicked away, so the clock stopped."); keys={}; });
function axis(){
  var ix=0, iy=0;
  if(keys.arrowleft||keys.a) ix-=1; if(keys.arrowright||keys.d) ix+=1;
  if(keys.arrowup||keys.w) iy-=1; if(keys.arrowdown||keys.s) iy+=1;
  if(stick&&stick.on){ var dx=stick.x-stick.x0, dy=stick.y-stick.y0, L=Math.hypot(dx,dy);
    if(L>10){ var a=Math.atan2(dy,dx), oct=Math.round(a/(Math.PI/4)); ix=Math.round(Math.cos(oct*Math.PI/4)); iy=Math.round(Math.sin(oct*Math.PI/4)); } }
  return [ix,iy];
}
cv.addEventListener("pointerdown",function(e){
  if(e.button>0) return; e.preventDefault(); focusBoard();
  if(mode==="ready"||mode==="paused") begin();
  if(mode!=="play") return;
  stick={on:true,id:e.pointerId,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY};
  try{ cv.setPointerCapture(e.pointerId); }catch(x){}
});
cv.addEventListener("pointermove",function(e){ if(stick&&stick.id===e.pointerId){ stick.x=e.clientX; stick.y=e.clientY; } });
function lift(e){ if(stick&&stick.id===e.pointerId) stick=null; }
cv.addEventListener("pointerup",lift); cv.addEventListener("pointercancel",lift);
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });
function restart(){ if(G){ loadLevel(G.li); begin(); } }
reset.addEventListener("click",restart);

/* ---------- loop ---------- */
var DT=1/120, EV=[];
function step(dt){
  var a=axis(); EV.length=0; tick(G,a[0],a[1],dt,EV);
  EV.forEach(function(k){
    if(k==="coin"){ var got=G.got.filter(Boolean).length; burst(G.x,G.y,"#F0B429");
      say(got===G.got.length?"Every requirement in. Now get to It works.":"Requirement "+got+" of "+G.got.length+".");
      if(got===G.got.length) winGlow=1; }
    else if(k==="save"){ burst(G.rx,G.ry,pal?pal.zone2:"#4F9E92"); say("Saved. You come back here if a bug gets you."); }
    else if(k==="die"){ save.deaths++; persist(); if(!G.got.every(Boolean)) winGlow=0; }
    else if(k==="spawn"){ burst(G.x,G.y,"#EA5E14"); }
    else if(k==="win"){ won(); }
  });
}
function burst(x,y,c){ if(!calm()) fx.push({x:x,y:y,c:c,t:0}); }
function frame(now){
  raf=0; if(!vis||!G) return;
  if(!last) last=now; var el2=Math.min(.1,(now-last)/1000); last=now;
  if(mode==="play"){ acc+=el2; while(acc>=DT){ step(DT); acc-=DT; if(mode!=="play"){ acc=0; break; } } }
  else if(mode==="ready"&&!calm()){ G.t+=el2*.6; }
  for(var i=fx.length-1;i>=0;i--){ fx[i].t+=el2; if(fx[i].t>.6) fx.splice(i,1); }
  if(winGlow>0&&!calm()) winGlow=Math.max(.35,winGlow-el2*.8);
  hud(); draw();
  if(vis&&(mode==="play"||(mode==="ready"&&!calm())||fx.length)) raf=requestAnimationFrame(frame);
}
function wake(){ if(!raf&&vis){ last=0; raf=requestAnimationFrame(frame); } if(!vis||calm()) draw(); }

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement), dark=document.documentElement.getAttribute("data-theme")==="dark";
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  return {wall:v("--paper-3","#E9EDF7"),hatch:v("--line","rgba(31,32,35,.12)"),f1:dark?"#26272B":"#FFFFFF",f2:dark?"#2E2F34":"#EEF1F8",
    edge:v("--ink","#1F2023"),bug:v("--ink","#1F2023"),rim:v("--paper-2","#FFFFFF"),zone:v("--wash-mint","#D6F0E6"),zone2:dark?"#4F9E92":"#3C8A7E",
    lab:v("--muted","#5D5F65"),dark:dark};
}
new MutationObserver(function(){ pal=null; wake(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function fit(){
  var r=view.getBoundingClientRect(); if(!r.width) return;
  dprv=Math.min(window.devicePixelRatio||1,2); W=r.width; H=r.height;
  cv.width=Math.round(W*dprv); cv.height=Math.round(H*dprv);
  ppu=Math.min(W/COLS,H/ROWS); ox=(W-ppu*COLS)/2; oy=(H-ppu*ROWS)/2; draw();
}
function sx(x){ return ox+x*ppu; } function sy(y){ return oy+y*ppu; }
function draw(){
  if(!G||!W) return;
  if(!pal) pal=palette();
  var P=pal, L=G.L, r, c, z, u=ppu;
  ctx.setTransform(dprv,0,0,dprv,0,0); ctx.clearRect(0,0,W,H);
  ctx.fillStyle=P.wall; ctx.fillRect(0,0,W,H);
  /* walls carry a quiet drafting hatch */
  ctx.save(); ctx.strokeStyle=P.hatch; ctx.lineWidth=1; ctx.beginPath();
  for(var k=-H;k<W;k+=Math.max(7,u*.28)){ ctx.moveTo(k,H); ctx.lineTo(k+H,0); } ctx.stroke(); ctx.restore();
  /* floor, zones */
  for(r=0;r<ROWS;r++) for(c=0;c<COLS;c++){
    z=L.g[r*COLS+c]; if(!z) continue;
    ctx.fillStyle=z===1?((r+c)%2?P.f2:P.f1):P.zone;
    ctx.fillRect(Math.floor(sx(c)),Math.floor(sy(r)),Math.ceil(u)+1,Math.ceil(u)+1);
  }
  /* once every requirement is in, It works lights up: the eye goes where the square needs to go */
  if(winGlow>0){ ctx.save(); ctx.globalAlpha=calm()?.35:winGlow*.55; ctx.fillStyle=P.zone2;
    for(r=0;r<ROWS;r++) for(c=0;c<COLS;c++) if(L.g[r*COLS+c]===3) ctx.fillRect(Math.floor(sx(c)),Math.floor(sy(r)),Math.ceil(u)+1,Math.ceil(u)+1); ctx.restore(); }
  /* the outline: every floor edge that meets a wall */
  ctx.save(); ctx.strokeStyle=P.edge; ctx.lineWidth=Math.max(1.5,u*.07); ctx.lineCap="square"; ctx.beginPath();
  for(r=0;r<ROWS;r++) for(c=0;c<COLS;c++){
    if(!L.g[r*COLS+c]) continue; var x0=sx(c), y0=sy(r), x1=sx(c+1), y1=sy(r+1);
    if(!tile(L,c,r-1)){ ctx.moveTo(x0,y0); ctx.lineTo(x1,y0); } if(!tile(L,c,r+1)){ ctx.moveTo(x0,y1); ctx.lineTo(x1,y1); }
    if(!tile(L,c-1,r)){ ctx.moveTo(x0,y0); ctx.lineTo(x0,y1); } if(!tile(L,c+1,r)){ ctx.moveTo(x1,y0); ctx.lineTo(x1,y1); }
  }
  ctx.stroke(); ctx.restore();
  zoneLabels(L,P);
  /* requirements */
  var i, p={x:0,y:0};
  for(i=0;i<L.coins.length;i++){ if(G.got[i]) continue; var q=L.coins[i];
    ctx.beginPath(); ctx.arc(sx(q.x),sy(q.y),CR*u,0,TAU); ctx.fillStyle="#F0B429"; ctx.fill(); ctx.lineWidth=Math.max(1.2,u*.05); ctx.strokeStyle="#1F2023"; ctx.stroke(); }
  /* bugs */
  ctx.lineWidth=Math.max(1.2,u*.05);
  for(i=0;i<L.en.length;i++){ epos(L.en[i],G.t,p);
    ctx.beginPath(); ctx.arc(sx(p.x),sy(p.y),ER*u*1.08,0,TAU); ctx.fillStyle=P.bug; ctx.fill(); ctx.strokeStyle=P.rim; ctx.stroke(); }
  /* the square */
  var a=G.dead>0?Math.max(0,G.dead/.5):1, h=PH*u;
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle="#EA5E14"; ctx.fillRect(sx(G.x)-h,sy(G.y)-h,h*2,h*2);
  ctx.lineWidth=Math.max(1.5,u*.07); ctx.strokeStyle="#1F2023"; ctx.strokeRect(sx(G.x)-h,sy(G.y)-h,h*2,h*2); ctx.restore();
  /* rings: a coin taken, a save, a respawn */
  for(i=0;i<fx.length;i++){ var f=fx[i], t=f.t/.6; ctx.save(); ctx.globalAlpha=1-t; ctx.strokeStyle=f.c; ctx.lineWidth=Math.max(2,u*.08);
    ctx.beginPath(); ctx.arc(sx(f.x),sy(f.y),u*(.3+t*.9),0,TAU); ctx.stroke(); ctx.restore(); }
  /* the touch stick */
  if(stick&&stick.on){ var rc=cv.getBoundingClientRect(); ctx.save(); ctx.strokeStyle=P.lab; ctx.globalAlpha=.5; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(stick.x0-rc.left,stick.y0-rc.top,28,0,TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(stick.x0-rc.left+Math.max(-28,Math.min(28,stick.x-stick.x0)),stick.y0-rc.top+Math.max(-28,Math.min(28,stick.y-stick.y0)),8,0,TAU); ctx.stroke(); ctx.restore(); }
}
/* the zones say what they are when there is room: I WISH, IT WORKS, SAVED */
function zoneLabels(L,P){
  var groups={}, r, c;
  for(r=0;r<ROWS;r++) for(c=0;c<COLS;c++){ var z=L.g[r*COLS+c]; if(z<2) continue;
    var key=z===4?"c"+L.cid[r*COLS+c]:"z"+z, b=groups[key]||(groups[key]={z:z,c0:c,c1:c,r0:r,r1:r});
    b.c0=Math.min(b.c0,c); b.c1=Math.max(b.c1,c); b.r0=Math.min(b.r0,r); b.r1=Math.max(b.r1,r); }
  ctx.save(); ctx.fillStyle=P.lab; ctx.textAlign="center"; ctx.textBaseline="middle";
  Object.keys(groups).forEach(function(k){
    var b=groups[k], w=(b.c1-b.c0+1)*ppu, hh=(b.r1-b.r0+1)*ppu, label=b.z===2?"I WISH":b.z===3?"IT WORKS":"SAVED";
    var fs=Math.min(ppu*.3,13); if(fs<8) return;
    ctx.font="500 "+fs+"px 'JetBrains Mono',monospace";
    var cx=sx((b.c0+b.c1+1)/2), cy=sy((b.r0+b.r1+1)/2);
    if(ctx.measureText(label).width<w-6){ ctx.fillText(label,cx,cy); }
    else if(ctx.measureText(label).width<hh-6){ ctx.save(); ctx.translate(cx,cy); ctx.rotate(-Math.PI/2); ctx.fillText(label,0,0); ctx.restore(); }
  });
  ctx.restore();
}

/* ---------- visibility, resize ---------- */
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else if(mode==="play") pause("The board left the screen, so the clock stopped."); },{threshold:.15}).observe(view);
document.addEventListener("visibilitychange",function(){ if(document.hidden&&mode==="play") pause(); });
var rz=0; window.addEventListener("resize",function(){ cancelAnimationFrame(rz); rz=requestAnimationFrame(fit); });
if(window.ResizeObserver) new ResizeObserver(function(){ fit(); }).observe(view);
if(mq.addEventListener) mq.addEventListener("change",function(){ fx.length=0; wake(); });

/* ---------- boot: the first level not yet cleared ---------- */
var start=0; for(var si=0;si<N;si++){ if(unlocked(si)&&save.best[si]<0){ start=si; break; } }
G=newGame(start); refreshLevels(); hud();
loadLevel(start);
})();
