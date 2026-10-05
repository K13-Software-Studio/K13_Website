/* K13 Angry 13: a slingshot physics game, three levels, built on the workbench card anatomy.
   The ammo are the pieces of the K13 lockup (the K, the 1, the 3). The targets are stock website templates.
   Real 2D rigid bodies written for this file (no library): oriented boxes and circles, SAT contacts with
   edge clipping, sequential impulses with friction, restitution and warm starting, impact damage, island sleeping.
   The loop is a fixed 120 Hz step behind an accumulator, draws to a devicePixelRatio-crisp canvas, pauses while
   the card is off screen or the tab is hidden, and goes to sleep when everything is at rest.
   prefers-reduced-motion: no screen shake, no particles, no score pop-ups, the camera cuts instead of gliding. Still fully playable.
   Keyboard (canvas focused): Up/Down angle, Left/Right power, Space or Enter fires (and triggers the piece's move in flight),
   R retries, N goes to the next level. Every control also exists as a real labelled button.
   The physics, the levels and the game rules sit between the PHYS markers and touch no DOM. */
(function(){
"use strict";

/* ===================================================== PHYS-BEGIN ===================================================== */
var G=14, DT=1/120, ITERS=10, VMAX=21, PULLMAX=2.4, SLEEP_T=.5;
var ANCH={x:3,y:-2.45};
function clamp(v,a,b){ return v<a?a:v>b?b:v; }

/* materials: dens = mass per unit area, hp = impact the block takes before it breaks, sc = score for breaking it */
var MAT={
  c:{name:"crate",dens:2,mu:.6,e:.03,hp:16,sc:300},
  p:{name:"plank",dens:1.6,mu:.6,e:.03,hp:13,sc:300},
  s:{name:"legacy block",dens:3.6,mu:.65,e:.02,hp:60,sc:600},
  g:{name:"stock photo",dens:1,mu:.3,e:.05,hp:4,sc:100},
  t:{name:"template",dens:.9,mu:.6,e:.05,hp:7,sc:2000}
};
var AMMO={
  K:{shape:"box",hx:.5,hy:.5,dens:3.2,mu:.5,e:.08,label:"K",move:"drops like an anvil"},
  "1":{shape:"box",hx:.22,hy:.7,dens:2.6,mu:.4,e:.15,label:"1",move:"dashes"},
  "3":{shape:"circle",r:.5,dens:2,mu:.5,e:.5,label:"3",move:"splits in three"},
  s:{shape:"circle",r:.28,dens:2,mu:.5,e:.45,label:"3",move:""}
};

/* items: [material, centre x, bottom height above the ground, width, height] */
var LEVELS=[
  {name:"Hello, templates",shots:4,ammo:["K","1","3","K"],width:24,
   tip:"Two towers and a hider behind a legacy block. Start with the K.",
   items:[["c",12.5,0,1,1],["c",12.5,1,1,1],["c",12.5,2,1,1],["t",12.5,3,1.2,.9],
          ["c",16.5,0,1,1],["c",16.5,1,1,1],["t",16.5,2,1.2,.9],
          ["s",19.3,0,1,1.4],["t",21,0,1.2,.9]]},
  {name:"Stock photo wall",shots:5,ammo:["1","K","3","K","1"],width:28,
   tip:"A legacy wall guards the hall. Go over it, or through the glass.",
   items:[["s",12,0,1,2.6],["g",14.5,0,.35,2],["g",18.5,0,.35,2],["p",16.5,2,5,.3],
          ["t",16.5,0,1.2,.9],["t",16.5,2.3,1.2,.9],
          ["c",22,0,1,1],["c",22,1,1,1],["t",22,2,1.2,.9],
          ["s",25.5,0,1,1.4],["t",25.5,1.4,1.2,.9]]},
  {name:"The big template",shots:6,ammo:["K","3","1","K","3","K"],width:36,
   tip:"Five templates across three builds. The camera follows your shot.",
   items:[["s",14,0,1,2.4],["s",18,0,1,2.4],["p",16,2.4,5,.3],["g",12.5,0,.35,2.2],["g",14.9,0,.35,2.2],
          ["t",16,0,1.2,.9],["c",16,2.7,1,1],["c",16,3.7,1,1],["t",16,4.7,1.2,.9],
          ["c",22.5,0,1,1],["c",22.5,1,1,1],["c",22.5,2,1,1],["t",22.5,3,1.2,.9],
          ["s",26.5,0,1,2.6],["s",31.5,0,1,2.6],["p",29,2.6,6,.3],["t",29,0,1.2,.9],["t",29,2.9,1.2,.9]]}
];

/* ---------- shapes and collision ---------- */
function rot(b){ b.c=Math.cos(b.a); b.s=Math.sin(b.a); }
function mkBody(o,id){
  var b={id:id,shape:o.shape,x:o.x,y:o.y,a:o.a||0,vx:o.vx||0,vy:o.vy||0,w:o.w||0,hx:o.hx||0,hy:o.hy||0,r:o.r||0,
    mu:o.mu,e:o.e,stat:!!o.stat,kind:o.kind,ammo:!!o.ammo,hp:o.hp||Infinity,maxhp:o.hp||Infinity,sc:o.sc||0,
    sleep:false,st:0,isl:0,hit:false,used:false,fade:0,c:1,s:0};
  var area=o.shape==="circle"?Math.PI*o.r*o.r:4*o.hx*o.hy, m=o.dens*area;
  b.mass=m;
  if(b.stat){ b.invM=0; b.invI=0; }
  else{ var I=o.shape==="circle"?.5*m*o.r*o.r:m*(o.hx*o.hx+o.hy*o.hy)/3; b.invM=1/m; b.invI=1/I; }
  b.rad=o.shape==="circle"?o.r:Math.sqrt(o.hx*o.hx+o.hy*o.hy);
  rot(b); return b;
}

function boxBox(A,B){
  var dx=B.x-A.x, dy=B.y-A.y, ax=[A.c,-A.s,B.c,-B.s], ay=[A.s,A.c,B.s,B.c];
  var best=1e9, bi=-1, bsign=1;
  for(var i=0;i<4;i++){
    var rA=A.hx*Math.abs(ax[i]*A.c+ay[i]*A.s)+A.hy*Math.abs(-ax[i]*A.s+ay[i]*A.c);
    var rB=B.hx*Math.abs(ax[i]*B.c+ay[i]*B.s)+B.hy*Math.abs(-ax[i]*B.s+ay[i]*B.c);
    var dist=dx*ax[i]+dy*ay[i], ov=rA+rB-Math.abs(dist);
    if(ov<0) return null;
    var sc=i<2?ov:ov*1.06+.004;
    if(sc<best){ best=sc; bi=i; bsign=dist<0?-1:1; }
  }
  var nx=ax[bi]*bsign, ny=ay[bi]*bsign, R=bi<2?A:B, I=bi<2?B:A, idx=bi&1;
  var rx=bi<2?nx:-nx, ry=bi<2?ny:-ny;                     /* reference face normal, pointing from R to I */
  var tx=idx?R.c:-R.s, ty=idx?R.s:R.c, ea=idx?R.hy:R.hx, et=idx?R.hx:R.hy;
  var fx=R.x+rx*ea, fy=R.y+ry*ea;
  var d0=I.c*rx+I.s*ry, d1=-I.s*rx+I.c*ry, ux,uy,ext,vx,vy,vt,dd;
  if(Math.abs(d0)>=Math.abs(d1)){ ux=I.c;uy=I.s;ext=I.hx;vx=-I.s;vy=I.c;vt=I.hy;dd=d0; } else { ux=-I.s;uy=I.c;ext=I.hy;vx=I.c;vy=I.s;vt=I.hx;dd=d1; }
  var sg=dd>0?-1:1, icx=I.x+ux*sg*ext, icy=I.y+uy*sg*ext;
  var p0x=icx-vx*vt, p0y=icy-vy*vt, p1x=icx+vx*vt, p1y=icy+vy*vt;
  var s0=(p0x-fx)*tx+(p0y-fy)*ty, s1=(p1x-fx)*tx+(p1y-fy)*ty, ds=s1-s0, tmin=0, tmax=1;
  if(Math.abs(ds)<1e-9){ if(s0<-et||s0>et) return null; }
  else{ var ta=(-et-s0)/ds, tb=(et-s0)/ds; tmin=Math.max(tmin,Math.min(ta,tb)); tmax=Math.min(tmax,Math.max(ta,tb)); if(tmin>tmax) return null; }
  var pts=[], ts=tmax-tmin<1e-6?[tmin]:[tmin,tmax];
  for(var k=0;k<ts.length;k++){
    var qx=p0x+(p1x-p0x)*ts[k], qy=p0y+(p1y-p0y)*ts[k], sep=(qx-fx)*rx+(qy-fy)*ry;
    if(sep>.005) continue;
    pts.push({x:qx-rx*sep*.5,y:qy-ry*sep*.5,pen:-sep});
  }
  return pts.length?{nx:nx,ny:ny,pts:pts}:null;
}
function circleBox(C,B){ /* normal points from the box to the circle */
  var dx=C.x-B.x, dy=C.y-B.y, lx=dx*B.c+dy*B.s, ly=-dx*B.s+dy*B.c;
  var cx=clamp(lx,-B.hx,B.hx), cy=clamp(ly,-B.hy,B.hy), ex=lx-cx, ey=ly-cy, d2=ex*ex+ey*ey, nlx,nly,pen,plx,ply;
  if(d2>1e-12){ var d=Math.sqrt(d2); if(d>C.r) return null; nlx=ex/d; nly=ey/d; pen=C.r-d; plx=cx; ply=cy; }
  else{ var dxp=B.hx-Math.abs(lx), dyp=B.hy-Math.abs(ly);
    if(dxp<dyp){ nlx=lx<0?-1:1; nly=0; pen=C.r+dxp; plx=nlx*B.hx; ply=ly; } else { nlx=0; nly=ly<0?-1:1; pen=C.r+dyp; plx=lx; ply=nly*B.hy; } }
  return {nx:B.c*nlx-B.s*nly,ny:B.s*nlx+B.c*nly,pts:[{x:B.x+B.c*plx-B.s*ply,y:B.y+B.s*plx+B.c*ply,pen:pen}]};
}
function collide(A,B){
  if(A.shape==="box"&&B.shape==="box") return boxBox(A,B);
  if(A.shape==="box") return circleBox(B,A);
  if(B.shape==="box"){ var m=circleBox(A,B); if(m){ m.nx=-m.nx; m.ny=-m.ny; } return m; }
  var dx=B.x-A.x, dy=B.y-A.y, d2=dx*dx+dy*dy, rr=A.r+B.r; if(d2>=rr*rr) return null;
  var d=Math.sqrt(d2), nx=d>1e-9?dx/d:0, ny=d>1e-9?dy/d:-1;
  return {nx:nx,ny:ny,pts:[{x:A.x+nx*(A.r-(rr-d)*.5),y:A.y+ny*(A.r-(rr-d)*.5),pen:rr-d}]};
}

/* ---------- one game: bodies + rules. Events are queued in g.ev for the drawing layer ---------- */
function newGame(li){
  var lv=LEVELS[li], bodies=[], cache={}, nid=1, contacts=[];
  var g={li:li,lv:lv,bodies:bodies,ev:[],phase:"aim",shots:lv.shots,queue:lv.ammo.slice(),score:0,targets:0,breaks:0,
    shotT:0,restT:0,winT:-1,stars:0,spare:0,noDamage:false,flying:[],fired:0};
  var ground=mkBody({shape:"box",x:lv.width/2,y:6,hx:lv.width/2+60,hy:6,mu:.8,e:0,stat:true,kind:"ground",dens:1},0);
  bodies.push(ground); g.ground=ground;
  lv.items.forEach(function(it){
    var m=MAT[it[0]], w=it[3], h=it[4];
    var b=mkBody({shape:"box",x:it[1],y:-(it[2]+h/2),hx:w/2,hy:h/2,mu:m.mu,e:m.e,dens:m.dens,hp:m.hp,sc:m.sc,kind:it[0]},nid++);
    bodies.push(b); if(it[0]==="t") g.targets++;
  });
  g.targets0=g.targets;
  function wakeAll(){ for(var i=0;i<bodies.length;i++){ var b=bodies[i]; if(!b.stat){ b.sleep=false; b.st=0; } } }
  function wakeIsland(id){ for(var i=0;i<bodies.length;i++){ var b=bodies[i]; if(b.isl===id&&!b.stat){ b.sleep=false; b.st=0; } } }
  g.wakeAll=wakeAll;
  function remove(b){ var i=bodies.indexOf(b); if(i>=0) bodies.splice(i,1); }
  function kill(b,why){
    remove(b); wakeAll();
    if(b.ammo){ g.ev.push({t:"gone",b:b}); return; }
    g.breaks++; g.score+=b.sc;
    g.ev.push({t:b.kind==="t"?"target":"break",b:b,why:why,sc:b.sc});
    if(b.kind==="t"){ g.targets--; if(g.targets===0&&g.winT<0) g.winT=.9; }
  }

  function step(dt){
    var i,j,A,B,c,k,p;
    for(i=0;i<bodies.length;i++){ B=bodies[i]; if(B.stat||B.sleep) continue;
      B.vy+=G*dt;
      if(!B.ammo||B.hit){ var dmp=1/(1+dt*(B.shape==="circle"?.35:.25)); B.vx*=dmp; B.vy*=dmp; B.w*=1/(1+dt*(B.shape==="circle"?.9:.5)); }
    }
    /* contacts */
    contacts.length=0; var seen={};
    for(i=0;i<bodies.length;i++){ A=bodies[i];
      for(j=i+1;j<bodies.length;j++){ B=bodies[j];
        var aa=!A.stat&&!A.sleep, ab=!B.stat&&!B.sleep; if(!aa&&!ab) continue;
        if(A.stat||B.stat){ var gb=A.stat?A:B, ob=A.stat?B:A; if(ob.y+ob.rad<gb.y-gb.hy) continue; }
        else{ var ddx=B.x-A.x, ddy=B.y-A.y, rr=A.rad+B.rad; if(ddx*ddx+ddy*ddy>rr*rr) continue; }
        var m=collide(A,B); if(!m) continue;
        if(A.sleep&&!B.stat) wakeIsland(A.isl); if(B.sleep&&!A.stat) wakeIsland(B.isl);
        if(A.ammo) A.hit=true; if(B.ammo) B.hit=true;
        var key=A.id*4096+B.id;
        contacts.push({A:A,B:B,nx:m.nx,ny:m.ny,pts:m.pts,mu:Math.sqrt(A.mu*B.mu),e:Math.max(A.e,B.e),key:key}); seen[key]=1;
      }
    }
    var old=cache; cache={};
    var inv=1/dt;
    for(i=0;i<contacts.length;i++){ c=contacts[i]; A=c.A; B=c.B; var nx=c.nx, ny=c.ny, tx=-ny, ty=nx, prev=old[c.key];
      c.tx=tx; c.ty=ty;
      for(k=0;k<c.pts.length;k++){ p=c.pts[k];
        p.rax=p.x-A.x; p.ray=p.y-A.y; p.rbx=p.x-B.x; p.rby=p.y-B.y;
        var rnA=p.rax*ny-p.ray*nx, rnB=p.rbx*ny-p.rby*nx, rtA=p.rax*ty-p.ray*tx, rtB=p.rbx*ty-p.rby*tx;
        p.mn=1/(A.invM+B.invM+A.invI*rnA*rnA+B.invI*rnB*rnB);
        p.mt=1/(A.invM+B.invM+A.invI*rtA*rtA+B.invI*rtB*rtB);
        var dvx=(B.vx-B.w*p.rby)-(A.vx-A.w*p.ray), dvy=(B.vy+B.w*p.rbx)-(A.vy+A.w*p.rax);
        p.app=-(dvx*nx+dvy*ny);
        p.bias=Math.min(2,.2*inv*Math.max(0,p.pen-.01))+(p.app>1?c.e*p.app:0);
        p.Pn=0; p.Pt=0;
        if(prev){ for(var q=0;q<prev.length;q++){ var o=prev[q]; if((o.x-p.x)*(o.x-p.x)+(o.y-p.y)*(o.y-p.y)<.0036){ p.Pn=o.Pn; p.Pt=o.Pt; break; } } }
      }
    }
    /* warm start only after every approach speed is measured, or one contact's carry-over would pollute the next one's reading */
    for(i=0;i<contacts.length;i++){ c=contacts[i]; A=c.A; B=c.B;
      for(k=0;k<c.pts.length;k++){ p=c.pts[k];
        var Px=p.Pn*c.nx+p.Pt*c.tx, Py=p.Pn*c.ny+p.Pt*c.ty;
        A.vx-=A.invM*Px; A.vy-=A.invM*Py; A.w-=A.invI*(p.rax*Py-p.ray*Px);
        B.vx+=B.invM*Px; B.vy+=B.invM*Py; B.w+=B.invI*(p.rbx*Py-p.rby*Px);
      }
    }
    for(var it=0;it<ITERS;it++){
      for(i=0;i<contacts.length;i++){ c=contacts[i]; A=c.A; B=c.B; var cx=c.nx, cy=c.ny, ctx_=c.tx, cty=c.ty;
        for(k=0;k<c.pts.length;k++){ p=c.pts[k];
          var dvx2=(B.vx-B.w*p.rby)-(A.vx-A.w*p.ray), dvy2=(B.vy+B.w*p.rbx)-(A.vy+A.w*p.rax);
          var vn=dvx2*cx+dvy2*cy, dPn=p.mn*(-vn+p.bias), Pn0=p.Pn; p.Pn=Math.max(Pn0+dPn,0); dPn=p.Pn-Pn0;
          var Qx=dPn*cx, Qy=dPn*cy;
          A.vx-=A.invM*Qx; A.vy-=A.invM*Qy; A.w-=A.invI*(p.rax*Qy-p.ray*Qx);
          B.vx+=B.invM*Qx; B.vy+=B.invM*Qy; B.w+=B.invI*(p.rbx*Qy-p.rby*Qx);
          dvx2=(B.vx-B.w*p.rby)-(A.vx-A.w*p.ray); dvy2=(B.vy+B.w*p.rbx)-(A.vy+A.w*p.rax);
          var vt=dvx2*ctx_+dvy2*cty, dPt=-p.mt*vt, mx=c.mu*p.Pn, Pt0=p.Pt; p.Pt=clamp(Pt0+dPt,-mx,mx); dPt=p.Pt-Pt0;
          Qx=dPt*ctx_; Qy=dPt*cty;
          A.vx-=A.invM*Qx; A.vy-=A.invM*Qy; A.w-=A.invI*(p.rax*Qy-p.ray*Qx);
          B.vx+=B.invM*Qx; B.vy+=B.invM*Qy; B.w+=B.invI*(p.rbx*Qy-p.rby*Qx);
        }
      }
    }
    for(i=0;i<contacts.length;i++){ c=contacts[i]; cache[c.key]=c.pts.map(function(pt){ return {x:pt.x,y:pt.y,Pn:pt.Pn,Pt:pt.Pt}; }); }
    for(var key2 in old){ if(!seen[key2]){ /* a pair that is asleep keeps its warm start */
      var a2=Math.floor(key2/4096), b2=key2%4096, ba=null, bb=null;
      for(i=0;i<bodies.length;i++){ if(bodies[i].id===a2) ba=bodies[i]; else if(bodies[i].id===b2) bb=bodies[i]; }
      if(ba&&bb&&(ba.sleep||ba.stat)&&(bb.sleep||bb.stat)) cache[key2]=old[key2]; } }
    /* integrate */
    for(i=0;i<bodies.length;i++){ B=bodies[i]; if(B.stat||B.sleep) continue; B.x+=B.vx*dt; B.y+=B.vy*dt; B.a+=B.w*dt; rot(B); }
    /* impact damage: the approach speed before the solve, scaled by how much mass is really meeting */
    if(!g.noDamage){
      var dmg=[];
      for(i=0;i<contacts.length;i++){ c=contacts[i]; var ap=0; for(k=0;k<c.pts.length;k++) if(c.pts[k].app>ap) ap=c.pts[k].app;
        if(ap>3){ var me=1/(c.A.invM+c.B.invM), d=(ap-3)*me*.55;
          if(c.A.hp<1e8) dmg.push([c.A,d]); if(c.B.hp<1e8) dmg.push([c.B,d]);
          g.ev.push({t:"hit",x:c.pts[0].x,y:c.pts[0].y,v:ap,m:me}); } }
      for(i=0;i<dmg.length;i++){ dmg[i][0].hp-=dmg[i][1]; }
      for(i=bodies.length-1;i>=0;i--){ B=bodies[i]; if(!B.stat&&B.hp<=0&&!B.ammo) kill(B,"hit"); }
    }
    /* anything that leaves the world is gone (a template that falls off the edge is a template removed) */
    for(i=bodies.length-1;i>=0;i--){ B=bodies[i]; if(B.stat) continue; if(B.y>14||B.x>lv.width+12||B.x<-14) kill(B,"out"); }
    /* islands and sleep */
    var par={}; function find(x){ while(par[x]!==x){ par[x]=par[par[x]]; x=par[x]; } return x; }
    for(i=0;i<bodies.length;i++){ B=bodies[i]; if(!B.stat) par[B.id]=B.id; }
    for(i=0;i<contacts.length;i++){ c=contacts[i]; if(c.A.stat||c.B.stat) continue; if(par[c.A.id]===undefined||par[c.B.id]===undefined) continue; par[find(c.A.id)]=find(c.B.id); }
    var minT={};
    for(i=0;i<bodies.length;i++){ B=bodies[i]; if(B.stat||B.sleep) continue;
      var calmB=B.vx*B.vx+B.vy*B.vy<.04&&Math.abs(B.w)<.3; B.st=calmB?B.st+dt:0; }
    for(i=0;i<bodies.length;i++){ B=bodies[i]; if(B.stat) continue; var r=find(B.id); B.isl=r; var t=B.sleep?99:B.st; if(minT[r]===undefined||t<minT[r]) minT[r]=t; }
    for(i=0;i<bodies.length;i++){ B=bodies[i]; if(B.stat||B.sleep) continue; if(minT[B.isl]>=SLEEP_T){ B.sleep=true; B.vx=B.vy=B.w=0; } }
    for(i=0;i<bodies.length;i++){ B=bodies[i]; if(B.fade>0){ B.fade-=dt; if(B.fade<=0){ remove(B); wakeAll(); i--; } } }
  }

  /* ---------- the rules around a shot ---------- */
  function awakeMoving(){ for(var i=0;i<bodies.length;i++){ var b=bodies[i]; if(b.stat||b.sleep||b.fade>0) continue; if(b.vx*b.vx+b.vy*b.vy>.09||Math.abs(b.w)>.6) return true; } return false; }
  g.live=function(){ if(g.phase==="fly"||g.winT>=0) return true; for(var i=0;i<bodies.length;i++){ var b=bodies[i]; if(!b.stat&&(!b.sleep||b.fade>0)) return true; } return false; };
  g.step=function(dt){
    step(dt);
    if(g.phase==="fly"){
      g.shotT+=dt; g.restT=awakeMoving()?0:g.restT+dt;
      if(g.winT<0&&(g.restT>.8||g.shotT>10)) g.resolve();
    }
    if(g.winT>=0&&g.phase!=="won"&&g.phase!=="lost"){ g.winT-=dt; if(g.winT<=0) g.win(); }
  };
  g.resolve=function(){
    bodies.forEach(function(b){ if(b.ammo&&b.fade<=0) b.fade=.45; });
    g.flying=[];
    if(g.targets===0){ g.phase="aim"; return; }
    if(g.shots===0){ g.phase="lost"; g.ev.push({t:"lost"}); return; }
    g.phase="aim"; g.ev.push({t:"load"});
  };
  g.win=function(){
    g.phase="won"; g.spare=g.shots; g.score+=g.spare*2500;
    g.stars=1+(g.spare>=1?1:0)+(g.spare>=2?1:0);
    g.ev.push({t:"won"});
  };
  g.next=function(){ return g.queue[0]; };
  function mkAmmo(kind,x,y,vx,vy){
    var d=AMMO[kind];
    var b=mkBody({shape:d.shape,x:x,y:y,vx:vx,vy:vy,hx:d.hx,hy:d.hy,r:d.r,dens:d.dens,mu:d.mu,e:d.e,kind:kind,ammo:true},nid++);
    bodies.push(b); return b;
  }
  g.fire=function(angleDeg,power){
    if(g.phase!=="aim"||!g.queue.length||g.winT>=0) return false;
    var kind=g.queue.shift(), a=angleDeg*Math.PI/180, sp=VMAX*power;
    g.shots--; g.fired++; wakeAll();
    var b=mkAmmo(kind,ANCH.x,ANCH.y,Math.cos(a)*sp,-Math.sin(a)*sp);
    g.flying=[b]; g.phase="fly"; g.shotT=0; g.restT=0; g.ev.push({t:"fire",b:b,kind:kind});
    return true;
  };
  g.canMove=function(){ return g.phase==="fly"&&g.flying.length===1&&!g.flying[0].used&&!g.flying[0].hit&&bodies.indexOf(g.flying[0])>=0; };
  g.move=function(){
    if(!g.canMove()) return false;
    var b=g.flying[0]; b.used=true; wakeAll();
    if(b.kind==="K"){ b.vx*=.5; b.vy=Math.max(b.vy,0)+17; b.w=0; }
    else if(b.kind==="1"){ var sp=Math.hypot(b.vx,b.vy), f=Math.min(1.75,34/sp); b.vx*=f; b.vy*=f; }
    else if(b.kind==="3"){
      var sp3=Math.hypot(b.vx,b.vy), an=Math.atan2(b.vy,b.vx); remove(b); g.flying=[];
      [-.3,0,.3].forEach(function(da){ var c3=mkAmmo("s",b.x+Math.cos(an+da)*.2,b.y+Math.sin(an+da)*.2,Math.cos(an+da)*sp3,Math.sin(an+da)*sp3); c3.used=true; g.flying.push(c3); });
    }
    g.ev.push({t:"move",b:b,kind:b.kind});
    return true;
  };
  g.settle=function(){
    g.noDamage=true;
    for(var i=0;i<120;i++) step(DT);
    bodies.forEach(function(b){ if(!b.stat){ b.vx=b.vy=b.w=0; b.sleep=true; b.hit=false; } });
    g.noDamage=false; g.ev.length=0;
  };
  g.settle();
  return g;
}
/* ====================================================== PHYS-END ====================================================== */

/* ============================================================ the card, the canvas, the controls ============================================================ */
var mount=document.querySelector('[data-game="angry13"]');
if(!mount) return;
var mq=window.matchMedia("(prefers-reduced-motion: reduce)");
function calm(){ return mq.matches; }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function txt(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; e.textContent=text; return e; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }

/* card chrome: the same DOM and classes as card() in workbench.js (head, instruction, stage, reset, status, footnote) */
mount.classList.add("wb");
var head=el("div","wb-head"), tt=el("div");
tt.appendChild(txt("h3","wb-title","Angry 13")); tt.appendChild(txt("span","wb-from","from K13")); head.appendChild(tt); mount.appendChild(head);
var instr=txt("p","wb-instr","Pull the K back, line up the dots, let go. Knock down every template."); instr.id="a13-i"; mount.appendChild(instr);
var stage=el("div","wb-stage a13-stage"); stage.setAttribute("aria-describedby","a13-i"); mount.appendChild(stage);
var reset=el("button","wb-reset",'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Retry</span>');
reset.type="button"; reset.setAttribute("aria-label","Retry this level"); stage.appendChild(reset);
var read=el("div","wb-read"); read.setAttribute("role","status"); read.setAttribute("aria-live","polite"); mount.appendChild(read);
mount.appendChild(txt("p","wb-foot","Arrows aim, Space fires and uses the piece's move, R retries, N is the next level. Progress is kept on this device."));
function pl(n,w){ return n+" "+w+(n===1?"":"s"); }
function say(t){ read.innerHTML=""; if(t) read.appendChild(txt("span","",t)); }

var view=el("div","a13-view"); stage.appendChild(view);
var cv=el("canvas","a13-cv"); cv.tabIndex=0; cv.setAttribute("role","img");
cv.setAttribute("aria-label","Angry 13 game board. Drag the piece back from the slingshot to aim, or use the arrow keys, and press Space to fire.");
view.appendChild(cv);
var ctx=cv.getContext("2d");
var hud=el("div","a13-hud");
var hLevel=txt("span","a13-chip",""), hShots=txt("span","a13-chip",""), hLeft=txt("span","a13-chip",""), hScore=txt("span","a13-chip","");
hud.appendChild(hLevel); hud.appendChild(hShots); hud.appendChild(hLeft); hud.appendChild(hScore); view.appendChild(hud);
var over=el("div","a13-over"); over.hidden=true; over.setAttribute("role","group"); over.setAttribute("aria-label","Level result"); view.appendChild(over);

var bar=el("div","a13-bar"); bar.setAttribute("role","group"); bar.setAttribute("aria-label","Angry 13 controls"); stage.appendChild(bar);
function btn(label,aria,cls){ var b=txt("button","a13-btn "+(cls||""),label); b.type="button"; if(aria) b.setAttribute("aria-label",aria); return b; }
var lvWrap=el("div","a13-grp"); lvWrap.setAttribute("role","group"); lvWrap.setAttribute("aria-label","Level");
var lvBtns=[0,1,2].map(function(i){ var b=btn("","Level "+(i+1)); b.addEventListener("click",function(){ if(!b.disabled){ loadLevel(i,true); focusBoard(); } }); lvWrap.appendChild(b); return b; });
bar.appendChild(lvWrap);
var angGrp=el("div","a13-grp"), powGrp=el("div","a13-grp");
var angDn=btn("−","Angle down"), angUp=btn("+","Angle up"), powDn=btn("−","Less power"), powUp=btn("+","More power");
var angOut=txt("span","a13-val",""), powOut=txt("span","a13-val","");
angGrp.appendChild(txt("span","a13-lab","Angle")); angGrp.appendChild(angDn); angGrp.appendChild(angOut); angGrp.appendChild(angUp);
powGrp.appendChild(txt("span","a13-lab","Power")); powGrp.appendChild(powDn); powGrp.appendChild(powOut); powGrp.appendChild(powUp);
bar.appendChild(angGrp); bar.appendChild(powGrp);
var fireBtn=btn("Fire","Fire the next piece","a13-fire"); bar.appendChild(fireBtn);

/* ---------- state ---------- */
var save=(function(){ try{ var s=JSON.parse(store("k13_angry13")||"null"); if(s&&s.best&&s.score&&s.best.length===3) return s; }catch(e){} return {best:[0,0,0],score:[0,0,0]}; })();
function persist(){ store("k13_angry13",JSON.stringify(save)); }
var g=null, aim={a:40,p:.62}, dragging=false, touchedHint=false;
var W=0,H=0,ppu=30,camX=0,camTop=0,visW=18,vis=false,on=false,raf=0,acc=0,last=0,shake=0,pal=null,dprv=1,camKeep;
var parts=[],pops=[],sig="";

function unlocked(i){ return i===0||save.best[i-1]>0; }
function stars(n){ return "★★★".slice(0,n)+"☆☆☆".slice(0,3-n); }
function refreshChips(){
  lvBtns.forEach(function(b,i){
    var s=save.best[i], ok=unlocked(i);
    b.textContent=(i+1)+" "+stars(s); b.disabled=!ok; b.setAttribute("aria-pressed",String(!!g&&g.li===i));
    b.setAttribute("aria-label","Level "+(i+1)+(ok?(s?", best "+s+(s===1?" star":" stars"):", not cleared yet"):", locked, clear level "+i+" first"));
  });
}
function hudUpdate(){
  if(!g) return;
  hLevel.textContent="Level "+(g.li+1)+" of 3"; hShots.textContent="Shots "+g.shots;
  hLeft.textContent="Templates "+g.targets; hScore.textContent="Score "+g.score;
}
function controlsUpdate(){
  var canAim=!!g&&g.phase==="aim"&&g.queue.length>0&&g.winT<0, fly=!!g&&g.phase==="fly", mv=fly&&g.canMove();
  var s=[Math.round(aim.a),Math.round(aim.p*100),canAim,fly,mv,g&&g.next()].join("|");
  if(s===sig) return; sig=s;
  angOut.textContent=Math.round(aim.a)+"°"; powOut.textContent=Math.round(aim.p*100)+"%";
  [angDn,angUp,powDn,powUp].forEach(function(b){ b.disabled=!canAim; });
  if(fly){ fireBtn.textContent="Boost"; fireBtn.disabled=!mv; fireBtn.setAttribute("aria-label","Use the piece's move"); }
  else{ fireBtn.textContent="Fire"; fireBtn.disabled=!canAim; fireBtn.setAttribute("aria-label",canAim?"Fire the "+g.next()+" piece":"Fire"); }
}
function nextName(){ var k=g.next(); return k?"the "+AMMO[k].label:"nothing"; }

function loadLevel(i,announce){
  g=newGame(i); parts.length=0; pops.length=0; camX=0; camKeep=undefined; shake=0; over.hidden=true; over.innerHTML=""; sig="";
  touchedHint=false; hudUpdate(); controlsUpdate(); refreshChips();
  if(announce!==false) say("Level "+(i+1)+" of 3, "+g.lv.name+". "+g.lv.tip+" "+g.lv.shots+" shots, "+pl(g.targets,"template")+". First up: "+nextName()+".");
  fit(); wake();
}

/* ---------- aim ---------- */
function aimDot(){ var a=aim.a*Math.PI/180, L=aim.p*PULLMAX; return {x:ANCH.x-Math.cos(a)*L,y:ANCH.y+Math.sin(a)*L}; }
function clampAim(){ aim.a=clamp(aim.a,2,80); aim.p=clamp(aim.p,.2,1); }
function nudge(da,dp){ if(!g||g.phase!=="aim") return; touchedHint=true; aim.a+=da; aim.p+=dp; clampAim(); controlsUpdate(); wake(); }
function doFire(){
  if(!g) return;
  if(g.phase==="aim"&&g.queue.length){ var k=g.next(); if(g.fire(aim.a,aim.p)){ touchedHint=true; say(AMMO[k].label+" away at "+Math.round(aim.a)+" degrees, "+Math.round(aim.p*100)+" percent. "+g.shots+(g.shots===1?" shot":" shots")+" left."+(AMMO[k].move?" Press Space or tap in flight and it "+AMMO[k].move+".":"")); } }
  else if(g.phase==="fly"){ if(!g.move()) say("Too late, the piece already hit something."); }
  hudUpdate(); controlsUpdate(); wake();
}
function worldAt(e){ var r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*(W/(r.width||1))/ppu+camX, y:(e.clientY-r.top)*(H/(r.height||1))/ppu+camTop}; }
function dragTo(p){
  var dx=p.x-ANCH.x, dy=p.y-ANCH.y, L=Math.hypot(dx,dy), back=Math.min(dx,-.05);
  aim.a=Math.atan2(clamp(dy,0,9),-back)*180/Math.PI; aim.p=L/PULLMAX; clampAim(); controlsUpdate();
}
cv.addEventListener("pointerdown",function(e){
  if(e.button>0||!g) return; e.preventDefault(); try{ cv.focus({preventScroll:true}); }catch(x){}
  if(g.phase==="aim"&&g.queue.length&&g.winT<0){
    var p=worldAt(e), d=aimDot();
    if(Math.hypot(p.x-d.x,p.y-d.y)<Math.max(2.4,60/ppu)){ dragging=true; touchedHint=true; try{ cv.setPointerCapture(e.pointerId); }catch(x){} dragTo(p); wake(); }
  } else if(g.phase==="fly"){ doFire(); }
});
cv.addEventListener("pointermove",function(e){ if(dragging){ dragTo(worldAt(e)); wake(); } });
cv.addEventListener("pointerup",function(e){
  if(!dragging) return; dragging=false; var p=worldAt(e), L=Math.hypot(p.x-ANCH.x,p.y-ANCH.y);
  if(L>=.35*PULLMAX) doFire(); else { say("Pull back further to fire."); wake(); }
});
cv.addEventListener("pointercancel",function(){ dragging=false; wake(); });
cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });
cv.addEventListener("keydown",function(e){
  var k=e.key, big=e.shiftKey?5:1;
  if(k==="ArrowUp"){ e.preventDefault(); nudge(big,0); }
  else if(k==="ArrowDown"){ e.preventDefault(); nudge(-big,0); }
  else if(k==="ArrowRight"){ e.preventDefault(); nudge(0,.02*big); }
  else if(k==="ArrowLeft"){ e.preventDefault(); nudge(0,-.02*big); }
  else if(k===" "||k==="Enter"){ e.preventDefault(); doFire(); }
});
mount.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key==="r"||e.key==="R"){ e.preventDefault(); retry(); }
  else if(e.key==="n"||e.key==="N"){ e.preventDefault(); nextLevel(); }
});
function hold(b,da,dp){
  var t=0,iv=0;
  function stopH(){ clearTimeout(t); clearInterval(iv); }
  b.addEventListener("pointerdown",function(e){ if(e.button>0||b.disabled) return; nudge(da,dp); t=setTimeout(function(){ iv=setInterval(function(){ nudge(da,dp); },70); },380); });
  ["pointerup","pointercancel","pointerleave","blur"].forEach(function(n){ b.addEventListener(n,stopH); });
  b.addEventListener("click",function(e){ if(e.detail===0) nudge(da,dp); });
}
hold(angDn,-1,0); hold(angUp,1,0); hold(powDn,0,-.02); hold(powUp,0,.02);
fireBtn.addEventListener("click",doFire);
function focusBoard(){ try{ cv.focus({preventScroll:true}); }catch(x){} }
function retry(){ if(!g) return; loadLevel(g.li,false); say("Retrying level "+(g.li+1)+". "+g.shots+" shots, "+pl(g.targets,"template")+". First up: "+nextName()+"."); focusBoard(); }
function nextLevel(){ if(!g) return; var n=g.li+1; if(n<3&&(g.phase==="won"||unlocked(n))){ loadLevel(n,true); focusBoard(); } }
reset.addEventListener("click",retry);

/* ---------- results ---------- */
function totalStars(){ return save.best[0]+save.best[1]+save.best[2]; }
function showOver(won){
  over.innerHTML=""; var panel=el("div","a13-panel"), h=txt("h4","a13-over-t",""), sub=txt("p","a13-over-s",""), row=el("div","a13-over-row"), primary;
  function ob(label,cls,fn){ var b=txt("button","a13-obtn "+(cls||""),label); b.type="button"; b.addEventListener("click",fn); row.appendChild(b); return b; }
  if(won){
    var last=g.li===2, all=last&&save.best.every(function(s){ return s>0; });
    h.textContent=all?"All three levels clear":"Level "+(g.li+1)+" clear";
    var st=el("div","a13-stars"); st.setAttribute("role","img"); st.setAttribute("aria-label",g.stars+" of 3 stars");
    for(var i=0;i<3;i++){ st.appendChild(txt("span",i<g.stars?"on":"",i<g.stars?"★":"☆")); }
    sub.textContent="Score "+g.score+(g.spare?", "+g.spare+(g.spare===1?" spare shot":" spare shots")+" earned the stars":", no shots to spare")+(all?". "+totalStars()+" of 9 stars in all.":".");
    panel.appendChild(h); panel.appendChild(st); panel.appendChild(sub);
    primary=last?ob("Play again","",function(){ loadLevel(0,true); focusBoard(); }):ob("Next level","",nextLevel);
    ob("Retry for more stars","ghost",retry);
  } else {
    h.textContent="Out of shots"; sub.textContent=pl(g.targets,"template")+" still standing. Same level, fresh shots.";
    panel.appendChild(h); panel.appendChild(sub); primary=ob("Retry","",retry);
  }
  panel.appendChild(row); over.appendChild(panel); over.hidden=false;
  setTimeout(function(){ try{ primary.focus({preventScroll:true}); }catch(x){} },30);
}

/* ---------- the loop ---------- */
function drain(){
  var evs=g.ev.splice(0,g.ev.length);
  for(var i=0;i<evs.length;i++){ var e=evs[i];
    if(e.t==="break"||e.t==="target"){
      if(!calm()){ burst(e.b,e.t==="target"); if(e.sc>=300) pops.push({x:e.b.x,y:e.b.y-.6,t:0,s:"+"+e.sc}); shake=Math.min(.22,shake+(e.t==="target"?.1:.04)); }
      if(e.t==="target") say(g.targets>0?"Template down. "+pl(g.targets,"template")+" left.":"Last template down.");
    } else if(e.t==="hit"){ if(!calm()&&e.v>7&&e.m>.8) shake=Math.min(.22,shake+.03); }
    else if(e.t==="move"){ if(!calm()) burst(e.b,false,true); say(AMMO[e.kind].label+" "+AMMO[e.kind].move+"."); }
    else if(e.t==="load") say("Next up: "+nextName()+". "+pl(g.shots,"shot")+" left, "+pl(g.targets,"template")+" standing.");
    else if(e.t==="won"){
      if(g.stars>save.best[g.li]) save.best[g.li]=g.stars;
      if(g.score>save.score[g.li]) save.score[g.li]=g.score;
      persist(); refreshChips();
      var all=g.li===2&&save.best.every(function(s){ return s>0; });
      say(all?"All three levels clear. "+totalStars()+" of 9 stars. Score "+g.score+".":"Level "+(g.li+1)+" clear with "+g.stars+(g.stars===1?" star":" stars")+". Score "+g.score+".");
      showOver(true);
    } else if(e.t==="lost"){ say("Out of shots. "+pl(g.targets,"template")+" still standing. Press R to retry."); showOver(false); }
  }
}
function burst(b,isTarget,dash){
  var n=dash?7:isTarget?18:9, cols=isTarget?["#FFFFFF","#B94612","#1F2023","#EA5E14"]:b.kind==="g"?["#BFE6DA","#FFFFFF"]:b.kind==="s"?["#414347","#606267"]:["#F2C99A","#E6B27C","#C98F55"];
  if(dash) cols=["#EA5E14","#FFFFFF"];
  for(var i=0;i<n&&parts.length<160;i++){ var a=Math.random()*6.28, sp=dash?2+Math.random()*4:2+Math.random()*7;
    parts.push({x:b.x,y:b.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-(dash?0:3),life:.7+Math.random()*.5,t:0,c:cols[i%cols.length],s:.1+Math.random()*.14,r:Math.random()*6}); }
}
function camTarget(){
  var mx=Math.max(0,g.lv.width-visW);
  if(mx<=0) return 0;
  if(g.phase==="fly"){
    var f=g.flying.filter(function(b){ return g.bodies.indexOf(b)>=0; })[0]; if(f) camKeep=f.x-visW*.3;
    return clamp(camKeep===undefined?0:camKeep,0,mx);
  }
  camKeep=undefined; return 0;
}
function fx(dt){
  var tgt=camTarget();
  if(calm()||Math.abs(tgt-camX)<.01) camX=tgt; else camX+=(tgt-camX)*Math.min(1,dt*(g.phase==="fly"?5:3));
  shake=Math.max(0,shake-dt*.6);
  for(var i=parts.length-1;i>=0;i--){ var p=parts[i]; p.t+=dt; if(p.t>p.life){ parts.splice(i,1); continue; } p.vy+=G*.7*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.r+=dt*6; }
  for(i=pops.length-1;i>=0;i--){ pops[i].t+=dt; if(pops[i].t>1.1) pops.splice(i,1); }
}
function busy(){ return !!g&&(g.live()||parts.length>0||pops.length>0||dragging||Math.abs(camTarget()-camX)>.01||shake>0); }
function a13frame(t){
  raf=0; if(!vis||document.hidden){ on=false; return; }
  var dt=Math.min(.05,(t-last)/1000); last=t; acc+=dt; var n=0;
  while(acc>=DT&&n<8){ g.step(DT); acc-=DT; n++; } if(n===8) acc=0;
  fx(dt); drain(); hudUpdate(); controlsUpdate(); draw();
  if(!busy()){ on=false; return; }
  raf=window.requestAnimationFrame(a13frame);
}
function wake(){ if(on||!vis||document.hidden||!g){ if(g&&vis&&W) draw(); return; } if(!W&&!fit()) return; on=true; acc=0; last=performance.now(); raf=window.requestAnimationFrame(a13frame); }
function stopLoop(){ if(raf){ window.cancelAnimationFrame(raf); raf=0; } on=false; }
new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis){ fit(); wake(); } else stopLoop(); },{threshold:0}).observe(stage);
document.addEventListener("visibilitychange",function(){ if(document.hidden) stopLoop(); else wake(); });
if(window.ResizeObserver) new ResizeObserver(function(){ if(fit()) wake(); }).observe(view); else window.addEventListener("resize",function(){ if(fit()) wake(); });
new MutationObserver(function(){ pal=null; if(vis) draw(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
if(mq.addEventListener) mq.addEventListener("change",function(){ if(vis) wake(); });

function fit(){
  var w=view.clientWidth, h=view.clientHeight; if(!w||!h) return false;
  dprv=Math.min(window.devicePixelRatio||1,3);
  var pw=Math.round(w*dprv), ph=Math.round(h*dprv);
  if(cv.width!==pw||cv.height!==ph){ cv.width=pw; cv.height=ph; }
  W=w; H=h; ppu=Math.min(h/10.5,w/18); visW=w/ppu; camTop=.7-h/ppu;
  if(g) draw(); return true;
}

/* ---------- drawing ---------- */
function palette(){
  var cs=getComputedStyle(document.documentElement);
  function v(n,d){ var s=cs.getPropertyValue(n).trim(); return s||d; }
  return {bg:v("--paper-3","#E9EDF7"),ink:v("--ink","#1F2023"),or:v("--blue","#B94612"),or2:v("--blue-2","#EA5E14"),line:v("--line-2","rgba(31,32,35,.22)"),muted:v("--muted","#5D5F65")};
}
function sx(x){ return (x-camX)*ppu; } function sy(y){ return (y-camTop)*ppu; }
var FILL={c:"#F2C99A",p:"#E6B27C",s:"#414347",g:"rgba(191,230,218,.88)",t:"#FFFFFF"};
function glyph(ch,size,col){ ctx.fillStyle=col; ctx.font="600 "+Math.round(size)+"px Fraunces,Georgia,serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(ch,0,size*.05); }
function ammoShape(kind,s,r){
  var d=AMMO[kind], u=ppu*s; ctx.fillStyle="#FFFFFF";
  if(d.shape==="circle"){ ctx.beginPath(); ctx.arc(0,0,d.r*u,0,6.2832); ctx.fill(); ctx.stroke(); glyph("3",d.r*u*1.35,"#B94612"); }
  else{ ctx.beginPath(); ctx.rect(-d.hx*u,-d.hy*u,d.hx*2*u,d.hy*2*u); ctx.fill(); ctx.stroke();
    glyph(kind==="K"?"K":"1",Math.min(d.hx*2.2,d.hy*1.5)*u*(kind==="1"?1.15:1),kind==="K"?"#1F2023":"#B94612"); }
}
function drawBody(b){
  var a=b.fade>0?Math.max(0,b.fade/.45):1;
  ctx.save(); ctx.globalAlpha=a; ctx.translate(sx(b.x),sy(b.y)); ctx.rotate(b.a); ctx.lineWidth=Math.max(1.5,ppu*.05); ctx.strokeStyle="#1F2023"; ctx.lineJoin="round";
  if(b.ammo){ ammoShape(b.kind,1); ctx.restore(); return; }
  var w=b.hx*2*ppu, h=b.hy*2*ppu, x=-w/2, y=-h/2, hurt=b.hp/b.maxhp;
  ctx.fillStyle=FILL[b.kind]; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
  if(b.kind==="c"){ ctx.save(); ctx.globalAlpha=a*.35; ctx.beginPath(); ctx.moveTo(x+3,y+3); ctx.lineTo(x+w-3,y+h-3); ctx.moveTo(x+w-3,y+3); ctx.lineTo(x+3,y+h-3); ctx.stroke(); ctx.strokeRect(x+4,y+4,w-8,h-8); ctx.restore(); }
  else if(b.kind==="p"){ ctx.save(); ctx.globalAlpha=a*.4; ctx.lineWidth=1; for(var i=1;i<9;i++){ var lx=x+w*i/9; ctx.beginPath(); ctx.moveTo(lx,y+2); ctx.lineTo(lx,y+h*.45); ctx.stroke(); } ctx.restore(); }
  else if(b.kind==="s"){ ctx.save(); ctx.globalAlpha=a*.85; glyph("{ }",Math.min(w,h)*.5,"#D2D3D6"); ctx.restore(); }
  else if(b.kind==="g"){ ctx.save(); ctx.globalAlpha=a*.8; ctx.strokeStyle="#FFFFFF"; ctx.lineWidth=Math.max(2,ppu*.06); ctx.beginPath(); ctx.moveTo(x+w*.2,y+h*.12); ctx.lineTo(x+w*.2,y+h*.4); ctx.moveTo(x+w*.2,y+h*.5); ctx.lineTo(x+w*.2,y+h*.58); ctx.stroke(); ctx.restore(); }
  else if(b.kind==="t"){
    var lw=Math.max(1.5,ppu*.05);
    ctx.fillStyle="#B94612"; ctx.fillRect(x,y,w,h*.24); ctx.strokeRect(x,y,w,h*.24);
    ctx.fillStyle="#FFFFFF"; for(var d=0;d<3;d++){ ctx.beginPath(); ctx.arc(x+w*.12+d*w*.09,y+h*.12,Math.max(1.2,h*.04),0,6.28); ctx.fill(); }
    var ex=w*.2, ey=y+h*.5; ctx.fillStyle="#1F2023"; ctx.strokeStyle="#1F2023"; ctx.lineWidth=lw;
    if(hurt>.6){ ctx.beginPath(); ctx.arc(-ex,ey,h*.08,0,6.28); ctx.arc(ex,ey,h*.08,0,6.28); ctx.fill(); ctx.beginPath(); ctx.moveTo(-ex-h*.14,ey-h*.14); ctx.lineTo(-ex+h*.1,ey-h*.07); ctx.moveTo(ex+h*.14,ey-h*.14); ctx.lineTo(ex-h*.1,ey-h*.07); ctx.stroke(); }
    else{ [-ex,ex].forEach(function(cx){ ctx.beginPath(); ctx.moveTo(cx-h*.08,ey-h*.07); ctx.lineTo(cx+h*.08,ey+h*.07); ctx.moveTo(cx+h*.08,ey-h*.07); ctx.lineTo(cx-h*.08,ey+h*.07); ctx.stroke(); }); }
    ctx.beginPath(); ctx.moveTo(-w*.12,y+h*.82); ctx.lineTo(w*.12,y+h*.82); ctx.stroke();
  }
  if(hurt<.55&&b.kind!=="g"){ ctx.save(); ctx.strokeStyle="rgba(31,32,35,.7)"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x+w*.3,y); ctx.lineTo(x+w*.42,y+h*.3); ctx.lineTo(x+w*.33,y+h*.55); ctx.lineTo(x+w*.5,y+h); ctx.stroke(); ctx.restore(); }
  ctx.restore();
}
function drawSling(front,at){
  var ax=sx(ANCH.x), ay=sy(ANCH.y), u=ppu, s=front?1:-1;
  ctx.save(); ctx.lineCap="round"; ctx.strokeStyle="#1F2023"; ctx.lineWidth=Math.max(5,u*.2);
  if(!front){ ctx.beginPath(); ctx.moveTo(ax,sy(0)); ctx.lineTo(ax,ay+u*.7); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(ax,ay+u*.7); ctx.lineTo(ax+s*u*.3,ay-u*.05); ctx.stroke();
  if(at){ ctx.strokeStyle=pal.or; ctx.lineWidth=Math.max(3,u*.1); ctx.beginPath(); ctx.moveTo(ax+s*u*.3,ay-u*.05); ctx.lineTo(at.x,at.y); ctx.stroke(); }
  ctx.restore();
}
function draw(){
  if(!g||!W) return;
  if(!pal) pal=palette();
  var P=pal, sh=shake>0&&!calm()?shake:0, ox=sh?(Math.random()-.5)*sh*ppu:0, oy=sh?(Math.random()-.5)*sh*ppu:0, i;
  ctx.setTransform(dprv,0,0,dprv,0,0); ctx.clearRect(0,0,W,H);
  ctx.save(); ctx.translate(ox,oy);
  ctx.fillStyle=P.bg; ctx.fillRect(-20,-20,W+40,H+40);
  /* a skyline of wireframe pages: the templates we are up against */
  ctx.save(); ctx.strokeStyle=P.line; ctx.globalAlpha=.55; ctx.lineWidth=1;
  for(i=0;i<14;i++){ var bw=(3+((i*7)%4))*ppu, bh=(2.4+((i*5)%4)*.9)*ppu, span=W+bw*2, bx=(((i*5.3-camX*.35)*ppu)%span+span)%span-bw, by=sy(0)-bh;
    ctx.strokeRect(bx,by,bw,bh); ctx.beginPath(); ctx.moveTo(bx,by+bh*.18); ctx.lineTo(bx+bw,by+bh*.18); ctx.moveTo(bx+bw*.12,by+bh*.4); ctx.lineTo(bx+bw*.6,by+bh*.4); ctx.moveTo(bx+bw*.12,by+bh*.55); ctx.lineTo(bx+bw*.45,by+bh*.55); ctx.stroke(); }
  ctx.restore();
  /* ground */
  var gy=sy(0); ctx.fillStyle="#26272B"; ctx.fillRect(-20,gy,W+40,H-gy+20); ctx.fillStyle="#EA5E14"; ctx.fillRect(-20,gy,W+40,Math.max(3,ppu*.1));
  ctx.strokeStyle="rgba(255,255,255,.12)"; ctx.lineWidth=1; ctx.beginPath(); var t0=Math.floor(camX/1.5)*1.5; for(var x=t0;x<camX+visW+2;x+=1.5){ var gx=sx(x); ctx.moveTo(gx,gy+ppu*.35); ctx.lineTo(gx-ppu*.3,gy+ppu*.8); } ctx.stroke();
  /* sling, back arm, queued pieces, the loaded piece, front arm */
  var loaded=g.phase==="aim"&&g.queue.length>0&&g.winT<0, pull=loaded?aimDot():{x:ANCH.x,y:ANCH.y}, pp={x:sx(pull.x),y:sy(pull.y)};
  drawSling(false,loaded?pp:null);
  for(i=loaded?1:0;i<g.queue.length;i++){ var qd=AMMO[g.queue[i]]; ctx.save(); ctx.translate(sx(4.8+(i-1)*.95),gy-(qd.hy||qd.r)*ppu*.7-1); ctx.lineWidth=Math.max(1.5,ppu*.05); ctx.strokeStyle="#1F2023"; ammoShape(g.queue[i],.7); ctx.restore(); }
  if(loaded){
    var k=g.next(), a=aim.a*Math.PI/180, sp=VMAX*aim.p, vx=Math.cos(a)*sp, vy=-Math.sin(a)*sp;
    ctx.save(); ctx.fillStyle=P.or;
    for(var j=1;j<=26;j++){ var tt=j*.085, px=pull.x+vx*tt, py=pull.y+vy*tt+.5*G*tt*tt; if(py>-.1) break; ctx.globalAlpha=Math.max(.18,1-j/30); ctx.beginPath(); ctx.arc(sx(px),sy(py),Math.max(2,ppu*.07),0,6.28); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.translate(pp.x,pp.y); ctx.lineWidth=Math.max(1.5,ppu*.05); ctx.strokeStyle="#1F2023"; ammoShape(k,1); ctx.restore();
    if(!touchedHint&&!calm()){ ctx.save(); ctx.fillStyle=P.muted; ctx.font="500 "+Math.max(11,Math.round(ppu*.38))+"px 'JetBrains Mono',monospace"; ctx.textAlign="left"; ctx.fillText("pull back and let go",sx(.5),sy(-6.2)); ctx.restore(); }
  }
  drawSling(true,loaded?pp:null);
  for(i=0;i<g.bodies.length;i++){ var b=g.bodies[i]; if(!b.stat) drawBody(b); }
  for(i=0;i<parts.length;i++){ var q=parts[i]; ctx.save(); ctx.globalAlpha=Math.max(0,1-q.t/q.life); ctx.translate(sx(q.x),sy(q.y)); ctx.rotate(q.r); ctx.fillStyle=q.c; var s=q.s*ppu; ctx.fillRect(-s/2,-s/2,s,s); ctx.restore(); }
  for(i=0;i<pops.length;i++){ var o=pops[i]; ctx.save(); ctx.globalAlpha=Math.max(0,1-o.t/1.1); ctx.fillStyle=P.ink; ctx.font="600 "+Math.max(12,Math.round(ppu*.45))+"px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.fillText(o.s,sx(o.x),sy(o.y)-o.t*ppu*1.2); ctx.restore(); }
  ctx.restore();
}

/* ---------- boot ---------- */
var start=0; for(var si=0;si<3;si++){ if(unlocked(si)&&save.best[si]===0){ start=si; break; } }
if(document.fonts&&document.fonts.load) document.fonts.load("600 40px Fraunces").then(function(){ if(vis&&W) draw(); },function(){});
loadLevel(start,false);
say("Angry 13. Three levels. Level "+(start+1)+" is up: "+g.lv.shots+" shots, "+pl(g.targets,"template")+". Press Space to fire the "+g.next()+".");
})();
