/* K13 bench physics: four desk toys that are real simulations, built on the same card anatomy as js/workbench.js.
     One Roof      (Tiger Hospitality)  verlet rope, pendant lamps hung on swinging cords that clink
     Dumpling Drop (Station8)           rigid discs with spin and friction, pegs, bumpers, bins, fling
     Tide Line     (Lobster Lab)        spring-column water, buoyant rigid bodies, splash drops, fling
     Stack Attack  (Cosmos Burger)      soft verlet quads with SAT contacts: stack, bump, topple
   Every sim runs a fixed 120 Hz timestep behind an accumulator, draws to a devicePixelRatio-crisp canvas,
   sleeps once everything is at rest, and stops while the card is off screen or the tab is hidden.
   prefers-reduced-motion: no startup gust or swell, no splash drops, no kicks, heavier damping. Still fully playable.
   Keyboard: each canvas is focusable, arrows and Space act (see each foot line). Real buttons mirror the actions. */
(function(){
"use strict";
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function rnd(a,b){ return a+Math.random()*(b-a); }
var uid=0;

/* card chrome: the same DOM and classes as card() in workbench.js (head, instruction, stage, reset, status, footnote) */
function card(mount,o){
  mount.classList.add("wb");
  var head=el("div","wb-head");
  var t=el("div"); t.appendChild(txt("h3","wb-title",o.title)); t.appendChild(txt("span","wb-from","from "+o.from)); head.appendChild(t);
  mount.appendChild(head);
  var iid="bp-i"+(++uid);
  var instr=txt("p","wb-instr",o.instr); instr.id=iid; mount.appendChild(instr);
  var stage=el("div","wb-stage bp-stage "+(o.stageClass||"")); stage.setAttribute("aria-describedby",iid); mount.appendChild(stage);
  var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Reset</span>'); reset.type="button"; reset.setAttribute("aria-label","Reset "+o.title); stage.appendChild(reset);
  var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
  if(o.foot){ mount.appendChild(txt("p","wb-foot",o.foot)); }
  return {stage:stage,read:read,reset:reset};
}
function say(c,t){ c.read.innerHTML=""; if(t) c.read.appendChild(txt("span","",t)); }
function pill(c,label,aria){ var wrap=c.stage.querySelector(".bp-acts"); if(!wrap){ wrap=el("div","bp-acts"); c.stage.appendChild(wrap); }
  var b=txt("button","bp-btn",label); b.type="button"; b.setAttribute("aria-label",aria); wrap.appendChild(b); return b; }
function canvas(c,label){ var cv=el("canvas","bp-cv"); cv.tabIndex=0; cv.setAttribute("role","img"); cv.setAttribute("aria-label",label); c.stage.insertBefore(cv,c.stage.firstChild); return cv; }

/* the loop: fixed step + accumulator, paused off screen and in a hidden tab, asleep when api.rest() holds for 0.7 s */
function Sim(c,cv,api){
  var ctx=cv.getContext("2d"), W=0,H=0, vis=false, on=false, raf=0, acc=0, last=0, idle=0, entered=false, DT=1/120, self;
  function pt(e){ var r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*(W/(r.width||1)), y:(e.clientY-r.top)*(H/(r.height||1))}; }
  function fit(){
    var w=c.stage.clientWidth, h=c.stage.clientHeight; if(!w||!h) return false;
    var dpr=Math.min(window.devicePixelRatio||1,3), pw=Math.round(w*dpr), ph=Math.round(h*dpr);
    if(cv.width!==pw||cv.height!==ph){ cv.width=pw; cv.height=ph; }
    ctx.setTransform(dpr,0,0,dpr,0,0); self.dpr=dpr;
    if(w!==W||h!==H){ var first=!W; W=w; H=h; api.resize(W,H,first); }
    api.draw(ctx,W,H); return true;
  }
  function frame(t){
    raf=0; if(!vis||document.hidden){ on=false; return; }
    var dt=Math.min(.05,(t-last)/1000); last=t; acc+=dt; var n=0;
    while(acc>=DT&&n<10){ api.step(DT); acc-=DT; n++; }
    if(n===10) acc=0;
    api.draw(ctx,W,H);
    if(api.rest()) idle+=dt; else idle=0;
    if(idle>.7){ on=false; return; }
    raf=window.requestAnimationFrame(frame);
  }
  function wake(){ idle=0; if(on||!vis||document.hidden) return; if(!W&&!fit()) return; on=true; acc=0; last=performance.now(); raf=window.requestAnimationFrame(frame); }
  function stop(){ if(raf){ window.cancelAnimationFrame(raf); raf=0; } on=false; }
  new IntersectionObserver(function(es){
    vis=es[0].isIntersecting;
    if(vis){ fit(); if(!entered&&W){ entered=true; if(api.enter) api.enter(); } wake(); } else stop();
  },{threshold:0}).observe(c.stage);
  document.addEventListener("visibilitychange",function(){ if(document.hidden) stop(); else wake(); });
  if(window.ResizeObserver) new ResizeObserver(function(){ if(fit()) wake(); }).observe(c.stage); else window.addEventListener("resize",function(){ if(fit()) wake(); });
  self={wake:wake,pt:pt,W:function(){return W;},H:function(){return H;},dpr:1,draw:function(){ if(W) api.draw(ctx,W,H); }};
  return self;
}

/* pointer plumbing shared by the four toys: capture, local coordinates, pointer-up cleanup */
function pointer(cv,sim,h){
  cv.addEventListener("pointerdown",function(e){ if(e.button>0) return; e.preventDefault(); try{ cv.setPointerCapture(e.pointerId); }catch(x){} cv.style.cursor="grabbing"; h.down(sim.pt(e)); sim.wake(); });
  cv.addEventListener("pointermove",function(e){ if(h.move) h.move(sim.pt(e),(e.buttons&1)===1); });
  function up(e){ cv.style.cursor=""; if(h.up) h.up(sim.pt(e)); sim.wake(); }
  cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",up);
}

/* ======================= 1. One Roof (Tiger Hospitality): verlet string of pendant lamps ======================= */
function roof(mount){
  var c=card(mount,{title:"One Roof",from:"Tiger Hospitality",instr:"Swing the string until every lamp clinks a neighbour and lights.",stageClass:"bp-dark bp-roof",
    foot:"A toy string, not their lighting plan. Arrows blow a breeze, Space shakes."});
  var cv=canvas(c,"A string of pendant lamps. Left and right arrows blow a breeze, Space shakes the string.");
  var shake=pill(c,"Shake","Shake the string of lamps");
  var N=30, M=7, litN=0, door=0, won=false, nodes=[], lamps=[], ax0=0,ay0=0,ax1=0,ay1=0, seg=0, wamp=0, T=0, grab=null, restNow=false, stars=[];
  for(var s=0;s<26;s++) stars.push([Math.random(),Math.random()*.55,Math.random()*1.1+.4]);
  function build(W,H){
    M=W<380?5:W<600?7:9;
    ax0=20; ax1=W-20; ay0=ay1=64;
    var span=ax1-ax0; seg=span*1.17/(N-1); var sag=Math.sqrt(3*span*(span*.17)/8);
    nodes=[]; lamps=[]; grab=null; wamp=0;
    for(var i=0;i<N;i++){ var u=i/(N-1), x=ax0+u*span, y=ay0+4*sag*u*(1-u); nodes.push({x:x,y:y,px:x,py:y}); }
    var lens=[24,36,28,40,26,34,30];
    for(var k=0;k<M;k++){ var idx=Math.round((k+1)*(N-1)/(M+1)), n=nodes[idx], len=lens[k%lens.length];
      lamps.push({n:idx,len:len,x:n.x,y:n.y+len,px:n.x,py:n.y+len,r:12,glow:0,lit:false,fl:0}); }
    litN=0; door=0; won=false;
  }
  function gust(dir,mag){ wamp=dir*mag*(calm()?.45:1); sim.wake(); }
  function step(dt){
    T+=dt; wamp*=Math.exp(-dt*(calm()?3:1.6));
    var drag=calm()?.9935:.9976, g=1500, i, p;
    function integ(p,wind,w){
      var vx=(p.x-p.px), vy=(p.y-p.py), sp=Math.sqrt(vx*vx+vy*vy), d=sp<.12?drag*.985:drag;
      vx*=d; vy*=d; var m=Math.max(1,sp/45); vx/=m; vy/=m; p.px=p.x; p.py=p.y; p.x+=vx+wind*dt*dt; p.y+=vy+g*dt*dt;
    }
    for(i=1;i<N-1;i++){ integ(nodes[i],wamp*(.55+.45*Math.sin(i*.45-T*3.2))); }
    for(i=0;i<M;i++){ integ(lamps[i],wamp*1.5*(.55+.45*Math.sin(i*.9-T*3.2))); }
    var W=sim.W(), H=sim.H(), fl=H-40;
    for(var it=0;it<18;it++){
      nodes[0].x=ax0; nodes[0].y=ay0; nodes[N-1].x=ax1; nodes[N-1].y=ay1;
      for(i=0;i<N-1;i++){ var a=nodes[i], b=nodes[i+1], dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)||1e-6, df=(d-seg)/d*.5, wa=i===0?0:1, wb=i===N-2?0:1, ws=wa+wb; if(!ws) continue;
        var fa=wa/ws*2*df, fb=wb/ws*2*df; a.x+=dx*fa; a.y+=dy*fa; b.x-=dx*fb; b.y-=dy*fb; }
      for(i=0;i<M;i++){ var l=lamps[i], n=nodes[l.n], ex=l.x-n.x, ey=l.y-n.y, dd=Math.sqrt(ex*ex+ey*ey)||1e-6, k=(dd-l.len)/dd, wn=1, wl=.55, s2=wn+wl;
        n.x+=ex*k*wn/s2; n.y+=ey*k*wn/s2; l.x-=ex*k*wl/s2; l.y-=ey*k*wl/s2; }
      for(i=0;i<M-1;i++){ var p1=lamps[i], p2=lamps[i+1], qx=p2.x-p1.x, qy=p2.y-p1.y, qd=Math.sqrt(qx*qx+qy*qy), min=p1.r+p2.r; if(qd<min&&qd>1e-6){ if(it===0&&!(p1.lit&&p2.lit)){ var ap=-(((p2.x-p2.px)-(p1.x-p1.px))*qx+((p2.y-p2.py)-(p1.y-p1.py))*qy)/qd; if(ap>.22) clink(p1,p2); } var o=(min-qd)/qd*.5; p1.x-=qx*o; p1.y-=qy*o; p2.x+=qx*o; p2.y+=qy*o; } }
      if(grab){ var gp=grab.p; gp.x+=(grab.tx-gp.x)*.13; gp.y+=(grab.ty-gp.y)*.13; }
      for(i=0;i<M;i++){ p=lamps[i]; if(p.y>fl){ p.y=fl; p.py=p.y+(p.y-p.py)*.2*0; } p.x=clamp(p.x,10,W-10); if(p.y<ay0-6) p.y=ay0-6; }
      for(i=1;i<N-1;i++){ p=nodes[i]; p.x=clamp(p.x,6,W-6); if(p.y>fl){ p.y=fl; } if(p.y<ay0-6) p.y=ay0-6; }
    }
    var mx=0; for(i=0;i<N;i++){ p=nodes[i]; var sp=Math.hypot(p.x-p.px,p.y-p.py); if(sp>mx) mx=sp; }
    for(i=0;i<M;i++){ p=lamps[i]; var s3=Math.hypot(p.x-p.px,p.y-p.py); p.glow=s3; if(s3>mx) mx=s3; }
    for(i=0;i<M;i++) if(lamps[i].fl>0) lamps[i].fl=Math.max(0,lamps[i].fl-dt*2.5);
    if(won&&door<1) door=Math.min(1,door+dt*.8);
    restNow=mx<.03&&Math.abs(wamp)<2&&!grab&&(!won||door>=1)&&!lamps.some(function(l){ return l.fl>0; });
  }
  function clink(a,b){
    var was=litN; [a,b].forEach(function(l){ if(!l.lit){ l.lit=true; litN++; } l.fl=1; });
    if(litN===was) return;
    if(litN>=M){ won=true; say(c,"All "+M+" lit. The room is open."); } else say(c,"Clink. Lit "+litN+" of "+M+".");
  }
  function draw(ctx,W,H){
    var fl=H-40, i, g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#0C1224"); g.addColorStop(.7,"#1E2336"); g.addColorStop(1,"#35271D"); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#F6EEDC"; for(i=0;i<stars.length;i++){ ctx.globalAlpha=.25+stars[i][2]*.25; ctx.beginPath(); ctx.arc(stars[i][0]*W,stars[i][1]*H,stars[i][2],0,6.283); ctx.fill(); } ctx.globalAlpha=1;
    ctx.fillStyle="#18110C"; ctx.fillRect(0,fl,W,H-fl); ctx.fillStyle="rgba(255,210,122,.16)"; ctx.fillRect(0,fl,W,1.5);
    ctx.strokeStyle="rgba(255,255,255,.05)"; ctx.lineWidth=1; for(i=1;i<4;i++){ ctx.beginPath(); ctx.moveTo(0,fl+i*10); ctx.lineTo(W,fl+i*10); ctx.stroke(); }
    ctx.globalCompositeOperation="lighter";
    for(i=0;i<lamps.length;i++){ var l=lamps[i]; if(!l.lit&&!won) continue; var I=clamp(.7+l.glow*.5+l.fl*.4,.7,1.3), rg=ctx.createRadialGradient(l.x,fl+6,0,l.x,fl+6,70); rg.addColorStop(0,"rgba(255,190,90,"+(.26*I)+")"); rg.addColorStop(1,"rgba(255,190,90,0)");
      ctx.save(); ctx.translate(0,fl+6); ctx.scale(1,.18); ctx.translate(0,-(fl+6)); ctx.fillStyle=rg; ctx.fillRect(l.x-80,fl-80,160,200); ctx.restore(); }
    ctx.globalCompositeOperation="source-over";
    var dw=46*(W<400?.8:1), dh=84*(H<400?.9:1), dcx=W/2, dtop=fl-dh;
    ctx.fillStyle="#241912"; ctx.fillRect(dcx-dw/2-4,dtop-4,dw+8,dh+4);
    if(door>0){ var gg=ctx.createLinearGradient(0,dtop,0,fl); gg.addColorStop(0,"#FFE2A0"); gg.addColorStop(1,"#FFB85A"); ctx.fillStyle=gg; ctx.fillRect(dcx-dw/2,dtop,dw,dh);
      ctx.globalCompositeOperation="lighter"; var sg=ctx.createLinearGradient(0,fl-6,0,fl+34); sg.addColorStop(0,"rgba(255,200,110,"+(.5*door)+")"); sg.addColorStop(1,"rgba(255,200,110,0)"); ctx.fillStyle=sg; ctx.beginPath(); ctx.moveTo(dcx-dw/2,fl); ctx.lineTo(dcx+dw/2,fl); ctx.lineTo(dcx+dw*1.5,fl+34); ctx.lineTo(dcx-dw*1.5,fl+34); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation="source-over"; }
    ctx.fillStyle="#4A372A"; ctx.fillRect(dcx-dw/2,dtop,dw*(1-.88*door),dh); ctx.fillStyle="#6A5038"; ctx.fillRect(dcx-dw/2+dw*(1-.88*door)-4,dtop+dh*.5,3,6);
    [ax0,ax1].forEach(function(x,k){ var pg=ctx.createLinearGradient(x-6,0,x+6,0); pg.addColorStop(0,"#4A372A"); pg.addColorStop(1,"#2B1F16"); ctx.fillStyle=pg; ctx.fillRect(x-6,ay0-8,12,fl-ay0+8);
      ctx.fillStyle="#6A5038"; ctx.beginPath(); ctx.arc(x,ay0-8,7,0,6.283); ctx.fill(); });
    ctx.lineJoin="round"; ctx.lineCap="round"; ctx.strokeStyle="#D8C29A"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(nodes[0].x,nodes[0].y);
    for(i=1;i<N-1;i++){ var a=nodes[i], b=nodes[i+1]; ctx.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2); }
    ctx.lineTo(nodes[N-1].x,nodes[N-1].y); ctx.stroke();
    ctx.globalCompositeOperation="lighter";
    for(i=2;i<N-2;i+=2){ var f=nodes[i]; ctx.fillStyle="rgba(255,210,122,.55)"; ctx.beginPath(); ctx.arc(f.x,f.y+3,2.4,0,6.283); ctx.fill(); ctx.fillStyle="rgba(255,190,90,.14)"; ctx.beginPath(); ctx.arc(f.x,f.y+3,8,0,6.283); ctx.fill(); }
    ctx.globalCompositeOperation="source-over";
    for(i=0;i<lamps.length;i++){ var q=lamps[i], nd=nodes[q.n], dd=Math.hypot(nd.x-q.x,nd.y-q.y);
      ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(Math.atan2(nd.x-q.x,-(nd.y-q.y)));
      ctx.strokeStyle="#A68F63"; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(0,-17); ctx.lineTo(0,-Math.max(dd,18)); ctx.stroke();
      var on=q.lit||won, sg=ctx.createLinearGradient(-14,0,14,0); if(on){ sg.addColorStop(0,"#F0BE62"); sg.addColorStop(.5,"#C98A2C"); sg.addColorStop(1,"#7A4C16"); } else { sg.addColorStop(0,"#8D7650"); sg.addColorStop(.5,"#6E5A3C"); sg.addColorStop(1,"#40321F"); }
      ctx.fillStyle=sg; ctx.beginPath(); ctx.moveTo(-14,-3); ctx.quadraticCurveTo(-14,-17,0,-17); ctx.quadraticCurveTo(14,-17,14,-3); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#5E3A10"; ctx.fillRect(-15,-4,30,3);
      var bg=ctx.createRadialGradient(0,1,0,0,1,7); if(on){ bg.addColorStop(0,"#FFFFFF"); bg.addColorStop(.5,"#FFE9B0"); bg.addColorStop(1,"#FFC25E"); } else { bg.addColorStop(0,"#8C8574"); bg.addColorStop(1,"#5D5849"); } ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(0,1,6.4,0,6.283); ctx.fill();
      ctx.restore(); }
    ctx.globalCompositeOperation="lighter";
    for(i=0;i<lamps.length;i++){ var q2=lamps[i]; if(!q2.lit&&!won) continue; var I2=clamp(.72+q2.glow*.55+q2.fl*.5,.72,1.5), R=64*I2, rg2=ctx.createRadialGradient(q2.x,q2.y,0,q2.x,q2.y,R);
      rg2.addColorStop(0,"rgba(255,206,120,"+(.62*I2)+")"); rg2.addColorStop(.35,"rgba(255,170,70,"+(.22*I2)+")"); rg2.addColorStop(1,"rgba(255,150,50,0)");
      ctx.fillStyle=rg2; ctx.beginPath(); ctx.arc(q2.x,q2.y,R,0,6.283); ctx.fill(); }
    ctx.globalCompositeOperation="source-over";
    var pw=M*16, px0=W/2-pw/2+8; for(i=0;i<M;i++){ ctx.fillStyle=lamps[i].lit||won?"#FFD27A":"rgba(246,238,220,.22)"; ctx.beginPath(); ctx.arc(px0+i*16,H-14,4.5,0,6.283); ctx.fill(); }
  }
  var sim=Sim(c,cv,{resize:function(W,H){ build(W,H); },step:step,draw:draw,rest:function(){ return restNow; },
    enter:function(){ say(c,"Lit 0 of "+M+". Swing the lamps into each other."); if(!calm()) setTimeout(function(){ gust(1,.9); },350); }});
  pointer(cv,sim,{
    down:function(p){ var best=null,bd=1e9,i,d;
      for(i=0;i<lamps.length;i++){ d=Math.hypot(lamps[i].x-p.x,lamps[i].y-p.y); if(d<bd&&d<40){ bd=d; best=lamps[i]; } }
      if(!best) for(i=1;i<N-1;i++){ d=Math.hypot(nodes[i].x-p.x,nodes[i].y-p.y); if(d<bd&&d<24){ bd=d; best=nodes[i]; } }
      if(best){ grab={p:best,tx:p.x,ty:p.y}; } else { gust(p.x<sim.W()/2?1:-1,.9); say(c,p.x<sim.W()/2?"A push from the left.":"A push from the right."); } },
    move:function(p,down){ if(grab&&down){ grab.tx=clamp(p.x,10,sim.W()-10); grab.ty=clamp(p.y,ay0+8,sim.H()-48); sim.wake(); } },
    up:function(){ grab=null; }
  });
  cv.addEventListener("keydown",function(e){
    if(e.key==="ArrowLeft"){ gust(-1,1); say(c,"Breeze from the right."); }
    else if(e.key==="ArrowRight"){ gust(1,1); say(c,"Breeze from the left."); }
    else if(e.key===" "||e.key==="Enter"){ doShake(); }
    else return; e.preventDefault(); });
  function doShake(){ var k=calm()?.4:1; lamps.forEach(function(l){ l.px+=rnd(-2.6,2.6)*k; l.py+=rnd(-1.2,.4)*k; }); gust(Math.random()<.5?-1:1,1.4); say(c,"The string rattles."); }
  shake.addEventListener("click",doShake);
  c.reset.addEventListener("click",function(){ build(sim.W(),sim.H()); say(c,"Lit 0 of "+M+"."); sim.wake(); sim.draw(); });
}

/* ======================= 2. Dumpling Drop (Station8): discs, pegs, bumpers, bins ======================= */
function dumpling(mount){
  var c=card(mount,{title:"Dumpling Drop",from:"Station8",instr:"Land a dumpling in every basket. Tap to drop, grab one to fling.",stageClass:"bp-light bp-drop",
    foot:"A toy market, not the real one. Arrows slide the steamer, Space drops, Up shakes."});
  var cv=canvas(c,"A pachinko board of pegs over five baskets. Left and right arrows slide the steamer, Space drops a dumpling, Up shakes the table.");
  var dropB=pill(c,"Drop","Drop a dumpling"), shakeB=pill(c,"Shake","Shake the table");
  var G=1750, balls=[], pegs=[], bumps=[], r=12, binH=70, chuteX=0, chuteY=62, grab=null, stream=false, streamT=0, sprites={}, spriteKey="", W0=0,H0=0, restNow=false, lastCounts="", countT=0, kindN=0, filled=[0,0,0,0,0], won=false, winT=0;
  var KINDS=["#4F9E92","#E8756A","#F0B429","#141D35"], BINS=5, binCol=["#EADFC2","#E2D4AE"];
  function layout(W,H){
    r=clamp(W/27,10,13.5); binH=Math.min(74,Math.round(H*.22)); pegs=[]; bumps=[];
    var top=96, bot=H-binH-30, sx=Math.max(38,W/Math.floor(W/40)), rows=Math.max(2,Math.floor((bot-top)/33)+1), rowH=(bot-top)/(rows-1);
    bumps.push({x:W*.27,y:top+rowH*.5+4,r:15,f:0},{x:W*.73,y:top+rowH*.5+4,r:15,f:0});
    for(var j=0;j<rows;j++){ var y=top+j*rowH, off=j%2?0:sx/2;
      for(var x=off;x<=W+1;x+=sx){ if(x<30||x>W-30) continue; var near=false; bumps.forEach(function(b){ if(Math.hypot(b.x-x,b.y-y)<b.r+30) near=true; }); if(!near) pegs.push({ax:x,ay:y,bx:x,by:y,rad:4.5}); } }
    for(var k=1;k<BINS;k++){ var dx=W*k/BINS; pegs.push({ax:dx,ay:H-binH,bx:dx,by:H-4,rad:3,div:true}); }
    chuteX=clamp(chuteX||W/2,r+4,W-r-4);
    balls.forEach(function(b){ b.x=clamp(b.x,r,W-r); b.y=Math.min(b.y,H-r-1); });
  }
  function sprite(kind){
    var key=r+"|"+sim.dpr; if(key!==spriteKey){ sprites={}; spriteKey=key; }
    if(sprites[kind]) return sprites[kind];
    var d=sim.dpr, s=Math.ceil((r*2+6)*d), cv2=document.createElement("canvas"); cv2.width=cv2.height=s; var x=cv2.getContext("2d"); x.scale(d,d); x.translate(r+3,r+3);
    var g=x.createRadialGradient(-r*.3,-r*.35,r*.1,0,0,r); g.addColorStop(0,"#FFFCF2"); g.addColorStop(1,"#F1E2BE");
    x.fillStyle=g; x.strokeStyle="#A98A4C"; x.lineWidth=1.3; x.beginPath(); x.arc(0,0,r-.6,0,6.283); x.fill(); x.stroke();
    x.fillStyle=KINDS[kind]; x.globalAlpha=.9; x.beginPath(); x.arc(0,r*.3,r*.27,0,6.283); x.fill(); x.globalAlpha=1;
    x.strokeStyle="#A98A4C"; x.lineWidth=1.2; x.lineCap="round";
    for(var i=0;i<6;i++){ var a=-2.45+i*.38; x.beginPath(); x.moveTo(Math.cos(a)*r*.52,Math.sin(a)*r*.52); x.lineTo(Math.cos(a)*r*.84,Math.sin(a)*r*.84); x.stroke(); }
    return (sprites[kind]=cv2);
  }
  function spawn(x,vx){ if(balls.length>=36) balls.shift(); var b={x:clamp(x,r,sim.W()-r),y:chuteY+4,vx:vx==null?rnd(-40,40):vx,vy:60,a:Math.random()*6.28,w:rnd(-3,3),kind:kindN++%4,sl:0}; balls.push(b); return b; }
  function seg(b,s,e,mu){
    var dx=s.bx-s.ax, dy=s.by-s.ay, l2=dx*dx+dy*dy, t=l2?clamp(((b.x-s.ax)*dx+(b.y-s.ay)*dy)/l2,0,1):0, cx=s.ax+dx*t, cy=s.ay+dy*t,
        nx=b.x-cx, ny=b.y-cy, d=Math.sqrt(nx*nx+ny*ny), min=r+s.rad; if(d>=min) return; if(d<1e-6){ nx=0; ny=-1; d=1; } nx/=d; ny/=d;
    b.x+=nx*(min-d); b.y+=ny*(min-d);
    var vn=b.vx*nx+b.vy*ny; if(vn<0){ var rest=-vn>110?e:0; b.vx-=(1+rest)*vn*nx; b.vy-=(1+rest)*vn*ny; if(s.kick){ b.vx+=nx*s.kick; b.vy+=ny*s.kick; }
      var tx=-ny, ty=nx, vt=b.vx*tx+b.vy*ty-b.w*r, jt=clamp(-vt/3,-mu*(1+rest)*(-vn)-.4,mu*(1+rest)*(-vn)+.4); b.vx+=tx*jt; b.vy+=ty*jt; b.w-=2*jt/r; }
  }
  function pair(a,b,e){
    var nx=b.x-a.x, ny=b.y-a.y, d=Math.sqrt(nx*nx+ny*ny), min=r*2; if(d>=min||d<1e-6) return; nx/=d; ny/=d; var o=(min-d)*.5;
    a.x-=nx*o; a.y-=ny*o; b.x+=nx*o; b.y+=ny*o;
    var vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny; if(vn<0){ var rest=-vn>110?e:0, j=-(1+rest)*vn*.5; a.vx-=j*nx; a.vy-=j*ny; b.vx+=j*nx; b.vy+=j*ny;
      var tx=-ny, ty=nx, vt=(b.vx-a.vx)*tx+(b.vy-a.vy)*ty-(a.w+b.w)*r, jt=clamp(-vt/6,-.4*(-vn)-.2,.4*(-vn)+.2); a.vx-=tx*jt; a.vy-=ty*jt; b.vx+=tx*jt; b.vy+=ty*jt; a.w-=2*jt/r; b.w-=2*jt/r; }
  }
  function step(dt){
    var W=sim.W(), H=sim.H(), cm=calm(), e=cm?.12:.46, drag=cm?2.2:.12, i,j,b;
    if(stream){ streamT+=dt; if(streamT>.15){ streamT=0; spawn(chuteX+rnd(-3,3)); } }
    for(i=0;i<balls.length;i++){ b=balls[i];
      if(b===grab){ var tx=grab.tx-b.x, ty=grab.ty-b.y; b.vx=clamp(tx*26,-2400,2400); b.vy=clamp(ty*26,-2400,2400); b.w+=(b.vx*.0006-b.w*.1); }
      else { b.vy+=G*dt; b.vx*=1-drag*dt; b.vy*=1-drag*dt; b.w*=1-.35*dt; }
      b.x+=b.vx*dt; b.y+=b.vy*dt; b.a+=b.w*dt; }
    for(var it=0;it<5;it++){
      for(i=0;i<balls.length;i++){ b=balls[i];
        for(j=0;j<pegs.length;j++) seg(b,pegs[j],e,.45);
        for(j=0;j<bumps.length;j++){ var bm=bumps[j], hit=Math.hypot(b.x-bm.x,b.y-bm.y)<bm.r+r+.5; seg(b,{ax:bm.x,ay:bm.y,bx:bm.x,by:bm.y,rad:bm.r,kick:cm?0:300},1,.3); if(hit&&!bm.hit) bm.f=1; bm.hit=hit; }
        if(b.x<r){ b.x=r; if(b.vx<0) b.vx*=-.35; } if(b.x>W-r){ b.x=W-r; if(b.vx>0) b.vx*=-.35; }
        if(b.y>H-r-1){ b.y=H-r-1; if(b.vy>0) b.vy*=(b.vy>140?-.28:0); b.vx*=.96; b.w+=(-b.vx/r-b.w)*.12; }
        if(b.y<r){ b.y=r; if(b.vy<0) b.vy*=-.3; } }
      for(i=0;i<balls.length;i++) for(j=i+1;j<balls.length;j++) pair(balls[i],balls[j],e);
    }
    var all=true; for(i=0;i<balls.length;i++){ b=balls[i]; var sp=Math.abs(b.vx)+Math.abs(b.vy)+Math.abs(b.w)*4; if(sp<26&&b!==grab) b.sl+=dt; else b.sl=0; if(b.sl<.45) all=false; }
    for(j=0;j<bumps.length;j++) bumps[j].f=Math.max(0,bumps[j].f-dt*4);
    if(won) winT+=dt;
    restNow=all&&!stream&&!grab&&bumps.every(function(m){ return m.f<=0; })&&(!won||winT>2);
    countT+=dt; if(countT>.35||restNow){ countT=0; tally(); }
  }
  function tally(){
    var H=sim.H(), W=sim.W(), n=[0,0,0,0,0], tot=0, add=0;
    balls.forEach(function(b){ if(b.y>H-binH-r*.6){ var k=Math.min(BINS-1,Math.floor(b.x/(W/BINS))); n[k]++; tot++; if(b.sl>.3&&!filled[k]){ filled[k]=1; add++; } } });
    if(add&&!won){ var f=filled.reduce(function(a,b){ return a+b; },0);
      if(f>=BINS){ won=true; winT=0; say(c,"Every basket filled. The market is open."); } else say(c,"Baskets filled: "+f+" of "+BINS+"."); }
  }
  function draw(ctx,W,H){
    var i,j; ctx.fillStyle="#F2EAD3"; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="rgba(20,29,53,.05)"; ctx.lineWidth=1; for(i=1;i<14;i++){ ctx.beginPath(); ctx.moveTo(0,i*30); ctx.lineTo(W,i*30); ctx.stroke(); }
    for(i=0;i<BINS;i++){ ctx.fillStyle=filled[i]?(won&&Math.sin(winT*9+i)>0?"#FFE08A":"#F6D77A"):binCol[i%2]; ctx.fillRect(W*i/BINS,H-binH,W/BINS,binH);
      if(filled[i]){ var bx=W*(i+.5)/BINS; ctx.strokeStyle="#8A5A12"; ctx.lineWidth=2; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(bx-6,H-binH+14); ctx.lineTo(bx-1.5,H-binH+19); ctx.lineTo(bx+7,H-binH+8); ctx.stroke(); } }
    ctx.fillStyle="rgba(20,29,53,.18)"; ctx.fillRect(0,H-binH,W,1.5);
    ctx.font="500 11px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.fillStyle="#515C78";
    var n=[0,0,0,0,0]; balls.forEach(function(b){ if(b.y>H-binH-r*.6) n[Math.min(BINS-1,Math.floor(b.x/(W/BINS)))]++; });
    for(i=0;i<BINS;i++) ctx.fillText(String(n[i]),W*(i+.5)/BINS,H-binH-8);
    if(won){ ctx.font="600 "+Math.round(16*clamp(W/420,.8,1.2))+"px Fraunces,Georgia,serif"; ctx.fillStyle="rgba(242,234,211,.92)"; ctx.fillRect(W/2-96,H*.5-20,192,28); ctx.fillStyle="#141D35"; ctx.fillText("The market is open",W/2,H*.5); ctx.font="500 11px 'JetBrains Mono',monospace"; ctx.fillStyle="#515C78"; }
    for(i=0;i<pegs.length;i++){ var p=pegs[i]; if(p.div){ ctx.strokeStyle="#6B4A2A"; ctx.lineWidth=p.rad*2; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(p.ax,p.ay); ctx.lineTo(p.bx,p.by); ctx.stroke(); }
      else { ctx.fillStyle="#141D35"; ctx.beginPath(); ctx.arc(p.ax,p.ay,p.rad,0,6.283); ctx.fill(); ctx.fillStyle="rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(p.ax-1.3,p.ay-1.3,1.3,0,6.283); ctx.fill(); } }
    for(i=0;i<bumps.length;i++){ var m=bumps[i], s=1+m.f*.16; ctx.fillStyle="#DC4405"; ctx.beginPath(); ctx.arc(m.x,m.y,m.r*s,0,6.283); ctx.fill();
      ctx.strokeStyle=m.f>0?"#FFE08A":"#F0B429"; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(m.x,m.y,m.r*s-4,0,6.283); ctx.stroke();
      ctx.fillStyle="#FFE9C8"; ctx.beginPath(); ctx.arc(m.x,m.y,3,0,6.283); ctx.fill(); }
    for(i=0;i<balls.length;i++){ var b=balls[i], sp=sprite(b.kind%4); ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.a); ctx.drawImage(sp,-r-3,-r-3,r*2+6,r*2+6); ctx.restore(); }
    var cx=chuteX, sw=r*3.2; ctx.fillStyle="#C79A52"; ctx.strokeStyle="#7A5A2A"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.roundRect?ctx.roundRect(cx-sw/2,chuteY-22,sw,22,5):ctx.rect(cx-sw/2,chuteY-22,sw,22); ctx.fill(); ctx.stroke();
    ctx.strokeStyle="#7A5A2A"; for(j=1;j<3;j++){ ctx.beginPath(); ctx.moveTo(cx-sw/2+j*sw/3,chuteY-22); ctx.lineTo(cx-sw/2+j*sw/3,chuteY); ctx.stroke(); }
    ctx.fillStyle="#E7C98C"; ctx.fillRect(cx-sw/2-3,chuteY-26,sw+6,5);
  }
  var sim=Sim(c,cv,{resize:function(W,H){ layout(W,H); },step:step,draw:draw,rest:function(){ return restNow; },
    enter:function(){ say(c,"Baskets filled: 0 of "+BINS+"."); if(!calm()){ [.3,.55,.72].forEach(function(f,k){ setTimeout(function(){ chuteX=sim.W()*f; spawn(chuteX); sim.wake(); },300+k*420); }); } }});
  pointer(cv,sim,{
    down:function(p){ var best=null,bd=1e9; balls.forEach(function(b){ var d=Math.hypot(b.x-p.x,b.y-p.y); if(d<r+12&&d<bd){ bd=d; best=b; } });
      if(best){ grab=best; grab.tx=p.x; grab.ty=p.y; } else { chuteX=clamp(p.x,r+4,sim.W()-r-4); spawn(chuteX); stream=true; streamT=-.12; } },
    move:function(p,down){ if(grab&&down){ grab.tx=clamp(p.x,r,sim.W()-r); grab.ty=clamp(p.y,r,sim.H()-r); } else if(stream&&down){ chuteX=clamp(p.x,r+4,sim.W()-r-4); } },
    up:function(){ if(grab){ grab.vx=clamp(grab.vx,-1800,1800); grab.vy=clamp(grab.vy,-1800,1800); } grab=null; stream=false; }
  });
  function dropOne(){ spawn(chuteX); sim.wake(); }
  function shakeIt(){ var k=calm()?.4:1; balls.forEach(function(b){ b.vy-=rnd(380,620)*k; b.vx+=rnd(-260,260)*k; b.w+=rnd(-5,5)*k; b.sl=0; }); bumps.forEach(function(m){ m.f=1; }); say(c,"The table jumps."); sim.wake(); }
  cv.addEventListener("keydown",function(e){
    var step=sim.W()*.06;
    if(e.key==="ArrowLeft") chuteX=clamp(chuteX-step,r+4,sim.W()-r-4);
    else if(e.key==="ArrowRight") chuteX=clamp(chuteX+step,r+4,sim.W()-r-4);
    else if(e.key===" "||e.key==="ArrowDown"||e.key==="Enter"){ dropOne(); }
    else if(e.key==="ArrowUp"){ shakeIt(); }
    else return; e.preventDefault(); sim.wake(); sim.draw(); });
  dropB.addEventListener("click",dropOne); shakeB.addEventListener("click",shakeIt);
  c.reset.addEventListener("click",function(){ balls=[]; lastCounts=""; filled=[0,0,0,0,0]; won=false; winT=0; grab=null; stream=false; say(c,"Baskets filled: 0 of "+BINS+"."); sim.wake(); sim.draw(); });
}

/* ======================= 3. Tide Line (Lobster Lab): run a lobster boat ======================= */
/* Goal: fill the crate to 13 before the tide turns. Drop a trap on its rope, lobsters walk the seabed and crawl in,
   haul before they back out. The swell, the rope and the buoy fight you; the water and buoyancy are the real simulation. */
function tide(mount){
  var c=card(mount,{title:"Tide Line",from:"Lobster Lab",instr:"Drop traps, haul them before the lobsters back out. Fill the crate to 13.",stageClass:"bp-tide",
    foot:"A toy harbor, not the real kitchen. Arrows steer the boat, Space drops a trap, hold Down to haul."});
  var cv=canvas(c,"A harbor seen from the side. Left and right arrows steer the boat, Space drops a trap, hold the Down arrow to haul the nearest trap.");
  var dropB=pill(c,"Trap","Drop a trap"), haulB=pill(c,"Haul","Haul the nearest trap, hold to keep hauling");
  var GOAL=13, TIDE=100, G=900, n=0, dx=5, s=[], v=[], ld=[], rd=[], R=0, sb=0, S=1, bodies=[], drops=[], finger=null, restNow=true;
  var st="ready", crate=0, tideLeft=TIDE, best=0, pairs=[], walkers=[], spawnT=1, swellT=4, boat={x:0,tx:0,sail:0,y:0,a:0}, autoDrop=false, ptrPair=null, haulKey=false, haulBtn=false, haulPulse=0, tick=0, flash=0, warned=0;
  try{ best=+(localStorage.getItem("k13-bench-tide")||0); }catch(e){}
  function surf(x){ var f=x/dx, i=clamp(Math.floor(f),0,n-2), u=clamp(f-i,0,1); return s[i]*(1-u)+s[i+1]*u; }
  function body(kind,x,y){
    var b={kind:kind,x:x,y:y,a:rnd(-.2,.2),vx:0,vy:0,w:0,sub:0,die:0,rad:kind==="trap"?24*S:12*S,pts:[],dcap:30,tone:0},i;
    if(kind==="trap"){ b.m=1.2; b.I=430; b.kb=1.2; b.dcap=14; b.cd=.7; for(var yy=-14;yy<=14;yy+=14) for(var xx=-25;xx<=25;xx+=12.5) b.pts.push([xx,yy]); }
    else { b.m=.7; b.I=110; b.kb=48; b.cd=2.2; for(i=0;i<8;i++){ var a=i*Math.PI/4; b.pts.push([Math.cos(a)*11,-7+Math.sin(a)*11]); } b.pts.push([0,-7]); }
    return b;
  }
  function init(W,H){
    S=clamp(Math.min(W/420,H/340),.8,1.15); n=Math.ceil(W/5)+1; dx=W/(n-1); R=Math.round(H*.46); sb=H-14;
    s=[];v=[];ld=[];rd=[]; for(var i=0;i<n;i++){ s.push(R); v.push(0); ld.push(0); rd.push(0); }
    resetGame(W);
  }
  function resetGame(W){
    W=W||sim.W(); bodies=[]; pairs=[]; walkers=[]; drops=[]; finger=null; st="ready"; crate=0; tideLeft=TIDE; boat.x=boat.tx=W*.3; boat.sail=0; autoDrop=false; ptrPair=null; spawnT=.5; warned=0; swellT=3; flash=0;
    for(var i=0;i<5;i++) walkers.push({x:rnd(.1,.9)*W,dir:Math.random()<.5?-1:1,v:rnd(16,26)*S,ph:Math.random()*6,ign:0,turn:rnd(1.5,3.5)});
  }
  function status(){ say(c,"Crate "+crate+" of "+GOAL+(st==="play"?". Tide "+Math.ceil(tideLeft)+" s.":st==="ready"?". Best haul "+best+".":"")); }
  function kick(x,amp,wid){ for(var i=0;i<n;i++){ var d=Math.abs(i*dx-x); if(d<wid) v[i]+=amp*(1-d/wid); } }
  function splash(b,vy){
    kick(b.x,vy*.0017*(b.kind==="trap"?1.6:1),b.rad*2.2);
    if(calm()) return; var k=Math.min(18,Math.round(vy/38));
    for(var i=0;i<k&&drops.length<90;i++){ var a=-1.57+rnd(-.9,.9), sp=vy*rnd(.22,.55); drops.push({x:b.x+rnd(-b.rad,b.rad),y:surf(b.x)-2,vx:Math.cos(a)*sp*.7,vy:Math.sin(a)*sp,r:rnd(1.4,2.8)}); }
  }
  function dropTrap(){
    if(st==="won"||st==="lost") return; if(pairs.length>=3){ say(c,"Three traps is the limit. Haul one first."); return; }
    var x=boat.x, y=surf(x)-10, bu=body("buoy",x-8,y-26), tr=body("trap",x+10,y-6); bu.tone=pairs.length%2; tr.vy=40; bu.vy=40;
    bodies.push(bu,tr); var depth=sb-R; pairs.push({buoy:bu,trap:tr,L:depth*1.15+40,Lmax:depth*1.15+40,inside:[],hauling:false,air:0,done:false});
    if(st==="ready"){ st="play"; } say(c,"Trap down. Crate "+crate+" of "+GOAL+". Tide "+Math.ceil(tideLeft)+" s."); sim.wake();
  }
  function resting(p){ var t=p.trap; return t.y+20*S>=sb-1.5&&Math.abs(t.vy)<40&&!p.hauling; }
  function leave(p,k){ var it=p.inside.splice(k,1)[0]; walkers.push({x:p.trap.x+rnd(-14,14),dir:Math.random()<.5?-1:1,v:rnd(22,30)*S,ph:Math.random()*6,ign:5,turn:rnd(1.5,3)}); return it; }
  function finish(p){
    p.done=true; p.buoy.die=1; p.trap.die=1; var k=p.inside.length; crate=Math.min(GOAL,crate+k); p.inside=[]; if(ptrPair===p) ptrPair=null;
    flash=1; say(c,(k?"Hauled "+k+". ":"Empty trap. ")+"Crate "+crate+" of "+GOAL+".");
    if(crate>=GOAL){ st="won"; boat.sail=1; boat.tx=sim.W()+140; best=Math.max(best,crate); try{ localStorage.setItem("k13-bench-tide",String(best)); }catch(e){} say(c,"Crate full: "+GOAL+". The boat sails home."); }
  }
  function bodyStep(b,dt,W,H){
    var ca=Math.cos(b.a), sa=Math.sin(b.a), Fx=0, Fy=b.m*G, T=0, sub=0, j;
    for(j=0;j<b.pts.length;j++){ var lx=b.pts[j][0], ly=b.pts[j][1], rx=ca*lx-sa*ly, ry=sa*lx+ca*ly, wx=b.x+rx, wy=b.y+ry, dd=wy-surf(wx);
      if(dd>0){ sub++; var vpx=b.vx-b.w*ry, vpy=b.vy+b.w*rx, f=b.kb*Math.min(dd,b.dcap), fx=-b.cd*vpx, fy=-f-b.cd*vpy; Fx+=fx; Fy+=fy; T+=rx*fy-ry*fx;
        var col=clamp(Math.round(wx/dx),0,n-1); v[col]+=vpy*.000055; } }
    if(!sub){ Fx-=b.vx*.03*b.m; Fy-=b.vy*.03*b.m; T-=b.w*b.I*.4; }
    b.vx+=Fx/b.m*dt; b.vy+=Fy/b.m*dt; b.w+=T/b.I*dt; b.vx=clamp(b.vx,-1500,1500); b.vy=clamp(b.vy,-1500,1500); b.w=clamp(b.w,-12,12);
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.a+=b.w*dt;
    if(sub>0&&!b.sub&&b.vy>140) splash(b,b.vy);
    b.sub=sub; var ext=b.kind==="trap"?20*S:6;
    if(b.x<b.rad){ b.x=b.rad; b.vx=Math.abs(b.vx)*.35; } if(b.x>W-b.rad){ b.x=W-b.rad; b.vx=-Math.abs(b.vx)*.35; }
    if(b.y+ext>sb){ b.y=sb-ext; b.vy=-Math.abs(b.vy)*.1; b.vx*=.85; b.w*=.8; }
  }
  function step(dt){
    var W=sim.W(), H=sim.H(), cm=calm(), K=.0018, D=cm?.016:.01, SP=.13, i,j,b; tick+=dt;
    for(i=0;i<n;i++){ v[i]+=-K*(s[i]-R)-D*v[i]; s[i]+=v[i]; }
    for(var ps=0;ps<3;ps++){
      for(i=0;i<n;i++){ if(i>0){ ld[i]=SP*(s[i]-s[i-1]); v[i-1]+=ld[i]; } if(i<n-1){ rd[i]=SP*(s[i]-s[i+1]); v[i+1]+=rd[i]; } }
      for(i=0;i<n;i++){ if(i>0) s[i-1]+=ld[i]; if(i<n-1) s[i+1]+=rd[i]; }
    }
    if(finger&&finger.y>R-18){ for(i=0;i<n;i++){ var d=Math.abs(i*dx-finger.x); if(d<38) v[i]+=(finger.y-s[i])*.011*(1-d/38); } }
    /* the swell: a long roll every few seconds while you fish, so the buoys heave and the ropes snatch */
    if(st==="play"){ swellT-=dt; if(swellT<=0){ swellT=cm?9:rnd(4.5,7); kick(Math.random()<.5?W*.1:W*.9,(Math.random()<.5?-1:1)*(cm?1.6:3.4),90*S); } tideLeft-=dt;
      if(tideLeft<=30&&warned<1){ warned=1; say(c,"Thirty seconds of tide left. Crate "+crate+" of "+GOAL+"."); } if(tideLeft<=10&&warned<2){ warned=2; say(c,"Ten seconds. Crate "+crate+" of "+GOAL+"."); }
      if(tideLeft<=0){ tideLeft=0; st="lost"; best=Math.max(best,crate); try{ localStorage.setItem("k13-bench-tide",String(best)); }catch(e){} say(c,"The tide is out. Crate "+crate+" of "+GOAL+". Best haul "+best+"."); } }
    /* haul and payout */
    var near=null, nd=1e9; pairs.forEach(function(p){ var d=Math.abs(p.buoy.x-boat.x); if(d<nd){ nd=d; near=p; } });
    haulPulse=Math.max(0,haulPulse-dt);
    pairs.forEach(function(p){ var want=(p===ptrPair)||((haulKey||haulBtn||haulPulse>0)&&p===near)&&!ptrPair; p.hauling=!!want&&st!=="won"&&st!=="lost";
      p.L=p.hauling?Math.max(28,p.L-170*dt):Math.min(p.Lmax,p.L+170*dt); });
    for(i=0;i<bodies.length;i++){ b=bodies[i]; if(b.die){ b.die-=dt*3; if(b.die<=0){ bodies.splice(i,1); i--; continue; } } bodyStep(b,dt,W,H); }
    for(var it=0;it<3;it++) pairs.forEach(function(p){ if(p.done) return; var A=p.buoy, B=p.trap, ex=B.x-A.x, ey=B.y-A.y, d=Math.sqrt(ex*ex+ey*ey)||1e-6;
      if(d>p.L){ var nx=ex/d, ny=ey/d, wa=1/A.m, wb=1/B.m, mv=(d-p.L)/(wa+wb); A.x+=nx*mv*wa; A.y+=ny*mv*wa; B.x-=nx*mv*wb; B.y-=ny*mv*wb;
        var vr=(B.vx-A.vx)*nx+(B.vy-A.vy)*ny; if(vr>0){ var jj=vr/(wa+wb); A.vx+=nx*jj*wa; A.vy+=ny*jj*wa; B.vx-=nx*jj*wb; B.vy-=ny*jj*wb; } } });
    for(i=0;i<drops.length;i++){ var q=drops[i]; q.vy+=G*dt; q.x+=q.vx*dt; q.y+=q.vy*dt; if(q.x<0||q.x>W){ drops.splice(i,1); i--; continue; }
      if(q.vy>0&&q.y>surf(q.x)){ v[clamp(Math.round(q.x/dx),0,n-1)]+=q.vy*.00035; drops.splice(i,1); i--; } }
    /* lobsters: walk the seabed, smell a resting trap, crawl in, back out when they feel like it */
    if(st==="play"){ spawnT-=dt; if(spawnT<=0&&walkers.length<9){ spawnT=rnd(.9,1.8); var sx=Math.random()<.5?rnd(.02,.18)*W:rnd(.82,.98)*W; walkers.push({x:sx,dir:sx<W/2?1:-1,v:rnd(20,30)*S,ph:Math.random()*6,ign:0,turn:rnd(1.5,3.5)}); } }
    for(i=walkers.length-1;st==="play"&&i>=0;i--){ var w=walkers[i]; w.ph+=dt*w.v*.35; w.ign-=dt; w.turn-=dt; var tgt=null;
      if(w.ign<=0&&st==="play") pairs.forEach(function(p){ if(!p.done&&p.inside.length<3&&resting(p)&&Math.abs(p.trap.x-w.x)<170*S&&(!tgt||Math.abs(p.trap.x-w.x)<Math.abs(tgt.trap.x-w.x))) tgt=p; });
      if(tgt){ w.dir=tgt.trap.x>w.x?1:-1; w.x+=w.dir*34*S*dt; if(Math.abs(tgt.trap.x-w.x)<12*S){ tgt.inside.push({t:rnd(3.2,6),ph:Math.random()*6}); walkers.splice(i,1); say(c,"A lobster is in the trap."); } }
      else { if(w.turn<=0){ w.dir=Math.random()<.5?-1:1; w.turn=rnd(1.5,3.5); } w.x+=w.dir*w.v*dt; if(w.x<8){ w.x=8; w.dir=1; } if(w.x>W-8){ w.x=W-8; w.dir=-1; } } }
    pairs.forEach(function(p){ if(p.done) return; var rest=resting(p); p.air=rest?0:p.air+dt;
      for(var k=p.inside.length-1;k>=0;k--){ var it=p.inside[k]; it.t-=dt; if(it.t<=0||(p.air>.7&&!p.hauling)){ leave(p,k); if(st==="play") say(c,"One backed out."); } }
      p.rattle=p.inside.some(function(it){ return it.t<1; });
      if(p.hauling&&p.L<=34&&p.trap.y<surf(p.trap.x)+26) finish(p); });
    pairs=pairs.filter(function(p){ return !p.done; });
    /* the boat rides the surface */
    var bx=boat.tx-boat.x; boat.x+=clamp(bx,-1,1)*Math.min(Math.abs(bx)*4,boat.sail?60*S:150*S)*dt; if(autoDrop&&Math.abs(boat.tx-boat.x)<6){ autoDrop=false; dropTrap(); }
    var sy=surf(clamp(boat.x,0,W)), sl=(surf(clamp(boat.x+20,0,W))-surf(clamp(boat.x-20,0,W)))/40; boat.y=sy; boat.a=Math.atan(sl)*.9; flash=Math.max(0,flash-dt*1.5);
    var mw=0,me=0; for(i=0;i<n;i++){ mw=Math.max(mw,Math.abs(v[i])); me=Math.max(me,Math.abs(s[i]-R)); }
    var bs=0; bodies.forEach(function(b){ bs=Math.max(bs,Math.abs(b.vx)+Math.abs(b.vy)+Math.abs(b.w)*10); });
    restNow=st!=="play"&&mw<.02&&me<.3&&bs<30&&!drops.length&&!finger&&Math.abs(boat.tx-boat.x)<2;
  }
  function drawLobster(ctx,x,y,dir,ph,sc){
    ctx.save(); ctx.translate(x,y); ctx.scale(dir*sc,sc); ctx.strokeStyle="#B8321F"; ctx.lineWidth=1.4; ctx.lineCap="round";
    for(var k=0;k<4;k++){ var o=Math.sin(ph+k*1.3)*2.2; ctx.beginPath(); ctx.moveTo(-3+k*3,-3); ctx.lineTo(-5+k*3+o,2); ctx.stroke(); }
    ctx.fillStyle="#D94B3A"; ctx.beginPath(); ctx.ellipse(0,-5,8,4,0,0,6.283); ctx.fill(); ctx.beginPath(); ctx.moveTo(-6,-5); ctx.lineTo(-13,-3); ctx.lineTo(-13,-8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(10,-8,3.2,0,6.283); ctx.arc(10,-2,3.2,0,6.283); ctx.fill(); ctx.strokeStyle="#D94B3A"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(6,-6); ctx.lineTo(9,-8); ctx.moveTo(6,-4); ctx.lineTo(9,-2); ctx.stroke();
    ctx.restore();
  }
  function drawBody(ctx,b){
    ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.a); if(b.die) ctx.globalAlpha=Math.max(0,b.die);
    if(b.kind==="trap"){
      ctx.fillStyle="rgba(190,150,90,.28)"; ctx.strokeStyle="#6B4A2A"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-27,16); ctx.lineTo(-27,-10); ctx.quadraticCurveTo(0,-26,27,-10); ctx.lineTo(27,16); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle="rgba(107,74,42,.55)"; ctx.lineWidth=1; for(var k=-18;k<=18;k+=9){ ctx.beginPath(); ctx.moveTo(k,16); ctx.lineTo(k,-16); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-27,3); ctx.lineTo(27,3); ctx.stroke();
    } else {
      ctx.strokeStyle="#3A2314"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(0,-31); ctx.stroke(); ctx.fillStyle="#FE6700"; ctx.beginPath(); ctx.moveTo(0,-31); ctx.lineTo(10,-27); ctx.lineTo(0,-23); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0,-7,11,0,6.283); ctx.clip(); ctx.fillStyle=b.tone?"#FFF4E2":"#D94B3A"; ctx.fillRect(-12,-19,24,24); ctx.fillStyle=b.tone?"#D94B3A":"#FFF4E2"; ctx.fillRect(-12,-11,24,7); ctx.fillStyle="rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(-4,-12,3,5,.5,0,6.283); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#3A2314"; ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(0,-7,11,0,6.283); ctx.stroke();
    }
    ctx.restore();
  }
  function drawBoat(ctx){
    ctx.save(); ctx.translate(boat.x,boat.y+3*S); ctx.rotate(boat.a); ctx.scale(S,S);
    ctx.fillStyle="#1D3557"; ctx.beginPath(); ctx.moveTo(-38,-14); ctx.lineTo(40,-14); ctx.lineTo(30,8); ctx.lineTo(-30,8); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#D94B3A"; ctx.fillRect(-36,-14,74,4); ctx.fillStyle="#F6EEDC"; ctx.fillRect(-14,-32,22,18); ctx.fillStyle="#9CC6D6"; ctx.fillRect(-10,-28,6,7); ctx.fillStyle="#D94B3A"; ctx.fillRect(-16,-35,26,4);
    ctx.strokeStyle="#3A2314"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(28,-14); ctx.lineTo(28,-34); ctx.lineTo(16,-34); ctx.stroke();
    ctx.fillStyle="#FE6700"; ctx.beginPath(); ctx.moveTo(-26,-14); ctx.lineTo(-26,-40); ctx.lineTo(-14,-36); ctx.lineTo(-26,-32); ctx.fill(); ctx.strokeStyle="#3A2314"; ctx.beginPath(); ctx.moveTo(-26,-14); ctx.lineTo(-26,-40); ctx.stroke();
    if(crate>0){ ctx.fillStyle="#6B4A2A"; ctx.fillRect(14,-22,16,8); ctx.fillStyle="#D94B3A"; for(var k=0;k<Math.min(5,crate);k++){ ctx.beginPath(); ctx.arc(17+k*3,-24,2,0,6.283); ctx.fill(); } }
    ctx.restore();
  }
  function draw(ctx,W,H){
    var i, sk=ctx.createLinearGradient(0,0,0,R); sk.addColorStop(0,"#BFE0EC"); sk.addColorStop(1,"#F8F0DE"); ctx.fillStyle=sk; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="rgba(255,255,255,.7)"; [[.18,.1,26],[.62,.17,32],[.84,.07,22]].forEach(function(cl){ var x=cl[0]*W,y=R*cl[1]*2.2+30; ctx.beginPath(); ctx.ellipse(x,y,cl[2],cl[2]*.38,0,0,6.283); ctx.ellipse(x+cl[2]*.6,y+3,cl[2]*.7,cl[2]*.3,0,0,6.283); ctx.fill(); });
    var sd=ctx.createLinearGradient(0,H-26,0,H); sd.addColorStop(0,"#D8C594"); sd.addColorStop(1,"#BBA574"); ctx.fillStyle=sd; ctx.fillRect(0,H-20,W,20);
    ctx.fillStyle="#8F7B50"; for(i=0;i<W;i+=37){ ctx.beginPath(); ctx.ellipse(i+((i*7)%11),H-12,5,2.6,0,0,6.283); ctx.fill(); }
    drawBoat(ctx);
    pairs.forEach(function(p){ var A=p.buoy, B=p.trap, d=Math.hypot(B.x-A.x,B.y-A.y), sag=Math.max(0,p.L-d)*.5; ctx.strokeStyle=p.hauling?"#FFF4E2":"#5C4430"; ctx.lineWidth=p.hauling?2.4:1.8;
      ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.quadraticCurveTo((A.x+B.x)/2+(p.hauling?0:8),(A.y+B.y)/2+sag,B.x,B.y); ctx.stroke(); });
    walkers.forEach(function(w){ drawLobster(ctx,w.x,sb-1,w.dir,w.ph,S); });
    bodies.forEach(function(b){ if(b.kind==="trap"){ var p=pairs.filter(function(q){ return q.trap===b; })[0]; if(p&&p.rattle&&!calm()){ b.x+=Math.sin(tick*70)*.8; }
        drawBody(ctx,b); if(p){ ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.a); p.inside.forEach(function(it,k){ drawLobster(ctx,-14+k*14,12,k%2?-1:1,it.ph+tick*(it.t<1?14:3),.8*S); }); ctx.restore(); } } else drawBody(ctx,b); });
    var wg=ctx.createLinearGradient(0,R-20,0,H); wg.addColorStop(0,"rgba(40,138,168,.72)"); wg.addColorStop(.55,"rgba(14,84,128,.82)"); wg.addColorStop(1,"rgba(1,58,113,.92)");
    ctx.fillStyle=wg; ctx.beginPath(); ctx.moveTo(0,H); for(i=0;i<n;i++) ctx.lineTo(i*dx,s[i]); ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,.75)"; ctx.lineWidth=2; ctx.lineJoin="round"; ctx.beginPath(); for(i=0;i<n;i++){ if(i) ctx.lineTo(i*dx,s[i]); else ctx.moveTo(0,s[0]); } ctx.stroke();
    ctx.strokeStyle="rgba(255,255,255,.14)"; ctx.lineWidth=1; for(var g=1;g<4;g++){ ctx.beginPath(); for(i=0;i<n;i++){ var y=s[i]+g*22+Math.sin(i*.3+g)*1.5; if(i) ctx.lineTo(i*dx,y); else ctx.moveTo(0,y); } ctx.stroke(); }
    ctx.fillStyle="rgba(240,248,252,.9)"; drops.forEach(function(q){ ctx.beginPath(); ctx.arc(q.x,q.y,q.r,0,6.283); ctx.fill(); });
    /* the crate (13 slots) and the tide meter */
    var px=14, py=58, pw=Math.min(W*.6,150), step=pw/GOAL; ctx.fillStyle="rgba(20,29,53,.5)"; ctx.fillRect(px-5,py-8,pw+10,24); 
    for(i=0;i<GOAL;i++){ ctx.fillStyle=i<crate?"#FE6700":"rgba(246,238,220,.28)"; ctx.beginPath(); ctx.arc(px+step*(i+.5),py,Math.min(4.2,step*.36),0,6.283); ctx.fill(); }
    ctx.fillStyle="rgba(246,238,220,.28)"; ctx.fillRect(px,py+9,pw,3); ctx.fillStyle=tideLeft<20?"#FFD27A":"#9CC6D6"; ctx.fillRect(px,py+9,pw*(tideLeft/TIDE),3);
    if(flash>0){ ctx.fillStyle="rgba(254,103,0,"+(flash*.25)+")"; ctx.fillRect(0,0,W,H); }
    if(st==="won"){ ctx.font="600 "+Math.round(20*S)+"px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.fillStyle="#141D35"; ctx.fillText("Crate full. Sailing home.",W/2,R-34*S); }
    if(st==="lost"){ ctx.font="600 "+Math.round(18*S)+"px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.fillStyle="#141D35"; ctx.fillText("The tide is out. Tap to fish again.",W/2,R-34*S); }
  }
  var sim=Sim(c,cv,{resize:function(W,H){ init(W,H); },step:step,draw:draw,rest:function(){ return restNow; },
    enter:function(){ if(!calm()){ kick(sim.W()*.12,-4,60); kick(sim.W()*.12+90,3,60); } status(); }});
  pointer(cv,sim,{
    down:function(p){
      if(st==="won"||st==="lost"){ resetGame(); status(); return; }
      var hit=null,bd=38*S; pairs.forEach(function(q){ var d=Math.hypot(q.buoy.x-p.x,q.buoy.y-12-p.y); if(d<bd){ bd=d; hit=q; } });
      if(hit){ ptrPair=hit; }
      else if(p.y<surf(p.x)-14){ boat.tx=clamp(p.x,30,sim.W()-30); autoDrop=true; }
      else finger={x:p.x,y:p.y}; },
    move:function(p,down){ if(down&&finger){ finger.x=p.x; finger.y=p.y; sim.wake(); } },
    up:function(){ ptrPair=null; finger=null; }
  });
  cv.addEventListener("keydown",function(e){
    var stp=sim.W()*.06;
    if(st==="won"||st==="lost"){ if(e.key===" "||e.key==="Enter"){ resetGame(); status(); e.preventDefault(); sim.wake(); sim.draw(); } return; }
    if(e.key==="ArrowLeft") boat.tx=clamp(boat.tx-stp,30,sim.W()-30); else if(e.key==="ArrowRight") boat.tx=clamp(boat.tx+stp,30,sim.W()-30);
    else if(e.key===" "||e.key==="Enter"){ dropTrap(); }
    else if(e.key==="ArrowDown"){ haulKey=true; }
    else if(e.key==="ArrowUp"){ kick(boat.x,calm()?-3:-7,70); }
    else return; e.preventDefault(); sim.wake(); });
  cv.addEventListener("keyup",function(e){ if(e.key==="ArrowDown"){ haulKey=false; } });
  cv.addEventListener("blur",function(){ haulKey=false; });
  dropB.addEventListener("click",function(){ if(st==="won"||st==="lost"){ resetGame(); status(); } else dropTrap(); sim.wake(); });
  haulB.addEventListener("pointerdown",function(e){ haulBtn=true; try{ haulB.setPointerCapture(e.pointerId); }catch(x){} sim.wake(); });
  function haulUp(){ haulBtn=false; } haulB.addEventListener("pointerup",haulUp); haulB.addEventListener("pointercancel",haulUp);
  haulB.addEventListener("click",function(e){ if(e.detail===0){ haulPulse=1.6; sim.wake(); } });
  c.reset.addEventListener("click",function(){ s=[]; init(sim.W(),sim.H()); status(); sim.wake(); sim.draw(); });
}

/* ======================= 4. Stack Attack (Cosmos Burger): soft quads, SAT contacts ======================= */
function stack(mount){
  var c=card(mount,{title:"Stack Attack",from:"Cosmos Burger",instr:"Stack 11 layers on the plate. Bump the table if you dare.",stageClass:"bp-light bp-stack",
    foot:"A toy burger, not the menu. Arrows slide the drop point, Space stacks, Up bumps."});
  var cv=canvas(c,"A plate on a counter. Left and right arrows slide the drop point, Space stacks the next layer, Up bumps the table.");
  var stackB=pill(c,"Stack","Stack the next layer"), bumpB=pill(c,"Bump","Bump the table");
  var SPEC={bunB:{n:"bottom bun",w:96,h:20},patty:{n:"patty",w:100,h:14},cheese:{n:"cheese",w:104,h:9},lettuce:{n:"lettuce",w:106,h:10},tomato:{n:"tomato",w:92,h:10},bunT:{n:"top bun",w:96,h:30}};
  var ORDER=["bunB","patty","cheese","lettuce","tomato","patty","cheese","bunT"], oi=0, bodies=[], plate=null, floorY=0, dropX=0, grab=null, restNow=false, calmT=0, snap=null, snapT=0, G=1450, GOAL=11, won=false, winT=0, flagT=0;
  function mk(kind,cx,cy,ang,w,h,spin){
    var hw=w/2, hh=h/2, loc=[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]], ca=Math.cos(ang), sa=Math.sin(ang), p=[];
    loc.forEach(function(q){ var x=cx+ca*q[0]-sa*q[1], y=cy+sa*q[0]+ca*q[1], rx=x-cx, ry=y-cy; p.push({x:x,y:y,px:x+spin*ry,py:y-spin*rx}); });
    var cons=[[0,1,w,1],[1,2,h,1],[2,3,w,1],[3,0,h,1],[0,2,Math.hypot(w,h),.9],[1,3,Math.hypot(w,h),.9]];
    return {kind:kind,p:p,cons:cons,die:0,spec:SPEC[kind],seed:Math.random()};
  }
  function build(W,H,keep){
    floorY=H-34; var pt=floorY-12, cx=W/2;
    plate={st:true,p:[{x:cx-70,y:pt},{x:cx+70,y:pt},{x:cx+62,y:pt+12},{x:cx-62,y:pt+12}]}; plate.p.forEach(function(q){ q.px=q.x; q.py=q.y; });
    if(!keep){ bodies=[]; oi=0; grab=null; dropX=cx; }
    bodies.forEach(function(b){ b.p.forEach(function(q){ q.x=clamp(q.x,6,W-6); }); });
  }
  function add(){
    var kind=ORDER[oi%ORDER.length]; oi++; var sp=SPEC[kind], W=sim.W();
    if(bodies.length>=15){ for(var i=0;i<bodies.length;i++) if(!bodies[i].die&&bodies[i]!==(grab&&grab.b)){ bodies[i].die=1; break; } }
    bodies.push(mk(kind,clamp(dropX,60,W-60),60,rnd(-.035,.035),sp.w,sp.h,rnd(-.003,.003))); sim.wake();
    say(c,Math.min(GOAL,onPlate()+1)+" of "+GOAL+" so far. Next: "+SPEC[ORDER[oi%ORDER.length]].n+".");
  }
  function sat(A,B){
    var best=1e9,bn=null,bo=null,bx=null,be=0,bv=0,k,e,i;
    for(k=0;k<2;k++){ var O=k?B:A, X=k?A:B;
      for(e=0;e<4;e++){ var p1=O.p[e], p2=O.p[(e+1)&3], ex=p2.x-p1.x, ey=p2.y-p1.y, len=Math.sqrt(ex*ex+ey*ey)||1e-6, nx=ey/len, ny=-ex/len, cc=nx*p1.x+ny*p1.y, mn=1e9, mi=0;
        for(i=0;i<4;i++){ var pr=nx*X.p[i].x+ny*X.p[i].y; if(pr<mn){ mn=pr; mi=i; } }
        var ov=cc-mn; if(ov<=0) return; if(ov<best){ best=ov; bn=[nx,ny]; bo=O; bx=X; be=e; bv=mi; } } }
    var v=bx.p[bv], e1=bo.p[be], e2=bo.p[(be+1)&3], dx=e2.x-e1.x, dy=e2.y-e1.y, l2=dx*dx+dy*dy||1e-6, t=clamp(((v.x-e1.x)*dx+(v.y-e1.y)*dy)/l2,0,1), lam=1/(t*t+(1-t)*(1-t)),
        wo=bo.st?0:1, wx=bx.st?0:1, ws=wo+wx; if(!ws) return; var fo=wo/ws, fx=wx/ws, d=best, nx2=bn[0], ny2=bn[1];
    v.x+=nx2*d*fx; v.y+=ny2*d*fx; e1.x-=nx2*d*fo*(1-t)*lam; e1.y-=ny2*d*fo*(1-t)*lam; e2.x-=nx2*d*fo*t*lam; e2.y-=ny2*d*fo*t*lam;
    var tx=-ny2, ty=nx2, rvx=(v.x-v.px)-((1-t)*(e1.x-e1.px)+t*(e2.x-e2.px)), rvy=(v.y-v.py)-((1-t)*(e1.y-e1.py)+t*(e2.y-e2.py)), rt=rvx*tx+rvy*ty, mu=Math.abs(rt)<.45?1:.8;
    v.px+=tx*rt*mu*fx; v.py+=ty*rt*mu*fx; e1.px-=tx*rt*mu*fo*(1-t); e1.py-=ty*rt*mu*fo*(1-t); e2.px-=tx*rt*mu*fo*t; e2.py-=ty*rt*mu*fo*t;
  }
  function step(dt){
    var W=sim.W(), H=sim.H(), cm=calm(), drag=cm?.99:.9962, i,j,k,b,p;
    for(i=bodies.length-1;i>=0;i--){ b=bodies[i]; if(b.die){ b.die-=dt*3; if(b.die<=0){ bodies.splice(i,1); if(grab&&grab.b===b) grab=null; continue; } }
      for(j=0;j<4;j++){ p=b.p[j]; var vx=(p.x-p.px)*drag, vy=(p.y-p.py)*drag, sp=Math.sqrt(vx*vx+vy*vy); if(sp>3.3){ vx*=3.3/sp; vy*=3.3/sp; } p.px=p.x; p.py=p.y; p.x+=vx; p.y+=vy+G*dt*dt; } }
    for(var it=0;it<9;it++){
      for(i=0;i<bodies.length;i++){ b=bodies[i];
        for(k=0;k<6;k++){ var cn=b.cons[k], a=b.p[cn[0]], q=b.p[cn[1]], dx=q.x-a.x, dy=q.y-a.y, d=Math.sqrt(dx*dx+dy*dy)||1e-6, df=(d-cn[2])/d*.5*cn[3]; a.x+=dx*df; a.y+=dy*df; q.x-=dx*df; q.y-=dy*df; }
        if(grab&&grab.b===b){ var gp=b.p[grab.i]; gp.x+=(grab.tx-gp.x)*.12; gp.y+=(grab.ty-gp.y)*.12; } }
      for(i=0;i<bodies.length;i++){ var A=bodies[i]; sat(plate,A); for(j=i+1;j<bodies.length;j++){ var B=bodies[j]; if(aabb(A,B)) sat(A,B); } }
      for(i=0;i<bodies.length;i++){ b=bodies[i];
        for(j=0;j<4;j++){ p=b.p[j];
          if(p.y>floorY){ var vin=p.y-p.py; p.y=floorY; p.py=floorY+(vin>1.6?.12*vin:0); p.px+=(p.x-p.px)*.45; }
          if(p.x<6){ p.px=6+(p.x-p.px)*.3; p.x=6; } else if(p.x>W-6){ p.px=W-6+(p.x-p.px)*.3; p.x=W-6; } } }
    }
    /* rest = nothing drifted more than a pixel in the last quarter second (a contact that flips between two
       equal positions every step is at rest to the eye, so speed alone is the wrong test) */
    snapT+=dt; if(!snap||snap.n!==bodies.length){ snap=takeSnap(); snapT=0; }
    if(snapT>=.25){ var dr=0; bodies.forEach(function(b,bi){ for(var j=0;j<4;j++){ dr=Math.max(dr,Math.abs(b.p[j].x-snap.v[bi*8+j*2]),Math.abs(b.p[j].y-snap.v[bi*8+j*2+1])); } }); restNow=dr<.9&&!grab; snap=takeSnap(); snapT=0; }
    if(grab) restNow=false;
    if(won) winT+=dt;
    if(restNow&&!calmT){ calmT=1; reportStack(); } else if(!restNow) calmT=0;
    if(won&&winT<1.2) restNow=false;
  }
  function takeSnap(){ var v=[]; bodies.forEach(function(b){ for(var j=0;j<4;j++){ v.push(b.p[j].x,b.p[j].y); } }); return {n:bodies.length,v:v}; }
  function aabb(A,B){ var a0=1e9,a1=-1e9,b0=1e9,b1=-1e9,c0=1e9,c1=-1e9,d0=1e9,d1=-1e9,i; for(i=0;i<4;i++){ a0=Math.min(a0,A.p[i].x); a1=Math.max(a1,A.p[i].x); b0=Math.min(b0,A.p[i].y); b1=Math.max(b1,A.p[i].y); c0=Math.min(c0,B.p[i].x); c1=Math.max(c1,B.p[i].x); d0=Math.min(d0,B.p[i].y); d1=Math.max(d1,B.p[i].y); } return a0<c1&&c0<a1&&b0<d1&&d0<b1; }
  function onPlate(){ var on=0; bodies.forEach(function(b){ if(b.die) return; if(Math.max(b.p[2].y,b.p[3].y)<floorY-8) on++; }); return on; }
  function reportStack(){ var on=onPlate(), tot=0; bodies.forEach(function(b){ if(!b.die) tot++; }); if(!tot) return;
    if(on>=GOAL&&!won){ won=true; winT=0; say(c,"Eleven high and still standing. Skyscraper burger."); return; }
    if(won) return; say(c,on+" of "+GOAL+" high on the plate."+(tot>on?" "+(tot-on)+" on the counter.":"")); }
  function path(ctx,b,pts){ var P=b.p, i, u, v, a, bb, cc, dd; ctx.beginPath();
    for(i=0;i<pts.length;i+=2){ u=pts[i]; v=pts[i+1]; a=(1-u)*(1-v); bb=u*(1-v); cc=u*v; dd=(1-u)*v;
      var x=a*P[0].x+bb*P[1].x+cc*P[2].x+dd*P[3].x, y=a*P[0].y+bb*P[1].y+cc*P[2].y+dd*P[3].y; if(i) ctx.lineTo(x,y); else ctx.moveTo(x,y); } ctx.closePath(); }
  function pm(b,u,v){ var P=b.p, a=(1-u)*(1-v), bb=u*(1-v), cc=u*v, dd=(1-u)*v; return [a*P[0].x+bb*P[1].x+cc*P[2].x+dd*P[3].x, a*P[0].y+bb*P[1].y+cc*P[2].y+dd*P[3].y]; }
  var SH={};
  (function(){ var i,u;
    SH.bunT=[]; for(i=0;i<=24;i++){ u=i/24; SH.bunT.push(u,1-Math.pow(Math.sin(Math.PI*u),.5)); } SH.bunT.push(1,1,0,1);
    SH.bunB=[0,0,1,0,1,.55]; for(i=0;i<=12;i++){ u=1-i/12; SH.bunB.push(u,1-.45*Math.pow(1-Math.sin(Math.PI*u),2.4)); } SH.bunB.push(0,.55);
    SH.patty=[]; for(i=0;i<=20;i++){ u=i/20; SH.patty.push(u,.06+.06*Math.sin(u*31)+.04*Math.sin(u*13)); } for(i=20;i>=0;i--){ u=i/20; SH.patty.push(u,.94-.06*Math.sin(u*27+1)-.03*Math.sin(u*11)); }
    SH.cheese=[-.03,0,1.03,0,1.03,1,.82,1,.78,1.85,.7,1,.3,1,.26,1.55,.18,1,-.03,1];
    SH.lettuce=[]; for(i=0;i<=40;i++){ u=-.04+1.08*i/40; SH.lettuce.push(u,.35+.35*Math.sin(i*1.7)*.5-.12); } for(i=40;i>=0;i--){ u=-.04+1.08*i/40; SH.lettuce.push(u,.75+.3*Math.sin(i*2.1+1)*.5); }
    SH.tomato=[]; for(i=0;i<=20;i++){ u=i/20; SH.tomato.push(.03+.94*u,.5-.5*Math.pow(Math.abs(Math.sin(Math.PI*u)),.25)); } for(i=20;i>=0;i--){ u=i/20; SH.tomato.push(.03+.94*u,.5+.5*Math.pow(Math.abs(Math.sin(Math.PI*u)),.25)); } })();
  var COL={bunB:["#E3A33C","#9A5F1A"],bunT:["#E8A93E","#9A5F1A"],patty:["#5C3A2A","#2E1A10"],cheese:["#FFC21A","#C98F00"],lettuce:["#6DBE45","#3E7C28"],tomato:["#D8402B","#8E2314"]};
  function drawBody(ctx,b){
    var cl=COL[b.kind], pts=SH[b.kind]; ctx.save(); if(b.die) ctx.globalAlpha=Math.max(0,b.die);
    path(ctx,b,pts); ctx.fillStyle=cl[0]; ctx.fill(); ctx.strokeStyle=cl[1]; ctx.lineWidth=1.8; ctx.lineJoin="round"; ctx.stroke();
    if(b.kind==="bunT"){ var h=pm(b,.34,.32), h2=pm(b,.5,.2); ctx.strokeStyle="rgba(255,243,200,.55)"; ctx.lineWidth=3; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(h[0],h[1]); ctx.quadraticCurveTo(h2[0],h2[1],pm(b,.66,.24)[0],pm(b,.66,.24)[1]); ctx.stroke();
      ctx.fillStyle="#FFF0C8"; [[.22,.62],[.38,.5],[.52,.38],[.66,.5],[.8,.62],[.45,.74],[.6,.72]].forEach(function(s){ var q=pm(b,s[0],s[1]); ctx.beginPath(); ctx.ellipse(q[0],q[1],2.6,1.5,Math.atan2(b.p[1].y-b.p[0].y,b.p[1].x-b.p[0].x)+s[0]*2,0,6.283); ctx.fill(); }); }
    else if(b.kind==="bunB"){ var l=pm(b,.1,.2), r2=pm(b,.9,.2); ctx.strokeStyle="rgba(255,243,200,.4)"; ctx.lineWidth=2.5; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(l[0],l[1]); ctx.lineTo(r2[0],r2[1]); ctx.stroke(); }
    else if(b.kind==="patty"){ ctx.fillStyle="rgba(255,255,255,.14)"; [[.2,.4],[.35,.6],[.5,.35],[.65,.6],[.8,.4]].forEach(function(s){ var q=pm(b,s[0],s[1]); ctx.beginPath(); ctx.arc(q[0],q[1],1.6,0,6.283); ctx.fill(); }); }
    else if(b.kind==="tomato"){ var a1=pm(b,.12,.5), a2=pm(b,.88,.5); ctx.strokeStyle="rgba(255,190,170,.55)"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(a1[0],a1[1]); ctx.lineTo(a2[0],a2[1]); ctx.stroke(); }
    ctx.restore();
  }
  function draw(ctx,W,H){
    var i, bg=ctx.createLinearGradient(0,0,0,H); bg.addColorStop(0,"#FFEFC4"); bg.addColorStop(1,"#FFD98A"); ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="rgba(198,12,0,.07)"; ctx.lineWidth=1; for(i=0;i<W;i+=34){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,floorY); ctx.stroke(); } for(i=40;i<floorY;i+=34){ ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(W,i); ctx.stroke(); }
    ctx.fillStyle="#C60C00"; ctx.fillRect(0,floorY,W,H-floorY); ctx.fillStyle="#FFF2E1"; for(i=0;i<W;i+=26){ ctx.fillRect(i,floorY+8,13,7); ctx.fillRect(i+13,floorY+15,13,7); } ctx.fillStyle="#8E0900"; ctx.fillRect(0,floorY,W,3);
    var pt=plate.p[0].y; ctx.fillStyle="rgba(60,20,0,.18)"; ctx.beginPath(); ctx.ellipse(W/2,floorY+3,86,6,0,0,6.283); ctx.fill();
    ctx.fillStyle="#FFFFFF"; ctx.strokeStyle="#C9B89A"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.ellipse(W/2,pt+4,82,9,0,0,6.283); ctx.fill(); ctx.stroke(); ctx.fillStyle="#EFE6D4"; ctx.beginPath(); ctx.ellipse(W/2,pt+3,58,5,0,0,6.283); ctx.fill();
    if(!grab||true){ var nk=ORDER[oi%ORDER.length], sp=SPEC[nk]; ctx.save(); ctx.globalAlpha=.55; ctx.strokeStyle="#8E2314"; ctx.setLineDash([4,4]); ctx.lineWidth=1.5; ctx.strokeRect(dropX-sp.w/2,50,sp.w,Math.max(sp.h,14)); ctx.restore();
      ctx.strokeStyle="rgba(142,35,20,.5)"; ctx.setLineDash([2,5]); ctx.beginPath(); ctx.moveTo(dropX,50+Math.max(sp.h,14)); ctx.lineTo(dropX,pt-4); ctx.stroke(); ctx.setLineDash([]); }
    for(i=0;i<bodies.length;i++) drawBody(ctx,bodies[i]);
    var on=onPlate(); for(i=0;i<GOAL;i++){ ctx.fillStyle=i<on?"#C60C00":"rgba(142,35,20,.2)"; ctx.beginPath(); ctx.arc(18+i*11,H-0-(H-floorY)-12-0,3.6,0,6.283); ctx.fill(); }
    if(won){ var top=1e9,tx=W/2; bodies.forEach(function(b){ if(b.die) return; for(var j=0;j<4;j++) if(b.p[j].y<top&&Math.max(b.p[2].y,b.p[3].y)<floorY-8){ top=b.p[j].y; tx=(b.p[0].x+b.p[1].x)/2; } });
      if(top<1e8){ var k=Math.min(1,winT*3); ctx.strokeStyle="#3A2314"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(tx,top+2); ctx.lineTo(tx,top-30*k); ctx.stroke(); ctx.fillStyle="#C60C00"; ctx.beginPath(); ctx.moveTo(tx,top-30*k); ctx.lineTo(tx+20*k,top-24*k); ctx.lineTo(tx,top-18*k); ctx.fill(); } }
  }
  var sim=Sim(c,cv,{resize:function(W,H,first){ build(W,H,!first); },step:step,draw:draw,rest:function(){ return restNow; },
    enter:function(){ say(c,"0 of "+GOAL+" high on the plate."); }});
  function inside(b,x,y){ var s=0; for(var i=0;i<4;i++){ var p=b.p[i], q=b.p[(i+1)&3], cr=(q.x-p.x)*(y-p.y)-(q.y-p.y)*(x-p.x); if(cr>0) s++; else s--; } return Math.abs(s)===4; }
  pointer(cv,sim,{
    down:function(p){ var hit=null; for(var i=bodies.length-1;i>=0;i--){ var b=bodies[i]; if(!b.die&&inside(b,p.x,p.y)){ hit=b; break; } }
      if(!hit) for(var j=bodies.length-1;j>=0&&!hit;j--) for(var k=0;k<4;k++) if(!bodies[j].die&&Math.hypot(bodies[j].p[k].x-p.x,bodies[j].p[k].y-p.y)<16){ hit=bodies[j]; break; }
      if(hit){ var bi=0,bd=1e9; for(var m=0;m<4;m++){ var d=Math.hypot(hit.p[m].x-p.x,hit.p[m].y-p.y); if(d<bd){ bd=d; bi=m; } } grab={b:hit,i:bi,tx:p.x,ty:p.y}; }
      else { dropX=clamp(p.x,60,sim.W()-60); add(); } },
    move:function(p,down){ if(grab&&down){ grab.tx=clamp(p.x,10,sim.W()-10); grab.ty=clamp(p.y,10,floorY-4); sim.wake(); } },
    up:function(){ grab=null; }
  });
  function bump(){ var k=calm()?.4:1; bodies.forEach(function(b){ var dx=rnd(-.9,.9)*k; for(var j=0;j<4;j++){ b.p[j].py=b.p[j].y+rnd(1.9,2.7)*k; b.p[j].px=b.p[j].x-dx; } }); say(c,"The counter jumps."); sim.wake(); }
  cv.addEventListener("keydown",function(e){
    var st=sim.W()*.06;
    if(e.key==="ArrowLeft") dropX=clamp(dropX-st,60,sim.W()-60); else if(e.key==="ArrowRight") dropX=clamp(dropX+st,60,sim.W()-60);
    else if(e.key===" "||e.key==="Enter"||e.key==="ArrowDown"){ add(); }
    else if(e.key==="ArrowUp"){ bump(); }
    else return; e.preventDefault(); sim.wake(); sim.draw(); });
  stackB.addEventListener("click",add); bumpB.addEventListener("click",bump);
  c.reset.addEventListener("click",function(){ bodies=[]; oi=0; grab=null; won=false; winT=0; say(c,"0 of "+GOAL+" high on the plate."); sim.wake(); sim.draw(); });
}

/* ======================= 5. Sunny Side Up (Egg&Out): crack, cook, flip ======================= */
/* Goal: land 5 clean flips (one full turn, yolk back up). The shell, the drop and the pan are re-authored from Egg&Out's
   "From shell to pan" film. The egg is a rigid flat body with contact points against the moving pan (real impulses, friction,
   restitution) plus spring-damped white and yolk. Broken yolk (raw toss, hard landing) or an egg on the floor ends the round. */
function eggToss(mount){
  var c=card(mount,{title:"Sunny Side Up",from:"Egg&Out",instr:"Tap to crack an egg into the pan, then flick the pan up to flip it.",stageClass:"bp-light bp-egg",
    foot:"A toy pan, not the kitchen. Space cracks and tosses, arrows move the pan."});
  var cv=canvas(c,"A black pan on a cream counter. Space cracks an egg and then tosses it. Left and right arrows move the pan, up and down raise and lower it.");
  var crackB=pill(c,"Crack","Crack an egg into the pan"), tossB=pill(c,"Toss","Toss the egg");
  var TAU=Math.PI*2, G=1700, GOAL=5, W=0,H=0,S=1, floorY=0, hw=90, R=54, T=6.5, wallH=14, homeX=0, homeY=0;
  var st="idle", crackT=0, flips=0, best=0, egg=null, sizzle=0, plateT=0, msg="", tossQ=-1, restNow=true, T0=0;
  try{ best=+(localStorage.getItem("k13-bench-egg")||0); }catch(e){}
  var TOSS=38, tick=0;
  var pan={tossHome:0,x:0,y:0,vx:0,vy:0,a:0,wa:0,tx:0,ty:0,ta:0};
  function bez(x1,y1,x2,y2){var cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;function sx(t){return((ax*t+bx)*t+cx)*t;}function sy(t){return((ay*t+by)*t+cy)*t;}
    return function(x){if(x<=0)return 0;if(x>=1)return 1;var lo=0,hi=1,t=x;for(var i=0;i<30;i++){var q=sx(t);if(Math.abs(q-x)<1e-6)break;if(q<x)lo=t;else hi=t;t=(lo+hi)/2;}return sy(t);};}
  var eOut=bez(.22,1,.36,1), eBack=bez(.34,1.56,.64,1), eIO=bez(.65,0,.35,1), eIn=bez(.55,0,1,.45);
  function P(t,a,b){ return clamp((t-a)/(b-a),0,1); }
  function hash(n){ var x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); }
  var C={ground:"#f0ebd7",shade:"#e2d8bf",pan:"#212121",panIn:"#3a3631",shell:"#d59a62",shellHi:"#e9bd90",shellIn:"#f6ead3",raw:"#f5efe1",white:"#fffdf6",edge:"#e2d7bf",lace:"#e9a24a",yolk:"#f2aa00",yolkHi:"#ffcd00",yolkRim:"#ec8b00"};
  var CRACK=[[-64,4],[-44,-10],[-26,6],[-8,-12],[10,4],[28,-10],[46,6],[64,-4]];
  var K=function(){ return calm()?.3:.55; };  /* the film's clock, compressed so a round starts fast */
  function layout(w,h){
    W=w; H=h; S=clamp(Math.min(w/560,h/300),.72,1.4); floorY=h-30*S; hw=88*S; R=52*S; T=6.5*S; wallH=14*S; homeX=w*.42; homeY=h*.66;
    pan.x=pan.tx=clamp(pan.x||homeX,hw+16,w-hw-16); pan.y=pan.ty=pan.y?clamp(pan.y,70*S,floorY-60*S):homeY;
  }
  function startCrack(){ st="crack"; crackT=0; flips=0; egg=null; msg=""; say(c,"Cracking. Flips 0 of "+GOAL+". Best "+best+"."); sim.wake(); }
  function spawnEgg(){
    egg={x:pan.x,y:pan.y-T*2,vx:0,vy:0,a:0,w:0,sc:.42,age:0,cook:0,air:false,noc:0,contacts:0,a0:0,assist:0,vyPrev:0,vxPrev:0,imp:0,broke:false,settleT:0,eval:null,
      wob:[0,0,0],wv:[0,0,0],yx:0,yvx:0,yh:0,yvh:0}; st="pan"; sizzle=6; sim.wake();
    say(c,"In the pan. Cooking. Flips 0 of "+GOAL+".");
  }
  function over(text){ st="over"; msg=text; if(flips>best){ best=flips; try{ localStorage.setItem("k13-bench-egg",String(best)); }catch(e){} } say(c,text+" Flips "+flips+" of "+GOAL+". Best "+best+". Tap to crack another."); }
  function win(){ st="won"; plateT=0; best=Math.max(best,GOAL); try{ localStorage.setItem("k13-bench-egg",String(best)); }catch(e){} say(c,"Sunny side up. "+GOAL+" clean flips. Plated."); egg.w=0; }
  function toss(){ if(st==="idle"||st==="over"){ startCrack(); return; } if(st==="pan"&&tossQ<0){ tossQ=0; pan.tossHome=pan.ty; sim.wake(); } else if(st==="won"){ startCrack(); } }
  function panStep(dt){
    var kx=1100, cc=52, ax=kx*(pan.tx-pan.x)-cc*pan.vx, ay=kx*(pan.ty-pan.y)-cc*pan.vy;
    pan.vx=clamp(pan.vx+ax*dt,-1900,1900); pan.vy=clamp(pan.vy+ay*dt,-2200,2200); pan.x+=pan.vx*dt; pan.y+=pan.vy*dt;
    pan.x=clamp(pan.x,hw+10,W-hw-10); pan.y=clamp(pan.y,40*S,floorY-40*S);
    var ta=pan.ta+clamp(pan.vx*.0004,-.3,.3)+clamp(-pan.vy*.00006,0,.12); var aa=700*(ta-pan.a)-34*pan.wa; pan.wa+=aa*dt; pan.a+=pan.wa*dt;
    if(tossQ>=0){ tossQ+=dt; if(tossQ<.17) pan.ty=pan.tossHome-TOSS*S; else { pan.ty=pan.tossHome; if(tossQ>.5) tossQ=-1; } }
  }
  function contacts(dt,g){
    var e=egg, ca=Math.cos(e.a), sa=Math.sin(e.a), cp=Math.cos(pan.a), sp=Math.sin(pan.a), nx=sp, ny=-cp, I=e.sc*e.sc*R*R/3*1.3, nc=0, minVn=0, it, j, pl;
    var Rr=R*e.sc, pts=[], f=[-1,-.5,0,.5,1], k, side;
    for(side=-1;side<=1;side+=2) for(k=0;k<5;k++) pts.push([f[k]*Rr,side*T*e.sc]);
    for(it=0;it<4;it++){
      for(j=0;j<pts.length;j++){
        var lx=pts[j][0], ly=pts[j][1], rx=ca*lx-sa*ly, ry=sa*lx+ca*ly, wx=e.x+rx, wy=e.y+ry, dxp=wx-pan.x, dyp=wy-pan.y;
        var plx=cp*dxp+sp*dyp, ply=-sp*dxp+cp*dyp, pen=0, wn=null;
        if(Math.abs(plx)<hw&&ply>-2&&ply<34*S){ pen=ply+0; wn=[nx,ny]; }
        else if(Math.abs(plx)>=hw&&Math.abs(plx)<hw+30&&ply>-wallH&&ply<10){ var sg=plx>0?1:-1; pen=Math.abs(plx)-hw+1; wn=[-sg*cp,-sg*sp]; }
        if(!wn) continue;
        var vx=e.vx-e.w*ry, vy=e.vy+e.w*rx, vpx=pan.vx-pan.wa*dyp, vpy=pan.vy+pan.wa*dxp, rvx=vx-vpx, rvy=vy-vpy, vn=rvx*wn[0]+rvy*wn[1];
        e.x+=wn[0]*pen*.5; e.y+=wn[1]*pen*.5; if(it===0) nc++;
        if(vn<0){ if(vn<minVn) minVn=vn; var rc=rx*wn[1]-ry*wn[0], jn=-(1+(-vn>200?.12:0))*vn/(1+rc*rc/I);
          e.vx+=wn[0]*jn; e.vy+=wn[1]*jn; e.w+=(rx*wn[1]*jn-ry*wn[0]*jn)/I;
          var tx=-wn[1], ty=wn[0], vt=rvx*tx+rvy*ty, rt=rx*ty-ry*tx, jt=clamp(-vt/(1+rt*rt/I),-.75*jn,.75*jn); e.vx+=tx*jt; e.vy+=ty*jt; e.w+=(rx*ty*jt-ry*tx*jt)/I; }
      }
    }
    e.contacts=nc; e.imp=-minVn; return nc;
  }
  function step(dt){
    var cm=calm(); tick+=dt;
    panStep(dt);
    if(st==="crack"){ crackT+=dt; if(crackT>=2.2*K()) spawnEgg(); }
    if(egg&&(st==="pan"||st==="over")){ var e=egg;
      e.age+=dt; e.cook=Math.min(1,e.cook+dt/3.2); e.sc=Math.min(1,e.sc+ (1-e.sc)*dt*7+dt*.2);
      if(sizzle>0) sizzle-=dt; if(e.cook<1) sizzle=Math.max(sizzle,.5);
      if(st==="pan"){
        e.vyPrev=e.vy; e.vxPrev=e.vx; e.vy+=G*dt; e.x+=e.vx*dt; e.y+=e.vy*dt; e.a+=e.w*dt;
        var nc=contacts(dt);
        if(nc===0){ e.noc++; } else { e.noc=0; }
        if(!e.air&&e.noc>=3){ /* takeoff */
          e.air=true; e.a0=e.a; var up=-e.vy, need=380*S; e.assist=0;
          if(up>need){ if(e.cook<.5){ e.broke=true; over("Too raw, the yolk broke."); } else { var n=up>1050*S?2:1, Tp=2*up/G; e.w=n*TAU/Tp; e.assist=n; } } }
        if(e.air&&nc>0){ /* landing */
          e.air=false; var rot=e.a-e.a0, kk=Math.round(rot/TAU), resid=rot-kk*TAU; e.eval={k:Math.abs(kk),resid:Math.abs(resid),assist:e.assist,imp:e.imp}; e.settleT=0;
          for(var q=0;q<3;q++) e.wv[q]+=(q%2?-1:1)*e.imp*.012*S; e.yvh-=e.imp*.01; e.w*=.35; sizzle=Math.max(sizzle,1.5);
          if(e.imp>1400*S&&e.assist){ e.broke=true; over("Hard landing, the yolk broke."); } }
        if(st==="pan"&&!e.air){ var sp=Math.abs(e.vx)+Math.abs(e.vy)+Math.abs(e.w)*20; if(sp<30&&nc>0) e.settleT+=dt; else e.settleT=0;
          if(e.eval&&e.settleT>.3){ var ev=e.eval; e.eval=null; var up2=Math.cos(e.a)>0;
            if(ev.assist&&ev.k>=1&&up2){ flips+= ev.k>=2?2:1; flips=Math.min(flips,GOAL); sizzle=2.5; if(flips>=GOAL) win(); else say(c,(ev.k>=2?"Double flip! ":"Clean flip. ")+"Flips "+flips+" of "+GOAL+". Best "+best+"."); }
            else if(!up2) say(c,"Yolk down. Flip it again. Flips "+flips+" of "+GOAL+".");
            else say(c,"Just a hop. Flick harder. Flips "+flips+" of "+GOAL+"."); } }
        /* jiggle: white and yolk are damped springs driven by the egg's own acceleration */
        var ay=(e.vy-e.vyPrev)/dt, ax=(e.vx-e.vxPrev)/dt, ca=Math.cos(-e.a), sa=Math.sin(-e.a), lax=ca*ax-sa*ay, lay=sa*ax+ca*ay;
        for(var m=0;m<3;m++){ e.wv[m]+=(-900*e.wob[m]-14*e.wv[m]-lay*(m%2?-1:1)*.0016*(1+m*.3))*dt; e.wob[m]=clamp(e.wob[m]+e.wv[m]*dt,-9*S,9*S); }
        e.yvx+=(-700*e.yx-12*e.yvx-lax*.0014)*dt; e.yx=clamp(e.yx+e.yvx*dt,-9*S,9*S); e.yvh+=(-800*e.yh-12*e.yvh-lay*.0012)*dt; e.yh=clamp(e.yh+e.yvh*dt,-6*S,6*S);
        if(e.y>floorY-T&&st==="pan"){ e.y=floorY-T; over("It hit the floor."); }
        if(e.x<-40||e.x>W+40) over("It flew off.");
      } else { /* over: let the springs settle */
        for(var m2=0;m2<3;m2++){ e.wv[m2]+=(-900*e.wob[m2]-14*e.wv[m2])*dt; e.wob[m2]+=e.wv[m2]*dt; } }
    }
    if(st==="won"&&egg){ plateT+=dt; var e2=egg, p=P(plateT,.2,1.3), px=W*.78, py=floorY-14*S; e2.w=0;
      if(plateT>.2){ var k2=eIO(p); e2.x=lerp0(e2.px0===undefined?(e2.px0=e2.x):e2.px0,px,k2); e2.y=lerp0(e2.py0===undefined?(e2.py0=e2.y):e2.py0,py-T*1.2-60*S*Math.sin(Math.PI*p),k2); e2.a=lerp0(e2.a%TAU,0,k2); }
      for(var m3=0;m3<3;m3++){ e2.wv[m3]+=(-900*e2.wob[m3]-14*e2.wv[m3])*dt; e2.wob[m3]+=e2.wv[m3]*dt; } if(p>=1&&!e2.landed){ e2.landed=true; for(var q2=0;q2<3;q2++) e2.wv[q2]+=(q2%2?-1:1)*40*S; e2.yvh-=5; } }
    var calmEgg=!egg||st==="idle"||Math.abs(egg.wob[0])+Math.abs(egg.wv[0])*.02<.15;
    var settled=!egg||(st!=="pan"?(st!=="won"||plateT>1.8):(egg.settleT>.5&&!egg.eval&&egg.cook>=1&&sizzle<=0));
    restNow=(st==="idle"||st==="over"||st==="won"||st==="pan")&&settled&&calmEgg&&Math.abs(pan.vx)+Math.abs(pan.vy)+Math.abs(pan.wa)<4&&Math.abs(pan.tx-pan.x)+Math.abs(pan.ty-pan.y)<1&&tossQ<0&&st!=="crack";
    if(st==="over"&&egg&&Math.abs(egg.wob[0])<.1) restNow=Math.abs(pan.vy)<4&&Math.abs(pan.ty-pan.y)<1;
  }
  function lerp0(a,b,k){ return a+(b-a)*k; }
  function eggPath(ctx,cx,cy,rx,ry){ ctx.beginPath(); ctx.moveTo(cx,cy-ry); ctx.bezierCurveTo(cx+rx*.85,cy-ry,cx+rx,cy+ry*.15,cx+rx,cy+ry*.35); ctx.bezierCurveTo(cx+rx,cy+ry*.8,cx+rx*.55,cy+ry,cx,cy+ry);
    ctx.bezierCurveTo(cx-rx*.55,cy+ry,cx-rx,cy+ry*.8,cx-rx,cy+ry*.35); ctx.bezierCurveTo(cx-rx,cy+ry*.15,cx-rx*.85,cy-ry,cx,cy-ry); ctx.closePath(); }
  function ring(t,t0,f,d){ return t<t0?0:Math.sin((t-t0)*f)*Math.exp(-(t-t0)*d); }
  function drawCrack(ctx){
    var t=crackT/K(); /* film seconds */
    var sc=.62*S*1.15, ex=pan.x, ey=pan.y-124*S, y0=pan.y-6*S;
    function drawShell(){
      if(t<1.1){ var sway=Math.sin(t*5)*.05*(1-P(t,.5,1.1))+ring(t,.7,40,9)*.05; ctx.save(); ctx.translate(ex,ey+80*sc); ctx.rotate(sway); ctx.scale(sc,sc); ctx.translate(0,-80);
        eggPath(ctx,0,0,62,80); ctx.fillStyle=C.shell; ctx.fill(); ctx.fillStyle=C.shellHi; ctx.beginPath(); ctx.ellipse(-20,-30,16,26,-.35,0,TAU); ctx.fill();
        var ck=P(t,.7,1.05); if(ck>0){ ctx.strokeStyle=C.pan; ctx.lineWidth=3; ctx.lineJoin="round"; ctx.beginPath(); var n=Math.ceil(ck*(CRACK.length-1)); ctx.moveTo(CRACK[0][0],CRACK[0][1]); for(var i=1;i<=n;i++) ctx.lineTo(CRACK[i][0],CRACK[i][1]); ctx.stroke(); } ctx.restore(); }
      var sp=P(t,1.1,1.9);
      if(t>=1.1&&sp<1){ var kk=1-eIn(sp); [[-1,-1],[1,1]].forEach(function(a){ var side=a[0], top=a[1]; ctx.save(); ctx.globalAlpha=kk; ctx.translate(ex+side*eOut(sp)*170*sc,ey+(top<0?-eOut(sp)*60:eOut(sp)*40)*sc); ctx.rotate(side*eOut(sp)*.9); ctx.scale(kk*sc,kk*sc);
        ctx.beginPath(); if(top<0){ ctx.moveTo(-64,-84); ctx.lineTo(64,-84); } else { ctx.moveTo(-64,84); ctx.lineTo(64,84); } CRACK.slice().reverse().forEach(function(q){ ctx.lineTo(q[0],q[1]); }); ctx.closePath(); ctx.clip();
        eggPath(ctx,0,0,62,80); ctx.fillStyle=C.shell; ctx.fill(); ctx.fillStyle=C.shellIn; ctx.beginPath(); ctx.ellipse(0,top<0?-6:6,54,12,0,0,TAU); ctx.fill(); ctx.restore(); }); }
    }
    drawShell();
    if(t>=1.1&&t<2.2){ var f=P(t,1.1,2.2), y=lerp0(ey+10*sc,y0-30*S,eIn(f)), cx=lerp0(ex,pan.x,eIO(f)), v=eIn(f), rw=lerp0(52,40,v)*sc, rh=lerp0(52,96,v)*sc;
      ctx.fillStyle=C.raw; ctx.strokeStyle=C.edge; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(cx,y-rh*1.25); ctx.bezierCurveTo(cx+rw*.35,y-rh*.6,cx+rw,y-rh*.1,cx+rw,y+rh*.25); ctx.bezierCurveTo(cx+rw,y+rh*.75,cx-rw,y+rh*.75,cx-rw,y+rh*.25);
      ctx.bezierCurveTo(cx-rw,y-rh*.1,cx-rw*.35,y-rh*.6,cx,y-rh*1.25); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle=C.yolkRim; ctx.beginPath(); ctx.arc(cx,y+rh*.28,lerp0(30,26,v)*sc*1.04,0,TAU); ctx.fill(); ctx.fillStyle=C.yolk; ctx.beginPath(); ctx.arc(cx,y+rh*.28,lerp0(30,26,v)*sc,0,TAU); ctx.fill(); ctx.fillStyle=C.yolkHi; ctx.beginPath(); ctx.arc(cx-6*sc,y+rh*.28-6*sc,9*sc,0,TAU); ctx.fill(); }
  }
  function drawEgg(ctx,e,flat){
    var Rr=R*e.sc, Tt=T*e.sc, cook=eIO(clamp((e.cook-.05)/.9,0,1)), i, u, x, h, up=Math.cos(e.a)>0;
    ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(e.a);
    function prof(u){ return Tt*Math.pow(Math.max(0,1-Math.pow(Math.abs(u),3.2)),.55); }
    function wobAt(u){ return (e.wob[0]*Math.sin(Math.PI*(u+1)/2)+e.wob[1]*Math.sin(Math.PI*(u+1))+e.wob[2]*Math.sin(Math.PI*1.5*(u+1)))*.5; }
    /* the underside: golden lace */
    ctx.beginPath(); for(i=0;i<=24;i++){ u=-1+i/12; x=u*Rr; h=prof(u); if(i) ctx.lineTo(x,h*.9); else ctx.moveTo(x,h*.9); } for(i=24;i>=0;i--){ u=-1+i/12; ctx.lineTo(u*Rr,0); } ctx.closePath(); ctx.fillStyle=C.lace; ctx.fill();
    /* the top face: raw to set white, with a lace edge growing */
    ctx.beginPath(); for(i=0;i<=24;i++){ u=-1+i/12; x=u*Rr; h=prof(u); var y=-h-wobAt(u); if(i) ctx.lineTo(x,y); else ctx.moveTo(x,y); } for(i=24;i>=0;i--){ u=-1+i/12; ctx.lineTo(u*Rr,0); } ctx.closePath();
    ctx.fillStyle=C.raw; ctx.fill(); ctx.globalAlpha=cook; ctx.fillStyle=C.white; ctx.fill(); ctx.globalAlpha=1;
    if(cook>0){ ctx.strokeStyle=C.lace; ctx.lineWidth=Math.max(.01,cook*3.2*S); ctx.lineJoin="round"; ctx.beginPath(); for(i=0;i<=24;i++){ u=-1+i/12; var yy=-prof(u)-wobAt(u); if(i) ctx.lineTo(u*Rr,yy); else ctx.moveTo(u*Rr,yy); } ctx.stroke(); }
    if(e.broke){ ctx.fillStyle=C.yolk; ctx.beginPath(); ctx.ellipse(0,-Tt*.5,Rr*.5,Tt*.45,0,0,TAU); ctx.fill(); ctx.fillStyle=C.yolkRim; ctx.beginPath(); ctx.ellipse(Rr*.3,-Tt*.3,Rr*.2,Tt*.25,0,0,TAU); ctx.fill(); }
    else { var yr=Rr*.3, yh=(Tt*2.3+e.yh)*(1), yc=e.yx; ctx.fillStyle=C.yolkRim; ctx.beginPath(); ctx.ellipse(yc,-Tt*.6,yr*1.05,yh*1.02,0,Math.PI,TAU); ctx.fill();
      ctx.fillStyle=C.yolk; ctx.beginPath(); ctx.ellipse(yc,-Tt*.6,yr,yh,0,Math.PI,TAU); ctx.fill(); ctx.fillStyle=C.yolkHi; ctx.beginPath(); ctx.ellipse(yc-yr*.3,-Tt*.6-yh*.55,yr*.3,yh*.22,-.3,0,TAU); ctx.fill(); }
    ctx.restore();
  }
  function drawPan(ctx){
    ctx.save(); ctx.translate(pan.x,pan.y); ctx.rotate(pan.a);
    var pd=20*S; ctx.fillStyle=C.pan;
    ctx.save(); ctx.translate(hw+8*S,-2*S); ctx.rotate(-.04); ctx.beginPath(); ctx.roundRect?ctx.roundRect(0,-7*S,210*S,14*S,7*S):ctx.rect(0,-7*S,210*S,14*S); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-hw-14*S,-wallH); ctx.lineTo(-hw,-2*S); ctx.lineTo(hw,-2*S); ctx.lineTo(hw+14*S,-wallH); ctx.lineTo(hw+14*S,-wallH+5*S); ctx.lineTo(hw+4*S,pd); ctx.lineTo(-hw-4*S,pd); ctx.lineTo(-hw-14*S,-wallH+5*S); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.panIn; ctx.fillRect(-hw,-2*S,hw*2,4*S); ctx.restore();
  }
  function draw(ctx,w,h){
    ctx.fillStyle=C.ground; ctx.fillRect(0,0,w,h); ctx.fillStyle=C.shade; ctx.fillRect(0,floorY,w,h-floorY);
    var hgt=clamp((floorY-pan.y)/(floorY),0,1); ctx.fillStyle="rgba(33,33,33,"+(.14-.07*hgt)+")"; ctx.beginPath(); ctx.ellipse(pan.x+20*S,floorY+6*S,(hw+30*S)*(1-.2*hgt),10*S,0,0,TAU); ctx.fill();
    if(st==="won"){ var px=w*.78, py=floorY-8*S, k=eOut(P(plateT,0,.5)); ctx.fillStyle="#ffffff"; ctx.strokeStyle="#cdbf9f"; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(px+(1-k)*200,py+3*S,92*S,13*S,0,0,TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle="#efe6d2"; ctx.beginPath(); ctx.ellipse(px+(1-k)*200,py+2*S,66*S,8*S,0,0,TAU); ctx.fill(); }
    drawPan(ctx);
    if(st==="crack") drawCrack(ctx);
    if(egg){ drawEgg(ctx,egg);
      if(sizzle>0&&st==="pan"&&!calm()&&egg.contacts>0&&!egg.air){ var heat=Math.min(1,sizzle), u2=tick; for(var j=0;j<12;j++){ var ph=(u2/1.4+hash(j))%1, bs=Math.sin(Math.PI*ph), ux=(hash(j+20)*2-1)*.9, bx=egg.x+Math.cos(egg.a)*ux*R*egg.sc, by=egg.y-Math.sin(egg.a)*0+(-T*egg.sc-4*bs);
          ctx.fillStyle="rgba(255,253,246,"+(.8*bs*heat)+")"; ctx.strokeStyle="rgba(226,215,191,"+(.9*bs*heat)+")"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(bx,pan.y-3*S-bs*2.5,2+3.2*bs*S,0,TAU); ctx.fill(); ctx.stroke(); }
        for(var q=0;q<8;q++){ var ph2=(u2/.8+hash(q+60))%1, k2=Math.sin(Math.PI*ph2), side=hash(q+80)>.5?1:-1; ctx.fillStyle="rgba(255,253,246,"+(.9*k2*heat)+")"; ctx.beginPath(); ctx.arc(egg.x+side*(R*egg.sc*.95+ph2*30*S),pan.y-ph2*(1-ph2)*160*S,2.2*S,0,TAU); ctx.fill(); } }
    }
    /* progress: five egg pips, filled by clean flips */
    var gx=14, gy=60*S+4;  if(st!=="idle"||true){ ctx.fillStyle="rgba(33,33,33,.08)"; ctx.fillRect(gx-5,gy-12*S,GOAL*20*S+8,26*S); for(var g=0;g<GOAL;g++){ ctx.fillStyle=g<flips?C.yolk:"rgba(33,33,33,.18)"; ctx.strokeStyle=g<flips?C.yolkRim:"rgba(33,33,33,.3)"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(gx+9*S+g*20*S,gy,7*S,0,TAU); ctx.fill(); ctx.stroke(); } }
    ctx.font="600 "+Math.round(15*S)+"px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.fillStyle="#212121";
    if(st==="won") ctx.fillText("Sunny side up!",w/2,floorY-150*S*0-h*.42);
    else if(st==="idle") ctx.fillText("Tap to crack an egg",w*.5,h*.33);
    else if(st==="over") ctx.fillText(msg+" Tap to try again.",w*.5,h*.28);
  }
  var sim=Sim(c,cv,{resize:function(w,h){ layout(w,h); },step:step,draw:draw,rest:function(){ return restNow; },enter:function(){ say(c,"Flips 0 of "+GOAL+". Best "+best+". Tap to crack an egg."); }});
  var drag=null;
  pointer(cv,sim,{
    down:function(p){ if(st==="idle"||st==="over"||st==="won"){ startCrack(); return; } if(st==="crack") return; drag={ox:pan.x-p.x,oy:pan.y-p.y}; },
    move:function(p,down){ if(down&&drag){ pan.tx=clamp(p.x+drag.ox,hw+12,W-hw-12); pan.ty=clamp(p.y+drag.oy,70*S,floorY-60*S); sim.wake(); } },
    up:function(){ drag=null; }
  });
  cv.addEventListener("keydown",function(e){
    var k=e.key, stp=34*S;
    if(k==="ArrowLeft"){ pan.tx=clamp(pan.tx-stp,hw+12,W-hw-12); pan.ta=-.12; } else if(k==="ArrowRight"){ pan.tx=clamp(pan.tx+stp,hw+12,W-hw-12); pan.ta=.12; }
    else if(k==="ArrowUp"){ pan.ty=clamp(pan.ty-stp,70*S,floorY-60*S); } else if(k==="ArrowDown"){ pan.ty=clamp(pan.ty+stp,70*S,floorY-60*S); }
    else if(k===" "||k==="Enter"){ toss(); } else return; e.preventDefault(); sim.wake(); });
  cv.addEventListener("keyup",function(e){ if(e.key==="ArrowLeft"||e.key==="ArrowRight") pan.ta=0; });
  crackB.addEventListener("click",function(){ if(st==="idle"||st==="over"||st==="won") startCrack(); sim.wake(); });
  tossB.addEventListener("click",function(){ toss(); });
  c.reset.addEventListener("click",function(){ st="idle"; egg=null; flips=0; crackT=0; tossQ=-1; pan.tx=pan.x=homeX; pan.ty=pan.y=homeY; pan.vx=pan.vy=0; tossQ=-1; msg=""; say(c,"Flips 0 of "+GOAL+". Best "+best+". Tap to crack an egg."); sim.wake(); sim.draw(); });
}

function mountAll(){
  var games={roof:roof,dumpling:dumpling,tide:tide,stack:stack,eggtoss:eggToss};
  Object.keys(games).forEach(function(k){ var m=document.querySelector('[data-game="'+k+'"]'); if(m&&!m.classList.contains("wb")) games[k](m); });
}
mountAll();
})();
