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
  var c=card(mount,{title:"One Roof",from:"Tiger Hospitality",instr:"Grab a lamp and swing it. The whole string answers.",stageClass:"bp-dark bp-roof",
    foot:"A toy string, not their lighting plan. Left and right arrows blow a breeze."});
  var cv=canvas(c,"A string of pendant lamps. Left and right arrows blow a breeze, Space shakes the string.");
  var shake=pill(c,"Shake","Shake the string of lamps");
  var N=30, M=7, nodes=[], lamps=[], ax0=0,ay0=0,ax1=0,ay1=0, seg=0, wamp=0, T=0, grab=null, restNow=false, stars=[];
  for(var s=0;s<26;s++) stars.push([Math.random(),Math.random()*.55,Math.random()*1.1+.4]);
  function build(W,H){
    M=W<380?5:W<600?7:9;
    ax0=20; ax1=W-20; ay0=ay1=64;
    var span=ax1-ax0; seg=span*1.17/(N-1); var sag=Math.sqrt(3*span*(span*.17)/8);
    nodes=[]; lamps=[]; grab=null; wamp=0;
    for(var i=0;i<N;i++){ var u=i/(N-1), x=ax0+u*span, y=ay0+4*sag*u*(1-u); nodes.push({x:x,y:y,px:x,py:y}); }
    var lens=[24,36,28,40,26,34,30];
    for(var k=0;k<M;k++){ var idx=Math.round((k+1)*(N-1)/(M+1)), n=nodes[idx], len=lens[k%lens.length];
      lamps.push({n:idx,len:len,x:n.x,y:n.y+len,px:n.x,py:n.y+len,r:11,glow:0}); }
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
      for(i=0;i<M-1;i++){ var p1=lamps[i], p2=lamps[i+1], qx=p2.x-p1.x, qy=p2.y-p1.y, qd=Math.sqrt(qx*qx+qy*qy), min=p1.r+p2.r; if(qd<min&&qd>1e-6){ var o=(min-qd)/qd*.5; p1.x-=qx*o; p1.y-=qy*o; p2.x+=qx*o; p2.y+=qy*o; } }
      if(grab){ var gp=grab.p; gp.x+=(grab.tx-gp.x)*.13; gp.y+=(grab.ty-gp.y)*.13; }
      for(i=0;i<M;i++){ p=lamps[i]; if(p.y>fl){ p.y=fl; p.py=p.y+(p.y-p.py)*.2*0; } p.x=clamp(p.x,10,W-10); if(p.y<ay0-6) p.y=ay0-6; }
      for(i=1;i<N-1;i++){ p=nodes[i]; p.x=clamp(p.x,6,W-6); if(p.y>fl){ p.y=fl; } if(p.y<ay0-6) p.y=ay0-6; }
    }
    var mx=0; for(i=0;i<N;i++){ p=nodes[i]; var sp=Math.hypot(p.x-p.px,p.y-p.py); if(sp>mx) mx=sp; }
    for(i=0;i<M;i++){ p=lamps[i]; var s3=Math.hypot(p.x-p.px,p.y-p.py); p.glow=s3; if(s3>mx) mx=s3; }
    restNow=mx<.03&&Math.abs(wamp)<2&&!grab;
  }
  function draw(ctx,W,H){
    var fl=H-40, i, g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#0C1224"); g.addColorStop(.7,"#1E2336"); g.addColorStop(1,"#35271D"); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#F6EEDC"; for(i=0;i<stars.length;i++){ ctx.globalAlpha=.25+stars[i][2]*.25; ctx.beginPath(); ctx.arc(stars[i][0]*W,stars[i][1]*H,stars[i][2],0,6.283); ctx.fill(); } ctx.globalAlpha=1;
    ctx.fillStyle="#18110C"; ctx.fillRect(0,fl,W,H-fl); ctx.fillStyle="rgba(255,210,122,.16)"; ctx.fillRect(0,fl,W,1.5);
    ctx.strokeStyle="rgba(255,255,255,.05)"; ctx.lineWidth=1; for(i=1;i<4;i++){ ctx.beginPath(); ctx.moveTo(0,fl+i*10); ctx.lineTo(W,fl+i*10); ctx.stroke(); }
    ctx.globalCompositeOperation="lighter";
    for(i=0;i<lamps.length;i++){ var l=lamps[i], I=clamp(.7+l.glow*.5,.7,1.1), rg=ctx.createRadialGradient(l.x,fl+6,0,l.x,fl+6,70); rg.addColorStop(0,"rgba(255,190,90,"+(.26*I)+")"); rg.addColorStop(1,"rgba(255,190,90,0)");
      ctx.save(); ctx.translate(0,fl+6); ctx.scale(1,.18); ctx.translate(0,-(fl+6)); ctx.fillStyle=rg; ctx.fillRect(l.x-80,fl-80,160,200); ctx.restore(); }
    ctx.globalCompositeOperation="source-over";
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
      var sg=ctx.createLinearGradient(-14,0,14,0); sg.addColorStop(0,"#F0BE62"); sg.addColorStop(.5,"#C98A2C"); sg.addColorStop(1,"#7A4C16");
      ctx.fillStyle=sg; ctx.beginPath(); ctx.moveTo(-14,-3); ctx.quadraticCurveTo(-14,-17,0,-17); ctx.quadraticCurveTo(14,-17,14,-3); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#5E3A10"; ctx.fillRect(-15,-4,30,3);
      var bg=ctx.createRadialGradient(0,1,0,0,1,7); bg.addColorStop(0,"#FFFFFF"); bg.addColorStop(.5,"#FFE9B0"); bg.addColorStop(1,"#FFC25E"); ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(0,1,6.4,0,6.283); ctx.fill();
      ctx.restore(); }
    ctx.globalCompositeOperation="lighter";
    for(i=0;i<lamps.length;i++){ var q2=lamps[i], I2=clamp(.72+q2.glow*.55,.72,1.15), R=64*I2, rg2=ctx.createRadialGradient(q2.x,q2.y,0,q2.x,q2.y,R);
      rg2.addColorStop(0,"rgba(255,206,120,"+(.62*I2)+")"); rg2.addColorStop(.35,"rgba(255,170,70,"+(.22*I2)+")"); rg2.addColorStop(1,"rgba(255,150,50,0)");
      ctx.fillStyle=rg2; ctx.beginPath(); ctx.arc(q2.x,q2.y,R,0,6.283); ctx.fill(); }
    ctx.globalCompositeOperation="source-over";
  }
  var sim=Sim(c,cv,{resize:function(W,H){ build(W,H); },step:step,draw:draw,rest:function(){ return restNow; },
    enter:function(){ if(!calm()) setTimeout(function(){ gust(1,.9); },350); }});
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
  c.reset.addEventListener("click",function(){ build(sim.W(),sim.H()); say(c,""); sim.wake(); sim.draw(); });
}

/* ======================= 2. Dumpling Drop (Station8): discs, pegs, bumpers, bins ======================= */
function dumpling(mount){
  var c=card(mount,{title:"Dumpling Drop",from:"Station8",instr:"Tap to drop a dumpling, hold to pour. Grab one and fling it.",stageClass:"bp-light bp-drop",
    foot:"A toy market, not the real one. Arrows slide the steamer, Space drops."});
  var cv=canvas(c,"A pachinko board of pegs over five baskets. Left and right arrows slide the steamer, Space drops a dumpling, Up shakes the table.");
  var dropB=pill(c,"Drop","Drop a dumpling"), shakeB=pill(c,"Shake","Shake the table");
  var G=1750, balls=[], pegs=[], bumps=[], r=12, binH=70, chuteX=0, chuteY=62, grab=null, stream=false, streamT=0, sprites={}, spriteKey="", W0=0,H0=0, restNow=false, lastCounts="", countT=0, kindN=0;
  var KINDS=["#4F9E92","#E8756A","#F0B429","#141D35"], BINS=5, binCol=["#EADFC2","#E2D4AE"];
  function layout(W,H){
    r=clamp(W/27,10,13.5); binH=Math.min(74,Math.round(H*.22)); pegs=[]; bumps=[];
    var top=96, bot=H-binH-30, sx=Math.max(38,W/Math.floor(W/40)), rows=Math.max(2,Math.floor((bot-top)/33)+1), rowH=(bot-top)/(rows-1);
    bumps.push({x:W*.27,y:top+rowH*.5+4,r:15,f:0},{x:W*.73,y:top+rowH*.5+4,r:15,f:0});
    for(var j=0;j<rows;j++){ var y=top+j*rowH, off=j%2?0:sx/2;
      for(var x=off;x<=W+1;x+=sx){ if(x<30||x>W-30) continue; var near=false; bumps.forEach(function(b){ if(Math.hypot(b.x-x,b.y-y)<b.r+30) near=true; }); if(!near) pegs.push({ax:x,ay:y,bx:x,by:y,rad:4.5}); } }
    for(var j2=0;j2<rows;j2++){ var yy=top+j2*rowH-4; pegs.push({ax:0,ay:yy,bx:24,by:yy+14,rad:2.5,div:true},{ax:W,ay:yy,bx:W-24,by:yy+14,rad:2.5,div:true}); }
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
    restNow=all&&!stream&&!grab&&bumps.every(function(m){ return m.f<=0; });
    countT+=dt; if(countT>.35||restNow){ countT=0; tally(); }
  }
  function tally(){
    var H=sim.H(), W=sim.W(), n=[0,0,0,0,0], tot=0; balls.forEach(function(b){ if(b.y>H-binH-r*.6){ n[Math.min(BINS-1,Math.floor(b.x/(W/BINS)))]++; tot++; } });
    var k=n.join(" "); if(k!==lastCounts&&restNow){ lastCounts=k; say(c,tot?"Baskets: "+n.join(", ")+".":""); }
  }
  function draw(ctx,W,H){
    var i,j; ctx.fillStyle="#F2EAD3"; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="rgba(20,29,53,.05)"; ctx.lineWidth=1; for(i=1;i<14;i++){ ctx.beginPath(); ctx.moveTo(0,i*30); ctx.lineTo(W,i*30); ctx.stroke(); }
    for(i=0;i<BINS;i++){ ctx.fillStyle=binCol[i%2]; ctx.fillRect(W*i/BINS,H-binH,W/BINS,binH); }
    ctx.fillStyle="rgba(20,29,53,.18)"; ctx.fillRect(0,H-binH,W,1.5);
    ctx.font="500 11px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.fillStyle="#515C78";
    var n=[0,0,0,0,0]; balls.forEach(function(b){ if(b.y>H-binH-r*.6) n[Math.min(BINS-1,Math.floor(b.x/(W/BINS)))]++; });
    for(i=0;i<BINS;i++) ctx.fillText(String(n[i]),W*(i+.5)/BINS,H-binH-8);
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
    enter:function(){ if(!calm()){ [.3,.55,.72].forEach(function(f,k){ setTimeout(function(){ chuteX=sim.W()*f; spawn(chuteX); sim.wake(); },300+k*420); }); } }});
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
  c.reset.addEventListener("click",function(){ balls=[]; lastCounts=""; grab=null; stream=false; say(c,""); sim.wake(); sim.draw(); });
}

/* ======================= 3. Tide Line (Lobster Lab): water columns and buoyant bodies ======================= */
function tide(mount){
  var c=card(mount,{title:"Tide Line",from:"Lobster Lab",instr:"Tap the sky to drop a buoy. Drag the water, or throw things in.",stageClass:"bp-tide",
    foot:"A toy harbor, not the real kitchen. Arrows move the crane, Space drops a buoy."});
  var cv=canvas(c,"A harbor. Left and right arrows move the crane, Space drops a buoy, Up makes a wave.");
  var dropB=pill(c,"Buoy","Drop a buoy");
  var n=0, dx=5, s=[], v=[], ld=[], rd=[], R=0, bodies=[], drops=[], grab=null, finger=null, craneX=0, restNow=false, G=900, W0=0;
  function surf(x){ var f=x/dx, i=clamp(Math.floor(f),0,n-2), u=clamp(f-i,0,1); return s[i]*(1-u)+s[i+1]*u; }
  function body(kind,x,y){
    var b={kind:kind,x:x,y:y,a:rnd(-.3,.3),vx:0,vy:0,w:0,sub:0,age:0,die:0,gp:null,rad:kind==="trap"?24:12,pts:[]},i;
    if(kind==="trap"){ b.m=1.2; b.I=430; b.kb=22; b.cd=3.2; for(var yy=-14;yy<=14;yy+=14) for(var xx=-25;xx<=25;xx+=12.5) b.pts.push([xx,yy]); }
    else { b.m=.7; b.I=110; b.kb=48; b.cd=2.2; for(i=0;i<8;i++){ var a=i*Math.PI/4; b.pts.push([Math.cos(a)*11,-7+Math.sin(a)*11]); } b.pts.push([0,-7]); }
    return b;
  }
  function init(W,H,keep){
    n=Math.ceil(W/5)+1; dx=W/(n-1); R=Math.round(H*.5); if(!keep||s.length!==n){ s=[];v=[]; ld=[];rd=[]; for(var i=0;i<n;i++){ s.push(R); v.push(0); ld.push(0); rd.push(0); } }
    if(!keep){ bodies=[body("buoy",W*.22,R-30),body("buoy",W*.4,R-60),body("trap",W*.64,R-40)]; bodies[0].tone=0; bodies[1].tone=1; drops=[]; grab=null; finger=null; craneX=W*.5; }
    bodies.forEach(function(b){ b.x=clamp(b.x,b.rad,W-b.rad); });
  }
  function kick(x,amp,wid){ for(var i=0;i<n;i++){ var d=Math.abs(i*dx-x); if(d<wid) v[i]+=amp*(1-d/wid); } }
  function splash(b,vy){
    kick(b.x,vy*.0017*(b.kind==="trap"?1.6:1),b.rad*2.2);
    if(calm()) return; var k=Math.min(18,Math.round(vy/38));
    for(var i=0;i<k&&drops.length<90;i++){ var a=-1.57+rnd(-.9,.9), sp=vy*rnd(.22,.55); drops.push({x:b.x+rnd(-b.rad,b.rad),y:surf(b.x)-2,vx:Math.cos(a)*sp*.7,vy:Math.sin(a)*sp,r:rnd(1.4,2.8)}); }
  }
  function step(dt){
    var W=sim.W(), H=sim.H(), cm=calm(), K=.0018, D=cm?.016:.01, SP=.13, i,j,b;
    for(i=0;i<n;i++){ v[i]+=-K*(s[i]-R)-D*v[i]; s[i]+=v[i]; }
    for(var ps=0;ps<3;ps++){
      for(i=0;i<n;i++){ if(i>0){ ld[i]=SP*(s[i]-s[i-1]); v[i-1]+=ld[i]; } if(i<n-1){ rd[i]=SP*(s[i]-s[i+1]); v[i+1]+=rd[i]; } }
      for(i=0;i<n;i++){ if(i>0) s[i-1]+=ld[i]; if(i<n-1) s[i+1]+=rd[i]; }
    }
    if(finger&&finger.y>R-18){ for(i=0;i<n;i++){ var d=Math.abs(i*dx-finger.x); if(d<38){ v[i]+=(finger.y-s[i])*.011*(1-d/38); } } }
    for(i=bodies.length-1;i>=0;i--){ b=bodies[i];
      if(b.die){ b.die-=dt*4; if(b.die<=0){ bodies.splice(i,1); continue; } }
      var ca=Math.cos(b.a), sa=Math.sin(b.a), Fx=0, Fy=b.m*G, T=0, sub=0;
      for(j=0;j<b.pts.length;j++){ var lx=b.pts[j][0], ly=b.pts[j][1], rx=ca*lx-sa*ly, ry=sa*lx+ca*ly, wx=b.x+rx, wy=b.y+ry, dd=wy-surf(wx);
        if(dd>0){ sub++; var vpx=b.vx-b.w*ry, vpy=b.vy+b.w*rx, f=b.kb*Math.min(dd,30), fx=-b.cd*vpx, fy=-f-b.cd*vpy; Fx+=fx; Fy+=fy; T+=rx*fy-ry*fx;
          var col=clamp(Math.round(wx/dx),0,n-1); v[col]+=vpy*.000055; } }
      if(b===grab&&b.gp&&grab.tx!=null){ var gx=ca*b.gp[0]-sa*b.gp[1], gy=sa*b.gp[0]+ca*b.gp[1], gvx=b.vx-b.w*gy, gvy=b.vy+b.w*gx,
          ax=clamp(150*(grab.tx-(b.x+gx))-20*gvx,-9000,9000), ay=clamp(150*(grab.ty-(b.y+gy))-20*gvy,-9000,9000), mx=ax*b.m, my=ay*b.m; Fx+=mx; Fy+=my-b.m*G*.85; T+=gx*my-gy*mx; }
      if(!sub&&b!==grab){ Fx-=b.vx*.03*b.m; Fy-=b.vy*.03*b.m; T-=b.w*b.I*.4; }
      b.vx+=Fx/b.m*dt; b.vy+=Fy/b.m*dt; b.w+=T/b.I*dt; b.vx=clamp(b.vx,-2200,2200); b.vy=clamp(b.vy,-2200,2200); b.w=clamp(b.w,-14,14);
      b.x+=b.vx*dt; b.y+=b.vy*dt; b.a+=b.w*dt; b.age+=dt;
      if(sub>0&&!b.sub&&b.vy>140) splash(b,b.vy); else if(sub===0&&b.sub>0&&b.vy<-260&&!cm) kick(b.x,b.vy*.0008,b.rad*2);
      b.sub=sub;
      var ext=b.kind==="trap"?20:6; if(b.x<b.rad){ b.x=b.rad; b.vx=Math.abs(b.vx)*.35; } if(b.x>W-b.rad){ b.x=W-b.rad; b.vx=-Math.abs(b.vx)*.35; }
      if(b.y+ext>H-14){ b.y=H-14-ext; b.vy=-Math.abs(b.vy)*.2; b.vx*=.9; }
    }
    for(i=0;i<bodies.length;i++) for(j=i+1;j<bodies.length;j++){ var A=bodies[i], B=bodies[j], nx=B.x-A.x, ny=B.y-A.y, d2=Math.sqrt(nx*nx+ny*ny), min=A.rad+B.rad;
      if(d2<min&&d2>1e-6){ nx/=d2; ny/=d2; var o=(min-d2)*.5; A.x-=nx*o; A.y-=ny*o; B.x+=nx*o; B.y+=ny*o; var vn=(B.vx-A.vx)*nx+(B.vy-A.vy)*ny; if(vn<0){ var jj=-(1.3)*vn*.5; A.vx-=jj*nx; A.vy-=jj*ny; B.vx+=jj*nx; B.vy+=jj*ny; } } }
    for(i=drops.length-1;i>=0;i--){ var q=drops[i]; q.vy+=G*dt; q.x+=q.vx*dt; q.y+=q.vy*dt; if(q.x<0||q.x>W){ drops.splice(i,1); continue; }
      if(q.vy>0&&q.y>surf(q.x)){ v[clamp(Math.round(q.x/dx),0,n-1)]+=q.vy*.00035; drops.splice(i,1); } }
    var mw=0,me=0; for(i=0;i<n;i++){ mw=Math.max(mw,Math.abs(v[i])); me=Math.max(me,Math.abs(s[i]-R)); }
    var bs=0; bodies.forEach(function(b){ bs=Math.max(bs,Math.abs(b.vx)+Math.abs(b.vy)+Math.abs(b.w)*10); });
    restNow=mw<.02&&me<.3&&bs<30&&!drops.length&&!grab&&!finger;
  }
  function drawBody(ctx,b){
    ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.a); if(b.die) ctx.globalAlpha=Math.max(0,b.die);
    if(b.kind==="trap"){
      ctx.fillStyle="rgba(190,150,90,.25)"; ctx.strokeStyle="#6B4A2A"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-27,16); ctx.lineTo(-27,-10); ctx.quadraticCurveTo(0,-26,27,-10); ctx.lineTo(27,16); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle="rgba(107,74,42,.55)"; ctx.lineWidth=1; for(var k=-18;k<=18;k+=9){ ctx.beginPath(); ctx.moveTo(k,16); ctx.lineTo(k,-16); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-27,3); ctx.lineTo(27,3); ctx.stroke();
      ctx.fillStyle="#D94B3A"; ctx.beginPath(); ctx.ellipse(-4,6,12,5.5,0,0,6.283); ctx.fill(); ctx.strokeStyle="#D94B3A"; ctx.lineWidth=3; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(6,5); ctx.lineTo(16,0); ctx.moveTo(6,8); ctx.lineTo(16,12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14,6); ctx.lineTo(-22,2); ctx.moveTo(-14,8); ctx.lineTo(-22,12); ctx.stroke();
    } else {
      ctx.strokeStyle="#3A2314"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(0,-31); ctx.stroke(); ctx.fillStyle="#FE6700"; ctx.beginPath(); ctx.moveTo(0,-31); ctx.lineTo(10,-27); ctx.lineTo(0,-23); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0,-7,11,0,6.283); ctx.clip(); ctx.fillStyle=b.tone?"#FFF4E2":"#D94B3A"; ctx.fillRect(-12,-19,24,24); ctx.fillStyle=b.tone?"#D94B3A":"#FFF4E2"; ctx.fillRect(-12,-11,24,7); ctx.fillStyle="rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(-4,-12,3,5,.5,0,6.283); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#3A2314"; ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(0,-7,11,0,6.283); ctx.stroke();
    }
    ctx.restore();
  }
  function draw(ctx,W,H){
    var i, sk=ctx.createLinearGradient(0,0,0,R); sk.addColorStop(0,"#BFE0EC"); sk.addColorStop(1,"#F8F0DE"); ctx.fillStyle=sk; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="rgba(255,255,255,.7)"; [[.18,.1,26],[.62,.17,32],[.84,.07,22]].forEach(function(cl){ var x=cl[0]*W,y=R*cl[1]*2.2; ctx.beginPath(); ctx.ellipse(x,y,cl[2],cl[2]*.38,0,0,6.283); ctx.ellipse(x+cl[2]*.6,y+3,cl[2]*.7,cl[2]*.3,0,0,6.283); ctx.fill(); });
    var pierY=R-26; ctx.fillStyle="#6B4A2A"; ctx.fillRect(0,pierY,W*.1,5); for(i=0;i<2;i++) ctx.fillRect(W*.02+i*W*.06,pierY,5,H-pierY-14); ctx.fillStyle="#8A6238"; ctx.fillRect(0,pierY,W*.1,2);
    var sd=ctx.createLinearGradient(0,H-26,0,H); sd.addColorStop(0,"#D8C594"); sd.addColorStop(1,"#BBA574"); ctx.fillStyle=sd; ctx.fillRect(0,H-20,W,20);
    ctx.strokeStyle="#3A2314"; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(craneX,0); ctx.lineTo(craneX,26); ctx.stroke(); ctx.beginPath(); ctx.arc(craneX,31,5,-1.2,3.9); ctx.stroke();
    bodies.forEach(function(b){ drawBody(ctx,b); });
    var wg=ctx.createLinearGradient(0,R-20,0,H); wg.addColorStop(0,"rgba(40,138,168,.72)"); wg.addColorStop(.55,"rgba(14,84,128,.82)"); wg.addColorStop(1,"rgba(1,58,113,.92)");
    ctx.fillStyle=wg; ctx.beginPath(); ctx.moveTo(0,H); for(i=0;i<n;i++) ctx.lineTo(i*dx,s[i]); ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,.75)"; ctx.lineWidth=2; ctx.lineJoin="round"; ctx.beginPath(); for(i=0;i<n;i++){ if(i) ctx.lineTo(i*dx,s[i]); else ctx.moveTo(0,s[0]); } ctx.stroke();
    ctx.strokeStyle="rgba(255,255,255,.14)"; ctx.lineWidth=1; for(var g=1;g<4;g++){ ctx.beginPath(); for(i=0;i<n;i++){ var y=s[i]+g*22+Math.sin(i*.3+g)*1.5; if(i) ctx.lineTo(i*dx,y); else ctx.moveTo(0,y); } ctx.stroke(); }
    ctx.fillStyle="rgba(240,248,252,.9)"; drops.forEach(function(q){ ctx.beginPath(); ctx.arc(q.x,q.y,q.r,0,6.283); ctx.fill(); });
  }
  var sim=Sim(c,cv,{resize:function(W,H,first){ init(W,H,!first); },step:step,draw:draw,rest:function(){ return restNow; },
    enter:function(){ if(!calm()){ kick(sim.W()*.12,-4,60); kick(sim.W()*.12+90,3,60); } }});
  function drop(x,hold){ var m=0; bodies.forEach(function(b){ if(b.kind==="buoy") m++; });
    if(m>=7){ for(var i=0;i<bodies.length;i++) if(bodies[i].kind==="buoy"&&!bodies[i].die&&bodies[i]!==grab){ bodies[i].die=1; break; } }
    var b=body("buoy",clamp(x,14,sim.W()-14),22); b.tone=Math.random()<.5?0:1; b.vy=80; bodies.push(b); sim.wake(); return b; }
  function bodyAt(p){ var best=null,bd=1e9; bodies.forEach(function(b){ if(b.die) return; var ca=Math.cos(-b.a), sa=Math.sin(-b.a), lx=ca*(p.x-b.x)-sa*(p.y-b.y), ly=sa*(p.x-b.x)+ca*(p.y-b.y), hit;
      if(b.kind==="trap") hit=Math.abs(lx)<32&&Math.abs(ly)<22; else hit=Math.hypot(lx,ly+9)<20; var d=Math.hypot(p.x-b.x,p.y-b.y); if(hit&&d<bd){ bd=d; best=b; } }); return best; }
  pointer(cv,sim,{
    down:function(p){ var b=bodyAt(p);
      if(!b){ if(p.y<surf(p.x)-14){ craneX=clamp(p.x,14,sim.W()-14); b=drop(craneX); } else { finger={x:p.x,y:p.y}; } }
      if(b){ var ca=Math.cos(-b.a), sa=Math.sin(-b.a); grab=b; b.gp=[ca*(p.x-b.x)-sa*(p.y-b.y),sa*(p.x-b.x)+ca*(p.y-b.y)]; grab.tx=p.x; grab.ty=p.y; } },
    move:function(p,down){ if(down){ if(grab){ grab.tx=clamp(p.x,4,sim.W()-4); grab.ty=clamp(p.y,4,sim.H()-4); } else if(finger){ finger.x=p.x; finger.y=p.y; } sim.wake(); } },
    up:function(){ if(grab){ grab.gp=null; } grab=null; finger=null; }
  });
  cv.addEventListener("keydown",function(e){
    var st=sim.W()*.06;
    if(e.key==="ArrowLeft") craneX=clamp(craneX-st,14,sim.W()-14); else if(e.key==="ArrowRight") craneX=clamp(craneX+st,14,sim.W()-14);
    else if(e.key===" "||e.key==="Enter"||e.key==="ArrowDown"){ drop(craneX); say(c,"A buoy drops."); }
    else if(e.key==="ArrowUp"){ kick(craneX,calm()?-3:-7,70); say(c,"A swell rolls in."); }
    else return; e.preventDefault(); sim.wake(); sim.draw(); });
  dropB.addEventListener("click",function(){ drop(craneX); say(c,"A buoy drops."); });
  c.reset.addEventListener("click",function(){ s=[]; init(sim.W(),sim.H(),false); say(c,""); sim.wake(); sim.draw(); });
}

/* ======================= 4. Stack Attack (Cosmos Burger): soft quads, SAT contacts ======================= */
function stack(mount){
  var c=card(mount,{title:"Stack Attack",from:"Cosmos Burger",instr:"Stack it high. Bump the table. See what holds.",stageClass:"bp-light bp-stack",
    foot:"A toy burger, not the menu. Arrows slide the drop point, Space stacks one."});
  var cv=canvas(c,"A plate on a counter. Left and right arrows slide the drop point, Space stacks the next layer, Up bumps the table.");
  var stackB=pill(c,"Stack","Stack the next layer"), bumpB=pill(c,"Bump","Bump the table");
  var SPEC={bunB:{n:"bottom bun",w:96,h:20},patty:{n:"patty",w:100,h:14},cheese:{n:"cheese",w:104,h:9},lettuce:{n:"lettuce",w:106,h:10},tomato:{n:"tomato",w:92,h:10},bunT:{n:"top bun",w:96,h:30}};
  var ORDER=["bunB","patty","cheese","lettuce","tomato","patty","cheese","bunT"], oi=0, bodies=[], plate=null, floorY=0, dropX=0, grab=null, restNow=false, calmT=0, snap=null, snapT=0, G=1450;
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
    say(c,"Next: "+SPEC[ORDER[oi%ORDER.length]].n+".");
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
    if(restNow&&!calmT){ calmT=1; reportStack(); } else if(!restNow) calmT=0;
  }
  function takeSnap(){ var v=[]; bodies.forEach(function(b){ for(var j=0;j<4;j++){ v.push(b.p[j].x,b.p[j].y); } }); return {n:bodies.length,v:v}; }
  function aabb(A,B){ var a0=1e9,a1=-1e9,b0=1e9,b1=-1e9,c0=1e9,c1=-1e9,d0=1e9,d1=-1e9,i; for(i=0;i<4;i++){ a0=Math.min(a0,A.p[i].x); a1=Math.max(a1,A.p[i].x); b0=Math.min(b0,A.p[i].y); b1=Math.max(b1,A.p[i].y); c0=Math.min(c0,B.p[i].x); c1=Math.max(c1,B.p[i].x); d0=Math.min(d0,B.p[i].y); d1=Math.max(d1,B.p[i].y); } return a0<c1&&c0<a1&&b0<d1&&d0<b1; }
  function reportStack(){ var on=0, off=0, top=0; bodies.forEach(function(b){ if(b.die) return; var low=Math.max(b.p[2].y,b.p[3].y); if(low<floorY-8) on++; else off++; });
    if(!on&&!off) return; say(c,on?(on+" high on the plate"+(off?", "+off+" on the counter":"")+"."):"All on the counter. Start again."); }
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
  }
  var sim=Sim(c,cv,{resize:function(W,H,first){ build(W,H,!first); },step:step,draw:draw,rest:function(){ return restNow; },
    enter:function(){ if(!calm()){ [0,1,2].forEach(function(k){ setTimeout(function(){ dropX=sim.W()/2+rnd(-14,14); add(); },300+k*500); }); } }});
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
  c.reset.addEventListener("click",function(){ bodies=[]; oi=0; grab=null; say(c,""); sim.wake(); sim.draw(); });
}

function mountAll(){
  var games={roof:roof,dumpling:dumpling,tide:tide,stack:stack};
  Object.keys(games).forEach(function(k){ var m=document.querySelector('[data-game="'+k+'"]'); if(m&&!m.classList.contains("wb")) games[k](m); });
}
mountAll();
})();
