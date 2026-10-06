/* K13 Debt Breaker (js/dx13.js): a brick breaker with falling power-ups, nine levels, built on the workbench card anatomy.
   The bricks are legacy code. The ball is a fix. Gold bricks fall in one hit, orange in two, deep orange in three, steel never
   (merge conflicts: go round). Broken bricks drop labelled capsules; pale ones help, dark ones cost you. Catch them with the bar.
   The rules and physics sit between CORE-BEGIN and CORE-END and touch no DOM, so Node can run the whole game headless.
   The ball moves in sub-steps of at most 0.18 units (a brick is 2 by 1, the ball's radius .42), so it never tunnels.
   The loop is a fixed 120 Hz step behind an accumulator, draws to a devicePixelRatio-crisp canvas (capped at 2), stops while
   the card is off screen or the tab is hidden, and pauses when focus leaves the board during play.
   prefers-reduced-motion: no shake, no particles, no pop-ups, no blinking, no trail. Still fully playable.
   Mouse: the bar follows the pointer over the board. Touch: drag. Click, tap or Space launches the ball and fires the laser.
   Keyboard (canvas focused): Left/Right or A/D move, Space launch and fire, P or Esc pause, R restart, N next level.
   Buttons under the board: Left and Right (hold), Launch/Fire, Pause, and a level picker. Every control is a real labelled button. */
(function(){
"use strict";

var mount=document.querySelector('[data-game="dx13"]');
if(!mount) return;

/* CORE-BEGIN */
var WW=30, HH=26, COLS=15, ROWS=12, BW=2, BH=1, BY0=1.8;      /* world units: the wall is 15 by 12 bricks of 2 by 1 */
var PY=23.4, PHT=.9, BR=.42, MAXA=1.1, KSPEED=34, MSPEED=80;   /* paddle top, height; ball radius; steepest bounce angle (rad); key and pointer paddle speed */
var PWS=[3.4,5,6.8,8.8];                                       /* paddle widths, narrow to widest; index 1 is the start */
var CAPW=3.4, CAPH=1.05;
var TKEYS=["fire","slow","fast","laser","sticky"];
var TIMED={fire:10,slow:12,fast:12,laser:14,sticky:16};        /* seconds each timed power-up lasts */
var KINDS={
  wide:{lab:"+WIDE",good:1,w:15,say:"Bar wider."},
  narrow:{lab:"-WIDE",good:0,w:6,say:"Bar narrower."},
  multi:{lab:"3x",good:1,w:10,say:"Three balls."},
  fire:{lab:"FIRE",good:1,w:8,say:"Fireball. Nothing but steel stops it."},
  slow:{lab:"SLOW",good:1,w:8,say:"Slow ball."},
  fast:{lab:"FAST",good:0,w:6,say:"Fast ball."},
  laser:{lab:"LASER",good:1,w:10,say:"Laser. Click or press Space to fire."},
  sticky:{lab:"STICKY",good:1,w:8,say:"Sticky bar. Slide it to aim, then launch."},
  life:{lab:"+1UP",good:1,w:3,say:"Extra life."},
  death:{lab:"DEATH",good:0,w:4,say:"Death capsule."}
};
var KORDER=["wide","narrow","multi","fire","slow","fast","laser","sticky","life","death"];
/* brick letters: 1 gold, j jade, w pale (all one hit), 2 two hits, 3 three hits, # steel (never breaks) */
var BK={"1":{hp:1,col:"gold"},"j":{hp:1,col:"jade"},"w":{hp:1,col:"pale"},"2":{hp:2,col:"x"},"3":{hp:3,col:"x"},"#":{hp:-1,col:"steel"}};
function mir(l,c){ return l+c+l.split("").reverse().join(""); }
var LEVELS=[
  {name:"Hello, 13",say:"Two numbers. The easy ones.",rows:[
    "...............",
    "...11...jjjjj..",
    "....1.......j..",
    "....1.......j..",
    "....1....jjjj..",
    "....1.......j..",
    "....1.......j..",
    "..11111.jjjjj.."]},
  {name:"The lockup",say:"Three characters and a lot of paperwork.",rows:[
    "...............",
    "2...2..1..jjjjj",
    "2..2..11......j",
    "2.2....1......j",
    "22.....1...jjjj",
    "2.2....1......j",
    "2..2...1......j",
    "2...2.111.jjjjj",
    "...............",
    "##...........##"]},
  {name:"Laptop",say:"Works on my machine.",rows:[
    "...............",
    "..22222222222..",
    "..2jjjj.....2..",
    "..2..11111..2..",
    "..2..jjj....2..",
    "..2.1111111.2..",
    "..22222222222..",
    "...............",
    "111111111111111",
    ".2222222222222."]},
  {name:"Fork",say:"Merge conflicts are the steel ones. Go round.",rows:[
    "...............",
    "....2.2.2.2....",
    "....2.2.2.2....",
    "##..2.2.2.2..##",
    "##..2222222..##",
    "##...33333...##",
    "##....333....##",
    "......jjj......",
    "......jjj......",
    "......jjj......"]},
  {name:"Lobster",say:"Pinches every deadline.",rows:[
    ".11.........11.",
    "1..1..1.1..1..1",
    "1..1...1...1..1",
    ".11....1....11.",
    "...2.22222.2...",
    "..2..2w2w2..2..",
    "...2.22222.2...",
    "..2..22222..2..",
    "......222......",
    ".....22222.....",
    "....2j222j2...."]},
  {name:"House",say:"The home office. Rent not included.",rows:[
    ".......2.......",
    "......222..#...",
    ".....22222.#...",
    "....2222222....",
    "...222222222...",
    "..22222222222..",
    ".1111111111111.",
    ".1ww1111111ww1.",
    ".1ww1jjjjj1ww1.",
    ".111.jjjjj.111."]},
  {name:"Rocket",say:"Launch day, finally.",rows:[
    ".......j.......",
    "......jjj......",
    ".....jjjjj.....",
    "....2222222....",
    "....22www22....",
    "....22www22....",
    "....2222222....",
    "..j.2222222.j..",
    "..jj2222222jj..",
    "......111......",
    ".......1......."]},
  {name:"Heart",say:"The clients we actually like.",rows:[
    "...............",
    "..2222...2222..",
    ".222222.222222.",
    ".2222222222222.",
    ".2222222222222.",
    "..11111111111..",
    "...111111111...",
    "....1111111....",
    ".....11111.....",
    "......111......",
    ".......1......."]},
  {name:"It works",say:"Do not touch it.",rows:[
    "...............",
    ".............22",
    "............222",
    "...........222.",
    "..22......222..",
    "..222....222...",
    "...222..222....",
    "....222222.....",
    ".....3333......",
    "##....333....##",
    "##...........##"]}
];
var NL=LEVELS.length;
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

function newGame(li,rnd,dropOn){
  var L=LEVELS[li], grid=[], left=0, r, c, s, d;
  for(r=0;r<ROWS;r++){
    grid.push([]); s=L.rows[r]||"";
    for(c=0;c<COLS;c++){ d=BK[s.charAt(c)]; if(d){ grid[r].push({hp:d.hp,max:d.hp,col:d.col}); if(d.hp>0) left++; } else grid[r].push(null); }
  }
  var g={li:li,grid:grid,left:left,total:left,score:0,lives:3,balls:[],caps:[],bolts:[],psz:1,px:WW/2,pw:PWS[1],tx:null,dir:0,hold:false,
    t:{fire:0,slow:0,fast:0,laser:0,sticky:0},cool:0,state:"ready",ev:[],speed:16+li*.7,rnd:rnd||Math.random,dropOn:dropOn!==false,time:0,alt:1};
  attach(g); return g;
}
function attach(g){ g.balls.push({x:g.px,y:PY-BR,vx:0,vy:0,stuck:true,off:0,sk:0}); }
function spd(g){ return g.speed*(g.t.slow>0?.68:(g.t.fast>0?1.38:1)); }
function aimed(g,b){
  var a=b.off*MAXA;
  if(Math.abs(a)<.16){ g.alt=-g.alt; a=.16*(a<0?-1:(a>0?1:g.alt)); }
  return a;
}
function launchAll(g){
  var i, b, a, sp=spd(g), any=false;
  for(i=0;i<g.balls.length;i++){ b=g.balls[i];
    if(b.stuck){ a=aimed(g,b); b.vx=sp*Math.sin(a); b.vy=-sp*Math.cos(a); b.stuck=false; b.sk=0; any=true; } }
  if(any){ g.state="play"; g.ev.push({t:"launch"}); }
  return any;
}
function volley(g){
  g.bolts.push({x:g.px-g.pw/2+.35,y:PY},{x:g.px+g.pw/2-.35,y:PY}); g.cool=.28; g.ev.push({t:"zap"});
}
function press(g){
  if(g.state!=="ready"&&g.state!=="play") return;
  if(launchAll(g)) return;
  if(g.t.laser>0&&g.cool<=0) volley(g);
}
function norm(b,sp){
  var m=Math.sqrt(b.vx*b.vx+b.vy*b.vy), k, ay=sp*.22;
  if(m<1e-6){ b.vx=0; b.vy=-sp; return; }
  k=sp/m; b.vx*=k; b.vy*=k;
  if(Math.abs(b.vy)<ay){ b.vy=b.vy<0?-ay:ay; b.vx=(b.vx<0?-1:1)*Math.sqrt(sp*sp-ay*ay); }
}
function pick(g){
  var tot=0, i, r;
  for(i=0;i<KORDER.length;i++) tot+=KINDS[KORDER[i]].w;
  r=g.rnd()*tot;
  for(i=0;i<KORDER.length;i++){ r-=KINDS[KORDER[i]].w; if(r<=0) return KORDER[i]; }
  return "wide";
}
function hurt(g,r,c,kill){
  var br=g.grid[r][c];
  if(!br) return false;
  if(br.hp<0){ g.ev.push({t:"steel",r:r,c:c}); return false; }
  br.hp=kill?0:br.hp-1;
  if(br.hp<=0){
    g.grid[r][c]=null; g.left--; g.score+=10*br.max;
    g.ev.push({t:"break",r:r,c:c,col:br.col,max:br.max});
    if(g.dropOn&&g.rnd()<.2) g.caps.push({k:pick(g),x:c*BW+BW/2,y:BY0+r*BH+BH/2});
  } else { g.score+=5; g.ev.push({t:"hit",r:r,c:c}); }
  return true;
}
function brickHit(g,b){
  var c0=Math.floor((b.x-BR)/BW), c1=Math.floor((b.x+BR)/BW), r0=Math.floor((b.y-BR-BY0)/BH), r1=Math.floor((b.y+BR-BY0)/BH);
  var r, c, br, x0, y0, cx, cy, dx, dy, d2, best=null, bd=1e9, fire=g.t.fire>0;
  if(c0<0) c0=0; if(c1>COLS-1) c1=COLS-1; if(r0<0) r0=0; if(r1>ROWS-1) r1=ROWS-1;
  for(r=r0;r<=r1;r++) for(c=c0;c<=c1;c++){
    br=g.grid[r][c]; if(!br) continue;
    x0=c*BW; y0=BY0+r*BH;
    cx=clamp(b.x,x0,x0+BW); cy=clamp(b.y,y0,y0+BH); dx=b.x-cx; dy=b.y-cy; d2=dx*dx+dy*dy;
    if(d2>=BR*BR) continue;
    if(fire&&br.hp>0){ hurt(g,r,c,true); continue; }
    if(d2<bd){ bd=d2; best={r:r,c:c,dx:dx,dy:dy,x0:x0,y0:y0}; }
  }
  if(!best) return;
  var nx, ny, d, pen, dot, l, rr, t, bt, m;
  if(bd===0){
    l=b.x-best.x0; rr=best.x0+BW-b.x; t=b.y-best.y0; bt=best.y0+BH-b.y; m=Math.min(l,rr,t,bt);
    nx=0; ny=0;
    if(m===t){ ny=-1; b.y=best.y0-BR; } else if(m===bt){ ny=1; b.y=best.y0+BH+BR; } else if(m===l){ nx=-1; b.x=best.x0-BR; } else { nx=1; b.x=best.x0+BW+BR; }
  } else {
    d=Math.sqrt(bd); nx=best.dx/d; ny=best.dy/d; pen=BR-d; b.x+=nx*pen; b.y+=ny*pen;
  }
  dot=b.vx*nx+b.vy*ny;
  if(dot<0){ b.vx-=2*dot*nx; b.vy-=2*dot*ny; }
  hurt(g,best.r,best.c,false);
}
function moveBall(g,b,sp,h){
  b.x+=b.vx*h; b.y+=b.vy*h;
  if(b.x<BR){ b.x=BR; b.vx=Math.abs(b.vx); } else if(b.x>WW-BR){ b.x=WW-BR; b.vx=-Math.abs(b.vx); }
  if(b.y<BR){ b.y=BR; b.vy=Math.abs(b.vy); }
  if(b.y>HH+BR){ b.dead=true; return; }
  if(b.vy>0&&b.y+BR>=PY&&b.y<PY+PHT*.6&&b.x>=g.px-g.pw/2-BR*.7&&b.x<=g.px+g.pw/2+BR*.7){
    var off=clamp((b.x-g.px)/(g.pw/2),-1,1), a=off*MAXA;
    b.vx=sp*Math.sin(a); b.vy=-sp*Math.cos(a); b.y=PY-BR;
    g.ev.push({t:"paddle"});
    if(g.t.sticky>0){ b.stuck=true; b.off=clamp(off,-.92,.92); b.sk=6; b.vx=0; b.vy=0; return; }
  }
  if(b.y<BY0+ROWS*BH+BR) brickHit(g,b);
  norm(b,sp);
}
function loseLife(g,why){
  g.lives--; g.balls.length=0; g.caps.length=0; g.bolts.length=0; g.psz=1; g.cool=0;
  for(var i=0;i<TKEYS.length;i++) g.t[TKEYS[i]]=0;
  g.ev.push({t:"lose",why:why});
  if(g.lives<=0){ g.state="over"; g.ev.push({t:"over"}); } else { g.state="ready"; attach(g); }
}
function rot(b,a){ var c=Math.cos(a), s=Math.sin(a), x=b.vx*c-b.vy*s, y=b.vx*s+b.vy*c; return {x:b.x,y:b.y,vx:x,vy:y,stuck:false,off:0,sk:0}; }
function apply(g,k){
  var i, n, list;
  if(k==="wide") g.psz=Math.min(3,g.psz+1);
  else if(k==="narrow") g.psz=Math.max(0,g.psz-1);
  else if(k==="multi"){
    launchAll(g); list=g.balls.slice(); n=list.length;
    for(i=0;i<n&&g.balls.length<13;i++){ g.balls.push(rot(list[i],.42)); g.balls.push(rot(list[i],-.42)); }
  }
  else if(k==="fire") g.t.fire=TIMED.fire;
  else if(k==="slow"){ g.t.slow=TIMED.slow; g.t.fast=0; }
  else if(k==="fast"){ g.t.fast=TIMED.fast; g.t.slow=0; }
  else if(k==="laser") g.t.laser=TIMED.laser;
  else if(k==="sticky") g.t.sticky=TIMED.sticky;
  else if(k==="life") g.lives=Math.min(6,g.lives+1);
  g.score+=25;
  g.ev.push({t:"catch",k:k});
  if(k==="death") loseLife(g,"death");
}
function stepCore(g,dt){
  if(g.state!=="ready"&&g.state!=="play") return;
  var i, j, k, b, old=g.px, d, m, tw, sp, dist, n, h, anyStuck=false;
  if(g.dir) g.px+=g.dir*KSPEED*dt;
  else if(g.tx!==null){ d=g.tx-g.px; m=MSPEED*dt; g.px+=d>m?m:(d<-m?-m:d); }
  tw=PWS[g.psz]; g.pw+=(tw-g.pw)*Math.min(1,dt*14); if(Math.abs(tw-g.pw)<.01) g.pw=tw;
  g.px=clamp(g.px,g.pw/2,WW-g.pw/2);
  var dp=g.px-old;
  if(g.state==="play"){ g.time+=dt; for(i=0;i<TKEYS.length;i++){ k=TKEYS[i]; if(g.t[k]>0) g.t[k]=Math.max(0,g.t[k]-dt); } }
  if(g.cool>0) g.cool-=dt;
  sp=spd(g);
  for(i=g.balls.length-1;i>=0;i--){
    b=g.balls[i];
    if(b.stuck){
      anyStuck=true;
      b.off=clamp(b.off+dp/(g.pw/2)*.5,-.92,.92); b.x=g.px+b.off*g.pw/2; b.y=PY-BR;
      if(b.sk>0){ b.sk-=dt; if(b.sk<=0){ var a=aimed(g,b); b.vx=sp*Math.sin(a); b.vy=-sp*Math.cos(a); b.stuck=false; b.sk=0; } }
      continue;
    }
    dist=sp*dt; n=Math.ceil(dist/.18); h=dt/n;
    for(j=0;j<n;j++){ moveBall(g,b,sp,h); if(b.dead||b.stuck) break; }
    if(b.dead) g.balls.splice(i,1);
  }
  if(g.hold&&g.t.laser>0&&g.cool<=0&&g.state==="play"&&!anyStuck) volley(g);
  /* bolts: a thin laser shot climbs and takes one hit off the first brick it meets; steel stops it */
  for(i=g.bolts.length-1;i>=0;i--){
    b=g.bolts[i]; b.y-=34*dt;
    var bc=Math.floor(b.x/BW), br=Math.floor((b.y-BY0)/BH);
    if(b.y<0){ g.bolts.splice(i,1); continue; }
    if(br>=0&&br<ROWS&&bc>=0&&bc<COLS&&g.grid[br][bc]){ hurt(g,br,bc,false); g.bolts.splice(i,1); }
  }
  /* capsules fall; the bar catches them */
  for(i=g.caps.length-1;i>=0;i--){
    var cp=g.caps[i]; if(!cp) continue; cp.y+=6.5*dt;
    if(cp.y>HH+1){ g.caps.splice(i,1); continue; }
    if(Math.abs(cp.x-g.px)<(CAPW+g.pw)/2&&cp.y+CAPH/2>=PY&&cp.y-CAPH/2<=PY+PHT){ g.caps.splice(i,1); apply(g,cp.k); if(g.state==="over") return; }
  }
  if(g.state==="play"&&g.balls.length===0) loseLife(g,"ball");
  if(g.left<=0&&g.state!=="over"){ g.state="won"; g.score+=g.lives*100; g.ev.push({t:"clear"}); }
}
/* CORE-END */

/* ---------- helpers ---------- */
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
function pl(n,w){ return n+" "+w+(n===1?"":"s"); }
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }

/* ---------- the card ---------- */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Debt Breaker")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Slide the orange bar under the ball and break every brick of legacy code. Catch the falling capsules: pale ones help, dark ones cost you."); instr.id="dx13-i"; mount.appendChild(instr);
var stage=el("div","wb-stage dx13-stage"); stage.setAttribute("aria-describedby","dx13-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Restart this level");
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Mouse or touch slides the bar. Click or Space launches and fires. Keys: Left and Right (or A and D), P or Esc pauses, R restarts, N is the next level. Best scores are kept on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var top=el("div","dx13-top"); stage.appendChild(top);
var hLevel=txt("span","dx13-chip",""), hScore=txt("span","dx13-chip",""), hBest=txt("span","dx13-chip",""), hLives=txt("span","dx13-chip",""), hLeft=txt("span","dx13-chip",""), hFx=txt("span","dx13-chip dx13-fx","");
hFx.hidden=true;
top.appendChild(hLevel); top.appendChild(hScore); top.appendChild(hBest); top.appendChild(hLives); top.appendChild(hLeft); top.appendChild(hFx);
var field=el("div","dx13-field"); stage.appendChild(field);
var view=el("div","dx13-view"); field.appendChild(view);
var cv=el("canvas","dx13-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Debt Breaker board. Mouse or touch slides the bar. Click or press Space to launch. Left and Right or A and D move. P pauses. R restarts. N is the next level.");
view.appendChild(cv); var ctx=cv.getContext("2d");
var over=el("div","dx13-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Game message"); view.appendChild(over);
var bar=el("div","dx13-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Debt Breaker controls"); stage.appendChild(bar);
stage.appendChild(reset);

function btn(label,aria,cls){ var b=txt("button",cls||"dx13-btn",label); b.type="button"; if(aria) b.setAttribute("aria-label",aria); return b; }
var lvWrap=el("div","dx13-grp dx13-levels"); lvWrap.setAttribute("role","group"); lvWrap.setAttribute("aria-label","Level");
lvWrap.appendChild(txt("span","dx13-lab","Level"));
var lvBtns=LEVELS.map(function(x,i){ var b=btn(String(i+1),"Level "+(i+1)+", "+x.name); b.addEventListener("click",function(){ if(!b.disabled){ loadLevel(i,true); focusBoard(); } }); lvWrap.appendChild(b); return b; });
bar.appendChild(lvWrap);
var pads=el("div","dx13-pads"); bar.appendChild(pads);
var leftBtn=el("button","dx13-pad",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>Left</span><kbd class="dx13-key" aria-hidden="true">A</kbd>'); leftBtn.type="button"; leftBtn.setAttribute("aria-label","Move left (hold)");
var goBtn=el("button","dx13-pad dx13-go",'<span class="dx13-golab">Launch</span><kbd class="dx13-key" aria-hidden="true">Space</kbd>'); goBtn.type="button"; goBtn.setAttribute("aria-label","Launch the ball, or fire the laser");
var rightBtn=el("button","dx13-pad",'<span>Right</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg><kbd class="dx13-key" aria-hidden="true">D</kbd>'); rightBtn.type="button"; rightBtn.setAttribute("aria-label","Move right (hold)");
var pauseBtn=el("button","dx13-pad dx13-pause",'<span class="dx13-palab">Pause</span><kbd class="dx13-key" aria-hidden="true">P</kbd>'); pauseBtn.type="button"; pauseBtn.setAttribute("aria-label","Pause or resume");
var goLab=goBtn.querySelector(".dx13-golab"), paLab=pauseBtn.querySelector(".dx13-palab");
pads.appendChild(leftBtn); pads.appendChild(goBtn); pads.appendChild(rightBtn); pads.appendChild(pauseBtn);

/* ---------- state ---------- */
var DT=1/120;
var save=(function(){ try{ var s=JSON.parse(store("k13_dx13")||"null"); if(s&&s.best&&s.best.length){ while(s.best.length<NL) s.best.push(0); s.best.length=NL; return s; } }catch(e){} return {best:LEVELS.map(function(){ return 0; })}; })();
function persist(){ store("k13_dx13",JSON.stringify(save)); }
function unlocked(i){ return i===0||save.best[i-1]>0; }
var g=null, halt="", W=0, H=0, ppu=1, dprv=1, pal=null, vis=true, raf=0, on=false, last=0, acc=0, lastIn=0;
var parts=[], pops=[], shake=0;
var keyL=false, keyR=false, keyF=false, padL=false, padR=false, padF=false, holdL=0, holdR=0, ptrDown=false;

function dirNow(){
  var now=performance.now(), l=keyL||padL||now<holdL, r=keyR||padR||now<holdR;
  return (r?1:0)-(l?1:0);
}
function refreshButtons(){
  for(var i=0;i<NL;i++){
    var b=lvBtns[i], ok=unlocked(i);
    b.disabled=!ok; b.classList.toggle("done",save.best[i]>0); b.setAttribute("aria-pressed",g&&g.li===i?"true":"false");
    b.setAttribute("aria-label","Level "+(i+1)+", "+LEVELS[i].name+(ok?(save.best[i]>0?", cleared, best "+save.best[i]:""):", locked, clear level "+i+" first"));
  }
}
var hudKey="";
function hudUpdate(){
  var fx=[], i, k, s;
  for(i=0;i<TKEYS.length;i++){ k=TKEYS[i]; if(g.t[k]>0) fx.push(KINDS[k].lab+" "+Math.ceil(g.t[k])+"s"); }
  s=[g.li,g.score,g.lives,g.left,fx.join(" "),save.best[g.li],g.state,halt].join("|");
  if(s===hudKey) return; hudKey=s;
  hLevel.textContent="Lv "+(g.li+1)+" "+LEVELS[g.li].name; hScore.textContent="Score "+g.score; hBest.textContent="Best "+save.best[g.li];
  hLives.textContent="Lives "+g.lives; hLeft.textContent="Debt "+g.left;
  hFx.hidden=!fx.length; hFx.textContent=fx.join("  ");
  var armed=false; for(i=0;i<g.balls.length;i++) if(g.balls[i].stuck) armed=true;
  goLab.textContent=armed||g.t.laser<=0?"Launch":"Fire";
  paLab.textContent=halt==="pause"?"Resume":"Pause";
}
function loadLevel(i,announce){
  g=newGame(i); halt=""; hudKey="";
  parts.length=0; pops.length=0; shake=0; over.hidden=true; over.innerHTML=""; refreshButtons();
  releaseKeys(); lastIn=performance.now();
  if(announce) say("Level "+(i+1)+", "+LEVELS[i].name+". "+LEVELS[i].say+" "+pl(g.left,"brick")+" of debt. Click or press Space to launch.");
  if(W) draw(); wake();
}

/* ---------- input ---------- */
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function worldX(e){ var r=cv.getBoundingClientRect(); return (e.clientX-r.left)/r.width*WW; }
function aimAt(e){ if(g&&!halt){ g.tx=worldX(e); lastIn=performance.now(); wake(); } }
function go(){ if(!g||halt) return; press(g); lastIn=performance.now(); wake(); }
cv.addEventListener("pointermove",function(e){ if(e.pointerType==="mouse"||ptrDown) aimAt(e); });
cv.addEventListener("pointerdown",function(e){
  focusBoard();
  if(halt==="pause"){ resume(); return; }
  if(halt) return;
  if(e.button>0) return;
  ptrDown=true; try{ cv.setPointerCapture(e.pointerId); }catch(x){}
  aimAt(e); go();
});
["pointerup","pointercancel","lostpointercapture"].forEach(function(n){ cv.addEventListener(n,function(){ ptrDown=false; }); });
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var k=e.key;
  if(halt==="pause"&&k!=="Tab"){ e.preventDefault(); resume(); return; }
  if(halt==="intro"&&k!=="Tab"){ e.preventDefault(); resume(); return; }
  if(k==="ArrowLeft"||k==="a"||k==="A"){ e.preventDefault(); keyL=true; lastIn=performance.now(); wake(); }
  else if(k==="ArrowRight"||k==="d"||k==="D"){ e.preventDefault(); keyR=true; lastIn=performance.now(); wake(); }
  else if(k===" "||k==="ArrowUp"||k==="w"||k==="W"){ e.preventDefault(); keyF=true; if(!e.repeat) go(); }
  else if(k==="p"||k==="P"||k==="Escape"){ e.preventDefault(); pause(); }
  else if(k==="r"||k==="R"){ e.preventDefault(); retry(); }
  else if(k==="n"||k==="N"){ e.preventDefault(); nextLevel(); }
});
cv.addEventListener("keyup",function(e){
  var k=e.key;
  if(k==="ArrowLeft"||k==="a"||k==="A") keyL=false;
  else if(k==="ArrowRight"||k==="d"||k==="D") keyR=false;
  else if(k===" "||k==="ArrowUp"||k==="w"||k==="W") keyF=false;
});
function releaseKeys(){ keyL=keyR=keyF=padL=padR=padF=ptrDown=false; leftBtn.classList.remove("on"); rightBtn.classList.remove("on"); goBtn.classList.remove("on"); }
function holdPad(b,side){
  function set(v){
    if(side==="l"){ padL=v; if(v) holdL=performance.now()+150; } else { padR=v; if(v) holdR=performance.now()+150; }
    b.classList.toggle("on",v); if(v){ if(g&&g.tx!==null) g.tx=null; lastIn=performance.now(); wake(); }
  }
  b.addEventListener("pointerdown",function(e){ if(e.button>0||b.disabled) return; e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(x){} if(halt==="pause") resume(); set(true); });
  ["pointerup","pointercancel","lostpointercapture","blur"].forEach(function(n){ b.addEventListener(n,function(){ set(false); }); });
  b.addEventListener("keydown",function(e){ if((e.key===" "||e.key==="Enter")&&!e.repeat){ e.preventDefault(); set(true); } });
  b.addEventListener("keyup",function(e){ if(e.key===" "||e.key==="Enter") set(false); });
}
holdPad(leftBtn,"l"); holdPad(rightBtn,"r");
goBtn.addEventListener("pointerdown",function(e){ if(e.button>0) return; e.preventDefault(); if(halt==="pause"){ resume(); return; } goBtn.classList.add("on"); padF=true; go(); });
["pointerup","pointercancel","pointerleave"].forEach(function(n){ goBtn.addEventListener(n,function(){ goBtn.classList.remove("on"); padF=false; }); });
goBtn.addEventListener("click",function(e){ if(e.detail===0) go(); });
pauseBtn.addEventListener("click",function(){ if(halt==="pause") resume(); else pause(); });
function retry(){ if(!g) return; loadLevel(g.li,true); focusBoard(); }
function nextLevel(){ if(!g) return; var n=g.li+1; if(n<NL&&(g.state==="won"||unlocked(n))){ loadLevel(n,true); focusBoard(); } }
reset.addEventListener("click",function(){ retry(); });

/* ---------- pause: the button, P or Esc, focus leaving the board during play, the tab hiding, the card scrolling away ---------- */
function panelShell(){ over.innerHTML=""; return el("div","dx13-panel"); }
function pause(msg){
  if(!g||halt||(g.state!=="play"&&g.state!=="ready")) return;
  halt="pause"; releaseKeys(); hudKey="";
  var panel=panelShell(), row=el("div","dx13-over-row"), b=txt("button","dx13-obtn","Keep going");
  b.type="button"; b.addEventListener("click",function(){ resume(); });
  panel.appendChild(txt("h4","dx13-over-t","Paused")); panel.appendChild(txt("p","dx13-over-s",msg||"Nothing moves while you read this. Click the board or press any key to carry on."));
  row.appendChild(b); panel.appendChild(row); over.appendChild(panel); over.hidden=false;
  say("Paused."); if(W) draw(); hudUpdate();
}
function resume(){
  if(!g||(halt!=="pause"&&halt!=="intro")) return;
  halt=""; hudKey=""; over.hidden=true; over.innerHTML=""; say("Back on. "+pl(g.left,"brick")+" of debt left."); focusBoard(); lastIn=performance.now(); wake();
}
mount.addEventListener("focusout",function(e){
  var to=e.relatedTarget;
  if(to&&mount.contains(to)) return;
  if(g&&g.state==="play"&&!halt){
    if(!to) setTimeout(function(){ if(!mount.contains(document.activeElement)) pause(); },0);
    else pause();
  }
});

/* ---------- panels ---------- */
function legend(){
  var w=el("div","dx13-legend"), i, k, s;
  var good=el("p","dx13-leg"), bad=el("p","dx13-leg dx13-leg-bad");
  good.appendChild(txt("b","","Pale, help: ")); bad.appendChild(txt("b","","Dark, cost you: "));
  for(i=0;i<KORDER.length;i++){ k=KORDER[i]; s=txt("span","dx13-cap"+(KINDS[k].good?"":" bad"),KINDS[k].lab); (KINDS[k].good?good:bad).appendChild(s); }
  w.appendChild(good); w.appendChild(bad); return w;
}
function showIntro(){
  halt="intro"; var panel=panelShell(), row=el("div","dx13-over-row"), b=txt("button","dx13-obtn","Start");
  b.type="button"; b.addEventListener("click",function(){ resume(); });
  panel.appendChild(txt("h4","dx13-over-t","Debt Breaker"));
  panel.appendChild(txt("p","dx13-over-s dx13-intro-s","The bricks are legacy code. Move the mouse (or drag, or use the arrows) to slide the bar under the ball. Click or Space launches it and fires the laser."));
  panel.appendChild(legend());
  row.appendChild(b); panel.appendChild(row); over.appendChild(panel); over.hidden=false;
  setTimeout(function(){ try{ b.focus({preventScroll:true}); }catch(x){} },30);
}
function showEnd(won){
  halt="end"; hudKey="";
  var panel=panelShell(), h=txt("h4","dx13-over-t",""), sub=txt("p","dx13-over-s",""), row=el("div","dx13-over-row"), primary;
  function ob(label,cls,fn){ var b=txt("button","dx13-obtn "+(cls||""),label); b.type="button"; b.addEventListener("click",fn); row.appendChild(b); return b; }
  if(won){
    var all=save.best.every(function(s){ return s>0; });
    h.textContent=all&&g.li===NL-1?"Debt paid off":"Level "+(g.li+1)+" clear";
    sub.textContent="Score "+g.score+", best "+save.best[g.li]+(g.li===NL-1?(all?". All "+NL+" levels done. The backlog is empty, for about a day.":"."):". "+LEVELS[g.li+1].name+" is next.");
    panel.appendChild(h); panel.appendChild(sub);
    primary=g.li===NL-1?ob("Play again","",function(){ loadLevel(0,true); focusBoard(); }):ob("Next level","",nextLevel);
    ob("Replay","ghost",retry);
  } else {
    h.textContent="Out of lives";
    sub.textContent=pl(g.left,"brick")+" of debt still standing. Same level, fresh lives, and the capsules are random, so it will not go the same way.";
    panel.appendChild(h); panel.appendChild(sub); primary=ob("Try again","",retry);
  }
  panel.appendChild(row); over.appendChild(panel); over.hidden=false;
  setTimeout(function(){ try{ primary.focus({preventScroll:true}); }catch(x){} },30);
}

/* ---------- events to words, particles, panels ---------- */
var PCOL={gold:"#F0B429",jade:"#4F9E92",pale:"#F6EEDC",steel:"#5D5F65",x:"#EA5E14"};
function burst(c,r,col){
  if(calm()) return;
  for(var i=0;i<7&&parts.length<120;i++){ var a=Math.random()*6.28, sp=2+Math.random()*5;
    parts.push({x:c*BW+BW/2,y:BY0+r*BH+BH/2,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:.5+Math.random()*.3,t:0,c:PCOL[col]||PCOL.x,s:.2+Math.random()*.2,r:Math.random()*6}); }
}
function drain(){
  var evs=g.ev.splice(0,g.ev.length), i, e;
  for(i=0;i<evs.length;i++){ e=evs[i];
    if(e.t==="break") burst(e.c,e.r,e.max>1?"x":g.grid[e.r][e.c]&&g.grid[e.r][e.c].col||"gold");
    else if(e.t==="launch") say("Launched. "+pl(g.left,"brick")+" of debt.");
    else if(e.t==="catch"){ say(KINDS[e.k].say); if(!calm()) pops.push({x:g.px,y:PY-.6,t:0,s:KINDS[e.k].lab}); }
    else if(e.t==="lose"){ if(!calm()) shake=.35; say(g.lives>0?(e.why==="death"?"Death capsule. ":"Ball lost. ")+(g.lives===1?"1 life":g.lives+" lives")+" left. Click or press Space to launch.":"Out of lives."); }
    else if(e.t==="clear"){
      if(g.score>save.best[g.li]) save.best[g.li]=g.score;
      persist(); refreshButtons(); say("Level "+(g.li+1)+" clear. Score "+g.score+"."); showEnd(true);
    } else if(e.t==="over"){ say("Out of lives. "+pl(g.left,"brick")+" of debt still standing."); showEnd(false); }
  }
}
function fx(dt){
  var i;
  if(shake>0) shake=Math.max(0,shake-dt);
  for(i=parts.length-1;i>=0;i--){ var p=parts[i]; p.t+=dt; if(p.t>p.life){ parts.splice(i,1); continue; } p.vy+=22*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.r+=dt*6; }
  for(i=pops.length-1;i>=0;i--){ pops[i].t+=dt; pops[i].y-=dt*2; if(pops[i].t>.8) pops.splice(i,1); }
}

/* ---------- the loop ---------- */
function busy(){ return !!g&&!halt&&(g.state==="play"||parts.length>0||pops.length>0||shake>0||performance.now()-lastIn<2500||dirNow()!==0||padF); }
function frame(t){
  raf=0; if(!vis||document.hidden){ on=false; return; }
  var dt=Math.min(.05,(t-last)/1000), n=0; last=t; acc+=dt;
  if(!halt){
    while(acc>=DT&&n<8){ g.dir=dirNow(); g.hold=keyF||padF||ptrDown; if(g.dir) g.tx=null; stepCore(g,DT); acc-=DT; n++; }
    if(n===8) acc=0;
    fx(dt); drain();
  } else acc=0;
  hudUpdate(); draw();
  if(!busy()){ on=false; return; }
  raf=window.requestAnimationFrame(frame);
}
function wake(){ if(on||!vis||document.hidden||!g){ if(g&&vis&&W) draw(); return; } if(!W&&!fit()) return; on=true; acc=0; last=performance.now(); raf=window.requestAnimationFrame(frame); }
function stopLoop(){ if(raf){ window.cancelAnimationFrame(raf); raf=0; } on=false; }
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else { stopLoop(); pause("You scrolled away, so everything stopped. Click the board or press any key to carry on."); } },{threshold:0}).observe(stage);
document.addEventListener("visibilitychange",function(){ if(document.hidden){ stopLoop(); pause("The tab was hidden, so everything stopped. Click the board or press any key to carry on."); } else wake(); });
if(window.ResizeObserver) new ResizeObserver(function(){ if(fit()) wake(); }).observe(view); else window.addEventListener("resize",function(){ if(fit()) wake(); });
new MutationObserver(function(){ pal=null; if(vis&&W) draw(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
if(mq.addEventListener) mq.addEventListener("change",function(){ if(vis) wake(); });

function fit(){
  var w=view.clientWidth, h=view.clientHeight; if(!w||!h) return false;
  dprv=Math.min(window.devicePixelRatio||1,2);
  var pw=Math.round(w*dprv), ph=Math.round(h*dprv);
  if(cv.width!==pw||cv.height!==ph){ cv.width=pw; cv.height=ph; }
  W=w; H=h; ppu=w/WW;
  if(g) draw(); return true;
}

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement);
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  var dark=document.documentElement.getAttribute("data-theme")==="dark";
  return {dark:dark,bg:v("--paper-3","#E9EDF7"),ink:v("--ink","#1F2023"),or:v("--blue","#B94612"),or2:v("--blue-2","#EA5E14"),line:v("--line-2","rgba(31,32,35,.22)"),muted:v("--muted","#5D5F65"),paper:v("--paper-2","#FFFFFF"),
    edge:dark?"#101114":"#1F2023",steel:dark?"#4A4C52":"#1F2023"};
}
function rr(x,y,w,h,r){ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,w,h,r); else ctx.rect(x,y,w,h); }
function brickFill(br){
  if(br.col==="steel") return pal.steel;
  if(br.max===1) return PCOL[br.col];
  return br.hp>=3?pal.or:(br.hp===2?pal.or2:PCOL.gold);
}
function drawBrick(br,c,r){
  var x=c*BW*ppu, y=(BY0+r*BH)*ppu, w=BW*ppu, h=BH*ppu, i;
  ctx.save(); ctx.fillStyle=brickFill(br); ctx.strokeStyle=pal.edge; ctx.lineWidth=Math.max(1,ppu*.06);
  rr(x+ppu*.04,y+ppu*.04,w-ppu*.08,h-ppu*.08,ppu*.14); ctx.fill(); ctx.stroke();
  if(br.col==="steel"){
    ctx.clip(); ctx.strokeStyle="rgba(243,245,250,.28)"; ctx.lineWidth=Math.max(1,ppu*.1); ctx.beginPath();
    for(i=-2;i<8;i++){ ctx.moveTo(x+i*ppu*.55,y+h); ctx.lineTo(x+i*ppu*.55+h,y); } ctx.stroke();
  } else if(br.hp>1){
    ctx.fillStyle=pal.edge; var d=Math.max(1.6,ppu*.11);
    for(i=0;i<br.hp;i++){ ctx.beginPath(); ctx.arc(x+w/2+(i-(br.hp-1)/2)*ppu*.36,y+h/2,d,0,6.2832); ctx.fill(); }
  }
  ctx.restore();
}
function drawBall(b){
  var x=b.x*ppu, y=b.y*ppu, r=BR*ppu, fire=g.t.fire>0;
  ctx.save();
  if(fire&&!calm()){ ctx.globalAlpha=.35; ctx.fillStyle=pal.or2; ctx.beginPath(); ctx.arc(x-b.vx*ppu*.012,y-b.vy*ppu*.012,r*1.5,0,6.2832); ctx.fill(); ctx.globalAlpha=1; }
  ctx.fillStyle=fire?pal.or2:"#F6EEDC"; ctx.strokeStyle=pal.edge; ctx.lineWidth=Math.max(1.5,ppu*.07);
  ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function draw(){
  if(!g||!W) return;
  if(!pal) pal=palette();
  var P=pal, i, j, b, cp;
  ctx.setTransform(dprv,0,0,dprv,0,0); ctx.clearRect(0,0,W,H);
  ctx.fillStyle=P.bg; ctx.fillRect(0,0,W,H);
  /* graph paper behind the wall */
  ctx.save(); ctx.strokeStyle=P.line; ctx.globalAlpha=.4; ctx.lineWidth=1; ctx.beginPath();
  for(i=2;i<WW;i+=2){ ctx.moveTo(i*ppu,0); ctx.lineTo(i*ppu,H); }
  for(i=2;i<HH;i+=2){ ctx.moveTo(0,i*ppu); ctx.lineTo(W,i*ppu); }
  ctx.stroke(); ctx.restore();
  ctx.save();
  if(shake>0&&!calm()){ ctx.translate((Math.random()-.5)*shake*14,(Math.random()-.5)*shake*14); }
  for(i=0;i<ROWS;i++) for(j=0;j<COLS;j++) if(g.grid[i][j]) drawBrick(g.grid[i][j],j,i);
  /* laser bolts */
  ctx.strokeStyle=P.or2; ctx.lineWidth=Math.max(2,ppu*.14); ctx.lineCap="round"; ctx.beginPath();
  for(i=0;i<g.bolts.length;i++){ b=g.bolts[i]; ctx.moveTo(b.x*ppu,b.y*ppu); ctx.lineTo(b.x*ppu,(b.y+.9)*ppu); }
  ctx.stroke();
  /* capsules: pale and jade-rimmed help, dark and orange-rimmed cost */
  for(i=0;i<g.caps.length;i++){ cp=g.caps[i]; var K=KINDS[cp.k], cw=CAPW*ppu, ch=CAPH*ppu, cx=cp.x*ppu-cw/2, cy=cp.y*ppu-ch/2;
    ctx.save(); ctx.fillStyle=K.good?"#F6EEDC":"#1F2023"; ctx.strokeStyle=K.good?"#4F9E92":P.or2; ctx.lineWidth=Math.max(1.5,ppu*.09);
    rr(cx,cy,cw,ch,ch/2); ctx.fill(); ctx.stroke();
    ctx.fillStyle=K.good?"#1F2023":"#F6EEDC"; ctx.font="700 "+Math.max(7,Math.min(Math.round(ppu*.52),Math.floor(cw*.84/(K.lab.length*.62))))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(K.lab,cx+cw/2,cy+ch/2+1);
    ctx.restore(); }
  /* the bar */
  var pw=g.pw*ppu, px=g.px*ppu-pw/2, py=PY*ppu, ph=PHT*ppu, sticky=g.t.sticky>0;
  ctx.save(); ctx.fillStyle=sticky?"#4F9E92":"#EA5E14"; ctx.strokeStyle=P.edge; ctx.lineWidth=Math.max(1.5,ppu*.07);
  if(g.t.laser>0){ ctx.fillStyle=P.edge; ctx.fillRect(px+ppu*.15,py-ph*.5,ppu*.4,ph*.6); ctx.fillRect(px+pw-ppu*.55,py-ph*.5,ppu*.4,ph*.6); ctx.fillStyle=sticky?"#4F9E92":"#EA5E14"; }
  rr(px,py,pw,ph,ph/2); ctx.fill(); ctx.stroke();
  if(g.pw>=4.4){ ctx.fillStyle=P.edge; ctx.font="700 "+Math.round(ph*.78)+"px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("13",g.px*ppu,py+ph*.54); }
  ctx.restore();
  for(i=0;i<g.balls.length;i++){ b=g.balls[i]; drawBall(b);
    if(b.stuck){ var a=b.off*MAXA; if(Math.abs(a)<.16) a=.16*g.alt; ctx.save(); ctx.strokeStyle=P.ink; ctx.globalAlpha=.55; ctx.lineWidth=Math.max(1.5,ppu*.08); ctx.setLineDash([ppu*.3,ppu*.35]); ctx.beginPath();
      ctx.moveTo(b.x*ppu,b.y*ppu); ctx.lineTo((b.x+Math.sin(a)*3.4)*ppu,(b.y-Math.cos(a)*3.4)*ppu); ctx.stroke(); ctx.restore(); } }
  for(i=0;i<parts.length;i++){ var q=parts[i]; ctx.save(); ctx.globalAlpha=Math.max(0,1-q.t/q.life); ctx.translate(q.x*ppu,q.y*ppu); ctx.rotate(q.r); ctx.fillStyle=q.c; var s=q.s*ppu; ctx.fillRect(-s/2,-s/2,s,s); ctx.restore(); }
  for(i=0;i<pops.length;i++){ var o=pops[i]; ctx.save(); ctx.globalAlpha=Math.max(0,1-o.t/.8); ctx.fillStyle=P.ink; ctx.font="700 "+Math.max(11,Math.round(ppu*.62))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.fillText(o.s,o.x*ppu,o.y*ppu); ctx.restore(); }
  ctx.restore();
  if(g.state==="ready"&&!halt){ ctx.save(); ctx.fillStyle=P.muted; ctx.font="500 "+Math.max(11,Math.round(ppu*.62))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center";
    ctx.fillText("Level "+(g.li+1)+": "+LEVELS[g.li].name,W/2,16.2*ppu); ctx.fillText("click or press Space to launch",W/2,17.6*ppu); ctx.restore(); }
}

/* ---------- boot ---------- */
var start=0; for(var si=0;si<NL;si++){ if(unlocked(si)&&save.best[si]===0){ start=si; break; } start=si; }
if(document.fonts&&document.fonts.load) document.fonts.load("700 40px Fraunces").then(function(){ if(vis&&W) draw(); },function(){});
loadLevel(start,false);
if(save.best.every(function(s){ return s===0; })) showIntro();
say("Debt Breaker. "+NL+" levels. Level "+(start+1)+", "+LEVELS[start].name+", is up: "+pl(g.left,"brick")+" of debt. Click the board, then click or press Space to launch.");
})();
