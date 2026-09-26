/* K13 workbench: two playable pieces from real projects, plus the hidden layer.
   Contract with the page (index.html / js/site.js):
     mounts   <div data-game="carlos|miramar">  (each becomes one card)
     hunt     window.K13.hunt.place(el): turns a small "13" on the page into a hidden mark;
              the page calls it for its own nine marks, this file places four more in the cards
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
function lerp(a,b,t){ return a+(b-a)*t; }
/* cubic-bezier progress solver, so a JS-driven tween can use the same signature easings as CSS */
function bezier(x1,y1,x2,y2){
  function A(a1,a2){ return 1-3*a2+3*a1; } function B(a1,a2){ return 3*a2-6*a1; } function C(a1){ return 3*a1; }
  function calcX(t){ return ((A(x1,x2)*t+B(x1,x2))*t+C(x1))*t; } function calcY(t){ return ((A(y1,y2)*t+B(y1,y2))*t+C(y1))*t; }
  function slope(t){ return 3*A(x1,x2)*t*t+2*B(x1,x2)*t+C(x1); }
  return function(x){ var t=x; for(var i=0;i<6;i++){ var dx=calcX(t)-x; if(Math.abs(dx)<1e-4) break; var d=slope(t); if(Math.abs(d)<1e-6) break; t-=dx/d; } return calcY(t); };
}
var POP=bezier(.34,1.56,.64,1); /* the playful overshoot, run in JS for toys that can't use a CSS transition */
var uid=0;

/* card chrome shared by the five games */
function card(mount,o){
  mount.classList.add("wb");
  var head=el("div","wb-head");
  var t=el("div"); t.appendChild(txt("h3","wb-title",o.title)); t.appendChild(txt("span","wb-from","from "+o.from)); head.appendChild(t);
  mount.appendChild(head);
  var iid="wb-i"+(++uid);
  var instr=txt("p","wb-instr",o.instr); instr.id=iid; mount.appendChild(instr);
  var stage=el("div","wb-stage "+(o.stageClass||"")); stage.setAttribute("aria-describedby",iid); mount.appendChild(stage);
  var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Reset</span>'); reset.type="button"; reset.setAttribute("aria-label","Reset "+o.title); stage.appendChild(reset);
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

/* ======================= 1. Fire Palette (Carlos Almaraz) ======================= */
/* Mirror painting: every stroke is echoed across the canvas, so anything turns into a composition. */
function carlos(mount){
  var c=card(mount,{title:"Fire Palette",from:"Carlos Almaraz",instr:"Paint anything. The mirror turns it into a composition.",stageClass:"wb-paint",
    foot:"A toy, not his work. Paint at your own risk."});
  c.stage.parentNode.querySelector(".wb-foot").insertAdjacentHTML("beforeend",' Plate <span data-hunt>13</span>.');
  var colors=[["Fire","#E24E1B"],["Ink","#141D35"],["Jade","#4F9E92"],["Gold","#F0B429"],["Rose","#E8756A"],["Cream","#F6EEDC"]];
  var bar=el("div","wb-pal"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Palette");
  var cur=colors[0][1], mode=4;
  colors.forEach(function(k,i){ var b=el("button","wb-swatch"); b.type="button"; b.style.background=k[1]; b.setAttribute("aria-label",k[0]); b.setAttribute("aria-pressed",String(i===0));
    b.addEventListener("click",function(){ cur=k[1]; bar.querySelectorAll(".wb-swatch").forEach(function(s){ s.setAttribute("aria-pressed","false"); }); b.setAttribute("aria-pressed","true"); }); bar.appendChild(b); });
  var mir=txt("button","wb-mirror","Mirror: 4"); mir.type="button"; mir.setAttribute("aria-label","Mirror, 4 ways. Press to change");
  mir.addEventListener("click",function(){ mode=mode===4?6:mode===6?1:mode===1?2:4; mir.textContent="Mirror: "+(mode===1?"off":mode); mir.setAttribute("aria-label","Mirror, "+(mode===1?"off":mode+" ways")+". Press to change"); });
  bar.appendChild(mir);
  var hm=el("span","wb-hunt","13"); hm.setAttribute("data-hunt",""); bar.appendChild(hm);
  c.stage.appendChild(bar);
  var cv=el("canvas","wb-canvas"); cv.setAttribute("role","img"); cv.setAttribute("aria-label","Your painting. Arrow keys move the brush, Space lifts or lowers it."); cv.tabIndex=0; c.stage.appendChild(cv);
  var ring=el("div","wb-ring"); ring.setAttribute("aria-hidden","true"); c.stage.appendChild(ring);
  var ctx=cv.getContext("2d"), last=null, kx=0.62,ky=0.4,painting=false,dirty=false,W=0,H=0;
  function size(){ var r=cv.getBoundingClientRect(); if(!r.width) return; var img=dirty?cv.toDataURL():null; W=r.width; H=r.height; cv.width=Math.round(W*devicePixelRatio); cv.height=Math.round(H*devicePixelRatio); ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); ctx.lineCap="round"; ctx.lineJoin="round"; if(img){ var im=new Image(); im.onload=function(){ ctx.drawImage(im,0,0,W,H); }; im.src=img; } ringAt(); }
  function sym(x,y){ var cx=W/2, cy=H/2, dx=x-cx, dy=y-cy, out=[];
    if(mode===1) return [[x,y]]; if(mode===2) return [[x,y],[W-x,y]];
    var n=mode, r=Math.hypot(dx,dy), a=Math.atan2(dy,dx);
    for(var i=0;i<n;i++){ var t=a+i*2*Math.PI/n; out.push([cx+r*Math.cos(t),cy+r*Math.sin(t)]); if(n===4){ var t2=-a+i*2*Math.PI/n; out.push([cx+r*Math.cos(t2),cy+r*Math.sin(t2)]); } }
    return out; }
  function stroke(x0,y0,x1,y1,w){ var A=sym(x0,y0), B=sym(x1,y1); ctx.strokeStyle=cur; ctx.lineWidth=w; for(var i=0;i<A.length;i++){ ctx.beginPath(); ctx.moveTo(A[i][0],A[i][1]); ctx.lineTo(B[i][0],B[i][1]); ctx.stroke(); } dirty=true; }
  function dot(x,y,r){ ctx.fillStyle=cur; sym(x,y).forEach(function(p){ ctx.beginPath(); ctx.arc(p[0],p[1],r,0,6.28); ctx.fill(); }); dirty=true; }
  function pos(e){ var r=cv.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top,t:e.timeStamp}; }
  cv.addEventListener("pointerdown",function(e){ e.preventDefault(); cv.setPointerCapture(e.pointerId); clearGhost(); last=pos(e); dot(last.x,last.y,3); });
  cv.addEventListener("pointermove",function(e){ if(!last||!(e.buttons&1)) return; var p=pos(e), d=Math.hypot(p.x-last.x,p.y-last.y), dt=Math.max(1,p.t-last.t), v=d/dt; stroke(last.x,last.y,p.x,p.y,clamp(2+v*12,2,22)); last=p; });
  function up(){ last=null; } cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",up);
  function ringAt(){ var r=cv.getBoundingClientRect(), s=c.stage.getBoundingClientRect(); ring.style.transform="translate("+(r.left-s.left+kx*r.width-9)+"px,"+(r.top-s.top+ky*r.height-9)+"px)"; }
  cv.addEventListener("focus",function(){ ring.classList.add("on"); ringAt(); }); cv.addEventListener("blur",function(){ ring.classList.remove("on"); painting=false; });
  cv.addEventListener("keydown",function(e){
    var st=0.03, ox=kx,oy=ky;
    if(e.key==="ArrowLeft") kx-=st; else if(e.key==="ArrowRight") kx+=st; else if(e.key==="ArrowUp") ky-=st; else if(e.key==="ArrowDown") ky+=st;
    else if(e.key===" "){ e.preventDefault(); painting=!painting; if(painting){ clearGhost(); dot(kx*W,ky*H,5); } c.read.innerHTML='<span>'+(painting?'Brush down.':'Brush up.')+'</span>'; return; }
    else return;
    e.preventDefault(); kx=clamp(kx,0,1); ky=clamp(ky,0,1);
    if(painting) stroke(ox*W,oy*H,kx*W,ky*H,8);
    ringAt();
  });
  /* attract: a single flame curl draws itself through the mirror, then waits for a hand */
  var ghost=null;
  function drawGhost(){ if(reduced||dirty||ghost||!W) return; ghost=true; var t0=null, lx=null, ly=null, saved=cur; cur="rgba(226,78,27,.6)";
    (function step(t){ if(!ghost){ cur=saved; return; } if(!t0) t0=t; var p=Math.min(1,(t-t0)/1800); var a=p*Math.PI*1.6, r=W*0.08+p*W*0.22;
      var x=W/2+Math.cos(a)*r, y=H/2+Math.sin(a)*r*0.8; if(lx!=null){ stroke(lx,ly,x,y,3+Math.sin(p*3.14)*5); } lx=x; ly=y;
      if(p<1) requestAnimationFrame(step); else { cur=saved; dirty=false; } })(performance.now()); }
  function clearGhost(){ if(ghost){ ghost=null; if(!dirty||true){ ctx.clearRect(0,0,cv.width,cv.height); dirty=false; } } }
  new IntersectionObserver(function(es){ if(es[0].isIntersecting) drawGhost(); },{threshold:.4}).observe(mount);
  c.reset.setAttribute("aria-label","Clear the canvas"); c.reset.querySelector("span").textContent="Clear";
  c.reset.addEventListener("click",function(){ ctx.clearRect(0,0,cv.width,cv.height); dirty=false; ghost=null; painting=false; c.read.innerHTML=""; c.untouch(); });
  window.addEventListener("resize",size); setTimeout(size,0);
}

/* ======================= 2. Opening Night (Miramar Food Hall) ======================= */
/* Simon, on a marquee: the sign plays a pattern, you repeat it. Each round is one bulb longer. */
function miramar(mount){
  var c=card(mount,{title:"Opening Night",from:"Miramar Food Hall",instr:"Watch the marquee, then repeat the pattern. Reach 13 to open the doors.",stageClass:"wb-sign"});
  var sign=el("div","wb-marquee",'<div class="wb-board"><span class="wb-board-t">MIRAMAR</span><span class="wb-board-s">Food hall · est. 1938 · reach <span class="wb-hunt" data-hunt>13</span></span></div><div class="wb-bulbs" role="group" aria-label="Marquee bulbs"></div><div class="wb-mctl"><button type="button" class="wb-start">Start the show</button><span class="wb-hunt wb-row13">Row <span data-hunt>13</span></span></div>');
  c.stage.appendChild(sign);
  var row=sign.querySelector(".wb-bulbs"), start=sign.querySelector(".wb-start"), bulbs=[], N=7;
  var seq=[], at=0, playing=false, accepting=false, best=0, gen=0; try{ best=+(localStorage.getItem("k13-marquee")||0); }catch(e){}
  for(var i=0;i<N;i++){ (function(i){ var b=el("button","wb-bulb"); b.type="button"; b.setAttribute("aria-label","Bulb "+(i+1)); b.style.setProperty("--d",i);
    b.addEventListener("click",function(){ press(i); }); row.appendChild(b); bulbs.push(b); })(i); }
  function flash(i,ms){ var b=bulbs[i]; b.classList.add("on"); setTimeout(function(){ b.classList.remove("on"); },ms||380); }
  function status(t){ c.read.innerHTML='<span>'+t+'</span>'; }
  function play(){
    var g=gen; if(!seq.length) return;
    playing=true; accepting=false; at=0; sign.classList.add("showing"); status('Round <b>'+seq.length+'</b>. Watch the sign.');
    var gap=reduced?900:Math.max(360,620-seq.length*20), k=0;
    (function step(){ if(g!==gen) return; if(k>=seq.length){ playing=false; accepting=true; sign.classList.remove("showing"); status('Round <b>'+seq.length+'</b>. Your turn: '+seq.length+' bulb'+(seq.length>1?'s':'')+'.'); if(bulbs[0]) bulbs[seq[0]]&&null; return; }
      flash(seq[k],gap*0.6); k++; setTimeout(step,gap); })();
  }
  function grow(){ var g=gen; seq.push(Math.floor(Math.random()*N)); setTimeout(function(){ if(g===gen) play(); },reduced?200:500); }
  function press(i){
    if(!accepting){ if(!playing&&!seq.length) flash(i,200); return; }
    flash(i,220);
    if(i!==seq[at]){ accepting=false; var got=seq.length-1; if(got>best){ best=got; try{ localStorage.setItem("k13-marquee",String(best)); }catch(e){} }
      sign.classList.add("miss"); setTimeout(function(){ sign.classList.remove("miss"); },500);
      status('<b>Wrong bulb.</b> You held '+got+' in your head. Best: '+best+'.'); start.textContent="Try again"; start.hidden=false; return; }
    at++;
    if(at===seq.length){ accepting=false;
      if(seq.length>=13){ sign.classList.add("lit"); if(!reduced){ sign.classList.add("chase"); setTimeout(function(){ sign.classList.remove("chase"); },2400); } best=13; try{ localStorage.setItem("k13-marquee","13"); }catch(e){}
        status('<b>Thirteen. Doors open, opening night.</b>'); start.textContent="Play again"; start.hidden=false; return; }
      status('<b>'+seq.length+'</b> right.'); var g=gen; setTimeout(function(){ if(g===gen) grow(); },450); }
  }
  start.addEventListener("click",function(){ gen++; seq=[]; start.hidden=true; sign.classList.remove("lit"); grow(); var b=bulbs[0]; if(b) setTimeout(function(){ b.focus({preventScroll:true}); },50); });
  c.reset.addEventListener("click",function(){ gen++; seq=[]; at=0; playing=false; accepting=false; bulbs.forEach(function(b){ b.classList.remove("on"); }); start.textContent="Start the show"; start.hidden=false; sign.classList.remove("lit","chase","showing"); status(best?'Best so far: <b>'+best+'</b>.':''); c.untouch(); });
  status(best?'Best so far: <b>'+best+'</b>.':'');
}

/* ======================= 3. Endless Spiral (Egg & Out) ======================= */
/* Their wordmark spirals on without end. Grab it and spin it; flick it and it keeps turning. */
var FONT_DISP=null;
function egg(mount){
  var c=card(mount,{title:"Endless Spiral",from:"Egg & Out",instr:"Grab the spiral and spin it. Flick it hard and it keeps going.",stageClass:"wb-egg"});
  var cv=el("canvas","wb-eggcv"); cv.setAttribute("role","img"); cv.setAttribute("aria-label","A spiral made of the words EGG AND OUT, repeating outward. Drag in a circle to spin it, or use the left and right arrow keys."); cv.tabIndex=0; c.stage.appendChild(cv);
  var ctx=cv.getContext("2d"), W=0,H=0,DPR=Math.min(2,window.devicePixelRatio||1);
  if(!FONT_DISP) FONT_DISP=(getComputedStyle(document.documentElement).getPropertyValue("--disp")||"serif").trim();
  var YOLK="#8A5206", ORANGE="#B94612", CREAM="#F6EEDC";
  var STR="EGG & OUT   ", widths=null, fontPx=16;
  function buildWidths(){ ctx.font="600 "+fontPx+"px "+FONT_DISP; widths={}; for(var i=0;i<STR.length;i++){ var ch=STR[i]; if(widths[ch]==null) widths[ch]=Math.max(2,ctx.measureText(ch).width); } }
  var angle=0, vel=0, settle=null, dragging=false, lastAng=0, lastT=0, keyDir=0, keyHeldT=0, frameT=0, inView=false, raf=null, gen=0;
  function size(){ var r=cv.getBoundingClientRect(); if(!r.width) return; W=r.width; H=r.height; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); fontPx=Math.max(10,Math.min(W,H)*0.052); buildWidths(); draw(); }
  function draw(){
    ctx.clearRect(0,0,W,H); ctx.fillStyle=CREAM; ctx.fillRect(0,0,W,H);
    var cx=W/2, cy=H/2, maxR=Math.min(W,H)*0.47, innerR=Math.max(10,maxR*0.12), turns=3.1;
    var b=(maxR-innerR)/(turns*2*Math.PI);
    var speed=Math.abs(vel), stretch=1+Math.min(1.1,speed/9), blur=reduced?0:Math.min(2.4,Math.max(0,speed-2.2)*0.4);
    ctx.font="600 "+fontPx+"px "+FONT_DISP; ctx.textBaseline="middle"; ctx.textAlign="center";
    ctx.filter=blur>0.05?("blur("+blur+"px)"):"none";
    var theta=(innerR/b)||0.001, thetaStart=theta, maxTheta=turns*2*Math.PI+theta, i=0, guard=0;
    while(theta<maxTheta && guard<400){
      guard++; var ch=STR[i%STR.length]; i++;
      var w=widths[ch]||fontPx*0.55, ds=(ch===" "?w*0.9:w+fontPx*0.09);
      if(ch!==" "){
        var r=b*theta, ang=theta+angle, x=cx+r*Math.cos(ang), y=cy+r*Math.sin(ang), lap=Math.floor((theta-thetaStart)/(2*Math.PI));
        ctx.save(); ctx.translate(x,y); ctx.rotate(ang+Math.PI/2);
        if(stretch>1.02) ctx.scale(1,stretch);
        ctx.fillStyle=(lap%2===0)?ORANGE:YOLK; ctx.fillText(ch,0,0); ctx.restore();
      }
      theta+=ds/(b*Math.sqrt(1+theta*theta));
    }
    ctx.filter="none";
  }
  function pos(e){ var r=cv.getBoundingClientRect(); return {x:e.clientX-r.left-W/2,y:e.clientY-r.top-H/2}; }
  cv.addEventListener("pointerdown",function(e){ e.preventDefault(); cv.setPointerCapture(e.pointerId); dragging=true; settle=null; vel=0; var p=pos(e); lastAng=Math.atan2(p.y,p.x); lastT=performance.now(); c.read.innerHTML="<span>Spinning.</span>"; });
  cv.addEventListener("pointermove",function(e){ if(!dragging) return; var p=pos(e), a=Math.atan2(p.y,p.x), d=a-lastAng; if(d>Math.PI) d-=2*Math.PI; else if(d<-Math.PI) d+=2*Math.PI; var now=performance.now(), dt=Math.max(1,now-lastT)/1000; angle+=d; vel=reduced?0:(vel*0.7+(d/dt)*0.3); lastAng=a; lastT=now; if(reduced) draw(); });
  function endDrag(){ if(!dragging) return; dragging=false; if(reduced){ vel=0; } else if(Math.abs(vel)>0.6){ c.read.innerHTML="<span>Flicked.</span>"; } }
  cv.addEventListener("pointerup",endDrag); cv.addEventListener("pointercancel",endDrag);
  cv.addEventListener("keydown",function(e){
    if(e.key==="ArrowLeft"){ e.preventDefault(); keyDir=-1; } else if(e.key==="ArrowRight"){ e.preventDefault(); keyDir=1; } else return;
  });
  cv.addEventListener("keyup",function(e){ if(e.key==="ArrowLeft"||e.key==="ArrowRight"){ keyDir=0; keyHeldT=0; } });
  function step(now){
    if(!inView){ raf=null; return; }
    var dt=Math.min(0.05,frameT?((now-frameT)/1000):0.016); frameT=now;
    if(!dragging){
      if(keyDir){
        if(reduced){ angle+=keyDir*0.05; } else { keyHeldT=Math.min(1,keyHeldT+dt*0.9); vel+=keyDir*(3+keyHeldT*15)*dt; settle=null; }
      } else if(!reduced){
        if(settle){
          var t=(now-settle.t0)/1000, zeta=.42, wn=8, wd=wn*Math.sqrt(1-zeta*zeta), env=Math.exp(-zeta*wn*t);
          vel=settle.v0*env*Math.cos(wd*t); if(env<0.02){ settle=null; vel=0; }
        } else if(Math.abs(vel)>0.45){
          vel*=Math.pow(0.9,dt*60); if(Math.abs(vel)<0.45) settle={v0:vel,t0:now};
        } else if(Math.abs(vel)>0.001){ vel*=Math.pow(0.86,dt*60); if(Math.abs(vel)<0.02) vel=0; }
        if(!settle && Math.abs(vel)<0.2 && mount.classList.contains("wb-attract")) vel+=(0.14-vel)*dt*1.5;
      }
      angle+=vel*dt;
    }
    draw(); raf=requestAnimationFrame(step);
  }
  new IntersectionObserver(function(es){ inView=es[0].isIntersecting; if(inView){ if(!W) size(); if(!raf) raf=requestAnimationFrame(step); } },{threshold:.1}).observe(mount);
  c.reset.addEventListener("click",function(){ gen++; angle=0; vel=0; settle=null; dragging=false; keyDir=0; keyHeldT=0; c.read.innerHTML=""; draw(); c.untouch(); });
  window.addEventListener("resize",size); setTimeout(size,0);
}

/* ======================= 4. Night Shift Deck (CENGO) ======================= */
/* A record on a turntable. Drag a circle to scratch it, let go and it spins back up. */
function cengo(mount){
  var c=card(mount,{title:"Night Shift Deck",from:"CENGO",instr:"Drag the record in a circle to scratch it. Space plays or pauses. Sound stays off until you switch it on.",stageClass:"wb-deck"});
  c.stage.insertAdjacentHTML("beforeend",
    '<div class="wb-plat" tabindex="0" role="img" aria-label="A record on a turntable. Drag in a circle to scratch it, or use the left and right arrow keys. Space plays or pauses.">'+
      '<div class="wb-grooves"></div><div class="wb-glint"></div>'+
      '<div class="wb-label"><span class="wb-label-t">CENGO</span><span class="wb-label-s">Night Shift</span></div>'+
    '</div>'+
    '<div class="wb-vu" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div>'+
    '<div class="wb-dctl">'+
      '<button type="button" class="wb-play" aria-pressed="false">Play</button>'+
      '<button type="button" class="wb-sound" role="switch" aria-checked="false" aria-label="Sound"><span class="knob" aria-hidden="true"></span><span>Sound</span></button>'+
    '</div>');
  var plat=c.stage.querySelector(".wb-plat"), vu=[].slice.call(c.stage.querySelectorAll(".wb-vu span")), playBtn=c.stage.querySelector(".wb-play"), soundBtn=c.stage.querySelector(".wb-sound");
  var angle=0, vel=0, dragging=false, lastAng=0, lastDragT=0, keyDir=0, keyHeldT=0, playing=false, soundOn=false, inView=false, raf=null, frameT=0, vuPhase=0, gen=0;
  var TARGET=230, IDLE=16;
  function setAngle(){ plat.style.transform="rotate("+angle+"deg)"; }
  function pos(e){ var r=plat.getBoundingClientRect(); return {x:e.clientX-r.left-r.width/2,y:e.clientY-r.top-r.height/2}; }
  plat.addEventListener("pointerdown",function(e){ e.preventDefault(); plat.setPointerCapture(e.pointerId); dragging=true; var p=pos(e); lastAng=Math.atan2(p.y,p.x)*180/Math.PI; lastDragT=performance.now(); c.read.innerHTML="<span>Scratching.</span>"; });
  plat.addEventListener("pointermove",function(e){ if(!dragging) return; var p=pos(e), a=Math.atan2(p.y,p.x)*180/Math.PI, d=a-lastAng; if(d>180) d-=360; else if(d<-180) d+=360; var now=performance.now(), dt=Math.max(1,now-lastDragT)/1000; angle+=d; vel=reduced?0:(vel*0.6+(d/dt)*0.4); lastAng=a; lastDragT=now; setAngle(); });
  function endDrag(){ if(!dragging) return; dragging=false; if(reduced) vel=0; }
  plat.addEventListener("pointerup",endDrag); plat.addEventListener("pointercancel",endDrag);
  function togglePlay(){ playing=!playing; playBtn.setAttribute("aria-pressed",String(playing)); playBtn.textContent=playing?"Pause":"Play"; c.read.innerHTML=playing?"<span>Spinning up.</span>":"<span>Cutting the power.</span>"; }
  playBtn.addEventListener("click",togglePlay);
  plat.addEventListener("keydown",function(e){
    if(e.key===" "){ e.preventDefault(); togglePlay(); return; }
    if(e.key==="ArrowLeft"){ e.preventDefault(); keyDir=-1; } else if(e.key==="ArrowRight"){ e.preventDefault(); keyDir=1; } else return;
  });
  plat.addEventListener("keyup",function(e){ if(e.key==="ArrowLeft"||e.key==="ArrowRight"){ keyDir=0; keyHeldT=0; } });
  /* sound: synthesized noise + tone, off by default, only ever starts from the switch's own click */
  var actx=null,gainN=null,filt=null,oscGain=null,osc=null;
  function ensureAudio(){
    if(actx) return; var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); var buf=actx.createBuffer(1,actx.sampleRate*2,actx.sampleRate), data=buf.getChannelData(0);
    for(var i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    var noise=actx.createBufferSource(); noise.buffer=buf; noise.loop=true;
    filt=actx.createBiquadFilter(); filt.type="bandpass"; filt.frequency.value=500; filt.Q.value=0.8;
    gainN=actx.createGain(); gainN.gain.value=0;
    noise.connect(filt); filt.connect(gainN); gainN.connect(actx.destination); noise.start();
    osc=actx.createOscillator(); osc.type="sine"; osc.frequency.value=80;
    oscGain=actx.createGain(); oscGain.gain.value=0;
    osc.connect(oscGain); oscGain.connect(actx.destination); osc.start();
  }
  function silence(){ if(!actx) return; var t=actx.currentTime; gainN.gain.setTargetAtTime(0,t,0.03); oscGain.gain.setTargetAtTime(0,t,0.05); }
  soundBtn.addEventListener("click",function(){
    soundOn=!soundOn; soundBtn.setAttribute("aria-checked",String(soundOn));
    if(soundOn){ ensureAudio(); if(actx&&actx.state==="suspended") actx.resume(); c.read.innerHTML="<span>Sound on.</span>"; } else { silence(); c.read.innerHTML="<span>Muted.</span>"; }
  });
  function step(now){
    if(!inView){ raf=null; return; }
    var dt=Math.min(0.05,frameT?((now-frameT)/1000):0.016); frameT=now;
    if(!dragging){
      if(keyDir && !reduced){ keyHeldT=Math.min(1,keyHeldT+dt*0.8); vel+=keyDir*(80+keyHeldT*260)*dt; }
      else if(keyDir && reduced){ angle+=keyDir*2.4; }
      if(!reduced && !keyDir){ var idle=(!playing&&mount.classList.contains("wb-attract"))?IDLE:0, target=playing?TARGET:idle; vel+=(target-vel)*Math.min(1,dt*3.2); }
      else if(reduced && !keyDir){ vel=0; }
      angle+=vel*dt; setAngle();
    }
    var mag=Math.min(1.4,Math.abs(vel)/TARGET); vuPhase+=dt*6;
    for(var i=0;i<vu.length;i++){ var m=Math.max(.08,mag*(0.55+0.45*Math.sin(vuPhase+i*1.3))); vu[i].style.transform="scaleY("+m.toFixed(2)+")"; }
    if(soundOn && actx){ var t=actx.currentTime; filt.frequency.setTargetAtTime(260+mag*2400,t,0.03); gainN.gain.setTargetAtTime(dragging?Math.min(0.15,mag*0.18):0,t,0.05); osc.frequency.setTargetAtTime(65+mag*130,t,0.05); oscGain.gain.setTargetAtTime(playing?0.03:0,t,0.08); }
    raf=requestAnimationFrame(step);
  }
  new IntersectionObserver(function(es){ inView=es[0].isIntersecting; if(inView){ if(!raf) raf=requestAnimationFrame(step); } else { silence(); } },{threshold:.1}).observe(mount);
  c.reset.addEventListener("click",function(){
    gen++; angle=0; vel=0; dragging=false; keyDir=0; keyHeldT=0; playing=false; soundOn=false;
    playBtn.setAttribute("aria-pressed","false"); playBtn.textContent="Play"; soundBtn.setAttribute("aria-checked","false"); silence(); setAngle();
    for(var i=0;i<vu.length;i++) vu[i].style.transform="scaleY(.08)"; c.read.innerHTML=""; c.untouch();
  });
}

/* ======================= 5. Loose Type (K13) ======================= */
/* The studio's own lockup as physical pieces: fling them, they bounce and settle, Tidy snaps them home. */
function letters(mount){
  var c=card(mount,{title:"Loose Type",from:"K13",instr:"Grab a piece and fling it. Tidy brings the lockup home.",stageClass:"wb-tray-wrap"});
  var iid=mount.querySelector(".wb-instr").id;
  c.stage.insertAdjacentHTML("beforeend",
    '<div class="wb-tray" role="group" aria-label="Loose type, four pieces">'+
      '<button type="button" class="wb-tile wt-k" aria-describedby="'+iid+'">K</button>'+
      '<button type="button" class="wb-tile wt-13" aria-describedby="'+iid+'">13</button>'+
      '<button type="button" class="wb-tile wt-tag wt-sw" aria-describedby="'+iid+'">SOFTWARE</button>'+
      '<button type="button" class="wb-tile wt-tag wt-st" aria-describedby="'+iid+'">STUDIO</button>'+
    '</div><button type="button" class="wb-tidy">Tidy</button>');
  var tray=c.stage.querySelector(".wb-tray"), tidyBtn=c.stage.querySelector(".wb-tidy");
  var els=[].slice.call(tray.querySelectorAll(".wb-tile")), names=["K","13","SOFTWARE","STUDIO"];
  els.forEach(function(e,i){ e.setAttribute("aria-label",names[i]+", drag it or use the arrow keys, Enter to fling it."); });
  var tiles=els.map(function(e){ return {el:e,x:0,y:0,angle:0,vx:0,vy:0,av:0,r:26,w:60,h:60,homeX:0,homeY:0,homeAngle:0,dragging:false,homing:false,tidyDelay:0,tidyT:0,fromX:0,fromY:0,fromA:0}; });
  var K=tiles[0], N=tiles[1], SW=tiles[2], ST=tiles[3];
  var trayW=0, trayH=0, inited=false, inView=false, raf=null, frameT=0, gen=0, aligned=false, alignDX=0, earned=false;
  var FRICTION=.9, BOUNCE=.6, TIDYDUR=.62;
  function setT(t){ t.el.style.transform="translate("+(t.x-t.w/2)+"px,"+(t.y-t.h/2)+"px) rotate("+t.angle+"deg)"; }
  function measure(){ tiles.forEach(function(t){ var r=t.el.getBoundingClientRect(); t.w=r.width; t.h=r.height; t.r=Math.max(t.w,t.h)*.62/2; }); }
  function layout(){
    var r=tray.getBoundingClientRect(); if(!r.width) return; trayW=r.width; trayH=r.height; measure();
    var cx=trayW/2, cy=trayH/2, groupW=K.w+N.w+4, leftX=cx-groupW/2;
    K.homeX=leftX+K.w/2; K.homeY=cy; K.homeAngle=0;
    N.homeX=leftX+K.w+4+N.w/2; N.homeY=cy; N.homeAngle=0;
    SW.homeX=Math.min(N.homeX+N.w/2+28+SW.w/2,trayW-SW.w/2-8); SW.homeY=cy-SW.h/2-3; SW.homeAngle=0;
    ST.homeX=Math.min(SW.homeX,trayW-ST.w/2-8); ST.homeY=cy+ST.h/2+3; ST.homeAngle=0;
    alignDX=N.homeX-K.homeX;
    if(!inited){ inited=true; tiles.forEach(function(t){ t.x=t.homeX; t.y=t.homeY; t.angle=t.homeAngle; setT(t); }); }
  }
  function nudge(t,dx,dy){ t.homing=false; earned=true; t.x=clamp(t.x+dx,t.r,trayW-t.r); t.y=clamp(t.y+dy,t.r,trayH-t.r); t.vx=t.vy=0; setT(t); c.touch(); }
  function fling(t){
    t.homing=false; earned=true; c.touch();
    if(reduced){ var a0=Math.random()*Math.PI*2; t.x=clamp(t.x+Math.cos(a0)*70,t.r,trayW-t.r); t.y=clamp(t.y+Math.sin(a0)*70,t.r,trayH-t.r); setT(t); c.read.innerHTML="<span>Flung.</span>"; return; }
    var a=Math.random()*Math.PI*2, sp=340+Math.random()*160;
    t.vx=Math.cos(a)*sp; t.vy=Math.sin(a)*sp; t.av=(Math.random()-.5)*420; c.read.innerHTML="<span>Flung.</span>";
  }
  tiles.forEach(function(t){
    t.el.addEventListener("pointerdown",function(e){ e.preventDefault(); t.el.setPointerCapture(e.pointerId); t.dragging=true; t.homing=false; earned=true; t.vx=t.vy=t.av=0; var r=tray.getBoundingClientRect(); t._lx=e.clientX-r.left; t._ly=e.clientY-r.top; t._lt=performance.now(); t.el.classList.add("grabbed"); c.touch(); });
    t.el.addEventListener("pointermove",function(e){ if(!t.dragging) return; var r=tray.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, now=performance.now(), dt=Math.max(1,now-t._lt)/1000; t.vx=(x-t._lx)/dt; t.vy=(y-t._ly)/dt; t.x=clamp(x,t.r,trayW-t.r); t.y=clamp(y,t.r,trayH-t.r); t._lx=x; t._ly=y; t._lt=now; setT(t); });
    function endDrag(){ if(!t.dragging) return; t.dragging=false; t.el.classList.remove("grabbed"); if(reduced){ t.vx=t.vy=t.av=0; } else { t.av=clamp(t.vx*.12,-260,260); } }
    t.el.addEventListener("pointerup",endDrag); t.el.addEventListener("pointercancel",endDrag);
    t.el.addEventListener("keydown",function(e){
      var s=16;
      if(e.key==="ArrowLeft"){ e.preventDefault(); nudge(t,-s,0); } else if(e.key==="ArrowRight"){ e.preventDefault(); nudge(t,s,0); }
      else if(e.key==="ArrowUp"){ e.preventDefault(); nudge(t,0,-s); } else if(e.key==="ArrowDown"){ e.preventDefault(); nudge(t,0,s); }
      else if(e.key==="Enter"){ e.preventDefault(); fling(t); }
    });
  });
  function ang0(a){ a=((a%360)+360)%360; return Math.min(a,360-a); }
  function checkAlign(){
    if(!earned) return; /* only a discovery the visitor earns by playing, never the resting state after load, Reset or Tidy */
    var dx=N.x-K.x, dy=N.y-K.y;
    var close=Math.abs(dx-alignDX)<20 && Math.abs(dy)<16 && ang0(K.angle)<12 && ang0(N.angle)<12;
    var rest=Math.hypot(K.vx,K.vy)<6 && Math.hypot(N.vx,N.vy)<6 && !K.dragging && !N.dragging && !K.homing && !N.homing;
    if(close&&rest){ if(!aligned){ aligned=true; c.read.innerHTML="<span>That reads K13. Nicely done.</span>"; } } else aligned=false;
  }
  function stepAll(dt,now){
    tiles.forEach(function(t,i){
      if(t.dragging) return;
      if(t.homing){
        t.tidyDelay-=dt;
        if(t.tidyDelay<=0){ t.tidyT=Math.min(1,t.tidyT+dt/TIDYDUR); var e=POP(t.tidyT); t.x=lerp(t.fromX,t.homeX,e); t.y=lerp(t.fromY,t.homeY,e); t.angle=lerp(t.fromA,t.homeAngle,e); if(t.tidyT>=1){ t.homing=false; t.vx=t.vy=t.av=0; t.angle=t.homeAngle; } }
        setT(t); return;
      }
      if(!reduced){
        var f=Math.pow(FRICTION,dt*60); t.vx*=f; t.vy*=f; t.av*=f; t.x+=t.vx*dt; t.y+=t.vy*dt; t.angle+=t.av*dt;
        if(t.x<t.r){ t.x=t.r; t.vx=Math.abs(t.vx)*BOUNCE; } else if(t.x>trayW-t.r){ t.x=trayW-t.r; t.vx=-Math.abs(t.vx)*BOUNCE; }
        if(t.y<t.r){ t.y=t.r; t.vy=Math.abs(t.vy)*BOUNCE; } else if(t.y>trayH-t.r){ t.y=trayH-t.r; t.vy=-Math.abs(t.vy)*BOUNCE; }
        if(Math.abs(t.vx)<.5) t.vx=0; if(Math.abs(t.vy)<.5) t.vy=0; if(Math.abs(t.av)<.5) t.av=0;
      }
      if(!reduced && mount.classList.contains("wb-attract")){ var ph=now/1000, bob=Math.sin(ph*1.6+i*1.1)*3, rot=Math.sin(ph*1.1+i*.7)*2.2; t.el.style.transform="translate("+(t.x-t.w/2)+"px,"+(t.y-t.h/2+bob)+"px) rotate("+(t.angle+rot)+"deg)"; }
      else setT(t);
    });
    if(!reduced){
      for(var i=0;i<tiles.length;i++) for(var j=i+1;j<tiles.length;j++){
        var a=tiles[i], b=tiles[j]; if(a.dragging||b.dragging||a.homing||b.homing) continue;
        var dx=b.x-a.x, dy=b.y-a.y, dist=Math.hypot(dx,dy)||.01, min=a.r+b.r;
        if(dist<min){ var nx=dx/dist, ny=dy/dist, overlap=(min-dist)/2; a.x-=nx*overlap; a.y-=ny*overlap; b.x+=nx*overlap; b.y+=ny*overlap;
          var avn=a.vx*nx+a.vy*ny, bvn=b.vx*nx+b.vy*ny, diff=(bvn-avn)*.9; a.vx+=nx*diff; a.vy+=ny*diff; b.vx-=nx*diff; b.vy-=ny*diff; setT(a); setT(b); }
      }
    }
    checkAlign();
  }
  function step(now){ if(!inView){ raf=null; return; } var dt=Math.min(0.05,frameT?((now-frameT)/1000):0.016); frameT=now; stepAll(dt,now); raf=requestAnimationFrame(step); }
  new IntersectionObserver(function(es){ inView=es[0].isIntersecting; if(inView){ layout(); if(!raf) raf=requestAnimationFrame(step); } },{threshold:.1}).observe(mount);
  tidyBtn.addEventListener("click",function(){
    c.touch(); earned=false; aligned=false;
    if(reduced){ tiles.forEach(function(t){ t.x=t.homeX; t.y=t.homeY; t.angle=t.homeAngle; t.vx=t.vy=t.av=0; t.homing=false; setT(t); }); c.read.innerHTML="<span>Tidied.</span>"; return; }
    tiles.forEach(function(t,i){ t.dragging=false; t.homing=true; t.tidyDelay=i*.08; t.tidyT=0; t.fromX=t.x; t.fromY=t.y; t.fromA=t.angle; t.vx=t.vy=t.av=0; });
    c.read.innerHTML="<span>Tidying up.</span>";
  });
  c.reset.addEventListener("click",function(){
    gen++; aligned=false; earned=false; tiles.forEach(function(t){ t.dragging=false; t.homing=false; t.vx=t.vy=t.av=0; t.x=t.homeX; t.y=t.homeY; t.angle=t.homeAngle; setT(t); });
    c.read.innerHTML=""; c.untouch();
  });
  window.addEventListener("resize",layout); setTimeout(layout,0);
}

/* ======================= Runny Egg (Egg & Out) ======================= */
/* Their site's cursor, kept in a pan: the yolk leads on a stiff spring, the white trails on a
   soft one and can never let the yolk escape, grease streaks smear out behind. Click jiggles,
   double click flips it with a spatula. */
function eggcursor(mount){
  var c=card(mount,{title:"Runny Egg",from:"Egg & Out",instr:"Move around the pan. Left click jiggles the yolk, right click flips the egg.",stageClass:"wb-pan"});
  var stage=c.stage, layer=el("div","eg-layer"); layer.setAttribute("aria-hidden","true"); stage.appendChild(layer);
  var streaks=[];
  [[15,3.5,0],[10,3,-10],[10,3,10]].forEach(function(s){ var d=el("div","eg-streak"); d.style.width=s[0]+"px"; d.style.height=s[1]+"px"; layer.appendChild(d); streaks.push({el:d,x:0,y:0,vx:0,vy:0,lat:s[2],w:s[0]}); });
  function follow(){ var f=el("div","eg-follow"), ce=el("div","eg-center"), fl=el("div","eg-flipper"); ce.appendChild(fl); f.appendChild(ce); layer.appendChild(f); return {f:f,fl:fl}; }
  var wF=follow(), white=el("div","eg-white"); wF.fl.appendChild(white);
  var yF=follow(), yolk=el("div","eg-yolk",'<div class="eg-face eg-front"></div><div class="eg-face eg-back"></div>'); yF.fl.appendChild(yolk);
  var yolkWrap=yF.f, whiteWrap=wF.f, flippers=[yF.fl,wF.fl];
  layer.removeAttribute("aria-hidden"); layer.tabIndex=0; layer.setAttribute("role","img"); layer.setAttribute("aria-label","A sunny side up egg that follows your pointer. Arrow keys move it, Space jiggles it, Enter flips it.");
  var W=0,H=0,tx=0,ty=0, y={x:0,y:0,vx:0,vy:0}, w={x:0,y:0,vx:0,vy:0}, gen=0, raf=null, live=false, last=0, touched=false, t0=performance.now(), hot=false;
  function size(){ var r=stage.getBoundingClientRect(); W=r.width; H=r.height; if(!touched){ tx=W/2; ty=H/2; } }
  function spring(p,tX,tY,k,d,m,dt){ var ax=(tX-p.x)*k/m - p.vx*d/m, ay=(tY-p.y)*k/m - p.vy*d/m; p.vx+=ax*dt; p.vy+=ay*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; }
  function step(t){
    if(!live) { raf=null; return; }
    var dt=Math.min(.032,(t-last)/1000||.016); last=t;
    if(!touched&&!reduced){ var a=(t-t0)/1000*.9; tx=W/2+Math.sin(a)*W*.32; ty=H/2+Math.sin(a*2)*H*.22; }
    if(reduced){ y.x=tx; y.y=ty; w.x=tx; w.y=ty; }
    else { spring(y,tx,ty,600,22,.7,dt); spring(w,y.x,y.y,230,30,1.1,dt); var lx=w.x-y.x, ly=w.y-y.y, mag=Math.hypot(lx,ly), k=mag>15?15/mag:1; }
    var wx=reduced?tx:y.x+(w.x-y.x)*(k||1), wy=reduced?ty:y.y+(w.y-y.y)*(k||1);
    var ax=Math.abs(y.vx), ay=Math.abs(y.vy), sqx=clamp(1+(ax-ay)/3600,.86,1.14), sqy=clamp(1+(ay-ax)/3600,.86,1.14), sqxw=clamp(1+(ax-ay)/2600,.82,1.2), sqyw=clamp(1+(ay-ax)/2600,.82,1.2);
    yolkWrap.style.transform="translate("+y.x+"px,"+y.y+"px)"; yolk.style.transform="scale("+(sqx*(hot?1.25:1))+","+(sqy*(hot?1.25:1))+")";
    whiteWrap.style.transform="translate("+wx+"px,"+wy+"px)"; white.style.transform="scale("+sqxw+","+sqyw+")";
    streaks.forEach(function(s){ if(reduced){ s.el.style.opacity=0; return; } spring(s,tx,ty,110,24,1.1,dt); var sp=Math.hypot(s.vx,s.vy)||1, op=clamp((sp-60)/950,0,1)*(s.w>12?.2:.15), ang=Math.atan2(s.vy,s.vx)*180/Math.PI;
      s.el.style.opacity=op; s.el.style.transform="translate("+(s.x+(-s.vy/sp)*s.lat)+"px,"+(s.y+(s.vx/sp)*s.lat)+"px) rotate("+ang+"deg)"; });
    raf=requestAnimationFrame(step);
  }
  function go(){ if(!raf){ last=performance.now(); raf=requestAnimationFrame(step); } }
  new IntersectionObserver(function(es){ live=es[0].isIntersecting; if(live){ size(); go(); } },{threshold:.2}).observe(mount);
  function at(e){ var r=stage.getBoundingClientRect(); tx=clamp(e.clientX-r.left,0,W); ty=clamp(e.clientY-r.top,0,H); touched=true; }
  stage.addEventListener("pointermove",at,{passive:true});
  stage.addEventListener("pointerdown",function(e){ at(e); hot=true; if(e.button===2) flip(); else if(e.button===0) shake(); });
  stage.addEventListener("contextmenu",function(e){ e.preventDefault(); });          /* right click is the spatula, not a menu */ stage.addEventListener("pointerup",function(){ hot=false; }); stage.addEventListener("pointerleave",function(){ hot=false; });
  stage.addEventListener("dblclick",flip);                                            /* touch has no right button: double tap flips */
  var shaking=false,flipping=false;
  function shake(){ if(shaking||reduced) return; shaking=true; yolk.classList.add("shake"); setTimeout(function(){ yolk.classList.remove("shake"); shaking=false; },520); c.read.innerHTML='<span>Wobble.</span>'; }
  function flip(){ if(flipping||reduced) return; flipping=true; flippers.forEach(function(f){ f.classList.add("flipping"); }); setTimeout(function(){ flippers.forEach(function(f){ f.classList.remove("flipping"); }); flipping=false; },800); c.read.innerHTML='<span>Spatula. Browned underneath.</span>'; }
  layer.addEventListener("keydown",function(e){ var st=14; if(e.key==="ArrowLeft") tx-=st; else if(e.key==="ArrowRight") tx+=st; else if(e.key==="ArrowUp") ty-=st; else if(e.key==="ArrowDown") ty+=st; else if(e.key===" "){ e.preventDefault(); shake(); return; } else if(e.key==="Enter"){ flip(); return; } else return; e.preventDefault(); touched=true; tx=clamp(tx,0,W); ty=clamp(ty,0,H); });
  c.reset.addEventListener("click",function(){ gen++; touched=false; size(); y.x=w.x=tx; y.y=w.y=ty; y.vx=y.vy=w.vx=w.vy=0; streaks.forEach(function(s){ s.x=tx; s.y=ty; s.vx=s.vy=0; }); t0=performance.now(); c.read.innerHTML=""; c.untouch(); });
  window.addEventListener("resize",size); size(); y.x=w.x=tx; y.y=w.y=ty;
}

/* ======================= Bacon Rush, built to order (Egg & Out) ======================= */
/* Their scroll-built sandwich, kept in a pan: scroll inside the stage and the layers drop in
   one by one, back to front, then the real photo bursts through a yolk splash. Every value comes
   from the site's own SandwichAssembly component (boxes, windows, easings). */
function sandwich(mount){
  var c=card(mount,{title:"Bacon Rush, built to order",from:"Egg & Out",instr:"Scroll inside the pan. Every layer drops in order. The last one is the real thing.",stageClass:"wb-build",
    foot:"The falling layers are renders in the product's own style; the sandwich you land on is the real photo."});
  function bez(x1,y1,x2,y2){ var cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;
    function sx(t){ return ((ax*t+bx)*t+cx)*t; } function sy(t){ return ((ay*t+by)*t+cy)*t; } function dx(t){ return (3*ax*t+2*bx)*t+cx; }
    return function(x){ if(x<=0) return 0; if(x>=1) return 1; var t=x,i; for(i=0;i<8;i++){ var e=sx(t)-x; if(Math.abs(e)<1e-6) return sy(t); var d=dx(t); if(Math.abs(d)<1e-6) break; t-=e/d; } var lo=0,hi=1; t=x; for(i=0;i<20;i++){ var v=sx(t); if(Math.abs(v-x)<1e-6) break; if(v<x) lo=t; else hi=t; t=(lo+hi)/2; } return sy(t); }; }
  var PREM=bez(.22,1,.36,1), PLAY=bez(.34,1.56,.64,1), WORK=bez(.4,0,.2,1);
  var B="assets/workbench/eggout/";
  var LOAF={src:"loaf",label:"Toasted brioche bun",box:[.7375,.13125,.3],win:[.04,.13]};
  var ING=[{k:"cheddar",label:"Cheddar cheese",box:[.44,.12,.36],copies:[[.46,.46,.42]],sh:[.5,.2,.5],win:[.15,.24],rz:1,z:2},
           {k:"eggs",label:"Scrambled eggs",box:[.6125,.20625,.2136],sh:[.46,.27,.34],win:[.26,.35],rz:-1,z:5},
           {k:"bacon",label:"Smoked bacon",box:[.6125,.2375,.109],sh:[.46,.3,.21],win:[.37,.46],rz:1,z:3},
           {k:"avocado",label:"Avocado",box:[.6,.15,.3],sh:[.44,.22,.46],win:[.48,.57],rz:-1,z:6},
           {k:"chives",label:"Chives",box:[.46,.27,.25],sh:[.34,.31,.33],win:[.59,.68],rz:1,z:7}];
  var TRIG=.72;
  var stage=c.stage;
  var wrap=el("div","sb-wrap"); stage.appendChild(wrap);
  var steps=el("ol","sb-steps"); wrap.appendChild(steps);
  var scroller=el("div","sb-scroller"); scroller.tabIndex=0; scroller.setAttribute("role","region"); scroller.setAttribute("aria-label","The build. Scroll or use the arrow keys to drop each layer in.");
  scroller.setAttribute("data-lenis-prevent","");                                    /* the page's smooth scroll must not swallow the wheel over the pan */
  scroller.addEventListener("pointerdown",function(){ scroller.focus({preventScroll:true}); });
  wrap.appendChild(scroller);
  var track=el("div","sb-track"); scroller.appendChild(track);
  var sticky=el("div","sb-sticky"); track.appendChild(sticky);
  var box=el("div","sb-box"); sticky.appendChild(box);
  var build=el("div","sb-build"); box.appendChild(build);
  function img(src,b,cls){ var i=el("img",cls||""); i.src=B+src+".webp"; i.alt=""; i.decoding="async"; i.loading="lazy"; i.style.left=(b[1]*100)+"%"; i.style.top=(b[2]*100)+"%"; i.style.width=(b[0]*100)+"%"; return i; }
  var loafL=el("div","sb-layer"); loafL.appendChild(img(LOAF.src,LOAF.box)); loafL.style.zIndex=1; build.appendChild(loafL);
  var layers=[];
  ING.forEach(function(g){
    var sh=el("div","sb-shadow"); sh.style.left=(g.sh[1]*100)+"%"; sh.style.top=(g.sh[2]*100)+"%"; sh.style.width=(g.sh[0]*100)+"%"; build.appendChild(sh);
    var L=el("div","sb-layer"); L.appendChild(img(g.k,g.box)); (g.copies||[]).forEach(function(b){ L.appendChild(img(g.k,b)); }); build.appendChild(L);
    layers.push({g:g,el:L,sh:sh,imgs:L.querySelectorAll("img")});
  });
  var splash=el("div","sb-splash"); for(var i=0;i<7;i++){ var bl=el("i"); bl.style.setProperty("--i",i); splash.appendChild(bl); } box.appendChild(splash);
  var hero=el("div","sb-hero"); hero.appendChild(img("hero-bacon-rush",[.9,.05,.03])); box.appendChild(hero);
  var labels=[LOAF.label].concat(ING.map(function(g){ return g.label; })).concat(["Bacon Rush"]);
  var lis=labels.map(function(l,i){ var li=el("li",null,'<span>0'+(i+1)+'</span>'+l); steps.appendChild(li); return li; });
  var wins=[LOAF.win].concat(ING.map(function(g){ return g.win; })).concat([[TRIG,.93]]);
  var phase="idle", peak=0, prev=0, gen=0;
  function progress(){ var m=scroller.scrollHeight-scroller.clientHeight; return m>0?scroller.scrollTop/m:0; }
  function seg(p,a,b){ return clamp((p-a)/(b-a),0,1); }
  function render(){
    var p=progress();
    var lp=PREM(seg(p,LOAF.win[0],LOAF.win[1])); loafL.style.opacity=lp; loafL.style.transform="translateY("+(40*(1-lp))+"%) scale("+(.92+.08*lp)+")";
    var drift=0, press=1;
    layers.forEach(function(L){ var g=L.g, s=g.win[0], e=g.win[1], land=s+(e-s)*.8, settle=s+(e-s)*.9;
      var f=PREM(seg(p,s,land)); var ty=-115*(1-f);
      var sc=p<land?1.22+(1.03-1.22)*f : p<settle?1.03+(1-1.03)*PLAY(seg(p,land,settle)) : 1;
      var rx=-26*(1-f), rz=g.rz*5*(1-f);
      L.el.style.zIndex=p<land?20:g.z; L.el.style.transform="translateY("+ty+"%)";
      L.imgs.forEach(function(im){ im.style.transform="scale("+sc+") rotateX("+rx+"deg) rotateZ("+rz+"deg)"; });
      var so=p<land?.05+.27*f:.32-.06*seg(p,land,e), ss=p<land?1.7-.75*f:.95+.05*seg(p,land,e); L.sh.style.opacity=so; L.sh.style.transform="scale("+ss+")";
      if(p>=land) drift+=1; if(Math.abs(p-land)<.006) press=.985; });
    build.style.transform="translateY("+drift+"%) scaleY("+press+")";
    lis.forEach(function(li,i){ var on=i<7?p>=wins[i][0]+.02:(phase==="burst"||phase==="revealed"); li.classList.toggle("on",on); });
    /* the reveal fires once on the way down, and leaves to the right on the way up */
    if(p>prev){ if(phase==="gone"){ peak=p; phase="idle"; box.className="sb-box"; } if(p>peak) peak=p; if(p>=TRIG&&phase==="idle") burst(); }
    else if(p<prev){ if((phase==="burst"||phase==="revealed")&&p<peak-.008) exit(); }
    prev=p;
  }
  function burst(){ if(reduced){ phase="revealed"; box.className="sb-box revealed"; return; } phase="burst"; box.className="sb-box burst"; var g=gen; setTimeout(function(){ if(g===gen&&phase==="burst"){ phase="revealed"; box.className="sb-box revealed"; } },1500); c.read.innerHTML='<span><b>Bacon Rush.</b> The real one.</span>'; }
  function exit(){ phase="exit"; box.className="sb-box exit"; var g=gen; setTimeout(function(){ if(g!==gen) return; phase="gone"; box.className="sb-box gone"; scroller.scrollTop=0; prev=0; peak=0; render(); },reduced?0:500); c.read.innerHTML=""; }
  var ticking=false; scroller.addEventListener("scroll",function(){ if(!ticking){ ticking=true; requestAnimationFrame(function(){ ticking=false; render(); }); } },{passive:true});
  scroller.addEventListener("keydown",function(e){ var st=scroller.clientHeight*.18; if(e.key==="ArrowDown"||e.key==="PageDown"){ e.preventDefault(); scroller.scrollTop+=st; } else if(e.key==="ArrowUp"||e.key==="PageUp"){ e.preventDefault(); scroller.scrollTop-=st; } else if(e.key==="Home"){ scroller.scrollTop=0; } else if(e.key==="End"){ scroller.scrollTop=scroller.scrollHeight; } });
  /* attract: the first layers drop on their own until a hand arrives */
  var auto=null;
  new IntersectionObserver(function(es){ if(es[0].isIntersecting&&!mount.classList.contains("touched")&&!reduced&&!auto){ var t0=performance.now(); auto=requestAnimationFrame(function tick(t){ if(mount.classList.contains("touched")||!auto) return; var m=scroller.scrollHeight-scroller.clientHeight; var q=Math.min(.34,((t-t0)/6000)); scroller.scrollTop=m*q; if(q<.34) auto=requestAnimationFrame(tick); else auto=null; }); } else if(!es[0].isIntersecting&&auto){ cancelAnimationFrame(auto); auto=null; } },{threshold:.5}).observe(mount);
  mount.addEventListener("pointerdown",function(){ mount.classList.add("touched"); if(auto){ cancelAnimationFrame(auto); auto=null; } },true); mount.addEventListener("keydown",function(){ mount.classList.add("touched"); if(auto){ cancelAnimationFrame(auto); auto=null; } },true);
  mount.addEventListener("wheel",function(){ mount.classList.add("touched"); if(auto){ cancelAnimationFrame(auto); auto=null; } },{passive:true});
  c.reset.addEventListener("click",function(){ gen++; phase="idle"; peak=0; prev=0; box.className="sb-box"; scroller.scrollTop=0; render(); c.read.innerHTML=""; mount.classList.remove("touched"); c.untouch(); });
  if(reduced){ phase="revealed"; box.className="sb-box revealed"; lis.forEach(function(li){ li.classList.add("on"); }); }
  render();
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
var games={carlos:carlos,miramar:miramar,egg:egg,cengo:cengo,eggcursor:eggcursor,sandwich:sandwich,letters:letters};
document.querySelectorAll("[data-game]").forEach(function(m){ var g=games[m.getAttribute("data-game")]; if(g) g(m); });
document.querySelectorAll(".wb [data-hunt]").forEach(function(n){ hunt.place(n); });
})();
