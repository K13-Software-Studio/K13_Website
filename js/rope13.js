/* K13 Cut the Scope: a rope-cutting physics game, twelve levels, on the workbench card anatomy.
   The prize is a small orange 13 block, the feature, and it hangs on real verlet ropes (chains of points with distance constraints, gravity,
   a heavy end that swings). Swipe across a rope to cut it, pick up the requirements on the way (up to 3 stars a level), and drop the feature
   into the mouth of the client. Helpers arrive one idea at a time: a second rope, spikes (bugs), a bubble that floats the prize up and pops on a tap,
   an air cushion that puffs it sideways, and a hook that catches whatever passes close. Levels unlock in order; stars are saved on the device.
   The loop is a fixed 120 Hz step behind an accumulator and draws to a devicePixelRatio-crisp canvas (capped at 2). The clock stops while the
   card is off screen, the tab is hidden or focus leaves the card, so nothing is lost while looking away.
   prefers-reduced-motion: no rings, no swipe fade, no spin, no chomp. Still fully playable.
   Keyboard (board focused): 1 to 9 cut that rope (each anchor carries its number), Space pops the bubble or fires the next puff (B pops and P puffs, for when the prize is in a bubble and still needs a puff),
   R restarts, N is the next level, Esc pauses. Touch and mouse: swipe or drag across a rope, tap the bubble or the cushion. Every control is also a real labelled button.
   The core (levels, physics, rules) sits between the CORE markers and touches no DOM, so Node can replay a solution for every level. */
(function(){
"use strict";

/* ===================================================== CORE-BEGIN ===================================================== */
/* world: 8 units wide, 10 tall, y grows downward. The prize is a circle of radius CR with a distance-constrained verlet rope chain per rope. */
var BW=8, BH=10, DT=1/120, GRAV=20, CR=.36, STARR=.55, MR=.95, HOOKR=.95, CUTR=.14, DAMP=.9998, ITER=24, CINV=.35, SEG=.42, VMAX=24;
var BUPA=6.5, BUPK=.985, WALLE=.3, PUFFR=3.4, PUFFP=11;

function buildPts(r,cx,cy){
  r.pts=[];
  for(var j=0;j<r.m;j++){ var t=j/r.m, x=r.ax+(cx-r.ax)*t, y=r.ay+(cy-r.ay)*t; r.pts.push({x:x,y:y,px:x,py:y}); }
}
function makeGame(L){
  var G={L:L,tick:0,state:"play",why:"",ev:[],c:{x:L.c[0],y:L.c[1],px:L.c[0],py:L.c[1]},ropes:[],got:[],bub:-1,bdone:[],pdone:[]};
  L.ropes.forEach(function(q){
    var d=Math.hypot(L.c[0]-q.a[0],L.c[1]-q.a[1]), len=Math.max(q.len||0,d);
    var r={ax:q.a[0],ay:q.a[1],len:len,m:Math.max(4,Math.round(len/SEG)),cut:false,on:!q.auto,auto:!!q.auto,pts:[]};
    if(r.on) buildPts(r,L.c[0],L.c[1]);
    G.ropes.push(r);
  });
  (L.stars||[]).forEach(function(){ G.got.push(false); });
  (L.bubbles||[]).forEach(function(){ G.bdone.push(false); });
  (L.puffs||[]).forEach(function(){ G.pdone.push(false); });
  return G;
}
function cloneGame(G){
  var o=JSON.parse(JSON.stringify(G,function(k,v){ return k==="L"?undefined:v; })); o.L=G.L; return o;
}
function pull(a,b,seg,wa,wb){
  var dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy);
  if(d<=seg||d<1e-9) return;
  var k=(d-seg)/d/(wa+wb); a.x+=dx*k*wa; a.y+=dy*k*wa; b.x-=dx*k*wb; b.y-=dy*k*wb;
}
function step(G){
  if(G.state!=="play") return;
  var L=G.L, c=G.c, i, j, r, p, g2=GRAV*DT*DT, vx, vy;
  G.tick++;
  for(i=0;i<G.ropes.length;i++){ r=G.ropes[i]; if(!r.on) continue;
    for(j=1;j<r.m;j++){ p=r.pts[j]; vx=(p.x-p.px)*.9995; vy=(p.y-p.py)*.9995; p.px=p.x; p.py=p.y; p.x+=vx; p.y+=vy+g2; } }
  vx=c.x-c.px; vy=c.y-c.py; c.px=c.x; c.py=c.y;
  if(G.bub>=0){ vx*=BUPK; vy=vy*BUPK-BUPA*DT*DT; } else { vx*=DAMP; vy=vy*DAMP+g2; }
  var sp=Math.sqrt(vx*vx+vy*vy), mx=VMAX*DT; if(sp>mx){ vx*=mx/sp; vy*=mx/sp; }
  c.x+=vx; c.y+=vy;
  var cw={x:c.x,y:c.y};
  for(var it=0;it<ITER;it++){
    for(i=0;i<G.ropes.length;i++){ r=G.ropes[i]; if(!r.on) continue;
      var seg=r.len/r.m, a0={x:r.ax,y:r.ay};
      for(j=1;j<r.m;j++) pull(j===1?a0:r.pts[j-1],r.pts[j],seg,j===1?0:1,1);
      if(!r.cut) pull(r.pts[r.m-1],c,seg,1,CINV);
    } }
  /* the walls are solid, the floor is not */
  if(c.x<CR){ vx=c.x-c.px; c.x=CR; c.px=CR+vx*WALLE; }
  if(c.x>BW-CR){ vx=c.x-c.px; c.x=BW-CR; c.px=c.x+vx*WALLE; }
  if(c.y<CR){ c.y=CR; if(c.py<c.y) c.py=c.y; }
  /* things the prize can meet */
  var k, o, d;
  for(k=0;k<(L.stars||[]).length;k++) if(!G.got[k]&&Math.hypot(c.x-L.stars[k][0],c.y-L.stars[k][1])<STARR){ G.got[k]=true; G.ev.push(["star",k]); }
  for(i=0;i<G.ropes.length;i++){ r=G.ropes[i];
    if(r.auto&&!r.on&&!r.cut){ d=Math.hypot(c.x-r.ax,c.y-r.ay);
      if(d<HOOKR){ r.len=Math.max(1.5,d+.35); r.m=Math.max(4,Math.round(r.len/SEG)); buildPts(r,c.x,c.y); r.on=true; G.ev.push(["hook",i]); } } }
  if(G.bub<0) for(k=0;k<(L.bubbles||[]).length;k++){ o=L.bubbles[k];
    if(!G.bdone[k]&&Math.hypot(c.x-o[0],c.y-o[1])<o[2]){ G.bub=k; G.ev.push(["bubble",k]); break; } }
  for(k=0;k<(L.spikes||[]).length;k++){ o=L.spikes[k];
    var nx=Math.max(o[0],Math.min(c.x,o[0]+o[2])), ny=Math.max(o[1],Math.min(c.y,o[1]+o[3]));
    if(Math.hypot(c.x-nx,c.y-ny)<CR*.8){ G.state="lost"; G.why="spike"; G.ev.push(["spike",k]); return; } }
  if(Math.hypot(c.x-L.m[0],c.y-L.m[1])<MR){ G.state="won"; G.ev.push(["win",0]); return; }
  if(c.y>BH+1.2){ G.state="lost"; G.why="fall"; G.ev.push(["fall",0]); }
}
function cutRope(G,i){
  var r=G.ropes[i]; if(!r||!r.on||r.cut||G.state!=="play") return false;
  r.cut=true; G.ev.push(["cut",i]); return true;
}
function segDist(ax,ay,bx,by,cx,cy,dx,dy){
  /* smallest distance between segments AB and CD */
  function pt(px,py,x0,y0,x1,y1){ var vx=x1-x0, vy=y1-y0, l=vx*vx+vy*vy, t=l?Math.max(0,Math.min(1,((px-x0)*vx+(py-y0)*vy)/l)):0; return Math.hypot(px-(x0+vx*t),py-(y0+vy*t)); }
  var d1=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax), d2=(bx-ax)*(dy-ay)-(by-ay)*(dx-ax), d3=(dx-cx)*(ay-cy)-(dy-cy)*(ax-cx), d4=(dx-cx)*(by-cy)-(dy-cy)*(bx-cx);
  if(d1*d2<0&&d3*d4<0) return 0;
  return Math.min(pt(ax,ay,cx,cy,dx,dy),pt(bx,by,cx,cy,dx,dy),pt(cx,cy,ax,ay,bx,by),pt(dx,dy,ax,ay,bx,by));
}
/* a swipe from (x0,y0) to (x1,y1): every live rope it touches is cut; returns the indices */
function cutSeg(G,x0,y0,x1,y1){
  var out=[], i, j, r, c=G.c;
  if(G.state!=="play") return out;
  for(i=0;i<G.ropes.length;i++){ r=G.ropes[i]; if(!r.on||r.cut) continue;
    var hit=false;
    for(j=1;j<=r.m&&!hit;j++){
      var a=r.pts[j-1], b=j<r.m?r.pts[j]:c;
      if(segDist(x0,y0,x1,y1,a.x,a.y,b.x,b.y)<CUTR) hit=true;
    }
    if(hit&&cutRope(G,i)) out.push(i);
  }
  return out;
}
function popBubble(G){
  if(G.state!=="play"||G.bub<0) return false;
  G.bdone[G.bub]=true; G.ev.push(["pop",G.bub]); G.bub=-1; return true;
}
/* fire puff i, or the first unused one when i is negative; the prize is pushed only if it is within range */
function firePuff(G,i){
  var L=G.L, P=L.puffs||[], k, q, d, c=G.c;
  if(G.state!=="play") return -1;
  if(i<0){ for(k=0;k<P.length;k++) if(!G.pdone[k]){ i=k; break; } }
  if(i<0||i>=P.length||G.pdone[i]) return -1;
  q=P[i]; G.pdone[i]=true; d=Math.hypot(c.x-q.x,c.y-q.y);
  var rg=q.range||PUFFR, pw=q.pow||PUFFP, hit=d<rg;
  if(hit){ var f=1-.5*d/rg; c.px-=q.dx*pw*f*DT; c.py-=q.dy*pw*f*DT; }
  G.ev.push(["puff",i,hit?1:0]); return i;
}
function stars(G){ var n=0; G.got.forEach(function(v){ if(v) n++; }); return n; }

var LEVELS=[
  {name:"First cut",tip:"Swipe across the rope. The client is hungry.",
   c:[4,4],
   m:[4,8.5],
   ropes:[{a:[4,1]}],
   stars:[[4,5.2],[4,6.1],[4,7]]},
  {name:"Swing",tip:"It keeps its speed when you cut. Cut while it swings.",
   c:[6.6,2.6],
   m:[2.1,8],
   ropes:[{a:[4,1]}],
   stars:[[1.8,3.7],[2,5.1],[2.1,6.5]]},
  {name:"Two ropes",tip:"Cut one, ride the other, then let go.",
   c:[4,3.4],
   m:[5.3,8],
   ropes:[{a:[2.6,1]},{a:[5.4,1]}],
   stars:[[2.2,3.7],[3.1,3.7],[4.8,5.6]]},
  {name:"Spikes",tip:"Bugs are not food. Let go over the gap.",
   c:[1.4,2.8],
   m:[4.1,8.6],
   ropes:[{a:[4,1]}],
   stars:[[2.7,4.2],[3.3,5.6],[3.7,7.1]],
   spikes:[[0,9.2,2.4,0.8],[5.6,9.2,2.4,0.8]]},
  {name:"Bubble",tip:"A bubble lifts it. Tap the bubble to pop it and it falls.",
   c:[0.9,3.6],
   m:[6.7,4.3],
   ropes:[{a:[3,1]}],
   stars:[[5.5,3.2],[6.4,0.9],[6.7,2.3]],
   bubbles:[[5,4.6,0.95]],
   spikes:[[0,9.2,8,0.8]]},
  {name:"Puff",tip:"Tap the cushion and it blows the prize sideways.",
   c:[2,3.6],
   m:[6.5,7.2],
   ropes:[{a:[2,1]}],
   stars:[[3.3,4.1],[4.4,4.8],[5.5,5.9]],
   puffs:[{x:0.7,y:6,dx:0.993,dy:-0.119,range:3.8,pow:13}],
   spikes:[[0,9.2,8,0.8]]},
  {name:"Hook",tip:"A hook grabs what passes close. Cut it to let go.",
   c:[2,3.4],
   m:[4.7,7],
   ropes:[{a:[2,1]},{a:[2.6,5.3],auto:true}],
   stars:[[2,4.7],[2.1,6.3],[3.4,6.6]],
   spikes:[[0,9.2,8,0.8]]},
  {name:"Bugs below",tip:"Bugs below and a block in the way. Time the second cut.",
   c:[4,3.4],
   m:[2.3,7.4],
   ropes:[{a:[2.6,1]},{a:[5.4,1]}],
   stars:[[2.2,3.7],[3,3.7],[2.9,5]],
   spikes:[[0,9.2,8,0.8],[0,4.8,2.2,1]]},
  {name:"Bubble and ceiling",tip:"The ceiling has bugs too. Pop before it gets there.",
   c:[7.1,3.6],
   m:[1.3,4],
   ropes:[{a:[5,1]}],
   stars:[[2.8,3.5],[2.1,2.3],[1.5,2.6]],
   bubbles:[[3,4.6,0.95]],
   spikes:[[0,9.2,8,0.8],[0,0,3.6,0.7]]},
  {name:"Hook and puff",tip:"Swing, let go, then give it a puff.",
   c:[1.4,3.4],
   m:[6.6,7.3],
   ropes:[{a:[1.4,1]},{a:[2,5.2],auto:true}],
   stars:[[1.4,5.7],[3.7,5.9],[7,5.5]],
   puffs:[{x:3,y:6.6,dx:0.928,dy:-0.371,range:3.6,pow:12}],
   spikes:[[0,9.2,8,0.8]]},
  {name:"Float, push, pop",tip:"Float up, get pushed, then pop it over the client.",
   c:[0.9,3.6],
   m:[6.7,4.3],
   ropes:[{a:[3,1]}],
   stars:[[3.6,1.4],[5.6,0.7],[6.2,2.3]],
   bubbles:[[3.7,4.8,0.95]],
   puffs:[{x:1.6,y:4.8,dx:0.958,dy:-0.287,range:3.8,pow:12.7}],
   spikes:[[0,9.2,8,0.8]]},
  {name:"Everything",tip:"Everything at once. The client has been waiting.",
   c:[1.6,3.4],
   m:[6.5,7.1],
   ropes:[{a:[1.6,1]},{a:[2.4,5.1],auto:true}],
   stars:[[2.1,6.4],[4.4,2.6],[5,3.8]],
   bubbles:[[4.3,5.1,0.95]],
   puffs:[{x:5.9,y:5,dx:0.981,dy:0.196,range:3.8,pow:10.9}],
   spikes:[[0,9.2,8,0.8],[0,0,2.4,0.7]]}
];
/* ====================================================== CORE-END ====================================================== */

var mount=document.querySelector('[data-game="rope13"]');
if(!mount) return;
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
var N=LEVELS.length, TAU=Math.PI*2, KEY="k13_rope13";

/* card chrome: the same DOM and classes as card() in workbench.js (head, instruction, stage, reset, status, footnote) */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Cut the Scope")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Swipe across a rope to cut it. Tap the bubble to pop it, tap a cushion to puff. Feed the client and pick up the requirements on the way."); instr.id="rp13-i"; mount.appendChild(instr);
var stage=el("div","wb-stage rp13-stage"); stage.setAttribute("aria-describedby","rp13-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Restart this level"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","With the board focused: 1 to 9 cut that rope, Space pops the bubble or fires the puff (B pops, P puffs), R restarts, N is the next level, Esc pauses. Your stars stay on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var top=el("div","rp13-top");
var hLevel=txt("span","rp13-chip",""), hReq=el("span","rp13-chip rp13-req",'<i>\u2605</i><i>\u2605</i><i>\u2605</i>');
hReq.setAttribute("role","img");
top.appendChild(hLevel); top.appendChild(hReq); stage.appendChild(top);
var view=el("div","rp13-view"); stage.appendChild(view);
var cv=el("canvas","rp13-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Cut the Scope board. Swipe across a rope to cut it, tap the bubble or cushion. Keys 1 to 9 cut a rope, Space pops or puffs, B pops, P puffs.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var over=el("div","rp13-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Level"); view.appendChild(over);
var ctl=el("div","rp13-ctl"); ctl.setAttribute("role","group"); ctl.setAttribute("aria-label","Actions"); stage.appendChild(ctl);
var bar=el("div","rp13-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Levels"); stage.appendChild(bar);
bar.appendChild(txt("span","rp13-lab","Level"));
var lvBtns=LEVELS.map(function(lv,i){
  var b=el("button","rp13-lv",'<span class="rp13-ln"></span><span class="rp13-pips" aria-hidden="true"><i></i><i></i><i></i></span>'); b.type="button";
  b.firstChild.textContent=String(i+1);
  b.addEventListener("click",function(){ if(!b.disabled){ loadLevel(i); focusBoard(); } });
  bar.appendChild(b); return b;
});

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store(KEY)||"null"); if(s&&s.best&&s.best.length===N) return s; }catch(e){} return {best:LEVELS.map(function(){ return -1; })}; })();
function persist(){ store(KEY,JSON.stringify(save)); }
var G=null, li=0, mode="ready", endKind="", endT=0, W=0, H=0, ppu=40, dprv=1, vis=false, raf=0, acc=0, last=0, pal=null;
var fx=[], trail=[], swipe=null, sig="", csig="", ang=0, lastInside=0, cutBtns=[], popBtn=null, puffBtn=null;

function unlocked(i){ return i===0||save.best[i-1]>=0; }
function refreshLevels(){
  lvBtns.forEach(function(b,i){
    var ok=unlocked(i), s=save.best[i], pips=b.lastChild.children, k;
    b.disabled=!ok; b.classList.toggle("done",s>=0); b.setAttribute("aria-pressed",String(!!G&&li===i));
    for(k=0;k<3;k++) pips[k].className=s>k?"on":"";
    b.setAttribute("aria-label","Level "+(i+1)+", "+LEVELS[i].name+(ok?(s>=0?", cleared with "+s+" of 3 requirements":", not cleared yet"):", locked"));
  });
}
function hud(){
  if(!G) return;
  var n=stars(G), s=[li,n].join("|"); if(s===sig) return; sig=s;
  hLevel.textContent=(li+1)+"/"+N+" "; hLevel.appendChild(txt("span","rp13-nm",G.L.name));
  for(var k=0;k<3;k++) hReq.children[k].className=k<n?"on":"";
  hReq.setAttribute("aria-label","Requirements met: "+n+" of "+G.got.length);
  hReq.title="Requirements met: "+n+" of "+G.got.length;
}
function panel(title,sub,buttons,starsRow){
  over.innerHTML=""; var p=el("div","rp13-panel");
  p.appendChild(txt("div","rp13-over-t",title));
  if(starsRow!=null){ var sr=el("div","rp13-over-stars"); sr.setAttribute("aria-hidden","true"); for(var k=0;k<3;k++) sr.appendChild(txt("span",k<starsRow?"on":"","★")); p.appendChild(sr); }
  if(sub) p.appendChild(txt("p","rp13-over-s",sub));
  var row=el("div","rp13-over-row");
  buttons.forEach(function(b){ var x=txt("button","rp13-obtn"+(b.ghost?" ghost":""),b.label); x.type="button"; x.addEventListener("click",b.go); row.appendChild(x); });
  p.appendChild(row); over.appendChild(p); over.hidden=false;
  return row.firstChild;
}
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }

/* ---------- the action buttons under the board: one per rope, then pop and puff when the level has them ---------- */
var ICON={
  cut:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M8 7.6 20 17M8 16.4 20 7"/></svg>',
  pop:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M8.5 9.5a4.5 4.5 0 0 1 3-2.2"/></svg>',
  puff:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h10a3 3 0 1 0-3-3M3 15h14a3 3 0 1 1-3 3M3 12h6"/></svg>'
};
function mkBtn(icon,label,key,aria,go){
  var b=el("button","rp13-act",ICON[icon]); b.type="button";
  b.appendChild(txt("span","rp13-bl",label));
  if(key){ var k=txt("kbd","rp13-key",key); k.setAttribute("aria-hidden","true"); b.appendChild(k); }
  b.setAttribute("aria-label",aria); b.addEventListener("click",go); ctl.appendChild(b); return b;
}
function buildCtl(){
  ctl.innerHTML=""; cutBtns=[]; popBtn=null; puffBtn=null; csig="";
  ctl.classList.toggle("rp13-many",G.L.ropes.length+(G.L.bubbles&&G.L.bubbles.length?1:0)+(G.L.puffs&&G.L.puffs.length?1:0)>=4);
  G.L.ropes.forEach(function(r,i){
    cutBtns.push(mkBtn("cut","Cut rope "+(i+1),i<9?String(i+1):"","Cut rope "+(i+1)+(r.auto?" (the hook, once it has caught the prize)":""),function(){ act(function(){ doCut(i); }); }));
  });
  var both=!!(G.L.bubbles&&G.L.bubbles.length&&G.L.puffs&&G.L.puffs.length);
  if(G.L.bubbles&&G.L.bubbles.length) popBtn=mkBtn("pop","Pop",both?"B":"Space","Pop the bubble",function(){ act(doPop); });
  if(G.L.puffs&&G.L.puffs.length) puffBtn=mkBtn("puff","Puff",both?"P":"Space","Fire the puff",function(){ act(function(){ doPuff(-1); }); });
}
function syncCtl(){
  if(!G) return;
  var live=mode==="play"||mode==="ready"||mode==="paused", s=[], i;
  for(i=0;i<G.ropes.length;i++) s.push(G.ropes[i].on&&!G.ropes[i].cut?1:0);
  s.push(G.bub, G.pdone.join(""), live?1:0, mode==="play"?1:0);
  var k=s.join(","); if(k===csig) return; csig=k;
  cutBtns.forEach(function(b,j){ b.disabled=!live||!(G.ropes[j].on&&!G.ropes[j].cut); });
  if(popBtn){ popBtn.disabled=!live||G.bub<0; popBtn.classList.toggle("rp13-hot",mode==="play"&&G.bub>=0); }
  if(puffBtn){ var left=0; G.pdone.forEach(function(d){ if(!d) left++; }); puffBtn.disabled=!live||left===0; puffBtn.classList.toggle("rp13-hot",mode==="play"&&left>0&&G.bub>=0&&!popBtn); }
}

/* ---------- flow ---------- */
function loadLevel(i){
  li=i; G=makeGame(LEVELS[i]); mode="ready"; endKind=""; endT=0; fx.length=0; trail.length=0; swipe=null; sig=""; ang=0; acc=0;
  panel("Level "+(i+1)+": "+G.L.name,G.L.tip,[{label:"Start",go:function(){ begin(); }}]);
  buildCtl(); hud(); refreshLevels(); syncCtl(); fit(); wake();
  say("Level "+(i+1)+" of "+N+", "+G.L.name+". "+G.L.tip+" "+G.got.length+" requirements to pick up on the way.");
}
function begin(){ if(!G||G.state!=="play") return; over.hidden=true; mode="play"; focusBoard(); last=0; syncCtl(); wake(); }
function pause(why){
  if(mode!=="play") return; mode="paused"; swipe=null;
  panel("Paused",why||"The prize waits for you.",[{label:"Continue",go:function(){ begin(); }}]); syncCtl();
}
function restart(){ if(G){ loadLevel(li); begin(); } }
function nextLevel(){ if(li+1<N&&unlocked(li+1)){ loadLevel(li+1); focusBoard(); } }
function act(fn){
  if(mode==="ready"||mode==="paused") begin();
  if(mode!=="play") return;
  fn(); drain(); syncCtl(); wake();
}
function doCut(i){ cutRope(G,i); }
function doPop(){ popBubble(G); }
function doPuff(i){ firePuff(G,i); }

function finish(kind){
  mode="end"; endKind=kind; endT=0; swipe=null;
  if(kind==="won"){
    var n=stars(G); if(save.best[li]<n) save.best[li]=n; persist(); refreshLevels(); hud();
    say("Fed. "+n+" of "+G.got.length+" requirements met.");
  } else {
    say(G.why==="spike"?"Spiked. The prize met a bug.":"Dropped. The prize hit the floor.");
  }
  syncCtl();
}
function showEnd(){
  var b;
  if(endKind==="won"){
    var n=stars(G), sub=n===3?"Every requirement met. The client is full.":(n===0?"None of the requirements met, and the client is happy anyway.":n+" of 3 requirements met. The rest are still out there.");
    if(li+1<N){
      b=panel("Fed.",sub,[{label:"Next level",go:function(){ loadLevel(li+1); begin(); }},{label:"Play again",ghost:true,go:function(){ loadLevel(li); begin(); }}],n);
      say("Level "+(li+1)+" done, "+n+" of 3 requirements. Press N or the button for "+LEVELS[li+1].name+".");
    } else {
      b=panel("All "+N+" fed.",n+" of 3 on the last one. Scope delivered, mostly.",[{label:"Play level 1 again",go:function(){ loadLevel(0); begin(); }},{label:"Play again",ghost:true,go:function(){ loadLevel(li); begin(); }}],n);
      say("All "+N+" levels cleared.");
    }
  } else {
    b=panel(G.why==="spike"?"Spiked.":"Dropped.",G.why==="spike"?"The feature met a bug. The client is still hungry.":"It hit the floor. The client noticed.",[{label:"Try again",go:function(){ loadLevel(li); begin(); }}]);
  }
  setTimeout(function(){ try{ b.focus({preventScroll:true}); }catch(x){} },30);
}

/* ---------- events from the core, turned into a status line and a little motion ---------- */
function burst(x,y,c,kind){ if(!calm()) fx.push({x:x,y:y,c:c,k:kind||"ring",t:0}); }
function drain(){
  var ev=G.ev, i, e, L=G.L;
  for(i=0;i<ev.length;i++){ e=ev[i];
    if(e[0]==="star"){ var n=stars(G); burst(L.stars[e[1]][0],L.stars[e[1]][1],"#F0B429","ring"); say("Requirement "+n+" of "+G.got.length+" met."); }
    else if(e[0]==="cut"){ say("Cut rope "+(e[1]+1)+"."); }
    else if(e[0]==="hook"){ burst(G.ropes[e[1]].ax,G.ropes[e[1]].ay,"#EA5E14","ring"); say("Hooked. Cut rope "+(e[1]+1)+" to let go."); }
    else if(e[0]==="bubble"){ say("In a bubble. Tap it, or press Space, to pop."); }
    else if(e[0]==="pop"){ burst(G.c.x,G.c.y,"#4F9E92","ring"); say("Popped."); }
    else if(e[0]==="puff"){ burst(L.puffs[e[1]].x,L.puffs[e[1]].y,"#4F9E92","ring"); say(e[2]?"Puff.":"Puff, but the prize was out of range."); }
    else if(e[0]==="spike"||e[0]==="fall"){ burst(G.c.x,Math.min(G.c.y,BH-.3),"#EA5E14","ring"); finish("lost"); }
    else if(e[0]==="win"){ finish("won"); }
  }
  ev.length=0;
}

/* ---------- input ---------- */
function wpt(e){ var r=cv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*BW,(e.clientY-r.top)/r.height*BH]; }
cv.addEventListener("pointerdown",function(e){
  if(e.button>0) return; e.preventDefault(); focusBoard();
  if(mode==="ready"||mode==="paused") begin();
  if(mode!=="play") return;
  var p=wpt(e), L=G.L, k, tapped=false;
  for(k=0;k<(L.puffs||[]).length&&!tapped;k++){
    if(!G.pdone[k]&&Math.hypot(p[0]-L.puffs[k].x,p[1]-L.puffs[k].y)<.85){ doPuff(k); tapped=true; } }
  if(!tapped&&G.bub>=0&&Math.hypot(p[0]-G.c.x,p[1]-G.c.y)<L.bubbles[G.bub][2]+.3){ doPop(); tapped=true; }
  swipe={id:e.pointerId,x:p[0],y:p[1],nocut:tapped}; trail=[{x:p[0],y:p[1],t:0}];
  try{ cv.setPointerCapture(e.pointerId); }catch(x){}
  drain(); syncCtl(); wake();
});
cv.addEventListener("pointermove",function(e){
  if(!swipe||swipe.id!==e.pointerId||mode!=="play") return;
  var p=wpt(e);
  if(!swipe.nocut){ var hit=cutSeg(G,swipe.x,swipe.y,p[0],p[1]); if(hit.length){ drain(); syncCtl(); } }
  swipe.x=p[0]; swipe.y=p[1]; trail.push({x:p[0],y:p[1],t:0}); if(trail.length>14) trail.shift(); wake();
});
function lift(e){ if(swipe&&swipe.id===e.pointerId){ swipe=null; if(calm()) trail.length=0; wake(); } }
cv.addEventListener("pointerup",lift); cv.addEventListener("pointercancel",lift);
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var k=e.key;
  if(k>="1"&&k<="9"){ var i=+k-1; if(G&&G.ropes[i]){ e.preventDefault(); act(function(){ doCut(i); }); } }
  else if(k==="b"||k==="B"){ e.preventDefault(); act(doPop); }
  else if(k==="p"||k==="P"){ e.preventDefault(); act(function(){ doPuff(-1); }); }
  else if(k===" "||k==="Spacebar"){
    e.preventDefault();
    if(mode==="ready"||mode==="paused"){ begin(); return; }
    if(mode!=="play") return;
    if(G.bub>=0) act(doPop); else act(function(){ doPuff(-1); });
  }
  else if(k==="Enter"){ if(mode==="ready"||mode==="paused"){ e.preventDefault(); begin(); } }
  else if(k==="Escape"){ if(mode==="play"){ e.preventDefault(); pause(); } }
});
mount.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key==="r"||e.key==="R"){ e.preventDefault(); restart(); }
  else if(e.key==="n"||e.key==="N"){ e.preventDefault(); nextLevel(); }
});
/* the clock stops when focus leaves the whole card, not when it moves to one of its own buttons (Safari gives a button no focus at all, so a press inside the card counts) */
mount.addEventListener("pointerdown",function(){ lastInside=Date.now(); },true);
mount.addEventListener("focusout",function(e){
  if(mode!=="play") return;
  if(Date.now()-lastInside<600) return;
  if(e.relatedTarget&&mount.contains(e.relatedTarget)) return;
  pause("You clicked away, so the clock stopped.");
});
reset.addEventListener("click",restart);

/* ---------- loop ---------- */
var STEP_MAX=.1, END_WON=.5, END_LOST=.55;
function frame(now){
  raf=0; if(!vis||!G) return;
  if(!last) last=now;
  var dt=Math.min(STEP_MAX,(now-last)/1000), i; last=now;
  if(mode==="play"){ acc+=dt; while(acc>=DT){ step(G); acc-=DT; if(G.ev.length){ drain(); if(mode!=="play"){ acc=0; break; } } } syncCtl(); }
  if(mode==="end"){ endT+=dt; if(over.hidden&&endT>=(endKind==="won"?(calm()?.15:END_WON):END_LOST)) showEnd(); }
  for(i=fx.length-1;i>=0;i--){ fx[i].t+=dt; if(fx[i].t>.55) fx.splice(i,1); }
  for(i=trail.length-1;i>=0;i--){ trail[i].t+=dt; if(trail[i].t>.22&&!swipe) trail.splice(i,1); }
  hud(); draw();
  if(vis&&(mode==="play"||fx.length||trail.length||(mode==="end"&&over.hidden))) raf=requestAnimationFrame(frame);
}
function wake(){ if(!raf&&vis){ last=0; raf=requestAnimationFrame(frame); } if(!vis||calm()) draw(); }

/* ---------- drawing, all in world units: the board is 8 wide and 10 tall ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement), dark=document.documentElement.getAttribute("data-theme")==="dark";
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  return {bg:v("--paper-3","#F3EFE7"),paper:v("--paper-2","#FFFFFF"),ink:v("--ink","#1F2023"),blue:v("--blue","#B94612"),blue2:v("--blue-2","#EA5E14"),muted:v("--muted","#5D5F65"),
    body:dark?"#3B3D44":"#1F2023",spike:dark?"#9A9DA6":"#1F2023",rim:dark?"rgba(255,255,255,.34)":"rgba(31,32,35,0)",jade:"#4F9E92",gold:"#F0B429",dark:dark};
}
new MutationObserver(function(){ pal=null; wake(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function fit(){
  var r=view.getBoundingClientRect(); if(!r.width) return;
  dprv=Math.min(window.devicePixelRatio||1,2); W=r.width; H=r.height;
  cv.width=Math.round(W*dprv); cv.height=Math.round(H*dprv); ppu=W/BW; draw();
}
function rrect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath(); }
function star(x,y,ro,ri,fill,line,lw){
  ctx.beginPath(); for(var k=0;k<10;k++){ var a=-Math.PI/2+k*Math.PI/5, r=k%2?ri:ro; ctx[k?"lineTo":"moveTo"](x+Math.cos(a)*r,y+Math.sin(a)*r); } ctx.closePath();
  ctx.fillStyle=fill; ctx.fill(); ctx.lineJoin="round"; ctx.lineWidth=lw; ctx.strokeStyle=line; ctx.stroke();
}
function spikes(P,s){
  var x=s[0], y=s[1], w=s[2], h=s[3], t=Math.min(.26,w/3,h/3), k, n, gap, e=.01;
  var sT=y<=e, sB=y+h>=BH-e, sL=x<=e, sR=x+w>=BW-e;   /* a side on the board edge carries no spikes */
  var x0=sL?x:x+t*.5, x1=sR?x+w:x+w-t*.5, y0=sT?y:y+t*.5, y1=sB?y+h:y+h-t*.5;
  ctx.fillStyle=P.spike;
  rrect(x0,y0,x1-x0,y1-y0,.05); ctx.fill();
  n=Math.max(1,Math.round(w/.42)); gap=w/n;
  for(k=0;k<n;k++){
    if(!sT){ ctx.beginPath(); ctx.moveTo(x+k*gap+gap*.12,y+t); ctx.lineTo(x+k*gap+gap/2,y); ctx.lineTo(x+(k+1)*gap-gap*.12,y+t); ctx.closePath(); ctx.fill(); }
    if(!sB){ ctx.beginPath(); ctx.moveTo(x+k*gap+gap*.12,y+h-t); ctx.lineTo(x+k*gap+gap/2,y+h); ctx.lineTo(x+(k+1)*gap-gap*.12,y+h-t); ctx.closePath(); ctx.fill(); }
  }
  n=Math.max(1,Math.round(h/.42)); gap=h/n;
  for(k=0;k<n;k++){
    if(!sL){ ctx.beginPath(); ctx.moveTo(x+t,y+k*gap+gap*.12); ctx.lineTo(x,y+k*gap+gap/2); ctx.lineTo(x+t,y+(k+1)*gap-gap*.12); ctx.closePath(); ctx.fill(); }
    if(!sR){ ctx.beginPath(); ctx.moveTo(x+w-t,y+k*gap+gap*.12); ctx.lineTo(x+w,y+k*gap+gap/2); ctx.lineTo(x+w-t,y+(k+1)*gap-gap*.12); ctx.closePath(); ctx.fill(); }
  }
}
function creature(P,m,c){
  var mx=m[0], my=m[1], d=Math.hypot(c.x-mx,c.y-my), eat=(mode==="end"&&endKind==="won")?(calm()?1:Math.min(1,endT/.35)):0;
  var open=Math.max(0,Math.min(1,(4.5-d)/3.2)), ry=.36+open*.26, chomp=eat>0&&!calm()?Math.abs(Math.sin(eat*Math.PI*3))*.2:0;
  if(my<7.6){ var dx0=Math.max(.1,mx-1.55), dx1=Math.min(BW-.1,mx+1.55); ctx.globalAlpha=.16; ctx.fillStyle=P.ink; rrect(dx0,my+1.5,dx1-dx0,.3,.12); ctx.fill(); ctx.globalAlpha=1; }
  ctx.beginPath(); ctx.arc(mx,my+.35,1.25,0,TAU); ctx.fillStyle=P.body; ctx.fill();
  ctx.lineWidth=.05; ctx.strokeStyle=P.rim; ctx.stroke();
  /* mouth: wide open, teeth on top, tongue in the bottom */
  var mry=Math.max(.2,ry-chomp);
  ctx.beginPath(); ctx.ellipse(mx,my+.1,.9,mry,0,0,TAU); ctx.fillStyle=P.blue; ctx.fill();
  ctx.beginPath(); ctx.ellipse(mx,my+.1+mry*.52,.46,mry*.42,0,0,TAU); ctx.fillStyle=P.blue2; ctx.fill();
  ctx.fillStyle="#F4F1EA";
  for(var k=-1.5;k<=1.5;k+=1){ var tx=mx+k*.36, ty=my+.1-mry*Math.sqrt(Math.max(0,1-Math.pow(k*.36/.9,2)));
    ctx.beginPath(); ctx.moveTo(tx-.13,ty); ctx.lineTo(tx+.13,ty); ctx.lineTo(tx,ty+.2); ctx.closePath(); ctx.fill(); }
  /* eyes follow the prize */
  var ex=Math.max(-1,Math.min(1,(c.x-mx)/3))*.09, ey=Math.max(-1,Math.min(1,(c.y-(my-.5))/3))*.07;
  [-1,1].forEach(function(s){
    ctx.beginPath(); ctx.arc(mx+s*.52,my-.52,.27,0,TAU); ctx.fillStyle="#F4F1EA"; ctx.fill();
    ctx.beginPath(); ctx.arc(mx+s*.52+ex,my-.52+ey,.12,0,TAU); ctx.fillStyle="#1F2023"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(mx+s*.82,my-.98); ctx.lineTo(mx+s*.3,my-.86); ctx.lineWidth=.07; ctx.lineCap="round"; ctx.strokeStyle="#F4F1EA"; ctx.stroke();
  });
}
/* text is drawn at a real pixel size, whatever the board scale, so it stays sharp */
function txtAt(s,size,x,y){
  ctx.save(); ctx.translate(x,y); ctx.scale(1/ppu,1/ppu);
  ctx.font="700 "+(size*ppu).toFixed(1)+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(s,0,0); ctx.restore();
}
function candy(P,x,y,a,s){
  ctx.save(); ctx.translate(x,y); ctx.rotate(a); ctx.scale(s,s);
  rrect(-.38,-.38,.76,.76,.13); ctx.fillStyle=P.blue2; ctx.fill();
  ctx.lineWidth=.06; ctx.strokeStyle="#1F2023"; ctx.stroke();
  ctx.fillStyle="#fff"; txtAt("13",.36,0,.02);
  ctx.restore();
}
function draw(){
  if(!G||!W) return;
  if(!pal) pal=palette();
  var P=pal, L=G.L, c=G.c, i, j, r, u=ppu, live;
  ctx.setTransform(dprv,0,0,dprv,0,0); ctx.fillStyle=P.bg; ctx.fillRect(0,0,W,H);
  ctx.setTransform(dprv*u,0,0,dprv*u,0,0);
  /* drafting dots, one per world unit */
  ctx.globalAlpha=.16; ctx.fillStyle=P.ink;
  for(i=1;i<BW;i++) for(j=1;j<BH;j++){ ctx.beginPath(); ctx.arc(i,j,.025,0,TAU); ctx.fill(); }
  ctx.globalAlpha=1;
  (L.spikes||[]).forEach(function(s){ spikes(P,s); });
  creature(P,L.m,(mode==="end"&&endKind==="won")?{x:L.m[0],y:L.m[1]}:c);
  /* cushions: the faint ring is how far a puff reaches */
  (L.puffs||[]).forEach(function(p,k){
    var used=G.pdone[k], a=Math.atan2(p.dy,p.dx);
    if(!used){ ctx.save(); ctx.globalAlpha=.3; ctx.strokeStyle=P.jade; ctx.lineWidth=.035; ctx.setLineDash([.12,.16]); ctx.beginPath(); ctx.arc(p.x,p.y,p.range||PUFFR,0,TAU); ctx.stroke(); ctx.restore(); }
    ctx.save(); ctx.globalAlpha=used?.35:1; ctx.translate(p.x,p.y);
    ctx.beginPath(); ctx.arc(0,0,.5,0,TAU); ctx.fillStyle=P.paper; ctx.fill(); ctx.lineWidth=.06; ctx.strokeStyle=P.jade; ctx.stroke();
    ctx.rotate(a); ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle=P.jade; ctx.lineWidth=.07;
    ctx.beginPath(); ctx.moveTo(-.2,-.2); ctx.lineTo(.02,0); ctx.lineTo(-.2,.2); ctx.moveTo(.04,-.2); ctx.lineTo(.26,0); ctx.lineTo(.04,.2); ctx.stroke();
    ctx.restore();
  });
  /* bubbles that are waiting; the one carrying the prize is drawn around it */
  (L.bubbles||[]).forEach(function(b,k){
    if(G.bdone[k]||G.bub===k) return;
    ctx.beginPath(); ctx.arc(b[0],b[1],b[2],0,TAU); ctx.fillStyle="rgba(79,158,146,.16)"; ctx.fill(); ctx.lineWidth=.05; ctx.strokeStyle=P.jade; ctx.stroke();
    ctx.beginPath(); ctx.arc(b[0],b[1],b[2]*.7,Math.PI*1.1,Math.PI*1.55); ctx.lineWidth=.06; ctx.lineCap="round"; ctx.strokeStyle="rgba(255,255,255,.75)"; ctx.stroke();
  });
  /* hooks that have not caught anything yet */
  G.ropes.forEach(function(rp){
    if(rp.auto&&!rp.on&&!rp.cut){ ctx.save(); ctx.globalAlpha=.7; ctx.strokeStyle=P.blue2; ctx.lineWidth=.04; ctx.setLineDash([.12,.14]); ctx.beginPath(); ctx.arc(rp.ax,rp.ay,HOOKR,0,TAU); ctx.stroke(); ctx.restore(); }
  });
  /* ropes */
  ctx.lineCap="round"; ctx.lineJoin="round";
  for(i=0;i<G.ropes.length;i++){ r=G.ropes[i]; if(!r.on) continue;
    ctx.globalAlpha=r.cut?.5:.9; ctx.strokeStyle=P.ink; ctx.lineWidth=.07;
    ctx.beginPath(); ctx.moveTo(r.ax,r.ay); for(j=1;j<r.m;j++) ctx.lineTo(r.pts[j].x,r.pts[j].y); if(!r.cut) ctx.lineTo(c.x,c.y); ctx.stroke(); ctx.globalAlpha=1; }
  /* anchors, numbered so the keys make sense */
  for(i=0;i<G.ropes.length;i++){ r=G.ropes[i]; live=r.on&&!r.cut||(r.auto&&!r.on&&!r.cut);
    ctx.globalAlpha=live?1:.4; ctx.beginPath(); ctx.arc(r.ax,r.ay,.27,0,TAU); ctx.fillStyle=P.paper; ctx.fill(); ctx.lineWidth=.06; ctx.strokeStyle=r.auto?P.blue2:P.ink; ctx.stroke();
    ctx.fillStyle=P.ink; txtAt(String(i+1),.34,r.ax,r.ay+.02); ctx.globalAlpha=1; }
  /* requirements */
  for(i=0;i<L.stars.length;i++){ if(G.got[i]) continue; star(L.stars[i][0],L.stars[i][1],.3,.13,P.gold,"#1F2023",.045); }
  /* the prize, in its bubble when it has one */
  var tgt=0, held=false;
  for(i=0;i<G.ropes.length;i++){ r=G.ropes[i]; if(r.on&&!r.cut){ var e=r.pts[r.m-1]; tgt=Math.atan2(-(c.x-e.x),c.y-e.y); held=true; break; } }
  if(held) ang=tgt; else if(!calm()&&mode==="play") ang+=(c.x-c.px)*1.2;
  var eat=(mode==="end"&&endKind==="won")?(calm()?1:Math.min(1,endT/.35)):0;
  if(eat>0){ var ex=c.x+(L.m[0]-c.x)*eat, ey=c.y+(L.m[1]+.1-c.y)*eat; candy(P,ex,ey,ang,1-.7*eat); }
  else candy(P,c.x,c.y,ang,1);
  if(G.bub>=0){ var bb=L.bubbles[G.bub]; ctx.beginPath(); ctx.arc(c.x,c.y,bb[2],0,TAU); ctx.fillStyle="rgba(79,158,146,.18)"; ctx.fill(); ctx.lineWidth=.06; ctx.strokeStyle=P.jade; ctx.stroke();
    ctx.beginPath(); ctx.arc(c.x,c.y,bb[2]*.78,Math.PI*1.1,Math.PI*1.55); ctx.lineWidth=.06; ctx.strokeStyle="rgba(255,255,255,.75)"; ctx.stroke(); }
  /* rings: a requirement, a pop, a puff, a hook, a loss */
  for(i=0;i<fx.length;i++){ var f=fx[i], t=f.t/.55; ctx.globalAlpha=1-t; ctx.strokeStyle=f.c; ctx.lineWidth=.07; ctx.beginPath(); ctx.arc(f.x,f.y,.3+t*.9,0,TAU); ctx.stroke(); ctx.globalAlpha=1; }
  /* the swipe */
  if(trail.length>1){ ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle=P.ink;
    for(i=1;i<trail.length;i++){ ctx.globalAlpha=calm()?.6:Math.max(0,.75-trail[i].t*3.2); ctx.lineWidth=.05+.05*(i/trail.length); ctx.beginPath(); ctx.moveTo(trail[i-1].x,trail[i-1].y); ctx.lineTo(trail[i].x,trail[i].y); ctx.stroke(); }
    ctx.globalAlpha=1; }
}

/* ---------- visibility, resize ---------- */
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else if(mode==="play") pause("The board left the screen, so the clock stopped."); },{threshold:.15}).observe(view);
document.addEventListener("visibilitychange",function(){ if(document.hidden&&mode==="play") pause(); });
var rz=0; window.addEventListener("resize",function(){ cancelAnimationFrame(rz); rz=requestAnimationFrame(fit); });
if(window.ResizeObserver) new ResizeObserver(function(){ fit(); }).observe(view);
if(mq.addEventListener) mq.addEventListener("change",function(){ fx.length=0; trail.length=0; wake(); });

/* ---------- boot: the first level not yet cleared ---------- */
var start=0; for(var si=0;si<N;si++){ if(unlocked(si)&&save.best[si]<0){ start=si; break; } }
loadLevel(start);
})();
