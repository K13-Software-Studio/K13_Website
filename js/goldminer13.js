/* K13 Gold Rush 13 (js/goldminer13.js): a claw-on-a-rope game for the workbench, three levels.
   The studio digs for good work: gold nuggets, a rare diamond, mystery bags, and legacy code (heavy, nearly worthless).
   A claw swings from the K13 rig. Press to drop it, it grabs the first thing it touches and reels back slower for heavy things.
   Each level has a money target and a clock; the clock starts with the first drop. Reach the target and the level clears.
   Fixed 120 Hz step behind an accumulator, devicePixelRatio-crisp canvas (cap 2), loop stops while the card is off screen,
   the tab is hidden, a result is showing or the game is paused. The game pauses when focus leaves the card during play.
   prefers-reduced-motion: no screen shake, no particles, no score pop-ups. Still fully playable.
   Keyboard (canvas focused): Space, Down or Enter drops the claw, R retries, N goes to the next level.
   Pointer: a tap or click on the board drops the claw (it fires on release, so a scroll gesture over the board does not). Every action is also a real labelled button.
   Levels are seeded, so a retry is the same ground. Progress is kept in localStorage. */
(function(){
"use strict";

var mount=document.querySelector('[data-game="goldminer13"]');
if(!mount) return;

/* ---------- the rules (no DOM below this block until the card is built) ---------- */
var WW=100, WH=70, PIV={x:50,y:8}, GROUND=15, DT=1/120;
var SWING_A=70*Math.PI/180, SWING_T=3.4, OUT_V=80, BONUS_T=5;
var TYPES={
  small:{name:"gold nugget",r:2.6,val:50,spd:46,ymin:19},
  big:{name:"big nugget",r:5.2,val:200,spd:15,ymin:30},
  dia:{name:"diamond",r:2.1,val:500,spd:50,ymin:42},
  rock:{name:"legacy code",r:4.4,val:10,spd:11,ymin:20},
  bag:{name:"mystery bag",r:3.4,val:0,spd:28,ymin:20}
};
var LEVELS=[
  {name:"Shallow ground",time:45,target:350,seed:13,mix:{small:5,big:2,rock:3,bag:1}},
  {name:"Deeper ground",time:45,target:900,seed:26,mix:{small:5,big:3,dia:1,rock:5,bag:2}},
  {name:"Client ground",time:45,target:1100,seed:39,mix:{small:4,big:3,dia:2,rock:7,bag:3}}
];
var CASH_BAGS=[{n:"a retainer",v:200},{n:"a referral",v:150},{n:"an invoice, paid",v:100}];
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; var t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function buildItems(lv){
  var rnd=rng(lv.seed), items=[], k, n, i, tries, t, it, x, y, ok, j, p;
  var order=["dia","big","rock","bag","small"];
  for(var oi=0;oi<order.length;oi++){
    k=order[oi]; n=lv.mix[k]||0; t=TYPES[k];
    for(i=0;i<n;i++){
      for(tries=0;tries<300;tries++){
        it={t:k,r:t.r*(.92+rnd()*.18),rot:rnd()*6.28,poly:[]};
        x=8+rnd()*84; y=t.ymin+rnd()*(WH-7-t.ymin);
        ok=true; for(j=0;j<items.length;j++){ if(Math.hypot(items[j].x-x,items[j].y-y)<items[j].r+it.r+1.6){ ok=false; break; } }
        if(Math.abs(x-PIV.x)<4&&y<30) ok=false;
        if(ok) break;
      }
      it.x=x; it.y=y; for(p=0;p<8;p++) it.poly.push(.8+rnd()*.35);
      it.val=t.val; it.spd=t.spd; it.bag=null;
      if(k==="bag"){
        var q=rnd();
        if(q<.55){ var c=CASH_BAGS[Math.floor(rnd()*CASH_BAGS.length)]; it.bag={kind:"cash",val:c.v,text:c.n}; }
        else if(q<.8) it.bag={kind:"time",val:0,text:"a quiet hour"};
        else it.bag={kind:"dud",val:10,text:"scope creep"};
      }
      items.push(it);
    }
  }
  return items;
}
function potential(items){ var s=0; for(var i=0;i<items.length;i++) s+=items[i].t==="bag"?250:items[i].val; return s; }

function newGame(li){
  var lv=LEVELS[li];
  return {li:li,lv:lv,items:buildItems(lv),money:0,time:lv.time,started:false,phase:"swing",swingT:0,ang:0,len:0,grab:null,over:null,ev:[],warned:false,
    tip:function(){ return {x:PIV.x+Math.sin(this.ang)*this.len,y:PIV.y+Math.cos(this.ang)*this.len}; },
    fire:function(){
      if(this.over||this.phase!=="swing") return false;
      this.phase="out"; this.len=1; if(!this.started){ this.started=true; this.ev.push({t:"start"}); } return true;
    },
    step:function(dt){
      if(this.over) return;
      if(this.started&&this.time>0){ this.time=Math.max(0,this.time-dt); if(!this.warned&&this.time<=10&&this.time>0){ this.warned=true; this.ev.push({t:"ten"}); } }
      var i, tp;
      if(this.phase==="swing"){
        this.swingT+=dt; this.ang=SWING_A*Math.sin(this.swingT*6.2832/SWING_T);
        if(this.money>=this.lv.target){ this.over="won"; this.ev.push({t:"won"}); }
        else if(this.time<=0){ this.over="lost"; this.ev.push({t:"lost",why:"time"}); }
        else if(this.money+potential(this.items)<this.lv.target){ this.over="lost"; this.ev.push({t:"lost",why:"empty"}); }
      } else if(this.phase==="out"){
        this.len+=OUT_V*dt; tp=this.tip();
        for(i=0;i<this.items.length;i++){ var it=this.items[i]; if(Math.hypot(it.x-tp.x,it.y-tp.y)<it.r+1.3){ this.grab=it; this.phase="in"; this.ev.push({t:"grab",it:it}); break; } }
        if(this.phase==="out"&&(tp.x<1.5||tp.x>WW-1.5||tp.y>WH-1.5)) { this.phase="in"; this.ev.push({t:"miss"}); }
      } else {
        var v=this.grab?this.grab.spd:90; this.len-=v*dt;
        if(this.len<=0){
          this.len=0; this.phase="swing";
          if(this.grab){
            var g=this.grab, got=g.val, extra=null;
            if(g.bag){ if(g.bag.kind==="time"){ this.time+=BONUS_T; got=0; extra="time"; } else got=g.bag.val; }
            this.money+=got; this.items.splice(this.items.indexOf(g),1); this.grab=null;
            this.ev.push({t:"deliver",it:g,val:got,extra:extra});
          }
        }
      }
    }
  };
}

/* ============================================================ the card, the canvas, the controls ============================================================ */
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }

mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Gold Rush 13")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Time the swing, drop the claw, dig up the good work. Leave the legacy code where it is."); instr.id="gm-i"; mount.appendChild(instr);
var stage=el("div","wb-stage gm-stage"); stage.setAttribute("aria-describedby","gm-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Retry</span>');
reset.type="button"; reset.setAttribute("aria-label","Retry this level"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Space, Down or a tap drops the claw. R retries, N is the next level. Progress is kept on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }
function money(n){ return "$"+n; }

var hud=el("div","gm-hud"); stage.appendChild(hud);
var view=el("div","gm-view"); stage.appendChild(view);
var cv=el("canvas","gm-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Gold Rush 13 game board. A claw swings from a rig at the top. Press Space, the down arrow, or tap the board to drop it and grab what it touches.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var hLevel=txt("span","gm-chip",""), hCash=txt("span","gm-chip",""), hTime=txt("span","gm-chip","");
hud.appendChild(hLevel); hud.appendChild(hCash); hud.appendChild(hTime);
var over=el("div","gm-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Level result"); view.appendChild(over);

var bar=el("div","gm-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Gold Rush 13 controls"); stage.appendChild(bar);
function btn(label,aria,cls){ var b=txt("button","gm-btn "+(cls||""),label); b.type="button"; if(aria) b.setAttribute("aria-label",aria); return b; }
var lvGrp=el("div","gm-grp"); lvGrp.setAttribute("role","group"); lvGrp.setAttribute("aria-label","Level"); lvGrp.appendChild(txt("span","gm-lab","Level"));
var lvBtns=[0,1,2].map(function(i){ var b=btn("","Level "+(i+1)); b.addEventListener("click",function(){ if(!b.disabled){ loadLevel(i,true); focusBoard(); } }); lvGrp.appendChild(b); return b; });
bar.appendChild(lvGrp);
var dropBtn=btn("Drop claw","Drop the claw","gm-fire"); bar.appendChild(dropBtn);

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store("k13_goldminer13")||"null"); if(s&&s.clear&&s.best&&s.clear.length===3&&s.best.length===3) return s; }catch(e){} return {clear:[0,0,0],best:[0,0,0]}; })();
function persist(){ store("k13_goldminer13",JSON.stringify(save)); }
var s=null, paused=false, down=false, hintGone=false;
var W=0,H=0,ppu=4,ox=0,dprv=1,vis=false,on=false,raf=0,acc=0,last=0,shake=0,pal=null,sig="";
var parts=[],pops=[],specks=[];
(function(){ var r=rng(7); for(var i=0;i<70;i++) specks.push({x:r()*WW,y:GROUND+2+r()*(WH-GROUND),s:.25+r()*.5}); })();

function unlocked(i){ return i===0||save.clear[i-1]>0; }
function refreshChips(){
  lvBtns.forEach(function(b,i){
    var ok=unlocked(i), c=save.clear[i];
    b.textContent=(i+1)+(c?" ✓":""); b.disabled=!ok; b.setAttribute("aria-pressed",String(!!s&&s.li===i));
    b.setAttribute("aria-label","Level "+(i+1)+(ok?(c?", cleared, best "+money(save.best[i]):", not cleared yet"):", locked, clear level "+i+" first"));
  });
}
function fmt(t){ var n=Math.ceil(t-1e-6); return Math.floor(n/60)+":"+("0"+(n%60)).slice(-2); }
function hudUpdate(){
  if(!s) return;
  var a="Level "+(s.li+1), b=money(s.money)+" / "+money(s.lv.target), c=fmt(s.time);
  var k=a+"|"+b+"|"+c+"|"+(s.time<=10&&s.started)+"|"+s.phase+"|"+s.over+"|"+paused;
  if(k===sig) return; sig=k;
  hLevel.textContent=a; hCash.textContent=b; hTime.textContent=c; hTime.classList.toggle("hot",s.started&&s.time<=10&&!s.over);
  dropBtn.disabled=!!s.over||s.phase!=="swing"&&!paused;
}
function playing(){ return !!s&&s.started&&!s.over&&!paused; }

function loadLevel(i,announce){
  s=newGame(i); parts.length=0; pops.length=0; shake=0; paused=false; over.hidden=true; over.innerHTML=""; sig=""; hintGone=false;
  hudUpdate(); refreshChips();
  if(announce!==false) say("Level "+(i+1)+" of 3, "+s.lv.name+". Reach "+money(s.lv.target)+" in "+s.lv.time+" seconds. The clock starts with your first drop.");
  fit(); wake();
}
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function retry(){ if(!s) return; loadLevel(s.li,false); say("Retrying level "+(s.li+1)+". Reach "+money(s.lv.target)+" in "+s.lv.time+" seconds."); focusBoard(); }
function nextLevel(){ if(!s) return; var n=s.li+1; if(n<3&&unlocked(n)){ loadLevel(n,true); focusBoard(); } }

/* ---------- input ---------- */
function doFire(){
  if(!s||s.over) return;
  if(paused){ resume(); return; }
  if(s.fire()){ hintGone=true; hudUpdate(); wake(); }
}
function pause(){
  if(!playing()) return; paused=true; stopLoop(); showPanel("Paused","The clock is stopped. "+fmt(s.time)+" left, "+money(s.money)+" of "+money(s.lv.target)+".","Resume",resume); say("Paused. Press Space or Resume to carry on."); draw();
}
function resume(){
  if(!paused) return; focusBoard(); paused=false; over.hidden=true; over.innerHTML=""; say("Back on. "+fmt(s.time)+" left."); wake();
}
cv.addEventListener("pointerdown",function(e){ if(e.button>0) return; down=true; try{ cv.focus({preventScroll:true}); }catch(x){} });
cv.addEventListener("pointerup",function(e){ if(!down||e.button>0) return; down=false; doFire(); });
cv.addEventListener("pointercancel",function(){ down=false; });
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key===" "||e.key==="ArrowDown"||e.key==="Enter"){ e.preventDefault(); if(!e.repeat) doFire(); }
});
mount.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key==="r"||e.key==="R"){ e.preventDefault(); retry(); }
  else if(e.key==="n"||e.key==="N"){ e.preventDefault(); nextLevel(); }
});
mount.addEventListener("focusout",function(e){ var to=e.relatedTarget; if(to&&mount.contains(to)) return; pause(); });
dropBtn.addEventListener("click",function(){ doFire(); focusBoard(); });
reset.addEventListener("click",retry);

/* ---------- results ---------- */
function showPanel(title,sub,primaryLabel,primaryFn,ghostLabel,ghostFn){
  over.innerHTML=""; var panel=el("div","gm-panel"), h=txt("h4","gm-over-t",title), p=txt("p","gm-over-s",sub), row=el("div","gm-over-row");
  function ob(label,cls,fn){ var b=txt("button","gm-obtn "+(cls||""),label); b.type="button"; b.addEventListener("click",fn); row.appendChild(b); return b; }
  panel.appendChild(h); panel.appendChild(p);
  var primary=ob(primaryLabel,"",primaryFn); if(ghostLabel) ob(ghostLabel,"ghost",ghostFn);
  panel.appendChild(row); over.appendChild(panel); over.hidden=false;
  setTimeout(function(){ try{ primary.focus({preventScroll:true}); }catch(x){} },30);
}
function showResult(won,why){
  var left=s.time>=1?", "+Math.floor(s.time)+" s to spare":"";
  if(won){
    var last=s.li===2, all=last&&save.clear.every(function(c){ return c>0; });
    showPanel(all?"All three levels dug":"Level "+(s.li+1)+" clear",
      money(s.money)+" against a target of "+money(s.lv.target)+left+(all?". Best total "+money(save.best[0]+save.best[1]+save.best[2])+".":". Best here "+money(save.best[s.li])+"."),
      last?"Play again":"Next level",last?function(){ loadLevel(0,true); focusBoard(); }:nextLevel,"Retry for more",retry);
  } else {
    showPanel(why==="empty"?"Nothing left worth digging":"Time is up",
      money(s.money)+" of "+money(s.lv.target)+(why==="empty"?". The rest of the ground is legacy code.":". Same ground, fresh clock."),"Retry",retry);
  }
}

/* ---------- events: sound of the game, in text and in particles ---------- */
function spark(x,y,cols,n){
  if(calm()) return;
  for(var i=0;i<n&&parts.length<120;i++){ var a=Math.random()*6.28, sp=6+Math.random()*16;
    parts.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-8,life:.55+Math.random()*.4,t:0,c:cols[i%cols.length],s:.7+Math.random()*.9,r:Math.random()*6}); }
}
function drain(){
  var evs=s.ev.splice(0,s.ev.length);
  for(var i=0;i<evs.length;i++){ var e=evs[i];
    if(e.t==="start") say("Clock running. "+Math.ceil(s.time)+" seconds.");
    else if(e.t==="ten") say("Ten seconds left. "+money(s.money)+" of "+money(s.lv.target)+".");
    else if(e.t==="grab"){ if(!calm()&&e.it.t==="rock") shake=Math.min(1.4,shake+.9); }
    else if(e.t==="miss") say("Nothing there. Reeling in.");
    else if(e.t==="deliver"){
      var it=e.it, m;
      if(it.bag){ m="Mystery bag: "+it.bag.text+(e.extra==="time"?", +"+BONUS_T+" seconds.":", "+money(e.val)+"."); }
      else if(it.t==="rock") m="Legacy code. Heavy, and worth "+money(e.val)+". It happens.";
      else m="Got a "+TYPES[it.t].name+", "+money(e.val)+".";
      say(m+" "+money(s.money)+" of "+money(s.lv.target)+".");
      if(!calm()){
        pops.push({x:PIV.x,y:PIV.y+3,t:0,s:e.extra==="time"?"+"+BONUS_T+" s":(e.val>0?"+"+money(e.val):"+$0")});
        if(it.t==="dia") spark(PIV.x,PIV.y+3,["#8FE3F0","#FFFFFF"],16); else if(e.val>=50||e.extra==="time") spark(PIV.x,PIV.y+3,["#F5C04A","#FFFFFF","#EA5E14"],10);
      }
    }
    else if(e.t==="won"){
      if(!save.clear[s.li]||s.money>save.best[s.li]) { save.clear[s.li]=1; save.best[s.li]=Math.max(save.best[s.li],s.money); persist(); }
      refreshChips(); say("Level "+(s.li+1)+" clear. "+money(s.money)+" against "+money(s.lv.target)+"."+(s.li<2?" Press N for the next level.":" That is all three.")); showResult(true);
    }
    else if(e.t==="lost"){ say((e.why==="empty"?"Nothing left worth digging. ":"Time is up. ")+money(s.money)+" of "+money(s.lv.target)+". Press R to retry."); showResult(false,e.why); }
  }
}
function fx(dt){
  shake=Math.max(0,shake-dt*2.2);
  for(var i=parts.length-1;i>=0;i--){ var p=parts[i]; p.t+=dt; if(p.t>p.life){ parts.splice(i,1); continue; } p.vy+=60*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.r+=dt*6; }
  for(i=pops.length-1;i>=0;i--){ pops[i].t+=dt; if(pops[i].t>1.1) pops.splice(i,1); }
}

/* ---------- the loop ---------- */
function busy(){ return !!s&&((!s.over&&!paused)||parts.length>0||pops.length>0||shake>0); }
function frame(t){
  raf=0; if(!vis||document.hidden){ on=false; return; }
  var dt=Math.min(.05,(t-last)/1000); last=t; acc+=dt; var n=0;
  if(!paused) while(acc>=DT&&n<8){ s.step(DT); acc-=DT; n++; }
  if(n===8) acc=0;
  fx(dt); drain(); hudUpdate(); draw();
  if(!busy()){ on=false; return; }
  raf=window.requestAnimationFrame(frame);
}
function wake(){ if(on||!vis||document.hidden||!s){ if(s&&vis&&W) draw(); return; } if(!W&&!fit()) return; on=true; acc=0; last=performance.now(); raf=window.requestAnimationFrame(frame); }
function stopLoop(){ if(raf){ window.cancelAnimationFrame(raf); raf=0; } on=false; }
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else stopLoop(); },{threshold:0}).observe(stage);
document.addEventListener("visibilitychange",function(){ if(document.hidden) stopLoop(); else wake(); });
if(window.ResizeObserver) new ResizeObserver(function(){ if(fit()) wake(); }).observe(view); else window.addEventListener("resize",function(){ if(fit()) wake(); });
new MutationObserver(function(){ pal=null; if(vis) draw(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
if(mq.addEventListener) mq.addEventListener("change",function(){ if(vis) wake(); });

function fit(){
  var w=view.clientWidth, h=view.clientHeight; if(!w||!h) return false;
  dprv=Math.min(window.devicePixelRatio||1,2);
  var pw=Math.round(w*dprv), ph=Math.round(h*dprv);
  if(cv.width!==pw||cv.height!==ph){ cv.width=pw; cv.height=ph; }
  W=w; H=h; ppu=Math.min(w/WW,h/WH); ox=(w-WW*ppu)/2;
  if(s) draw(); return true;
}

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement);
  function v(n,d){ var x=cs.getPropertyValue(n).trim(); return x||d; }
  return {bg:v("--paper-3","#E9EDF7"),ink:v("--ink","#1F2023"),or:v("--blue","#B94612"),or2:v("--blue-2","#EA5E14"),muted:v("--muted","#5D5F65"),line:v("--line-2","rgba(31,32,35,.22)")};
}
function X(x){ return ox+x*ppu; } function Y(y){ return y*ppu; }
var OUTLINE="#15161A";
function polyPath(it,k){
  var n=it.poly.length; ctx.beginPath();
  for(var i=0;i<n;i++){ var a=i/n*6.2832, rr=it.r*ppu*it.poly[i]*k; ctx[i?"lineTo":"moveTo"](Math.cos(a)*rr,Math.sin(a)*rr); }
  ctx.closePath();
}
function drawItem(it,x,y){
  var u=ppu, r=it.r*u;
  ctx.save(); ctx.translate(X(x),Y(y)); ctx.rotate(it.rot); ctx.lineJoin="round"; ctx.lineWidth=Math.max(1.5,u*.28); ctx.strokeStyle=OUTLINE;
  if(it.t==="small"||it.t==="big"){
    polyPath(it,1); ctx.fillStyle=it.t==="big"?"#E8A920":"#F5C04A"; ctx.fill(); ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(-r*.32,-r*.34,r*.3,r*.16,-.6,0,6.2832); ctx.fill();
  } else if(it.t==="dia"){
    ctx.beginPath(); ctx.moveTo(0,-r*1.15); ctx.lineTo(r*1.05,-r*.2); ctx.lineTo(0,r*1.2); ctx.lineTo(-r*1.05,-r*.2); ctx.closePath();
    ctx.fillStyle="#8FE3F0"; ctx.fill(); ctx.stroke();
    ctx.lineWidth=Math.max(1,u*.14); ctx.strokeStyle="rgba(255,255,255,.85)"; ctx.beginPath(); ctx.moveTo(-r*1.05,-r*.2); ctx.lineTo(r*1.05,-r*.2); ctx.moveTo(-r*.35,-r*.2); ctx.lineTo(0,-r*1.15); ctx.lineTo(r*.35,-r*.2); ctx.lineTo(0,r*1.2); ctx.lineTo(-r*.35,-r*.2); ctx.stroke();
  } else if(it.t==="rock"){
    polyPath(it,1.02); ctx.fillStyle="#7B7D83"; ctx.fill(); ctx.stroke();
    ctx.rotate(-it.rot); ctx.fillStyle="#D2D3D6"; ctx.font="600 "+Math.max(8,Math.round(r*.95))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("//",0,r*.05);
  } else {
    ctx.rotate(-it.rot);
    ctx.beginPath(); ctx.moveTo(-r*.35,-r*.95); ctx.lineTo(r*.35,-r*.95); ctx.lineTo(r*.25,-r*.55); ctx.bezierCurveTo(r*1.35,-r*.1,r*1.15,r*1.05,0,r*1.05); ctx.bezierCurveTo(-r*1.15,r*1.05,-r*1.35,-r*.1,-r*.25,-r*.55); ctx.closePath();
    ctx.fillStyle="#C9763A"; ctx.fill(); ctx.stroke();
    ctx.fillStyle="#FFFFFF"; ctx.font="700 "+Math.max(9,Math.round(r*1.1))+"px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("?",0,r*.2);
  }
  ctx.restore();
}
function rrect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function drawClaw(tp,closed){
  var u=ppu, k=closed?.45:1;
  ctx.save(); ctx.translate(X(tp.x),Y(tp.y)); ctx.rotate(-s.ang); ctx.lineJoin="round"; ctx.lineCap="round";
  ctx.beginPath(); ctx.arc(0,0,u*.9,0,6.2832); ctx.fillStyle="#D9DADD"; ctx.fill(); ctx.lineWidth=Math.max(1.5,u*.25); ctx.strokeStyle=OUTLINE; ctx.stroke();
  [-1,1].forEach(function(d){
    ctx.beginPath(); ctx.moveTo(d*u*.5,u*.4); ctx.lineTo(d*u*2.6*k,u*1.5); ctx.lineTo(d*u*(1.5+k*.6),u*3.3);
    ctx.lineWidth=Math.max(3,u*.85); ctx.strokeStyle=OUTLINE; ctx.stroke();
    ctx.lineWidth=Math.max(1.6,u*.45); ctx.strokeStyle="#D9DADD"; ctx.stroke();
  });
  ctx.restore();
}
function draw(){
  if(!s||!W) return;
  if(!pal) pal=palette();
  var P=pal, i, sh=shake>0&&!calm()?shake:0, dx=sh?(Math.random()-.5)*sh*ppu*.5:0, dy=sh?(Math.random()-.5)*sh*ppu*.5:0;
  ctx.setTransform(dprv,0,0,dprv,0,0); ctx.clearRect(0,0,W,H);
  ctx.save(); ctx.translate(dx,dy);
  ctx.fillStyle=P.bg; ctx.fillRect(-20,-20,W+40,H+40);
  var gy=Y(GROUND);
  ctx.fillStyle="#26272B"; ctx.fillRect(-20,gy,W+40,H-gy+20);
  ctx.fillStyle="#18191C"; ctx.fillRect(-20,gy,ox+20,H-gy+20); ctx.fillRect(ox+WW*ppu,gy,ox+20,H-gy+20);
  ctx.fillStyle="#EA5E14"; ctx.fillRect(-20,gy,W+40,Math.max(2,ppu*.35));
  ctx.fillStyle="rgba(255,255,255,.1)"; for(i=0;i<specks.length;i++){ var sp=specks[i], z=sp.s*ppu; ctx.fillRect(X(sp.x),Y(sp.y),z,z); }
  /* the rig */
  var bw=18*ppu, bh=6.4*ppu;
  rrect(X(PIV.x)-bw/2,Y(1.4),bw,bh,ppu*1.2); ctx.fillStyle="#1F2023"; ctx.fill(); ctx.lineWidth=Math.max(1,ppu*.2); ctx.strokeStyle="rgba(217,218,221,.55)"; ctx.stroke();
  ctx.fillStyle="#F3F5FA"; ctx.font="600 "+Math.max(9,Math.round(ppu*2.3))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("K13",X(PIV.x),Y(4.5));
  var tp=s.tip(), closed=!!s.grab;
  /* aim guide while swinging */
  if(s.phase==="swing"&&!s.over&&!paused){
    ctx.save(); ctx.strokeStyle=P.or2; ctx.globalAlpha=.55; ctx.lineWidth=Math.max(1.2,ppu*.2); ctx.setLineDash([ppu*.9,ppu*1.3]); ctx.beginPath();
    ctx.moveTo(X(PIV.x),Y(PIV.y)); var ddx=Math.sin(s.ang), ddy=Math.cos(s.ang), tl=Math.min(ddx>.001?(WW-1.5-PIV.x)/ddx:ddx<-.001?(1.5-PIV.x)/ddx:1e9,(WH-1.5-PIV.y)/ddy);
    ctx.lineTo(X(PIV.x+ddx*tl),Y(PIV.y+ddy*tl)); ctx.stroke(); ctx.restore();
  }
  /* items */
  for(i=0;i<s.items.length;i++){ var it=s.items[i]; if(it!==s.grab) drawItem(it,it.x,it.y); }
  /* rope, grabbed item, claw */
  ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(X(PIV.x),Y(PIV.y)); ctx.lineTo(X(tp.x),Y(tp.y));
  ctx.lineWidth=Math.max(3,ppu*.7); ctx.strokeStyle=OUTLINE; ctx.stroke(); ctx.lineWidth=Math.max(1.4,ppu*.32); ctx.strokeStyle="#D9DADD"; ctx.stroke();
  if(s.grab){ var g=s.grab, d=g.r+2.2; drawItem(g,tp.x+Math.sin(s.ang)*d,tp.y+Math.cos(s.ang)*d); }
  drawClaw(tp,closed);
  ctx.beginPath(); ctx.arc(X(PIV.x),Y(PIV.y),Math.max(3,ppu*.8),0,6.2832); ctx.fillStyle="#EA5E14"; ctx.fill(); ctx.lineWidth=Math.max(1.2,ppu*.2); ctx.strokeStyle=OUTLINE; ctx.stroke();
  /* hint before the first drop */
  if(!hintGone&&s.phase==="swing"&&!s.over&&!paused){
    ctx.fillStyle=P.muted; ctx.font="500 "+Math.max(11,Math.round(ppu*2.1))+"px 'JetBrains Mono',monospace"; ctx.textAlign="left"; ctx.textBaseline="alphabetic"; ctx.fillStyle=P.ink; ctx.globalAlpha=.8;
    ctx.fillText(ppu<5?"tap to drop":"tap or press Space to drop",X(2),Y(GROUND-2)); ctx.globalAlpha=1;
  }
  for(i=0;i<parts.length;i++){ var q=parts[i]; ctx.save(); ctx.globalAlpha=Math.max(0,1-q.t/q.life); ctx.translate(X(q.x),Y(q.y)); ctx.rotate(q.r); ctx.fillStyle=q.c; var z2=q.s*ppu; ctx.fillRect(-z2/2,-z2/2,z2,z2); ctx.restore(); }
  for(i=0;i<pops.length;i++){ var o=pops[i]; ctx.save(); ctx.globalAlpha=Math.max(0,1-o.t/1.1); ctx.fillStyle="#F5C04A"; ctx.strokeStyle=OUTLINE; ctx.lineWidth=3; ctx.font="700 "+Math.max(13,Math.round(ppu*3))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.strokeText(o.s,X(o.x),Y(o.y)-o.t*ppu*7); ctx.fillText(o.s,X(o.x),Y(o.y)-o.t*ppu*7); ctx.restore(); }
  ctx.restore();
}

/* ---------- boot ---------- */
var start=0; for(var si=0;si<3;si++){ if(unlocked(si)&&!save.clear[si]){ start=si; break; } }
if(document.fonts&&document.fonts.load) document.fonts.load("600 40px Fraunces").then(function(){ if(vis&&W) draw(); },function(){});
loadLevel(start,false);
say("Gold Rush 13. Three levels. Level "+(start+1)+": reach "+money(s.lv.target)+" in "+s.lv.time+" seconds. Press Space to drop the claw.");
})();
