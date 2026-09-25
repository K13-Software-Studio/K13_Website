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

/* ======================= 1. Pour Check (BarFix) ======================= */
/* Three bottles, one has been free-poured. Weigh them, then call the one that walked. */
function barfix(mount){
  var c=card(mount,{title:"Pour Check",from:"BarFix",instr:"One bottle was over-poured. Weigh them, then catch it.",stageClass:"wb-bar",
    foot:"The math is real: 750 ml bottles, 480 g empty, 44 ml pours. BarFix does this for every bottle, every night."});
  var TARE=480,DENS=0.94,POUR=44,PRICE=12;
  var stage=c.stage, read=c.read;
  var shelf=el("div","wb-shelf"); stage.appendChild(shelf);
  var scale=el("div","wb-scale",'<div class="wb-plate"></div><div class="wb-lcd">0 g</div><span class="wb-hunt" data-hunt>13</span>'); stage.appendChild(scale);
  var lcd=scale.querySelector(".wb-lcd");
  var score=el("div","wb-score",'Caught <b>0</b> · Missed <b>0</b>'); stage.appendChild(score);
  var round=null, caught=0, missed=0;
  function svg(i){ return '<svg viewBox="0 0 40 120" aria-hidden="true"><defs><clipPath id="wbB'+uid+'_'+i+'"><path d="M13 2h14v22c6 4 10 10 10 20v66a8 8 0 0 1-8 8H11a8 8 0 0 1-8-8V44c0-10 4-16 10-20z"/></clipPath></defs><path class="wb-glass" d="M13 2h14v22c6 4 10 10 10 20v66a8 8 0 0 1-8 8H11a8 8 0 0 1-8-8V44c0-10 4-16 10-20z"/><rect class="wb-fill" x="0" y="0" width="40" height="120" clip-path="url(#wbB'+uid+'_'+i+')"/><rect class="wb-label" x="7" y="62" width="26" height="22" rx="3"/></svg>'; }
  function newRound(){
    shelf.innerHTML=""; lcd.textContent="0 g"; scale.classList.remove("on");
    var sold=3+Math.floor(Math.random()*4), thief=Math.floor(Math.random()*3), extra=2+Math.floor(Math.random()*3);
    round={thief:thief,bottles:[],weighed:{},over:false,sold:sold};
    for(var i=0;i<3;i++){
      var ml=750-sold*POUR-(i===thief?extra*POUR:0)+Math.round((Math.random()-.5)*8);
      /* the fill level alone gives nothing away: the over-poured bottle looks as full as the rest */
      var look=0.52+Math.random()*0.06;
      var b=el("div","wb-slot");
      var btn=el("button","wb-bottle",svg(i)); btn.type="button"; btn.setAttribute("aria-label","Bottle "+(i+1)+": weigh it");
      btn.querySelector(".wb-fill").setAttribute("y",String(120-look*100));
      var tag=txt("span","wb-btag","Bottle "+(i+1));
      var accuse=txt("button","wb-accuse","Accuse"); accuse.type="button"; accuse.setAttribute("aria-label","Accuse bottle "+(i+1));
      b.appendChild(btn); b.appendChild(tag); b.appendChild(accuse); shelf.appendChild(b);
      (function(i,ml,btn,b){ round.bottles.push({ml:ml,el:b});
        btn.addEventListener("click",function(){ weigh(i); });
        accuse.addEventListener("click",function(){ call(i); });
      })(i,ml,btn,b);
    }
    read.innerHTML='<span>The register says each bottle sold <b>'+sold+'</b> pours tonight. One of them lost more.</span>';
  }
  function weigh(i){
    if(round.over) return;
    var b=round.bottles[i], g=Math.round(TARE+b.ml*DENS);
    round.bottles.forEach(function(x){ x.el.classList.remove("on"); }); b.el.classList.add("on");
    scale.classList.remove("on"); void scale.offsetWidth; scale.classList.add("on");
    var n=0, t0=null, from=parseInt(lcd.textContent,10)||0;
    if(reduced){ lcd.textContent=g+" g"; } else { (function tick(t){ if(!t0) t0=t; var p=Math.min(1,(t-t0)/450); lcd.textContent=Math.round(from+(g-from)*(1-Math.pow(1-p,3)))+" g"; if(p<1) requestAnimationFrame(tick); })(performance.now()); requestAnimationFrame(function(){}); }
    round.weighed[i]=g; b.el.querySelector(".wb-btag").textContent=g+" g";
    read.innerHTML='<span>Bottle '+(i+1)+' weighs <b>'+g+' g</b>. Weighed '+Object.keys(round.weighed).length+' of 3.</span>';
  }
  function call(i){
    if(round.over) return; round.over=true;
    var t=round.thief, b=round.bottles[t], expected=750-round.sold*POUR, lost=Math.round((expected-b.ml)/POUR), money=lost*PRICE;
    round.bottles[t].el.classList.add("thief");
    if(i===t){ caught++; mount.classList.add("win"); read.innerHTML='<span><b>Caught it.</b> Bottle '+(t+1)+' is '+(expected-b.ml)+' ml light: <b>'+lost+' pours</b> the register never saw, <b>$'+money+'</b> out the door.</span>'; }
    else { missed++; round.bottles[i].el.classList.add("wrong"); read.innerHTML='<span><b>Not that one.</b> It was bottle '+(t+1)+': '+lost+' pours, $'+money+' gone. '+(Object.keys(round.weighed).length<3?'Weighing all three is the whole trick.':'The scale knew.')+'</span>'; }
    score.innerHTML='Caught <b>'+caught+'</b> · Missed <b>'+missed+'</b>';
    var next=txt("button","wb-next","Next round"); next.type="button"; next.addEventListener("click",function(){ mount.classList.remove("win"); newRound(); var f=shelf.querySelector(".wb-bottle"); if(f) f.focus(); });
    read.appendChild(next);
  }
  c.reset.addEventListener("click",function(){ caught=0; missed=0; score.innerHTML='Caught <b>0</b> · Missed <b>0</b>'; mount.classList.remove("win"); newRound(); c.untouch(); });
  newRound();
}

/* ======================= 2. The Cold Math (TrustMeBro) ======================= */
/* Five rounds, a 100 unit bankroll, 10 a bet. Pick the better math, then live with the morning. */
function trustmebro(mount){
  var c=card(mount,{title:"The Cold Math",from:"TrustMeBro",instr:"Five rounds. Pick the bet with the better math, then face the morning.",stageClass:"wb-tmb",
    foot:"Example odds, chosen to teach. The engine on the real site does this on every wager."});
  var bank=100, roundN=0, evSum=0, goodPicks=0, busy=false;
  var hud=el("div","wb-hud",'<span>Round <b class="r">1</b> of 5</span><span>Bankroll <b class="k">100</b></span>'); c.stage.appendChild(hud);
  var pair=el("div","wb-pair"); c.stage.appendChild(pair);
  var slip=el("span","wb-slip",'Slip <span class="wb-hunt" data-hunt>13</span>'); c.stage.appendChild(slip);
  function american(d){ return d>=2?"+"+Math.round((d-1)*100):"−"+Math.round(100/(d-1)); }
  function makeBet(){ /* our probability and a book price that is sometimes generous, sometimes greedy */
    var p=.3+Math.random()*.4, fair=1/p, edge=(Math.random()-.45)*.28; var d=Math.max(1.15,+(fair*(1+edge)).toFixed(2)); return {p:p,d:d,ev:p*d-1}; }
  function deal(){
    busy=false; pair.innerHTML=""; var a=makeBet(), b=makeBet(); var guard=0; while(Math.sign(a.ev)===Math.sign(b.ev)&&guard++<20) b=makeBet();
    [a,b].forEach(function(bt,i){
      var btn=el("button","wb-bet",'<span class="wb-bet-n">'+(i?"Bet B":"Bet A")+'</span><span class="wb-bet-l">'+american(bt.d)+'</span><span class="wb-bet-p">Our number: <b>'+Math.round(bt.p*100)+'%</b></span><span class="wb-ev" aria-hidden="true"></span>');
      btn.type="button"; btn.setAttribute("aria-label",(i?"Bet B":"Bet A")+", odds "+american(bt.d).replace("−","minus ")+", our number "+Math.round(bt.p*100)+" percent");
      btn.addEventListener("click",function(){ pick(i,[a,b]); }); pair.appendChild(btn);
    });
    hud.querySelector(".r").textContent=String(roundN+1);
  }
  function pick(i,bets){
    if(busy) return; busy=true;
    var btns=pair.querySelectorAll(".wb-bet");
    bets.forEach(function(b,j){ var t=btns[j].querySelector(".wb-ev"); var plus=b.ev>0; t.textContent=(plus?"+EV +":"−EV ")+(b.ev*100).toFixed(1)+"%"; t.className="wb-ev "+(plus?"plus":"minus"); btns[j].disabled=true; });
    btns[i].classList.add("chosen");
    var ch=bets[i], won=Math.random()<ch.p, delta=won?Math.round(10*(ch.d-1)):-10; bank+=delta; evSum+=ch.ev*10; if(ch.ev>0) goodPicks++;
    hud.querySelector(".k").textContent=String(bank); hud.classList.remove("up","down"); void hud.offsetWidth; hud.classList.add(delta>0?"up":"down");
    var line=ch.ev>0?(won?"Right side, and it paid. Enjoy it, it won't always.":"Right side, and it lost. Still the right side."):(won?"Wrong side, and it paid anyway. That is how bankrolls die.":"Wrong side, and the math collected.");
    c.read.innerHTML='<span>The next morning: <b>'+(won?"won":"lost")+'</b> ('+(delta>0?"+":"−")+Math.abs(delta)+'). '+line+'</span>';
    roundN++;
    var next=txt("button","wb-next",roundN<5?"Next round":"See the verdict"); next.type="button";
    next.addEventListener("click",function(){ if(roundN<5){ deal(); c.read.innerHTML=""; var f=pair.querySelector(".wb-bet"); if(f) f.focus(); } else verdict(); });
    c.read.appendChild(next);
  }
  function verdict(){
    pair.innerHTML='<div class="wb-verdict"><b>'+goodPicks+' of 5</b><span>picks on the right side of the math</span><em>Bankroll '+bank+' · expected '+(100+Math.round(evSum))+'</em></div>';
    c.read.innerHTML='<span>'+(goodPicks>=4?'Cold blooded. The engine would hire you.':goodPicks>=3?'Better than the gut. The scoreboard will argue, the math will not.':'The gut picked. The math disagreed.')+'</span>';
  }
  c.reset.addEventListener("click",function(){ bank=100; roundN=0; evSum=0; goodPicks=0; hud.querySelector(".k").textContent="100"; c.read.innerHTML=""; deal(); c.untouch(); });
  deal();
}

/* ======================= 3. One Roof (Tiger Hospitality) ======================= */
/* A schematic San Diego. The prompt names a neighbourhood; the closer the pin, the more it scores. */
function tiger(mount){
  var c=card(mount,{title:"One Roof",from:"Tiger Hospitality",instr:"Where is it? Tap the map. Closer pins score more.",stageClass:"wb-map"});
  /* positions on a 320 x 220 schematic: coast on the left, bay bottom centre, north is up */
  var P={"La Jolla":[118,34],"Pacific Beach":[112,82],"Point Loma":[96,176],"Mission Valley":[196,110],"Hillcrest":[200,140],"North Park":[240,132],"Little Italy":[168,160],"Gaslamp Quarter":[182,182],"South Park":[236,168],"Bankers Hill":[184,150]};
  var names=Object.keys(P), queue=[], cur=null, total=0, rounds=0, lock=false;
  var svgNS="http://www.w3.org/2000/svg";
  var wrap=el("div","wb-mapwrap");
  wrap.innerHTML='<svg class="wb-svg" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid meet" role="img" aria-label="A schematic map of San Diego: ocean to the west, the bay at the bottom"><path class="wb-sea" d="M0 0h320v220H0z"/><path class="wb-land" d="M104 0c-4 18 0 36 6 52 4 12 0 22-6 30-8 12-8 26 2 36 6 6 6 14 0 22l-14 22c-6 10-8 22-2 30l6 28h224V0z"/><path class="wb-bay" d="M120 220c4-20 16-34 34-40 20-6 38-2 52 8 10 8 12 20 8 32z"/><path class="wb-coast" d="M104 0c-4 18 0 36 6 52 4 12 0 22-6 30-8 12-8 26 2 36 6 6 6 14 0 22l-14 22c-6 10-8 22-2 30l6 28" fill="none"/><path class="wb-river" d="M104 116c30-4 60-8 110-6 30 2 60-2 106-8" fill="none"/><g class="wb-pins"></g></svg>';
  c.stage.appendChild(wrap);
  var svg=wrap.querySelector("svg"), pins=svg.querySelector(".wb-pins");
  var hm=el("span","wb-hunt wb-hunt-map",'Sheet <span data-hunt>13</span>'); wrap.appendChild(hm);
  var hm2=el("span","wb-hunt wb-hunt-map2",'Grid <span data-hunt>13</span>'); wrap.appendChild(hm2);
  var ask=el("div","wb-ask",'Find <b></b>'); c.stage.appendChild(ask);
  var sc=el("div","wb-score",'Score <b>0</b> · Round <b class="rr">1</b> of 5'); c.stage.appendChild(sc);
  /* keyboard play: a movable crosshair, arrows to move, Enter to drop */
  var kx=210,ky=110;
  var cross=document.createElementNS(svgNS,"g"); cross.setAttribute("class","wb-cross"); cross.innerHTML='<circle r="7"/><path d="M-12 0h-4M12 0h4M0-12v-4M0 12v4"/>'; svg.appendChild(cross);
  svg.setAttribute("tabindex","0"); svg.setAttribute("aria-describedby",c.stage.getAttribute("aria-describedby"));
  function crossAt(){ cross.setAttribute("transform","translate("+kx+" "+ky+")"); }
  function shuffle(){ queue=names.slice().sort(function(){ return Math.random()-.5; }).slice(0,5); }
  function next(){ lock=false; pins.innerHTML=""; cur=queue[rounds]; ask.querySelector("b").textContent=cur; sc.querySelector(".rr").textContent=String(rounds+1); c.read.innerHTML='<span>Where is <b>'+cur+'</b>?</span>'; }
  function mk(tag,attrs){ var n=document.createElementNS(svgNS,tag); for(var k in attrs) n.setAttribute(k,attrs[k]); return n; }
  function drop(x,y){
    if(lock||!cur) return; lock=true;
    var t=P[cur], d=Math.hypot(x-t[0],y-t[1]), pts=Math.max(0,Math.round(100-d*1.6)); total+=pts; rounds++;
    var line=mk("line",{x1:x,y1:y,x2:t[0],y2:t[1],"class":"wb-miss"}); pins.appendChild(line);
    var you=mk("g",{"class":"wb-pin you",transform:"translate("+x.toFixed(1)+" "+y.toFixed(1)+")"}); you.appendChild(mk("path",{d:"M0 -22a8 8 0 0 1 8 8c0 6-8 14-8 14s-8-8-8-14a8 8 0 0 1 8-8z"})); pins.appendChild(you);
    var real=mk("g",{"class":"wb-pin real",transform:"translate("+t[0]+" "+t[1]+")"}); real.appendChild(mk("circle",{r:"5"})); var lab=mk("text",{x:"9",y:"4"}); lab.textContent=cur; real.appendChild(lab); pins.appendChild(real);
    sc.querySelector("b").textContent=String(total);
    var verdict=pts>=85?"Local.":pts>=60?"Close enough to walk.":pts>=30?"You'd need a ride.":"That is another neighbourhood.";
    c.read.innerHTML='<span><b>+'+pts+'</b> · '+verdict+'</span>';
    var btn=txt("button","wb-next",rounds<5?"Next place":"Final score"); btn.type="button";
    btn.addEventListener("click",function(){ if(rounds<5){ next(); svg.focus(); } else { ask.innerHTML='<b>'+total+'</b> of 500'; c.read.innerHTML='<span>'+(total>=400?'You could run their locations page.':total>=250?'One roof, and you know most of the rooms.':'Ten neighbourhoods, one roof, and now you have a reason to visit.')+'</span>'; } });
    c.read.appendChild(btn);
  }
  svg.addEventListener("click",function(e){ var r=svg.getBoundingClientRect(), s=Math.min(r.width/320,r.height/220), ox=(r.width-320*s)/2, oy=(r.height-220*s)/2; drop((e.clientX-r.left-ox)/s,(e.clientY-r.top-oy)/s); });
  svg.addEventListener("focus",function(){ cross.classList.add("on"); crossAt(); }); svg.addEventListener("blur",function(){ cross.classList.remove("on"); });
  svg.addEventListener("keydown",function(e){ var st=8; if(e.key==="ArrowLeft") kx-=st; else if(e.key==="ArrowRight") kx+=st; else if(e.key==="ArrowUp") ky-=st; else if(e.key==="ArrowDown") ky+=st; else if(e.key==="Enter"||e.key===" "){ e.preventDefault(); drop(kx,ky); return; } else return; e.preventDefault(); kx=clamp(kx,0,320); ky=clamp(ky,0,220); crossAt(); });
  c.reset.addEventListener("click",function(){ total=0; rounds=0; sc.querySelector("b").textContent="0"; ask.innerHTML='Find <b></b>'; shuffle(); next(); c.untouch(); });
  shuffle(); next();
}

/* ======================= 4. Fire Palette (Carlos Almaraz) ======================= */
/* Mirror painting: every stroke is echoed across the canvas, so anything turns into a composition. */
function carlos(mount){
  var c=card(mount,{title:"Fire Palette",from:"Carlos Almaraz",instr:"Paint anything. The mirror turns it into a composition.",stageClass:"wb-paint",
    foot:"A toy, not his work. Paint at your own risk."});
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

/* ======================= 5. Opening Night (Miramar Food Hall) ======================= */
/* Simon, on a marquee: the sign plays a pattern, you repeat it. Each round is one bulb longer. */
function miramar(mount){
  var c=card(mount,{title:"Opening Night",from:"Miramar Food Hall",instr:"Watch the marquee, then repeat the pattern. Reach 13 to open the doors.",stageClass:"wb-sign"});
  var sign=el("div","wb-marquee",'<div class="wb-board"><span class="wb-board-t">MIRAMAR</span><span class="wb-board-s">Food hall · est. 1938 · reach <span class="wb-hunt" data-hunt>13</span></span></div><div class="wb-bulbs" role="group" aria-label="Marquee bulbs"></div><div class="wb-mctl"><button type="button" class="wb-start">Start the show</button><span class="wb-hunt wb-row13">Row <span data-hunt>13</span></span></div>');
  c.stage.appendChild(sign);
  var row=sign.querySelector(".wb-bulbs"), start=sign.querySelector(".wb-start"), bulbs=[], N=7;
  var seq=[], at=0, playing=false, accepting=false, best=0; try{ best=+(localStorage.getItem("k13-marquee")||0); }catch(e){}
  for(var i=0;i<N;i++){ (function(i){ var b=el("button","wb-bulb"); b.type="button"; b.setAttribute("aria-label","Bulb "+(i+1)); b.style.setProperty("--d",i);
    b.addEventListener("click",function(){ press(i); }); row.appendChild(b); bulbs.push(b); })(i); }
  function flash(i,ms){ var b=bulbs[i]; b.classList.add("on"); setTimeout(function(){ b.classList.remove("on"); },ms||380); }
  function status(t){ c.read.innerHTML='<span>'+t+'</span>'; }
  function play(){
    playing=true; accepting=false; at=0; sign.classList.add("showing"); status('Round <b>'+seq.length+'</b>. Watch the sign.');
    var gap=reduced?900:Math.max(360,620-seq.length*20), k=0;
    (function step(){ if(k>=seq.length){ playing=false; accepting=true; sign.classList.remove("showing"); status('Round <b>'+seq.length+'</b>. Your turn: '+seq.length+' bulb'+(seq.length>1?'s':'')+'.'); if(bulbs[0]) bulbs[seq[0]]&&null; return; }
      flash(seq[k],gap*0.6); k++; setTimeout(step,gap); })();
  }
  function grow(){ seq.push(Math.floor(Math.random()*N)); setTimeout(play,reduced?200:500); }
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
      status('<b>'+seq.length+'</b> right.'); setTimeout(grow,450); }
  }
  start.addEventListener("click",function(){ seq=[]; start.hidden=true; sign.classList.remove("lit"); grow(); var b=bulbs[0]; if(b) setTimeout(function(){ b.focus({preventScroll:true}); },50); });
  c.reset.addEventListener("click",function(){ seq=[]; at=0; playing=false; accepting=false; start.textContent="Start the show"; start.hidden=false; sign.classList.remove("lit","chase","showing"); status(best?'Best so far: <b>'+best+'</b>.':''); c.untouch(); });
  status(best?'Best so far: <b>'+best+'</b>.':'');
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
