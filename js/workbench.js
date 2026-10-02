/* K13 workbench: fourteen playable pieces from real projects, plus the hidden layer.
   Contract with the page (index.html / js/site.js):
     mounts   <div data-game="carlos|miramar|...">  (fourteen names, see the games map at the bottom; each becomes one card)
     hunt     window.K13.hunt.place(el): turns a small "13" on the page into a hidden mark;
              the page calls it for its own nine marks, this file places four more in the cards (the seven newest toys add none, the total stays 13)
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
  var c=card(mount,{title:"Opening Night",from:"Miramar Food Hall",instr:"Watch the marquee, then repeat the pattern. Reach 13 to open the doors.",stageClass:"wb-sign",foot:"A toy sign, not the real marquee. Best round is kept on this device."});
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

/* ======================= 3. Endless Spiral (Egg&Out) ======================= */
/* Their wordmark spirals on without end. Grab it and spin it; flick it and it keeps turning. */
var FONT_DISP=null;
function egg(mount){
  var c=card(mount,{title:"Endless Spiral",from:"Egg&Out",instr:"Grab the spiral and spin it. Flick it hard and it keeps going.",stageClass:"wb-egg",foot:"Their wordmark, spun by hand. Left and right arrows work too."});
  var cv=el("canvas","wb-eggcv"); cv.setAttribute("role","img"); cv.setAttribute("aria-label","A spiral made of the words EGG AND OUT, repeating outward. Drag in a circle to spin it, or use the left and right arrow keys."); cv.tabIndex=0; c.stage.appendChild(cv);
  var ctx=cv.getContext("2d"), W=0,H=0,DPR=Math.min(2,window.devicePixelRatio||1);
  if(!FONT_DISP) FONT_DISP=(getComputedStyle(document.documentElement).getPropertyValue("--disp")||"serif").trim();
  var YOLK="#8A5206", ORANGE="#B94612", CREAM="#F6EEDC";
  var STR="EGG&OUT   ", widths=null, fontPx=16;
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
/* A record on a turntable. Drag a circle to scratch it, let go and it spins back up. Everything you hear is synthesized here:
   the loop is rendered once into a buffer (the "record"), and the platter's speed drives that buffer's playback, so scratches, backspins and the motor's spin-up and spin-down are real. */
function cengo(mount){
  var c=card(mount,{title:"Night Shift Deck",from:"CENGO",instr:"Switch sound on and press Play, then drag the record in a circle to scratch it. Space plays or pauses.",stageClass:"wb-deck",foot:"The sound is synthesized here, not their music. Off until you switch it on."});
  var id="wb-d"+uid;
  c.stage.insertAdjacentHTML("beforeend",
    '<div class="wb-deckrow"><div class="wb-platwrap">'+
      '<div class="wb-plat" tabindex="0" role="img" aria-label="A record on a turntable. Drag in a circle to scratch it, or use the left and right arrow keys. Space plays or pauses.">'+
        '<div class="wb-grooves"></div><div class="wb-glint"></div><span class="wb-nub"></span>'+
        '<div class="wb-label"><span class="wb-label-t">CENGO</span><span class="wb-label-s">Night Shift</span></div>'+
      '</div></div>'+
      '<div class="wb-panel">'+
        '<div class="wb-meter" aria-hidden="true"><div class="wb-vu"><span></span><span></span><span></span><span></span><span></span><span></span></div><canvas class="wb-wave"></canvas></div>'+
        '<div class="wb-dctl">'+
          '<button type="button" class="wb-play" aria-pressed="false">Play</button>'+
          '<button type="button" class="wb-bspin">Backspin</button>'+
          '<button type="button" class="wb-sound" role="switch" aria-checked="false" aria-label="Sound"><span class="knob" aria-hidden="true"></span><span>Sound</span></button>'+
        '</div>'+
        '<div class="wb-faders">'+
          '<div class="wb-fader"><label class="wb-flab" for="'+id+'t"><span>Tempo</span><output class="wb-fval" id="'+id+'tv">122 BPM</output></label><input id="'+id+'t" class="wb-fdr" type="range" min="110" max="134" step="1" value="122"></div>'+
          '<div class="wb-fader"><label class="wb-flab" for="'+id+'f"><span>Filter</span><output class="wb-fval" id="'+id+'fv">Flat</output></label><input id="'+id+'f" class="wb-fdr" type="range" min="-100" max="100" step="1" value="0"></div>'+
        '</div>'+
        '<div class="wb-pads" role="group" aria-label="Effects, hold to play"><button type="button" class="wb-pad" data-fx="echo" aria-pressed="false">Echo</button><button type="button" class="wb-pad" data-fx="stutter" aria-pressed="false">Stutter</button></div>'+
      '</div></div>');
  var plat=c.stage.querySelector(".wb-plat"), vu=[].slice.call(c.stage.querySelectorAll(".wb-vu span")), playBtn=c.stage.querySelector(".wb-play"), soundBtn=c.stage.querySelector(".wb-sound"), bsBtn=c.stage.querySelector(".wb-bspin"),
    wave=c.stage.querySelector(".wb-wave"), wctx=wave.getContext("2d"), tempoIn=c.stage.querySelector("#"+id+"t"), tempoOut=c.stage.querySelector("#"+id+"tv"), filtIn=c.stage.querySelector("#"+id+"f"), filtOut=c.stage.querySelector("#"+id+"fv"),
    pads=[].slice.call(c.stage.querySelectorAll(".wb-pad"));
  var BASE_BPM=122, BEAT=60/BASE_BPM, BARS=4, BASE_VEL=230, IDLE=16;
  var angle=0, vel=0, dragging=false, lastAng=0, lastDragT=0, keyDir=0, keyHeldT=0, playing=false, soundOn=false, inView=false, raf=null, frameT=0, vuPhase=0, bsT=0;
  var tempo=BASE_BPM, filt=0, echoOn=false, stutOn=false, waveW=0, waveH=0, waveIdle=false, WDPR=Math.min(2,window.devicePixelRatio||1);
  function ratio(){ return tempo/BASE_BPM; }
  function setAngle(){ plat.style.transform="rotate("+angle+"deg)"; }
  function say(t){ c.read.innerHTML="<span>"+t+"</span>"; }
  function pos(e){ var r=plat.getBoundingClientRect(); return {x:e.clientX-r.left-r.width/2,y:e.clientY-r.top-r.height/2}; }
  plat.addEventListener("pointerdown",function(e){ e.preventDefault(); plat.setPointerCapture(e.pointerId); dragging=true; var p=pos(e); lastAng=Math.atan2(p.y,p.x)*180/Math.PI; lastDragT=performance.now(); vel=0; say("Scratching."); });
  plat.addEventListener("pointermove",function(e){ if(!dragging) return; var p=pos(e), a=Math.atan2(p.y,p.x)*180/Math.PI, d=a-lastAng; if(d>180) d-=360; else if(d<-180) d+=360; var now=performance.now(), dt=Math.max(1,now-lastDragT)/1000; angle+=d; vel=clamp(vel*0.6+(d/dt)*0.4,-2000,2000); lastAng=a; lastDragT=now; setAngle(); });
  function endDrag(){ if(!dragging) return; dragging=false; }
  plat.addEventListener("pointerup",endDrag); plat.addEventListener("pointercancel",endDrag);
  function togglePlay(){ playing=!playing; playBtn.setAttribute("aria-pressed",String(playing)); playBtn.textContent=playing?"Pause":"Play"; say(playing?(soundOn?"Spinning up.":"Spinning up. Switch sound on to hear it."):"Cutting the power."); }
  playBtn.addEventListener("click",togglePlay);
  bsBtn.addEventListener("click",function(){ vel=-900; bsT=1.4; say("Backspin."); });
  plat.addEventListener("keydown",function(e){
    if(e.key===" "){ e.preventDefault(); togglePlay(); return; }
    if(e.key==="ArrowLeft"){ e.preventDefault(); keyDir=-1; } else if(e.key==="ArrowRight"){ e.preventDefault(); keyDir=1; } else return;
  });
  plat.addEventListener("keyup",function(e){ if(e.key==="ArrowLeft"||e.key==="ArrowRight"){ keyDir=0; keyHeldT=0; } });
  plat.addEventListener("blur",function(){ keyDir=0; keyHeldT=0; });

  /* ---------- the record: a four-bar loop at 122 BPM, rendered offline from oscillators and noise ---------- */
  var AC=window.AudioContext||window.webkitAudioContext, OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  var actx=null, rec=null, recState="none", N={}, src=null, srcDir=0, pos0=0, rateNow=0, lastAT=0;
  function mtof(m){ return 440*Math.pow(2,(m-69)/12); }
  function synth(oc){
    var S=BEAT/4, LEN=BEAT*4*BARS, nb=oc.createBuffer(1,oc.sampleRate,oc.sampleRate), nd=nb.getChannelData(0), i;
    for(i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
    var out=oc.createGain(), comp=oc.createDynamicsCompressor(), duck=oc.createGain(), send=oc.createGain(), dl=oc.createDelay(1), fb=oc.createGain(), dlp=oc.createBiquadFilter();
    out.gain.value=.9; comp.threshold.value=-14; comp.ratio.value=3; out.connect(comp); comp.connect(oc.destination); duck.connect(out);
    dl.delayTime.value=BEAT*.75; fb.gain.value=.34; dlp.type="lowpass"; dlp.frequency.value=2400; send.gain.value=.4; send.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(duck);
    function tone(type,f0,f1,t,dur,g0,dest){ var o=oc.createOscillator(), g=oc.createGain(); o.type=type; o.frequency.setValueAtTime(f0,t); if(f1) o.frequency.exponentialRampToValueAtTime(f1,t+Math.min(dur,.12)); g.gain.setValueAtTime(g0,t); g.gain.exponentialRampToValueAtTime(.0008,t+dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t+dur+.02); }
    function hit(t,dur,type,freq,q,g,dest){ var s=oc.createBufferSource(), f=oc.createBiquadFilter(), gn=oc.createGain(); s.buffer=nb; f.type=type; f.frequency.value=freq; f.Q.value=q; gn.gain.setValueAtTime(g,t); gn.gain.exponentialRampToValueAtTime(.0008,t+dur); s.connect(f); f.connect(gn); gn.connect(dest); s.start(t,Math.random()*.5); s.stop(t+dur+.02); }
    var CH=[[57,60,64,67],[53,57,60,64],[52,55,59,64],[55,59,62,64]], ROOT=[33,29,36,31];
    for(var b=0;b<BARS;b++){
      var t0=b*4*BEAT, root=mtof(ROOT[b]), rel=b===BARS-1?0:.25, padF=oc.createBiquadFilter(), padG=oc.createGain();
      padF.type="lowpass"; padF.frequency.value=1100; padG.gain.setValueAtTime(.0001,t0); padG.gain.linearRampToValueAtTime(.07,t0+.5); padG.gain.setValueAtTime(.07,t0+4*BEAT-.3); padG.gain.linearRampToValueAtTime(.0001,t0+4*BEAT+rel); padF.connect(padG); padG.connect(duck);
      CH[b].forEach(function(n){ [-5,5].forEach(function(dt){ var o=oc.createOscillator(); o.type="triangle"; o.frequency.value=mtof(n); o.detune.value=dt; o.connect(padF); o.start(t0); o.stop(t0+4*BEAT+rel+.02); }); });
      for(var s=0;s<16;s++){
        var t=t0+s*S;
        if(s%4===0){ tone("sine",165,46,t,.42,1,out); hit(t,.012,"highpass",2200,.7,.35,out); duck.gain.setValueAtTime(.32,t); duck.gain.linearRampToValueAtTime(1,t+BEAT*.55); }
        if(s===4||s===12){ hit(t,.15,"bandpass",1300,.8,.5,out); hit(t+.011,.05,"bandpass",1500,.8,.35,out); hit(t+.022,.05,"bandpass",1700,.8,.3,out); }
        if(s%2===1) hit(t,.03,"highpass",7500,.9,.1+(s%4===3?.04:0),out);
        if(s%4===2) hit(t,.16,"highpass",7000,.9,.17,out);
        if(s%4===2||(b%2===1&&s===11)){ var f=s===11?root*2:root, bg=oc.createGain(), bf=oc.createBiquadFilter(); bf.type="lowpass"; bf.frequency.setValueAtTime(420,t); bf.frequency.exponentialRampToValueAtTime(140,t+.22); bg.gain.setValueAtTime(.0001,t); bg.gain.linearRampToValueAtTime(.55,t+.006); bg.gain.exponentialRampToValueAtTime(.001,t+.3);
          var o1=oc.createOscillator(), o2=oc.createOscillator(); o1.type="sawtooth"; o2.type="sine"; o1.frequency.value=f; o2.frequency.value=f; o1.connect(bf); bf.connect(bg); o2.connect(bg); bg.connect(duck); o1.start(t); o2.start(t); o1.stop(t+.34); o2.stop(t+.34); }
        if(s===3||s===6||s===11||(b===3&&s===14)){ var sf=oc.createBiquadFilter(), sg=oc.createGain(); sf.type="lowpass"; sf.Q.value=4; sf.frequency.setValueAtTime(2600,t); sf.frequency.exponentialRampToValueAtTime(700,t+.2); sg.gain.setValueAtTime(.0001,t); sg.gain.linearRampToValueAtTime(.075,t+.004); sg.gain.exponentialRampToValueAtTime(.001,t+.26); sf.connect(sg); sg.connect(duck); sg.connect(send);
          CH[b].forEach(function(n){ [-7,7].forEach(function(dt){ var o=oc.createOscillator(); o.type="sawtooth"; o.frequency.value=mtof(n); o.detune.value=dt; o.connect(sf); o.start(t); o.stop(t+.3); }); }); }
      }
    }
    return LEN;
  }
  function buildRecord(){
    if(recState!=="none") return; recState="loading";
    if(!OAC){ recState="fail"; say("This browser can't render the record."); return; }
    var sr=actx.sampleRate, oc, LEN; try{ oc=new OAC(1,Math.ceil(BEAT*4*BARS*sr),sr); LEN=synth(oc); } catch(err){ recState="fail"; say("This browser can't render the record."); return; }
    var pr=oc.startRendering(); if(!pr||!pr.then){ recState="fail"; return; }
    pr.then(function(buf){
      var d=buf.getChannelData(0), n=d.length, i, pk=0; for(i=0;i<n;i++) pk=Math.max(pk,Math.abs(d[i])); var k=pk>0?.8/pk:1;
      for(i=0;i<n;i++) d[i]=d[i]*k+(Math.random()*2-1)*.005; for(i=0;i<n/8000;i++){ var p=Math.floor(Math.random()*(n-2)), a=(Math.random()<.5?-1:1)*(.04+Math.random()*.07); d[p]+=a; d[p+1]-=a*.6; }
      var fade=Math.floor(sr*.008); for(i=0;i<fade;i++){ var f=i/fade; d[i]*=f; d[n-1-i]*=f; }
      var rev=actx.createBuffer(1,n,sr), rd=rev.getChannelData(0); for(i=0;i<n;i++) rd[i]=d[n-1-i];
      rec={fwd:buf,rev:rev,len:buf.duration}; recState="ready"; if(soundOn) say(playing?"Record loaded.":"Record loaded. Press Play to drop the needle, or scratch it now.");
    }).catch(function(){ recState="fail"; say("The record would not render in this browser."); });
  }
  function ensureAudio(){
    if(actx) return true; if(!AC) return false;
    try{ actx=new AC(); } catch(err){ return false; }
    var g=function(){ return actx.createGain(); }, bq=function(type,f,q){ var b=actx.createBiquadFilter(); b.type=type; b.frequency.value=f; b.Q.value=q; return b; };
    N.gate=g(); N.gate.gain.value=0; N.lp=bq("lowpass",18000,.8); N.hp=bq("highpass",20,.8); N.dry=g(); N.chop=g(); N.chop.gain.value=.5; N.chopMix=g(); N.chopMix.gain.value=0;
    N.lfo=actx.createOscillator(); N.lfo.type="square"; N.lfo.frequency.value=BASE_BPM/60*4; N.lfoAmp=g(); N.lfoAmp.gain.value=.5; N.lfo.connect(N.lfoAmp); N.lfoAmp.connect(N.chop.gain); N.lfo.start();
    N.send=g(); N.send.gain.value=0; N.delay=actx.createDelay(2); N.delay.delayTime.value=BEAT*.75; N.fb=g(); N.fb.gain.value=.5; N.etone=bq("lowpass",2600,.7);
    N.mix=g(); N.comp=actx.createDynamicsCompressor(); N.comp.threshold.value=-10; N.comp.ratio.value=3; N.master=g(); N.master.gain.value=0; N.an=actx.createAnalyser(); N.an.fftSize=1024; N.an.smoothingTimeConstant=.4; N.td=new Uint8Array(N.an.fftSize);
    N.gate.connect(N.lp); N.lp.connect(N.hp); N.hp.connect(N.dry); N.dry.connect(N.mix); N.hp.connect(N.chop); N.chop.connect(N.chopMix); N.chopMix.connect(N.mix);
    N.hp.connect(N.send); N.send.connect(N.delay); N.delay.connect(N.etone); N.etone.connect(N.fb); N.fb.connect(N.delay); N.etone.connect(N.mix);
    N.mix.connect(N.comp); N.comp.connect(N.master); N.master.connect(N.an); N.an.connect(actx.destination);
    buildRecord(); return true;
  }
  function T(){ return actx.currentTime; }
  function applyFilter(){
    if(!actx) return; var t=T(), k=filt/100; N.lp.frequency.setTargetAtTime(k<0?18000*Math.pow(250/18000,-k):18000,t,.03); N.hp.frequency.setTargetAtTime(k>0?20*Math.pow(2500/20,k):20,t,.03);
    filtOut.textContent=Math.abs(filt)<4?"Flat":(filt<0?"Low pass ":"High pass ")+Math.abs(filt)+"%";
    filtIn.setAttribute("aria-valuetext",Math.abs(filt)<4?"Flat":(filt<0?"Low pass, ":"High pass, ")+Math.abs(filt)+" percent");
  }
  function applyTempo(){
    tempoOut.textContent=tempo+" BPM"; tempoIn.setAttribute("aria-valuetext",tempo+" beats per minute");
    if(!actx) return; var t=T(); N.lfo.frequency.setTargetAtTime(tempo/60*4,t,.05); N.delay.delayTime.setTargetAtTime(BEAT*.75/ratio(),t,.05);
  }
  function applyFx(){
    pads[0].setAttribute("aria-pressed",String(echoOn)); pads[1].setAttribute("aria-pressed",String(stutOn));
    if(!actx) return; var t=T(); N.send.gain.setTargetAtTime(echoOn?.85:0,t,.015); N.chopMix.gain.setTargetAtTime(stutOn?1:0,t,.008); N.dry.gain.setTargetAtTime(stutOn?0:1,t,.008);
  }
  tempoIn.addEventListener("input",function(){ tempo=+tempoIn.value; applyTempo(); say("Tempo "+tempo+" BPM."+(soundOn?"":" Switch sound on to hear it.")); });
  filtIn.addEventListener("input",function(){ filt=+filtIn.value; applyFilter(); });
  /* effect pads are held: pointer down or Enter/Space on, release off. A click with no pointer (assistive tech) plays a short throw. */
  var viaKey=false;
  function padSet(btn,on){ var fx=btn.getAttribute("data-fx"); if(fx==="echo") echoOn=on; else stutOn=on; applyFx(); if(on) say((fx==="echo"?"Echo throw.":"Stutter.")+(soundOn?"":" Switch sound on to hear it.")); }
  pads.forEach(function(btn){
    btn.addEventListener("pointerdown",function(e){ e.preventDefault(); try{ btn.setPointerCapture(e.pointerId); }catch(err){} padSet(btn,true); });
    function off(){ padSet(btn,false); } btn.addEventListener("pointerup",off); btn.addEventListener("pointercancel",off); btn.addEventListener("lostpointercapture",off);
    btn.addEventListener("keydown",function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); viaKey=true; if(!e.repeat) padSet(btn,true); } });
    btn.addEventListener("keyup",function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); padSet(btn,false); setTimeout(function(){ viaKey=false; },300); } });
    btn.addEventListener("blur",function(){ padSet(btn,false); });
    btn.addEventListener("click",function(e){ if(e.detail===0&&!viaKey){ padSet(btn,true); setTimeout(function(){ padSet(btn,false); },900); } });
  });

  /* ---------- the needle: platter speed drives playback rate; direction picks the forward or the reversed copy ---------- */
  function startSource(dir){
    if(!rec||!actx) return; var t=T();
    if(src){ src.g.gain.cancelScheduledValues(t); src.g.gain.setTargetAtTime(0,t,.004); try{ src.s.stop(t+.04); }catch(err){} }
    var s=actx.createBufferSource(), gg=actx.createGain(); s.buffer=dir>0?rec.fwd:rec.rev; s.loop=true; s.playbackRate.value=rateNow; gg.gain.setValueAtTime(0,t); gg.gain.setTargetAtTime(1,t,.004); s.connect(gg); gg.connect(N.gate);
    var p=((pos0%rec.len)+rec.len)%rec.len; s.start(t,dir>0?p:(rec.len-p)%rec.len); src={s:s,g:gg}; srcDir=dir;
  }
  function audioTick(){
    var t=T(), adt=lastAT?t-lastAT:0; lastAT=t; if(adt>.1||adt<0) adt=0;
    if(rec&&src){ pos0+=srcDir*rateNow*adt; if(rec.len) pos0=((pos0%rec.len)+rec.len)%rec.len; }
    var r=Math.min(6,Math.abs(vel)/BASE_VEL), dir=vel>=0?1:-1;
    if(rec&&soundOn){ if(!src||(dir!==srcDir&&Math.abs(vel)>3)) startSource(dir); }
    if(adt>0) rateNow+=(r-rateNow)*(1-Math.exp(-adt/.012)); else rateNow=r;
    if(src) src.s.playbackRate.setTargetAtTime(r,t,.012);
    var gate=!soundOn?0:(dragging||keyDir)?1:clamp((r-.1)/.3,0,1); N.gate.gain.setTargetAtTime(gate,t,.03);
  }
  function wakeAudio(){ if(actx&&soundOn&&inView&&!document.hidden&&actx.state==="suspended") actx.resume(); }
  function pauseAudio(){ if(actx&&actx.state==="running") actx.suspend(); }
  function mute(){ if(!actx) return; N.master.gain.setTargetAtTime(0,T(),.04); setTimeout(function(){ if(!soundOn){ if(src){ try{ src.s.stop(); }catch(err){} src=null; srcDir=0; } pauseAudio(); } },200); }
  soundBtn.addEventListener("click",function(){
    if(!soundOn){
      if(!ensureAudio()){ say("This browser can't play the sound."); return; }
      soundOn=true; soundBtn.setAttribute("aria-checked","true"); lastAT=0; applyFilter(); applyTempo(); applyFx(); actx.resume(); N.master.gain.setTargetAtTime(.9,T(),.05);
      say(recState==="ready"?(playing?"Sound on.":"Sound on. Press Play to drop the needle, or scratch it now."):"Sound on. Pressing the record...");
    } else { soundOn=false; soundBtn.setAttribute("aria-checked","false"); mute(); say("Muted."); }
  });
  document.addEventListener("visibilitychange",function(){ if(document.hidden) pauseAudio(); else wakeAudio(); });

  /* ---------- meters ---------- */
  function sizeWave(){ var r=wave.getBoundingClientRect(); if(!r.width) return; waveW=r.width; waveH=r.height; wave.width=Math.round(waveW*WDPR); wave.height=Math.round(waveH*WDPR); wctx.setTransform(WDPR,0,0,WDPR,0,0); waveIdle=false; drawWave(false); }
  function drawWave(live){
    if(!waveW) return; if(!live&&waveIdle) return; waveIdle=!live; wctx.clearRect(0,0,waveW,waveH); var mid=waveH/2;
    if(!live){ wctx.strokeStyle="rgba(246,238,220,.4)"; wctx.lineWidth=1.5; wctx.beginPath(); wctx.moveTo(0,mid); wctx.lineTo(waveW,mid); wctx.stroke(); return; }
    var d=N.td, n=d.length, stepX=waveW/(n/4); wctx.strokeStyle="#F0762F"; wctx.lineWidth=1.6; wctx.lineJoin="round"; wctx.beginPath();
    for(var i=0,x=0;i<n;i+=4,x+=stepX){ var y=mid+(d[i]-128)/128*mid*1.6; if(i===0) wctx.moveTo(x,y); else wctx.lineTo(x,y); } wctx.stroke();
  }
  function step(now){
    if(!inView){ raf=null; return; }
    var dt=Math.min(0.05,frameT?((now-frameT)/1000):0.016); frameT=now;
    if(!dragging){
      if(keyDir&&!reduced){ keyHeldT=Math.min(1,keyHeldT+dt*0.8); vel=clamp(vel+keyDir*(80+keyHeldT*260)*dt,-700,700); }
      else if(keyDir&&reduced){ angle+=keyDir*2.4; vel=keyDir*BASE_VEL*.8; }
      else {
        var idle=(!playing&&!bsT&&mount.classList.contains("wb-attract")&&!reduced)?IDLE:0, target=playing?BASE_VEL*ratio():idle, k=bsT>0?2.4:(playing?(Math.abs(vel)<target?1.5:2.2):1);
        vel+=(target-vel)*Math.min(1,dt*k); if(!playing&&!idle&&Math.abs(vel)<1) vel=0; if(bsT>0) bsT=Math.max(0,bsT-dt);
      }
      if(!reduced) angle+=vel*dt; setAngle();
    } else if(now-lastDragT>60){ vel*=Math.exp(-dt*9); if(Math.abs(vel)<1) vel=0; }
    if(actx&&soundOn) audioTick();
    var live=!!(actx&&soundOn&&actx.state==="running"&&recState==="ready"), lvl=0;
    if(live){ N.an.getByteTimeDomainData(N.td); var sum=0, j; for(j=0;j<N.td.length;j++){ var v=(N.td[j]-128)/128; sum+=v*v; } lvl=Math.min(1,Math.sqrt(sum/N.td.length)*3.4); }
    drawWave(live);
    var mag=live?lvl:Math.min(1.4,Math.abs(vel)/BASE_VEL); vuPhase+=dt*(reduced?2:6);
    for(var i=0;i<vu.length;i++){ var m=Math.max(.08,mag*(0.62+0.38*Math.sin(vuPhase+i*1.3))); vu[i].style.transform="scaleY("+m.toFixed(2)+")"; }
    raf=requestAnimationFrame(step);
  }
  new IntersectionObserver(function(es){ inView=es[0].isIntersecting; if(inView){ if(!raf) raf=requestAnimationFrame(step); wakeAudio(); } else pauseAudio(); },{threshold:.1}).observe(mount);
  window.addEventListener("resize",sizeWave); setTimeout(sizeWave,0); if(window.ResizeObserver) new ResizeObserver(sizeWave).observe(wave);
  c.reset.addEventListener("click",function(){
    angle=0; vel=0; dragging=false; keyDir=0; keyHeldT=0; playing=false; soundOn=false; bsT=0; tempo=BASE_BPM; filt=0; echoOn=false; stutOn=false;
    tempoIn.value=String(BASE_BPM); filtIn.value="0"; playBtn.setAttribute("aria-pressed","false"); playBtn.textContent="Play"; soundBtn.setAttribute("aria-checked","false");
    applyTempo(); applyFilter(); applyFx(); mute(); setAngle(); for(var i=0;i<vu.length;i++) vu[i].style.transform="scaleY(.08)"; waveIdle=false; drawWave(false); c.read.innerHTML=""; c.untouch();
  });
}

/* ======================= 5. Loose Type (K13) ======================= */
/* The studio's own lockup as physical pieces: fling them, they bounce and settle, Tidy snaps them home. */
function letters(mount){
  var c=card(mount,{title:"Loose Type",from:"K13",instr:"Grab a piece and fling it. Tidy brings the lockup home.",stageClass:"wb-tray-wrap",foot:"Our own lockup, in pieces. Arrow keys nudge, Enter flings."});
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

/* ======================= Runny Egg (Egg&Out) ======================= */
/* Their site's cursor, kept in a pan: the yolk leads on a stiff spring, the white trails on a
   soft one and can never let the yolk escape, grease streaks smear out behind. Click jiggles,
   double click flips it with a spatula. */
function eggcursor(mount){
  var c=card(mount,{title:"Runny Egg",from:"Egg&Out",instr:"Move around the pan. Left click jiggles the yolk, right click flips the egg.",stageClass:"wb-pan",foot:"Their cursor, kept in a pan. On touch, double tap flips it."});
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

/* ======================= Bacon Rush, built to order (Egg&Out) ======================= */
/* Their scroll-built sandwich, kept in a pan: scroll inside the stage and the layers drop in
   one by one, back to front, then the real photo bursts through a yolk splash. Every value comes
   from the site's own SandwichAssembly component (boxes, windows, easings). */
function sandwich(mount){
  var c=card(mount,{title:"Bacon Rush, built to order",from:"Egg&Out",instr:"Scroll inside the pan. Every layer drops in order. The last one is the real thing.",stageClass:"wb-build",
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

/* ======================= 9. Golden Hour (La Vida San Diego) ======================= */
/* A kitchen that had to feel like sunshine before you read a word. Slide the sun; the sky, the hills and the windows follow. */
function goldenhour(mount){
  var c=card(mount,{title:"Golden Hour",from:"La Vida San Diego",instr:"Slide the sun across the sky and watch the kitchen change with the light.",stageClass:"wb-sun",foot:"A pocket sunrise, not their site. The real one is warm from the first pixel."});
  c.stage.insertAdjacentHTML("beforeend",
    '<div class="wb-skyfield"><canvas class="wb-skycv" role="img" aria-label="A small cafe on a hillside under the sun. Drag across the scene to move the sun."></canvas></div>'+
    '<div class="wb-sunctl"><label class="vh" for="wb-sunrange">Sun position, from sunrise to night</label><input id="wb-sunrange" class="wb-range" type="range" min="0" max="100" value="30"></div>');
  var field=c.stage.querySelector(".wb-skyfield"), cv=c.stage.querySelector(".wb-skycv"), range=c.stage.querySelector(".wb-range");
  var ctx=cv.getContext("2d"), W=0, H=0, DPR=Math.min(3,window.devicePixelRatio||1), DISP=(getComputedStyle(document.documentElement).getPropertyValue("--disp")||"serif").trim();
  /* sky keys: [t, zenith, mid, horizon]; blues and warm oranges only */
  var KEYS=[[0,[96,128,186],[236,166,142],[255,206,150]],[.22,[86,158,222],[146,200,236],[255,232,196]],[.5,[52,136,214],[118,188,234],[214,236,247]],
    [.74,[78,108,176],[240,158,98],[255,206,116]],[.9,[32,46,96],[176,86,84],[244,140,84]],[1,[10,18,42],[20,32,64],[44,58,92]]];
  function mixc(a,b,k){ return [a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k]; }
  function rgba(v,a){ return "rgba("+Math.round(v[0])+","+Math.round(v[1])+","+Math.round(v[2])+","+(a==null?1:+a.toFixed(3))+")"; }
  function sstep(a,b,x){ var k=clamp((x-a)/(b-a),0,1); return k*k*(3-2*k); }
  function sky(t){ var i=0; while(i<KEYS.length-2&&t>KEYS[i+1][0]) i++; var a=KEYS[i], b=KEYS[i+1], k=sstep(a[0],b[0],t); return {top:mixc(a[1],b[1],k),mid:mixc(a[2],b[2],k),hor:mixc(a[3],b[3],k)}; }
  function rng(s){ return function(){ s|=0; s=s+0x6D2B79F5|0; var t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  var R=rng(13), stars=[], i0; for(i0=0;i0<70;i0++) stars.push([R(),R()*.55,.5+R()*1,.4+R()*.6]);
  var LAY=[{base:.60,a1:.03,f1:5.2,p1:1,a2:.015,f2:11,p2:2,a3:.006,f3:23,p3:0,col:[150,182,176],haze:.55},
    {base:.67,a1:.04,f1:3.4,p1:4,a2:.02,f2:9,p2:1,a3:.008,f3:19,p3:3,col:[102,152,122],haze:.28},
    {base:.755,a1:.03,f1:2.4,p1:2,a2:.015,f2:7,p2:5,a3:.006,f3:17,p3:1,col:[66,120,86],haze:.06}];
  function hy(x,L){ var n=x/W; return H*(L.base+Math.sin(n*L.f1+L.p1)*L.a1+Math.sin(n*L.f2+L.p2)*L.a2+Math.sin(n*L.f3+L.p3)*L.a3); }
  var CLOUDS=[[.16,.2,1],[.52,.13,.8],[.78,.3,1.15],[.34,.38,.7]];
  function phase(t){ return t<.12?"Sunrise":t<.35?"Morning":t<.62?"Midday":t<.82?"Golden hour":t<.94?"Dusk":"Lights on"; }
  function clock(t){ var m=Math.round((6+t*14)*60), h=Math.floor(m/60), mm=m%60; return ((h+11)%12+1)+":"+(mm<10?"0":"")+mm+(h<12||h>=24?" am":" pm"); }

  function draw(t){
    if(!W) return;
    var u=Math.min(W/340,H/260), hz=H*.6, S=sky(t), night=sstep(.8,.97,t), day=1-night,
      warm=clamp(sstep(.6,.78,t)*(1-sstep(.88,.95,t))+(1-sstep(0,.16,t))*.85,0,1), lit=clamp(sstep(.72,.9,t)+(1-sstep(0,.1,t))*.9,0,1);
    var U=t/.92, e=U<1?Math.pow(Math.sin(Math.PI*U),1.25):-(U-1)*4.2, sx=W*(.08+.84*t), sy=hz-e*H*.5, vis=1-sstep(.9,.97,t);
    var sunCol=mixc([255,238,176],[255,118,46],1-clamp(e*1.7,0,1));
    function tint(col,wa){ var c1=mixc(col,[255,178,100],warm*(wa==null?.28:wa)), d=1-night*.78; return mixc([c1[0]*d,c1[1]*d,c1[2]*d],[10,18,40],night*.5); }
    ctx.setTransform(DPR,0,0,DPR,0,0); ctx.globalCompositeOperation="source-over"; ctx.globalAlpha=1;
    /* sky */
    var g=ctx.createLinearGradient(0,0,0,hz*1.05); g.addColorStop(0,rgba(S.top)); g.addColorStop(.6,rgba(S.mid)); g.addColorStop(1,rgba(S.hor)); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    if(night>.04){ stars.forEach(function(s){ ctx.fillStyle="rgba(255,248,226,"+(night*s[3]*(1-s[1]/.6)).toFixed(3)+")"; ctx.beginPath(); ctx.arc(s[0]*W,s[1]*H,s[2]*Math.max(.7,u*.8),0,6.283); ctx.fill(); });
      var mg=ctx.createRadialGradient(W*.82,H*.2,0,W*.82,H*.2,26*u); mg.addColorStop(0,"rgba(255,246,214,"+(.5*night).toFixed(3)+")"); mg.addColorStop(.3,"rgba(255,246,214,"+(.12*night).toFixed(3)+")"); mg.addColorStop(1,"rgba(255,246,214,0)"); ctx.fillStyle=mg; ctx.fillRect(W*.82-26*u,H*.2-26*u,52*u,52*u);
      ctx.fillStyle="rgba(250,240,208,"+(.92*night).toFixed(3)+")"; ctx.beginPath(); ctx.arc(W*.82,H*.2,6.5*u,0,6.283); ctx.fill();
      ctx.fillStyle=rgba(mixc(S.top,S.mid,.2),.88*night); ctx.beginPath(); ctx.arc(W*.82+3.2*u,H*.2-1.4*u,5.7*u,0,6.283); ctx.fill(); }
    /* sun glow, bloom and disc */
    if(vis>.01){
      ctx.globalCompositeOperation="lighter";
      var gr=H*.95, sg=ctx.createRadialGradient(sx,sy,0,sx,sy,gr); sg.addColorStop(0,rgba(sunCol,.5*vis*day)); sg.addColorStop(.18,rgba(sunCol,.2*vis*day)); sg.addColorStop(1,rgba(sunCol,0)); ctx.fillStyle=sg; ctx.fillRect(0,0,W,H);
      if(warm>.05){ ctx.save(); ctx.translate(sx,hz); ctx.scale(2.6,.42); var hg=ctx.createRadialGradient(0,0,0,0,0,H*.5); hg.addColorStop(0,rgba([255,140,60],.42*warm*vis)); hg.addColorStop(1,"rgba(255,140,60,0)"); ctx.fillStyle=hg; ctx.fillRect(-H*.5,-H*.5,H,H); ctx.restore(); }
      ctx.globalCompositeOperation="source-over";
      var sr=19*u*(1+.28*(1-clamp(e*1.4,0,1))), dg=ctx.createRadialGradient(sx-sr*.25,sy-sr*.25,sr*.1,sx,sy,sr); dg.addColorStop(0,"rgba(255,252,232,"+vis.toFixed(3)+")"); dg.addColorStop(.55,rgba(sunCol,vis)); dg.addColorStop(1,rgba(mixc(sunCol,[255,90,30],.4),vis));
      ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(sx,sy,sr,0,6.283); ctx.fill();
    }
    /* clouds */
    var cloudCol=mixc(mixc([255,255,255],S.hor,.45),[40,52,84],night*.8), drift=(t-.5)*W*.14;
    CLOUDS.forEach(function(k,ci){ var cx=((k[0]*W+drift*(.6+ci*.25))%(W+160)+W+160)%(W+160)-80, cy=k[1]*H, sc=k[2]*u, a=(.62-night*.45)*(ci===3?.7:1);
      [[-26,3,20,8],[-8,-4,26,11],[14,-1,24,10],[32,4,18,7],[2,5,34,7]].forEach(function(b){ var bx=cx+b[0]*sc, by=cy+b[1]*sc, rx=b[2]*sc, ry=b[3]*sc;
        ctx.save(); ctx.translate(bx,by); ctx.scale(1,ry/rx); var cg=ctx.createRadialGradient(0,0,0,0,0,rx); cg.addColorStop(0,rgba(cloudCol,a)); cg.addColorStop(.6,rgba(cloudCol,a*.55)); cg.addColorStop(1,rgba(cloudCol,0)); ctx.fillStyle=cg; ctx.fillRect(-rx,-rx,rx*2,rx*2); ctx.restore(); }); });
    /* hills, far to near, hazier the farther they are */
    LAY.forEach(function(L,li){
      var top=mixc(tint(L.col),S.hor,L.haze), bot=mixc(top,tint([40,80,60]),.45), hg=ctx.createLinearGradient(0,H*(L.base-.05),0,H*.88); hg.addColorStop(0,rgba(top)); hg.addColorStop(1,rgba(bot));
      ctx.beginPath(); ctx.moveTo(0,H); var x; for(x=0;x<=W+3;x+=3) ctx.lineTo(x,hy(x,L)); ctx.lineTo(W,H); ctx.closePath(); ctx.fillStyle=hg; ctx.fill();
      if(warm>.05&&vis>.05){ ctx.beginPath(); for(x=0;x<=W+3;x+=3){ if(x===0) ctx.moveTo(x,hy(x,L)); else ctx.lineTo(x,hy(x,L)); } ctx.strokeStyle=rgba(sunCol,.38*warm*vis*(1-li*.25)); ctx.lineWidth=1.2; ctx.stroke(); }
    });
    /* ground and walk */
    var gy=H*.855, cx=W*.47, cw=132*u, wh=62*u, L0=cx-cw/2, wt=gy-wh;
    var gg=ctx.createLinearGradient(0,gy-4,0,H); gg.addColorStop(0,rgba(tint([84,134,88]))); gg.addColorStop(1,rgba(tint([58,102,70]))); ctx.fillStyle=gg; ctx.fillRect(0,gy-3*u,W,H-gy+3*u);
    ctx.fillStyle=rgba(tint([226,212,186],.4)); ctx.fillRect(0,H*.905,W,H); ctx.fillStyle=rgba(tint([150,136,112]),.55); ctx.fillRect(0,H*.905,W,1);
    /* cast shadows: they lengthen and swing away from the sun */
    var dir=sx<cx?1:-1, Ls=cw*.2+(1-clamp(e,0,1))*cw*.85, sa=.34*day*clamp(1-night*2,0,1)*(e<0?0:1)*clamp(e*6,0,1);
    if(sa>.01){ var shx=dir>0?L0+cw:L0, sg2=ctx.createLinearGradient(dir>0?L0:L0+cw,0,shx+dir*Ls,0); sg2.addColorStop(0,"rgba(18,30,26,"+sa.toFixed(3)+")"); sg2.addColorStop(1,"rgba(18,30,26,0)");
      ctx.fillStyle=sg2; ctx.beginPath(); ctx.moveTo(L0,gy); ctx.lineTo(L0+cw,gy); ctx.lineTo(L0+cw+dir*Ls*.9,gy+8*u); ctx.lineTo(L0+dir*Ls*.9,gy+8*u); ctx.closePath(); ctx.fill(); }
    /* palm */
    var pxx=W*.84, ph=100*u, ptx=pxx-9*u, pty=gy-ph;
    if(sa>.01){ ctx.strokeStyle="rgba(18,30,26,"+(sa*.8).toFixed(3)+")"; ctx.lineWidth=3*u; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(pxx,gy+1*u); ctx.lineTo(pxx+dir*Ls*.55,gy+6*u); ctx.stroke(); }
    ctx.strokeStyle=rgba(tint([100,74,48])); ctx.lineWidth=4.2*u; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(pxx,gy); ctx.quadraticCurveTo(pxx+7*u,gy-ph*.5,ptx,pty); ctx.stroke();
    ctx.strokeStyle=rgba(tint([70,50,32]),.55); ctx.lineWidth=1; for(var ri=1;ri<9;ri++){ var rt=ri/9, rx=lerpQ(pxx,pxx+7*u,ptx,rt), ry=lerpQ(gy,gy-ph*.5,pty,rt); ctx.beginPath(); ctx.moveTo(rx-2*u,ry); ctx.lineTo(rx+2*u,ry-1*u); ctx.stroke(); }
    function lerpQ(a,b,cc,t){ return (1-t)*(1-t)*a+2*(1-t)*t*b+t*t*cc; }
    [-172,-146,-118,-92,-64,-36,-10,14].forEach(function(deg,fi){ var a=deg*Math.PI/180, Lf=(38+(fi%3)*5)*u, ex=ptx+Math.cos(a)*Lf, ey=pty+Math.sin(a)*Lf*.55+Lf*.38, mx=ptx+Math.cos(a)*Lf*.55, my=pty+Math.sin(a)*Lf*.5-Lf*.22, nx=-Math.sin(a), ny=Math.cos(a), w=4.6*u;
      ctx.fillStyle=rgba(tint(fi%2?[44,100,72]:[54,112,80])); ctx.beginPath(); ctx.moveTo(ptx,pty); ctx.quadraticCurveTo(mx+nx*w,my+ny*w,ex,ey); ctx.quadraticCurveTo(mx-nx*w,my-ny*w,ptx,pty); ctx.fill(); });
    ctx.fillStyle=rgba(tint([110,76,44])); ctx.beginPath(); ctx.arc(ptx,pty+1*u,2.6*u,0,6.283); ctx.fill();
    /* the cafe */
    var side=sx<cx?-1:1, wallA=tint([246,234,210],.35), wallB=mixc(wallA,[30,36,50],.22);
    var wg=ctx.createLinearGradient(L0,0,L0+cw,0); wg.addColorStop(0,rgba(side<0?wallA:wallB)); wg.addColorStop(1,rgba(side<0?wallB:wallA)); ctx.fillStyle=wg; ctx.fillRect(L0,wt,cw,wh);
    ctx.fillStyle=rgba(tint([176,98,60])); ctx.fillRect(L0,gy-5*u,cw,5*u);
    /* parapet with the sign */
    var pg=ctx.createLinearGradient(0,wt-13*u,0,wt); pg.addColorStop(0,rgba(tint([214,110,64]))); pg.addColorStop(1,rgba(tint([182,86,48]))); ctx.fillStyle=pg; ctx.fillRect(L0-4*u,wt-13*u,cw+8*u,13*u);
    ctx.fillStyle=rgba(tint([236,150,100]),.9); ctx.fillRect(L0-5*u,wt-15*u,cw+10*u,2.4*u);
    ctx.fillStyle=rgba(tint([250,238,214])); ctx.font="600 "+Math.max(8,7.2*u).toFixed(1)+"px "+DISP; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("LA VIDA",cx,wt-6.4*u);
    /* windows */
    function win(x,y,w,h){
      ctx.fillStyle=rgba(tint([120,86,56])); ctx.fillRect(x-2*u,y-2*u,w+4*u,h+4*u);
      var wg2=ctx.createLinearGradient(0,y,0,y+h), dayTop=mixc(S.mid,[40,70,96],.35), dayBot=mixc(S.hor,[70,100,116],.3), litTop=[255,214,132], litBot=[255,168,78];
      wg2.addColorStop(0,rgba(mixc(dayTop,litTop,lit))); wg2.addColorStop(1,rgba(mixc(dayBot,litBot,lit))); ctx.fillStyle=wg2; ctx.fillRect(x,y,w,h);
      if(lit>.05){ ctx.fillStyle="rgba(120,60,24,"+(.5*lit).toFixed(3)+")"; ctx.fillRect(x+w*.18,y+h*.7,w*.28,h*.06); ctx.fillRect(x+w*.3,y+h*.76,w*.04,h*.24);
        ctx.fillStyle="rgba(255,236,170,"+(.9*lit).toFixed(3)+")"; ctx.beginPath(); ctx.ellipse(x+w*.72,y+h*.4,w*.09,h*.07,0,0,6.283); ctx.fill(); ctx.fillStyle="rgba(120,60,24,"+(.45*lit).toFixed(3)+")"; ctx.fillRect(x+w*.71,y+h*.44,w*.02,h*.4); }
      ctx.fillStyle="rgba(255,255,255,"+(.2*(1-lit)*day).toFixed(3)+")"; ctx.beginPath(); ctx.moveTo(x+w*.1,y+h); ctx.lineTo(x+w*.5,y); ctx.lineTo(x+w*.72,y); ctx.lineTo(x+w*.32,y+h); ctx.closePath(); ctx.fill();
      ctx.fillStyle=rgba(tint([236,222,196])); ctx.fillRect(x+w/2-.7*u,y,1.4*u,h); ctx.fillRect(x,y+h*.45,w,1.4*u);
      if(lit>.05){ ctx.globalCompositeOperation="lighter"; var wgl=ctx.createRadialGradient(x+w/2,y+h/2,0,x+w/2,y+h/2,w*1.1); wgl.addColorStop(0,"rgba(255,176,80,"+(.38*lit).toFixed(3)+")"); wgl.addColorStop(1,"rgba(255,176,80,0)"); ctx.fillStyle=wgl; ctx.fillRect(x-w,y-w,w*3,h+w*2); ctx.globalCompositeOperation="source-over"; }
    }
    win(L0+14*u,wt+19*u,26*u,24*u); win(L0+cw-14*u-26*u,wt+19*u,26*u,24*u);
    /* door */
    var dw=20*u, dh=36*u, dx=cx-dw/2, dy=gy-5*u-dh+5*u;
    ctx.fillStyle=rgba(tint([128,80,48])); ctx.beginPath(); ctx.moveTo(dx,gy); ctx.lineTo(dx,dy+dw/2); ctx.arc(cx,dy+dw/2,dw/2,Math.PI,0); ctx.lineTo(dx+dw,gy); ctx.closePath(); ctx.fill();
    var dgl=ctx.createLinearGradient(0,dy,0,dy+dh*.6); dgl.addColorStop(0,rgba(mixc(mixc(S.mid,[40,70,96],.35),[255,214,132],lit))); dgl.addColorStop(1,rgba(mixc(mixc(S.hor,[70,100,116],.3),[255,168,78],lit)));
    ctx.fillStyle=dgl; ctx.beginPath(); ctx.moveTo(dx+3*u,dy+dh*.58); ctx.lineTo(dx+3*u,dy+dw/2); ctx.arc(cx,dy+dw/2,dw/2-3*u,Math.PI,0); ctx.lineTo(dx+dw-3*u,dy+dh*.58); ctx.closePath(); ctx.fill();
    ctx.fillStyle=rgba(tint([246,214,150])); ctx.beginPath(); ctx.arc(dx+dw-4*u,gy-dh*.38,1.2*u,0,6.283); ctx.fill();
    /* striped awning, scalloped, with its own shade on the wall */
    var ay0=wt+7*u, ay1=ay0+15*u, n=14, aw=(cw+8*u)/n, ax0=L0-4*u, sh=.22*day*(e>0?1:0);
    if(sh>.01){ ctx.fillStyle="rgba(20,18,14,"+sh.toFixed(3)+")"; ctx.fillRect(L0+side*-2*u,ay1,cw,9*u); }
    for(var s=0;s<n;s++){ var col=tint(s%2?[247,239,222]:[226,78,27],.3), xa=ax0+s*aw, tl=cx+((xa-cx)*.92), tr=cx+((xa+aw-cx)*.92);
      ctx.fillStyle=rgba(col); ctx.beginPath(); ctx.moveTo(tl,ay0); ctx.lineTo(tr,ay0); ctx.lineTo(xa+aw,ay1); ctx.arc(xa+aw/2,ay1,aw/2,0,Math.PI); ctx.lineTo(xa,ay1); ctx.closePath(); ctx.fill(); }
    var ag=ctx.createLinearGradient(0,ay0,0,ay1+aw/2); ag.addColorStop(0,"rgba(20,16,10,"+(.28).toFixed(2)+")"); ag.addColorStop(.35,"rgba(20,16,10,0)"); ag.addColorStop(1,"rgba(20,16,10,.14)"); ctx.fillStyle=ag; ctx.fillRect(ax0,ay0,cw+8*u,ay1-ay0+aw/2);
    /* bistro tables on the walk */
    [[-46,1],[44,-1]].forEach(function(tb){ var bx=cx+tb[0]*u, by=H*.935; ctx.fillStyle=rgba(tint([60,56,52])); ctx.fillRect(bx-.8*u,by-12*u,1.6*u,12*u); ctx.beginPath(); ctx.ellipse(bx,by-12*u,8*u,2.4*u,0,0,6.283); ctx.fillStyle=rgba(tint([196,92,52])); ctx.fill();
      ctx.strokeStyle=rgba(tint([60,56,52])); ctx.lineWidth=1.3*u; ctx.beginPath(); ctx.arc(bx+tb[1]*13*u,by-6*u,4*u,Math.PI*(tb[1]>0?.9:-.1),Math.PI*(tb[1]>0?2.1:1.1)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(bx+tb[1]*13*u,by-2*u); ctx.lineTo(bx+tb[1]*13*u,by); ctx.stroke(); });
    /* string lights from a pole to the roof and from the roof to the palm */
    var pole=L0-40*u, py0=gy-58*u; ctx.strokeStyle=rgba(tint([70,56,44])); ctx.lineWidth=1.6*u; ctx.beginPath(); ctx.moveTo(pole,gy+1*u); ctx.lineTo(pole,py0); ctx.stroke();
    function lights(x0,y0,x1,y1,sag){ ctx.strokeStyle="rgba(30,26,22,"+(.5*day+.25).toFixed(2)+")"; ctx.lineWidth=1; ctx.beginPath(); var k, N=9; for(k=0;k<=N;k++){ var q=k/N, xx=x0+(x1-x0)*q, yy=y0+(y1-y0)*q+Math.sin(Math.PI*q)*sag; if(k===0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy); } ctx.stroke();
      for(k=1;k<N;k++){ var q2=k/N, bx=x0+(x1-x0)*q2, by=y0+(y1-y0)*q2+Math.sin(Math.PI*q2)*sag+2*u; ctx.fillStyle=rgba([255,238,176],.5+.5*lit); ctx.beginPath(); ctx.arc(bx,by,1.5*u,0,6.283); ctx.fill();
        if(lit>.05){ ctx.globalCompositeOperation="lighter"; var bg=ctx.createRadialGradient(bx,by,0,bx,by,7*u); bg.addColorStop(0,"rgba(255,200,110,"+(.55*lit).toFixed(3)+")"); bg.addColorStop(1,"rgba(255,200,110,0)"); ctx.fillStyle=bg; ctx.fillRect(bx-7*u,by-7*u,14*u,14*u); ctx.globalCompositeOperation="source-over"; } } }
    lights(pole,py0,L0-4*u,wt-12*u,10*u); lights(L0+cw+4*u,wt-12*u,pxx+3*u,gy-ph*.66,12*u);
    /* last light on everything, then a soft vignette */
    if(warm>.03&&vis>.03){ var wsh=ctx.createRadialGradient(sx,Math.min(sy,hz),0,sx,Math.min(sy,hz),W*.9); wsh.addColorStop(0,rgba([255,170,80],.16*warm*vis)); wsh.addColorStop(1,"rgba(255,170,80,0)"); ctx.fillStyle=wsh; ctx.fillRect(0,0,W,H); }
    var vg=ctx.createRadialGradient(W/2,H*.55,H*.4,W/2,H*.55,Math.max(W,H)*.75); vg.addColorStop(0,"rgba(10,16,30,0)"); vg.addColorStop(1,"rgba(10,16,30,"+(.12+.18*night).toFixed(3)+")"); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
  }

  /* the slider sets a target; the scene eases toward it, so a fast drag never jumps */
  var target=.3, cur=.3, raf=null, lastT=0, lastPhase="";
  function size(){ var r=field.getBoundingClientRect(); if(!r.width) return; W=r.width; H=r.height; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); draw(cur); }
  function loop(now){ raf=null; var dt=Math.min(.05,lastT?(now-lastT)/1000:.016); lastT=now; cur+=(target-cur)*(1-Math.exp(-dt*8)); if(Math.abs(target-cur)<.0006) cur=target; draw(cur); if(cur!==target) raf=requestAnimationFrame(loop); else lastT=0; }
  function paint(announce){
    target=range.value/100; var p=phase(target), time=clock(target);
    range.setAttribute("aria-valuetext",time+", "+p);
    if(reduced||!W){ cur=target; draw(cur); } else if(!raf) raf=requestAnimationFrame(loop);
    if(announce&&p!==lastPhase) c.read.innerHTML="<span><b>"+p+"</b> · "+time+"</span>";
    if(p!==lastPhase) cv.setAttribute("aria-label","A small cafe on a hillside under the sun. "+p+", "+time+". Drag across the scene to move the sun.");
    lastPhase=p;
  }
  range.addEventListener("input",function(){ c.touch(); paint(true); });
  var drag=false;
  function setX(e){ var r=field.getBoundingClientRect(); range.value=String(Math.round(clamp((e.clientX-r.left)/r.width,0,1)*100)); paint(true); }
  field.addEventListener("pointerdown",function(e){ drag=true; field.setPointerCapture(e.pointerId); setX(e); });
  field.addEventListener("pointermove",function(e){ if(drag) setX(e); });
  function end(){ drag=false; } field.addEventListener("pointerup",end); field.addEventListener("pointercancel",end);
  c.reset.addEventListener("click",function(){ range.value="30"; lastPhase=""; paint(false); c.read.innerHTML=""; c.untouch(); });
  if(window.ResizeObserver) new ResizeObserver(size).observe(field); else window.addEventListener("resize",size);
  paint(false); setTimeout(size,0);
}

/* ======================= 13. Count the Pours (BarFix) ======================= */
/* Every bottle steps on a scale, so a missing pour has nowhere to hide. Pour, ring it up, and see what the scale knows. */
function pours(mount){
  var c=card(mount,{title:"Count the Pours",from:"BarFix",instr:"Pour a drink, then ring it up. The scale knows what you forgot.",stageClass:"wb-bar",foot:"Pretend bottle, pretend bar. The real scale is much less forgiving."});
  c.stage.insertAdjacentHTML("beforeend",
    '<div class="wb-barrow"><div class="wb-scalewrap" aria-hidden="true"><div class="wb-bottle"><span class="wb-neck"></span><span class="wb-bbody"><i class="wb-liq"></i></span></div><div class="wb-plate"></div></div>'+
    '<dl class="wb-barread"><div><dt>Scale</dt><dd class="wb-bw">1178 g</dd></div><div><dt>Poured</dt><dd class="wb-bp">0</dd></div><div><dt>Rung up</dt><dd class="wb-br">0</dd></div></dl></div>'+
    '<p class="wb-ledger"><span class="wb-ledmark" aria-hidden="true">OK</span><span class="wb-ledtxt">Every pour accounted for.</span></p>'+
    '<div class="wb-barctl"><button type="button" class="wb-barbtn wb-pourbtn wb-nudge">Pour</button><button type="button" class="wb-barbtn wb-ringbtn" disabled>Ring it up</button></div>');
  var liq=c.stage.querySelector(".wb-liq"), bw=c.stage.querySelector(".wb-bw"), bp=c.stage.querySelector(".wb-bp"), br=c.stage.querySelector(".wb-br"), mark=c.stage.querySelector(".wb-ledmark"), txt2=c.stage.querySelector(".wb-ledtxt"), pour=c.stage.querySelector(".wb-pourbtn"), ring=c.stage.querySelector(".wb-ringbtn"), led=c.stage.querySelector(".wb-ledger");
  var POURS=12, poured=0, rung=0;
  function paint(){
    var level=1-poured/POURS; liq.style.height=(level*100)+"%"; bw.textContent=Math.round(520+658*level)+" g"; bp.textContent=String(poured); br.textContent=String(rung);
    var miss=poured-rung; led.classList.toggle("short",miss>0); mark.textContent=miss>0?"!":"OK";
    txt2.textContent=miss>0?(miss+(miss===1?" pour is":" pours are")+" unaccounted for."):"Every pour accounted for.";
    pour.disabled=poured>=POURS; ring.disabled=rung>=poured;
  }
  pour.addEventListener("click",function(){ if(poured>=POURS) return; poured++; paint(); c.read.innerHTML=poured>=POURS?"<span><b>Empty.</b> Reset opens a fresh bottle.</span>":"<span>Poured. "+(POURS-poured)+" left in the bottle.</span>"; if(poured>=POURS&&ring.disabled) ring.focus(); });
  ring.addEventListener("click",function(){ if(rung>=poured) return; rung++; paint(); c.read.innerHTML=poured===rung?"<span><b>Square.</b> The scale and the till agree.</span>":"<span>Rung up. Still "+(poured-rung)+" short.</span>"; });
  c.reset.querySelector("span").textContent="New bottle"; c.reset.setAttribute("aria-label","Open a new bottle");
  c.reset.addEventListener("click",function(){ poured=0; rung=0; paint(); c.read.innerHTML=""; c.untouch(); });
  paint();
}

/* ======================= 14. Limewash (baa atelier) ======================= */
/* A finishing studio in Roman clay and limewash. Pick a trowel or a brush, then work a raw wall; cover it all and it finishes itself. */
function limewash(mount){
  var c=card(mount,{title:"Limewash",from:"baa atelier",instr:"Pick a trowel or a brush, then drag to finish the raw wall. Cover all of it.",stageClass:"wb-clay",foot:"A toy wall. The real finishes take days and a steady hand."});
  var cv=el("canvas","wb-fill"); cv.setAttribute("role","img"); cv.setAttribute("aria-label","A raw plaster wall. Drag to work it with the chosen tool, or use the arrow keys to move the tool."); cv.tabIndex=0; c.stage.appendChild(cv);
  var kit=el("div","wb-tools",'<button type="button" class="wb-toolbtn" data-tool="trowel" aria-pressed="true">Trowel</button><button type="button" class="wb-toolbtn" data-tool="brush" aria-pressed="false">Brush</button>');
  kit.setAttribute("role","group"); kit.setAttribute("aria-label","Tool"); c.stage.appendChild(kit);
  /* the tools, drawn top-down: local origin is the working edge, local +x is the direction of travel, the handle trails behind */
  var gid="wbl"+uid, bristles="";
  for(var bi=0;bi<27;bi++){ var by=-25+bi*1.9, bl=19+Math.round(Math.abs(Math.sin(bi*2.7))*3); bristles+='<line x1="'+(Math.sin(bi*1.9)*.7).toFixed(1)+'" y1="'+by.toFixed(1)+'" x2="-'+bl+'" y2="'+by.toFixed(1)+'" stroke="#B8A98B" stroke-width=".7" opacity="'+(.35+Math.abs(Math.sin(bi*3.1))*.4).toFixed(2)+'"/>'; }
  var TROWEL='<svg class="wb-tsvg wb-ts-trowel" viewBox="-110 -34 120 68" aria-hidden="true" focusable="false"><defs>'+
    '<linearGradient id="'+gid+'s" gradientUnits="userSpaceOnUse" x1="0" y1="-24" x2="0" y2="24"><stop offset="0" stop-color="#F4F7F9"/><stop offset=".45" stop-color="#B7C1CB"/><stop offset="1" stop-color="#7C8894"/></linearGradient>'+
    '<linearGradient id="'+gid+'w" gradientUnits="userSpaceOnUse" x1="0" y1="-7" x2="0" y2="7"><stop offset="0" stop-color="#D9A26A"/><stop offset=".55" stop-color="#A9703B"/><stop offset="1" stop-color="#7A4A22"/></linearGradient></defs>'+
    '<rect x="-108" y="-7" width="48" height="14" rx="7" fill="url(#'+gid+'w)"/><path d="M-100 -2.5Q-84 -4.5-66 -2.5M-100 2.5Q-84 4.5-66 2.5" stroke="#6B3F1B" stroke-width=".8" fill="none" opacity=".55"/>'+
    '<rect x="-64" y="-3" width="20" height="6" rx="2" fill="#7F8B97"/><rect x="-54" y="-8.5" width="16" height="17" rx="3.5" fill="#64707C"/><circle cx="-49" cy="-4" r="1.5" fill="#D9E0E6"/><circle cx="-49" cy="4" r="1.5" fill="#D9E0E6"/>'+
    '<path d="M0 -23Q3 0 0 23L-40 24Q-50 0-40 -24Z" fill="url(#'+gid+'s)" stroke="#56616C" stroke-width="1.2" stroke-linejoin="round"/>'+
    '<path d="M-6 -18L-38 -19.5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".75"/><path d="M-8 16L-37 17.5" stroke="#5B6672" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>'+
    '<path d="M1.5 -21Q4.5 0 1.5 21" stroke="#EFE6D2" stroke-width="3" stroke-linecap="round" fill="none" opacity=".9"/></svg>';
  var BRUSH='<svg class="wb-tsvg wb-ts-brush" viewBox="-110 -34 120 68" aria-hidden="true" focusable="false"><defs>'+
    '<linearGradient id="'+gid+'b" gradientUnits="userSpaceOnUse" x1="0" y1="-26" x2="0" y2="26"><stop offset="0" stop-color="#F4EEDF"/><stop offset="1" stop-color="#D3C6AA"/></linearGradient>'+
    '<linearGradient id="'+gid+'f" gradientUnits="userSpaceOnUse" x1="0" y1="-27" x2="0" y2="27"><stop offset="0" stop-color="#E4E9ED"/><stop offset=".5" stop-color="#9AA5B0"/><stop offset="1" stop-color="#6F7B87"/></linearGradient>'+
    '<linearGradient id="'+gid+'h" gradientUnits="userSpaceOnUse" x1="0" y1="-22" x2="0" y2="22"><stop offset="0" stop-color="#D9A26A"/><stop offset=".6" stop-color="#A5693A"/><stop offset="1" stop-color="#77481F"/></linearGradient></defs>'+
    '<rect x="-88" y="-22" width="54" height="44" rx="12" fill="url(#'+gid+'h)" stroke="#5E3818" stroke-width="1"/><path d="M-82 -12Q-60 -16-40 -11M-84 -2Q-62 -5-40 -1M-82 9Q-60 6-40 10" stroke="#6B3F1B" stroke-width=".9" fill="none" opacity=".5"/><circle cx="-72" cy="0" r="5" fill="#5E3818" opacity=".8"/><path d="M-80 -17Q-62 -20-44 -17" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".28" fill="none"/>'+
    '<rect x="-36" y="-27" width="14" height="54" rx="2.5" fill="url(#'+gid+'f)" stroke="#56616C" stroke-width="1"/><path d="M-32 -26V26M-27 -26V26" stroke="#56616C" stroke-width=".8" opacity=".5"/>'+
    '<path d="M-22 -26L0 -25L.5 25L-22 26Z" fill="url(#'+gid+'b)"/>'+bristles+'</svg>';
  var tw=el("div","wb-tool",'<div class="wb-tilt"><div class="wb-lift">'+TROWEL+BRUSH+'</div></div>'); tw.setAttribute("aria-hidden","true"); tw.setAttribute("data-tool","trowel"); c.stage.appendChild(tw);
  var tilt=tw.querySelector(".wb-tilt");
  var ctx=cv.getContext("2d"), W=0,H=0,DPR=Math.min(2,window.devicePixelRatio||1), GX=16, GY=10, cells=[], covered=0, dirty=false, finished=false;
  var TONES=["201,183,156","230,220,203","184,164,136","239,230,212"], tone=TONES[1], tool="trowel", hatch=1, grad=null;
  var kx=.5, ky=.5, tx=0, ty=0, px=0, py=0, vx=0, vy=0, ang=0, down=false, shown=false, ptr=false, lx=null, ly=null, raf=null, lastT=0, kbTimer=null, hideTimer=null, snap=true;
  function raw(){
    ctx.fillStyle="#9C8F7E"; ctx.fillRect(0,0,W,H);
    for(var i=0;i<900;i++){ var a=Math.random(); ctx.fillStyle=a<.5?"rgba(70,58,44,.25)":"rgba(230,220,200,.22)"; ctx.fillRect(Math.random()*W,Math.random()*H,1+Math.random()*2,1+Math.random()*2); }
  }
  function fresh(){ cells=[]; for(var i=0;i<GX*GY;i++) cells.push(0); covered=0; finished=false; dirty=false; raw(); }
  function size(){ var r=cv.getBoundingClientRect(); if(!r.width) return; var snapCv=null; if(dirty){ snapCv=document.createElement("canvas"); snapCv.width=cv.width; snapCv.height=cv.height; snapCv.getContext("2d").drawImage(cv,0,0); }
    W=r.width; H=r.height; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); ctx.lineCap="round"; ctx.lineJoin="round";
    if(snapCv){ ctx.drawImage(snapCv,0,0,W,H); } else raw(); tx=px=kx*W; ty=py=ky*H; grad=null; render(); }
  function mark(x,y){ var gx=clamp(Math.floor(x/W*GX),0,GX-1), gy=clamp(Math.floor(y/H*GY),0,GY-1); for(var dx=-1;dx<=1;dx++) for(var dy=-1;dy<=1;dy++){ var ax=gx+dx, ay=gy+dy; if(ax<0||ay<0||ax>=GX||ay>=GY) continue; var k=ay*GX+ax; if(!cells[k]){ cells[k]=1; covered++; } } }
  /* the trowel lays a wide, feathered band with a burnished sheen and two fine ridges; the brush leaves cloudy, crosshatched streaks */
  function bar(w){ var g=ctx.createLinearGradient(0,-w/2,0,w/2); g.addColorStop(0,"rgba("+tone+",0)"); g.addColorStop(.22,"rgba("+tone+",.11)"); g.addColorStop(.78,"rgba("+tone+",.11)"); g.addColorStop(1,"rgba("+tone+",0)"); return g; }
  function lay(x0,y0,x1,y1){
    var dx=x1-x0, dy=y1-y0, d=Math.hypot(dx,dy); if(d<.25) return; var a=Math.atan2(dy,dx), step=tool==="trowel"?2.5:4.5, n=Math.max(1,Math.ceil(d/step));
    if(!grad||grad.tone!==tone) grad={tone:tone,bar:bar(46),sheen:(function(){ var g=ctx.createLinearGradient(0,-23,0,23); g.addColorStop(0,"rgba(255,252,244,0)"); g.addColorStop(.62,"rgba(255,252,244,.5)"); g.addColorStop(.72,"rgba(255,252,244,0)"); return g; })()};
    for(var q=1;q<=n;q++){
      var x=x0+dx*q/n, y=y0+dy*q/n; ctx.save(); ctx.translate(x,y); ctx.rotate(a);
      if(tool==="trowel"){
        ctx.fillStyle=grad.bar; ctx.fillRect(-3.4,-23,6.8,46);
        ctx.globalAlpha=.07; ctx.fillStyle=grad.sheen; ctx.fillRect(-3.4,-23,6.8,46); ctx.globalAlpha=1;
        if(Math.random()<.22){ var o=(Math.random()-.5)*34; ctx.strokeStyle=Math.random()<.5?"rgba(120,104,82,.14)":"rgba(255,250,240,.2)"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-5,o); ctx.lineTo(4,o+(Math.random()-.5)*1.5); ctx.stroke(); }
        ctx.fillStyle="rgba(255,250,240,.16)"; ctx.fillRect(-1,-22,2,1.2); ctx.fillStyle="rgba(120,104,82,.12)"; ctx.fillRect(-1,21,2,1.2);
      } else {
        ctx.rotate(hatch*.5);
        for(var k=0;k<11;k++){ var oy=(Math.random()-.5)*52, len=7+Math.random()*10; ctx.strokeStyle=Math.random()<.18?"rgba(120,104,82,.13)":"rgba("+tone+","+(.1+Math.random()*.2).toFixed(2)+")"; ctx.lineWidth=.8+Math.random()*1.8; ctx.beginPath(); ctx.moveTo(-len/2,oy); ctx.lineTo(len/2,oy+(Math.random()-.5)*2); ctx.stroke(); }
        if(q%2===0){ var cr=14+Math.random()*16, cg=ctx.createRadialGradient(0,(Math.random()-.5)*30,0,0,0,cr); cg.addColorStop(0,"rgba("+tone+",.07)"); cg.addColorStop(1,"rgba("+tone+",0)"); ctx.fillStyle=cg; ctx.fillRect(-cr,-cr-15,cr*2,cr*2+30); }
      }
      ctx.restore(); mark(x,y);
    }
    dirty=true;
  }
  function check(){
    var pct=Math.round(covered/(GX*GY)*100);
    if(!finished&&pct>=90){ finished=true; c.read.innerHTML="<span><b>Finished.</b> Smooth, quiet, done.</span>"; } else if(!finished) c.read.innerHTML="<span>Wall "+pct+"% covered.</span>";
  }
  function render(){
    tw.style.transform="translate3d("+px.toFixed(1)+"px,"+py.toFixed(1)+"px,0)";
    tilt.style.transform="rotate("+ang.toFixed(3)+"rad)";
  }
  function show(){ clearTimeout(hideTimer); if(!shown){ shown=true; tw.classList.add("on"); } c.stage.classList.toggle("has-tool",ptr); }
  function hide(){ shown=false; tw.classList.remove("on","down"); c.stage.classList.remove("has-tool"); }
  function setDown(on){ down=on; tw.classList.toggle("down",on); }
  function wrap(a){ while(a>Math.PI) a-=2*Math.PI; while(a<-Math.PI) a+=2*Math.PI; return a; }
  /* the tool is held, not glued: it follows the hand on a damped spring, and the wall is worked where the tool really is */
  function frame(now){
    raf=null; var dt=Math.min(.033,lastT?(now-lastT)/1000:.016); lastT=now; var ox=px, oy=py;
    if(reduced||snap){ px=tx; py=ty; vx=vy=0; snap=false; if(Math.hypot(px-ox,py-oy)>2) ang=Math.atan2(py-oy,px-ox); }
    else { for(var i=0;i<2;i++){ var h=dt/2; vx+=((tx-px)*380-vx*26)*h; vy+=((ty-py)*380-vy*26)*h; px+=vx*h; py+=vy*h; }
      var sp=Math.hypot(vx,vy); if(sp>40) ang+=wrap(Math.atan2(vy,vx)-ang)*Math.min(1,dt*9); }
    if(down){ if(lx==null){ lx=px; ly=py; } lay(lx,ly,px,py); lx=px; ly=py; }
    render();
    if(down||Math.hypot(vx,vy)>3||Math.hypot(tx-px,ty-py)>.4) raf=requestAnimationFrame(frame); else lastT=0;
  }
  function go(){ if(!raf) raf=requestAnimationFrame(frame); }
  function pos(e){ var r=cv.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; }
  function aim(p){ tx=p.x; ty=p.y; kx=clamp(p.x/W,.03,.97); ky=clamp(p.y/H,.03,.97); }
  cv.addEventListener("pointerenter",function(e){ if(e.pointerType!=="mouse") return; ptr=true; if(!shown){ aim(pos(e)); snap=true; } show(); go(); });
  cv.addEventListener("pointerdown",function(e){ e.preventDefault(); cv.setPointerCapture(e.pointerId); ptr=e.pointerType==="mouse"; var p=pos(e); if(!shown||e.pointerType!=="mouse") snap=true; aim(p); show(); tone=TONES[tool==="brush"?[0,1,3,1][Math.floor(Math.random()*4)]:Math.floor(Math.random()*TONES.length)]; hatch=-hatch; setDown(true); lx=null; go(); });
  cv.addEventListener("pointermove",function(e){ var p=pos(e); aim(p); if(!down&&e.pointerType==="mouse"){ ptr=true; show(); } go(); });
  function up(){ if(!down) return; setDown(false); lx=null; check(); if(!ptr){ hideTimer=setTimeout(hide,900); } }
  cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",up);
  cv.addEventListener("pointerleave",function(){ ptr=false; if(!down&&document.activeElement!==cv) hide(); });
  cv.addEventListener("focus",function(){ if(!ptr){ tx=kx*W; ty=ky*H; snap=true; show(); go(); } });
  cv.addEventListener("blur",function(){ if(!down&&!ptr) hide(); });
  cv.addEventListener("keydown",function(e){
    var st=.045;
    if(e.key==="ArrowLeft") kx-=st; else if(e.key==="ArrowRight") kx+=st; else if(e.key==="ArrowUp") ky-=st; else if(e.key==="ArrowDown") ky+=st; else return;
    e.preventDefault(); kx=clamp(kx,.03,.97); ky=clamp(ky,.03,.97); tx=kx*W; ty=ky*H; ptr=false; tone=TONES[1];
    if(!shown){ px=tx; py=ty; snap=true; } show(); if(!down){ hatch=-hatch; setDown(true); lx=null; }
    clearTimeout(kbTimer); kbTimer=setTimeout(release,420); go();
  });
  function release(){ if(Math.hypot(tx-px,ty-py)>1){ kbTimer=setTimeout(release,120); return; } setDown(false); lx=null; check(); }
  kit.addEventListener("click",function(e){ var b=e.target.closest(".wb-toolbtn"); if(!b) return; tool=b.getAttribute("data-tool"); tw.setAttribute("data-tool",tool); grad=null;
    [].forEach.call(kit.querySelectorAll(".wb-toolbtn"),function(x){ x.setAttribute("aria-pressed",String(x===b)); });
    c.read.innerHTML="<span>"+(tool==="trowel"?"Trowel: wide, smooth, burnished passes.":"Brush: cloudy limewash, cross your strokes.")+"</span>"; });
  c.reset.querySelector("span").textContent="New wall"; c.reset.setAttribute("aria-label","Start again with a raw wall");
  c.reset.addEventListener("click",function(){ kx=.5; ky=.5; tx=px=W/2; ty=py=H/2; setDown(false); lx=null; fresh(); render(); c.read.innerHTML=""; c.untouch(); });
  fresh(); window.addEventListener("resize",size); setTimeout(size,0);
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
var games={carlos:carlos,miramar:miramar,egg:egg,cengo:cengo,eggcursor:eggcursor,sandwich:sandwich,letters:letters,
  goldenhour:goldenhour,pours:pours,limewash:limewash};
document.querySelectorAll("[data-game]").forEach(function(m){ var g=games[m.getAttribute("data-game")]; if(g) g(m); });
document.querySelectorAll(".wb [data-hunt]").forEach(function(n){ hunt.place(n); });
})();
