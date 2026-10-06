/* K13 Fast Track 13: a pseudo-3D road racer on the workbench. Three laps, eight rivals, one orange car with a 13 on it.
   The road is a list of segments projected to the screen every frame (the OutRun way): curves bend the whole road,
   hills hide what is behind the crest, roadside signs are solid, rivals drive their own lines and dodge each other and you.
   The loop is a fixed 60 Hz step behind an accumulator, draws to a devicePixelRatio-crisp canvas (cap 2), pauses while the
   card is off screen, the tab is hidden or the board loses focus, and stops when nothing moves.
   Light theme is a day track, dark theme is the same track at dusk.
   prefers-reduced-motion: no camera tilt, no shake, no speed lines, no dust, no bounce. Still fully playable.
   Keyboard (canvas focused): Up or W gas, Down or S brake, Left/Right or A/D steer, Esc pauses, R restarts.
   Every control also exists as a real labelled button (touch: hold, multi-touch works).
   The track, the cars and the race rules sit between the CORE markers and touch no DOM. */
(function(){
"use strict";

/* ===================================================== CORE-BEGIN ===================================================== */
var SEGL=200, ROADW=2000, CAMH=1000, CAMD=1/Math.tan(50*Math.PI/180), DRAW=240, LANES=3, FOGD=4.5;
var STEP=1/60, MAXS=SEGL/STEP, ACCEL=MAXS/5.5, BRAKE=-MAXS, DECEL=-MAXS/5, OFFDEC=-MAXS/2, OFFLIM=MAXS/4, CENTR=.25;
var PZ=CAMH*CAMD*1.5;                 /* the car sits this far in front of the camera */
var LAPS=3, RIVALS=8, PW=.16, CW=.16;  /* half widths in road units (the road edge is at 1) */
var START_SEG=20, KMH=260;
var BILLS=["LobsterLab","Miramar","Egg & Out","Station 8","BarFix","Cosmos","K13","It works"];
var TAU=Math.PI*2;

function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function wrap(v,m){ v%=m; return v<0?v+m:v; }
function lerp(a,b,p){ return a+(b-a)*p; }
function easeIn(a,b,p){ return a+(b-a)*p*p; }
function easeInOut(a,b,p){ return a+(b-a)*(-Math.cos(p*Math.PI)/2+.5); }
function ovl(a,aw,b,bw,k){ return Math.abs(a-b)<(aw+bw)*k; }

var TRACK=null;
function buildTrack(){
  if(TRACK) return TRACK;
  var segs=[], seed=13;
  function rnd(){ seed=(seed*16807)%2147483647; return (seed-1)/2147483646; }
  function lastY(){ return segs.length?segs[segs.length-1].p2.world.y:0; }
  function addSeg(curve,y){
    var n=segs.length;
    segs.push({index:n,curve:curve,alt:Math.floor(n/3)%2,line:0,sprites:[],cars:[],fog:1,clip:0,
      p1:{world:{y:lastY(),z:n*SEGL},camera:{x:0,y:0,z:0},screen:{x:0,y:0,w:0,scale:0}},
      p2:{world:{y:y,z:(n+1)*SEGL},camera:{x:0,y:0,z:0},screen:{x:0,y:0,w:0,scale:0}}});
  }
  function addRoad(enter,hold,leave,curve,h){
    var sy=lastY(), ey=sy+h*SEGL, tot=enter+hold+leave, i;
    for(i=0;i<enter;i++) addSeg(easeIn(0,curve,i/enter),easeInOut(sy,ey,i/tot));
    for(i=0;i<hold;i++) addSeg(curve,easeInOut(sy,ey,(enter+i)/tot));
    for(i=0;i<leave;i++) addSeg(easeInOut(curve,0,i/leave),easeInOut(sy,ey,(enter+hold+i)/tot));
  }
  /* the lap: heights net to zero so the loop closes */
  addRoad(25,25,25,0,0);
  addRoad(25,40,25,2,0);
  addRoad(20,30,20,0,30);
  addRoad(25,50,25,-3,-20);
  addRoad(15,25,15,0,0);
  addRoad(20,30,20,4,40);
  addRoad(20,30,20,-4,-40);
  addRoad(25,40,25,0,20);
  addRoad(30,60,30,-2,-30);
  addRoad(15,20,15,0,0);
  addRoad(25,50,25,4,0);
  addRoad(20,40,20,0,25);
  addRoad(25,40,25,-4,-25);
  addRoad(25,30,25,3,0);
  addRoad(20,30,20,-3,0);
  addRoad(20,20,20,0,10);
  addRoad(20,20,20,0,-10);
  addRoad(30,40,30,0,0);
  var N=segs.length, L=N*SEGL, i, k;
  /* start/finish line and the two checkpoints, one third of a lap apart */
  var gates=[{seg:START_SEG,label:"START",line:true}];
  for(k=1;k<3;k++) gates.push({seg:Math.floor((START_SEG*SEGL+k*L/3)/SEGL)%N,label:"CHECKPOINT "+k,line:false});
  gates.forEach(function(gt){ segs[gt.seg].sprites.push({k:"gate",o:0,t:gt.label,post:[],cw:0});
    if(gt.line){ segs[gt.seg].line=1; segs[(gt.seg+1)%N].line=2; } });
  /* roadside: lamps, palms, K13 billboards (deterministic, so the lap is always the same lap) */
  var bk=0;
  for(i=8;i<N;i++){
    var s=segs[i], side;
    if(Math.abs(i-START_SEG)<5) continue;
    if(i%14===0){ side=(i/14)%2?1:-1; s.sprites.push({k:"lamp",o:side*1.2,post:[side*1.2],cw:.07}); }
    if(i%3===0&&rnd()<.6){ side=rnd()<.5?-1:1; var po=side*(1.45+rnd()*2.3); s.sprites.push({k:"palm",o:po,post:[po],cw:.1}); }
    if(i%3===1&&rnd()<.25){ side=rnd()<.5?-1:1; var po2=side*(3.2+rnd()*2.4); s.sprites.push({k:"palm",o:po2,post:[po2],cw:.1}); }
    if(i>=40&&(i-40)%105===0){
      side=bk%2?1:-1; var bo=side*1.75;
      s.sprites.push({k:"bill",o:bo,t:BILLS[bk%BILLS.length],c:bk%4,post:[bo-side*.34,bo+side*.34],cw:.07}); bk++;
    }
  }
  TRACK={segs:segs,N:N,len:L,startZ:START_SEG*SEGL};
  return TRACK;
}
function findSeg(z){ var T=TRACK; return T.segs[Math.floor(wrap(z,T.len)/SEGL)%T.N]; }

/* one race. phase: count (3,2,1) -> race -> finish. Events for the drawing layer are queued in g.ev. */
function newRace(best){
  var T=buildTrack(), i;
  for(i=0;i<T.N;i++) T.segs[i].cars.length=0;
  var offs=[-.5,.45,-.1,.55,-.45,.1,.5,-.3], order=[0,1,2,3,4,5,6,7], j, t;
  for(i=7;i>0;i--){ j=Math.floor(Math.random()*(i+1)); t=order[i]; order[i]=order[j]; order[j]=t; }
  var g={phase:"count",cd:3.99,goT:0,finT:0,ev:[],pos:T.startZ-PZ,dist:0,speed:0,x:0,steer:0,t:0,lapT:0,lap:1,sector:0,
    laps:[],bumps:0,bumpCd:0,off:false,kick:0,sky:0,hill:0,tree:0,segIdx:START_SEG,rank:RIVALS+1,bestLap:best&&best.lap||0,newLap:false,
    cars:[],braking:false,lastBump:-9};
  for(i=0;i<RIVALS;i++){
    var spd=MAXS*(.52+.045*order[i]+(Math.random()-.5)*.02), z=T.startZ+700+i*640;
    var c={z:z,dist:z-T.startZ,o:offs[i],spd:spd,cur:0,col:i%7,seg:Math.floor(z/SEGL)%T.N,pct:0};
    g.cars.push(c); T.segs[c.seg].cars.push(c);
  }
  return g;
}
function playerSeg(g){ return Math.floor(wrap(g.pos+PZ,TRACK.len)/SEGL)%TRACK.N; }
function carDir(g,car){
  var T=TRACK, i, s, o, d;
  for(i=1;i<20;i++){
    s=T.segs[(car.seg+i)%T.N];
    for(o=0;o<s.cars.length;o++){ var oc=s.cars[o];
      if(oc!==car&&car.cur>oc.cur&&ovl(car.o,CW,oc.o,CW,1.25)){ d=oc.o>.5?-1:oc.o<-.5?1:oc.o>car.o?-1:1; return d*(1/i)*(car.cur-oc.cur)/MAXS*.6; } }
    if(s.index===g.segIdx&&car.cur>g.speed&&ovl(car.o,CW,g.x,PW,1.25)){ d=g.x>.5?-1:g.x<-.5?1:g.x>car.o?-1:1; return d*(1/i)*(car.cur-g.speed)/MAXS*.6; }
  }
  return car.o<-.9?.03:car.o>.9?-.03:0;
}
function stepCars(g,dt){
  var T=TRACK, i, c;
  for(i=0;i<g.cars.length;i++){
    c=g.cars[i];
    c.cur=Math.min(c.spd,c.cur+MAXS*.22*dt);
    /* never drive through the car in front */
    var ahead=T.segs[(c.seg+1)%T.N], o;
    for(o=0;o<ahead.cars.length;o++){ var oc=ahead.cars[o]; if(oc!==c&&ovl(c.o,CW,oc.o,CW,.95)&&oc.z-c.z<SEGL*1.1&&oc.z-c.z>-1) c.cur=Math.min(c.cur,oc.cur*.98); }
    var gap=wrap(g.pos+PZ-c.z+T.len/2,T.len)-T.len/2;
    if(gap>0&&gap<SEGL*1.3&&ovl(c.o,CW,g.x,PW,.95)&&c.cur>g.speed) c.cur=Math.max(g.speed*.98,0);
    c.o=clamp(c.o+carDir(g,c),-.95,.95);
    var nz=wrap(c.z+c.cur*dt,T.len);
    c.dist+=c.cur*dt; c.z=nz; c.pct=(nz%SEGL)/SEGL;
    var ns=Math.floor(nz/SEGL)%T.N;
    if(ns!==c.seg){ var arr=T.segs[c.seg].cars, ix=arr.indexOf(c); if(ix>=0) arr.splice(ix,1); T.segs[ns].cars.push(c); c.seg=ns; }
  }
}
/* inp: {steer:-1..1, gas:bool, brake:bool} */
function stepRace(g,dt,inp){
  var T=TRACK, L=T.len;
  if(g.phase==="count"){ g.cd-=dt; if(g.cd<=0){ g.phase="race"; g.goT=.9; g.ev.push({t:"go"}); } return; }
  if(g.goT>0) g.goT-=dt;
  var fin=g.phase==="finish", i;
  if(fin){ g.finT+=dt; inp={steer:0,gas:false,brake:true}; }
  var segIdx0=g.segIdx, seg=T.segs[segIdx0], sp=g.speed/MAXS;
  g.steer+=(inp.steer-g.steer)*Math.min(1,dt*9);
  var dx=dt*2.2*sp;
  g.x+=dx*g.steer;
  g.x-=dx*sp*seg.curve*CENTR;
  g.braking=!!inp.brake&&g.speed>0;
  if(inp.gas) g.speed+=ACCEL*(1-.35*sp*sp)*dt;
  else if(inp.brake) g.speed+=(fin?BRAKE*.5:BRAKE)*dt;
  else g.speed+=DECEL*dt;
  var wasOff=g.off; g.off=(g.x<-1||g.x>1);
  if(g.off&&g.speed>OFFLIM) g.speed+=OFFDEC*dt;
  if(g.off&&!wasOff&&g.speed>OFFLIM) g.ev.push({t:"grass"});
  g.speed=clamp(g.speed,0,MAXS);
  var mv=g.speed*dt, oldPz=g.pos+PZ;
  g.pos=wrap(g.pos+mv,L); g.dist+=mv;
  g.bumpCd=Math.max(0,g.bumpCd-dt); g.kick*=Math.max(0,1-dt*5);
  var idx=playerSeg(g), hit=false, a, b, steps=0;
  /* solid roadside things, checked for every segment passed this step */
  for(a=(segIdx0+1)%T.N; idx!==segIdx0&&steps<4&&!hit; steps++){
    var sg=T.segs[a];
    for(b=0;b<sg.sprites.length&&!hit;b++){
      var sprt=sg.sprites[b], q;
      for(q=0;q<sprt.post.length;q++) if(Math.abs(g.x-sprt.post[q])<PW+sprt.cw){
        var sgn=sprt.post[q]>0?1:-1;
        g.x=sprt.post[q]-sgn*(PW+sprt.cw+.06); g.speed=Math.min(g.speed,MAXS*.12); hit=true;
        if(g.bumpCd<=0){ g.bumps++; g.bumpCd=.8; g.kick=-sgn; g.ev.push({t:"bump",what:sprt.k}); }
        break;
      }
    }
    if(a===idx) break; a=(a+1)%T.N;
  }
  g.segIdx=idx;
  /* rivals ahead of you: touching one costs you the speed difference and pushes you aside */
  var pz=wrap(g.pos+PZ,L), n, c, sIx;
  for(n=-1;n<=1;n++){
    sIx=(idx+n+T.N)%T.N;
    for(i=0;i<T.segs[sIx].cars.length;i++){
      c=T.segs[sIx].cars[i];
      var gap=wrap(c.z-pz+L/2,L)-L/2;
      if(gap>-SEGL*.6&&gap<SEGL*.9&&ovl(g.x,PW,c.o,CW,.92)&&g.speed>c.cur*.9){
        var d=(c.z-SEGL*.95)-pz; if(d>0) d=0;
        g.pos=wrap(g.pos+d,L); g.dist+=d;
        g.speed=c.cur*.85; var side=g.x<c.o?-1:1; g.x+=side*.1; g.kick=side;
        if(g.bumpCd<=0){ g.bumps++; g.bumpCd=.8; g.ev.push({t:"bump",what:"car"}); }
      }
    }
  }
  g.x=clamp(g.x,-2.4,2.4);
  /* parallax offsets: the sky and hills slide against the bend */
  var cv=T.segs[idx].curve, adv=g.speed*dt/SEGL;
  g.sky=wrap(g.sky+.0007*cv*adv,1); g.hill=wrap(g.hill+.0014*cv*adv,1); g.tree=wrap(g.tree+.0021*cv*adv,1);
  /* time, sectors, laps */
  if(!fin){
    g.t+=dt; g.lapT+=dt;
    var sec=Math.floor(g.dist/(L/3));
    if(sec>g.sector){
      g.sector=sec;
      if(sec%3===0){
        var lapNo=sec/3, lt=g.lapT, nb=!g.bestLap||lt<g.bestLap;
        g.laps.push(lt); if(nb) g.bestLap=lt; g.lapT=0;
        if(lapNo>=LAPS){ g.phase="finish"; g.finT=0; g.rank=rankOf(g); g.ev.push({t:"finish",time:g.t,rank:g.rank,newLap:nb,lap:lt}); }
        else{ g.lap=lapNo+1; g.ev.push({t:"lap",n:lapNo,time:lt,best:nb}); }
      } else g.ev.push({t:"cp",n:sec%3,time:g.lapT});
    }
  }
  stepCars(g,dt);
  if(!fin) g.rank=rankOf(g);
}
function rankOf(g){ var r=1, i; for(i=0;i<g.cars.length;i++) if(g.cars[i].dist>g.dist) r++; return r; }
/* ====================================================== CORE-END ====================================================== */

/* ============================================================ the card, the canvas, the controls ============================================================ */
var mount=document.querySelector('[data-game="race13"]');
if(!mount) return;
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
function fmt(s){ if(!(s>0)) return "0:00.0"; var m=Math.floor(s/60), r=s-m*60; return m+":"+(r<10?"0":"")+r.toFixed(1); }
var ORD=["","first","second","third","fourth","fifth","sixth","seventh","eighth","ninth"];

mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Fast Track 13")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Three laps, eight rivals, one orange car. Pass them, stay off the grass, beat your best lap."); instr.id="r13-i"; mount.appendChild(instr);
var stage=el("div","wb-stage r13-stage"); stage.setAttribute("aria-describedby","r13-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Restart the race"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Up or W gas, Down or S brake, Left and Right or A and D steer, Esc pauses, R restarts. Click the road first. Best times stay on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

/* HUD chips sit in a row above the road, never on it */
var hud=el("div","r13-hud"); stage.appendChild(hud);
function chip(cls){ var c=el("span","r13-chip "+(cls||"")); hud.appendChild(c); return c; }
var hLap=chip(), hPos=chip(), hTime=chip(), hBest=chip();
var hSpeed=chip("r13-speed"), sNum=txt("b","","0"), sUnit=txt("span","r13-unit"," km/h"), sMeter=el("i","r13-meter"), sFill=el("u","");
sMeter.appendChild(sFill); hSpeed.appendChild(sNum); hSpeed.appendChild(sUnit); hSpeed.appendChild(sMeter);
hSpeed.setAttribute("aria-label","Speed");

var view=el("div","r13-view"); stage.appendChild(view);
var cv=el("canvas","r13-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Fast Track 13 road. Click it, then Up or W is gas, Down or S is brake, Left and Right steer.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var over=el("div","r13-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Race status"); view.appendChild(over);

var bar=el("div","r13-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Fast Track 13 controls"); stage.appendChild(bar);
function hold(label,aria,cls,key){
  var b=txt("button","r13-btn "+cls,label); b.type="button"; b.setAttribute("aria-label",aria); b.setAttribute("data-r13",key); return b;
}
var bL=hold("Left","Steer left, hold","r13-steer","left"), bR=hold("Right","Steer right, hold","r13-steer","right");
var bBrake=hold("Brake","Brake, hold","r13-brake","brake"), bGas=hold("Gas","Gas, hold","r13-gas","gas");
var bPause=txt("button","r13-btn r13-pause","Pause"); bPause.type="button"; bPause.setAttribute("aria-label","Pause the race");
var gSteer=el("div","r13-grp"), gDrive=el("div","r13-grp");
gSteer.appendChild(bL); gSteer.appendChild(bR); gDrive.appendChild(bBrake); gDrive.appendChild(bGas);
bar.appendChild(gSteer); bar.appendChild(bPause); bar.appendChild(gDrive);

/* ---------- input: keyboard on the focused canvas, touch and mouse on the buttons, all of it merged ---------- */
var keys={left:false,right:false,gas:false,brake:false}, tch={left:false,right:false,gas:false,brake:false};
function inputNow(){
  var s=(keys.right||tch.right?1:0)-(keys.left||tch.left?1:0);
  return {steer:s,gas:keys.gas||tch.gas,brake:keys.brake||tch.brake};
}
function clearInput(){ var k; for(k in keys) keys[k]=false; for(k in tch){ tch[k]=false; } [bL,bR,bBrake,bGas].forEach(function(b){ b.classList.remove("is-down"); }); }
var KEYMAP={ArrowUp:"gas",w:"gas",W:"gas",ArrowDown:"brake",s:"brake",S:"brake",ArrowLeft:"left",a:"left",A:"left",ArrowRight:"right",d:"right",D:"right"};
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var m=KEYMAP[e.key];
  if(m){ e.preventDefault(); keys[m]=true; if(state==="ready") start(); return; }
  if(e.key==="r"||e.key==="R"){ e.preventDefault(); start(); }
  else if((e.key===" "||e.key==="Enter")&&(state==="ready"||state==="over")){ e.preventDefault(); start(); }
  else if((e.key===" "||e.key==="Enter")&&state==="pause"){ e.preventDefault(); togglePause(); }
});
mount.addEventListener("keydown",function(e){ if(e.key==="Escape"&&(state==="play"||state==="pause")){ e.preventDefault(); togglePause(); } });
cv.addEventListener("keyup",function(e){ var m=KEYMAP[e.key]; if(m){ e.preventDefault(); keys[m]=false; } });
[bL,bR,bBrake,bGas].forEach(function(b){
  var key=b.getAttribute("data-r13");
  function down(e){ if(e.type==="keydown"&&(e.key!==" "&&e.key!=="Enter")) return; if(e.type==="keydown"&&e.repeat) return; if(e.cancelable) e.preventDefault();
    if(state==="ready"||state==="over") start(); if(state!=="play") return; tch[key]=true; b.classList.add("is-down");
    if(e.pointerId!=null&&b.setPointerCapture){ try{ b.setPointerCapture(e.pointerId); }catch(x){} } }
  function up(){ tch[key]=false; b.classList.remove("is-down"); }
  b.addEventListener("pointerdown",down); b.addEventListener("keydown",down);
  b.addEventListener("pointerup",up); b.addEventListener("pointercancel",up); b.addEventListener("lostpointercapture",up);
  b.addEventListener("keyup",up); b.addEventListener("blur",up);
  b.addEventListener("contextmenu",function(e){ e.preventDefault(); });
});

/* ---------- state ---------- */
var g=null, state="ready", vis=false, W=0, H=0, dprv=1, raf=0, on=false, acc=0, last=0, pal=null, pr=null;
var best=(function(){ var o={lap:0,race:0}; try{ var l=parseFloat(store("k13_race13_lap")||""), r=parseFloat(store("k13_race13_race")||""); if(l>0) o.lap=l; if(r>0) o.race=r; }catch(e){} return o; })();
var tilt=0, shake=0, parts=[], lastRank=0, lastSay=0, nowT=0, sig="";
function prepare(){ g=newRace({lap:best.lap}); lastRank=g.rank; parts.length=0; tilt=0; shake=0; }
prepare();

function showOver(kind){
  over.innerHTML=""; over.hidden=false;
  var panel=el("div","r13-panel"), h=txt("h4","r13-over-t",""), sub=txt("p","r13-over-s",""), row=el("div","r13-over-row"), primary;
  function ob(label,aria,fn,ghost){ var b=txt("button","r13-obtn"+(ghost?" ghost":""),label); b.type="button"; if(aria) b.setAttribute("aria-label",aria); b.addEventListener("click",fn); row.appendChild(b); return b; }
  if(kind==="ready"){
    h.textContent="Fast Track 13"; sub.textContent="Three laps round the K13 coast. Eight cars are ahead of you. The grass is slow and the signs are solid.";
    panel.appendChild(h); panel.appendChild(sub);
    primary=ob("Start race","Start the race",start);
  } else if(kind==="pause"){
    h.textContent="Paused"; sub.textContent="Nothing moves until you say so.";
    panel.appendChild(h); panel.appendChild(sub);
    primary=ob("Resume","Resume the race",togglePause); ob("Restart","Restart the race",start,true);
  } else {
    var rk=g.rank, line=rk===1?"First place. The other eight cars have notes.":rk<=3?"On the podium. One more pass and it is gold.":"Finished "+ORD[rk]+" of "+(RIVALS+1)+". The grass slows everyone down.";
    h.textContent=rk===1?"First of nine":(ORD[rk].charAt(0).toUpperCase()+ORD[rk].slice(1)+" of nine"); sub.textContent=line;
    panel.appendChild(h); panel.appendChild(sub);
    var st=el("div","r13-stats");
    [["Time",fmt(g.t)],["Best lap",fmt(best.lap)],["Bumps",String(g.bumps)]].forEach(function(p){ var c=el("div","r13-stat"); c.appendChild(txt("span","r13-stat-k",p[0])); c.appendChild(txt("span","r13-stat-v",p[1])); st.appendChild(c); });
    panel.appendChild(st);
    var rec=[]; if(g.newRace) rec.push("new best time"); if(g.newLapRec) rec.push("new best lap");
    if(rec.length) panel.appendChild(txt("p","r13-rec","Record: "+rec.join(" and ")+"."));
    else if(best.race) panel.appendChild(txt("p","r13-rec","Best time is "+fmt(best.race)+"."));
    primary=ob("Race again","Start another race",start);
  }
  panel.appendChild(row); over.appendChild(panel);
  window.setTimeout(function(){ if(!over.hidden&&primary&&document.activeElement!==primary&&(kind!=="ready"||mount.contains(document.activeElement))) primary.focus({preventScroll:true}); },0);
}
function hideOver(){ over.hidden=true; over.innerHTML=""; }

function start(){
  clearInput(); prepare(); state="play"; hideOver(); sig="";
  say("Three. Two. One."); bPause.textContent="Pause"; bPause.setAttribute("aria-label","Pause the race");
  cv.focus({preventScroll:true}); wake();
}
function togglePause(){
  if(state==="play"){ state="pause"; clearInput(); stopLoop(); bPause.textContent="Resume"; bPause.setAttribute("aria-label","Resume the race"); showOver("pause"); draw(); say("Paused."); }
  else if(state==="pause"){ state="play"; hideOver(); bPause.textContent="Pause"; bPause.setAttribute("aria-label","Pause the race"); cv.focus({preventScroll:true}); wake(); say("Back on the road."); }
}
reset.addEventListener("click",start);
bPause.addEventListener("click",function(){ if(state==="ready"||state==="over") start(); else togglePause(); });
cv.addEventListener("pointerdown",function(){ cv.focus({preventScroll:true}); });
/* losing focus mid-race pauses it, unless focus only moved to another control of this card */
var lastInside=0;
mount.addEventListener("pointerdown",function(){ lastInside=performance.now(); },true);
mount.addEventListener("focusout",function(e){ if(state!=="play"||performance.now()-lastInside<600) return; var to=e.relatedTarget; if(to&&mount.contains(to)) return; if(!to&&document.activeElement&&mount.contains(document.activeElement)) return; togglePause(); });
window.addEventListener("blur",function(){ if(state==="play") togglePause(); });

function drain(){
  var ev=g.ev, i, e; g.ev=[];
  for(i=0;i<ev.length;i++){
    e=ev[i];
    if(e.t==="go") say("Go.");
    else if(e.t==="cp") say("Checkpoint "+e.n+" of 2: "+fmt(e.time)+" into the lap.");
    else if(e.t==="lap"){ say("Lap "+e.n+" done in "+fmt(e.time)+(e.best?". Best lap so far.":".")+" "+(LAPS-e.n===1?"One lap left.":(LAPS-e.n)+" laps left.")); if(e.best){ best.lap=e.time; store("k13_race13_lap",String(e.time)); g.newLapRec=true; } }
    else if(e.t==="bump"){ shake=1; if(nowT-lastSay>2500){ say(e.what==="car"?"Contact. You lost speed.":"Solid sign. You lost speed."); lastSay=nowT; } }
    else if(e.t==="grass"){ if(nowT-lastSay>2500){ say("Grass. Slow."); lastSay=nowT; } }
    else if(e.t==="finish"){
      if(e.newLap){ best.lap=e.lap; g.newLapRec=true; store("k13_race13_lap",String(e.lap)); }
      if(!best.race||e.time<best.race){ g.newRace=true; best.race=e.time; store("k13_race13_race",String(e.time)); }
      say("Finished "+ORD[e.rank]+" of "+(RIVALS+1)+" in "+fmt(e.time)+".");
    }
  }
  if(g.rank!==lastRank&&g.phase==="race"){ if(g.rank<lastRank&&nowT-lastSay>1500){ say("Position "+g.rank+" of "+(RIVALS+1)+"."); lastSay=nowT; } lastRank=g.rank; }
}
function hudUpdate(){
  var kmh=Math.round(g.speed/MAXS*KMH), lapN=Math.min(g.lap,LAPS);
  var s=lapN+"|"+g.rank+"|"+g.lapT.toFixed(1)+"|"+best.lap.toFixed(1)+"|"+kmh;
  if(s===sig) return; sig=s;
  hLap.textContent="Lap "+lapN+"/"+LAPS; hPos.textContent="Pos "+g.rank+"/"+(RIVALS+1);
  hTime.textContent="Time "+fmt(g.lapT); hBest.textContent="Best "+(best.lap?fmt(best.lap):"none");
  sNum.textContent=String(kmh); sFill.style.width=Math.round(g.speed/MAXS*100)+"%";
  hSpeed.setAttribute("aria-label","Speed "+kmh+" kilometres an hour");
}

/* ---------- loop ---------- */
function busy(){ return state==="play"; }
function frame(t){
  raf=0; if(!vis||document.hidden||!busy()){ on=false; return; }
  nowT=t;
  var dt=Math.min(.05,(t-last)/1000); last=t; acc+=dt; var n=0, inp=inputNow();
  while(acc>=STEP&&n<5){ stepRace(g,STEP,inp); acc-=STEP; n++; } if(n===5) acc=0;
  drain();
  if(g.phase==="finish"&&g.finT>1.6&&state==="play"){ state="over"; clearInput(); showOver("over"); }
  fx(dt); hudUpdate(); draw();
  if(!busy()){ on=false; return; }
  raf=window.requestAnimationFrame(frame);
}
function wake(){ if(on||!vis||document.hidden||!busy()){ if(vis&&W) draw(); return; } if(!W&&!fit()) return; on=true; acc=0; last=performance.now(); raf=window.requestAnimationFrame(frame); }
function stopLoop(){ if(raf){ window.cancelAnimationFrame(raf); raf=0; } on=false; }
if(window.IntersectionObserver) new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else{ stopLoop(); if(state==="play") togglePause(); } },{threshold:0}).observe(stage); else vis=true;
document.addEventListener("visibilitychange",function(){ if(document.hidden){ stopLoop(); if(state==="play") togglePause(); } else wake(); });
if(window.ResizeObserver) new ResizeObserver(function(){ if(fit()) wake(); }).observe(view); else window.addEventListener("resize",function(){ if(fit()) wake(); });
new MutationObserver(function(){ pal=null; pr=null; if(vis) draw(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
if(mq.addEventListener) mq.addEventListener("change",function(){ if(vis) draw(); });
function fit(){
  var w=view.clientWidth, h=view.clientHeight; if(!w||!h) return false;
  dprv=Math.min(window.devicePixelRatio||1,2);
  var pw=Math.round(w*dprv), ph=Math.round(h*dprv);
  if(cv.width!==pw||cv.height!==ph){ cv.width=pw; cv.height=ph; }
  W=w; H=h; pr=null; draw(); return true;
}
/* tilt, shake and dust: all of it off under reduced motion */
function fx(dt){
  if(calm()){ tilt=0; shake=0; parts.length=0; return; }
  var cv0=TRACK.segs[g.segIdx].curve, sp=g.speed/MAXS;
  tilt+=((-cv0*sp*.0045)-tilt)*Math.min(1,dt*3.5);
  shake=Math.max(0,shake-dt*3.2);
  var i, p;
  if(g.off&&g.speed>OFFLIM*.5&&parts.length<28){
    for(i=0;i<2;i++) parts.push({x:W/2+(Math.random()-.5)*W*.16,y:H*.86,vx:(Math.random()-.5)*160,vy:-60-Math.random()*120,l:.5+Math.random()*.3,s:2+Math.random()*3});
  }
  for(i=parts.length-1;i>=0;i--){ p=parts[i]; p.l-=dt; if(p.l<=0){ parts.splice(i,1); continue; } p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=380*dt; }
}

/* ---------- drawing ---------- */
function hex(h){ var s=h.replace("#",""); if(s.length===3) s=s[0]+s[0]+s[1]+s[1]+s[2]+s[2]; return [parseInt(s.substr(0,2),16),parseInt(s.substr(2,2),16),parseInt(s.substr(4,2),16)]; }
function mix(a,b,f){ return "rgb("+Math.round(b[0]+(a[0]-b[0])*f)+","+Math.round(b[1]+(a[1]-b[1])*f)+","+Math.round(b[2]+(a[2]-b[2])*f)+")"; }
function shade(h,f){ var c=hex(h); return "rgb("+Math.round(c[0]*f)+","+Math.round(c[1]*f)+","+Math.round(c[2]*f)+")"; }
function palette(){
  var cs=getComputedStyle(document.documentElement);
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return /^#[0-9a-f]{3,6}$/i.test(s)?s:d; }
  var dark=document.documentElement.getAttribute("data-theme")==="dark";
  var or=v("--blue-2","#EA5E14");
  var P=dark?{
    skyA:"#1F2023",skyB:"#3C2A20",skyC:"#C8601C",far:"#2B2624",near:"#1B1B1D",sun:"#F0B429",
    gA:"#1E3A33",gB:"#1A332D",rA:"#3A3C41",rB:"#34363A",rumA:"#E9E7E2",rumB:or,lane:"#C9C5BA",fog:"#6B3A22",
    trunk:"#4A3626",leaf:"#1F5B45",pole:"#6C6E74",line:"rgba(255,224,170,",lampGlow:true
  }:{
    skyA:"#6FAFD6",skyB:"#B9DCEB",skyC:"#EEF3EA",far:"#9DC2B8",near:"#7BB19A",sun:"#F0B429",
    gA:"#86B77C",gB:"#7BAE72",rA:"#6C6E73",rB:"#65676C",rumA:"#FFFFFF",rumB:or,lane:"#F4F1EA",fog:"#DCEBE5",
    trunk:"#7A5A3A",leaf:"#3E8E5A",pole:"#5D5F65",line:"rgba(255,255,255,",lampGlow:false
  };
  P.dark=dark; P.or=or;
  ["gA","gB","rA","rB","rumA","rumB","lane","fog"].forEach(function(k){ P[k+"x"]=hex(P[k]); });
  P.cars=["#4F9E92","#F0B429","#F2EDE2","#3C6E9E","#C0392B","#E3E1DA","#2A7F8F"];
  return P;
}
function proj(p,cx,cy,cz){
  var sc=p.screen;
  p.camera.x=-cx; p.camera.y=p.world.y-cy; p.camera.z=p.world.z-cz;
  sc.scale=CAMD/p.camera.z;
  sc.x=Math.round(W/2+sc.scale*p.camera.x*W/2); sc.y=Math.round(H/2-sc.scale*p.camera.y*H/2); sc.w=Math.round(sc.scale*ROADW*W/2);
}
function poly(x1,y1,x2,y2,x3,y3,x4,y4,c){ ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.lineTo(x4,y4); ctx.closePath(); ctx.fill(); }
function rr(x,y,w,h,r){ r=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); }

function drawSky(P,hy){
  if(!pr){ var gr=ctx.createLinearGradient(0,0,0,hy); gr.addColorStop(0,P.skyA); gr.addColorStop(.6,P.skyB); gr.addColorStop(1,P.skyC); pr=gr; }
  ctx.fillStyle=pr; ctx.fillRect(0,0,W,hy+2);
  var i, u;
  if(P.dark){
    ctx.fillStyle="rgba(243,245,250,.7)";
    for(i=0;i<46;i++){ u=((i*0.6180339+g.sky*.4)%1); var y=((i*0.4142+.05)%1)*hy*.62; ctx.fillRect(Math.round(u*W),Math.round(y),i%5===0?2:1,i%5===0?2:1); }
    ctx.fillStyle="rgba(240,180,41,.22)"; ctx.beginPath(); ctx.arc(W*.3,hy-H*.01,H*.13,0,TAU); ctx.fill();
    ctx.fillStyle=P.sun; ctx.beginPath(); ctx.arc(W*.3,hy-H*.01,H*.075,0,TAU); ctx.fill();
  } else {
    ctx.fillStyle="rgba(240,180,41,.25)"; ctx.beginPath(); ctx.arc(W*.76,H*.17,H*.1,0,TAU); ctx.fill();
    ctx.fillStyle=P.sun; ctx.beginPath(); ctx.arc(W*.76,H*.17,H*.058,0,TAU); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.85)";
    for(i=0;i<5;i++){ u=(((i*.211+.05)+g.sky*1)%1); var cx=u*(W+260)-130, cy=H*(.1+.07*((i*.37)%1)*2), cw=H*(.16+.05*(i%3));
      ctx.beginPath(); ctx.ellipse(cx,cy,cw,cw*.22,0,0,TAU); ctx.ellipse(cx+cw*.5,cy+cw*.06,cw*.6,cw*.2,0,0,TAU); ctx.ellipse(cx-cw*.5,cy+cw*.05,cw*.55,cw*.17,0,0,TAU); ctx.fill(); }
  }
  hills(P.far,hy,H*.12,g.hill,[2,5,9],[1,.6,.3]);
  hills(P.near,hy+2,H*.075,g.tree,[3,7,12],[1,.5,.25]);
}
function hills(col,y0,amp,off,fr,am){
  ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(0,y0+4);
  for(var x=0;x<=W+8;x+=8){ var u=x/W+off, h=0, k; for(k=0;k<3;k++) h+=am[k]*Math.sin(u*TAU*fr[k]+k*1.7); h=(h/1.85)*.5+.5; ctx.lineTo(x,y0-h*amp); }
  ctx.lineTo(W+8,y0+4); ctx.closePath(); ctx.fill();
}

function drawRoad(P,camY){
  var T=TRACK, segs=T.segs, N=T.N, base=segs[Math.floor(g.pos/SEGL)%N], bp=(g.pos%SEGL)/SEGL;
  var maxy=H, x=0, dx=-(base.curve*bp), n, s, looped, camZ, first=false;
  for(n=0;n<DRAW;n++){
    s=segs[(base.index+n)%N]; looped=s.index<base.index; camZ=g.pos-(looped?T.len:0);
    s.fog=1/Math.exp(Math.pow(n/DRAW,2)*FOGD); s.clip=maxy;
    proj(s.p1,g.x*ROADW-x,camY,camZ); proj(s.p2,g.x*ROADW-x-dx,camY,camZ);
    x+=dx; dx+=s.curve;
    if(s.p1.camera.z<=CAMD||s.p2.screen.y>=s.p1.screen.y||s.p2.screen.y>=maxy) continue;
    var a=s.p1.screen, b={x:s.p2.screen.x,y:s.p2.screen.y-2,w:s.p2.screen.w}, f=s.fog, alt=s.alt;
    if(!first){ /* nearest drawn segment: run its edges straight down to the canvas bottom so no gap shows under the car */
      first=true;
      if(a.y<H&&a.y-b.y>0){
        var kx=(a.x-b.x)/(a.y-b.y), kw=(a.w-b.w)/(a.y-b.y), ey=H+2, dy=ey-a.y, ex=a.x+kx*dy, ew=a.w+kw*dy, er=ew/Math.max(6,2*LANES), ar=a.w/Math.max(6,2*LANES);
        ctx.fillStyle=mix(alt?P.gAx:P.gBx,P.fogx,f); ctx.fillRect(0,a.y-1,W,ey-a.y+2);
        var rc0=mix(alt?P.rumAx:P.rumBx,P.fogx,f);
        poly(a.x-a.w-ar,a.y-1,a.x-a.w,a.y-1,ex-ew,ey,ex-ew-er,ey,rc0); poly(a.x+a.w+ar,a.y-1,a.x+a.w,a.y-1,ex+ew,ey,ex+ew+er,ey,rc0);
        poly(a.x-a.w,a.y-1,a.x+a.w,a.y-1,ex+ew,ey,ex-ew,ey,mix(alt?P.rAx:P.rBx,P.fogx,f));
      }
    }
    ctx.fillStyle=mix(alt?P.gAx:P.gBx,P.fogx,f); ctx.fillRect(0,b.y,W,a.y-b.y);
    var r1=a.w/Math.max(6,2*LANES), r2=b.w/Math.max(6,2*LANES), rc=mix(alt?P.rumAx:P.rumBx,P.fogx,f);
    poly(a.x-a.w-r1,a.y,a.x-a.w,a.y,b.x-b.w,b.y,b.x-b.w-r2,b.y,rc);
    poly(a.x+a.w+r1,a.y,a.x+a.w,a.y,b.x+b.w,b.y,b.x+b.w+r2,b.y,rc);
    poly(a.x-a.w,a.y,a.x+a.w,a.y,b.x+b.w,b.y,b.x-b.w,b.y,mix(alt?P.rAx:P.rBx,P.fogx,f));
    if(s.line){
      var cells=10, ci, c1, c2;
      for(ci=0;ci<cells;ci++){
        c1=ci/cells*2-1; c2=(ci+1)/cells*2-1;
        poly(a.x+a.w*c1,a.y,a.x+a.w*c2,a.y,b.x+b.w*c2,b.y,b.x+b.w*c1,b.y,((ci+s.line)%2)?mix([20,21,23],P.fogx,f):mix([245,243,236],P.fogx,f));
      }
    } else if(alt){
      var l1=a.w/Math.max(32,8*LANES), l2=b.w/Math.max(32,8*LANES), lx1=a.x-a.w+a.w*2/LANES, lx2=b.x-b.w+b.w*2/LANES, lc=mix(P.lanex,P.fogx,f), ln;
      for(ln=1;ln<LANES;ln++){ poly(lx1-l1/2,a.y,lx1+l1/2,a.y,lx2+l2/2,b.y,lx2-l2/2,b.y,lc); lx1+=a.w*2/LANES; lx2+=b.w*2/LANES; }
    }
    maxy=a.y;
  }
  return base;
}

/* ---- sprites ---- */
var wcache={};
function fitText(t,wpx,hpx,font){
  var k=font+t; if(!wcache[k]){ ctx.font=font.replace("%","100"); wcache[k]=ctx.measureText(t).width/100; }
  return Math.min(hpx,wpx/wcache[k]);
}
function drawPalm(P,cx,by,u,flip){
  var h=2500*u, w=1100*u, tx=cx+flip*w*.07, ty=by-h;
  ctx.fillStyle=P.trunk; ctx.beginPath(); ctx.moveTo(cx-w*.07,by); ctx.quadraticCurveTo(cx+flip*w*.06,by-h*.5,tx-w*.03,ty); ctx.lineTo(tx+w*.03,ty); ctx.quadraticCurveTo(cx+flip*w*.06+w*.04,by-h*.5,cx+w*.07,by); ctx.closePath(); ctx.fill();
  ctx.fillStyle=P.leaf;
  var ang=[-170,-140,-110,-70,-40,-10,20,160], i, L=w*.55;
  for(i=0;i<ang.length;i++){
    var a=ang[i]*Math.PI/180, ex=tx+Math.cos(a)*L, ey=ty+Math.sin(a)*L*.55+L*.28;
    ctx.beginPath(); ctx.moveTo(tx,ty); ctx.quadraticCurveTo(tx+Math.cos(a)*L*.5,ty+Math.sin(a)*L*.6-L*.3,ex,ey); ctx.quadraticCurveTo(tx+Math.cos(a)*L*.5,ty+Math.sin(a)*L*.6-L*.05,tx,ty+L*.04); ctx.fill();
  }
}
function drawLamp(P,cx,by,u,side){
  var h=2300*u, w=900*u, pw=Math.max(1.5,70*u), ax=cx-side*w*.5;
  ctx.fillStyle=P.pole; ctx.fillRect(cx-pw/2,by-h,pw,h); ctx.fillRect(Math.min(cx,ax)-pw/2,by-h,Math.abs(ax-cx)+pw,pw);
  ctx.fillStyle=P.dark?"#FFE3A8":"#E7E3D8"; rr(ax-w*.11,by-h,w*.22,Math.max(2,h*.035),2); ctx.fill();
  if(P.lampGlow){ ctx.fillStyle="rgba(255,214,140,.2)"; ctx.beginPath(); ctx.arc(ax,by-h+h*.02,w*.4,0,TAU); ctx.fill(); }
}
function drawBill(P,cx,by,u,t,col){
  var w=1500*u, ph=w*.5, h=1500*u, pw=Math.max(2,90*u), top=by-h-ph*.2, k;
  ctx.fillStyle=P.pole; ctx.fillRect(cx-w*.34-pw/2,top+ph,pw,by-top-ph); ctx.fillRect(cx+w*.34-pw/2,top+ph,pw,by-top-ph);
  var fills=[P.or,"#1F2023","#F6EEDC",P.dark?"#2F7A6E":"#4F9E92"], inks=["#FFFFFF","#F0B429","#1F2023","#FFFFFF"];
  rr(cx-w/2,top,w,ph,Math.max(2,w*.02)); ctx.fillStyle=fills[col]; ctx.fill();
  ctx.lineWidth=Math.max(1.5,w*.016); ctx.strokeStyle=P.dark?"#E9E7E2":"#1F2023"; ctx.stroke();
  var font="700 %px Inter,system-ui,sans-serif", fs=fitText(t,w*.84,ph*.46,font);
  if(fs>=5){ ctx.font=font.replace("%",String(Math.round(fs))); ctx.fillStyle=inks[col]; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(t,cx,top+ph*.5); }
}
function drawGate(P,cx,by,u,t,w0){
  var w=w0, h=2900*u, bh=h*.17, pw=Math.max(2,110*u), top=by-h;
  ctx.fillStyle=P.dark?"#C9C5BA":"#3A3C40"; ctx.fillRect(cx-w/2-pw/2,top,pw,h); ctx.fillRect(cx+w/2-pw/2,top,pw,h);
  rr(cx-w/2,top,w,bh,Math.max(2,bh*.1)); ctx.fillStyle=t==="START"?"#1F2023":P.or; ctx.fill();
  ctx.lineWidth=Math.max(1.5,bh*.06); ctx.strokeStyle=P.dark?"#E9E7E2":"#1F2023"; ctx.stroke();
  var lab=t==="START"?"13  START / FINISH":t, font="700 %px Inter,system-ui,sans-serif", fs=fitText(lab,w*.8,bh*.5,font);
  if(fs>=5){ ctx.font=font.replace("%",String(Math.round(fs))); ctx.fillStyle=t==="START"?"#F0B429":"#FFFFFF"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(lab,cx,top+bh*.52); }
}
function drawCar(P,cx,by,w,col,o){
  var h=w*.62, body=col, dk=shade(col,.72), bk=o&&o.brake;
  ctx.fillStyle="rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(cx,by,w*.56,w*.07,0,0,TAU); ctx.fill();
  ctx.fillStyle="#141517"; rr(cx-w*.5,by-h*.3,w*.16,h*.32,w*.02); ctx.fill(); rr(cx+w*.34,by-h*.3,w*.16,h*.32,w*.02); ctx.fill();
  ctx.fillStyle=dk; ctx.beginPath(); ctx.moveTo(cx-w*.38,by-h*.52); ctx.lineTo(cx-w*.27,by-h*.94); ctx.lineTo(cx+w*.27,by-h*.94); ctx.lineTo(cx+w*.38,by-h*.52); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#182027"; ctx.beginPath(); ctx.moveTo(cx-w*.31,by-h*.54); ctx.lineTo(cx-w*.23,by-h*.88); ctx.lineTo(cx+w*.23,by-h*.88); ctx.lineTo(cx+w*.31,by-h*.54); ctx.closePath(); ctx.fill();
  ctx.fillStyle=body; rr(cx-w*.5,by-h*.6,w,h*.42,w*.05); ctx.fill();
  ctx.fillStyle=dk; ctx.fillRect(cx-w*.46,by-h*.2,w*.92,h*.1);
  if(o&&o.spoiler){ ctx.fillStyle=dk; ctx.fillRect(cx-w*.47,by-h*.66,w*.94,h*.07); }
  ctx.fillStyle=bk?"#FF5A47":"#C4271B"; rr(cx-w*.46,by-h*.5,w*.2,h*.11,w*.02); ctx.fill(); rr(cx+w*.26,by-h*.5,w*.2,h*.11,w*.02); ctx.fill();
  if(bk){ ctx.fillStyle="rgba(255,90,71,.3)"; ctx.beginPath(); ctx.arc(cx-w*.36,by-h*.45,w*.12,0,TAU); ctx.arc(cx+w*.36,by-h*.45,w*.12,0,TAU); ctx.fill(); }
  if(o&&o.label){
    ctx.fillStyle="#FFFFFF"; rr(cx-w*.15,by-h*.5,w*.3,h*.24,w*.025); ctx.fill();
    ctx.fillStyle="#1F2023"; ctx.font="700 "+Math.max(6,Math.round(h*.2))+"px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("13",cx,by-h*.375);
  } else { ctx.fillStyle="rgba(255,255,255,.85)"; ctx.fillRect(cx-w*.1,by-h*.4,w*.2,h*.08); }
}
function drawSprites(P,base){
  var T=TRACK, segs=T.segs, N=T.N, n, i, s, sp, c, a, b, u, cx, by, clipY;
  for(n=DRAW-1;n>0;n--){
    s=segs[(base.index+n)%N]; a=s.p1.screen; b=s.p2.screen;
    if(s.p1.camera.z<=CAMD) continue;
    clipY=s.clip; ctx.globalAlpha=.3+.7*s.fog;
    for(i=0;i<s.cars.length;i++){
      c=s.cars[i]; var sc=lerp(a.scale,b.scale,c.pct), cu=sc*W/2;
      cx=lerp(a.x,b.x,c.pct)+sc*c.o*ROADW*W/2; by=lerp(a.y,b.y,c.pct);
      withClip(by,clipY,function(){ drawCar(P,cx,by,Math.max(3,cu*CW*2*ROADW),P.cars[c.col],{brake:false}); });
    }
    for(i=0;i<s.sprites.length;i++){
      sp=s.sprites[i]; u=a.scale*W/2; cx=a.x+a.scale*sp.o*ROADW*W/2; by=a.y;
      if(u*900<2) continue;
      if(sp.k==="gate"){ (function(sp0,cx0,by0,u0){ withClip(by0,clipY,function(){ drawGate(P,a.x,by0,u0,sp0.t,a.w*2*1.18); }); })(sp,cx,by,u); continue; }
      if(cx<-u*1700||cx>W+u*1700) continue;
      (function(sp0,cx0,by0,u0){ withClip(by0,clipY,function(){
        if(sp0.k==="palm") drawPalm(P,cx0,by0,u0,(sp0.o>0?-1:1));
        else if(sp0.k==="lamp") drawLamp(P,cx0,by0,u0,sp0.o>0?1:-1);
        else drawBill(P,cx0,by0,u0,sp0.t,sp0.c);
      }); })(sp,cx,by,u);
    }
  }
  ctx.globalAlpha=1;
}
function withClip(by,clipY,fn){
  if(clipY<by+4){ ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,clipY); ctx.clip(); fn(); ctx.restore(); } else fn();
}

function draw(){
  if(!W||!g) return;
  var P=pal||(pal=palette()), T=TRACK, hy=Math.round(H*.5), cm=calm();
  ctx.setTransform(dprv,0,0,dprv,0,0);
  ctx.save();
  if(!cm){
    var sx=shake?(Math.random()-.5)*shake*5:0, sy=shake?(Math.random()-.5)*shake*4:0;
    ctx.translate(W/2+sx,H/2+sy); ctx.rotate(tilt); ctx.scale(1.06,1.06); ctx.translate(-W/2,-H/2);
  }
  /* sky, hills, and a horizon-coloured floor so a crest never shows a hole */
  drawSky(P,hy);
  ctx.fillStyle=mix(P.gAx,P.fogx,.2); ctx.fillRect(0,hy,W,H-hy+2);
  var pidx=playerSeg(g), ps=T.segs[pidx], pp=(wrap(g.pos+PZ,T.len)%SEGL)/SEGL;
  var camY=CAMH+lerp(ps.p1.world.y,ps.p2.world.y,pp);
  var base=drawRoad(P,camY);
  drawSprites(P,base);
  /* your car, always on the line of sight */
  var pw=CAMD/PZ*(2*PW*ROADW)*W/2, pby=H/2+CAMD/PZ*CAMH*H/2+H*.045;
  var bob=(!cm&&g.speed>0)?Math.sin(nowT*.045)*H*.0035*(g.speed/MAXS)+(g.off?Math.sin(nowT*.11)*H*.006:0):0;
  ctx.save(); ctx.translate(W/2,pby+bob); if(!cm) ctx.rotate(g.steer*.045*(g.speed/MAXS)+g.kick*.04); ctx.translate(-W/2,-(pby+bob));
  drawCar(P,W/2,pby+bob,pw,P.or,{label:true,spoiler:true,brake:g.braking});
  ctx.restore();
  /* dust off the road and speed lines at the edges */
  if(!cm){
    var i, p;
    ctx.fillStyle=P.dark?"rgba(190,170,140,.55)":"rgba(150,125,90,.55)";
    for(i=0;i<parts.length;i++){ p=parts[i]; ctx.globalAlpha=Math.max(0,p.l*1.6); ctx.fillRect(p.x,p.y,p.s,p.s); }
    ctx.globalAlpha=1;
    var spd=g.speed/MAXS;
    if(spd>.5){
      ctx.lineWidth=1.5; var vx=W/2, vy=hy, R=Math.max(W,H);
      for(i=0;i<16;i++){
        var side=i%2?1:-1, aa=(14+((i*37)%52))*Math.PI/180, tt=((nowT*.0011*(.5+spd)+i*.173)%1), r0=R*(.18+.62*tt*tt), r1=r0+R*.1*(.3+tt);
        ctx.strokeStyle=P.line+(.2*(spd-.5)*2*(1-tt*.5)).toFixed(3)+")";
        ctx.beginPath(); ctx.moveTo(vx+side*Math.cos(aa)*r0*1.1,vy+Math.sin(aa)*r0*.7); ctx.lineTo(vx+side*Math.cos(aa)*r1*1.1,vy+Math.sin(aa)*r1*.7); ctx.stroke();
      }
    }
  }
  ctx.restore();
  /* countdown and checkpoints are painted flat, never tilted */
  if(g.phase==="count"||g.goT>0){
    var lab=g.phase==="count"?String(Math.ceil(g.cd)):"GO", fs=Math.round(Math.min(H*.3,W*.3));
    ctx.font="700 "+fs+"px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.lineWidth=Math.max(4,fs*.06); ctx.strokeStyle="#1F2023"; ctx.lineJoin="round"; ctx.strokeText(lab,W/2,H*.36);
    ctx.fillStyle=lab==="GO"?"#F0B429":"#FFFFFF"; ctx.fillText(lab,W/2,H*.36);
  }
}

/* idle board: ready overlay on top of a still grid */
function idle(){ if(state==="ready"){ showOver("ready"); } }
window.setTimeout(function(){ idle(); },0);
say("Click Start race, then drive. Three laps.");
hudUpdate();
})();
