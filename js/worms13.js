/* K13 Turf 13: turn-based artillery on destructible terrain, built on the workbench card anatomy.
   Your two units (the K and the 3) against two stock templates (Template and Scope creep). One match, alternating turns,
   a 20 second clock, wind that changes every turn, two weapons (bazooka, grenade with a 3 second fuse).
   The terrain is a bitmask plus an offscreen canvas; every blast clears a circle from both (destination-out) and re-lights the new edge.
   Fixed 120 Hz step behind an accumulator, devicePixelRatio-crisp canvas (capped at 2), the loop stops while the card is off screen
   or the tab is hidden, and the clock waits whenever the board has neither focus nor the pointer on the player's turn.
   prefers-reduced-motion: no screen shake, no particles, no flash, the camera cuts instead of gliding. Still fully playable.
   Keyboard (canvas focused): Left/Right walk, Up/Down aim, Enter jumps, Backspace flips back, Space fires (tap repeats the last power,
   hold charges), 1/2 pick the weapon, [ and ] set power. Drag on the board to aim and let go to fire.
   Every control also exists as a real labelled button. The physics and the CPU sit above the DOM section and touch no DOM. */
(function(){
"use strict";

/* ====================================================== SIM-BEGIN ====================================================== */
var WW=1400, WH=460, WATER=424, G=400, DT=1/120, WIND_K=8, WALK=46, TURN=20, FALL_V=300;
var WEAP={
  bz:{name:"Bazooka",R:40,dmg:50,kb:270,wk:1,fuse:0},
  gr:{name:"Grenade",R:48,dmg:46,kb:290,wk:.4,fuse:3}
};
var BODY=[[-6,-7],[6,-7],[-6,0],[6,0],[-6,6],[6,6],[0,-8],[-4,8],[4,8]];
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function rnd(){ return Math.random(); }

/* ---- terrain: one bit per pixel, plus the canvas that shows it ---- */
var mask=new Uint8Array(WW*WH), hs=new Array(WW);
var tc=document.createElement("canvas"); tc.width=WW; tc.height=WH;
var tctx=tc.getContext("2d",{willReadFrequently:true});
var tDark=false;
var TCOL={light:{body:[201,154,98],rim:[236,196,134]},dark:{body:[132,96,62],rim:[186,136,84]}};
function solid(x,y){
  if(x<0||x>=WW||y<0) return false;
  if(y>=WH) return true;
  return mask[(y|0)*WW+(x|0)]===1;
}
function genTerrain(){
  var s1=rnd()*6, s2=rnd()*6, s3=rnd()*6, amp=1+rnd()*.3, x, y;
  for(x=0;x<WW;x++){
    var h=275+42*Math.sin(x/190+s1)*amp+24*Math.sin(x/83+s2)+11*Math.sin(x/37+s3);
    var e=Math.min(x,WW-1-x)/190;
    if(e<1){ e=e*e*(3-2*e); h=h*e+(WATER-6)*(1-e); }
    hs[x]=Math.round(h);
    for(y=0;y<WH;y++) mask[y*WW+x]=y>=hs[x]?1:0;
  }
}
function paintRect(x0,y0,x1,y1,full){
  x0=Math.max(0,Math.floor(x0)); y0=Math.max(0,Math.floor(y0)); x1=Math.min(WW,Math.ceil(x1)); y1=Math.min(WH,Math.ceil(y1));
  var w=x1-x0, h=y1-y0; if(w<=0||h<=0) return;
  var im=full?tctx.createImageData(w,h):tctx.getImageData(x0,y0,w,h), d=im.data, C=tDark?TCOL.dark:TCOL.light, x, y;
  for(y=y0;y<y1;y++){
    for(x=x0;x<x1;x++){
      var mi=y*WW+x, di=((y-y0)*w+(x-x0))*4;
      if(!mask[mi]){ if(full){ d[di]=d[di+1]=d[di+2]=d[di+3]=0; } continue; }
      var rim=(x>0&&!mask[mi-1])||(x<WW-1&&!mask[mi+1]);
      for(var q=1;q<=3&&!rim;q++){ if(y-q<0||!mask[mi-q*WW]) rim=true; }
      var n=(((x*73856093)^(y*19349663))>>>0)%9-4, sh=1-.38*clamp((y-170)/280,0,1), c=rim?C.rim:C.body, k=rim?1:sh;
      d[di]=clamp(c[0]*k+n,0,255); d[di+1]=clamp(c[1]*k+n,0,255); d[di+2]=clamp(c[2]*k+n,0,255);
      if(full) d[di+3]=255;
    }
  }
  tctx.putImageData(im,x0,y0);
}
function carve(cx,cy,R){
  var x0=Math.max(0,Math.floor(cx-R)), x1=Math.min(WW-1,Math.ceil(cx+R)), y0=Math.max(0,Math.floor(cy-R)), y1=Math.min(WH-1,Math.ceil(cy+R)), r2=R*R, x, y;
  for(y=y0;y<=y1;y++){ for(x=x0;x<=x1;x++){ var dx=x+.5-cx, dy=y+.5-cy; if(dx*dx+dy*dy<=r2) mask[y*WW+x]=0; } }
  tctx.save(); tctx.globalCompositeOperation="destination-out"; tctx.beginPath(); tctx.arc(cx,cy,R,0,6.2832); tctx.fill(); tctx.restore();
  paintRect(x0-4,y0-4,x1+5,y1+5,false);
}

/* ---- units ---- */
function mkUnit(team,idx,name,x){
  var u={team:team,idx:idx,name:name,x:x,y:0,vx:0,vy:0,hp:100,face:team?-1:1,ground:false,walk:false,dead:false,gone:false,fade:0,hurt:0};
  var y=0; while(y<WH&&!ubody(x,y+1)) y++;
  u.y=y; u.ground=true; return u;
}
function ubody(x,y){ for(var i=0;i<BODY.length;i++){ if(solid(x+BODY[i][0],y+BODY[i][1])) return true; } return false; }
function physUnit(u,dt,hooks){
  var s;
  if(u.ground){
    if(u.walk) u.vx=u.face*WALK; else { u.vx*=Math.exp(-9*dt); if(Math.abs(u.vx)<3) u.vx=0; }
  }
  if(u.vx){
    var nx=u.x+u.vx*dt;
    if(!ubody(nx,u.y)) u.x=nx;
    else{
      var ok=false;
      for(s=1;s<=6;s++){ if(!ubody(nx,u.y-s)){ u.x=nx; u.y-=s; ok=true; break; } }
      if(!ok) u.vx=u.ground?0:-u.vx*.3;
    }
  }
  if(u.ground&&u.walk&&!ubody(u.x,u.y+1)){ for(s=2;s<=6;s++){ if(ubody(u.x,u.y+s)){ u.y+=s-1; break; } } }
  u.vy+=G*dt;
  var dy=u.vy*dt, n, sd, i;
  if(dy>0){
    n=Math.ceil(dy); sd=dy/n;
    for(i=0;i<n;i++){
      if(ubody(u.x,u.y+sd)){
        if(u.vy>FALL_V&&hooks) hooks.fall(u,Math.round((u.vy-FALL_V)*.12));
        u.vy=0; if(!u.ground) u.vx*=.4; break;
      }
      u.y+=sd;
    }
  } else if(dy<0){
    n=Math.ceil(-dy); sd=dy/n;
    for(i=0;i<n;i++){ if(ubody(u.x,u.y+sd)){ u.vy=0; break; } u.y+=sd; }
  }
  u.ground=ubody(u.x,u.y+1);
  if(u.hurt>0) u.hurt=Math.max(0,u.hurt-dt);
}

/* ---- projectiles: returns 0 flying, 1 explodes where it is, 2 lost to the water or the edge of the world ---- */
function stepProj(p,dt,wind,units){
  var W=WEAP[p.w];
  p.vy+=G*dt; p.vx+=wind*WIND_K*W.wk*dt; p.age+=dt;
  var dx=p.vx*dt, dy=p.vy*dt, n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/2)), sx=dx/n, sy=dy/n, i, j;
  for(i=0;i<n;i++){
    var nx=p.x+sx, ny=p.y+sy;
    if(solid(nx,ny)){
      if(p.w==="bz"){ p.x=nx; p.y=ny; return 1; }
      var bx=0, by=0, ox, oy;
      for(oy=-3;oy<=3;oy++){ for(ox=-3;ox<=3;ox++){ if(!solid(nx+ox,ny+oy)){ bx+=ox; by+=oy; } } }
      var bl=Math.hypot(bx,by); if(bl<.001){ bx=0; by=-1; } else { bx/=bl; by/=bl; }
      var vn=p.vx*bx+p.vy*by;
      if(vn<0){ var e=-vn<45?0:.5; p.vx-=(1+e)*vn*bx; p.vy-=(1+e)*vn*by; p.vx*=.88; p.bounced=true; }
      break;
    }
    p.x=nx; p.y=ny;
    if(units&&p.w==="bz"){
      for(j=0;j<units.length;j++){
        var u=units[j]; if(u.gone||u.dead) continue;
        if(u===p.owner&&p.age<.25) continue;
        if(Math.hypot(u.x-p.x,u.y-p.y)<9) return 1;
      }
    }
    if(p.y>WATER+6||p.x<-80||p.x>WW+80) return 2;
  }
  if(p.w==="gr"){ p.fuse-=dt; if(p.fuse<=0) return 1; }
  return 0;
}
function muzzle(u,a){ var ar=a*Math.PI/180; return {x:u.x+Math.cos(ar)*u.face*12,y:u.y-2-Math.sin(ar)*12,dx:Math.cos(ar)*u.face,dy:-Math.sin(ar)}; }
function mkProj(wk,u,a,pw){
  var m=muzzle(u,a), sp=120+600*pw;
  return {w:wk,x:m.x,y:m.y,vx:m.dx*sp,vy:m.dy*sp,fuse:WEAP[wk].fuse,age:0,owner:u,bounced:false};
}
function simShot(wk,u,a,pw,wind){
  var p=mkProj(wk,u,a,pw);
  for(var i=0;i<900;i++){ var r=stepProj(p,DT,wind,null); if(r===1) return p; if(r===2) return null; }
  return p;
}

/* ---- the CPU: a plain search over weapon, angle and power, then a deliberate slip so it can be beaten ---- */
function cpuPlan(u,foes,mates,wind){
  var t=foes[0], i, best=null, wk, a, pw;
  for(i=1;i<foes.length;i++){ if(foes[i].hp<t.hp) t=foes[i]; }
  var face=t.x>=u.x?1:-1, keep=u.face; u.face=face;
  for(wk in WEAP){
    for(a=-25;a<=85;a+=5){
      for(pw=.2;pw<=1.001;pw+=.04){
        var r=simShot(wk,u,a,pw,wind), sc;
        if(!r) continue;
        sc=Math.hypot(r.x-t.x,r.y-(t.y-2));
        if(Math.hypot(r.x-u.x,r.y-u.y)<WEAP[wk].R+14) sc+=300;
        for(var m=0;m<mates.length;m++){ if(mates[m]!==u&&!mates[m].dead&&Math.hypot(r.x-mates[m].x,r.y-mates[m].y)<WEAP[wk].R+6) sc+=200; }
        if(!best||sc<best.score) best={wk:wk,a:a,p:pw,face:face,score:sc,target:t};
      }
    }
  }
  u.face=keep;
  if(!best) best={wk:"bz",a:40,p:.6,face:face,score:999,target:t};
  return best;
}
/* ======================================================= SIM-END ======================================================= */

/* ============================================================ the card, the canvas, the controls ============================================================ */
var mount=document.querySelector('[data-game="worms13"]');
if(!mount) return;
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }

mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Turf 13")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Two of yours against two stock templates. Aim, hold to charge, let go. Dig them out before the clock does."); instr.id="tf-i"; mount.appendChild(instr);
var stage=el("div","wb-stage tf-stage"); stage.setAttribute("aria-describedby","tf-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Restart</span>');
reset.type="button"; reset.setAttribute("aria-label","Start a new match on new ground"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Left and Right walk, Up and Down aim, Enter jumps, Backspace flips back. Hold Space to charge, tap it to repeat your last power. 1 and 2 pick the weapon, [ and ] set power, M shows the whole map, minus and plus zoom. Or drag on the board and let go. Wins are kept on this device."));
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var view=el("div","tf-view"); stage.appendChild(view);
var cv=el("canvas","tf-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Turf 13 game board. Arrow keys walk and aim, Space fires, or drag on the board to aim and let go to fire.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var hud=el("div","tf-hud");
var hTurn=txt("span","tf-chip",""), hWind=txt("span","tf-chip",""), hHp=txt("span","tf-chip",""), hRec=txt("span","tf-chip tf-rec","");
hud.appendChild(hTurn); hud.appendChild(hWind); hud.appendChild(hHp); hud.appendChild(hRec); view.appendChild(hud);
var over=el("div","tf-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Match result"); view.appendChild(over);

var bar=el("div","tf-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Turf 13 controls"); stage.appendChild(bar);
function btn(label,aria,cls){ var b=txt("button","tf-btn "+(cls||""),label); b.type="button"; if(aria) b.setAttribute("aria-label",aria); return b; }
function grp(label,aria){ var g=el("div","tf-grp"); g.setAttribute("role","group"); g.setAttribute("aria-label",aria||label); if(label) g.appendChild(txt("span","tf-lab",label)); bar.appendChild(g); return g; }
var mvG=grp("Move","Move"), bL=btn("◀","Walk left"), bR=btn("▶","Walk right"), bJ=btn("Jump","Jump forward"), bF=btn("Flip","High jump backward");
mvG.appendChild(bL); mvG.appendChild(bR); mvG.appendChild(bJ); mvG.appendChild(bF);
var anG=grp("Angle","Angle"), aDn=btn("−","Aim down"), aUp=btn("+","Aim up"), aOut=txt("span","tf-val","");
anG.appendChild(aDn); anG.appendChild(aOut); anG.appendChild(aUp);
var pwG=grp("Power","Power"), pDn=btn("−","Less power"), pUp=btn("+","More power"), pOut=txt("span","tf-val","");
pwG.appendChild(pDn); pwG.appendChild(pOut); pwG.appendChild(pUp);
var wpG=grp("","Weapon"), wBz=btn("Bazooka","Bazooka, explodes on impact"), wGr=btn("Grenade","Grenade, bounces, three second fuse");
wpG.appendChild(wBz); wpG.appendChild(wGr);
var vwG=grp("View","View"), zOut=btn("−","Zoom out, now Near"), zIn=btn("+","Zoom in, now Near"), zOutV=txt("span","tf-val","Near");
vwG.appendChild(zOut); vwG.appendChild(zOutV); vwG.appendChild(zIn); zIn.disabled=true;
var fireBtn=btn("Fire (hold)","Fire. Tap to repeat the last power, hold to charge.","tf-fire"); bar.appendChild(fireBtn);

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store("k13_worms13")||"null"); if(s&&typeof s.w==="number"&&typeof s.l==="number") return s; }catch(e){} return {w:0,l:0}; })();
function persist(){ store("k13_worms13",JSON.stringify(save)); }
var units=[], projs=[], parts=[], pops=[], S=null;
var aim={a:38,p:.6,w:"bz"}, cAim={a:38,p:.6,w:"bz"}, chg={on:false,t:0,prev:.6,src:""}, cpu={st:"think",t:0,plan:null,walkT:0,walks:0};
var hold={l:false,r:false}, kb={l:false,r:false}, dragging=false, dragP=0, pulse=0, engaged=false;
var W=0,H=0,ppu=1,visW=1400,visH=330,zi=0,camX=0,camY=54,camY0=54,VISH=330,vis=false,on=false,raf=0,acc=0,last=0,shake=0,flash=null,pal=null,dprv=1,sig="",hsig="",clock=0;
var NAMES=[["K","3"],["Template","Scope creep"]];

function cur(){ return S&&S.team===1?cAim:aim; }
function act(){ return S?units[S.ui]:null; }
function alive(team){ return units.filter(function(u){ return u.team===team&&!u.dead; }); }
function teamHp(team){ return units.filter(function(u){ return u.team===team; }).reduce(function(s,u){ return s+u.hp; },0); }
function canAct(){ var u=act(); return !!S&&S.phase==="aim"&&S.team===0&&!!u&&u.ground&&!u.dead; }

var hooks={fall:function(u,d){ if(d>0){ hurtUnit(u,d); S.round.push(u.name+" takes "+d+" from the fall"); } }};
function hurtUnit(u,d){
  u.hp=Math.max(0,u.hp-d); u.hurt=.35; pops.push({x:u.x,y:u.y-14,t:0,s:"-"+d});
  if(u.hp<=0&&!u.dead){ u.dead=true; S.out.push(u.name); }
}
function sinkUnit(u){
  u.gone=true; if(!u.dead){ u.dead=true; S.out.push(u.name); } u.hp=0;
  if(!calm()) splash(u.x,WATER);
}
function splash(x,y){ for(var i=0;i<10&&parts.length<160;i++){ parts.push({x:x,y:y,vx:(rnd()-.5)*140,vy:-80-rnd()*160,life:.8,t:0,c:"rgba(160,205,205,.9)",s:3+rnd()*2,g:1}); } }

/* ---------- a match ---------- */
function newMatch(announce){
  genTerrain(); tDark=!!(pal&&pal.dark); paintRect(0,0,WW,WH,true);
  units=[
    mkUnit(0,0,NAMES[0][0],230+rnd()*60), mkUnit(0,1,NAMES[0][1],470+rnd()*70),
    mkUnit(1,0,NAMES[1][0],900+rnd()*70), mkUnit(1,1,NAMES[1][1],1130+rnd()*60)
  ];
  projs.length=0; parts.length=0; pops.length=0; shake=0; flash=null; over.hidden=true; over.innerHTML="";
  S={phase:"aim",team:1,ui:0,last:[-1,-1],wind:0,timer:TURN,projs:projs,settleT:0,round:[],out:[],focus:{x:0,y:0},ended:false};
  startTurn(announce);
  camX=clamp(S.focus.x-visW/2,0,Math.max(0,WW-visW)); camY=camY0; sig=""; hsig="";
}
function startTurn(announce){
  S.team=1-S.team;
  var list=units.filter(function(u){ return u.team===S.team&&!u.dead; }), i, pick=null;
  for(i=1;i<=2;i++){ var idx=(S.last[S.team]+i+2)%2, c=units.filter(function(u){ return u.team===S.team&&u.idx===idx&&!u.dead; })[0]; if(c){ pick=c; break; } }
  if(!pick) pick=list[0];
  S.ui=units.indexOf(pick); S.last[S.team]=pick.idx;
  S.phase="aim"; S.timer=TURN; S.wind=Math.round(rnd()*10-5); S.round=[]; S.out=[]; S.projs.length=0; S.settleT=0;
  S.focus={x:pick.x,y:pick.y}; chg.on=false;
  pick.walk=false;
  if(S.team===1){ cpu.st="think"; cpu.t=0; cpu.plan=null; cpu.walks=0; cpu.walkT=0; cAim.a=30; cAim.p=.5; cAim.w="bz"; }
  var wd=S.wind===0?"No wind.":"Wind "+Math.abs(S.wind)+" to the "+(S.wind<0?"left":"right")+".";
  if(announce!==false){
    if(S.team===0) say("Your turn, "+pick.name+". "+wd+" "+TURN+" seconds. Click the board to start the clock.");
    else say(pick.name+" is lining one up. "+wd);
  } else if(S.team===0) say("Turf 13. Your turn, "+pick.name+". "+wd+" Click the board or press Space to start the clock.");
}

/* ---------- acting ---------- */
function fireNow(u,wk,a,p){
  var pr=mkProj(wk,u,a,p); S.projs.push(pr); S.phase="fly"; chg.on=false; dragging=false; u.walk=false;
  if(S.team===0){ aim.p=p; }
  S.focus={x:pr.x,y:pr.y};
  if(S.team===0) say(WEAP[wk].name+" away, "+Math.round(a)+" degrees, "+Math.round(p*100)+" percent.");
}
function explode(p){
  var W2=WEAP[p.w], i;
  carve(p.x,p.y,W2.R);
  if(!calm()){
    for(i=0;i<16&&parts.length<160;i++){ var an=rnd()*6.28, sp=60+rnd()*220; parts.push({x:p.x,y:p.y,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp-90,life:.7+rnd()*.5,t:0,c:rnd()<.5?"#C99A62":"#8A6A44",s:2+rnd()*3,g:1}); }
    for(i=0;i<6&&parts.length<160;i++){ var a2=rnd()*6.28; parts.push({x:p.x,y:p.y,vx:Math.cos(a2)*40,vy:Math.sin(a2)*40-30,life:.9,t:0,c:"rgba(120,120,125,.55)",s:5+rnd()*4,g:-.2}); }
    flash={x:p.x,y:p.y,r:W2.R,t:0}; shake=Math.min(.35,.25);
  }
  var hit=0;
  for(i=0;i<units.length;i++){
    var u=units[i]; if(u.gone) continue;
    var dx=u.x-p.x, dy=(u.y-2)-p.y, d=Math.hypot(dx,dy), reach=W2.R+12;
    if(d>=reach) continue;
    var f=1-d/reach, dm=Math.max(1,Math.round(W2.dmg*f)), ny=d>.01?dy/d:-1, nx=d>.01?dx/d:0;
    if(!u.dead){ hurtUnit(u,dm); S.round.push(u.name+" takes "+dm); hit++; }
    u.vx=nx*W2.kb*f*1.1; u.vy=Math.min(ny*.8-.45,-.2)*W2.kb*f; u.y-=1; u.ground=false; u.walk=false;
  }
  S.focus={x:p.x,y:p.y};
  if(!hit) S.round.push("Nobody hurt. The dirt took it");
}
function endAimNoShot(msg){ chg.on=false; dragging=false; var u=act(); if(u) u.walk=false; S.phase="settle"; S.settleT=.5; say(msg); }

function step(dt){
  var i, u=act();
  clock+=dt;
  if(S.phase==="aim"&&u){
    if(S.team===0){
      var wd=(kb.l||hold.l?-1:0)+(kb.r||hold.r?1:0);
      if(pulse>0){ pulse-=dt; }
      if(wd===0&&pulse>0) wd=pulse>0?(S.pulseDir||0):0;
      if(wd!==0&&u.ground&&!dragging){ u.face=wd; u.walk=true; } else u.walk=false;
      if(chg.on){
        chg.t+=dt;
        if(chg.t>.18){ aim.p=clamp(.05+(chg.t-.18)/1.3,.05,1); }
        if(aim.p>=1&&chg.t>.18){ fireNow(u,aim.w,aim.a,1); }
      }
      if(engaged||chg.on||dragging) S.timer-=dt;
    } else {
      S.timer-=dt;
      cpuStep(u,dt);
    }
    if(S.phase==="aim"&&S.timer<=0) endAimNoShot(S.team===0?"Time. The turn passes.":"The creep ran out of clock.");
  }
  for(i=0;i<units.length;i++){
    var q=units[i]; if(q.gone) continue;
    if(q!==u||S.phase!=="aim") q.walk=false;
    physUnit(q,dt,hooks);
    if(q.y>WATER+2||q.x<-60||q.x>WW+60) sinkUnit(q);
    else if(q.dead&&q.ground){ q.fade+=dt; if(q.fade>1.2) q.gone=true; }
  }
  if(S.phase==="fly"){
    for(i=S.projs.length-1;i>=0;i--){
      var p=S.projs[i], r=stepProj(p,dt,S.wind,units);
      S.focus={x:p.x,y:p.y};
      if(r===1){ S.projs.splice(i,1); explode(p); }
      else if(r===2){ S.projs.splice(i,1); if(!calm()&&p.y>WATER) splash(p.x,WATER); S.round.push("Lost to the sea"); }
    }
    if(!S.projs.length){ S.phase="settle"; S.settleT=0; }
  } else if(S.phase==="settle"){
    S.settleT+=dt;
    var calmU=units.every(function(z){ return z.gone||z.ground; });
    if((S.settleT>.9&&calmU)||S.settleT>8) finishTurn();
  }
}
function finishTurn(){
  if(S.team===0){ /* keep the player's own pick for next time */ }
  var a0=alive(0).length, a1=alive(1).length;
  var msg=S.round.length?S.round.join(". ")+".":"";
  if(S.out.length) msg+=" "+S.out.map(function(n){ return n+" is out."; }).join(" ");
  if(!a0||!a1){ endMatch(a0,a1,msg); return; }
  startTurn(false);
  var wd=S.wind===0?"No wind.":"Wind "+Math.abs(S.wind)+" to the "+(S.wind<0?"left":"right")+".";
  var nu=act();
  say((msg?msg.trim()+" ":"")+(S.team===0?"Your turn, "+nu.name+". "+wd+" "+TURN+" seconds.":nu.name+" is lining one up. "+wd));
}
function endMatch(a0,a1,msg){
  S.phase="over"; var won=a0>0&&a1===0, draw=!a0&&!a1;
  if(!draw){ if(won) save.w++; else save.l++; persist(); }
  var t=draw?"Nobody left":won?"Scope contained":"Scope creep wins";
  var s=draw?"Both teams went in the sea. Call it a draw, nobody filed a bug.":won?"Both templates are out. The brief survived.":"Your team is gone. The brief now has a few extra features.";
  say((msg?msg.trim()+" ":"")+t+". "+s);
  over.innerHTML=""; var panel=el("div","tf-panel"), h=txt("h4","tf-over-t",t), sub=txt("p","tf-over-s",s+" Record "+save.w+" won, "+save.l+" lost."), row=el("div","tf-over-row");
  var b=txt("button","tf-obtn","Play again"); b.type="button"; b.addEventListener("click",function(){ newMatch(true); focusBoard(); wake(); }); row.appendChild(b);
  panel.appendChild(h); panel.appendChild(sub); panel.appendChild(row); over.appendChild(panel); over.hidden=false;
  setTimeout(function(){ try{ b.focus({preventScroll:true}); }catch(x){} },30);
}

/* ---------- the CPU's turn ---------- */
function cpuStep(u,dt){
  cpu.t+=dt;
  if(cpu.st==="think"){
    if(cpu.t>.9){
      var foes=alive(0); if(!foes.length) return;
      cpu.plan=cpuPlan(u,foes,units.filter(function(z){ return z.team===1; }),S.wind);
      if(cpu.plan.score>70&&cpu.walks<2&&u.ground){ cpu.st="walk"; cpu.walkT=.45+rnd()*.5; cpu.walks++; u.face=cpu.plan.target.x>=u.x?1:-1; }
      else{
        cpu.st="aim"; cpu.t=0; u.face=cpu.plan.face; cAim.w=cpu.plan.wk;
        cpu.shotA=cpu.plan.a+(rnd()-.5)*2*3.5; cpu.shotP=clamp(cpu.plan.p*(1+(rnd()-.5)*2*.07),.1,1);
        say(u.name+" picks the "+WEAP[cpu.plan.wk].name.toLowerCase()+".");
      }
    }
  } else if(cpu.st==="walk"){
    u.walk=true; cpu.walkT-=dt;
    if(cpu.walkT<=0){ u.walk=false; cpu.st="think"; cpu.t=.5; }
  } else if(cpu.st==="aim"){
    var d=cpu.shotA-cAim.a, mv=70*dt;
    if(Math.abs(d)<=mv) cAim.a=cpu.shotA; else cAim.a+=d>0?mv:-mv;
    if(cpu.t>.7&&cAim.a===cpu.shotA){ cpu.st="charge"; cpu.t=0; cAim.p=.05; }
  } else if(cpu.st==="charge"){
    cAim.p=Math.min(cpu.shotP,.05+cpu.t/1.0);
    if(cAim.p>=cpu.shotP){ fireNow(u,cAim.w,cAim.a,cpu.shotP); }
  }
}

/* ---------- player input ---------- */
function setWeapon(w){ if(!S||S.team!==0||S.phase!=="aim") return; aim.w=w; say(WEAP[w].name+". "+(w==="gr"?"Bounces, then a 3 second fuse.":"Explodes on impact.")); sig=""; wake(); }
function nudgeA(da){ if(!canAct()) return; aim.a=clamp(aim.a+da,-60,85); sig=""; wake(); }
function nudgeP(dp){ if(!canAct()||chg.on) return; aim.p=clamp(aim.p+dp,.05,1); sig=""; wake(); }
function jump(back){
  var u=act(); if(!canAct()) return;
  if(back){ u.vy=-260; u.vx=-u.face*40; } else { u.vy=-170; u.vx=u.face*70; }
  u.ground=false; u.y-=1; say(back?"High jump back.":"Jump."); wake();
}
function startCharge(src){ if(!canAct()||chg.on) return; chg.on=true; chg.src=src; chg.t=0; chg.prev=aim.p; wake(); }
function releaseCharge(){
  if(!chg.on) return; var u=act(); chg.on=false;
  if(!canAct()) return;
  if(chg.t<=.18) aim.p=chg.prev;
  fireNow(u,aim.w,aim.a,aim.p); wake();
}
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function worldAt(e){ var r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*(W/(r.width||1))/ppu+camX, y:(e.clientY-r.top)*(H/(r.height||1))/ppu+camY}; }
function dragTo(pt){
  var u=act(), dx=pt.x-u.x, dy=pt.y-(u.y-2), L=Math.hypot(dx,dy);
  if(Math.abs(dx)>4) u.face=dx>=0?1:-1;
  aim.a=clamp(Math.atan2(-dy,Math.abs(dx))*180/Math.PI,-60,85); aim.p=clamp(L/180,.1,1); dragP=L; sig="";
}
cv.addEventListener("pointerdown",function(e){
  if(e.button>0) return; try{ cv.focus({preventScroll:true}); }catch(x){}
  if(!canAct()) return; e.preventDefault();
  dragging=true; try{ cv.setPointerCapture(e.pointerId); }catch(x){} dragTo(worldAt(e)); wake();
});
cv.addEventListener("pointermove",function(e){ if(dragging&&canAct()){ dragTo(worldAt(e)); wake(); } });
cv.addEventListener("pointerup",function(e){
  if(!dragging) return; dragging=false;
  if(!canAct()) return; dragTo(worldAt(e));
  if(dragP>=45) fireNow(act(),aim.w,aim.a,aim.p); else say("Drag further from your unit to fire.");
  wake();
});
cv.addEventListener("pointercancel",function(){ dragging=false; });
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });
cv.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var k=e.key, big=e.shiftKey?5:1;
  if(k==="ArrowLeft"){ e.preventDefault(); kb.l=true; wake(); }
  else if(k==="ArrowRight"){ e.preventDefault(); kb.r=true; wake(); }
  else if(k==="ArrowUp"){ e.preventDefault(); nudgeA(big); }
  else if(k==="ArrowDown"){ e.preventDefault(); nudgeA(-big); }
  else if(k==="Enter"){ e.preventDefault(); if(!e.repeat) jump(false); }
  else if(k==="Backspace"){ e.preventDefault(); if(!e.repeat) jump(true); }
  else if(k===" "){ e.preventDefault(); if(!e.repeat) startCharge("key"); }
  else if(k==="-"||k==="_"){ setZoom(zi+1); }
  else if(k==="="||k==="+"){ setZoom(zi-1); }
  else if(k==="m"||k==="M"){ setZoom(zi===2?0:2); }
  else if(k==="1"){ setWeapon("bz"); }
  else if(k==="2"){ setWeapon("gr"); }
  else if(k==="["){ nudgeP(-.02*big); }
  else if(k==="]"){ nudgeP(.02*big); }
});
cv.addEventListener("keyup",function(e){
  if(e.key==="ArrowLeft") kb.l=false; else if(e.key==="ArrowRight") kb.r=false; else if(e.key===" "){ e.preventDefault(); releaseCharge(); }
});
cv.addEventListener("blur",function(){ kb.l=kb.r=false; if(chg.on&&chg.src==="key") chg.on=false; dragging=false; });

function holdBtn(b,fn,rel){
  var t=0,iv=0;
  function stopH(){ clearTimeout(t); clearInterval(iv); if(rel) rel(); }
  b.addEventListener("pointerdown",function(e){ if(e.button>0||b.disabled) return; fn(); if(!rel){ t=setTimeout(function(){ iv=setInterval(fn,70); },380); } });
  ["pointerup","pointercancel","pointerleave","blur"].forEach(function(n){ b.addEventListener(n,stopH); });
  b.addEventListener("click",function(e){ if(e.detail===0) fn(); });
}
function walkBtn(b,dir,key){
  b.addEventListener("pointerdown",function(e){ if(e.button>0||b.disabled) return; hold[key]=true; wake(); });
  ["pointerup","pointercancel","pointerleave","blur"].forEach(function(n){ b.addEventListener(n,function(){ hold[key]=false; }); });
  b.addEventListener("click",function(e){ if(e.detail===0){ S.pulseDir=dir; pulse=.3; wake(); } });
}
walkBtn(bL,-1,"l"); walkBtn(bR,1,"r");
bJ.addEventListener("click",function(){ jump(false); focusBoard(); });
bF.addEventListener("click",function(){ jump(true); focusBoard(); });
holdBtn(aDn,function(){ nudgeA(-1); }); holdBtn(aUp,function(){ nudgeA(1); });
holdBtn(pDn,function(){ nudgeP(-.02); }); holdBtn(pUp,function(){ nudgeP(.02); });
function setZoom(n){ zi=clamp(n,0,2); var names=["Near","Wide","Map"]; zOutV.textContent=names[zi]; zOut.disabled=zi===2; zIn.disabled=zi===0;
  zOut.setAttribute("aria-label","Zoom out, now "+names[zi]); zIn.setAttribute("aria-label","Zoom in, now "+names[zi]);
  if(fit()){ camX=clamp(S.focus.x-visW/2,0,Math.max(0,WW-visW)); if(visW>=WW) camX=(WW-visW)/2; camY=Math.min(camY0,S.focus.y-visH*.4); draw(); wake(); }
  say(zi===2?"Whole map. Everyone is in view.":zi===1?"Wide view.":"Near view."); }
zOut.addEventListener("click",function(){ setZoom(zi+1); }); zIn.addEventListener("click",function(){ setZoom(zi-1); });
wBz.addEventListener("click",function(){ setWeapon("bz"); }); wGr.addEventListener("click",function(){ setWeapon("gr"); });
(function(){
  var down=0;
  fireBtn.addEventListener("pointerdown",function(e){ if(e.button>0||fireBtn.disabled) return; down=1; startCharge("btn"); });
  ["pointerup","pointercancel"].forEach(function(n){ fireBtn.addEventListener(n,function(){ if(down){ down=0; releaseCharge(); } }); });
  fireBtn.addEventListener("pointerleave",function(){ if(down){ down=0; releaseCharge(); } });
  fireBtn.addEventListener("click",function(e){ if(e.detail===0&&canAct()){ var u=act(); fireNow(u,aim.w,aim.a,aim.p); wake(); } });
})();
reset.addEventListener("click",function(){ newMatch(true); focusBoard(); wake(); });

/* ---------- interface state ---------- */
function ui(){
  if(!S) return;
  var u=act(), cu=cur(), can=canAct(), over_=S.phase==="over";
  var s=[Math.round(cu.a),Math.round(cu.p*100),cu.w,can,S.team,S.phase,Math.ceil(Math.max(0,S.timer)),engaged,S.wind,Math.round(teamHp(0)),Math.round(teamHp(1)),u&&u.name,save.w,save.l].join("|");
  if(s===sig) return; sig=s;
  aOut.textContent=Math.round(cu.a)+"°"; pOut.textContent=Math.round(cu.p*100)+"%";
  [bL,bR,bJ,bF,aDn,aUp,pDn,pUp,wBz,wGr,fireBtn].forEach(function(b){ b.disabled=!can; });
  pDn.disabled=pUp.disabled=!can||chg.on;
  wBz.setAttribute("aria-pressed",String(aim.w==="bz")); wGr.setAttribute("aria-pressed",String(aim.w==="gr"));
  var t=Math.ceil(Math.max(0,S.timer));
  hTurn.className="tf-chip"+(S.team===0&&!over_?" on":"");
  hTurn.textContent=over_?"Match over":S.team===0?(S.phase==="aim"?(engaged?"Your "+u.name+" "+t+"s":"Your "+u.name+" "+t+"s, paused"):"Your "+u.name):"Creep: "+(u?u.name:"");
  hWind.textContent="Wind "+(S.wind<0?"← "+(-S.wind):S.wind>0?S.wind+" →":"0");
  hHp.textContent="K13 "+Math.round(teamHp(0))+"  Creep "+Math.round(teamHp(1));
  hRec.textContent="Won "+save.w+" Lost "+save.l;
}

/* ---------- the loop ---------- */
function fx(dt){
  var tx=clamp(S.focus.x-visW/2,0,Math.max(0,WW-visW)), ty=Math.min(camY0,S.focus.y-visH*.4);
  if(visW>=WW) tx=(WW-visW)/2;
  if(calm()||(Math.abs(tx-camX)<.5&&Math.abs(ty-camY)<.5)){ camX=tx; camY=ty; }
  else { var k=Math.min(1,dt*(S.phase==="fly"?6:3)); camX+=(tx-camX)*k; camY+=(ty-camY)*k; }
  shake=Math.max(0,shake-dt*.9);
  if(flash){ flash.t+=dt; if(flash.t>.22) flash=null; }
  for(var i=parts.length-1;i>=0;i--){ var p=parts[i]; p.t+=dt; if(p.t>p.life){ parts.splice(i,1); continue; } p.vy+=G*(p.g||1)*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; }
  for(i=pops.length-1;i>=0;i--){ pops[i].t+=dt; if(pops[i].t>1.3) pops.splice(i,1); }
}
function busy(){ return !!S&&(S.phase!=="over"||parts.length>0||pops.length>0||shake>0); }
function frame(t){
  raf=0; if(!vis||document.hidden){ on=false; return; }
  var dt=Math.min(.05,(t-last)/1000); last=t;
  engaged=mount.matches(":hover")||mount.contains(document.activeElement);
  if(S.phase!=="over"){ acc+=dt; var n=0; while(acc>=DT&&n<8){ step(DT); acc-=DT; n++; } if(n===8) acc=0; }
  fx(dt); ui(); draw();
  if(!busy()){ on=false; return; }
  raf=window.requestAnimationFrame(frame);
}
function wake(){ if(on||!vis||document.hidden||!S){ if(S&&vis&&W) draw(); return; } if(!W&&!fit()) return; on=true; acc=0; last=performance.now(); raf=window.requestAnimationFrame(frame); }
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
  /* three views: near (the default), wide, and the whole map, so you can always find the other side */
  var base=h/VISH, zFit=Math.min(1,(w/WW)/base), z=zi===0?1:zi===1?(1+zFit)/2:zFit;
  W=w; H=h; ppu=base*z; visW=w/ppu; visH=h/ppu; camY0=WATER+30-visH;
  if(S) draw(); return true;
}

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement);
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  var dark=document.documentElement.getAttribute("data-theme")==="dark";
  return {dark:dark,bg:v("--paper-3","#E9EDF7"),card:v("--paper-2","#FFFFFF"),ink:v("--ink","#1F2023"),or:v("--blue","#B94612"),or2:v("--blue-2","#EA5E14"),
    line:v("--line-2","rgba(31,32,35,.22)"),muted:v("--muted","#5D5F65"),out:dark?"rgba(243,245,250,.85)":"#1F2023"};
}
function sx(x){ return (x-camX)*ppu; } function sy(y){ return (y-camY)*ppu; }
function rrect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath(); }
function drawUnit(u){
  var P=pal, a=u.dead?Math.max(0,1-u.fade/1.2):1, sad=u.hp<35||u.dead, f=u.face;
  ctx.save(); ctx.globalAlpha=a; ctx.translate(u.x,u.y); ctx.lineWidth=1.4; ctx.strokeStyle=P.out; ctx.lineJoin="round";
  if(u.team===0){
    rrect(-8,-8,16,16,4); ctx.fillStyle=P.or; ctx.fill(); ctx.stroke();
    ctx.fillStyle="#FFFFFF"; ctx.font="600 8px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(u.name,0,4.6);
    ctx.beginPath(); ctx.arc(-3+f*1.5,-3,1.7,0,6.2832); ctx.arc(3+f*1.5,-3,1.7,0,6.2832); ctx.fill();
  } else {
    rrect(-8,-8,16,16,3); ctx.fillStyle=P.ink; ctx.fill(); ctx.stroke();
    ctx.fillStyle=P.bg; ctx.fillRect(-8,-8,16,4.2); ctx.fillStyle=P.ink; for(var d=0;d<3;d++){ ctx.beginPath(); ctx.arc(-5.6+d*2.6,-5.9,.8,0,6.2832); ctx.fill(); }
    ctx.strokeStyle=P.bg; ctx.fillStyle=P.bg; ctx.lineWidth=1.2;
    if(u.idx===1){ ctx.beginPath(); ctx.moveTo(-3,5.2); ctx.lineTo(3,5.2); ctx.moveTo(0,2.2); ctx.lineTo(0,8.2); ctx.stroke(); }
    else{ ctx.beginPath(); ctx.moveTo(-2.6,5.6); ctx.lineTo(2.6,5.6); ctx.stroke(); }
    if(sad){ ctx.beginPath(); ctx.moveTo(-4.6+f*1.2,-1.4); ctx.lineTo(-1.6+f*1.2,1.6); ctx.moveTo(-1.6+f*1.2,-1.4); ctx.lineTo(-4.6+f*1.2,1.6); ctx.moveTo(1.6+f*1.2,-1.4); ctx.lineTo(4.6+f*1.2,1.6); ctx.moveTo(4.6+f*1.2,-1.4); ctx.lineTo(1.6+f*1.2,1.6); ctx.stroke(); }
    else{ ctx.beginPath(); ctx.arc(-3+f*1.5,.2,1.5,0,6.2832); ctx.arc(3+f*1.5,.2,1.5,0,6.2832); ctx.fill(); }
  }
  if(u.hurt>0){ rrect(-8,-8,16,16,4); ctx.globalAlpha=a*Math.min(.6,u.hurt*2.5); ctx.fillStyle="#FFFFFF"; ctx.fill(); }
  ctx.restore();
}
function drawProj(p){
  ctx.save(); ctx.translate(p.x,p.y);
  if(p.w==="bz"){
    ctx.rotate(Math.atan2(p.vy,p.vx)); ctx.fillStyle=pal.ink; ctx.strokeStyle=pal.out; ctx.lineWidth=1;
    rrect(-6,-2.2,12,4.4,2); ctx.fill(); ctx.stroke(); ctx.fillStyle=pal.or2; ctx.beginPath(); ctx.moveTo(-6,-1.6); ctx.lineTo(-10,0); ctx.lineTo(-6,1.6); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle=pal.or; ctx.strokeStyle=pal.out; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(0,0,4.2,0,6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#FFFFFF"; ctx.font="600 5.5px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("3",0,.4);
  }
  ctx.restore();
}
function draw(){
  if(!S||!W) return;
  if(!pal){ pal=palette(); if(pal.dark!==tDark){ tDark=pal.dark; paintRect(0,0,WW,WH,true); } }
  var P=pal, sh=shake>0&&!calm()?shake:0, ox=sh?(rnd()-.5)*sh*18:0, oy=sh?(rnd()-.5)*sh*18:0, i, u;
  ctx.setTransform(dprv,0,0,dprv,0,0); ctx.clearRect(0,0,W,H);
  ctx.save(); ctx.translate(ox,oy);
  ctx.fillStyle=P.bg; ctx.fillRect(-20,-20,W+40,H+40);
  /* a skyline of wireframe pages: the templates we are up against */
  ctx.save(); ctx.strokeStyle=P.line; ctx.globalAlpha=.5; ctx.lineWidth=1;
  for(i=0;i<9;i++){ var bw=(70+((i*37)%50))*ppu, bh=(60+((i*53)%70))*ppu, span=W+bw*2, bx=(((i*210-camX*.3)*ppu)%span+span)%span-bw, by=sy(WATER-40)-bh;
    ctx.strokeRect(bx,by,bw,bh); ctx.beginPath(); ctx.moveTo(bx,by+bh*.16); ctx.lineTo(bx+bw,by+bh*.16); ctx.moveTo(bx+bw*.12,by+bh*.4); ctx.lineTo(bx+bw*.62,by+bh*.4); ctx.moveTo(bx+bw*.12,by+bh*.55); ctx.lineTo(bx+bw*.46,by+bh*.55); ctx.stroke(); }
  ctx.restore();
  /* the world */
  ctx.save(); ctx.scale(ppu,ppu); ctx.translate(-camX,-camY);
  ctx.drawImage(tc,0,0);
  for(i=0;i<units.length;i++){ u=units[i]; if(!u.gone) drawUnit(u); }
  /* water over the feet of anything that falls in */
  var wt=WATER, x0=camX-40, x1=camX+visW+40;
  ctx.fillStyle=P.dark?"rgba(46,92,100,.82)":"rgba(62,118,126,.78)"; ctx.beginPath(); ctx.moveTo(x0,camY+visH+80);
  for(var xx=x0;xx<=x1;xx+=20) ctx.lineTo(xx,wt+Math.sin(xx/40+(calm()?0:clock*2))*1.6); ctx.lineTo(x1,camY+visH+80); ctx.closePath(); ctx.fill();
  for(i=0;i<S.projs.length;i++) drawProj(S.projs[i]);
  for(i=0;i<parts.length;i++){ var q=parts[i]; ctx.globalAlpha=Math.max(0,1-q.t/q.life); ctx.fillStyle=q.c; ctx.fillRect(q.x-q.s/2,q.y-q.s/2,q.s,q.s); }
  ctx.globalAlpha=1;
  if(flash){ ctx.globalAlpha=Math.max(0,1-flash.t/.22)*.8; ctx.fillStyle="#FFE6B8"; ctx.beginPath(); ctx.arc(flash.x,flash.y,flash.r*(.6+flash.t*2),0,6.2832); ctx.fill(); ctx.globalAlpha=1; }
  /* crosshair and power dots on the unit whose turn it is */
  u=act();
  if(u&&S.phase==="aim"&&!u.dead){
    var cu=cur(), ar=cu.a*Math.PI/180, dx=Math.cos(ar)*u.face, dy=-Math.sin(ar), cx=u.x+dx*46, cy=u.y-2+dy*46;
    ctx.fillStyle=P.or; var nd=Math.round(2+cu.p*8);
    for(i=0;i<nd;i++){ var r=14+i*4.2; ctx.globalAlpha=.45+.55*(i/nd); ctx.beginPath(); ctx.arc(u.x+dx*r,u.y-2+dy*r,1.6+i*.14,0,6.2832); ctx.fill(); }
    ctx.globalAlpha=1; ctx.strokeStyle=P.or; ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(cx,cy,5.5,0,6.2832); ctx.moveTo(cx-9,cy); ctx.lineTo(cx-3,cy); ctx.moveTo(cx+3,cy); ctx.lineTo(cx+9,cy); ctx.moveTo(cx,cy-9); ctx.lineTo(cx,cy-3); ctx.moveTo(cx,cy+3); ctx.lineTo(cx,cy+9); ctx.stroke();
  }
  ctx.restore();
  /* tags in screen space so the numbers stay readable at any zoom */
  ctx.font="600 10.5px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
  for(i=0;i<units.length;i++){
    u=units[i]; if(u.gone||u.dead) continue;
    var tx=sx(u.x), ty=sy(u.y-8)-13, lab=String(u.hp), tw=ctx.measureText(lab).width+12;
    ctx.fillStyle=P.card; rrect(tx-tw/2,ty-8,tw,16,8); ctx.fill(); ctx.strokeStyle=u.team===0?P.or:P.out; ctx.lineWidth=1.2; ctx.stroke();
    ctx.fillStyle=P.ink; ctx.fillText(lab,tx,ty+.5);
    if(u===act()&&S.phase==="aim"){ var bo=calm()?0:Math.sin(clock*7)*2.5; ctx.fillStyle=P.or; ctx.beginPath(); ctx.moveTo(tx-5,ty-17+bo); ctx.lineTo(tx+5,ty-17+bo); ctx.lineTo(tx,ty-10+bo); ctx.closePath(); ctx.fill(); }
  }
  for(i=0;i<pops.length;i++){
    var o=pops[i], rise=calm()?0:o.t*26; ctx.globalAlpha=Math.max(0,1-o.t/1.3); ctx.font="700 13px 'JetBrains Mono',monospace";
    ctx.lineWidth=3; ctx.strokeStyle=P.bg; ctx.strokeText(o.s,sx(o.x),sy(o.y)-rise); ctx.fillStyle=P.or; ctx.fillText(o.s,sx(o.x),sy(o.y)-rise);
  }
  ctx.globalAlpha=1;
  if(S.phase==="aim"&&S.team===0&&!engaged&&!dragging&&!chg.on){
    ctx.font="500 12px 'JetBrains Mono',monospace"; var ht="click the board to start the clock", hw=ctx.measureText(ht).width+22;
    ctx.fillStyle=P.card; rrect(W/2-hw/2,H-40,hw,24,12); ctx.fill(); ctx.strokeStyle=P.line; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle=P.ink; ctx.fillText(ht,W/2,H-27.5);
  }
  ctx.restore();
}

/* ---------- boot ---------- */
if(document.fonts&&document.fonts.load) document.fonts.load("600 12px Fraunces").then(function(){ if(vis&&W) draw(); },function(){});
pal=palette(); tDark=pal.dark;
newMatch(false);
})();
