/* K13 Workbench World, stage 2: the region (overworld) and the shop interiors.
   K13World.region = { get(), shopDef(rec), ... }, K13World.renderOverview(canvas, opts).
   Reads K13World.data (js/world/world-data.js) and K13World.project; art comes from K13World.town (js/world/town.js) when
   it is loaded, with a small built-in painter as the fallback. If world-data.js is missing, a clearly marked FALLBACK
   (approximate coordinates) stands in so the world always loads. Plain ES5, no libraries, no console output.
   Tile = 16 px. Never purple. */
(function(){
"use strict";
var NS=window.K13World=window.K13World||{};
var T=16, CH=16, PITCH=12;
var K={OCEAN:0,SURF:1,SAND:2,GRASS:3,HILL:4,ROAD:5,WALK:6,FWY:7,PAVE:8,PARK:9,PIER:10,MTN:11,BLDG:12};
var DNAME=["Los Angeles","Orange County","San Diego"];

/* ---------- helpers ---------- */
function hash(x,y,s){ var n=(x*374761393+y*668265263+s*2147483647)|0; n=(n^(n>>>13))*1274126177|0; n=n^(n>>>16); return (n>>>0)/4294967296; }
function mk(w,h){ var c=document.createElement("canvas"); c.width=Math.max(1,w); c.height=Math.max(1,h); return c; }
function fr(c,col,x,y,w,h){ c.fillStyle=col; c.fillRect(x,y,w,h); }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function vnoise(x,y,s){ var x0=Math.floor(x), y0=Math.floor(y), fx=x-x0, fy=y-y0, a=hash(x0,y0,s), b=hash(x0+1,y0,s), c=hash(x0,y0+1,s), d=hash(x0+1,y0+1,s);
  fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy); return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy; }
function pt(p){ var a, b; if(!p) return null; if(p.length>=2&&typeof p[0]==="number"){ a=p[0]; b=p[1]; } else if(typeof p.lat==="number"){ a=p.lat; b=(typeof p.lng==="number")?p.lng:p.lon; } else return null;
  if(typeof b!=="number") return null; if(Math.abs(a)>90){ var t=a; a=b; b=t; } return [a,b]; }
function pts(arr){ var o=[]; (arr||[]).forEach(function(p){ var q=pt(p); if(q) o.push(q); }); return o; }
function town(){ return NS.town&&typeof NS.town.tile==="function"?NS.town:null; }

/* ---------- FALLBACK data (only used when world-data.js did not load) ---------- */
var FB={
  bbox:[32.5,-118.55,34.15,-116.95],
  hq:[32.714,-117.159],
  coast:[[34.03,-118.55],[34.008,-118.497],[33.96,-118.45],[33.86,-118.40],[33.77,-118.42],[33.72,-118.30],[33.75,-118.19],[33.74,-118.10],[33.655,-118.0],[33.60,-117.90],[33.54,-117.785],[33.46,-117.70],[33.37,-117.57],[33.195,-117.385],[33.04,-117.30],[32.85,-117.275],[32.75,-117.255],[32.67,-117.245],[32.58,-117.13],[32.5,-117.12]],
  fwy:[[34.05,-118.24],[33.83,-117.92],[33.68,-117.76],[33.42,-117.61],[33.19,-117.36],[33.03,-117.29],[32.87,-117.22],[32.72,-117.16],[32.58,-117.08]],
  road:[[34.01,-118.49],[33.85,-118.395],[33.74,-118.30],[33.74,-118.10],[33.54,-117.79],[33.43,-117.62],[33.19,-117.38],[32.96,-117.265],[32.73,-117.22]],
  cities:[["downtown-la","Downtown Los Angeles",34.052,-118.243,3],["santa-monica","Santa Monica",34.02,-118.47,2],["irvine","Irvine",33.685,-117.826,2],["laguna-beach","Laguna Beach",33.542,-117.785,1],["oceanside","Oceanside",33.196,-117.379,2],["la-jolla","La Jolla",32.847,-117.274,1],["downtown-sd","Downtown San Diego",32.7157,-117.1611,3]],
  places:[["thg","Tiger Hospitality","https://tigerhospitalitygroup.com","office",32.7228,-117.1688],["lavida","La Vida San Diego","https://lavida.fit","kitchen",32.7497,-117.2],["miramar","Miramar Food Hall","https://miramarfoodhall.com","foodhall",33.435,-117.62],
    ["station8","Station8","https://station8publicmarket.com","market",32.8801,-117.234],["globalfork","Global Fork","https://globalforkfh.com","foodhall",32.7236,-117.1693],["egg","Egg&Out","https://egg.k13projects.com","kitchen",33.43,-117.62],
    ["lobsterlab","Lobster Lab","https://lobsterlab.us","kitchen",33.1936,-117.38],["cosmos","Cosmos Burger","https://cosmos.k13projects.com","kitchen",33.62,-117.93],["carlos","Carlos Almaraz","https://carlos.k13projects.com","gallery",34.0522,-118.2437],
    ["cengo","CENGO","https://cengo.party","club",0,0,1],["tmb","TrustMeBro","https://tmb.k13projects.com","office",0,0,1],["baa","baa atelier","https://www.atelierbaa.com/","studio",0,0,1],["barfix","BarFix","https://bfx.k13projects.com","office",0,0,1]],
  news:["K13 Daily is printing. Come back after the next ship."]
};
var PEEK={thg:"thg-hero",egg:"eggout-live",tmb:"trustmebro-live",baa:"baa-stop"};
function peekOf(key){ return PEEK[key]||(key+"-live"); }
var DIX={"los-angeles":0,"orange-county":1,"san-diego":2};

/* ---------- reading the real data ---------- */
function readSrc(){
  var D=NS.data, src={fallback:true,W:0,H:0,proj:null,bbox:FB.bbox,hq:FB.hq,hqTile:null,coast:FB.coast,waters:[],fwy:[FB.fwy],road:[FB.road],districts:null,pierPt:[32.7335,-117.206],news:FB.news,activity:{},places:[],
    cities:FB.cities.map(function(c){ return {id:c[0],name:c[1],lat:c[2],lng:c[3],size:c[4]}; })};
  src.proj=(typeof NS.project==="function"&&NS.project)||null;
  if(D&&typeof D==="object"&&D.places&&D.places.length){
    var g=D.geo||{}; src.fallback=false;
    if(g.proj&&g.proj.w&&g.proj.h){ src.W=g.proj.w; src.H=g.proj.h; }
    if(g.bbox){ var b=g.bbox; if(typeof b.south==="number") src.bbox=[b.south,b.west,b.north,b.east]; else if(b.length===4) src.bbox=b; }
    var co=pts(g.coast); if(co.length>3) src.coast=co;
    src.waters=(g.waters||[]).map(function(w){ return {id:w.id,poly:pts(w.poly)}; }).filter(function(w){ return w.poly.length>2; });
    var lines=function(a){ var out=[]; (a||[]).forEach(function(w){ var l=pts(w.line||w.points||w); if(l.length>1) out.push(l); }); return out; };
    var f=lines(g.freeways), r=lines(g.roads); if(f.length) src.fwy=f; if(r.length) src.road=r;
    if(g.districts&&g.districts.length){ src.districts=[]; g.districts.forEach(function(d,di){ var p=pts(d.poly); if(p.length>2) src.districts.push({ix:(DIX[d.id]!=null?DIX[d.id]:di),poly:p}); }); }
    if(g.cities&&g.cities.length) src.cities=g.cities.map(function(c){ return {id:c.id,name:c.label||c.name,lat:c.lat,lng:c.lng,size:c.size||1}; });
    var hq=pt(g.hq&&[g.hq.lat,g.hq.lng]); if(hq) src.hq=hq;
    var pp=pt(g.pier&&[g.pier.lat,g.pier.lng]); if(pp) src.pierPt=pp;
    src.activity=D.activity||{}; if(D.news&&D.news.length) src.news=D.news;
    D.places.forEach(function(p){
      if(p.id==="hq"||p.category==="hq"){ src.hqTile=[p.tx,p.ty]; return; }
      src.places.push({id:p.id,key:p.project||p.id,name:p.name,url:p.url||"",category:p.category||"",status:p.status||"open",desc:p.line||"",city:p.label||"",lat:p.lat,lng:p.lng,tx:p.tx,ty:p.ty,pier:!!p.pier,district:p.district,peek:peekOf(p.project||p.id)});
    });
  }else{
    FB.places.forEach(function(p){ src.places.push({id:p[0],key:p[0],name:p[1],url:p[2],category:p[3],status:"open",desc:"",city:"",lat:p[4],lng:p[5],tx:null,ty:null,pier:!!p[6],peek:peekOf(p[0])}); });
  }
  return src;
}
function isNew(src,key){
  if(!src.newSet){ var act=src.activity||{}, list=[], k; src.newSet={};
    for(k in act){ var a=act[k]; if(!a||!a.lastShip) continue; var t=Date.parse(a.lastShip+"T12:00:00Z"); if(!isFinite(t)) continue; var d=Date.now()-t; if(d<5*864e5&&d>-2*864e5) list.push({k:k,t:t,n:a.shipsLast30||0}); }
    list.sort(function(p,q){ return (q.n-p.n)||(q.t-p.t); }); list.slice(0,3).forEach(function(e){ src.newSet[e.k]=1; }); }
  return !!src.newSet[key];
}
var SKEY={thg:"TigerHospitality_Website_01",lavida:"LaVida",miramar:"Miramar",cengo:"CENGO",station8:"STATION8",globalfork:"GlobalFork",egg:"EggOut",tmb:"TrustMeBro",baa:"baa_atelier",barfix:"BarFix",lobsterlab:"LobsterLab",cosmos:"Cosmos",carlos:"CarlosAlmaraz"};
function shopKeyFor(p){ var t=town(); if(!t||typeof t.shopKey!=="function") return null; return SKEY[p.key]||t.shopKey(p.name)||t.shopKey(p.key)||null; }
function sizeFor(key,kind){
  var t=town(); if(t&&key&&typeof t.storefrontInfo==="function"){ try{ var i=t.storefrontInfo(key); return {w:i.w,h:i.h,dx:i.door.dx,dy:i.door.dy}; }catch(e){} }
  return kind==="hq"?{w:8,h:6,dx:3,dy:5}:{w:5,h:5,dx:2,dy:4};
}

/* ---------- the build ---------- */
var cache=null;
function build(){
  var src=readSrc(), i, x, y, k;
  var cosL=Math.cos(33.4*Math.PI/180), KY=170.6923, KX=KY*cosL, b=src.bbox;
  var proj=src.proj?function(a,o){ var p=src.proj(a,o); return [p.x,p.y]; }:function(a,o){ return [(o-b[1])*KX,(b[2]-a)*KY]; };
  var W=src.W||clamp(Math.ceil((b[3]-b[1])*KX),120,420), H=src.H||clamp(Math.ceil((b[2]-b[0])*KY),160,460);
  var N=W*H, ter=new Uint8Array(N), solid=new Uint8Array(N), fl=new Uint8Array(N), dec=new Uint8Array(N), used=new Uint8Array(N);
  function I(x,y){ return y*W+x; }
  function inb(x,y){ return x>=0&&y>=0&&x<W&&y<H; }
  function toT(p){ return proj(p[0],p[1]); }
  function fillPoly(poly,val,flag){
    var yy, q, a, c, xs, xx, p;
    for(yy=0;yy<H;yy++){ var yc=yy+0.5; xs=[];
      for(q=0;q<poly.length;q++){ a=poly[q]; c=poly[(q+1)%poly.length]; if((a[1]<=yc&&c[1]>yc)||(c[1]<=yc&&a[1]>yc)) xs.push(a[0]+(yc-a[1])/(c[1]-a[1])*(c[0]-a[0])); }
      xs.sort(function(m,n2){ return m-n2; });
      for(q=0;q+1<xs.length;q+=2) for(xx=Math.max(0,Math.ceil(xs[q]-0.5));xx<W&&xx+0.5<xs[q+1];xx++){ p=I(xx,yy); ter[p]=val; if(flag) fl[p]|=flag; }
    }
  }

  /* -- ocean west of the coast, bays -- */
  var co=src.coast.map(toT); if(co[0][1]>co[co.length-1][1]) co.reverse();
  var poly=co.slice(); if(co[0][1]>2) poly.unshift([co[0][0],-4]); if(co[co.length-1][1]<H-3) poly.push([co[co.length-1][0],H+4]);
  poly.push([-8,poly[poly.length-1][1]]); poly.push([-8,poly[0][1]]);
  for(i=0;i<N;i++) ter[i]=K.GRASS;
  fillPoly(poly,K.OCEAN,0);
  src.waters.forEach(function(w){ fillPoly(w.poly.map(toT),K.OCEAN,32); });
  for(i=0;i<N;i++) if(ter[i]===K.OCEAN) solid[i]=1;
  function chamfer(isSrc){
    var d=new Uint8Array(N), q, big=250, v;
    for(q=0;q<N;q++) d[q]=isSrc(q)?0:big;
    for(y=0;y<H;y++) for(x=0;x<W;x++){ q=I(x,y); v=d[q]; if(x>0&&d[q-1]+1<v) v=d[q-1]+1; if(y>0&&d[q-W]+1<v) v=d[q-W]+1; d[q]=v; }
    for(y=H-1;y>=0;y--) for(x=W-1;x>=0;x--){ q=I(x,y); v=d[q]; if(x<W-1&&d[q+1]+1<v) v=d[q+1]+1; if(y<H-1&&d[q+W]+1<v) v=d[q+W]+1; d[q]=v; }
    return d;
  }
  var dOc=chamfer(function(q){ return ter[q]===K.OCEAN; });
  var dLand=chamfer(function(q){ return ter[q]!==K.OCEAN; });
  for(i=0;i<N;i++){
    x=i%W; y=(i/W)|0;
    if(ter[i]===K.OCEAN){ if(dLand[i]<=2) ter[i]=K.SURF; }
    else if(dOc[i]<=3+(hash(x,y>>1,3)<0.45?1:0)) ter[i]=K.SAND;
  }
  for(y=0;y<H;y++) for(x=0;x<W;x++){ i=I(x,y); if(ter[i]===K.OCEAN||ter[i]===K.SURF) continue;
    var e=Math.min(x,y,W-1-x,H-1-y);
    if(e<3||(x>W-12&&vnoise(x/5,y/5,11)>0.78+(W-1-x)*0.01)||(y<8&&vnoise(x/4,y/4,12)>0.72)||(y>H-9&&vnoise(x/4,y/4,13)>0.72)){ ter[i]=K.MTN; solid[i]=1; } }

  /* -- districts -- */
  var yLO=toT([33.745,-118.0])[1], yOS=toT([33.39,-117.58])[1], dpoly=src.districts;
  function inPoly(p,x,y){ var ins=false, a, c; for(var q=0,r=p.length-1;q<p.length;r=q++){ a=p[q]; c=p[r]; if(((a[1]>y)!==(c[1]>y))&&(x<(c[0]-a[0])*(y-a[1])/(c[1]-a[1])+a[0])) ins=!ins; } return ins; }
  if(dpoly) dpoly=dpoly.map(function(d){ return {ix:d.ix,p:d.poly.map(toT)}; });
  function districtAt(tx,ty){ if(dpoly){ for(var q=0;q<dpoly.length;q++) if(inPoly(dpoly[q].p,tx+0.5,ty+0.5)) return dpoly[q].ix; } return ty<yLO?0:(ty<yOS?1:2); }

  /* -- the road graph, vector part: I-5, the coast road and ramps. Orthogonal runs joined by 45 degree runs. -- */
  var vm=new Uint8Array(N), lotm=new Uint8Array(N), rb=new Uint8Array(N), vsegs=[], vlines=[];
  var CLS={fwy:{id:1,hw:24,R:31},pch:{id:2,hw:11,R:19},ramp:{id:4,hw:7,R:10}};
  function dp(p,tol){
    if(p.length<3) return p.slice(); var a=p[0], b=p[p.length-1], dx=b[0]-a[0], dy=b[1]-a[1], L=Math.sqrt(dx*dx+dy*dy)||1, md=0, mi=0, q;
    for(q=1;q<p.length-1;q++){ var d=Math.abs((p[q][0]-a[0])*dy-(p[q][1]-a[1])*dx)/L; if(d>md){ md=d; mi=q; } }
    if(md<=tol) return [a,b]; var l=dp(p.slice(0,mi+1),tol), r=dp(p.slice(mi),tol); return l.slice(0,-1).concat(r);
  }
  function ortho(P){
    var out=[[P[0][0],P[0][1]]], cx=P[0][0], cy=P[0][1], q, tx, ty, dx, dy, ax, ay, sx, sy, d, st;
    for(q=1;q<P.length;q++){
      tx=P[q][0]; ty=P[q][1]; dx=tx-cx; dy=ty-cy; ax=Math.abs(dx); ay=Math.abs(dy); sx=dx<0?-1:1; sy=dy<0?-1:1; d=Math.min(ax,ay);
      if(d<3){ if(ax>=ay) ty=cy; else tx=cx; out.push([tx,ty]); cx=tx; cy=ty; continue; }
      st=Math.abs(ax-ay)/2;
      if(ax>=ay){ out.push([cx+sx*st,cy]); out.push([cx+sx*(st+d),cy+sy*d]); out.push([tx,ty]); }
      else{ out.push([cx,cy+sy*st]); out.push([cx+sx*d,cy+sy*(st+d)]); out.push([tx,ty]); }
      cx=tx; cy=ty;
    }
    var o2=[out[0]]; for(q=1;q<out.length;q++){ var pr=o2[o2.length-1], ddx=out[q][0]-pr[0], ddy=out[q][1]-pr[1]; if(ddx*ddx+ddy*ddy>=2.25||q===out.length-1) o2.push(out[q]); }
    return o2;
  }
  function addRoad(verts,cls){
    var c=CLS[cls], cum=0, q, k2; vlines.push({cls:cls,p:verts});
    for(q=0;q+1<verts.length;q++){
      var x0=verts[q][0]*T, y0=verts[q][1]*T, x1=verts[q+1][0]*T, y1=verts[q+1][1]*T, dx=x1-x0, dy=y1-y0, len=Math.sqrt(dx*dx+dy*dy); if(len<0.5) continue;
      vsegs.push({x0:x0,y0:y0,dx:dx,dy:dy,len:len,l2:len*len,s0:cum,cls:c.id,hw:c.hw,R:c.R}); cum+=len;
      var n=Math.ceil(len/5);
      for(k2=0;k2<=n;k2++){ var px=x0+dx*k2/n, py=y0+dy*k2/n, tx0=Math.floor((px-c.R)/T), tx1=Math.floor((px+c.R)/T), ty0=Math.floor((py-c.R)/T), ty1=Math.floor((py+c.R)/T), tx, ty;
        for(ty=ty0;ty<=ty1;ty++) for(tx=tx0;tx<=tx1;tx++){ if(!inb(tx,ty)) continue; var rx=Math.max(tx*T-px,0,px-(tx*T+T)), ry=Math.max(ty*T-py,0,py-(ty*T+T)); if(rx*rx+ry*ry>c.R*c.R) continue;
          var kk=I(tx,ty); if(ter[kk]===K.OCEAN||ter[kk]===K.SURF||ter[kk]===K.MTN) continue; vm[kk]|=c.id; } }
    }
  }
  var fwyT=[];
  src.road.forEach(function(r){ addRoad(ortho(dp(r.map(toT).map(function(p){ return [p[0]+4,p[1]]; }),2.5)),"pch"); });
  src.fwy.forEach(function(r){ var v=ortho(dp(r.map(toT),3)); fwyT.push(v); addRoad(v,"fwy"); });

  /* -- city grids: one global lattice of 12 tile cells (road 2, sidewalk 1, lot 8), whole blocks only -- */
  var P=PITCH, cellInc={}, cellList=[];
  var RADIUS={1:26,2:38,3:56};
  var cities=src.cities.map(function(c){ var p=toT([c.lat,c.lng]), cx=Math.round(p[0]), cy=clamp(Math.round(p[1]),2,H-3), g=0;
    while(g<40&&cx<W-4&&dOc[I(clamp(cx,0,W-1),cy)]<9){ cx++; g++; }
    return {id:c.id,name:c.name,x:cx,y:cy,r:RADIUS[c.size]||17,sz:c.size||1}; });
  src.places.forEach(function(p){ if(p.pier) return; var q=(p.tx!=null)?[p.tx,p.ty]:toT([p.lat,p.lng]), near=false; cities.forEach(function(c){ var dx=c.x-q[0], dy=c.y-q[1]; if(dx*dx+dy*dy<(c.r+4)*(c.r+4)) near=true; });
    if(!near) cities.push({id:"x-"+p.id,name:p.city||p.name,x:Math.round(q[0]),y:Math.round(q[1]),r:16,sz:1}); });
  function cellLand(ci,cj){ var a, b; if(ci*P<2||cj*P<2||ci*P+P>W-2||cj*P+P>H-2) return false; for(b=0;b<P;b++) for(a=0;a<P;a++) if(ter[I(ci*P+a,cj*P+b)]!==K.GRASS) return false; return true; }
  cities.forEach(function(c){
    var R2=c.r, ci0=Math.floor((c.x-R2)/P), ci1=Math.floor((c.x+R2)/P), cj0=Math.floor((c.y-R2)/P), cj1=Math.floor((c.y+R2)/P), ci, cj;
    for(cj=cj0;cj<=cj1;cj++) for(ci=ci0;ci<=ci1;ci++){
      var dx=((ci+0.5)*P-c.x)/R2, dy=((cj+0.5)*P-c.y)/(R2*0.85); if(dx*dx+dy*dy>1) continue;
      var key=ci+","+cj, ex=cellInc[key]; if(ex){ if(c.sz>ex.sz){ ex.sz=c.sz; ex.city=c; } continue; }
      if(!cellLand(ci,cj)) continue; var cl={ci:ci,cj:cj,sz:c.sz,city:c}; cellInc[key]=cl; cellList.push(cl);
    }
  });
  function inc(ci,cj){ return !!cellInc[ci+","+cj]; }
  (function(){
    var minx=1e9, maxx=-1, miny=1e9, maxy=-1; cellList.forEach(function(c){ minx=Math.min(minx,c.ci); maxx=Math.max(maxx,c.ci); miny=Math.min(miny,c.cj); maxy=Math.max(maxy,c.cj); });
    var tx, ty;
    for(ty=Math.max(0,miny*P);ty<Math.min(H,(maxy+2)*P);ty++) for(tx=Math.max(0,minx*P);tx<Math.min(W,(maxx+2)*P);tx++){
      var ci=Math.floor(tx/P), cj=Math.floor(ty/P), m=tx-ci*P, n=ty-cj*P, k=I(tx,ty), on=inc(ci,cj);
      if(m<2&&n<2){ if(on||inc(ci-1,cj)||inc(ci,cj-1)||inc(ci-1,cj-1)){ if(ter[k]===K.GRASS){ ter[k]=K.ROAD; rb[k]=3; } } }
      else if(m<2){ if(on||inc(ci-1,cj)){ if(ter[k]===K.GRASS){ ter[k]=K.ROAD; rb[k]=1; } } }
      else if(n<2){ if(on||inc(ci,cj-1)){ if(ter[k]===K.GRASS){ ter[k]=K.ROAD; rb[k]=2; } } }
      else if(on){ if(m===2||m===P-1||n===2||n===P-1) ter[k]=K.WALK; else ter[k]=K.PAVE; lotm[k]=1; }
    }
  })();
  /* ramps: a short road from the freeway into the nearest street crossing of each real city */
  cities.forEach(function(c){
    if(c.sz<2||!fwyT.length) return; var best=1e9, F=null, q, s2;
    fwyT.forEach(function(v){ for(q=0;q+1<v.length;q++){ for(s2=0;s2<=12;s2++){ var fx=v[q][0]+(v[q+1][0]-v[q][0])*s2/12, fy=v[q][1]+(v[q+1][1]-v[q][1])*s2/12, dx=fx-c.x, dy=fy-c.y, d=dx*dx+dy*dy; if(d<best){ best=d; F=[fx,fy]; } } } });
    if(!F||best>40*40) return;
    var bj=1e9, J=null, tx, ty, r2=c.r+P;
    for(ty=Math.max(1,c.y-r2);ty<Math.min(H-1,c.y+r2);ty++) for(tx=Math.max(1,c.x-r2);tx<Math.min(W-1,c.x+r2);tx++){
      var k=I(tx,ty); if(rb[k]!==3||(tx%P)!==0||(ty%P)!==0||vm[k]) continue; var dx2=tx-F[0], dy2=ty-F[1], d2=dx2*dx2+dy2*dy2; if(d2<bj){ bj=d2; J=[tx,ty]; } }
    if(!J||bj>44*44) return;
    addRoad(ortho([F,[J[0]+1,J[1]+1]]),"ramp");
  });

  /* -- lots: one 8x8 per block; ok when no road overlay touches it -- */
  var lots=[];
  cellList.forEach(function(cl){
    var l={x:cl.ci*P+3,y:cl.cj*P+3,sz:cl.sz,used:0,ok:true,kind:"",trees:[],bodies:[],seed:0}, a, b;
    for(b=-1;b<=8&&l.ok;b++) for(a=-1;a<=8;a++) if(vm[I(l.x+a,l.y+b)]){ l.ok=false; break; }
    lots.push(l);
  });
  function markUsed(x0,y0,w,h,m){ for(var yy=y0-m;yy<y0+h+m;yy++) for(var xx=x0-m;xx<x0+w+m;xx++) if(inb(xx,yy)) used[I(xx,yy)]=1; }
  function nearestLot(ax,ay,maxD){
    var best=null, bd=maxD*maxD+1; lots.forEach(function(l){ if(l.used||!l.ok) return; var dx=l.x+4-ax, dy=l.y+4-ay, d=dx*dx+dy*dy; if(d<bd){ bd=d; best=l; } }); return best;
  }
  function carve(x0,y0,w,h){
    for(var yy=y0;yy<y0+h;yy++) for(var xx=x0;xx<x0+w;xx++){ if(!inb(xx,yy)) continue; k=I(xx,yy); if(ter[k]===K.OCEAN||ter[k]===K.SURF||ter[k]===K.MTN) continue; ter[k]=K.PAVE; solid[k]=0; }
    for(var xx2=x0-1;xx2<x0+w+1;xx2++){ if(inb(xx2,y0+h)){ k=I(xx2,y0+h); if(ter[k]!==K.OCEAN&&ter[k]!==K.SURF&&ter[k]!==K.PIER) ter[k]=K.WALK; } }
  }
  function spotOk(tx,ty,w,h,strict){
    var a3, b3; for(a3=0;a3<w;a3++) for(b3=0;b3<h+2;b3++){ if(!inb(tx+a3,ty+b3)) return false; var q=I(tx+a3,ty+b3), tq=ter[q];
      if(used[q]||lotm[q]||vm[q]||tq===K.OCEAN||tq===K.SURF||tq===K.MTN||tq===K.ROAD||tq===K.SAND||tq===K.PIER) return false; if(strict&&tq!==K.GRASS&&tq!==K.HILL) return false; }
    return true;
  }
  function findSpot(ax,ay,w,h){
    var bx=Math.round(ax)-(w>>1), by=Math.round(ay)-(h>>1), rr, ox, oy;
    for(rr=0;rr<50;rr++) for(oy=-rr;oy<=rr;oy++) for(ox=-rr;ox<=rr;ox++){ if(Math.max(Math.abs(ox),Math.abs(oy))!==rr) continue; if(spotOk(bx+ox,by+oy,w,h,false)) return [bx+ox,by+oy]; }
    return [bx,by];
  }
  function openSpot(ax,ay,w,h){
    var rr, ox, oy;
    for(rr=0;rr<30;rr++) for(oy=-rr;oy<=rr;oy++) for(ox=-rr;ox<=rr;ox++){ if(Math.max(Math.abs(ox),Math.abs(oy))!==rr) continue; if(spotOk(Math.round(ax)+ox,Math.round(ay)+oy,w,h,true)) return [Math.round(ax)+ox,Math.round(ay)+oy]; }
    return null;
  }

  var objects=[], placesOut=[], stops=[], posById={};
  function addObj(o){ o.room=""; o.solid=o.solid!==false; o.paint=true; objects.push(o); return o; }

  /* -- HQ -- */
  var hqKey=(town()&&town().shopKey("hq"))||"K13HQ", hqSz=sizeFor(hqKey,"hq"), hqp=src.hqTile||toT(src.hq), hqLot=nearestLot(hqp[0],hqp[1],60), hq;
  if(hqLot){ hqLot.used=1; hq={x:hqLot.x+((8-hqSz.w)>>1),y:hqLot.y+8-hqSz.h,w:hqSz.w,h:hqSz.h}; }
  else{ var sp0=findSpot(hqp[0],hqp[1],hqSz.w,hqSz.h); hq={x:sp0[0],y:sp0[1],w:hqSz.w,h:hqSz.h}; carve(hq.x,hq.y,hq.w,hq.h); }
  markUsed(hq.x,hq.y,hq.w,hq.h,1);
  hq.dx=hqSz.dx; hq.dy=hqSz.dy; hq.door={x:hq.x+hqSz.dx,y:hq.y+hq.h}; hq.doorTile={x:hq.x+hqSz.dx,y:hq.y+hqSz.dy}; hq.key=hqKey;
  addObj({id:"hq-door",kind:"hq",x:hq.x,y:hq.y,w:hq.w,h:hq.h,act:"door",label:"Enter K13 HQ",look:"K13 HQ, San Diego.",title:"K13 HQ",skey:hqKey,door:{dx:hqSz.dx,dy:hqSz.dy}});
  posById.hq={x:hq.door.x,y:hq.door.y};

  /* -- Worldwide pier: planks on the water, one building per berth -- */
  var ww=src.places.filter(function(p){ return p.pier; }), pier=null;
  if(ww.length){
    var pp=toT(src.pierPt), rows=Math.ceil(ww.length/3), qh=4+rows*7, qw=19;
    var qx0=clamp(Math.round(pp[0])-(qw>>1),1,W-qw-2), qy0=clamp(Math.round(pp[1])-3,3,H-qh-3), bestC=1e9, ax, ay, cx2, cy2;
    for(ay=-14;ay<=14;ay+=2) for(ax=-34;ax<=8;ax+=2){
      var tx0=clamp(Math.round(pp[0])-(qw>>1)+ax,1,W-qw-2), ty0=clamp(Math.round(pp[1])-3+ay,3,H-qh-3), cost=0;
      for(cy2=ty0;cy2<ty0+qh;cy2++) for(cx2=tx0;cx2<tx0+qw;cx2++){ var t3=ter[I(cx2,cy2)]; if(t3===K.OCEAN||t3===K.SURF) continue; cost+=(t3===K.SAND?1:(t3===K.MTN?6:4))+(used[I(cx2,cy2)]?8:0); }
      cost+=Math.abs(ax)*0.15+Math.abs(ay)*0.15;
      if(cost<bestC){ bestC=cost; qx0=tx0; qy0=ty0; } }
    for(y=qy0;y<qy0+qh;y++) for(x=qx0;x<qx0+qw;x++){ k=I(x,y); if(ter[k]===K.MTN) continue; ter[k]=K.PIER; solid[k]=0; fl[k]&=~32; }
    for(y=qy0;y<qy0+qh;y++) for(x=qx0-1;x<=qx0+qw;x++){ if(!inb(x,y)) continue; k=I(x,y); if((x===qx0-1||x===qx0+qw)&&ter[k]===K.SURF){ ter[k]=K.SAND; solid[k]=0; } }
    pier={x:qx0,y:qy0,w:qw,h:qh}; markUsed(qx0,qy0,qw,qh,0);
    /* a causeway from the planks to the nearest shore, so the pier is never an island */
    var cy3=qy0+qh-4, cxx, stopped=false;
    for(cxx=qx0+qw;cxx<W-2&&!stopped;cxx++){ var wet=false, r3; for(r3=0;r3<3;r3++){ var kk=I(cxx,cy3+r3), t4=ter[kk]; if(t4===K.OCEAN||t4===K.SURF){ wet=true; ter[kk]=K.PIER; solid[kk]=0; fl[kk]&=~32; } else if(t4===K.SAND){ ter[kk]=K.PIER; } }
      if(!wet&&cxx>qx0+qw+1) stopped=true; }
    addObj({id:"worldpier",kind:"worldpier",x:qx0+((qw-10)>>1),y:qy0,w:10,h:4,layer:"floor",solid:false,act:"look",label:"Read the signpost",look:"The Worldwide pier. Flags of the places K13 works for, and how far each one is from San Diego.",title:"Worldwide pier"});
    posById.pier={x:qx0+(qw>>1),y:qy0+3};
    ww.forEach(function(p,wi){ placePlace(p,qx0+1+(wi%3)*6,qy0+4+((wi/3)|0)*7,true); });
  }
  function placePlace(p,bx,by,quay){
    var skey=shopKeyFor(p), sz=sizeFor(skey,"shop"), w=sz.w, h=sz.h;
    if(!quay){
      var q=(p.tx!=null)?[p.tx,p.ty]:toT([p.lat,p.lng]), lot=nearestLot(q[0],q[1],46);
      if(lot){ lot.used=1; bx=lot.x+((8-w)>>1); by=lot.y+8-h; }
      else{ var sp=findSpot(q[0],q[1],w,h); bx=sp[0]; by=sp[1]; carve(bx,by,w,h); }
      markUsed(bx,by,w,h,1);
    }
    var o=addObj({id:"shop:"+p.id,kind:"shop",x:bx,y:by,w:w,h:h,act:"door",label:"Enter "+p.name,look:p.name,skey:skey,door:{dx:sz.dx,dy:sz.dy}});
    var nw=isNew(src,p.key);
    var rec={id:p.id,key:p.key,name:p.name,url:p.url,category:p.category,city:p.city,desc:p.desc,peek:p.peek,worldwide:!!p.pier,x:bx,y:by,w:w,h:h,dx:sz.dx,dy:sz.dy,door:{x:bx+sz.dx,y:by+h},doorTile:{x:bx+sz.dx,y:by+sz.dy},obj:o,skey:skey,
      state:(p.status==="coming-soon"||p.status==="construction")?"construction":(nw?"new":"live"),isNew:nw,status:p.status,district:p.district};
    if(quay!==true){ lots.forEach(function(l){ if(bx>=l.x-1&&bx<l.x+9&&by>=l.y-1&&by<l.y+9&&l.used) l.shop={x:bx,y:by,w:w,h:h}; }); }
    o.rec=rec; o.title=p.name; placesOut.push(rec); posById[p.id]=rec.door; posById[String(p.id).toLowerCase()]=rec.door;
  }
  src.places.forEach(function(p){ if(!p.pier) placePlace(p,0,0,false); });

  /* -- van stops, one lot each -- */
  var STOPS=[["van-hq","K13 HQ, San Diego",null,2],["van-sd","La Jolla","la-jolla",2],["van-sd2","Oceanside","oceanside",2],["van-oc","Irvine","irvine",1],["van-oc2","Laguna Beach","laguna-beach",1],["van-la","Downtown Los Angeles","downtown-la",0],["van-la2","Santa Monica","santa-monica",0]];
  function cityById(id){ var r=null; cities.forEach(function(c){ if(!r&&c.id===id) r=c; }); return r; }
  STOPS.forEach(function(s){
    var anchor=s[2]?cityById(s[2]):{x:hq.x+hq.w+8,y:hq.y+2}; if(!anchor) return;
    var lot=nearestLot(anchor.x,anchor.y,60), sx, sy;
    if(lot){ lot.used=1; sx=lot.x+2; sy=lot.y+6; } else { var sp2=findSpot(anchor.x,anchor.y,4,2); sx=sp2[0]; sy=sp2[1]; carve(sx,sy,4,2); }
    markUsed(sx,sy,4,2,0);
    var so=addObj({id:s[0],kind:"stop",x:sx,y:sy,w:4,h:2,act:"van",label:"Ride the K13 van",look:"A K13 van stop.",title:"K13 van stop: "+s[1],stopName:s[1]});
    stops.push({id:s[0],name:s[1],x:sx+1,y:sy+2,district:s[3],obj:so}); posById[s[0]]={x:sx+1,y:sy+2};
  });

  /* -- welcome signs where the freeway crosses a district line, landmarks where they stand -- */
  var cross=[]; (function(){ var ln=fwyT[0], prev=-1, q, s2, n2, a, c, px, py; if(!ln) return;
    for(q=0;q+1<ln.length;q++){ a=ln[q]; c=ln[q+1]; n2=Math.max(1,Math.ceil(Math.sqrt((c[0]-a[0])*(c[0]-a[0])+(c[1]-a[1])*(c[1]-a[1]))));
      for(s2=0;s2<n2;s2++){ px=a[0]+(c[0]-a[0])*s2/n2; py=a[1]+(c[1]-a[1])*s2/n2; var dd=districtAt(Math.floor(px),Math.floor(py)); if(dd!==prev){ cross.push({d:dd,x:px,y:py}); prev=dd; } } } })();
  cross.forEach(function(cr){
    var id=["sign-la","sign-oc","sign-sd"][cr.d], sz=[[6,2],[5,3],[5,3]][cr.d], spot=openSpot(cr.x+7,cr.y,sz[0],sz[1]); if(!spot) return;
    var nm=DNAME[cr.d];
    addObj({id:id,kind:"sign",x:spot[0],y:spot[1],w:sz[0],h:sz[1],fh:1,act:"look",label:"Read the sign",look:"Welcome to "+nm+".",title:nm+" sign",tid:id}); markUsed(spot[0],spot[1],sz[0],sz[1],1); posById[id]={x:spot[0]+(sz[0]>>1),y:spot[1]+sz[1]};
  });
  [["lighthouse",32.6655,-117.2425,3,6,"The Point Loma lighthouse. The beam turns all night."],["crane",33.7536,-118.2185,4,6,"A harbour crane at the Port of Long Beach."],["missionbell",33.4605,-117.6560,2,3,"A mission bell, San Clemente's old road marker."]].forEach(function(l){
    var p=toT([l[1],l[2]]), spot=openSpot(p[0],p[1],l[3],l[4]); if(!spot) return;
    addObj({id:"lm-"+l[0],kind:"landmark",x:spot[0],y:spot[1],w:l[3],h:l[4],fh:1,act:"look",label:"Look",look:l[5],title:l[0],tid:l[0]}); markUsed(spot[0],spot[1],l[3],l[4],1);
  });

  /* -- plan every lot: what stands on it (solid bodies, trees) -- */
  function planLot(l){
    var r=hash(l.x,l.y,21), sz=l.sz, kind, i, j, q;
    if(l.used) kind="plaza";
    else if(!l.ok) kind="lawn";
    else if(sz>=3) kind=r<0.42?"tower":(r<0.54?"apt":(r<0.68?"strip":(r<0.82?"parking":(r<0.92?"park":"plaza"))));
    else if(sz===2) kind=r<0.2?"houses":(r<0.4?"apt":(r<0.58?"strip":(r<0.68?"parking":(r<0.76?"park":(r<0.82?"school":(r<0.87?"church":(r<0.92?"gas":"lawn")))))));
    else kind=r<0.5?"houses":(r<0.6?"apt":(r<0.72?"strip":(r<0.78?"parking":(r<0.85?"park":(r<0.88?"school":(r<0.92?"church":(r<0.96?"gas":"lawn")))))));
    l.kind=kind; l.seed=(hash(l.x,l.y,24)*1000)|0; l.art=null;
    function B(x,y,w,h){ l.bodies.push([l.x+x,l.y+y,w,h]); }
    var tn=town(), art=[];
    function TA(id,x,y,solidBody){ var inf=null; try{ inf=tn.info(id); }catch(e){} if(!inf||!inf.w) return false; var ax=(x==="c")?((8-inf.w)>>1):x; art.push({id:id,x:ax,y:y,w:inf.w,h:inf.h}); if(solidBody) B(ax,y,inf.w,inf.h); return true; }
    var tnOk=!!(tn&&typeof tn.info==="function"&&tn.info("house-1")&&tn.info("house-1").w);
    function Tr(x,y,p){ if(hash(l.x+x,l.y+y,28)<p&&!vm[I(l.x+x,l.y+y)]) l.trees.push([l.x+x,l.y+y]); }
    var hn=(l.seed%6)+1;
    if(tnOk&&kind==="houses"){ for(j=0;j<2;j++) for(i=0;i<2;i++){ var hid="house-"+(((l.seed>>(i*2+j))+i*2+j)%6+1), hi=tn.info(hid); TA(hid,i*4+((4-hi.w)>>1),j*4+(4-hi.h),true); Tr(i*4+3,j*4+0,0.5); } }
    else if(tnOk&&kind==="apt"){ var aid="apt-"+(hn%3+1), ai=tn.info(aid); TA(aid,"c",(8-ai.h)>>1,true); Tr(0,0,0.7); Tr(7,7,0.7); Tr(0,7,0.7); Tr(7,0,0.7); }
    else if(tnOk&&kind==="strip"){ var sid="strip-"+(hn%3+1); TA(sid,"c",5,true); Tr(0,4,0.9); Tr(7,4,0.9); }
    else if(tnOk&&kind==="gas"){ TA("gasstation",1,2,true); }
    else if(tnOk&&kind==="school"){ TA("school",0,4,true); Tr(7,0,1); Tr(0,0,1); Tr(7,3,0.8); }
    else if(tnOk&&kind==="church"){ TA("church",2,3,true); Tr(0,2,1); Tr(7,2,1); Tr(0,6,0.8); Tr(7,6,0.8); }
    else if(tnOk&&kind==="park"){ TA("park-small",1,1,false); for(q=0;q<10;q++){ var tx9=(hash(l.x,l.y,40+q)*8)|0, ty9=(hash(l.x,l.y,60+q)*8)|0; if(tx9>=1&&tx9<=5&&ty9>=1&&ty9<=5) continue; Tr(tx9,ty9,1); } }
    else if(tnOk&&kind==="lawn"){ TA(hn%2?"lawn-2":"lawn-1",2,2,false); for(q=0;q<5;q++){ var tx8=(hash(l.x,l.y,80+q)*8)|0, ty8=(hash(l.x,l.y,90+q)*8)|0; if(tx8>=2&&tx8<=4&&ty8>=2&&ty8<=3) continue; Tr(tx8,ty8,0.8); } }
    else if(kind==="houses"){ for(j=0;j<2;j++) for(i=0;i<2;i++){ B(i*4,j*4+1,3,2); Tr(i*4+3,j*4+3,0.7); } }
    else if(kind==="apt"){ B(1,1,6,5); Tr(0,6,0.8); Tr(7,6,0.8); Tr(0,0,0.8); Tr(7,0,0.8); }
    else if(kind==="tower"){ B(1,1,6,5); Tr(0,6,0.8); Tr(7,6,0.8); }
    else if(kind==="strip"){ B(0,5,8,3); Tr(0,4,0.9); Tr(7,4,0.9); }
    else if(kind==="parking"){ Tr(0,0,1); Tr(7,0,1); Tr(0,7,0.8); Tr(7,7,0.8); }
    else if(kind==="park"){ for(q=0;q<14;q++){ var tx=(hash(l.x,l.y,40+q)*8)|0, ty=(hash(l.x,l.y,60+q)*8)|0; if((tx===3||tx===4)||(ty===3||ty===4)) continue; Tr(tx,ty,1); } }
    else if(kind==="lawn"){ for(q=0;q<6;q++){ var tx2=(hash(l.x,l.y,80+q)*8)|0, ty2=(hash(l.x,l.y,90+q)*8)|0; Tr(tx2,ty2,0.8); } }
    else if(kind==="school"){ B(0,4,7,3); Tr(7,0,1); Tr(0,0,1); Tr(7,3,0.8); }
    else if(kind==="church"){ B(2,3,4,4); Tr(0,2,1); Tr(7,2,1); Tr(0,6,0.8); Tr(7,6,0.8); }
    else if(kind==="gas"){ B(5,5,3,2); }
    else if(kind==="plaza"){ var sh=l.shop, qq; for(qq=0;qq<10;qq++){ var tx3=(hash(l.x,l.y,100+qq)*8)|0, ty3=(hash(l.x,l.y,120+qq)*8)|0; if(sh&&tx3+l.x>=sh.x-1&&tx3+l.x<=sh.x+sh.w&&ty3+l.y>=sh.y-1) continue; if(!sh&&ty3>3) continue; Tr(tx3,ty3,1); } }
    if(art.length) l.art=art;
    l.bodies.forEach(function(b){ var yy, xx; for(yy=b[1];yy<b[1]+b[3];yy++) for(xx=b[0];xx<b[0]+b[2];xx++){ if(!inb(xx,yy)) continue; ter[I(xx,yy)]=K.BLDG; solid[I(xx,yy)]=1; } });
    l.trees.forEach(function(t2){ solid[I(t2[0],t2[1])]=1; });
  }
  lots.forEach(planLot);
  var fb={};
  lots.forEach(function(l){ var cx0=Math.floor(l.x/CH), cx1=Math.floor((l.x+7)/CH), cy0=Math.floor(l.y/CH), cy1=Math.floor((l.y+7)/CH);
    for(var cy=cy0;cy<=cy1;cy++) for(var cx=cx0;cx<=cx1;cx++){ (fb[cy*100+cx]=fb[cy*100+cx]||[]).push(l); } });
  var vb={};
  vsegs.forEach(function(s){ var cx0=Math.floor((Math.min(s.x0,s.x0+s.dx)-s.R)/(CH*T)), cx1=Math.floor((Math.max(s.x0,s.x0+s.dx)+s.R)/(CH*T)), cy0=Math.floor((Math.min(s.y0,s.y0+s.dy)-s.R)/(CH*T)), cy1=Math.floor((Math.max(s.y0,s.y0+s.dy)+s.R)/(CH*T));
    for(var cy=Math.max(0,cy0);cy<=cy1;cy++) for(var cx=Math.max(0,cx0);cx<=cx1;cx++){ (vb[cy*100+cx]=vb[cy*100+cx]||[]).push(s); } });

  /* -- scenery between the cities: hills, palms, bushes, rocks, flowers -- */
  for(y=0;y<H;y++) for(x=0;x<W;x++){ i=I(x,y); var tq3=ter[i];
    if(tq3===K.GRASS&&!lotm[i]&&!vm[i]){ var hn=vnoise(x/9,y/9,31);
      if(dOc[i]>10&&hn>0.64&&!used[i]) ter[i]=K.HILL;
      var r2=hash(x,y,32), dn=vnoise(x/7,y/7,33);
      if(!used[i]){ if(r2<0.03+(dn>0.6?0.06:0)){ dec[i]=ter[i]===K.HILL?5:1; solid[i]=1; } else if(r2<0.11) dec[i]=3; else if(r2<0.18) dec[i]=4; }
    }else if(tq3===K.SAND&&!used[i]&&!vm[i]&&dOc[i]>=3&&hash(x,y,34)<0.03){ dec[i]=2; solid[i]=1; }
  }
  for(y=0;y<H;y++) for(x=0;x<W;x++){ i=I(x,y); var q5=ter[i]; if(q5===K.ROAD||q5===K.WALK||q5===K.PIER||vm[i]){ dec[i]=0; if(q5!==K.PIER) solid[i]=0; } }
  objects.forEach(function(o){ if(o.kind!=="shop"&&o.kind!=="hq"&&o.kind!=="stop") return; for(var xx=o.x-1;xx<=o.x+o.w;xx++) for(var yy=o.y+o.h;yy<o.y+o.h+2;yy++) if(inb(xx,yy)&&ter[I(xx,yy)]!==K.OCEAN&&ter[I(xx,yy)]!==K.SURF&&ter[I(xx,yy)]!==K.MTN){ solid[I(xx,yy)]=0; dec[I(xx,yy)]=0; } });
  objects.forEach(function(o){ for(var yy=o.y;yy<o.y+o.h;yy++) for(var xx=o.x;xx<o.x+o.w;xx++) if(inb(xx,yy)) dec[I(xx,yy)]=0; });

  /* -- lamps: two corners of every lot -- */
  var lamps=[], lampTiles=[];
  lots.forEach(function(l){ lampTiles.push([l.x-1,l.y-1]); if(hash(l.x,l.y,40)<0.6) lampTiles.push([l.x+8,l.y+8]); });
  lampTiles.forEach(function(p){ if(inb(p[0],p[1])&&ter[I(p[0],p[1])]===K.WALK){ fl[I(p[0],p[1])]|=16; lamps.push({x:p[0]+0.5,y:p[1]+0.5,r:3.6,c:"warm"}); } });
  placesOut.forEach(function(p){ var tn=town(), ls=null; if(tn&&p.skey&&typeof tn.storefrontLights==="function"){ try{ ls=tn.storefrontLights(p.skey,p.state); }catch(e){ ls=null; } }
    if(ls&&ls.length) ls.forEach(function(l){ lamps.push({x:p.x+l.x,y:p.y+l.y,r:Math.max(2,l.r||3),c:l.color||"warm"}); }); else if(p.state!=="construction") lamps.push({x:p.x+p.w/2,y:p.y+p.h-1,r:4.6,c:"warm"}); });
  lamps.push({x:hq.x+hq.w/2,y:hq.y+hq.h-1,r:5.5,c:"#F0B429"});
  stops.forEach(function(s){ lamps.push({x:s.obj.x+1,y:s.obj.y+1,r:3.2,c:"jade"}); });
  if(pier) lamps.push({x:pier.x+pier.w/2,y:pier.y+3,r:6,c:"warm"});

  /* -- freeway cars (positions along the polylines) -- */
  var lanes=[];
  fwyT.forEach(function(r){ var cum=[0], q; for(q=1;q<r.length;q++){ var dx=r[q][0]-r[q-1][0], dy=r[q][1]-r[q-1][1]; cum.push(cum[q-1]+Math.sqrt(dx*dx+dy*dy)); } lanes.push({p:r,cum:cum,len:cum[cum.length-1]}); });
  var carCols=["red","blue","white","yellow","green","black","silver","orange"], cars=[];
  lanes.forEach(function(ln,li){ var n=Math.max(6,Math.round(ln.len/8)); for(var q=0;q<n;q++) cars.push({lane:li,off:hash(q,li,50)*ln.len,sp:(3+hash(q,li,51)*3)*(q%2?1:-1),col:carCols[(hash(q,li,52)*carCols.length)|0],side:q%2?-1:1}); });

  var R={w:W,h:H,ter:ter,solid:solid,fl:fl,dec:dec,vm:vm,rb:rb,lots:lots,vb:vb,vlines:vlines,objects:objects,places:placesOut,stops:stops,lamps:lamps,hq:hq,pier:pier,cities:cities,posById:posById,
    news:src.news,activity:src.activity,fallback:src.fallback,cars:cars,lanes:lanes,fb:fb,districtAt:districtAt,yLO:yLO,yOS:yOS,proj:proj,dOc:dOc,dLand:dLand};
  R.cityAt=function(tx,ty){ var best="", bd=1e9; cities.forEach(function(c){ var dx=c.x-tx, dy=c.y-ty, d=Math.sqrt(dx*dx+dy*dy); if(d<c.r*1.25&&d<bd){ bd=d; best=c.name; } });
    if(R.pier&&tx>=R.pier.x&&tx<R.pier.x+R.pier.w&&ty>=R.pier.y&&ty<R.pier.y+R.pier.h) return "Worldwide pier";
    return best||DNAME[districtAt(tx,ty)]; };
  R.paintChunk=paintChunk; R.animate=animate; R.paintObject=paintObject; R.drawCars=drawCars; R.paintOverview=paintOverview; R.shop=shopDef;
  return R;
}

/* ---------- terrain painting ---------- */
var tileCache={}, objCache={};
function tileSprite(name){
  var s=tileCache[name]; if(s) return s; var t=town(); s=mk(T,T);
  try{ t.tile(s.getContext("2d"),name,0,0,1,0,"day"); }catch(e){}
  tileCache[name]=s; return s;
}
function objSprite(id,w,h,light){
  var key=id+"|"+light, s=objCache[key]; if(s) return s; var t=town(); s=mk(w*T,h*T);
  try{ t.objectAt(s.getContext("2d"),{id:id,w:w,h:h},0,0,1,0,light||"day"); }catch(e){}
  objCache[key]=s; return s;
}
var ANIMN={"ocean":1,"ocean-2":1,"ocean-3":1,"ocean-deep":1,"ocean-deep-2":1,"harbour":1,"harbour-2":1};
function isAnimated(name){ return !!ANIMN[name]||name.indexOf("surf")===0; }
function tname(R,tx,ty){
  var w=R.w, i=ty*w+tx, t=R.ter[i], fl=R.fl[i], dd=R.districtAt(tx,ty), h=hash(tx,ty,1);
  function at(x,y){ if(x<0||y<0||x>=R.w||y>=R.h) return K.OCEAN; return R.ter[y*R.w+x]; }
  function isW(v){ return v===K.OCEAN||v===K.SURF; }
  if(t===K.OCEAN||t===K.SURF){ if(fl&32) return h<0.5?"harbour":"harbour-2"; if(t===K.OCEAN&&R.dLand[i]>5) return h<0.5?"ocean-deep":"ocean-deep-2"; return h<0.34?"ocean":(h<0.67?"ocean-2":"ocean-3"); }
  if(t===K.SAND){
    var n=isW(at(tx,ty-1)), s=isW(at(tx,ty+1)), we=isW(at(tx-1,ty)), e=isW(at(tx+1,ty)), c=(n?1:0)+(s?1:0)+(we?1:0)+(e?1:0);
    if(c===1) return n?"surf-n":(s?"surf-s":(we?"surf-w":"surf-e"));
    if(c>=2){ if(n&&we&&!s&&!e) return "surf-out-se"; if(n&&e&&!s&&!we) return "surf-out-sw"; if(s&&we&&!n&&!e) return "surf-out-ne"; if(s&&e&&!n&&!we) return "surf-out-nw"; return n?"surf-n":(s?"surf-s":(we?"surf-w":"surf-e")); }
    if(isW(at(tx-1,ty-1))) return "surf-in-nw"; if(isW(at(tx+1,ty-1))) return "surf-in-ne"; if(isW(at(tx-1,ty+1))) return "surf-in-sw"; if(isW(at(tx+1,ty+1))) return "surf-in-se";
    if(R.dOc[i]<=2) return h<0.5?"wet-sand":"wet-sand-2";
    return h<0.34?"sand":(h<0.67?"sand-2":"sand-3");
  }
  if(t===K.ROAD){ var hz=(at(tx-1,ty)===K.ROAD||at(tx+1,ty)===K.ROAD), vt=(at(tx,ty-1)===K.ROAD||at(tx,ty+1)===K.ROAD); if(hz&&vt) return "road"; return hz?"road-h":(vt?"road-v":"road"); }
  if(t===K.FWY){ var up=at(tx,ty-1)===K.FWY, dn=at(tx,ty+1)===K.FWY, lf=at(tx-1,ty)===K.FWY, rt=at(tx+1,ty)===K.FWY;
    if(lf&&rt&&!up&&dn) return "freeway-edge-n"; if(lf&&rt&&up&&!dn) return "freeway-edge-s"; if(up&&dn&&!lf&&rt) return "freeway-edge-w"; if(up&&dn&&lf&&!rt) return "freeway-edge-e";
    return ((up?1:0)+(dn?1:0)>=(lf?1:0)+(rt?1:0))?"freeway-v":"freeway-h"; }
  if(t===K.WALK){ var rn=at(tx,ty-1)===K.ROAD, rs=at(tx,ty+1)===K.ROAD, rw=at(tx-1,ty)===K.ROAD, re=at(tx+1,ty)===K.ROAD; if(rn&&!rs) return "sidewalk-curb-n"; if(rs&&!rn) return "sidewalk-curb-s"; if(rw&&!re) return "sidewalk-curb-w"; if(re&&!rw) return "sidewalk-curb-e"; return "sidewalk"; }
  if(t===K.PAVE||t===K.BLDG) return h<0.1?"plaza":["ground-la","ground-oc","ground-sd"][dd];
  if(t===K.PIER) return (at(tx-1,ty)===K.PIER||at(tx+1,ty)===K.PIER)?(h<0.5?"pier":"pier-2"):"pier-v";
  if(t===K.MTN) return "hill-5";
  if(t===K.PARK) return R.dec[i]===4?"park-flowers":(h<0.06?"park-path":"park");
  if(t===K.HILL) return dd===1?(h<0.5?"hill-1":"hill-2"):(h<0.5?"hill-3":"hill-4");
  return h<0.5?"grass-a":"grass-b";
}
/* the built-in painter, used when town.js is missing */
var GR=[["#9FAE62","#8F9E56","#B2BF74","#7E8D4B"],["#72B067","#62A15A","#86C27A","#4F8F4C"],["#74B58C","#64A67E","#8CC8A0","#549A70"]];
function paintTileFallback(R,c,tx,ty,X,Y){
  var i=ty*R.w+tx, t=R.ter[i], dd=R.districtAt(tx,ty), g=GR[dd], h1=hash(tx,ty,1), j;
  var col=["#2A6A8E","#4E9DB8","#E6D3A3",g[0],g[3],"#4B4D53","#BDB6A6","#3A3B40","#A9A292","#6DBB6A","#8A5A3B","#6E675C","#A9A292"][t];
  fr(c,col,X,Y,16,16);
  if(t===K.GRASS||t===K.HILL||t===K.PARK){ for(j=0;j<4;j++) if(hash(tx,ty,60+j)<0.6) fr(c,g[2],X+((hash(tx,ty,70+j)*14)|0),Y+((hash(tx,ty,80+j)*13)|0),1,2); }
  else if(t===K.OCEAN&&h1<0.3) fr(c,"#3A82A6",X+3,Y+5,4,1);
}
function decorId(R,tx,ty){
  var d=R.dec[ty*R.w+tx]; if(!d) return null;
  if(d===1) return hash(tx,ty,90)<0.5?"palm-1":"palm-2"; if(d===2) return "palm-2"; if(d===3) return hash(tx,ty,91)<0.5?"bush":"agave"; if(d===5) return "rock"; return null;
}
var DECSZ={"palm-1":[1,2],"palm-2":[1,3],"bush":[1,1],"agave":[1,1],"rock":[1,1]};
var ROOFS=[["#C65D3B","#A94C30"],["#8C5A3C","#6E452D"],["#5D5F65","#4A4C52"],["#2F6F65","#245A52"],["#B94612","#94380E"]], WALLS=["#F6EEDC","#EBDFC4","#DDE1EC","#E8D5B0","#F3E3C2"];
var CARC=["#C8402B","#2F7F99","#E8E0D0","#F0B429","#3C8A5E","#26272B","#9AA0A6","#EA5E14"];
function tree(c,X,Y,s){
  var g=(s%3)?["#2F6F4B","#3C8A5E","#4FA070"]:["#2A6644","#3C8A5E","#5FB07A"];
  fr(c,"rgba(0,0,0,.2)",X+2,Y+11,12,4); fr(c,"#5E3B26",X+7,Y+9,2,5);
  fr(c,g[0],X+2,Y+3,12,8); fr(c,g[0],X+4,Y+1,8,12); fr(c,g[1],X+3,Y+3,10,6); fr(c,g[1],X+5,Y+2,6,9); fr(c,g[2],X+5,Y+3,4,3);
}
function lawn(c,ox,oy,dd,seed){
  var g=GR[dd], j; fr(c,g[0],ox,oy,128,128);
  for(j=0;j<60;j++){ var r=hash(seed,j,5); fr(c,r<0.5?g[1]:g[2],ox+((hash(seed,j,6)*126)|0),oy+((hash(seed,j,7)*125)|0),1,2); }
}
function house(c,x,y,s){
  var rf=ROOFS[s%5], wl=WALLS[(s>>2)%5];
  fr(c,"rgba(0,0,0,.2)",x+2,y+30,48,4);
  fr(c,rf[0],x,y,48,20); for(var i=3;i<20;i+=4) fr(c,rf[1],x,y+i,48,1); fr(c,rf[1],x,y+18,48,3); fr(c,"rgba(255,255,255,.18)",x,y,48,1);
  fr(c,"#8A8579",x+34,y-4,6,8); fr(c,"#6A655A",x+34,y-4,6,2);
  fr(c,wl,x,y+21,48,11); fr(c,"rgba(0,0,0,.12)",x,y+29,48,3);
  fr(c,"#26272B",x+6,y+22,9,8); fr(c,"#A9CDD4",x+7,y+23,7,6); fr(c,"#26272B",x+10,y+23,1,6);
  fr(c,"#26272B",x+33,y+22,9,8); fr(c,"#A9CDD4",x+34,y+23,7,6); fr(c,"#26272B",x+37,y+23,1,6);
  fr(c,"#5E3B26",x+21,y+21,7,11); fr(c,"#F0B429",x+26,y+27,1,2);
}
function apt(c,x,y,w,h,s){
  var wl=["#E8D5B0","#D6C197"][s%2], i, j;
  fr(c,"rgba(0,0,0,.2)",x+2,y+h-1,w,4);
  fr(c,"#8D939E",x,y,w,24); fr(c,"#A5ABB5",x,y,w,3); fr(c,"#6F7580",x,y+21,w,3);
  for(i=0;i<3;i++) fr(c,"#B9BEC8",x+10+i*30+((s*7)%9),y+8,10,7);
  fr(c,wl,x,y+24,w,h-24); fr(c,"rgba(0,0,0,.1)",x,y+h-4,w,4);
  for(j=0;j<3;j++) for(i=0;i<6;i++){ var wx=x+5+i*15, wy=y+29+j*17; fr(c,"#26272B",wx-1,wy-1,11,13); fr(c,((i+j+s)%5===0)?"#F0D890":"#A9CDD4",wx,wy,9,11); fr(c,"rgba(255,255,255,.3)",wx,wy,9,2); fr(c,"#B3AE9F",wx-1,wy+12,11,2); }
  fr(c,"#3F2A1B",x+w/2-7,y+h-16,14,16); fr(c,"#A9CDD4",x+w/2-5,y+h-14,10,9); fr(c,"#EA5E14",x+w/2-10,y+h-19,20,3);
}
function tower(c,x,y,w,h,s){
  var i, j;
  fr(c,"rgba(0,0,0,.25)",x+2,y+h-1,w,4);
  fr(c,"#3A4A55",x,y,w,h); fr(c,"#5D6F7C",x,y,w,4); fr(c,"#26343D",x,y+h-5,w,5);
  for(j=0;j<7;j++) for(i=0;i<9;i++){ var wx=x+4+i*10, wy=y+8+j*10; fr(c,((i*3+j*5+s)%7===0)?"#E9D49A":"#7FA6B5",wx,wy,7,7); fr(c,"rgba(255,255,255,.25)",wx,wy,7,1); }
  fr(c,"#1F2023",x+w/2-8,y+h-14,16,14); fr(c,"#7FA6B5",x+w/2-6,y+h-12,12,9);
}
function strip(c,x,y,s){
  var i, aw=["#EA5E14","#4F9E92","#C65D3B","#F0B429","#5D8FB5"];
  fr(c,"rgba(0,0,0,.2)",x+2,y+47,128,4);
  fr(c,"#CBBB9C",x,y,128,20); fr(c,"#B9A988",x,y+17,128,3); fr(c,"#8A8579",x+14+(s%30),y+5,10,8); fr(c,"#8A8579",x+80,y+6,12,7);
  fr(c,"#EBDFC4",x,y+20,128,28);
  for(i=0;i<4;i++){ var sx=x+i*32, col=aw[(s+i*2)%5];
    fr(c,col,sx+1,y+20,30,7); for(var q=0;q<30;q+=6) fr(c,"#F6EEDC",sx+1+q,y+20,3,7); fr(c,"rgba(0,0,0,.2)",sx+1,y+27,30,2);
    fr(c,"#26272B",sx+3,y+30,16,14); fr(c,"#A9CDD4",sx+4,y+31,14,12); fr(c,"rgba(255,255,255,.3)",sx+4,y+31,14,2);
    fr(c,"#5E3B26",sx+22,y+31,7,17); fr(c,"#F6EEDC",sx+23,y+33,5,3); }
}
function carSprite(c,x,y,col,horiz){
  if(horiz){ fr(c,"rgba(0,0,0,.25)",x+1,y+9,14,3); fr(c,col,x,y+2,15,8); fr(c,"#A9CDD4",x+4,y+3,6,5); fr(c,"#1F2023",x+2,y+9,3,2); fr(c,"#1F2023",x+10,y+9,3,2); }
  else{ fr(c,"rgba(0,0,0,.25)",x+1,y+13,10,3); fr(c,col,x,y,10,15); fr(c,"#A9CDD4",x+1,y+4,8,5); fr(c,"#1F2023",x-1,y+2,2,4); fr(c,"#1F2023",x+9,y+2,2,4); fr(c,"#1F2023",x-1,y+9,2,4); fr(c,"#1F2023",x+9,y+9,2,4); }
}
function paintLot(R,c,l,ox,oy){
  var k=l.kind, dd=R.districtAt(l.x,l.y), s=l.seed, i, j;
  if(l.art){
    if(k==="gas"){ fr(c,"#4B4D53",ox,oy,128,128); fr(c,"#8D8A82",ox,oy+124,128,4); }
    else if(k==="strip"){ fr(c,"#4B4D53",ox,oy,128,80); for(i=0;i<8;i++) fr(c,"#E8E8E2",ox+6+i*16,oy+40,1,12); for(i=0;i<8;i++){ if(hash(s,i,3)<0.5) carSprite(c,ox+i*16+2,oy+44,CARC[(hash(s,i,4)*8)|0],false); } fr(c,"#8D8A82",ox,oy+78,128,2); fr(c,"#4B4D53",ox,oy+80,128,48); }
    else lawn(c,ox,oy,dd,s);
    for(i=0;i<l.art.length;i++){ var a=l.art[i]; c.drawImage(objSprite(a.id,a.w,a.h,"day"),ox+a.x*T,oy+a.y*T); }
    for(i=0;i<l.trees.length;i++) tree(c,(l.trees[i][0]-l.x)*T+ox,(l.trees[i][1]-l.y)*T+oy,s+i);
    return;
  }
  if(k==="houses"){ lawn(c,ox,oy,dd,s); for(j=0;j<2;j++) for(i=0;i<2;i++){ fr(c,"#CFC8B8",ox+i*64+48,oy+j*64+32,14,32); house(c,ox+i*64,oy+j*64+16,s+i*3+j*7); } }
  else if(k==="apt"){ lawn(c,ox,oy,dd,s); fr(c,"#CFC8B8",ox+56,oy+96,16,32); apt(c,ox+16,oy+16,96,80,s); }
  else if(k==="tower"){ fr(c,"#B8B2A4",ox,oy,128,128); for(i=0;i<128;i+=16){ fr(c,"#A9A292",ox+i,oy,1,128); fr(c,"#A9A292",ox,oy+i,128,1); } tower(c,ox+16,oy+16,96,80,s); }
  else if(k==="strip"){ fr(c,"#4B4D53",ox,oy,128,80); for(i=0;i<8;i++) fr(c,"#E8E8E2",ox+6+i*16,oy+40,1,12); for(i=0;i<8;i++){ if(hash(s,i,3)<0.5) carSprite(c,ox+i*16+2,oy+44,CARC[(hash(s,i,4)*8)|0],false); }
    fr(c,"#8D8A82",ox,oy+78,128,2); strip(c,ox,oy+80,s); }
  else if(k==="parking"){ fr(c,"#4B4D53",ox,oy,128,128); for(j=0;j<2;j++){ for(i=0;i<8;i++){ fr(c,"#E8E8E2",ox+i*16,oy+16+j*72,1,24); if(hash(s,i+j*9,3)<0.55) carSprite(c,ox+i*16+3,oy+20+j*72,CARC[(hash(s,i+j*9,4)*8)|0],false); } }
    fr(c,"#F0B429",ox,oy+62,128,1); fr(c,"#F0B429",ox,oy+66,128,1); }
  else if(k==="park"){ lawn(c,ox,oy,dd,s); for(i=0;i<128;i+=3) fr(c,"#6DBB6A",ox+i,oy+((i*7)%120),3,2); fr(c,"#D9B98C",ox+48,oy,32,128); fr(c,"#D9B98C",ox,oy+48,128,32);
    fr(c,"#C39F70",ox+48,oy,1,128); fr(c,"#C39F70",ox+79,oy,1,128); fr(c,"#C39F70",ox,oy+48,128,1); fr(c,"#C39F70",ox,oy+79,128,1);
    fr(c,"#8C8479",ox+52,oy+52,24,24); fr(c,"#3A8CA6",ox+55,oy+55,18,18); fr(c,"#6FB9C4",ox+58,oy+58,6,3); fr(c,"#F6EEDC",ox+62,oy+62,4,4);
    for(i=0;i<5;i++){ var fx=ox+((hash(s,i,8)*120)|0), fy=oy+((hash(s,i,9)*120)|0); fr(c,["#F0B429","#F6EEDC","#EA5E14"][i%3],fx,fy,2,2); } }
  else if(k==="lawn"){ lawn(c,ox,oy,dd,s); }
  else if(k==="school"){ lawn(c,ox,oy,dd,s); fr(c,"#CFC8B8",ox,oy+56,128,10);
    fr(c,"rgba(0,0,0,.2)",ox+2,oy+111,112,4); fr(c,"#8D939E",ox,oy+64,112,20); fr(c,"#6F7580",ox,oy+81,112,3);
    fr(c,"#B9573E",ox,oy+84,112,28); for(i=0;i<7;i++){ fr(c,"#26272B",ox+4+i*15,oy+90,11,12); fr(c,"#A9CDD4",ox+5+i*15,oy+91,9,10); }
    fr(c,"#5E3B26",ox+50,oy+98,12,14); fr(c,"#F6EEDC",ox+44,oy+68,24,8); fr(c,"#1F2023",ox+49,oy+70,14,3);
    fr(c,"#B3AE9F",ox+118,oy+10,2,50); fr(c,"#EA5E14",ox+110,oy+10,8,5); fr(c,"#F6EEDC",ox+110,oy+15,8,4); }
  else if(k==="church"){ lawn(c,ox,oy,dd,s); fr(c,"#CFC8B8",ox+56,oy+112,16,16);
    fr(c,"rgba(0,0,0,.2)",ox+34,oy+111,66,4);
    fr(c,"#F6EEDC",ox+34,oy+78,64,34); fr(c,"#8C5A3C",ox+30,oy+50,72,32); for(i=0;i<32;i+=4) fr(c,"#6E452D",ox+30,oy+50+i,72,1);
    fr(c,"#F6EEDC",ox+54,oy+18,24,40); fr(c,"#8C5A3C",ox+52,oy+10,28,10); fr(c,"#F6EEDC",ox+64,oy+0,3,12); fr(c,"#F6EEDC",ox+60,oy+3,11,3);
    fr(c,"#26272B",ox+60,oy+24,12,12); fr(c,"#A9CDD4",ox+62,oy+26,8,8);
    fr(c,"#5E3B26",ox+58,oy+94,16,18); fr(c,"#A9CDD4",ox+40,oy+88,8,14); fr(c,"#A9CDD4",ox+84,oy+88,8,14); }
  else if(k==="gas"){ fr(c,"#4B4D53",ox,oy,128,128); fr(c,"#8D8A82",ox,oy+124,128,4);
    fr(c,"rgba(0,0,0,.22)",ox+10,oy+58,100,8); fr(c,"#B3AE9F",ox+14,oy+34,4,26); fr(c,"#B3AE9F",ox+102,oy+34,4,26);
    fr(c,"#F6EEDC",ox+8,oy+28,104,10); fr(c,"#EA5E14",ox+8,oy+36,104,3); fr(c,"#1F2023",ox+8,oy+28,104,1);
    for(i=0;i<3;i++){ fr(c,"#26272B",ox+30+i*26,oy+46,8,14); fr(c,"#EA5E14",ox+31+i*26,oy+48,6,5); }
    fr(c,"#CBBB9C",ox+80,oy+80,48,32); fr(c,"#8A8579",ox+80,oy+80,48,8); fr(c,"#26272B",ox+86,oy+94,16,12); fr(c,"#A9CDD4",ox+87,oy+95,14,10); fr(c,"#EA5E14",ox+108,oy+98,12,14);
    fr(c,"#5D5F65",ox+6,oy+70,2,50); fr(c,"#F0B429",ox+1,oy+66,12,8); carSprite(c,ox+34,oy+84,CARC[s%8],true); }
  else{ /* plaza: lawn with a paved apron round the shop */
    lawn(c,ox,oy,dd,s); var sh=l.shop;
    if(sh){ var px0=(sh.x-1-l.x)*T, py0=(sh.y-1-l.y)*T, pw=(sh.w+2)*T, ph=(sh.h+1)*T+T; px0=Math.max(px0,0); pw=Math.min(pw,128-px0); ph=Math.min(ph,128-py0);
      fr(c,"#CFC8B8",ox+px0,oy+py0,pw,ph); for(i=0;i<pw;i+=16) fr(c,"#BDB6A6",ox+px0+i,oy+py0,1,ph); for(j=0;j<ph;j+=16) fr(c,"#BDB6A6",ox+px0,oy+py0+j,pw,1);
      fr(c,"#B9B3A4",ox+px0,oy+py0,pw,1); fr(c,"#F6EEDC",ox+px0+8,oy+py0+4,4,4); }
    else{ fr(c,"#D9B98C",ox+56,oy,16,128); fr(c,"#D9B98C",ox,oy+56,128,16); }
    for(i=0;i<6;i++){ var fx2=ox+((hash(s,i,18)*120)|0), fy2=oy+((hash(s,i,19)*120)|0); fr(c,["#F0B429","#F6EEDC","#EA5E14"][i%3],fx2,fy2,2,2); } }
  for(i=0;i<l.trees.length;i++) tree(c,(l.trees[i][0]-l.x)*T+ox,(l.trees[i][1]-l.y)*T+oy,s+i);
}
function paintStreet(R,c,tx,ty,X,Y){
  var i=ty*R.w+tx, t=R.rb[i], m=((tx%PITCH)+PITCH)%PITCH, n=((ty%PITCH)+PITCH)%PITCH, q;
  function ok(dx,dy){ var x=tx+dx, y=ty+dy; if(x<0||y<0||x>=R.w||y>=R.h) return false; var j=y*R.w+x, tt=R.ter[j]; return tt===K.ROAD||tt===K.WALK||R.vm[j]!==0; }
  function junc(dx,dy){ var x=tx+dx, y=ty+dy; return x>=0&&y>=0&&x<R.w&&y<R.h&&R.rb[y*R.w+x]===3&&R.ter[y*R.w+x]===K.ROAD; }
  fr(c,"#4B4D53",X,Y,16,16);
  if(hash(tx,ty,2)<0.5) fr(c,"#45474C",X+((hash(tx,ty,3)*10)|0)+1,Y+((hash(tx,ty,4)*12)|0)+1,4,2);
  if(!ok(0,-1)) fr(c,"#8D8A82",X,Y,16,2); if(!ok(0,1)) fr(c,"#8D8A82",X,Y+14,16,2); if(!ok(-1,0)) fr(c,"#8D8A82",X,Y,2,16); if(!ok(1,0)) fr(c,"#8D8A82",X+14,Y,2,16);
  if(t===1){
    if(junc(0,-1)||junc(0,1)){ for(q=1;q<16;q+=4) fr(c,"#E8E8E2",X+q,Y+(junc(0,-1)?2:3),2,11); }
    else if(m===0&&(ty&1)) fr(c,"#E7B93A",X+15,Y+1,1,10);
  }else if(t===2){
    if(junc(-1,0)||junc(1,0)){ for(q=1;q<16;q+=4) fr(c,"#E8E8E2",X+(junc(-1,0)?2:3),Y+q,11,2); }
    else if(n===0&&(tx&1)) fr(c,"#E7B93A",X+1,Y+15,10,1);
  }
}
/* vector roads (I-5, coast road, ramps): evaluated per pixel against the road centre lines, so 45 degree runs are clean */
function mixc(d,o,r,g,b,a){ if(a>=1){ d[o]=r; d[o+1]=g; d[o+2]=b; return; } d[o]=d[o]*(1-a)+r*a; d[o+1]=d[o+1]*(1-a)+g*a; d[o+2]=d[o+2]*(1-a)+b*a; }
function paintVector(R,c,cx,cy){
  var list=R.vb[cy*100+cx]; if(!list) return;
  var CS=CH*T, X0=cx*CH, Y0=cy*CH, id=c.getImageData(0,0,CS,CS), d=id.data, x, y, px, py, q;
  for(y=0;y<CH;y++) for(x=0;x<CH;x++){
    var tx=X0+x, ty=Y0+y; if(tx>=R.w||ty>=R.h||!R.vm[ty*R.w+tx]) continue; var under=R.ter[ty*R.w+tx], hard=(under===K.ROAD||under===K.WALK);
    for(py=0;py<T;py++) for(px=0;px<T;px++){
      var wx=tx*T+px+0.5, wy=ty*T+py+0.5, best=1e9, bs=null, bd=0, bt=0;
      for(q=0;q<list.length;q++){ var s=list[q], t=((wx-s.x0)*s.dx+(wy-s.y0)*s.dy)/s.l2; t=t<0?0:(t>1?1:t); var qx=s.x0+s.dx*t-wx, qy=s.y0+s.dy*t-wy, dd=Math.sqrt(qx*qx+qy*qy), ex=dd-s.hw; if(ex<best){ best=ex; bs=s; bd=dd; bt=s.s0+t*s.len; } }
      var o=((y*T+py)*CS+(x*T+px))*4, hw=bs.hw, a=bd, nz=hash(tx*16+px,ty*16+py,1);
      if(bs.cls===1){
        if(a<=1.2) mixc(d,o,182,178,168,1);
        else if(a<=2.4) mixc(d,o,231,185,58,1);
        else if(a<=hw){ if(Math.abs(a-hw/2)<0.7&&(Math.floor(bt/9)%2===0)) mixc(d,o,232,232,226,1); else if(a>hw-2.4&&a<=hw-1.2) mixc(d,o,232,232,226,1); else { var v=nz<0.06?-5:0; mixc(d,o,60+v,61+v,67+v,1); } }
        else if(a<=hw+3) mixc(d,o,82,83,89,1);
        else if(a<=hw+4.5) mixc(d,o,181,176,165,1);
        else if(a<=hw+5.5) mixc(d,o,112,109,100,1);
        else if(hard&&a<=hw+9) mixc(d,o,0,0,0,0.26);
      }else if(bs.cls===2){
        if(a<=hw){ if(a<0.9&&(Math.floor(bt/8)%2===0)) mixc(d,o,231,185,58,1); else mixc(d,o,74+(nz<0.05?-4:0),76,82,1); }
        else if(a<=hw+1.3) mixc(d,o,141,138,130,1);
        else if(a<=hw+6.5){ var seam=(Math.floor(wx/8)+Math.floor(wy/8))&1; mixc(d,o,seam?201:194,seam?197:190,seam?187:180,1); }
      }else{
        if(a<=hw){ mixc(d,o,74,76,82,1); }
        else if(a<=hw+1.2) mixc(d,o,141,138,130,1);
      }
    }
  }
  c.putImageData(id,0,0);
}
function paintChunk(R,c,cx,cy){
  var x, y, X0=cx*CH, Y0=cy*CH, tn=town(), nm;
  for(y=0;y<CH;y++) for(x=0;x<CH;x++){ var tx=X0+x, ty=Y0+y;
    if(tx>=R.w||ty>=R.h){ fr(c,"#16181B",x*T,y*T,16,16); continue; }
    var tt=R.ter[ty*R.w+tx];
    if(tt===K.ROAD){ paintStreet(R,c,tx,ty,x*T,y*T); continue; }
    if(tn&&tt!==K.PAVE&&tt!==K.BLDG){ nm=tname(R,tx,ty); c.drawImage(tileSprite(nm),x*T,y*T); } else paintTileFallback(R,c,tx,ty,x*T,y*T);
  }
  var list=R.fb[cy*100+cx]; if(list) list.forEach(function(l){ paintLot(R,c,l,(l.x-X0)*T,(l.y-Y0)*T); });
  paintVector(R,c,cx,cy);
  if(tn){
    for(y=0;y<CH+4;y++) for(x=0;x<CH;x++){ var tx2=X0+x, ty2=Y0+y; if(tx2>=R.w||ty2>=R.h) continue; var ii=ty2*R.w+tx2;
      if(R.fl[ii]&16){ c.drawImage(objSprite("lamp",1,2,"day"),x*T,(y-1)*T); continue; }
      var id=decorId(R,tx2,ty2); if(!id) continue; var sz=DECSZ[id];
      c.drawImage(objSprite(id,sz[0],sz[1],"day"),x*T,(y-sz[1]+1)*T); }
  }
}
/* animated water, drawn over the cached chunks for visible tiles only */
function animate(R,c,x0,y0,x1,y1,tms){
  var tn=town(), tx, ty, t=tms/1000, nm;
  x0=Math.max(0,x0); y0=Math.max(0,y0); x1=Math.min(R.w-1,x1); y1=Math.min(R.h-1,y1);
  for(ty=y0;ty<=y1;ty++) for(tx=x0;tx<=x1;tx++){ var k=R.ter[ty*R.w+tx];
    if(tn){ if(k===K.OCEAN||k===K.SURF||k===K.SAND){ nm=tname(R,tx,ty); if(isAnimated(nm)) tn.tile(c,nm,tx*T,ty*T,1,t,"day"); } }
    else if(k===K.OCEAN){ var v=Math.sin(t*1.3+hash(tx,ty,7)*6.28); if(v>0.55){ c.fillStyle="rgba(255,255,255,.35)"; c.fillRect(tx*T+((hash(tx,ty,8)*10)|0)+2,ty*T+((hash(tx,ty,9)*12)|0)+2,3,1); } } }
}
function carPos(R,car,t){
  var ln=R.lanes[car.lane], d=((car.off+car.sp*t)%ln.len+ln.len)%ln.len, q=1;
  while(q<ln.cum.length-1&&ln.cum[q]<d) q++;
  var a=ln.p[q-1], b=ln.p[q], seg=ln.cum[q]-ln.cum[q-1]||1, f=(d-ln.cum[q-1])/seg, dx=b[0]-a[0], dy=b[1]-a[1], L=Math.sqrt(dx*dx+dy*dy)||1, s=car.sp<0?-1:1;
  return {x:a[0]+dx*f-dy/L*car.side*0.75,y:a[1]+dy*f+dx/L*car.side*0.75,dir:Math.abs(dx)>Math.abs(dy)?(dx*s>0?"right":"left"):(dy*s>0?"down":"up")};
}
function drawCars(R,c,x0,y0,x1,y1,tms){
  var t=tms/1000, tn=town();
  R.cars.forEach(function(car){ var p=carPos(R,car,t); if(p.x<x0-2||p.x>x1+2||p.y<y0-3||p.y>y1+3) return;
    var horiz=(p.dir==="left"||p.dir==="right"), w=horiz?2:1, h=horiz?1:2, X=Math.round(p.x*T-w*T/2), Y=Math.round(p.y*T-h*T/2);
    if(tn){ c.drawImage(objSprite("car-"+car.col+"-"+p.dir,w,h,"day"),X,Y); }
    else{ fr(c,"rgba(0,0,0,.3)",X+2,Y+h*T-4,w*T-4,3); fr(c,"#EA5E14",X+3,Y+3,w*T-6,h*T-8); }
  });
}
function vanSprite(dir){ var horiz=(dir==="left"||dir==="right"); return town()?objSprite("van-"+dir,horiz?2:1,horiz?1:2,"day"):null; }

/* ---------- object art (shops, HQ, stops, signs, landmarks); drawn at 0,0 for o.w x o.h tiles ---------- */
function fitText(c,s,maxW,px){ c.font="bold "+px+"px monospace"; while(s.length>3&&c.measureText(s).width>maxW) s=s.slice(0,-1); return s; }
function catOf(s){ s=String(s||"").toLowerCase(); if(/hall/.test(s)) return "foodhall"; if(/market/.test(s)) return "market"; if(/gallery|memorial|editorial/.test(s)) return "gallery"; if(/studio|atelier/.test(s)) return "studio"; if(/club|dj|music|artist|night/.test(s)) return "club"; if(/bar/.test(s)) return "bar"; if(/restaurant|kitchen|burger|food|cafe/.test(s)) return "kitchen"; return "office"; }
var CATC={kitchen:"#EA5E14",foodhall:"#2F6F65",market:"#4F9E92",gallery:"#414347",studio:"#5D5F65",club:"#26272B",bar:"#B94612",office:"#5D8FB5"};
function paintObject(c,o,light,tms){
  var W=o.w*T, H=o.h*T, tn=town(), t=tms||0;
  if(o.kind==="shop"||o.kind==="hq"){
    var st=o.kind==="hq"?"live":(o.rec?o.rec.state:"live");
    if(tn&&o.skey){ try{ tn.storefront(c,o.skey,st,0,0,1,t,light||"day"); return; }catch(e){} }
    paintBody(c,0,0,o.w,o.h,{d:0}); c.fillStyle="#F6EEDC"; c.font="bold 7px monospace"; c.textBaseline="middle"; c.textAlign="center"; c.fillText(fitText(c,o.title||"",W-8,7),W/2,6); c.textAlign="left";
  }else if(o.kind==="stop"){
    if(tn){ try{ tn.objectAt(c,{id:"busstop",w:2,h:2},0,0,1,t,light||"day"); tn.objectAt(c,{id:"van-right",w:2,h:1},2*T,T,1,t,light||"day"); return; }catch(e){} }
    fr(c,"#414347",2,2,28,2); fr(c,"#CFE9E4",5,6,22,H-12); fr(c,"#EA5E14",34,10,28,15);
  }else if(o.kind==="sign"||o.kind==="landmark"||o.kind==="worldpier"){
    var id=o.kind==="worldpier"?"worldpier":o.tid;
    if(tn&&id){ try{ tn.objectAt(c,{id:id,w:o.w,h:o.h},0,0,1,t,light||"day"); return; }catch(e){} }
    fr(c,"#1F2023",0,0,W,H);
  }else if(o.kind==="news"){
    if(tn){ try{ tn.objectAt(c,{id:"newsstand",w:3,h:2},0,0,1,t,"indoor"); return; }catch(e){} }
    fr(c,"#8A5A3B",2,8,W-4,H-10); fr(c,"#F6EEDC",3,2,10,11);
  }else if(o.tkind){
    var co={}, k; for(k in o) co[k]=o[k]; co.kind=o.tkind; co.id=o.tkind; co.x=0; co.y=0;
    if(tn){ try{ tn.objectAt(c,co,0,0,1,t,"indoor"); }catch(e){ fr(c,"#8A5A3B",0,0,W,H); } } else fr(c,"#8A5A3B",1,1,W-2,H-2);
    if(o.kind==="frame"){
      var im=o.img, fi=(tn&&tn.frameInner)||{dx:0.2,dy:0.2,w:2.6,h:1.6};
      if(im&&im.complete&&im.naturalWidth){ c.imageSmoothingEnabled=true; try{ c.drawImage(im,fi.dx*T,fi.dy*T,fi.w*T,fi.h*T); }catch(e){} c.imageSmoothingEnabled=false; }
    }
  }
}

/* ---------- shop interiors, from town.interior(category) ---------- */
var TOYMAP=[["eggtoss",/egg/i],["egg",/egg/i],["eggcursor",/egg/i],["sandwich",/egg/i],["roof",/^(thg|tiger)/i],["dumpling",/station8/i],["tide",/lobster/i],["stack",/cosmos/i],["goldenhour",/lavida|la ?vida/i],["pours",/barfix/i],["limewash",/^baa|atelier/i],["carlos",/carlos/i],["miramar",/miramar/i],["cengo",/cengo/i]];
function toysFor(p){ var out=[]; TOYMAP.forEach(function(m){ if(m[1].test(String(p.key))||m[1].test(String(p.name))) out.push(m[0]); }); return out.slice(0,4); }
function shopDef(rec){
  var tn=town(), cat=catOf(rec.category), it=null, toys=toysFor(rec);
  if(tn&&typeof tn.interior==="function"){ try{ it=tn.interior(cat); }catch(e){ it=null; } }
  var w, h, rows, objs=[], spawn, door;
  if(it){
    w=it.w; h=it.h; rows=it.tiles.map(function(r){ var o2=""; for(var q=0;q<r.length;q++){ var lg=it.legend[r.charAt(q)]; o2+=(lg&&lg.floor)?(lg.door?"d":"."):((lg&&lg.tile==="void")?" ":"#"); } return o2; });
    spawn=it.spawn; door=it.door;
    it.objects.forEach(function(o){
      var e={id:o.id,kind:o.kind,x:o.x,y:o.y,w:o.w,h:o.h,solid:!!o.solid,layer:o.layer==="wall"?"wall":(o.layer==="floor"?"floor":""),label:o.label||"",room:"shop",paint:true,tkind:o.kind,tone:o.tone,text:o.text,art:o.art,stock:o.stock,dir:o.dir};
      if(o.fh) e.fh=o.fh;
      if(o.slot==="frame"){ e.id="shotframe"; e.act="shot"; e.shop=rec; e.look=rec.desc||rec.name; e.label="Look at the live site"; }
      else if(o.slot==="toy"){ if(!toys.length) return; e={id:"bench-"+toys[0],kind:"bench",x:o.x,y:o.y,w:2,h:2,fh:1,solid:true,act:"toy",toy:toys[0],label:"Open the bench",look:"A workbench with a toy on it.",room:"shop"}; }
      else if(o.slot==="host"){ e.act="shot"; e.shop=rec; e.label="Visit the live site"; e.look=rec.name; }
      objs.push(e);
    });
    toys.slice(1).forEach(function(t2){
      var placed=false, yy, xx;
      for(yy=3;yy<h-4&&!placed;yy++) for(xx=2;xx<w-3&&!placed;xx++){
        var ok=true; for(var q=0;q<objs.length&&ok;q++){ var ob=objs[q]; if(ob.layer==="wall"||ob.layer==="floor") continue; if(xx<ob.x+ob.w+1&&xx+3>ob.x&&yy<ob.y+ob.h+1&&yy+3>ob.y) ok=false; }
        if(ok){ objs.push({id:"bench-"+t2,kind:"bench",x:xx,y:yy,w:2,h:2,fh:1,solid:true,act:"toy",toy:t2,label:"Open the bench",look:"A workbench with a toy on it.",room:"shop"}); placed=true; }
      }
    });
  }else{
    w=14; h=10; rows=[]; for(var yy2=0;yy2<h;yy2++){ var rr=""; for(var xx2=0;xx2<w;xx2++){ rr+=(yy2<2)?"#":(yy2===h-1?((xx2===6||xx2===7)?"d":"#"):"."); } rows.push(rr); }
    spawn={x:6.5,y:8.2}; door={x:6,y:9,w:2};
    objs.push({id:"shotframe",kind:"frame",x:5,y:0,w:4,h:2,layer:"wall",act:"shot",shop:rec,look:rec.desc||rec.name,label:"Look at the live site",room:"shop",paint:true,tkind:"frame"});
    if(toys.length) objs.push({id:"bench-"+toys[0],kind:"bench",x:6,y:3,w:2,h:2,fh:1,solid:true,act:"toy",toy:toys[0],label:"Open the bench",look:"A workbench with a toy on it.",room:"shop"});
  }
  var lights=[{x:w*0.3,y:h*0.45,r:5,c:"warm"},{x:w*0.7,y:h*0.45,r:5,c:"warm"},{x:door.x+(door.w||2)/2,y:h-1,r:3,c:"#F0B429"}];
  var def={id:"shop:"+rec.id,kind:"shop",name:rec.name,w:w,h:h,rows:rows,objects:objs,spawn:{x:spawn.x,y:spawn.y},rooms:[{id:"shop",name:rec.name,x:0,y:0,w:w,h:h}],lights:lights,
    exit:{y:(door.y+0.3)*T,x0:door.x*T,x1:(door.x+(door.w||2))*T},rec:rec,cat:cat,it:it};
  def.paint=function(c){ paintShopTiles(c,def); };
  return def;
}
function paintShopTiles(c,def){
  var tn=town(), it=def.it, x, y;
  fr(c,"#16181B",0,0,def.w*T,def.h*T);
  if(tn&&it){
    for(y=0;y<it.h;y++) for(x=0;x<it.w;x++){ var ch=it.tiles[y].charAt(x), lg=it.legend[ch]; if(!lg||lg.tile==="void") continue; try{ tn.tile(c,lg.tile,x*T,y*T,1,0,"indoor"); }catch(e){ fr(c,"#8A5A3B",x*T,y*T,16,16); } }
    return;
  }
  for(y=2;y<def.h-1;y++) for(x=0;x<def.w;x++) fr(c,((x+y)&1)?"#E3D6B8":"#D6C8A6",x*T,y*T,16,16);
  for(y=0;y<2;y++) for(x=0;x<def.w;x++) fr(c,y?"#B94612":"#EA5E14",x*T,y*T,16,16);
  for(x=0;x<def.w;x++) fr(c,"#2B2C30",x*T,(def.h-1)*T,16,16);
}

/* ---------- minimap and overview ---------- */
var OVC=["#2A6A8E","#4E9DB8","#E6D3A3","#9FAE62","#7E8D4B","#4B4D53","#BDB6A6","#3A3B40","#A9A292","#6DBB6A","#8A5A3B","#6E675C","#8C8477"];
var LOTC={houses:"#CDBE9F",apt:"#8D939E",tower:"#5D6F7C",strip:"#D98C4A",parking:"#6A6C72",park:"#7BB26B",lawn:"#86C27A",school:"#B9573E",church:"#C9B79A",gas:"#6A6C72",plaza:"#BDB6A6"};
function paintOverview(R,ctx,s,opts){
  opts=opts||{}; var base=mk(R.w,R.h), bc=base.getContext("2d"), id=bc.createImageData(R.w,R.h), i, d=id.data;
  function hx(h){ return [parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)]; }
  var pal=OVC.map(hx), gp=GR.map(function(g){ return hx(g[0]); }), road=hx("#F4F1E8"), walk=hx("#A9A292");
  for(i=0;i<R.w*R.h;i++){ var t=R.ter[i], c=pal[t]; if(t===K.GRASS) c=gp[R.districtAt(i%R.w,(i/R.w)|0)]; if(t===K.ROAD) c=road; else if(t===K.WALK||t===K.PAVE||t===K.BLDG) c=walk;
    if(R.dec[i]===1||R.dec[i]===2) c=[60,138,94]; if((t===K.OCEAN)&&(R.fl[i]&32)) c=[62,138,148];
    d[i*4]=c[0]; d[i*4+1]=c[1]; d[i*4+2]=c[2]; d[i*4+3]=255; }
  bc.putImageData(id,0,0);
  ctx.imageSmoothingEnabled=!!opts.smooth; ctx.drawImage(base,0,0,R.w*s,R.h*s);
  R.lots.forEach(function(l){ ctx.fillStyle=LOTC[l.kind]||"#BDB6A6"; ctx.fillRect(l.x*s,l.y*s,8*s,8*s); });
  ctx.lineCap="round"; ctx.lineJoin="round";
  function stroke(cls,w,col){ ctx.strokeStyle=col; ctx.lineWidth=w; R.vlines.forEach(function(v){ if(v.cls!==cls) return; ctx.beginPath(); v.p.forEach(function(p,q){ if(q) ctx.lineTo(p[0]*s,p[1]*s); else ctx.moveTo(p[0]*s,p[1]*s); }); ctx.stroke(); }); }
  stroke("ramp",Math.max(1.4,1.6*s),"#F4F1E8");
  stroke("pch",Math.max(2.4,2.6*s),"#6A6C72"); stroke("pch",Math.max(1.2,1.4*s),"#F4F1E8");
  stroke("fwy",Math.max(3.6,3.8*s),"#1F2023"); stroke("fwy",Math.max(2,2.2*s),"#F0B429");
  R.places.forEach(function(p){ ctx.fillStyle=CATC[catOf(p.category)]||"#5D8FB5"; ctx.fillRect(p.x*s,p.y*s,Math.max(3,p.w*s),Math.max(3,p.h*s)); ctx.fillStyle="#F6EEDC"; ctx.fillRect(p.x*s,(p.y+p.h-1)*s,Math.max(3,p.w*s),Math.max(1,s)); });
  ctx.fillStyle="#1F2023"; ctx.fillRect(R.hq.x*s,R.hq.y*s,R.hq.w*s,R.hq.h*s); ctx.fillStyle="#F0B429"; ctx.fillRect(R.hq.x*s,(R.hq.y+R.hq.h-1)*s,R.hq.w*s,Math.max(1,s));
  R.stops.forEach(function(st){ ctx.fillStyle="#EA5E14"; ctx.fillRect(st.obj.x*s,st.obj.y*s,4*s,2*s); });
  R.objects.forEach(function(o){ if(o.kind==="landmark"){ ctx.fillStyle="#F6EEDC"; ctx.fillRect(o.x*s,o.y*s,o.w*s,o.h*s); } });
  return base;
}
function overviewPins(R,s){
  var pins=[];
  pins.push({id:"hq",label:"K13 HQ, San Diego",kind:"hq",x:Math.round((R.hq.x+R.hq.dx+0.5)*s),y:Math.round((R.hq.y+R.hq.h)*s)});
  pins.push({id:"arcade",label:"The K13 arcade (inside HQ)",kind:"arcade",x:Math.round((R.hq.x+R.hq.dx+0.5)*s)+Math.round(8*s),y:Math.round((R.hq.y+R.hq.h)*s)});
  R.places.forEach(function(p){ pins.push({id:p.id,label:(p.city&&p.city.toLowerCase().indexOf(p.name.toLowerCase().split(" ")[0])>=0)?p.city:(p.name+(p.city?", "+p.city:"")),kind:"shop",x:Math.round((p.x+p.dx+0.5)*s),y:Math.round((p.y+p.h)*s)}); });
  if(R.pier) pins.push({id:"pier",label:"Worldwide pier",kind:"pier",x:Math.round((R.pier.x+R.pier.w/2)*s),y:Math.round((R.pier.y+2)*s)});
  R.stops.forEach(function(st){ pins.push({id:st.id,label:"K13 van: "+st.name,kind:"van",x:Math.round((st.obj.x+2)*s),y:Math.round((st.obj.y+2)*s)}); });
  return pins;
}
function get(){ if(!cache) cache=build(); return cache; }
function rebuild(){ cache=null; tileCache={}; objCache={}; return get(); }

NS.region={get:get,rebuild:rebuild,shopDef:shopDef,catOf:catOf,K:K,T:T,CH:CH,DNAME:DNAME,vanSprite:vanSprite,isFallback:function(){ return get().fallback; }};
/* K13World.renderOverview(canvas, opts): the whole region at `scale` px per tile (default 2), day light, no characters.
   opts: {scale, labels (district names, default true), pins (draw markers, default false), smooth}. Returns the pins
   [{id,label,kind:'hq'|'shop'|'pier'|'van'|'arcade',x,y}] in canvas pixels. */
NS.renderOverview=function(canvas,opts){
  opts=opts||{}; var R=get(), s=opts.scale||2; canvas.width=R.w*s; canvas.height=R.h*s; var ctx=canvas.getContext("2d");
  paintOverview(R,ctx,s,opts); var pins=overviewPins(R,s);
  if(opts.labels!==false){ ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.font="bold "+Math.round(6*s)+"px sans-serif";
    [[0,R.yLO*0.5],[1,(R.yLO+R.yOS)/2],[2,(R.yOS+R.h)/2]].forEach(function(d){ var yy=d[1], xx=R.w*0.72, txt=DNAME[d[0]].toUpperCase(); ctx.fillStyle="rgba(31,32,35,.55)"; ctx.fillText(txt,xx*s+1,yy*s+1); ctx.fillStyle="rgba(246,238,220,.95)"; ctx.fillText(txt,xx*s,yy*s); });
    ctx.font="italic "+Math.round(5*s)+"px sans-serif"; ctx.fillStyle="rgba(246,238,220,.8)"; ctx.fillText("Pacific Ocean",R.w*0.1*s,R.h*0.5*s); ctx.textAlign="left"; }
  if(opts.pins){ pins.forEach(function(p){ ctx.fillStyle=p.kind==="hq"?"#F0B429":(p.kind==="van"?"#4F9E92":"#EA5E14"); ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(3,s*2),0,6.2832); ctx.fill(); ctx.strokeStyle="#1F2023"; ctx.lineWidth=1; ctx.stroke(); }); }
  return pins;
};
})();
