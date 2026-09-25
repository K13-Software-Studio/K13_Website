/* K13 workbench: five playable mechanics from real projects, plus the hidden layer.
   Contract with the page (index.html / js/site.js):
     mounts   <div data-game="barfix|trustmebro|tiger|carlos|miramar">  (each becomes one card)
     hunt     window.K13.hunt.place(el): turns a small "13" on the page into a hidden mark;
              the page calls it for its own six marks, this file places seven more in the cards
     counter  [data-hunt-counter] in the footer shows "n of 13" once the first mark is found
     theme    13 clicks on a.brand toggle <html data-theme="dark"> (tokens live in css/site.css);
              a real switch appears in [data-theme-slot] once discovered
     blueprint the Konami code toggles <html data-blueprint> and draws the drafting overlay
   Everything that moves is gated by prefers-reduced-motion; everything is keyboard playable. */
(function(){
"use strict";
var reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var fine=window.matchMedia("(pointer: fine)").matches;

function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
var uid=0;

/* card chrome shared by the five games */
function card(mount,o){
  mount.classList.add("wb");
  var head=el("div","wb-head");
  var t=el("div"); t.appendChild(txt("h3","wb-title",o.title)); t.appendChild(txt("span","wb-from","from "+o.from)); head.appendChild(t);
  var reset=txt("button","wb-reset","Reset"); reset.type="button"; reset.setAttribute("aria-label","Reset "+o.title); head.appendChild(reset);
  mount.appendChild(head);
  var iid="wb-i"+(++uid);
  var instr=txt("p","wb-instr",o.instr); instr.id=iid; mount.appendChild(instr);
  var stage=el("div","wb-stage "+(o.stageClass||"")); stage.setAttribute("aria-describedby",iid); mount.appendChild(stage);
  var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
  if(o.foot){ mount.appendChild(txt("p","wb-foot",o.foot)); }
  /* attract loop: moves on its own while in view and untouched, stops at the first interaction */
  var touched=false;
  function attract(on){ mount.classList.toggle("wb-attract",on && !touched && !reduced); }
  new IntersectionObserver(function(es){ attract(es[0].isIntersecting); },{threshold:.35}).observe(mount);
  function touch(){ if(!touched){ touched=true; mount.classList.remove("wb-attract"); } }
  mount.addEventListener("pointerdown",touch,true); mount.addEventListener("keydown",touch,true);
  return {stage:stage,read:read,reset:reset,touch:touch,untouch:function(){ touched=false; }};
}

/* ======================= 1. Pour Check (BarFix) ======================= */
function barfix(mount){
  var c=card(mount,{title:"Pour Check",from:"BarFix",instr:"Drag the bottle onto the scale, or use the arrow keys.",stageClass:"wb-bar",
    foot:"A toy with honest math: 750 ml bottle, 480 g empty, 44 ml pours at $12. The register said it sold 8."});
  var TARE=480,DENS=0.94,POUR=44,PRICE=12,SOLD=8,FULL=750;
  var stage=c.stage, read=c.read;
  var scale=el("div","wb-scale",'<div class="wb-plate"></div><div class="wb-lcd">0 g</div><span class="wb-hunt" data-hunt>13</span>');
  var bottle=el("button","wb-bottle",'<svg viewBox="0 0 40 120" aria-hidden="true"><defs><clipPath id="wbBot'+uid+'"><path d="M13 2h14v22c6 4 10 10 10 20v66a8 8 0 0 1-8 8H11a8 8 0 0 1-8-8V44c0-10 4-16 10-20z"/></clipPath></defs><path class="wb-glass" d="M13 2h14v22c6 4 10 10 10 20v66a8 8 0 0 1-8 8H11a8 8 0 0 1-8-8V44c0-10 4-16 10-20z"/><rect class="wb-fill" x="0" y="0" width="40" height="120" clip-path="url(#wbBot'+uid+')"/><rect class="wb-label" x="7" y="62" width="26" height="22" rx="3"/></svg>');
  bottle.type="button"; bottle.setAttribute("aria-label","Bottle. Arrow keys move it, Enter or Space puts it on the scale.");
  stage.appendChild(scale); stage.appendChild(bottle);
  var x=0,y=0,ml=0,weighed=false,drag=null;
  function level(){ ml=Math.round(120+Math.random()*520); var fill=bottle.querySelector(".wb-fill"); fill.setAttribute("y",String(120-(ml/FULL)*100)); }
  function place(){ bottle.style.transform="translate("+x+"px,"+y+"px)"; check(); }
  function onScale(){ var st=stage.getBoundingClientRect(), s=scale.querySelector(".wb-plate").getBoundingClientRect(); var cx=x+20, by=y+120, sl=s.left-st.left, sr=s.right-st.left, stp=s.top-st.top, sb=s.bottom-st.top; return cx>sl&&cx<sr&&by>stp-6&&by<sb+30; }
  function check(){
    var on=onScale(); if(on===weighed) return; weighed=on; scale.classList.toggle("on",on);
    if(!on){ scale.querySelector(".wb-lcd").textContent="0 g"; read.innerHTML=""; return; }
    var g=Math.round(TARE+ml*DENS), pours=Math.floor(ml/POUR), expected=Math.max(0,FULL-SOLD*POUR), gap=Math.max(0,expected-ml), lost=gap/POUR, money=Math.round(lost*PRICE);
    scale.querySelector(".wb-lcd").textContent=g+" g";
    read.innerHTML='<span>Weight: <b>'+g+' g</b></span><span>Left in bottle: <b>'+ml+' ml</b></span><span>Pours left: <b>'+pours+'</b></span><span>Walked out the door: <b>$'+money+'</b>'+(money?' <i>('+lost.toFixed(1)+' pours the register never saw)</i>':' <i>(the register and the bottle agree)</i>')+'</span>';
  }
  bottle.addEventListener("pointerdown",function(e){ e.preventDefault(); bottle.setPointerCapture(e.pointerId); drag={sx:e.clientX-x,sy:e.clientY-y}; bottle.classList.add("drag"); });
  bottle.addEventListener("pointermove",function(e){ if(!drag) return; var r=stage.getBoundingClientRect(); x=clamp(e.clientX-drag.sx,-10,r.width-50); y=clamp(e.clientY-drag.sy,-10,r.height-130); place(); });
  function drop(){ if(!drag) return; drag=null; bottle.classList.remove("drag"); check(); }
  bottle.addEventListener("pointerup",drop); bottle.addEventListener("pointercancel",drop);
  bottle.addEventListener("keydown",function(e){
    var k=e.key, st=14, r=stage.getBoundingClientRect();
    if(k==="ArrowLeft"){ x-=st; } else if(k==="ArrowRight"){ x+=st; } else if(k==="ArrowUp"){ y-=st; } else if(k==="ArrowDown"){ y+=st; }
    else if(k==="Enter"||k===" "){ var s=scale.querySelector(".wb-plate").getBoundingClientRect(); x=s.left-r.left+s.width/2-20; y=s.top-r.top-118; }
    else return;
    e.preventDefault(); x=clamp(x,-10,r.width-50); y=clamp(y,-10,r.height-130); place();
  });
  function reset(){ x=12; y=Math.max(10,stage.clientHeight-140); weighed=false; scale.classList.remove("on"); level(); place(); read.innerHTML=""; scale.querySelector(".wb-lcd").textContent="0 g"; }
  c.reset.addEventListener("click",function(){ reset(); c.untouch(); });
  window.addEventListener("resize",function(){ x=clamp(x,-10,stage.clientWidth-50); y=clamp(y,-10,stage.clientHeight-130); place(); });
  reset();
}

/* ======================= 2. The Cold Math (TrustMeBro) ======================= */
function trustmebro(mount){
  var c=card(mount,{title:"The Cold Math",from:"TrustMeBro",instr:"Pick the bet with the better math.",stageClass:"wb-tmb",
    foot:"Example odds, chosen to teach. The engine on the real site does this on every wager."});
  var bets=[{n:"Bet A",l:"Underdog +165",odds:2.65,p:.42,morning:"Lost by a field goal. Still the right side of the bet."},
            {n:"Bet B",l:"Favorite −160",odds:1.625,p:.55,morning:"Won anyway. Still the wrong side of the bet."}];
  var btns=[];
  bets.forEach(function(b,i){
    var btn=el("button","wb-bet",'<span class="wb-bet-n">'+b.n+'</span><span class="wb-bet-l">'+b.l+'</span><span class="wb-bet-p">Our number: <b>'+Math.round(b.p*100)+'%</b></span><span class="wb-ev" aria-hidden="true"></span>');
    btn.type="button"; btn.setAttribute("aria-label",b.n+", "+b.l.replace("−","minus ")+", our number "+Math.round(b.p*100)+" percent");
    btn.addEventListener("click",function(){ pick(i); }); c.stage.appendChild(btn); btns.push(btn);
  });
  var slip=el("span","wb-slip",'Slip <span class="wb-hunt" data-hunt>13</span>'); c.stage.appendChild(slip);
  var picked=false;
  function pick(i){
    if(picked) return; picked=true; mount.classList.add("picked");
    var out=[];
    bets.forEach(function(b,j){ var ev=b.p*b.odds-1, plus=ev>0; var t=btns[j].querySelector(".wb-ev"); t.textContent=(plus?"+EV ":"−EV ")+(plus?"+":"")+(ev*100).toFixed(1)+"%"; t.className="wb-ev "+(plus?"plus":"minus"); btns[j].classList.toggle("chosen",j===i); btns[j].disabled=true; btns[j].setAttribute("aria-label",btns[j].getAttribute("aria-label")+". "+t.textContent); out.push(b.n+": "+(plus?"+EV":"−EV")+" ("+(ev*100).toFixed(1)+"%)"); });
    var chosen=bets[i], plus=chosen.p*chosen.odds-1>0;
    c.read.innerHTML='<span>You picked <b>'+chosen.n+'</b>: '+(plus?'the right side.':'the wrong side.')+' '+out.join(" · ")+'</span><span class="wb-morning">The next morning: <b>'+chosen.morning+'</b></span><span><i>The math doesn\'t change because the scoreboard did.</i></span>';
  }
  c.reset.addEventListener("click",function(){ picked=false; mount.classList.remove("picked"); btns.forEach(function(b,j){ b.disabled=false; b.classList.remove("chosen"); b.querySelector(".wb-ev").textContent=""; b.setAttribute("aria-label",bets[j].n+", "+bets[j].l.replace("−","minus ")+", our number "+Math.round(bets[j].p*100)+" percent"); }); c.read.innerHTML=""; c.untouch(); });
}

/* ======================= 3. One Roof (Tiger Hospitality) ======================= */
function tiger(mount){
  var c=card(mount,{title:"One Roof",from:"Tiger Hospitality",instr:"Tap the map to drop a pin.",stageClass:"wb-map"});
  var hoods=["La Jolla","Pacific Beach","North Park","Little Italy","Gaslamp Quarter","Hillcrest","Mission Valley","Point Loma","Bankers Hill","South Park"];
  var svgNS="http://www.w3.org/2000/svg";
  var wrap=el("div","wb-mapwrap");
  wrap.innerHTML='<svg class="wb-svg" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label="An abstract map of the San Diego coastline"><path class="wb-sea" d="M0 0h320v220H0z"/><path class="wb-land" d="M96 0c-6 22-4 44 2 66 4 14-2 26-10 36-10 14-6 30 4 40 8 8 6 20-2 30-6 8-10 18-6 28l6 20h230V0z"/><path class="wb-bay" d="M84 136c8 6 20 6 28 0 8-8 6-22-4-26-10-4-24 2-26 12-1 5 0 10 2 14z"/><path class="wb-coast" d="M96 0c-6 22-4 44 2 66 4 14-2 26-10 36-10 14-6 30 4 40 8 8 6 20-2 30-6 8-10 18-6 28l6 20" fill="none"/><g class="wb-pins"></g><g class="wb-ghost" aria-hidden="true"><path d="M0 -22a8 8 0 0 1 8 8c0 6-8 14-8 14s-8-8-8-14a8 8 0 0 1 8-8z"/></g></svg>';
  c.stage.appendChild(wrap);
  var svg=wrap.querySelector("svg"), pins=svg.querySelector(".wb-pins"), ghost=svg.querySelector(".wb-ghost");
  var hm=el("span","wb-hunt wb-hunt-map",'Sheet <span data-hunt>13</span>'); wrap.appendChild(hm);
  var hm2=el("span","wb-hunt wb-hunt-map2",'Grid <span data-hunt>13</span>'); wrap.appendChild(hm2);
  var kb=txt("button","wb-kbtn","Drop a pin"); kb.type="button"; kb.setAttribute("aria-label","Drop a pin on the map"); c.stage.appendChild(kb);
  var n=0;
  function land(x,y){ /* inside the land polygon: a cheap test against the coastline curve */
    var coast=[[96,0],[92,30],[98,66],[88,102],[92,142],[90,172],[86,200],[90,220]]; var i=0; while(i<coast.length-1&&coast[i+1][1]<y) i++;
    var a=coast[i],b=coast[Math.min(i+1,coast.length-1)], t=b[1]===a[1]?0:(y-a[1])/(b[1]-a[1]); return x>a[0]+(b[0]-a[0])*t+6; }
  function drop(x,y){
    if(n>=hoods.length) return; if(!land(x,y)){ x=Math.max(x,120); }
    var g=document.createElementNS(svgNS,"g"); g.setAttribute("class","wb-pin"); g.setAttribute("transform","translate("+x.toFixed(1)+" "+y.toFixed(1)+")");
    var p=document.createElementNS(svgNS,"path"); p.setAttribute("d","M0 -22a8 8 0 0 1 8 8c0 6-8 14-8 14s-8-8-8-14a8 8 0 0 1 8-8z"); g.appendChild(p);
    var t=document.createElementNS(svgNS,"text"); t.setAttribute("x","12"); t.setAttribute("y","-12"); t.textContent=hoods[n]; g.appendChild(t);
    pins.appendChild(g); n++;
    c.read.innerHTML='<span><b>'+n+'</b> '+(n===1?'neighbourhood':'neighbourhoods')+', one roof.'+(n===hoods.length?' <i>All ten. That is the whole map.</i>':'')+'</span>';
  }
  svg.addEventListener("click",function(e){ var r=svg.getBoundingClientRect(); drop((e.clientX-r.left)/r.width*320,(e.clientY-r.top)/r.height*220); });
  kb.addEventListener("click",function(){ drop(130+Math.random()*170,20+Math.random()*180); });
  c.reset.addEventListener("click",function(){ pins.innerHTML=""; n=0; c.read.innerHTML=""; c.untouch(); });
}

/* ======================= 4. Fire Palette (Carlos Almaraz) ======================= */
function carlos(mount){
  var c=card(mount,{title:"Fire Palette",from:"Carlos Almaraz",instr:"Paint with the palette. Speed changes the brush.",stageClass:"wb-paint",
    foot:"A toy, not his work. Paint at your own risk."});
  var colors=[["Fire","#E24E1B"],["Ink","#141D35"],["Jade","#4F9E92"],["Gold","#F0B429"],["Rose","#E8756A"],["Cream","#F6EEDC"]];
  var pal=el("div","wb-pal"); pal.setAttribute("role","group"); pal.setAttribute("aria-label","Palette");
  var cur=colors[0][1];
  colors.forEach(function(k,i){ var b=el("button","wb-swatch"); b.type="button"; b.style.background=k[1]; b.setAttribute("aria-label",k[0]); b.setAttribute("aria-pressed",String(i===0));
    b.addEventListener("click",function(){ cur=k[1]; pal.querySelectorAll(".wb-swatch").forEach(function(s){ s.setAttribute("aria-pressed","false"); }); b.setAttribute("aria-pressed","true"); }); pal.appendChild(b); });
  var hm=el("span","wb-hunt","13"); hm.setAttribute("data-hunt",""); pal.appendChild(hm);
  c.stage.appendChild(pal);
  var cv=el("canvas","wb-canvas"); cv.setAttribute("role","img"); cv.setAttribute("aria-label","Your painting. Arrow keys move the brush, Space paints."); cv.tabIndex=0; c.stage.appendChild(cv);
  var ring=el("div","wb-ring"); ring.setAttribute("aria-hidden","true"); c.stage.appendChild(ring);
  var ctx=cv.getContext("2d"), last=null, kx=0.5,ky=0.5,painting=false,dirty=false;
  function size(){ var r=cv.getBoundingClientRect(); var img=dirty?ctx.getImageData(0,0,cv.width,cv.height):null; cv.width=Math.round(r.width*devicePixelRatio); cv.height=Math.round(r.height*devicePixelRatio); ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); ctx.lineCap="round"; ctx.lineJoin="round"; if(img) ctx.putImageData(img,0,0); ringAt(); }
  function stroke(x,y,w){ ctx.strokeStyle=cur; ctx.lineWidth=w; ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(x,y); ctx.stroke(); dirty=true; }
  function pos(e){ var r=cv.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top,t:e.timeStamp}; }
  cv.addEventListener("pointerdown",function(e){ e.preventDefault(); cv.setPointerCapture(e.pointerId); clearGhost(); last=pos(e); ctx.fillStyle=cur; ctx.beginPath(); ctx.arc(last.x,last.y,3,0,6.28); ctx.fill(); dirty=true; });
  cv.addEventListener("pointermove",function(e){ if(!last||!(e.buttons&1)) return; var p=pos(e), d=Math.hypot(p.x-last.x,p.y-last.y), dt=Math.max(1,p.t-last.t), v=d/dt; stroke(p.x,p.y,clamp(2+v*14,2,26)); last=p; });
  function up(){ last=null; } cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",up);
  function ringAt(){ var r=cv.getBoundingClientRect(), s=c.stage.getBoundingClientRect(); ring.style.transform="translate("+(r.left-s.left+kx*r.width-9)+"px,"+(r.top-s.top+ky*r.height-9)+"px)"; }
  cv.addEventListener("focus",function(){ ring.classList.add("on"); ringAt(); }); cv.addEventListener("blur",function(){ ring.classList.remove("on"); painting=false; });
  cv.addEventListener("keydown",function(e){
    var st=0.03, r=cv.getBoundingClientRect(), ox=kx,oy=ky;
    if(e.key==="ArrowLeft") kx-=st; else if(e.key==="ArrowRight") kx+=st; else if(e.key==="ArrowUp") ky-=st; else if(e.key==="ArrowDown") ky+=st;
    else if(e.key===" "){ e.preventDefault(); painting=!painting; if(painting){ clearGhost(); ctx.fillStyle=cur; ctx.beginPath(); ctx.arc(kx*r.width,ky*r.height,5,0,6.28); ctx.fill(); dirty=true; } c.read.innerHTML='<span>'+(painting?'Brush down.':'Brush up.')+'</span>'; return; }
    else return;
    e.preventDefault(); kx=clamp(kx,0,1); ky=clamp(ky,0,1);
    if(painting){ last={x:ox*r.width,y:oy*r.height,t:0}; stroke(kx*r.width,ky*r.height,8); }
    ringAt();
  });
  /* attract: a soft arc in fire paints itself once, and vanishes at the first touch */
  var ghost=null;
  function drawGhost(){ if(reduced||dirty||ghost) return; var r=cv.getBoundingClientRect(), t0=null, W=r.width,H=r.height; ghost=true;
    function step(t){ if(!ghost) return; if(!t0) t0=t; var p=Math.min(1,(t-t0)/1600); ctx.strokeStyle="rgba(226,78,27,.55)"; ctx.lineWidth=6+Math.sin(p*3.14)*8; var a=Math.PI*(0.9+p*1.3); var x=W*0.5+Math.cos(a)*W*0.28, y=H*0.55+Math.sin(a)*H*0.3;
      if(step.lx!=null){ ctx.beginPath(); ctx.moveTo(step.lx,step.ly); ctx.lineTo(x,y); ctx.stroke(); } step.lx=x; step.ly=y; if(p<1) requestAnimationFrame(step); }
    requestAnimationFrame(step); }
  function clearGhost(){ if(ghost){ ghost=null; if(!dirty) ctx.clearRect(0,0,cv.width,cv.height); } }
  new IntersectionObserver(function(es){ if(es[0].isIntersecting) drawGhost(); },{threshold:.4}).observe(mount);
  c.reset.addEventListener("click",function(){ ctx.clearRect(0,0,cv.width,cv.height); dirty=false; ghost=null; painting=false; c.read.innerHTML=""; c.untouch(); });
  window.addEventListener("resize",size); setTimeout(size,0);
}

/* ======================= 5. Opening Night (Miramar Food Hall) ======================= */
function miramar(mount){
  var c=card(mount,{title:"Opening Night",from:"Miramar Food Hall",instr:"Tap or press space to light a bulb.",stageClass:"wb-sign"});
  var sign=el("div","wb-marquee",'<div class="wb-board"><span class="wb-board-t">MIRAMAR</span><span class="wb-board-s">Food hall · est. 1938 · <span class="wb-hunt" data-hunt>13</span> bulbs</span></div><div class="wb-bulbs" role="group" aria-label="Thirteen marquee bulbs"></div><span class="wb-hunt wb-row13">Row <span data-hunt>13</span></span>');
  c.stage.appendChild(sign);
  var row=sign.querySelector(".wb-bulbs"), bulbs=[], lit=0, done=false;
  for(var i=0;i<13;i++){ (function(i){ var b=el("button","wb-bulb"); b.type="button"; b.setAttribute("aria-pressed","false"); b.setAttribute("aria-label","Bulb "+(i+1)+" of 13"); b.style.setProperty("--d",i);
    b.addEventListener("click",function(){ if(b.getAttribute("aria-pressed")==="true") return; b.setAttribute("aria-pressed","true"); lit++; c.read.innerHTML='<span><b>'+lit+'</b> of 13 lit.</span>'; if(lit===13) finish(); });
    row.appendChild(b); bulbs.push(b); })(i); }
  function finish(){ done=true; sign.classList.add("lit"); if(!reduced){ sign.classList.add("chase"); setTimeout(function(){ sign.classList.remove("chase"); },2200); } c.read.innerHTML='<span><b>All thirteen lit. Opening night.</b></span>'; }
  c.reset.addEventListener("click",function(){ lit=0; done=false; sign.classList.remove("lit","chase"); bulbs.forEach(function(b){ b.setAttribute("aria-pressed","false"); }); c.read.innerHTML=""; c.untouch(); });
}

/* ======================= The hunt: find the 13 ======================= */
var hunt=(function(){
  var TOTAL=13, marks=[], found={}, counter=null, live=null, announced=false;
  try{ found=JSON.parse(store("k13-hunt")||"{}")||{}; }catch(e){ found={}; }
  function save(){ store("k13-hunt",JSON.stringify(found)); }
  function count(){ var n=0; marks.forEach(function(m){ if(found[m.key]) n++; }); return n; }
  function counterEl(){ if(counter) return counter; counter=document.querySelector("[data-hunt-counter]"); return counter; }
  function render(){
    var n=count(), ce=counterEl(); if(!ce) return;
    if(n>0){ ce.hidden=false; ce.textContent=n+" of "+TOTAL; ce.setAttribute("aria-label","Hidden thirteens found: "+n+" of "+TOTAL); }
  }
  function place(node){
    if(!node||node.hasAttribute("data-hunt-placed")) return null;
    if(node.closest("a,button")) return null;                       /* a mark cannot live inside another control */
    var key="m"+marks.length; node.setAttribute("data-hunt-placed",key);
    var b=el("button","hunt-mark"); b.type="button"; b.textContent=node.textContent.trim()||"13"; node.textContent=""; node.appendChild(b);
    var m={key:key,btn:b}; marks.push(m);
    function label(){ var n=count(); b.setAttribute("aria-label",(found[key]?"Found, ":"Hidden 13, ")+(marks.indexOf(m)+1)+" of "+TOTAL); b.setAttribute("aria-pressed",String(!!found[key])); b.classList.toggle("found",!!found[key]); }
    b.addEventListener("click",function(e){ e.preventDefault(); e.stopPropagation(); if(found[key]) return; found[key]=1; save(); label(); render(); var n=count(); if(!live){ live=el("span","vh"); live.setAttribute("role","status"); live.setAttribute("aria-live","polite"); document.body.appendChild(live); } live.textContent="Hidden 13 found, "+n+" of "+TOTAL+"."; if(n===TOTAL&&marks.length===TOTAL) celebrate(); });
    label(); render(); return b;
  }
  function celebrate(){
    if(announced) return; announced=true;
    var d=el("div","hunt-done"); d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-labelledby","huntDoneTitle");
    d.innerHTML='<div class="hunt-card"><span class="hunt-13" aria-hidden="true">13</span><h3 id="huntDoneTitle">You found all thirteen.</h3><p>Most people leave by three.</p><p>That kind of attention is exactly what we build for.</p><div class="hunt-row"><button type="button" class="hunt-go">Say hello</button><button type="button" class="hunt-close">Close</button></div></div>';
    document.body.appendChild(d); var go=d.querySelector(".hunt-go"), close=d.querySelector(".hunt-close"), prev=document.activeElement;
    function shut(){ d.remove(); if(prev&&prev.focus) prev.focus(); document.removeEventListener("keydown",key); }
    function key(e){ if(e.key==="Escape") shut(); if(e.key==="Tab"){ var f=[go,close]; if(e.shiftKey&&document.activeElement===go){ e.preventDefault(); close.focus(); } else if(!e.shiftKey&&document.activeElement===close){ e.preventDefault(); go.focus(); } } }
    document.addEventListener("keydown",key); close.addEventListener("click",shut);
    go.addEventListener("click",function(){ try{ sessionStorage.setItem("k13Subject","I found all 13"); }catch(e){} shut(); var t=document.getElementById("contact"); if(t){ if(window.__k13Lenis) window.__k13Lenis.scrollTo(t,{offset:-30}); else t.scrollIntoView({behavior:reduced?"auto":"smooth"}); } });
    setTimeout(function(){ go.focus(); },30);
  }
  return {place:place,count:count,total:TOTAL};
})();

/* ======================= Night shift ======================= */
(function(){
  var html=document.documentElement, brand=document.querySelector("a.brand"), slot=document.querySelector("[data-theme-slot]");
  var known=store("k13-night")!==null; var theme=store("k13-theme");
  function apply(dark){ if(dark) html.setAttribute("data-theme","dark"); else html.removeAttribute("data-theme"); store("k13-theme",dark?"dark":"light"); if(sw){ sw.setAttribute("aria-checked",String(dark)); } }
  var sw=null;
  function reveal(){ if(sw||!slot) return; sw=el("button","night-switch",'<span class="knob" aria-hidden="true"></span><span>Night shift</span>'); sw.type="button"; sw.setAttribute("role","switch"); sw.setAttribute("aria-label","Switch to the dark theme"); sw.setAttribute("aria-checked",String(html.getAttribute("data-theme")==="dark")); sw.addEventListener("click",function(){ apply(html.getAttribute("data-theme")!=="dark"); }); slot.appendChild(sw); store("k13-night","1"); }
  if(theme==="dark") apply(true); if(known) reveal();
  if(!brand) return; var clicks=0, timer=null;
  brand.addEventListener("click",function(){ clicks++; clearTimeout(timer); timer=setTimeout(function(){ clicks=0; },6000); if(clicks===13){ clicks=0; reveal(); apply(html.getAttribute("data-theme")!=="dark"); } });
})();

/* ======================= Blueprint (Konami) ======================= */
(function(){
  var seq=["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"], at=0, html=document.documentElement, layer=null;
  function draw(){
    if(!layer){ layer=el("div","blueprint"); layer.setAttribute("aria-hidden","true"); document.body.appendChild(layer); }
    layer.innerHTML='<div class="bp-cap" role="status">Blueprint mode. Esc to close.</div>';
    document.querySelectorAll("main > section, footer").forEach(function(s){ var r=s.getBoundingClientRect(); var b=el("div","bp-box"); b.style.left=(r.left+scrollX)+"px"; b.style.top=(r.top+scrollY)+"px"; b.style.width=r.width+"px"; b.style.height=r.height+"px"; b.appendChild(txt("span","bp-lab",(s.id?"#"+s.id:s.tagName.toLowerCase())+" · "+Math.round(r.width)+" × "+Math.round(r.height)+" px")); layer.appendChild(b); });
  }
  function on(){ html.setAttribute("data-blueprint",""); draw(); window.addEventListener("resize",draw); }
  function off(){ html.removeAttribute("data-blueprint"); if(layer){ layer.remove(); layer=null; } window.removeEventListener("resize",draw); }
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"&&html.hasAttribute("data-blueprint")){ off(); return; }
    var k=e.key.length===1?e.key.toLowerCase():e.key;
    at=(k===seq[at])?at+1:(k===seq[0]?1:0);
    if(at===seq.length){ at=0; if(html.hasAttribute("data-blueprint")) off(); else on(); }
  });
})();

/* ======================= Idle pencil ======================= */
(function(){
  if(reduced||!fine) return; var timer=null, drawn=false;
  function arm(){ clearTimeout(timer); if(!drawn) timer=setTimeout(draw,10000); }
  ["pointermove","keydown","scroll","pointerdown"].forEach(function(ev){ addEventListener(ev,arm,{passive:true}); });
  function draw(){
    if(drawn) return; var hs=document.querySelectorAll("h1, h2"), best=null, bd=1e9, mid=innerHeight/2;
    hs.forEach(function(h){ var r=h.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight) return; var d=Math.abs((r.top+r.height/2)-mid); if(d<bd){ bd=d; best=r; } });
    if(!best) return; drawn=true;
    var pad=14, w=best.width+pad*2, h=best.height+pad*2, svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("class","pencil"); svg.setAttribute("aria-hidden","true"); svg.setAttribute("viewBox","0 0 "+w+" "+h); svg.style.left=(best.left-pad)+"px"; svg.style.top=(best.top-pad)+"px"; svg.style.width=w+"px"; svg.style.height=h+"px";
    var rx=w/2, ry=h/2; var d="M"+(rx*0.1)+" "+(ry*1.05)+" C "+(rx*0.05)+" "+(ry*0.2)+", "+(w*0.9)+" "+(ry*0.05)+", "+(w*0.98)+" "+(ry*0.9)+" S "+(w*0.3)+" "+(h*1.02)+", "+(rx*0.2)+" "+(ry*1.1);
    var p=document.createElementNS("http://www.w3.org/2000/svg","path"); p.setAttribute("d",d); svg.appendChild(p); document.body.appendChild(svg);
    var len=p.getTotalLength(); p.style.strokeDasharray=len; p.style.strokeDashoffset=len; requestAnimationFrame(function(){ p.style.strokeDashoffset=0; });
    setTimeout(function(){ svg.classList.add("gone"); setTimeout(function(){ svg.remove(); },600); },3400);
  }
  arm();
})();

/* ======================= boot ======================= */
window.K13=window.K13||{}; window.K13.hunt=hunt;
var games={barfix:barfix,trustmebro:trustmebro,tiger:tiger,carlos:carlos,miramar:miramar};
document.querySelectorAll("[data-game]").forEach(function(m){ var g=games[m.getAttribute("data-game")]; if(g) g(m); });
document.querySelectorAll(".wb [data-hunt]").forEach(function(n){ hunt.place(n); });
})();
