/* K13 Run & Ship: a side-scrolling run and gun on the workbench. You are a K13 dev with a laptop and a very small gun.
   Run right through one short level, clear the template bots, find the spread-shot capsule, and shut down the legacy server at the end.
   Three lives, one hit each. Hold down to duck: aimed bullets pass over you, bots running into you do not.
   The loop is a fixed 120 Hz step behind an accumulator and draws to a devicePixelRatio-crisp canvas (400 by 225 world units).
   The clock stops when the board loses focus, the card leaves the screen or the tab is hidden.
   prefers-reduced-motion: no particles, no blinking, no shake. The game itself still plays.
   Keyboard (board focused): arrows or WASD move and aim, Space, Z or J jump, X, K or F fire, Esc or P pause, R restart.
   Down plus jump drops through a platform. Touch: an eight-way pad, Jump and Fire, all real buttons, multi-touch. */
(function(){
"use strict";
var mount=document.querySelector('[data-game="contra13"]');
if(!mount) return;

/* ---------- level data ---------- */
var VW=400, VH=225, GY=180, ARENA=2600, WALLX=2910, STEP=1/120, TAU=Math.PI*2;
var GRAV=900, JUMP=330, RUN=86, BSPD=290;
var PLATS=[{x:330,w:80,y:135},{x:560,w:70,y:135},{x:900,w:100,y:135},{x:970,w:70,y:95},{x:1400,w:90,y:135},{x:1800,w:100,y:135},{x:1860,w:70,y:95},{x:2150,w:90,y:135},{x:2640,w:70,y:135},{x:2740,w:70,y:100}];
var RUNNERS=[440,520,600,760,820,1000,1060,1120,1500,1540,1580,1900,1940,2200,2230,2290];
var GUNNERS=[{x:690,y:GY},{x:940,y:135},{x:1250,y:GY},{x:1760,y:GY},{x:2060,y:GY}];
var TURRETS=[1100,1650,2000,2330];
var CAPS=[380,1450,2150];
var BOSSPTS=[{y:74,name:"FLASH"},{y:118,name:"FTP"},{y:162,name:"IE6"}];

/* ---------- tiny helpers ---------- */
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }

/* ---------- card chrome: same anatomy as the other workbench games ---------- */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Run & Ship")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Clear the bugs and template bots between you and the deploy. Shoot in eight directions, duck under what flies at you."); instr.id="c13-i"; mount.appendChild(instr);
var stage=el("div","wb-stage c13-stage"); stage.setAttribute("aria-describedby","c13-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Restart the run"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Arrows or WASD move and aim, Space or Z jumps, X or F fires, down ducks, down plus jump drops through a platform, Esc pauses, R restarts. On a phone, use the pad and the two big buttons. Your best score is kept on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var inner=el("div","c13-in"); stage.appendChild(inner);
var top=el("div","c13-top");
var hLives=txt("span","c13-chip",""), hScore=txt("span","c13-chip",""), hGun=txt("span","c13-chip",""), hBest=txt("span","c13-chip",""), hBoss=txt("span","c13-chip c13-boss","");
hBoss.hidden=true;
top.appendChild(hLives); top.appendChild(hScore); top.appendChild(hGun); top.appendChild(hBest); top.appendChild(hBoss); inner.appendChild(top);
var view=el("div","c13-view"); inner.appendChild(view);
var cv=el("canvas","c13-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Run and Ship game board. Arrow keys or WASD move and aim, Space or Z jumps, X or F fires, Escape pauses.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var over=el("div","c13-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Run and Ship"); view.appendChild(over);

/* controls bar, below the board: nothing on the canvas ever sits over a button */
var bar=el("div","c13-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Controls"); inner.appendChild(bar);
var dpad=el("div","c13-dpad"); dpad.setAttribute("role","group"); dpad.setAttribute("aria-label","Direction pad"); bar.appendChild(dpad);
/* id, label, left, right, up, down, row, col, arrow angle */
var DIRS=[
  ["ul","Aim up and left",1,0,1,0,1,1,315],["u","Aim up",0,0,1,0,1,2,0],["ur","Aim up and right",0,1,1,0,1,3,45],
  ["l","Move left",1,0,0,0,2,1,270],["r","Move right",0,1,0,0,2,3,90],
  ["dl","Duck facing left, or aim down and left in the air",1,0,0,1,3,1,225],["d","Duck, or aim down in the air",0,0,0,1,3,2,180],["dr","Duck facing right, or aim down and right in the air",0,1,0,1,3,3,135]
];
var held={}, kb={l:0,r:0,u:0,d:0,jump:0,fire:0}, pad={};
function bindHold(b,id,onDown){
  function up(){ if(held[id]){ held[id]=0; b.classList.remove("on"); } }
  b.addEventListener("pointerdown",function(e){
    if(e.button>0) return; e.preventDefault();
    try{ b.setPointerCapture(e.pointerId); }catch(x){}
    held[id]=1; b.classList.add("on"); if(onDown) onDown();
  });
  b.addEventListener("pointerup",up); b.addEventListener("pointercancel",up); b.addEventListener("lostpointercapture",up);
  b.addEventListener("mousedown",function(e){ e.preventDefault(); });
  b.addEventListener("contextmenu",function(e){ e.preventDefault(); });
  /* keyboard on a focused button arrives as a click with no pointer: pulse it */
  b.addEventListener("click",function(e){
    if(e.detail!==0) return;
    held[id]=1; b.classList.add("on"); if(onDown) onDown();
    setTimeout(up,170);
  });
}
var dirBtn={};
DIRS.forEach(function(d){
  /* the arrow is turned through the style object, not a style attribute: the site's CSP blocks inline style attributes */
  var b=el("button","c13-pb",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/></svg>');
  b.firstChild.style.transform="rotate("+d[8]+"deg)"; b.type="button"; b.setAttribute("aria-label",d[1]); b.style.gridRow=d[6]; b.style.gridColumn=d[7];
  dpad.appendChild(b); dirBtn[d[0]]=d; bindHold(b,d[0]);
});
var mid=el("div","c13-mid"); bar.appendChild(mid);
var pauseBtn=txt("button","c13-pill","Pause"); pauseBtn.type="button"; pauseBtn.setAttribute("aria-label","Pause the run");
pauseBtn.addEventListener("click",function(){ if(mode==="play") pause(); else if(mode==="paused") begin(); focusBoard(); });
pauseBtn.addEventListener("mousedown",function(e){ e.preventDefault(); });
mid.appendChild(pauseBtn);
var acts=el("div","c13-acts"); bar.appendChild(acts);
var jumpBtn=el("button","c13-act c13-jump",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5M6 11l6-6 6 6"/></svg><span>Jump</span>');
jumpBtn.type="button"; jumpBtn.setAttribute("aria-label","Jump");
var fireBtn=el("button","c13-act c13-fire",'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg><span>Fire</span>');
fireBtn.type="button"; fireBtn.setAttribute("aria-label","Fire");
acts.appendChild(jumpBtn); acts.appendChild(fireBtn);
bindHold(jumpBtn,"jump",function(){ if(G) G.jumpPress=true; });
bindHold(fireBtn,"fire",function(){ if(G) G.firePress=true; });

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store("k13_contra13")||"null"); if(s&&typeof s.best==="number") return s; }catch(e){} return {best:0}; })();
function persist(){ store("k13_contra13",JSON.stringify(save)); }
var G=null, mode="ready", W=0, H=0, dprv=1, vis=false, raf=0, acc=0, last=0, pal=null, sig="";

function newGame(){
  var pts=BOSSPTS.map(function(b,i){ return {y:b.y,name:b.name,hp:14,max:14,dead:false,cd:1.3+i*.9,hit:0}; });
  var g={t:0,cam:0,score:0,lives:3,gun:0,jumpPress:false,firePress:false,
    p:{x:40,y:GY,vy:0,ground:true,onPlat:false,prone:false,face:1,spin:false,dead:0,inv:0,drop:0,cool:0,ax:1,ay:0,step:0,ang:0},
    bul:[],eb:[],en:[],caps:[],items:[],bits:[],ri:0,ci:0,kills:0,msg:"",msgT:0,winT:0,
    boss:{on:false,pts:pts,done:false}};
  GUNNERS.forEach(function(q,i){ g.en.push({k:"gun",x:q.x,y:q.y,w:12,h:20,hp:2,vx:0,cd:1.1+(i%3)*.5,hit:0,face:-1}); });
  TURRETS.forEach(function(x,i){ g.en.push({k:"tur",x:x,y:GY,w:18,h:14,hp:4,vx:0,cd:1.2+(i%2)*.6,hit:0,ax:-1,ay:0}); });
  return g;
}
function hud(){
  if(!G) return;
  var left=0; G.boss.pts.forEach(function(q){ if(!q.dead) left++; });
  var s=[G.lives,G.score,G.gun,save.best,G.boss.on,left].join("|"); if(s===sig) return; sig=s;
  hLives.textContent="Lives "+G.lives; hScore.textContent="Score "+G.score;
  hGun.textContent="Gun "+(G.gun?"spread":"normal"); hBest.textContent="Best "+Math.max(save.best,G.score);
  hBoss.hidden=!G.boss.on; hBoss.textContent="Legacy server "+left+"/3";
}
function banner(t){ G.msg=t; G.msgT=2.2; say(t); }
function panel(title,sub,buttons){
  over.innerHTML=""; var p=el("div","c13-panel");
  p.appendChild(txt("div","c13-over-t",title)); if(sub) p.appendChild(txt("p","c13-over-s",sub));
  var row=el("div","c13-over-row");
  buttons.forEach(function(b){ var x=txt("button","c13-obtn"+(b.ghost?" ghost":""),b.label); x.type="button"; x.addEventListener("click",b.go); row.appendChild(x); });
  p.appendChild(row); over.appendChild(p); over.hidden=false;
  return row.firstChild;
}
function showReady(){
  mode="ready"; clearInput();
  panel("Run & Ship","Clear the bugs and template bots on the way to the deploy. A legacy server is waiting at the end. Three lives.",[{label:"Start",go:function(){ begin(); }}]);
  say("Ready. Press Start, then run right. Space jumps, X fires, hold up or down to aim.");
}
function newRun(){ G=newGame(); sig=""; fitNow(); showReady(); hud(); wake(); }
function restart(){ G=newGame(); sig=""; mode="ready"; begin(); say("New run. Go right."); }
function clearInput(){ kb={l:0,r:0,u:0,d:0,jump:0,fire:0}; for(var k in held) held[k]=0; var bs=bar.querySelectorAll(".on"); for(var i=0;i<bs.length;i++) bs[i].classList.remove("on"); }
function begin(){ if(!G||mode==="won"||mode==="over") return; over.hidden=true; mode="play"; pauseBtn.textContent="Pause"; pauseBtn.setAttribute("aria-label","Pause the run"); clearInput(); G.jumpPress=false; G.firePress=false; acc=0; last=0; focusBoard(); wake(); if(G.t===0&&!G.msgT) banner("Go right."); }
function pause(why){ if(mode!=="play") return; mode="paused"; clearInput(); pauseBtn.textContent="Resume"; pauseBtn.setAttribute("aria-label","Resume the run");
  var b=panel("Paused",why||"The bugs wait for you.",[{label:"Continue",go:function(){ begin(); }}]); setTimeout(function(){ if(mode==="paused"){ try{ b.focus({preventScroll:true}); }catch(x){} } },30); }
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function finish(win){
  mode=win?"won":"over"; clearInput(); pauseBtn.textContent="Pause";
  var fresh=G.score>save.best; if(fresh){ save.best=G.score; persist(); } sig="";
  var t=Math.round(G.t);
  var b=win?panel("Deployed.","Legacy server shut down in "+t+" seconds. Score "+G.score+(fresh?", a new best.":". Best "+save.best+"."),[{label:"Run it again",go:function(){ restart(); }}])
           :panel("Build failed.","Score "+G.score+(fresh?", a new best.":". Best "+save.best+".")+" The bots are still there. So are you.",[{label:"Run it again",go:function(){ restart(); }}]);
  say(win?"Deployed. Score "+G.score+".":"Out of lives. Score "+G.score+".");
  setTimeout(function(){ try{ b.focus({preventScroll:true}); }catch(x){} },30);
  hud(); draw();
}

/* ---------- input ---------- */
var KEYMAP={ArrowLeft:"l",ArrowRight:"r",ArrowUp:"u",ArrowDown:"d",a:"l",d:"r",w:"u",s:"d",A:"l",D:"r",W:"u",S:"d",z:"jump",Z:"jump",j:"jump",J:"jump"," ":"jump",x:"fire",X:"fire",k:"fire",K:"fire",f:"fire",F:"fire"};
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var k=KEYMAP[e.key];
  if(k){
    e.preventDefault();
    if(mode==="ready"||mode==="paused"){ begin(); }
    if(mode!=="play") return;
    if(!e.repeat){ if(k==="jump") G.jumpPress=true; if(k==="fire") G.firePress=true; }
    kb[k]=1;
  } else if(e.key==="Enter"){ if(mode==="ready"||mode==="paused"){ e.preventDefault(); begin(); } }
  else if(e.key==="Escape"||e.key==="p"||e.key==="P"){ if(mode==="play"){ e.preventDefault(); pause(); } }
});
cv.addEventListener("keyup",function(e){ var k=KEYMAP[e.key]; if(k) kb[k]=0; });
mount.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if((e.key==="r"||e.key==="R")&&(e.target===cv||over.contains(e.target))){ e.preventDefault(); restart(); }
});
cv.addEventListener("pointerdown",function(){ focusBoard(); });
cv.addEventListener("blur",function(){
  clearInput();
  if(mode!=="play") return;
  setTimeout(function(){ if(mode==="play"&&!bar.contains(document.activeElement)&&document.activeElement!==cv) pause("You clicked away, so the clock stopped."); },0);
});
reset.addEventListener("click",function(){ restart(); });
function input(){
  var l=kb.l,r=kb.r,u=kb.u,d=kb.d,j=kb.jump,f=kb.fire;
  for(var id in dirBtn){ if(held[id]){ var q=dirBtn[id]; l|=q[2]; r|=q[3]; u|=q[4]; d|=q[5]; } }
  return {l:l,r:r,u:u,d:d,jump:j||held.jump,fire:f||held.fire};
}

/* ---------- the game step ---------- */
function bits(x,y,n,c,sp){
  if(calm()) return;
  for(var i=0;i<n;i++){ var a=Math.random()*TAU, v=(.35+Math.random()*.65)*(sp||110); G.bits.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-50,t:0,c:c,s:1.6+Math.random()*2}); }
}
function eshoot(x,y,tx,ty,spd,spread){
  var a=Math.atan2(ty-y,tx-x)+(spread||0);
  G.eb.push({x:x,y:y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd});
}
function addScore(n){ G.score+=n; }
function die(){
  var p=G.p; if(p.dead>0||p.inv>0) return;
  G.lives--; p.dead=1.1; G.gun=0; bits(p.x,p.y-11,16,"o",150);
  banner(G.lives>0?"Hit. "+G.lives+(G.lives===1?" life":" lives")+" left.":"Out of lives.");
}
function respawn(){
  var p=G.p; p.x=G.cam+36; p.y=-24; p.vy=0; p.ground=false; p.onPlat=false; p.prone=false; p.spin=false; p.dead=0; p.inv=2.2; p.drop=0; G.eb.length=0;
}
function shoot(){
  var p=G.p, cx=p.x, cy=p.y-(p.prone?5:p.spin?11:16);
  var mx=cx+p.ax*11, my=cy+p.ay*11;
  if(G.gun){
    var base=Math.atan2(p.ay,p.ax), offs=[-.44,-.22,0,.22,.44];
    for(var i=0;i<5;i++) G.bul.push({x:mx,y:my,vx:Math.cos(base+offs[i])*265,vy:Math.sin(base+offs[i])*265,t:0});
    p.cool=.27;
  } else { G.bul.push({x:mx,y:my,vx:p.ax*BSPD,vy:p.ay*BSPD,t:0}); p.cool=.16; }
}
function step(dt){
  var p=G.p, i, j, e, b, inp=input();
  G.t+=dt; if(G.msgT>0) G.msgT-=dt;
  /* the player */
  if(p.dead>0){ p.dead-=dt; if(p.dead<=0){ if(G.lives<=0){ finish(false); return; } respawn(); } }
  else {
    var dx=(inp.r?1:0)-(inp.l?1:0);
    if(dx) p.face=dx;
    p.prone=p.ground&&!!inp.d&&!inp.u;
    if(!p.prone) p.x+=dx*RUN*dt;
    if(dx&&p.ground&&!p.prone) p.step+=dt*14;
    if(G.jumpPress){ G.jumpPress=false;
      if(p.ground){
        if(inp.d){ if(p.onPlat){ p.drop=.22; p.ground=false; p.onPlat=false; p.y+=2; } }
        else { p.vy=-JUMP; p.ground=false; p.spin=true; p.onPlat=false; }
      }
    }
    if(p.spin&&p.vy<-190&&!inp.jump) p.vy=-190;
    var py=p.y; p.vy+=GRAV*dt; p.y+=p.vy*dt; if(p.drop>0) p.drop-=dt;
    var landed=false;
    if(p.vy>=0){
      if(p.y>=GY){ p.y=GY; landed=true; p.onPlat=false; }
      else if(p.drop<=0){
        for(i=0;i<PLATS.length;i++){ var pl=PLATS[i];
          if(p.x+4>pl.x&&p.x-4<pl.x+pl.w&&py<=pl.y+.01&&p.y>=pl.y){ p.y=pl.y; landed=true; p.onPlat=true; break; } }
      }
    }
    if(landed){ p.vy=0; p.spin=false; p.ground=true; } else { if(p.ground&&!p.spin) p.spin=false; p.ground=false; }
    var hi=Math.min(G.cam+VW-6,WALLX-10);
    if(p.x<G.cam+6) p.x=G.cam+6; if(p.x>hi) p.x=hi;
    /* aim: eight ways. Down only aims when airborne, on the ground it ducks. */
    var ax=dx, ay=0;
    if(inp.u) ay=-1; else if(inp.d&&!p.ground) ay=1;
    if(p.prone){ ax=p.face; ay=0; }
    if(!ax&&!ay) ax=p.face;
    if(ax&&ay){ ax*=.7071; ay*=.7071; }
    p.ax=ax; p.ay=ay;
    if(p.cool>0) p.cool-=dt;
    if((inp.fire||G.firePress)&&p.cool<=0) shoot();
    G.firePress=false;
    if(p.inv>0) p.inv-=dt;
  }
  var pcy=p.y-(p.prone?4:11), pw=p.prone?9:5, ph=p.prone?5:10;
  /* the camera only goes forward, and locks at the arena */
  var want=Math.min(ARENA,p.x-170); if(want>G.cam) G.cam=want;
  /* spawns */
  while(G.ri<RUNNERS.length&&G.cam+VW>=RUNNERS[G.ri]){
    G.en.push({k:"run",x:G.cam+VW+14,y:GY,w:12,h:20,hp:1,vx:-(G.ri%2?74:58),hit:0,face:-1,ph:G.ri}); G.ri++; }
  while(G.ci<CAPS.length&&G.cam+VW>=CAPS[G.ci]){ G.caps.push({x:G.cam+VW+14,y:78,t:G.ci*1.3}); G.ci++; }
  if(!G.boss.on&&G.cam>=ARENA-1){ G.boss.on=true; banner("Legacy server. Shoot the three lit modules."); }
  /* player bullets */
  for(i=G.bul.length-1;i>=0;i--){ b=G.bul[i]; b.x+=b.vx*dt; b.y+=b.vy*dt; b.t+=dt; var gone=false;
    if(b.x<G.cam-8||b.x>G.cam+VW+8||b.y<-8||b.y>GY+4||b.t>1.2) gone=true;
    if(!gone) for(j=0;j<G.en.length;j++){ e=G.en[j];
      if(Math.abs(b.x-e.x)<e.w/2+2&&b.y>e.y-e.h-2&&b.y<e.y+2){ e.hp--; e.hit=.09; gone=true;
        if(e.hp<=0){ addScore(e.k==="tur"?200:e.k==="gun"?150:100); G.kills++; bits(e.x,e.y-e.h/2,e.k==="tur"?14:9,e.k==="run"?"i":"o",120); G.en.splice(j,1); }
        break; } }
    if(!gone) for(j=0;j<G.caps.length;j++){ var c=G.caps[j];
      if(Math.abs(b.x-c.x)<12&&Math.abs(b.y-c.y)<8){ gone=true; G.items.push({x:c.x,y:c.y,vy:0}); bits(c.x,c.y,8,"a",90); G.caps.splice(j,1); addScore(50); break; } }
    if(!gone&&G.boss.on&&!G.boss.done){
      if(b.x>WALLX+1&&b.y>26&&b.y<GY){
        gone=true;
        for(j=0;j<3;j++){ var q=G.boss.pts[j]; if(q.dead) continue;
          var ddx=b.x-(WALLX+14), ddy=b.y-q.y;
          if(ddx*ddx+ddy*ddy<15*15){ q.hp--; q.hit=.09;
            if(q.hp<=0){ q.dead=true; addScore(300); bits(WALLX+14,q.y,18,"o",170); banner(q.name+" is offline."); G.eb.length=0;
              var alive=0; G.boss.pts.forEach(function(z){ if(!z.dead) alive++; });
              if(!alive){ G.boss.done=true; G.winT=0; addScore(2000+G.lives*500); bits(WALLX+45,100,60,"o",220); banner("Legacy server shut down."); }
            }
            break; } }
      }
    }
    if(gone) G.bul.splice(i,1);
  }
  /* enemies */
  for(i=G.en.length-1;i>=0;i--){ e=G.en[i];
    if(e.hit>0) e.hit-=dt;
    if(e.k==="run"){
      e.x+=e.vx*dt; if(e.x<G.cam-30){ G.en.splice(i,1); continue; }
    } else if(e.x>G.cam+VW+4||e.x<G.cam-20) continue;
    else {
      e.cd-=dt;
      var ty=p.y-13;
      if(e.k==="gun"){ e.face=p.x<e.x?-1:1; if(e.cd<=0&&e.x<G.cam+VW-14){ e.cd=2; eshoot(e.x+e.face*8,e.y-13,p.x,ty,105); } }
      else if(e.k==="tur"){ var an=Math.atan2(ty-(e.y-12),p.x-e.x); e.ax=Math.cos(an); e.ay=Math.sin(an);
        if(e.cd<=0&&e.x<G.cam+VW-14){ e.cd=1.9; eshoot(e.x+e.ax*12,e.y-12+e.ay*12,p.x,ty,115); } }
    }
    if(p.dead<=0&&p.inv<=0&&e.k==="run"&&Math.abs(e.x-p.x)<e.w/2+pw-1&&e.y>p.y-ph*2&&e.y-e.h<p.y) die();
  }
  /* the boss */
  if(G.boss.on&&!G.boss.done){
    var alive2=0; G.boss.pts.forEach(function(z){ if(!z.dead) alive2++; });
    G.boss.pts.forEach(function(q){ if(q.hit>0) q.hit-=dt; if(q.dead) return; q.cd-=dt;
      if(q.cd<=0){ q.cd=1.4+alive2*.5;
        if(alive2===1){ for(var k=-1;k<=1;k++) eshoot(WALLX+6,q.y,p.x,p.y-13,100,k*.22); }
        else eshoot(WALLX+6,q.y,p.x,p.y-13,92); } });
  }
  if(G.boss.done){ G.winT+=dt; if(G.winT>1.8){ finish(true); return; } }
  /* enemy bullets */
  for(i=G.eb.length-1;i>=0;i--){ b=G.eb[i]; b.x+=b.vx*dt; b.y+=b.vy*dt;
    if(b.x<G.cam-8||b.x>G.cam+VW+8||b.y<-8||b.y>VH+8){ G.eb.splice(i,1); continue; }
    if(p.dead<=0&&p.inv<=0&&Math.abs(b.x-p.x)<pw+2&&b.y>p.y-ph*2-2&&b.y<p.y+2){ G.eb.splice(i,1); die(); }
  }
  /* capsules and what they drop */
  for(i=G.caps.length-1;i>=0;i--){ var cc=G.caps[i]; cc.t+=dt; cc.x-=52*dt; cc.y=78+24*Math.sin(cc.t*2.1); if(cc.x<G.cam-24) G.caps.splice(i,1); }
  for(i=G.items.length-1;i>=0;i--){ var it=G.items[i]; it.vy+=GRAV*.5*dt; it.y+=it.vy*dt; if(it.y>GY-5){ it.y=GY-5; it.vy=0; }
    if(p.dead<=0&&Math.abs(it.x-p.x)<12&&Math.abs(it.y-pcy)<14){ G.items.splice(i,1); G.gun=1; addScore(100); banner("Spread shot. Five bullets, one button."); continue; }
    if(it.x<G.cam-12) G.items.splice(i,1); }
  for(i=G.bits.length-1;i>=0;i--){ var bt=G.bits[i]; bt.t+=dt; bt.vy+=GRAV*.6*dt; bt.x+=bt.vx*dt; bt.y+=bt.vy*dt; if(bt.t>.7) G.bits.splice(i,1); }
  p.ang+=dt*(p.face>0?1:-1)*16;
}

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement), dark=document.documentElement.getAttribute("data-theme")==="dark";
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  return {sky:v("--paper-3","#E9EDF7"),floor:v("--paper-2","#FFFFFF"),ink:v("--ink","#1F2023"),hatch:v("--line","rgba(31,32,35,.12)"),
    blue:v("--blue","#B94612"),blue2:v("--blue-2","#EA5E14"),peach:v("--wash-peach","#FBE6DD"),mint:v("--wash-mint","#D6F0E6"),muted:v("--muted","#5D5F65"),dark:dark};
}
new MutationObserver(function(){ pal=null; wake(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function fitNow(){
  var r=view.getBoundingClientRect(); if(!r.width) return;
  dprv=Math.min(window.devicePixelRatio||1,2); W=r.width; H=r.height;
  cv.width=Math.round(W*dprv); cv.height=Math.round(H*dprv); draw();
}
function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); }
function drawPlayer(P){
  var p=G.p; if(p.dead>0) return;
  ctx.save();
  if(p.inv>0){ if(calm()) ctx.globalAlpha=.55; else if(Math.floor(G.t*14)%2) ctx.globalAlpha=.3; }
  var gunc=G.gun?"#F0B429":P.ink;
  ctx.lineWidth=1.2; ctx.strokeStyle=P.ink; ctx.lineJoin="round"; ctx.lineCap="round";
  if(p.spin){
    ctx.translate(p.x,p.y-11); ctx.rotate(p.ang);
    rr(-7,-7,14,14,4); ctx.fillStyle=P.blue2; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(3,-2,1.6,0,TAU); ctx.fillStyle=P.peach; ctx.fill();
    ctx.rotate(-p.ang);
  } else if(p.prone){
    ctx.translate(p.x,p.y);
    rr(-9,-8,18,8,3); ctx.fillStyle=P.blue2; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.face*10,-6,4,0,TAU); ctx.fillStyle=P.peach; ctx.fill(); ctx.stroke();
    ctx.strokeStyle=gunc; ctx.lineWidth=2.6; ctx.beginPath(); ctx.moveTo(p.face*10,-4); ctx.lineTo(p.face*20,-4); ctx.stroke(); ctx.strokeStyle=P.ink; ctx.lineWidth=.9; ctx.stroke();
  } else {
    var sw=p.ground?Math.sin(p.step)*5:3;
    ctx.translate(p.x,p.y);
    ctx.lineWidth=3; ctx.strokeStyle=P.ink; ctx.beginPath(); ctx.moveTo(-2,-9); ctx.lineTo(-2+sw,0); ctx.moveTo(2,-9); ctx.lineTo(2-sw,0); ctx.stroke();
    ctx.lineWidth=1.2;
    rr(-5.5,-22,11,14,3); ctx.fillStyle=P.blue2; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,-26,4.6,0,TAU); ctx.fillStyle=P.peach; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,-27,4.8,Math.PI,TAU); ctx.fillStyle=P.ink; ctx.fill();
    ctx.beginPath(); ctx.arc(p.face*1.8,-25.5,.9,0,TAU); ctx.fillStyle=P.ink; ctx.fill();
    ctx.lineCap="round"; ctx.strokeStyle=gunc; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(p.ax*12,-16+p.ay*12); ctx.stroke();
    ctx.strokeStyle=P.ink; ctx.lineWidth=.9; ctx.stroke();
  }
  ctx.restore();
}
function drawEnemy(e,P){
  ctx.save(); ctx.translate(e.x,e.y); ctx.lineWidth=1.2; ctx.strokeStyle=P.ink; ctx.lineJoin="round";
  var flash=e.hit>0&&!calm();
  if(e.k==="run"){
    var sw=Math.sin(G.t*13+e.ph)*4;
    ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-2,-7); ctx.lineTo(-2+sw,0); ctx.moveTo(2,-7); ctx.lineTo(2-sw,0); ctx.stroke(); ctx.lineWidth=1.2;
    rr(-6,-20,12,14,2.5); ctx.fillStyle=flash?P.blue2:P.ink; ctx.fill(); ctx.stroke();
    ctx.fillStyle=P.floor; ctx.fillRect(-4.2+(e.face<0?-.8:.8),-16,2.6,2.6); ctx.fillRect(1.4+(e.face<0?-.8:.8),-16,2.6,2.6);
    ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(0,-24); ctx.stroke(); ctx.beginPath(); ctx.arc(0,-25,1.6,0,TAU); ctx.fillStyle=P.blue2; ctx.fill();
  } else if(e.k==="gun"){
    ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-2,-7); ctx.lineTo(-2,0); ctx.moveTo(2,-7); ctx.lineTo(2,0); ctx.stroke(); ctx.lineWidth=1.2;
    rr(-6,-20,12,14,2.5); ctx.fillStyle=flash?P.blue2:P.peach; ctx.fill(); ctx.stroke();
    ctx.fillStyle=P.ink; ctx.fillRect(e.face*2.2-1.3,-16,2.6,2.6);
    ctx.strokeStyle=P.ink; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(e.face*11,-13); ctx.stroke();
    ctx.fillStyle=P.ink; ctx.fillRect(-5,-24,10,3.4);
  } else {
    ctx.fillStyle=flash?P.blue2:P.ink; ctx.beginPath(); ctx.moveTo(-9,0); ctx.lineTo(-6,-8); ctx.lineTo(6,-8); ctx.lineTo(9,0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,-12,5,0,TAU); ctx.fillStyle=flash?P.blue2:P.ink; ctx.fill(); ctx.stroke();
    ctx.strokeStyle=P.ink; ctx.lineWidth=4.4; ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(e.ax*12,-12+e.ay*12); ctx.stroke();
    ctx.strokeStyle=P.floor; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle=P.blue2; ctx.beginPath(); ctx.arc(0,-12,1.8,0,TAU); ctx.fill();
  }
  ctx.restore();
}
function drawCap(x,y,P,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s); ctx.lineWidth=1.2; ctx.strokeStyle=P.ink;
  ctx.beginPath(); ctx.moveTo(-9,-1); ctx.lineTo(-14,-6); ctx.moveTo(9,-1); ctx.lineTo(14,-6); ctx.stroke();
  rr(-10,-6,20,12,5); ctx.fillStyle=P.floor; ctx.fill(); ctx.stroke();
  ctx.fillStyle=P.blue; ctx.font="700 9px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("S",0,.5);
  ctx.restore();
}
function drawBoss(P,k){
  var B=G.boss, x=WALLX, top=26, h=GY-top;
  ctx.save(); ctx.lineWidth=1.4; ctx.strokeStyle=P.ink;
  rr(x,top,120,h,5); /* body runs off the right edge of the view */
  ctx.fillStyle=B.done?P.muted:P.ink; ctx.fill();
  ctx.globalAlpha=.28; ctx.strokeStyle=P.floor; ctx.lineWidth=1;
  for(var i=0;i<9;i++){ ctx.beginPath(); ctx.moveTo(x+44,top+10+i*15); ctx.lineTo(x+86,top+10+i*15); ctx.stroke(); }
  ctx.globalAlpha=1;
  ctx.fillStyle=P.floor; ctx.font="700 8px 'JetBrains Mono',monospace"; ctx.textAlign="left"; ctx.textBaseline="middle";
  if(k>=1.1) ctx.fillText("LEGACY",x+44,top+8);
  for(var j=0;j<3;j++){ var q=B.pts[j], flash=q.hit>0&&!calm();
    ctx.beginPath(); ctx.arc(x+14,q.y,12,0,TAU); ctx.fillStyle=q.dead?P.muted:flash?P.floor:P.blue2; ctx.fill(); ctx.lineWidth=1.6; ctx.strokeStyle=P.floor; ctx.stroke();
    if(!q.dead){ ctx.beginPath(); ctx.arc(x+14,q.y,5,0,TAU); ctx.fillStyle=P.ink; ctx.globalAlpha=.25; ctx.fill(); ctx.globalAlpha=1; }
    if(k>=1.1){ ctx.fillStyle=P.floor; ctx.font="700 7px 'JetBrains Mono',monospace"; ctx.fillText(q.dead?"off":q.name,x+30,q.y+1); }
  }
  ctx.restore();
}
function draw(){
  if(!G||!W) return;
  if(!pal) pal=palette();
  var P=pal, k=cv.width/VW, i;
  ctx.setTransform(k,0,0,k,0,0); ctx.clearRect(0,0,VW,VH);
  ctx.fillStyle=P.sky; ctx.fillRect(0,0,VW,VH);
  var cam=Math.floor(G.cam*10)/10;
  /* far racks, slow parallax: a server room that never got decommissioned */
  ctx.fillStyle=P.hatch;
  var f0=Math.floor(cam*.35/64);
  for(i=f0-1;i<f0+8;i++){ var fh=46+((i*37)%5)*14, fx=i*64-cam*.35; ctx.fillRect(fx,GY-fh,40,fh);
    ctx.fillStyle=P.sky; for(var r=0;r<4;r++) ctx.fillRect(fx+5,GY-fh+8+r*10,30,2); ctx.fillStyle=P.hatch; }
  ctx.save(); ctx.translate(-cam,0);
  /* ground */
  ctx.fillStyle=P.floor; ctx.fillRect(cam-2,GY,VW+4,VH-GY);
  ctx.strokeStyle=P.hatch; ctx.lineWidth=1; ctx.beginPath();
  for(var gx=Math.floor(cam/24)*24;gx<cam+VW+24;gx+=24){ ctx.moveTo(gx,GY+6); ctx.lineTo(gx-8,GY+16); ctx.moveTo(gx+10,GY+22); ctx.lineTo(gx+2,GY+34); } ctx.stroke();
  ctx.strokeStyle=P.ink; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(cam-2,GY); ctx.lineTo(cam+VW+2,GY); ctx.stroke();
  /* platforms */
  for(i=0;i<PLATS.length;i++){ var pl=PLATS[i]; if(pl.x>cam+VW||pl.x+pl.w<cam) continue;
    ctx.fillStyle=P.floor; ctx.strokeStyle=P.ink; ctx.lineWidth=1.4; rr(pl.x,pl.y,pl.w,6,2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle=P.hatch; ctx.beginPath(); for(var tx=pl.x+8;tx<pl.x+pl.w-4;tx+=12){ ctx.moveTo(tx,pl.y+6); ctx.lineTo(tx-3,pl.y+13); } ctx.stroke(); }
  if(G.boss.on||G.cam>=ARENA-VW) drawBoss(P,k);
  for(i=0;i<G.en.length;i++){ var e=G.en[i]; if(e.x>cam-20&&e.x<cam+VW+20) drawEnemy(e,P); }
  for(i=0;i<G.caps.length;i++) drawCap(G.caps[i].x,G.caps[i].y,P,1);
  for(i=0;i<G.items.length;i++) drawCap(G.items[i].x,G.items[i].y,P,.8);
  drawPlayer(P);
  /* bullets: yours are amber, theirs are dark with an orange core */
  ctx.lineWidth=.9; ctx.strokeStyle=P.ink;
  for(i=0;i<G.bul.length;i++){ var b=G.bul[i]; ctx.beginPath(); ctx.arc(b.x,b.y,2.4,0,TAU); ctx.fillStyle="#F0B429"; ctx.fill(); ctx.stroke(); }
  for(i=0;i<G.eb.length;i++){ var q=G.eb[i]; ctx.beginPath(); ctx.arc(q.x,q.y,3.4,0,TAU); ctx.fillStyle=P.ink; ctx.fill(); ctx.beginPath(); ctx.arc(q.x,q.y,1.7,0,TAU); ctx.fillStyle=P.blue2; ctx.fill(); }
  for(i=0;i<G.bits.length;i++){ var t=G.bits[i]; ctx.globalAlpha=Math.max(0,1-t.t/.7); ctx.fillStyle=t.c==="o"?P.blue2:t.c==="a"?"#F0B429":P.ink; ctx.fillRect(t.x,t.y,t.s,t.s); }
  ctx.globalAlpha=1;
  ctx.restore();
  /* GO: when the screen is clear, the eye is told where to look */
  if(mode==="play"&&!G.boss.on&&G.p.dead<=0){
    var busy=false; for(i=0;i<G.en.length;i++){ if(G.en[i].k!=="tur"&&G.en[i].x>G.cam&&G.en[i].x<G.cam+VW) busy=true; }
    if(!busy&&(calm()||Math.floor(G.t*2.5)%2===0)){ ctx.fillStyle=P.blue; ctx.font="700 11px 'JetBrains Mono',monospace"; ctx.textAlign="right"; ctx.textBaseline="middle"; ctx.fillText("GO >",VW-10,GY-70); }
  }
  if(G.msgT>0&&mode==="play"){
    ctx.font="600 10px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
    var mw=ctx.measureText(G.msg).width+18; rr(VW/2-mw/2,14,mw,20,10); ctx.fillStyle=P.floor; ctx.fill(); ctx.strokeStyle=P.ink; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle=P.ink; ctx.fillText(G.msg,VW/2,24.5);
  }
}

/* ---------- loop, visibility, resize ---------- */
function frame(ts){
  raf=0; if(!vis) return;
  if(mode==="play"){
    if(!last) last=ts; var el2=Math.min(.1,(ts-last)/1000); last=ts; acc+=el2;
    var n=0; while(acc>=STEP&&n<24&&mode==="play"){ step(STEP); acc-=STEP; n++; } if(n>=24) acc=0;
  }
  draw(); hud();
  if(vis&&mode==="play") raf=requestAnimationFrame(frame);
}
function wake(){ if(!raf&&vis&&mode==="play"){ last=0; raf=requestAnimationFrame(frame); } draw(); hud(); }
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fitNow(); wake(); } else if(mode==="play") pause("The board left the screen, so the clock stopped."); },{threshold:.15}).observe(view);
document.addEventListener("visibilitychange",function(){ if(document.hidden&&mode==="play") pause(); });
var rz=0; window.addEventListener("resize",function(){ cancelAnimationFrame(rz); rz=requestAnimationFrame(fitNow); });
if(window.ResizeObserver) new ResizeObserver(function(){ fitNow(); }).observe(view);
if(mq.addEventListener) mq.addEventListener("change",function(){ G.bits.length=0; wake(); });

/* ---------- boot ---------- */
newRun();
})();
