/* K13 Workbench World: the engine. Boots last, reads K13World.map / people / decor / secrets, runs the room.
   Plain ES5, no libraries, no console output, no inline styles (all styling goes through the CSSOM or classes).
   Pixels: everything is drawn at logical resolution (16 px tiles) straight onto the canvas under an integer scale,
   with smoothing off. Static art is baked once into offscreen canvases and blitted.
   Missing people.js / decor.js / secrets.js are fine: labelled placeholders and default dialogue stand in. */
(function(){
"use strict";
var NS=window.K13World=window.K13World||{};
var doc=document, html=doc.documentElement;
var map=NS.map, stageEl=doc.getElementById("kwStage");
if(!map||!stageEl||!doc.createElement("canvas").getContext) return;

var T=16, GP=48, SPEED=58, NPC_SPEED=24, HBW=4, HBH=4, FOOT=4, KEY="k13_world";
var MW=map.w, MH=map.h;
var mq=window.matchMedia?window.matchMedia("(prefers-reduced-motion: reduce)"):null;
var reduced=!!(mq&&mq.matches);
if(mq&&mq.addEventListener) mq.addEventListener("change",function(){ reduced=mq.matches; bakeAll(); });

/* ---------- small helpers ---------- */
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function mk(w,h){ var c=doc.createElement("canvas"); c.width=Math.max(1,w); c.height=Math.max(1,h); return c; }
function el(tag,cls,text){ var e=doc.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function norm(s){ s=String(s||"").toLowerCase(); try{ s=s.normalize("NFD").replace(/[̀-ͯ]/g,""); }catch(e){} return s.replace(/ı/g,"i").replace(/[^a-z0-9]/g,""); }
function hash(x,y,s){ var n=(x*374761393+y*668265263+s*2147483647)|0; n=(n^(n>>>13))*1274126177|0; n=n^(n>>>16); return (n>>>0)/4294967296; }
function fr(c,col,x,y,w,h){ c.fillStyle=col; c.fillRect(x,y,w,h); }
function $(id){ return doc.getElementById(id); }

/* ---------- saved state ---------- */
function loadState(){
  var s=null; try{ s=JSON.parse(localStorage.getItem(KEY)); }catch(e){}
  if(!s||typeof s!=="object") s={};
  if(Array.isArray(s.found)){ var fo={}; s.found.forEach(function(k){ fo[k]=true; }); s.found=fo; }
  if(!s.found||typeof s.found!=="object") s.found={};
  if(!Array.isArray(s.items)) s.items=[];
  if(!s.flags||typeof s.flags!=="object") s.flags={};
  if(!s.talked||typeof s.talked!=="object"||Array.isArray(s.talked)) s.talked={};
  if(!s.seen||typeof s.seen!=="object"||Array.isArray(s.seen)) s.seen={};
  if(typeof s.played!=="number") s.played=0;
  s.list=!!s.list; s.backOpen=!!s.backOpen; if(typeof s.map!=="string") s.map="";
  return s;
}
var state=loadState(), saveAt=0;
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){} }

/* ---------- the maps: HQ interior, the region, one small interior per shop ---------- */
var rows=null, blk=new Uint8Array(1), cur=null, insts={}, RG=null, hq=null, objs=[], objById={}, tileC=null, npcs=[], byNorm={}, allLights=[];
function tileOpen(tx,ty){ return tx>=0&&ty>=0&&tx<MW&&ty<MH&&rows[ty][tx]!=="#"&&rows[ty][tx]!==" "; }
function isFloor(tx,ty){ return tileOpen(tx,ty); }

var ANIM={"neon-k13":1,"neon-free":1,"screens":1,"scoreboard":1,"fishtank":1,"records":1,"claw":1,"pinball":1,"coffee":1,"radio":1,"keypad":1,"printer":1,"whiteboard":0};
function mkObjs(list){
  return list.map(function(o){
    var fh=o.fh||o.h, wall=o.layer==="wall";
    return {o:o,wall:wall,floorL:o.layer==="floor",
      fx:o.x*T, fy:wall?o.y*T:(o.y+o.h-fh)*T, fw:o.w*T, fhp:wall?o.h*T:fh*T,
      sortY:(o.y+o.h)*T, sx:o.x*T-GP, sy:o.y*T-GP, spr:null, anim:!!(ANIM[o.id]||o.kind==="cabinet"), last:-1e9, hidden:false, title:o.title||(o.rec?o.rec.name:"")};
  });
}
function indexObjs(inst){ inst.objById={}; inst.objs.forEach(function(r){ inst.objById[r.o.id]=r; }); }
function useInst(inst){ cur=inst; MW=inst.w; MH=inst.h; rows=inst.rows; blk=inst.blk; objs=inst.objs; objById=inst.objById; tileC=inst.tileC; npcs=inst.npcs; allLights=inst.lights; }
function setBackDoor(on){ (map.backDoor||[]).forEach(function(p){ hq.rows[p[1]][p[0]]=on?"d":"#"; }); }
function makeHQ(){
  var list=map.objects.slice();
  list.forEach(function(o){ if(o.id==="door-front"){ o.act="door"; o.label="Go outside"; o.title="Front door"; } });
  list.push({id:"news-stand",kind:"news",x:33,y:26,w:3,h:2,fh:1,solid:true,act:"news",label:"Read K13 Daily",title:"K13 Daily",room:"lobby",paint:true});
  var inst={id:"hq",kind:"hq",name:"K13 HQ, San Diego",w:map.w,h:map.h,rows:map.tiles.map(function(r){ return r.split(""); }),rooms:map.rooms,spawn:map.spawn,npcs:[],lights:(map.lights||[]).slice(),
    exit:{x0:25*T,x1:27*T,y:31.55*T},blk:new Uint8Array(map.w*map.h),tileC:mk(map.w*T,map.h*T),objs:mkObjs(list),stale:false};
  indexObjs(inst); return inst;
}
function buildBlocked(){
  var x,y;
  if(cur.kind==="region") blk.set(cur.R.solid); else for(y=0;y<MH;y++) for(x=0;x<MW;x++) blk[y*MW+x]=tileOpen(x,y)?0:1;
  objs.forEach(function(r){ var o=r.o; if(!o.solid||r.hidden) return; var fh=o.fh||o.h;
    for(var yy=o.y+o.h-fh;yy<o.y+o.h;yy++) for(var xx=o.x;xx<o.x+o.w;xx++) if(xx>=0&&yy>=0&&xx<MW&&yy<MH) blk[yy*MW+xx]=1; });
  objs.forEach(function(r){ var o=r.o; if(o.door&&o.act==="door") blk[(o.y+o.door.dy)*MW+o.x+o.door.dx]=0; });
}
function blockedPx(px,py){ var tx=Math.floor(px/T), ty=Math.floor(py/T); return tx<0||ty<0||tx>=MW||ty>=MH||blk[ty*MW+tx]===1; }
function boxHit(px,py){
  var x0=Math.floor((px-HBW)/T), x1=Math.floor((px+HBW-0.01)/T), y0=Math.floor((py-HBH)/T), y1=Math.floor((py-0.01)/T), x, y;
  for(y=y0;y<=y1;y++) for(x=x0;x<=x1;x++) if(x<0||y<0||x>=MW||y>=MH||blk[y*MW+x]) return true;
  return false;
}
function roomAtTile(tx,ty){ var rl=cur.rooms||[]; for(var i=0;i<rl.length;i++){ var r=rl[i]; if(tx>=r.x&&tx<r.x+r.w&&ty>=r.y&&ty<r.y+r.h) return r; } return null; }

/* ---------- A* on tiles (4-way) ---------- */
function findPath(sx,sy,gx,gy){
  if(gx<0||gy<0||gx>=MW||gy>=MH||blk[gy*MW+gx]) return null;
  var N=MW*MH, pf=cur.pf||(cur.pf={g:new Float32Array(N),came:new Int32Array(N),done:new Uint8Array(N)}), g=pf.g, came=pf.came, done=pf.done, i;
  g.fill(1e9); came.fill(-1); done.fill(0);
  var hf=[], hi=[];
  function push(f,idx){ var k=hf.length; hf.push(f); hi.push(idx); while(k>0){ var p=(k-1)>>1; if(hf[p]<=hf[k]) break; var tf=hf[p],ti=hi[p]; hf[p]=hf[k]; hi[p]=hi[k]; hf[k]=tf; hi[k]=ti; k=p; } }
  function pop(){ var top=hi[0], lf=hf.pop(), li=hi.pop(); if(hf.length){ hf[0]=lf; hi[0]=li; var k=0,n=hf.length; for(;;){ var l=2*k+1,r=l+1,m=k; if(l<n&&hf[l]<hf[m]) m=l; if(r<n&&hf[r]<hf[m]) m=r; if(m===k) break; var tf=hf[m],ti=hi[m]; hf[m]=hf[k]; hi[m]=hi[k]; hf[k]=tf; hi[k]=ti; k=m; } } return top; }
  var s=sy*MW+sx, goal=gy*MW+gx; g[s]=0; push(Math.abs(sx-gx)+Math.abs(sy-gy),s);
  var D=[[1,0],[-1,0],[0,1],[0,-1]];
  while(hf.length){
    var nd=pop(); if(done[nd]) continue; done[nd]=1;
    if(nd===goal){ var path=[], c=nd; while(c!==s){ path.push([c%MW,(c/MW)|0]); c=came[c]; } path.reverse(); return path; }
    var cx=nd%MW, cy=(nd/MW)|0;
    for(i=0;i<4;i++){ var nx=cx+D[i][0], ny=cy+D[i][1]; if(nx<0||ny<0||nx>=MW||ny>=MH) continue; var ni=ny*MW+nx; if(blk[ni]||done[ni]) continue;
      var ng=g[nd]+1; if(ng<g[ni]){ g[ni]=ng; came[ni]=nd; push(ng+Math.abs(nx-gx)+Math.abs(ny-gy),ni); } }
  }
  return null;
}
function lineClear(ax,ay,bx,by){ var dx=bx-ax, dy=by-ay, n=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/3), i; for(i=1;i<=n;i++){ if(boxHit(ax+dx*i/n,ay+dy*i/n)) return false; } return true; }
function smooth(startX,startY,tiles){
  var pts=tiles.map(function(t){ return {x:(t[0]+0.5)*T,y:(t[1]+0.5)*T}; });
  var out=[], ax=startX, ay=startY, i=0;
  while(i<pts.length){ var far=i; for(var j=Math.min(pts.length-1,i+28);j>=i;j--){ if(lineClear(ax,ay,pts[j].x,pts[j].y)){ far=j; break; } } out.push(pts[far]); ax=pts[far].x; ay=pts[far].y; i=far+1; }
  return out;
}

/* ---------- placeholders and baking ---------- */
var PCOL=["#EA5E14","#4F9E92","#F0B429","#5D8FB5","#C65D3B","#3C8A5E","#B94612","#7A8B99"];
var KIND_COL={cabinet:"#414347",bench:"#8A5A3B",desk:"#5D5F65",plant:"#3C8A5E",rug:"#B9A07E",mat:"#B94612",furniture:"#8A5A3B",counter:"#5E3B26",door:"#5E3B26",fixture:"#5D5F65"};
function placeholder(c,o){
  var w=o.w*T, h=o.h*T, col=KIND_COL[o.kind]||"#5D5F65", y0=GP;
  c.save(); c.translate(GP,0);
  if(o.layer==="floor"){ fr(c,col,0,y0,w,h); fr(c,"rgba(0,0,0,.18)",0,y0,w,1); fr(c,"rgba(0,0,0,.18)",0,y0+h-1,w,1); c.restore(); return; }
  fr(c,"#1F2023",0,y0,w,h); fr(c,col,1,y0+1,w-2,h-2);
  fr(c,"rgba(255,255,255,.16)",1,y0+1,w-2,2);
  c.fillStyle="#F6EEDC"; c.font="bold 6px monospace"; c.textBaseline="top";
  var t=o.id.replace(/^(cab|bench)-/,""); c.fillText(t.slice(0,Math.max(2,Math.floor(w/4))),3,y0+4); c.restore();
}
function bakeObject(r,tms){
  var o=r.o, w=o.w*T+2*GP, h=o.h*T+2*GP;
  if(!r.spr) r.spr=mk(w,h);
  var c=r.spr.getContext("2d"); c.imageSmoothingEnabled=false; c.clearRect(0,0,w,h);
  var D=NS.decor, ok=false, RGN=NS.region;
  if(o.paint&&RGN&&typeof RGN.get==="function"){
    try{ c.save(); c.translate(GP,GP); var cc={}; for(var kk in o) cc[kk]=o[kk]; cc.x=0; cc.y=0; RGN.get().paintObject(c,cc,cur&&cur.kind==="region"?skyPhase:"indoor",tms/1000); c.restore(); ok=true; }catch(e){ ok=false; try{ c.restore(); }catch(x){} }
    if(!ok) c.clearRect(0,0,w,h);
  }
  else if(D&&typeof D.object==="function"){
    try{
      c.save(); c.translate(GP,GP);
      var cl={}; for(var k in o) cl[k]=o[k]; cl.x=0; cl.y=0;
      cl.open=!!state.backOpen; cl.revealed=!!state.flags.revealed; cl.you=!!state.found.score; D.object(c,cl,1,tms/1000); c.restore(); ok=true;
    }catch(e){ ok=false; try{ c.restore(); }catch(x){} }
    if(!ok) c.clearRect(0,0,w,h);
  }
  if(!ok) placeholder(c,o);
  r.last=tms;
}
function bakeAll(){ var t=performance.now(), k; for(k in insts) if(insts[k]!==cur) insts[k].stale=true; if(cur) cur.stale=false; objs.forEach(function(r){ r.spr=null; if(!r.hidden) bakeObject(r,t); }); sprCache={}; }

/* ---------- people ---------- */
var sprCache={}, anchor={x:0,y:0};
function peopleApi(){ return NS.people&&typeof NS.people.draw==="function"?NS.people:null; }
function personSprite(id,dir,frame){
  var key=id+"|"+dir+"|"+frame, s=sprCache[key]; if(s) return s;
  var c=mk(16,24), cx=c.getContext("2d"), P=peopleApi(), ok=false; cx.imageSmoothingEnabled=false;
  if(P){ try{ ok=P.draw(cx,id,dir,frame,anchor.x,anchor.y,1)!==false; }catch(e){ ok=false; } }
  if(!ok){
    cx.clearRect(0,0,16,24);
    var col=PCOL[Math.floor(hash(id.length,id.charCodeAt(0)||1,7)*PCOL.length)];
    var bob=(frame<4&&(frame%2))?1:0;
    fr(cx,"rgba(0,0,0,.25)",3,22,10,2);
    fr(cx,"#1F2023",4,10+bob,8,12); fr(cx,col,5,11+bob,6,9);
    fr(cx,"#1F2023",4,2+bob,8,9); fr(cx,"#E8C8A0",5,3+bob,6,7);
    if(dir==="up") fr(cx,"#3A2A20",5,3+bob,6,4); else { fr(cx,"#1F2023",6,6+bob,1,1); fr(cx,"#1F2023",9,6+bob,1,1); }
  }
  sprCache[key]=c; return c;
}

var DEFAULT_ROSTER=Object.keys(map.posts);
function postFor(id,name){
  var keys=Object.keys(map.posts), a=norm(id), b=norm(name), first=norm(String(name||"").split(/[\s(]/)[0]), i;
  for(i=0;i<keys.length;i++) if(norm(keys[i])===a||norm(keys[i])===b||norm(keys[i])===first) return map.posts[keys[i]];
  for(i=0;i<keys.length;i++){ var k=norm(keys[i]); if(a&&(a.indexOf(k)===0||k.indexOf(a)===0)) return map.posts[keys[i]]; if(b&&b.indexOf(k)===0) return map.posts[keys[i]]; }
  return null;
}
function buildNpcs(){
  var out=[]; byNorm={};
  var P=NS.people, list=(P&&P.list&&P.list.length)?P.list:null, seen={};
  var src=list?list.filter(function(p){ return p&&p.id&&p.id!=="player"; }):DEFAULT_ROSTER.map(function(k){ return {id:k,name:map.posts[k].name,role:""}; });
  src.forEach(function(p,i){
    var post=postFor(p.id,p.name); if(!post&&p.post&&typeof p.post.x==="number") post=p.post;
    if(!post){ var fall=[[20,6],[33,6],[22,14],[28,18],[19,27],[33,26]][i%6]; post={x:fall[0],y:fall[1],wander:[[fall[0]+1,fall[1]]]}; }
    var pk=post.x+","+post.y; if(seen[pk]) return; seen[pk]=1;
    var n={id:p.id,name:p.name||post.name||p.id,role:p.role||"",x:(post.x+0.5)*T,y:(post.y+0.5)*T,dir:"down",frame:4,
      home:post,wander:[[post.x,post.y]].concat(post.wander||[]),path:null,pi:0,timer:1+Math.random()*4,state:"idle",walkT:Math.random()*4,walkT0:Math.random()*2,talking:false};
    out.push(n); byNorm[norm(p.id)]=n;
  });
  return out;
}

/* ---------- player ---------- */
var pl={x:(map.spawn.x)*T,y:(map.spawn.y)*T,dir:"down",frame:4,walkT:0,path:null,pi:0,pending:null,stuck:0};

/* ---------- DOM ---------- */
var canvas=el("canvas","kw-canvas"); canvas.tabIndex=0; canvas.setAttribute("role","application");
canvas.setAttribute("aria-label","K13 Studio, an interactive room. Arrows or WASD walk, E uses what is near. A list version of everything is one button away: Prefer a list.");
canvas.setAttribute("aria-describedby","kwLive");
var ctx=canvas.getContext("2d");
var prompt=el("div","kw-prompt"); prompt.hidden=true;
var pKey=el("span","kw-key","E"), pTx=el("span","kw-ptx"); prompt.appendChild(pKey); prompt.appendChild(pTx);
var say=el("div","kw-say"); say.hidden=true; say.setAttribute("role","group");
var sayFace=el("canvas","kw-say-face"); sayFace.width=32; sayFace.height=48; sayFace.setAttribute("aria-hidden","true");
var sayBody=el("div","kw-say-body"), sayName=el("b","kw-say-name"), sayRole=el("span","kw-say-role"), sayText=el("p","kw-say-text"), sayNext=el("button","kw-say-next","Next");
sayNext.type="button";
var sayCtaEl=el("a","kw-say-cta"); sayCtaEl.hidden=true;
var sayHead=el("div","kw-say-head"); sayHead.appendChild(sayName); sayHead.appendChild(sayRole);
sayBody.appendChild(sayHead); sayBody.appendChild(sayText);
say.appendChild(sayFace); say.appendChild(sayBody); say.appendChild(sayCtaEl); say.appendChild(sayNext);
var useBtn=el("button","kw-use","Use"); useBtn.type="button"; useBtn.hidden=true;
var toast=el("div","kw-toast"); toast.setAttribute("role","status"); toast.setAttribute("aria-live","polite");
var helpPanel=el("div","kw-help"); helpPanel.id="kwHelpPanel"; helpPanel.hidden=true;
helpPanel.innerHTML="<h2 class=\"kw-help-h\">How to get around</h2><ul class=\"kw-help-l\">"+
  "<li><b>Walk</b> with the arrow keys or WASD, or tap or click a spot.</li>"+
  "<li><b>Use</b> what is near with E, Enter or Space, or tap it.</li>"+
  "<li><b>Machines</b> hold the games, benches hold the toys. Esc closes one.</li>"+
  "<li><b>Go to</b> (or G) jumps to any room or place on the map, or starts a game straight away.</li>"+
  "<li><b>Crew</b> will talk if you stand next to them.</li>"+
  "<li><b>Doors</b> lead out to the street and into every shop. The <b>K13 van</b> at a bus stop takes you up and down the coast.</li>"+
  "<li><b>The map</b> in the corner shows where you are. Tap it to walk there.</li>"+
  "<li><b>13 secrets</b> hide in the details. Look at everything.</li></ul>";
var helpClose=el("button","kw-help-x","Got it"); helpClose.type="button"; helpPanel.appendChild(helpClose);
var pad=el("div","kw-pad"); pad.hidden=true; pad.setAttribute("role","group"); pad.setAttribute("aria-label","Keypad");
stageEl.appendChild(canvas); stageEl.appendChild(prompt); stageEl.appendChild(toast); stageEl.appendChild(say); stageEl.appendChild(useBtn); stageEl.appendChild(helpPanel); stageEl.appendChild(pad);

var barPlace=$("kwPlace"), barChip=$("kwChip"), barN=$("kwSecN"), barHelp=$("kwHelp"), barList=$("kwList"), live=$("kwLive"), hint=$("kwHint"), mainEl=$("main");
var kwSection=$("kw");
var coarse=false; try{ coarse=window.matchMedia("(pointer: coarse)").matches; }catch(e){}
pKey.textContent=coarse?"Tap":"E";

/* ---------- sizing ---------- */
var S=3, cssW=0, cssH=0, vw=0, vh=0, lightC=null, lightX=null, camX=0, camY=0, camSet=false;
function resize(){
  var r=stageEl.getBoundingClientRect(); cssW=Math.max(1,Math.round(r.width)); cssH=Math.max(1,Math.round(r.height));
  var dpr=clamp(Math.round(window.devicePixelRatio||1),1,2);
  var fitS=(cur&&cur.kind==="shop")?Math.floor(Math.min(cssW/(MW*T),cssH/(MH*T))):0;
  var cs=clamp(Math.max(Math.round(cssW/440),fitS),2,5);
  S=cs*dpr;
  canvas.width=cssW*dpr; canvas.height=cssH*dpr;
  vw=Math.ceil(canvas.width/S); vh=Math.ceil(canvas.height/S);
  lightC=mk(vw,vh); lightX=lightC.getContext("2d");
  camSet=false; draw.dirty=true;
}

/* ---------- static tile layer ---------- */
var WALLPAL={
  lobby:   {up:"#EBDFC4",lo:"#8A5A3B",lo2:"#7D5136",rail:"#5E3B26",hi:"#F6EEDC",line:"#DCCFB1"},
  lounge:  {up:"#5E9F92",lo:"#8A5A3B",lo2:"#7D5136",rail:"#5E3B26",hi:"#7CB8AB",line:"#55948A"},
  studio:  {up:"#DDE1EC",lo:"#5D5F65",lo2:"#54565C",rail:"#414347",hi:"#F3F5FA",line:"#CED3DF"},
  arcade:  {up:"#34363B",lo:"#26272B",lo2:"#222327",rail:"#1A1B1E",hi:"#4A4C52",line:"#2D2F34"},
  workshop:{up:"#A67A50",lo:"#6A4630",lo2:"#5E3F2B",rail:"#4A2F20",hi:"#BC8F63",line:"#94693F"},
  backroom:{up:"#2A2C31",lo:"#1F2023",lo2:"#1B1C1F",rail:"#414347",hi:"#3A3C42",line:"#222428"}
};
function floorStyleAt(tx,ty){
  var r=roomAtTile(tx,ty); if(r) return r.id;
  var n=[[0,1],[1,0],[0,-1],[-1,0]];
  for(var i=0;i<4;i++){ var rr=roomAtTile(tx+n[i][0],ty+n[i][1]); if(rr) return rr.id; }
  return "lobby";
}
function paintFloor(c,style,tx,ty,X,Y){
  var i,r;
  if(style==="lobby"){
    fr(c,((tx+ty)&1)?"#DCCAAB":"#D3BF9E",X,Y,16,16);
    fr(c,"#C2AC88",X,Y,16,1); fr(c,"#C2AC88",X,Y,1,16);
    fr(c,"rgba(255,255,255,.22)",X+1,Y+1,14,1);
    for(i=0;i<3;i++){ r=hash(tx,ty,i+1); if(r<.5) fr(c,"#C9B592",X+((hash(tx,ty,i+9)*14)|0)+1,Y+((hash(tx,ty,i+5)*14)|0)+1,1,1); }
  }else if(style==="lounge"||style==="workshop"){
    var tones=style==="lounge"?["#C4A27A","#BC9A72","#CBA980","#B5936B"]:["#8A5A3B","#7E5236","#93613F","#74492F"];
    var seam=style==="lounge"?"#9A7A58":"#5E3B26";
    for(var q=0;q<4;q++){
      var R=ty*4+q, off=(hash(0,R,3)*32)|0, px0=tx*T+off, pid=Math.floor(px0/32);
      fr(c,tones[(hash(pid,R,4)*tones.length)|0],X,Y+q*4,16,4);
      fr(c,seam,X,Y+q*4+3,16,1);
      var m=px0%32; if(m<16){ fr(c,seam,X+(16-m)%16===0?X:X+16-m-(0),Y+q*4,1,3); }
      if(hash(tx,R,6)<.18) fr(c,"rgba(0,0,0,.12)",X+((hash(tx,R,8)*11)|0)+2,Y+q*4+1,3,1);
    }
    if(style==="workshop"){
      for(i=0;i<4;i++) if(hash(tx,ty,20+i)<.5) fr(c,"rgba(246,238,220,.55)",X+((hash(tx,ty,30+i)*15)|0),Y+((hash(tx,ty,40+i)*15)|0),1,1);
      if(hash(tx,ty,60)<.07){ fr(c,"rgba(0,0,0,.2)",X+3,Y+5,8,5); fr(c,"rgba(0,0,0,.12)",X+5,Y+4,5,7); }
    }
  }else if(style==="studio"){
    fr(c,((tx+ty)&1)?"#8D939E":"#868C97",X,Y,16,16);
    fr(c,"#7B818C",X,Y,16,1); fr(c,"#7B818C",X,Y,1,16);
    for(i=0;i<5;i++) if(hash(tx,ty,i)<.6) fr(c,hash(tx,ty,i+7)<.5?"#979DA8":"#7F8590",X+((hash(tx,ty,i+11)*15)|0),Y+((hash(tx,ty,i+17)*15)|0),1,1);
  }else if(style==="arcade"){
    fr(c,"#26272B",X,Y,16,16); fr(c,"#2B2C31",X+((tx&1)?8:0),Y,8,8); fr(c,"#2B2C31",X+((tx&1)?0:8),Y+8,8,8);
    r=hash(tx,ty,2);
    if(r<.55){
      var mx=X+((hash(tx,ty,3)*10)|0)+2, my=Y+((hash(tx,ty,4)*10)|0)+2, k=(hash(tx,ty,5)*4)|0;
      if(k===0){ fr(c,"rgba(234,94,20,.75)",mx,my,2,2); }
      else if(k===1){ fr(c,"rgba(79,158,146,.75)",mx,my,1,1); fr(c,"rgba(79,158,146,.75)",mx+1,my+1,1,1); fr(c,"rgba(79,158,146,.75)",mx+2,my,1,1); }
      else if(k===2){ fr(c,"rgba(240,180,41,.75)",mx,my,3,1); fr(c,"rgba(240,180,41,.75)",mx+1,my-1,1,3); }
      else{ fr(c,"rgba(243,245,250,.28)",mx,my,1,1); fr(c,"rgba(243,245,250,.28)",mx+3,my+2,1,1); }
    }
  }else{ /* backroom */
    fr(c,"#1E2024",X,Y,16,16); fr(c,"#2B2D32",X,Y,16,1); fr(c,"#2B2D32",X,Y,1,16);
    fr(c,"rgba(234,94,20,.5)",X,Y,1,1);
    if(hash(tx,ty,3)<.2) fr(c,"rgba(255,255,255,.05)",X+4,Y+4,8,8);
  }
}
function paintWallFace(c,pal,tx,ty,X,Y,lower,topStrip){
  var i;
  if(!lower){
    fr(c,pal.up,X,Y,16,16);
    fr(c,pal.line,X,Y+15,16,1);
    if(pal===WALLPAL.workshop||pal===WALLPAL.arcade){ for(i=0;i<16;i+=8) fr(c,pal.line,X+i,Y,1,16); }
    else if(hash(tx,ty,3)<.5) fr(c,pal.hi,X+((hash(tx,ty,4)*14)|0),Y+((hash(tx,ty,5)*10)|0)+2,2,1);
    if(topStrip){ fr(c,"#1F2023",X,Y,16,4); fr(c,"#4A4C52",X,Y,16,1); fr(c,"rgba(0,0,0,.22)",X,Y+4,16,2); }
  }else{
    fr(c,pal.up,X,Y,16,5); fr(c,pal.rail,X,Y+4,16,2); fr(c,pal.hi,X,Y+4,16,1);
    fr(c,pal.lo,X,Y+6,16,10); for(i=0;i<16;i+=8){ fr(c,pal.lo2,X+i,Y+7,1,9); fr(c,"rgba(255,255,255,.08)",X+i+1,Y+7,1,9); }
    fr(c,pal.rail,X,Y+14,16,2);
    fr(c,"rgba(0,0,0,.14)",X,Y+6,16,1);
  }
}
function paintCap(c,tx,ty,X,Y){
  fr(c,"#2B2C30",X,Y,16,16);
  if(!tileOpen(tx,ty-1)&&(ty===0||rows[ty-1][tx]===" ")) fr(c,"#4A4C52",X,Y,16,2);
  if(tileOpen(tx-1,ty)) fr(c,"#44464B",X,Y,1,16);
  if(tileOpen(tx+1,ty)) fr(c,"#44464B",X+15,Y,1,16);
  if(hash(tx,ty,9)<.3) fr(c,"#34363B",X+3,Y+6,5,2);
}
function renderTiles(){
  var c=tileC.getContext("2d"); c.clearRect(0,0,tileC.width,tileC.height);
  var tx,ty,X,Y,ch,i;
  for(ty=0;ty<MH;ty++) for(tx=0;tx<MW;tx++){
    X=tx*T; Y=ty*T; ch=rows[ty][tx];
    if(ch===" "){ fr(c,"#16181B",X,Y,16,16); if(hash(tx,ty,1)<.3) fr(c,"#1E2420",X+((hash(tx,ty,2)*13)|0),Y+((hash(tx,ty,3)*13)|0),2,1); continue; }
    if(ch==="."||ch==="d"){
      var st=floorStyleAt(tx,ty); paintFloor(c,st,tx,ty,X,Y);
      var north=rows[ty-1]&&rows[ty-1][tx];
      if(north==="#"&&!(ty>1&&false)){ fr(c,"rgba(0,0,0,.24)",X,Y,16,3); fr(c,"rgba(0,0,0,.1)",X,Y+3,16,2); }
      if(rows[ty][tx-1]==="#") fr(c,"rgba(0,0,0,.2)",X,Y,3,16);
      if(rows[ty][tx+1]==="#") fr(c,"rgba(0,0,0,.2)",X+13,Y,3,16);
      continue;
    }
    /* wall: face when a floor sits one or two rows south, otherwise a cap */
    var s1=rows[ty+1]&&rows[ty+1][tx], s2=rows[ty+2]&&rows[ty+2][tx];
    if(s1==="."||s1==="d"){ var rm=floorStyleAt(tx,ty+1); paintWallFace(c,WALLPAL[rm]||WALLPAL.lobby,tx,ty,X,Y,true,false); }
    else if(s1==="#"&&(s2==="."||s2==="d")){ var rm2=floorStyleAt(tx,ty+2); var n0=rows[ty-1]&&rows[ty-1][tx]; paintWallFace(c,WALLPAL[rm2]||WALLPAL.lobby,tx,ty,X,Y,false,n0==="."||n0==="d"); }
    else paintCap(c,tx,ty,X,Y);
  }
  /* door frames: posts at both ends of every doorway */
  for(ty=0;ty<MH;ty++) for(tx=0;tx<MW;tx++){
    if(rows[ty][tx]!=="d") continue; X=tx*T; Y=ty*T;
    var horiz=rows[ty][tx-1]==="#"||rows[ty][tx+1]==="#";   /* a gap in a wall that runs north-south has walls above and below instead */
    var vertWall=rows[ty-1][tx]==="#"&&rows[ty+1]&&(rows[ty+1][tx]==="#"||rows[ty+1][tx]==="d")&&rows[ty][tx-1]!=="#"&&rows[ty][tx+1]!=="#";
    if(rows[ty-1][tx]==="#"&&rows[ty][tx-1]!=="#"&&rows[ty][tx+1]!=="#"&&!(rows[ty-1][tx-1]==="." )){ fr(c,"#5E3B26",X,Y,16,2); fr(c,"#8A5A3B",X,Y+2,16,1); }
    if(rows[ty+1]&&rows[ty+1][tx]==="#"&&rows[ty][tx-1]!=="#"&&rows[ty][tx+1]!=="#"){ fr(c,"#5E3B26",X,Y+13,16,3); fr(c,"#8A5A3B",X,Y+12,16,1); }
    if(horiz&&!vertWall){ if(rows[ty][tx-1]==="#") fr(c,"#5E3B26",X,Y,2,16); if(rows[ty][tx+1]==="#") fr(c,"#5E3B26",X+14,Y,2,16); }
  }
  /* the welcome mat */
  [30,31].forEach(function(my){ [25,26].forEach(function(mx){ var X=mx*T, Y=my*T; fr(c,"#6B4A32",X,Y,16,16); fr(c,"#7D5A3E",X+1,Y+1,14,14); for(var q=0;q<5;q++) fr(c,"#5E3F29",X+2+((hash(mx,my,q)*11)|0),Y+2+((hash(mx,my,q+9)*11)|0),2,1); }); });
  fr(c,"#F0B429",25*T,30*T,32,1); fr(c,"#F0B429",25*T,32*T-1,32,1); fr(c,"#F0B429",25*T,30*T,1,32); fr(c,"#F0B429",27*T-1,30*T,1,32);
  /* the entrance: the front door, with the street light on the other side */
  [25,26].forEach(function(dx,i){ var X=dx*T, Y=(MH-2)*T; paintFloor(c,"lobby",dx,MH-2,X,Y); fr(c,"#2B2C30",X,Y,16,16);
    fr(c,"#3E5560",X+(i?0:2),Y+2,i?14:14,12); fr(c,"rgba(255,255,255,.12)",X+(i?0:2),Y+2,i?14:14,2);
    fr(c,"#5E3B26",X+(i?14:0),Y,2,16); fr(c,"#5E3B26",X,Y,16,2); fr(c,"#5E3B26",X,Y+14,16,2); });
}

/* ---------- time, theme ---------- */
var dark=html.getAttribute("data-theme")==="dark", skyNight=false, skyPhase="day", skyDk=0, skyTint="";
try{ new MutationObserver(function(){ var d=html.getAttribute("data-theme")==="dark"; if(d!==dark){ dark=d; updateSky(); bakeAll(); } }).observe(html,{attributes:true,attributeFilter:["data-theme"]}); }catch(e){}

/* ---------- movement ---------- */
var keys={};
function dirOf(dx,dy,old){ if(!dx&&!dy) return old; return Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down"); }
function npcBlocks(px,py){
  for(var i=0;i<npcs.length;i++){ var n=npcs[i], dx=n.x-px, dy=n.y-py, d2=dx*dx+dy*dy;
    if(d2<81){ var ox=n.x-pl.x, oy=n.y-pl.y; if(d2<ox*ox+oy*oy) return true; } }
  return false;
}
function stepPlayer(dx,dy){
  var moved=false, nx=pl.x+dx, ny=pl.y+dy;
  if(dx&&!boxHit(nx,pl.y)&&!npcBlocks(nx,pl.y)){ pl.x=nx; moved=true; }
  if(dy&&!boxHit(pl.x,ny)&&!npcBlocks(pl.x,ny)){ pl.y=ny; moved=true; }
  return moved;
}
function nearestFree(tx,ty,maxR){
  if(tx<0||ty<0||tx>=MW||ty>=MH) return null;
  if(!blk[ty*MW+tx]) return [tx,ty];
  for(var rad=1;rad<=(maxR||3);rad++) for(var yy=ty-rad;yy<=ty+rad;yy++) for(var xx=tx-rad;xx<=tx+rad;xx++) if(xx>=0&&yy>=0&&xx<MW&&yy<MH&&!blk[yy*MW+xx]) return [xx,yy];
  return null;
}
function walkTo(tx,ty,pending,maxR){
  var g=nearestFree(tx,ty,maxR); if(!g) return false;
  var sx=Math.floor(pl.x/T), sy=Math.floor(pl.y/T);
  if(blk[sy*MW+sx]){ var f=nearestFree(sx,sy); if(!f) return false; sx=f[0]; sy=f[1]; }
  var p=(sx===g[0]&&sy===g[1])?[]:findPath(sx,sy,g[0],g[1]); if(!p) return false;
  pl.path=smooth(pl.x,pl.y,p); pl.pi=0; pl.pending=pending||null; pl.stuck=0;
  return true;
}
function ringTiles(x0,y0,x1,y1){ /* free tiles touching a tile rectangle */
  var out=[], x, y;
  for(y=y0-1;y<=y1+1;y++) for(x=x0-1;x<=x1+1;x++){ if(x>=x0&&x<=x1&&y>=y0&&y<=y1) continue; if(x<0||y<0||x>=MW||y>=MH||blk[y*MW+x]) continue; out.push([x,y]); }
  return out;
}
function walkNear(x0,y0,x1,y1,pending){
  var sx=Math.floor(pl.x/T), sy=Math.floor(pl.y/T), best=null, cand=ringTiles(x0,y0,x1,y1), i;
  cand.sort(function(a,b){ return (Math.abs(a[0]-sx)+Math.abs(a[1]-sy))-(Math.abs(b[0]-sx)+Math.abs(b[1]-sy)); });
  for(i=0;i<cand.length&&i<8;i++){ var p=(cand[i][0]===sx&&cand[i][1]===sy)?[]:findPath(sx,sy,cand[i][0],cand[i][1]); if(p&&(!best||p.length<best.p.length)) best={p:p,g:cand[i]}; }
  if(!best) return false;
  pl.path=smooth(pl.x,pl.y,best.p); pl.pi=0; pl.pending=pending||null; pl.stuck=0; return true;
}

/* ---------- targets ---------- */
var target=null, lastTargetKey="";
function rectDist(px,py,x0,y0,w,h){ var dx=Math.max(x0-px,0,px-(x0+w)), dy=Math.max(y0-py,0,py-(y0+h)); return Math.sqrt(dx*dx+dy*dy); }
function faceVec(d){ return d==="left"?[-1,0]:d==="right"?[1,0]:d==="up"?[0,-1]:[0,1]; }
function findTarget(){
  var best=null, bs=1e9, fv=faceVec(pl.dir), i, d, sc, cx, cy, L, dot;
  for(i=0;i<npcs.length;i++){ var n=npcs[i]; d=Math.sqrt((n.x-pl.x)*(n.x-pl.x)+(n.y-pl.y)*(n.y-pl.y)); if(d>24) continue;
    L=d||1; dot=((n.x-pl.x)*fv[0]+(n.y-pl.y)*fv[1])/L; sc=d-(dot>.4?6:0)-4; if(sc<bs){ bs=sc; best={kind:"npc",n:n}; } }
  for(i=0;i<objs.length;i++){ var r=objs[i]; if(!r.o.act||r.hidden) continue;
    d=rectDist(pl.x,pl.y,r.fx,r.fy,r.fw,r.fhp); if(d>11) continue;
    cx=r.fx+r.fw/2; cy=r.fy+r.fhp/2; L=Math.sqrt((cx-pl.x)*(cx-pl.x)+(cy-pl.y)*(cy-pl.y))||1; dot=((cx-pl.x)*fv[0]+(cy-pl.y)*fv[1])/L;
    sc=d-(dot>.4?5:0); if(sc<bs){ bs=sc; best={kind:"obj",r:r}; } }
  return best;
}
function cardFor(r){ var o=r.o; return o.act==="game"?$("g-"+o.game):(o.act==="toy"?$("t-"+o.toy):null); }
function objTitle(r){
  var o=r.o; if(o.title) return o.title;
  if(o.act==="game"){ for(var i=0;i<map.games.length;i++) if(map.games[i].id===o.game) return map.games[i].title; }
  if(o.act==="toy"){ if(!r.title){ var c=cardFor(r), t=c&&c.querySelector(".wb-title"); r.title=t?t.textContent.replace(/\s+/g," ").trim():""; } return r.title||"Workbench"; }
  var s=o.id.replace(/-\d+$/,"").replace(/-/g," "); return s.charAt(0).toUpperCase()+s.slice(1);
}
function targetLabel(t){
  if(t.kind==="npc") return "Talk to "+t.n.name.split(" (")[0];
  var o=t.r.o;
  if(o.act==="game"||o.act==="toy") return "Play "+objTitle(t.r);
  if(o.id==="door-back"&&state.backOpen) return "Step in";
  return o.label||"Look";
}
function targetName(t){ return t.kind==="npc"?t.n.name:objTitle(t.r); }

/* ---------- secrets glue ---------- */
function foundCount(){ var S=NS.secrets; if(S&&typeof S.count==="function"){ try{ return S.count(state); }catch(e){} } var n=0,k; for(k in state.found) if(state.found[k]) n++; return n; }
function totalSecrets(){ var S=NS.secrets; return (S&&S.total)||(S&&S.list&&S.list.length)||13; }
var toastT=0;
function showToast(msg,ms){
  toast.textContent=msg; toast.classList.remove("kw-on"); void toast.offsetWidth; toast.classList.add("kw-on");
  clearTimeout(toastT); toastT=setTimeout(function(){ toast.classList.remove("kw-on"); },ms||3600);
}
function updateChip(pulse){
  var n=foundCount();
  if(barN) barN.textContent=String(n);
  if(barChip){ var tt=barChip.querySelector("[data-kw-total]"); if(tt) tt.textContent=String(totalSecrets()); barChip.hidden=(n===0)||state.list;
    if(pulse&&!reduced){ barChip.classList.remove("kw-pulse"); void barChip.offsetWidth; barChip.classList.add("kw-pulse"); } }
}
/* secrets.js mutates the state itself; the engine reads the reply, saves, and makes the change visible */
function absorb(r,quiet){
  if(!r||typeof r!=="object"){ updateChip(false); return; }
  if(r.found){ save(); updateChip(true); if(!quiet) showToast("Secret "+foundCount()+"/"+totalSecrets()+": "+(r.title||r.found),4200); }
  if(r.give){ var it=typeof r.give==="string"?r.give:(r.give.name||r.give.id||""); if(it){ if(state.items.indexOf(it)<0) state.items.push(it); save(); if(!r.found&&!quiet) showToast("You took: "+it); else if(r.found&&!quiet) showToast("Secret "+foundCount()+"/"+totalSecrets()+": "+(r.title||r.found)+". You took: "+it,4600); } }
  if(r.reveal){ state.flags.revealed=true; save(); var cs=hq.objById["cab-secret"]; if(cs){ cs.spr=null; if(cur===hq) bakeObject(cs,performance.now()); } }
  if(r.open==="door-back"){ openBack(true); }
  updateChip(false);
}
function ask(objId){
  var S=NS.secrets, r=null;
  if(S&&typeof S.onInteract==="function"){ try{ r=S.onInteract(objId,state); }catch(e){ r=null; } }
  absorb(r); checkFinale(); return r;
}

/* ---------- dialogue ---------- */
var sayPages=[], sayI=0, sayDone=null, sayOpen=false, sayNpc=null, sayBase=null, sayCta=null;
function drawFace(id){
  var f=sayFace.getContext("2d"); f.imageSmoothingEnabled=false; f.clearRect(0,0,32,48);
  if(!id){ sayFace.hidden=true; return; }
  sayFace.hidden=false; var P=peopleApi();
  if(P&&typeof P.portrait==="function"){ try{ P.portrait(f,id,0,8,1); return; }catch(e){} }
  f.drawImage(personSprite(id,"down",4),0,0,16,24,0,0,32,48);
}
function openSay(name,role,pages,faceId,onDone,npc){
  sayPages=pages.length?pages:["..."]; sayI=0; sayBase={name:name,role:role,face:faceId}; sayDone=onDone||null; sayOpen=true; sayNpc=npc||null;
  sayName.textContent=name; sayRole.textContent=role||""; sayRole.hidden=!role; drawFace(faceId);
  say.hidden=false; useBtn.hidden=true; prompt.hidden=true; showPage();
  pl.path=null; pl.pending=null;
}
function showPage(){
  var pg=sayPages[sayI], txt=typeof pg==="string"?pg:pg.say;
  if(typeof pg==="object"&&pg.name){ sayName.textContent=pg.name; sayRole.textContent=""; sayRole.hidden=true; drawFace(pg.who||null); }
  else if(sayBase&&sayI===0){ sayName.textContent=sayBase.name; sayRole.textContent=sayBase.role||""; sayRole.hidden=!sayBase.role; drawFace(sayBase.face); }
  var last=sayI>=sayPages.length-1;
  sayCtaEl.hidden=!(last&&sayCta); if(last&&sayCta){ sayCtaEl.textContent=sayCta.label; sayCtaEl.href=sayCta.href; }
  sayText.textContent=txt; sayNext.textContent=last?"Done":"Next";
  say.classList.remove("kw-on"); void say.offsetWidth; say.classList.add("kw-on");
  if(live) live.textContent=sayName.textContent+": "+txt;
}
function advanceSay(){
  if(!sayOpen) return;
  if(sayI<sayPages.length-1){ sayI++; showPage(); return; }
  closeSay();
}
function closeSay(){
  if(!sayOpen) return; sayOpen=false; say.hidden=true; sayCta=null; sayCtaEl.hidden=true;
  if(sayNpc){ sayNpc.talking=false; sayNpc=null; }
  var cb=sayDone; sayDone=null; lastTargetKey="";
  if(cb) cb();
}
sayNext.addEventListener("click",function(){ advanceSay(); try{ canvas.focus({preventScroll:true}); }catch(e){} });

function asPages(v){
  if(!v) return [];
  if(typeof v==="string") return [v];
  if(Array.isArray(v)) return v.filter(function(s){ return typeof s==="string"&&s; });
  if(v.lines) return v.lines.map(function(l){ return l&&l.say?{name:l.name,who:l.who,say:l.say}:l; }).filter(Boolean);
  if(v.say) return asPages(v.say);
  return [];
}
function talkTo(n){
  var P=NS.people, S=NS.secrets, pages=[];
  if(P&&typeof P.lines==="function"){ try{ pages=asPages(P.lines(n.id,state)); }catch(e){ pages=[]; } }
  if(!pages.length){ pages=["Hi, I am "+n.name.split(" (")[0]+".","Welcome to K13 Studio. Look around and poke at things."];
    if(S&&typeof S.hintFor==="function"){ try{ var h=S.hintFor(n.id,state); if(typeof h==="string"&&h) pages.push(h); }catch(e){} } }
  if(S&&typeof S.onTalk==="function"){ try{ var tr=S.onTalk(n.id,state); if(tr&&tr.say){ pages.push(tr.say); absorb(tr,true); if(tr.found) showToast("Secret "+foundCount()+"/"+totalSecrets()+": "+(tr.title||tr.found),4200); } }catch(e){} }
  else state.talked[n.id]=true;
  save(); checkFinale();
  n.talking=true; n.dir=dirOf(pl.x-n.x,pl.y-n.y,n.dir); n.frame=4; n.path=null;
  openSay(n.name,n.role,pages,n.id,null,n);
}

/* ---------- the machine (modal) ---------- */
var dlg=el("dialog","kw-cab"); dlg.setAttribute("aria-labelledby","kwCabT");
var cabFrame=el("div","kw-cab-frame"), cabTop=el("div","kw-cab-top"), cabMq=el("div","kw-cab-mq"), cabT=el("h2","kw-cab-title"); cabT.id="kwCabT"; cabT.tabIndex=-1;
var cabX=el("button","kw-cab-x"); cabX.type="button"; cabX.innerHTML="Close <kbd>Esc</kbd>";
var cabBody=el("div","kw-cab-body"), slot=el("div","bench kw-slot");
cabTop.appendChild(cabMq); cabTop.appendChild(cabT); cabTop.appendChild(cabX); cabBody.appendChild(slot); cabFrame.appendChild(cabTop); cabFrame.appendChild(cabBody); dlg.appendChild(cabFrame);
doc.body.appendChild(dlg);
var modal=null;   /* {card, parent, next, r} */
function marqueeFor(r){
  cabMq.textContent=""; var D=NS.decor, m=null;
  if(D&&typeof D.marquee==="function"&&r.o.game){ try{ m=D.marquee(r.o.game); }catch(e){ m=null; } }
  if(m&&m.nodeType===1&&(m.tagName==="CANVAS"||m.tagName==="IMG"||m.tagName==="SVG")){ m.classList.add("kw-cab-mqc"); m.setAttribute("aria-hidden","true"); cabMq.appendChild(m); cabMq.hidden=false; }
  else cabMq.hidden=true;
}
function openModal(r,after){
  var card=cardFor(r);
  if(!card){ openSay(objTitle(r),"",["This one is still warming up. The list version has everything: use Prefer a list above."],null,null); return; }
  if(modal) return;
  var placeNote=doc.createComment("kw"); card.parentNode.insertBefore(placeNote,card);
  modal={card:card,note:placeNote,r:r,after:after||null,from:card.parentNode};
  slot.appendChild(card); card.classList.add("in");
  cabT.textContent=objTitle(r); dlg.classList.toggle("kw-cab-toy",r.o.act==="toy"); marqueeFor(r);
  try{ if(dlg.showModal) dlg.showModal(); else dlg.setAttribute("open",""); }catch(e){ dlg.setAttribute("open",""); }
  prompt.hidden=true; useBtn.hidden=true; sync();
  var fire=function(){ try{ window.dispatchEvent(new Event("resize")); }catch(e){} };
  requestAnimationFrame(function(){ fire(); requestAnimationFrame(function(){ fire(); setTimeout(fire,120); }); });
  setTimeout(function(){
    if(!modal) return;
    var cv=modal.card.querySelector("canvas[tabindex]"); try{ (cv||cabX).focus({preventScroll:true}); }catch(e){}
  },60);
}
function closeModal(){
  if(!modal) return;
  var m=modal; modal=null;
  try{ if(dlg.open&&dlg.close) dlg.close(); else dlg.removeAttribute("open"); }catch(e){ dlg.removeAttribute("open"); }
  if(m.note.parentNode){ m.note.parentNode.insertBefore(m.card,m.note); m.note.parentNode.removeChild(m.note); } else m.from.appendChild(m.card);
  cabMq.textContent="";
  try{ window.dispatchEvent(new Event("resize")); }catch(e){}
  sync(); draw.dirty=true; lastTargetKey="";
  try{ canvas.focus({preventScroll:true}); }catch(e){}
  if(m.after) m.after();
}
cabX.addEventListener("click",closeModal);
dlg.addEventListener("cancel",function(e){ e.preventDefault(); closeModal(); });
dlg.addEventListener("click",function(e){ if(e.target===dlg) closeModal(); });
window.addEventListener("keydown",function(e){ if(e.key==="Escape"){ if(modal){ e.preventDefault(); closeModal(); } else if(vanOpen){ e.preventDefault(); closeVan(); } } },true);

/* ---------- keypad ---------- */
var padCode="", padShow=el("div","kw-pad-show"), padMsg=el("p","kw-pad-msg"), padKeys=el("div","kw-pad-keys"), padX=el("button","kw-pad-x","Close");
padX.type="button";
pad.appendChild(padShow); pad.appendChild(padKeys); pad.appendChild(padMsg); pad.appendChild(padX);
["1","2","3","4","5","6","7","8","9","Clear","0","Enter"].forEach(function(k){
  var b=el("button","kw-pad-k"+(k.length>1?" kw-pad-w":""),k); b.type="button"; b.setAttribute("data-k",k); padKeys.appendChild(b);
});
function padRender(){ padShow.textContent=padCode||"----"; padShow.classList.toggle("kw-dim",!padCode); }
var padMax=4;
function openPad(r0){
  if(sayOpen) closeSay(); padCode=""; padMax=(r0&&r0.maxLength)||4;
  padMsg.textContent=(r0&&r0.say)||"Type the code, then Enter."; padShow.setAttribute("aria-label",(r0&&r0.label)||"Code");
  padRender(); pad.hidden=false; useBtn.hidden=true; prompt.hidden=true;
  setTimeout(function(){ try{ padKeys.querySelector("button").focus({preventScroll:true}); }catch(e){} },30);
}
function closePad(){ if(pad.hidden) return; pad.hidden=true; delete state.input; try{ canvas.focus({preventScroll:true}); }catch(e){} }
function submitCode(){
  if(!padCode){ padMsg.textContent="Type the code first."; return; }
  var S=NS.secrets, r=null; state.input=padCode;
  if(S&&typeof S.onInteract==="function"){ try{ r=S.onInteract("keypad",state); }catch(e){ r=null; } }
  delete state.input; padCode=""; padRender();
  var msg=(r&&r.say)||"Nothing happens. Try another code.";
  if(r&&r.found){ absorb(r); padMsg.textContent=msg; pad.hidden=true; try{ canvas.focus({preventScroll:true}); }catch(e){} openSay("Keypad","",[msg],null,null); checkFinale(); return; }
  absorb(r); padMsg.textContent=msg;
}
padKeys.addEventListener("click",function(e){
  var b=e.target.closest&&e.target.closest("button"); if(!b) return; var k=b.getAttribute("data-k");
  if(k==="Clear"){ padCode=""; padRender(); } else if(k==="Enter") submitCode(); else if(padCode.length<padMax){ padCode+=k; padRender(); }
});
padX.addEventListener("click",closePad);
pad.addEventListener("keydown",function(e){
  if(e.key==="Escape"){ e.preventDefault(); closePad(); }
  else if(/^[0-9]$/.test(e.key)&&padCode.length<padMax){ padCode+=e.key; padRender(); e.preventDefault(); }
  else if(e.key==="Enter"&&e.target===pad){ e.preventDefault(); submitCode(); }
  else if(e.key==="Backspace"){ padCode=padCode.slice(0,-1); padRender(); e.preventDefault(); }
});

/* ---------- the back room ---------- */
var eye=null;
function openBack(announce){
  if(state.backOpen&&!announce) return;
  var was=state.backOpen; state.backOpen=true; save(); setBackDoor(true);
  var d=hq.objById["door-back"]; if(d){ d.spr=null; if(cur===hq) bakeObject(d,performance.now()); }
  var keepI=cur; if(keepI!==hq) useInst(hq); buildBlocked(); renderTiles(); if(keepI!==hq) useInst(keepI); draw.dirty=true;
  if(announce&&!was&&cur===hq){
    var tx=(map.backDoor[0][0]+1)*T, ty=(map.backDoor[0][1]+1)*T;
    eye={x:tx,y:ty+T,until:performance.now()+(reduced?600:2200)};
    showToast("The War Room is open.");
  }
}
function checkFinale(){
  if(state.flags.finale||foundCount()<totalSecrets()) return;
  state.flags.finale=true; save();
  var S=NS.secrets, r=null; if(S&&typeof S.finale==="function"){ try{ r=S.finale(state); }catch(e){ r=null; } }
  openBack(true);
  var pages=asPages(r); if(!pages.length) pages=["All 13 found. The door to the War Room is open."];
  var cta=r&&r.cta&&r.cta.href?{label:r.cta.label||"Start a project",href:r.cta.href}:null;
  var run=function(){ if(sayOpen||modal||!pad.hidden){ setTimeout(run,800); return; } openSay("Thirteen of thirteen","",pages,null,null); sayCta=cta; showPage(); };
  setTimeout(run,reduced?300:1600);
}

/* ---------- interaction ---------- */
function interact(t){
  if(!t||ui()||!pad.hidden||busy) return;
  if(sayOpen){ advanceSay(); return; }
  if(t.kind==="npc"){ talkTo(t.n); return; }
  var r=t.r, o=r.o, res;
  if(o.act==="game"||o.act==="toy"){
    res=ask(o.id);
    var line=res&&res.say&&!res.found?res.say:"";
    openModal(r,line?function(){ showToast(line,5200); }:null);
    return;
  }
  if(o.act==="code"){
    if(state.backOpen){ openSay("Keypad","",["The keypad is dark. The door beside it is open."],null,null); return; }
    delete state.input; res=ask(o.id);
    if(res&&res.prompt==="code") openPad(res); else if(res&&res.say) openSay("Keypad","",[res.say],null,null);
    return;
  }
  if(o.id==="door-front"){ goOutside(); return; }
  if(o.act==="door"&&o.kind==="hq"){ enterHQ(); return; }
  if(o.act==="door"&&o.kind==="shop"){
    if(o.rec&&o.rec.state==="construction"){ openSay(o.rec.name,"",["Under construction. K13 announced it and the doors are not open yet. Check back soon."],null,null); return; }
    enterShop(o.rec); return;
  }
  if(o.act==="van"){ openVan(o); return; }
  if(o.act==="shot"){ openShopInfo(o.shop); return; }
  if(o.act==="news"){ openNews(); return; }
  res=ask(o.id);
  var txt=asPages(res);
  if(!txt.length) txt=[o.look||"Nothing much to say about it."];
  openSay(objTitle(r),"",txt,null,null);
}
function activate(){ if(sayOpen){ advanceSay(); return; } if(target) interact(target); }

/* ---------- input ---------- */
/* held keys are tracked by the physical key (e.code), never by the character: "w" down and "W" up (Shift or Caps Lock
   changing in between) used to leave W held forever, and the visitor walked up on their own (Kazim, 2026-10-06).
   A modifier also clears everything, because macOS sends no keyup for keys released while Cmd is down. */
var MOVE={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],KeyA:[-1,0],KeyD:[1,0],KeyW:[0,-1],KeyS:[0,1]};
function moveCode(e){ if(MOVE[e.code]) return e.code; var k=e.key; return k==="a"||k==="A"?"KeyA":k==="d"||k==="D"?"KeyD":k==="w"||k==="W"?"KeyW":k==="s"||k==="S"?"KeyS":MOVE[k]?k:""; }
canvas.addEventListener("keydown",function(e){
  if(e.ctrlKey||e.metaKey||e.altKey){ clearKeys(); return; }
  var k=e.key, mc=moveCode(e);
  if(mc){ keys[mc]=true; e.preventDefault(); if(sayOpen) closeSay(); closeHelp(); return; }
  if(k==="e"||k==="E"||k==="Enter"||k===" "){ e.preventDefault(); if(!e.repeat) activate(); return; }
  if(k==="Escape"){ if(sayOpen){ e.preventDefault(); closeSay(); } else if(!helpPanel.hidden){ e.preventDefault(); closeHelp(); } return; }
  if(k==="?"||k==="h"||k==="H"){ e.preventDefault(); toggleHelp(); }
  if(k==="g"||k==="G"){ e.preventDefault(); quickToggle(); }
});
canvas.addEventListener("keyup",function(e){
  if(e.key==="Meta"||e.key==="Control"||e.key==="Alt"||e.key==="OS"){ clearKeys(); return; }
  var mc=moveCode(e); if(mc) delete keys[mc];
});
function clearKeys(){ keys={}; }
canvas.addEventListener("blur",clearKeys);
window.addEventListener("blur",clearKeys);
doc.addEventListener("visibilitychange",function(){ clearKeys(); sync(); });
function worldPoint(e){ var r=canvas.getBoundingClientRect(); return {x:camRX+(e.clientX-r.left)*(vw/r.width), y:camRY+(e.clientY-r.top)*(vh/r.height)}; }
function pick(wx,wy){
  var i, best=null, by=-1;
  for(i=0;i<npcs.length;i++){ var n=npcs[i]; if(wx>=n.x-8&&wx<=n.x+8&&wy>=n.y-20&&wy<=n.y+5){ if(n.y>by){ by=n.y; best={kind:"npc",n:n}; } } }
  if(best) return best;
  for(i=0;i<objs.length;i++){ var r=objs[i]; if(!r.o.act||r.hidden) continue;
    var x0=r.o.x*T, y0=r.o.y*T, w=r.o.w*T, h=r.o.h*T; if(wx>=x0&&wx<=x0+w&&wy>=y0&&wy<=y0+h){ if(r.sortY>=by){ by=r.sortY; best={kind:"obj",r:r}; } } }
  return best;
}
var tapFx=null;
canvas.addEventListener("click",function(e){
  try{ canvas.focus({preventScroll:true}); }catch(x){}
  if(ui()||!pad.hidden||busy) return;
  if(sayOpen) closeSay();
  closeHelp();
  var p=worldPoint(e), hit=pick(p.x,p.y);
  if(hit){
    if(target&&((hit.kind==="npc"&&target.kind==="npc"&&target.n===hit.n)||(hit.kind==="obj"&&target.kind==="obj"&&target.r===hit.r))){ interact(hit); return; }
    if(hit.kind==="npc"){ var tx=Math.floor(hit.n.x/T), ty=Math.floor(hit.n.y/T); walkNear(tx,ty,tx,ty,hit); }
    else{ var o=hit.r.o, fh=o.fh||o.h, y1=o.y+o.h-1, y0=hit.r.wall?o.y:(o.y+o.h-fh); walkNear(o.x,y0,o.x+o.w-1,y1,hit); }
    tapFx={x:p.x,y:p.y,t:0};
    return;
  }
  var gx=Math.floor(p.x/T), gy=Math.floor(p.y/T);
  if(walkTo(gx,gy,null)) tapFx={x:(gx+0.5)*T,y:(gy+0.5)*T,t:0};
});
canvas.addEventListener("mousemove",function(e){ if(ui()) return; var p=worldPoint(e), h=pick(p.x,p.y); canvas.classList.toggle("kw-hot",!!h); });
canvas.addEventListener("mouseleave",function(){ canvas.classList.remove("kw-hot"); });
useBtn.addEventListener("click",function(){ activate(); try{ canvas.focus({preventScroll:true}); }catch(e){} });

function toggleHelp(){ helpPanel.hidden=!helpPanel.hidden; if(barHelp) barHelp.setAttribute("aria-expanded",String(!helpPanel.hidden)); }
function closeHelp(){ if(!helpPanel.hidden){ helpPanel.hidden=true; if(barHelp) barHelp.setAttribute("aria-expanded","false"); } }
if(barHelp) barHelp.addEventListener("click",toggleHelp);
helpClose.addEventListener("click",function(){ closeHelp(); try{ canvas.focus({preventScroll:true}); }catch(e){} });

/* list mode: the classic page, complete */
function setList(on,silent){
  state.list=on; save();
  if(mainEl) mainEl.classList.toggle("kw-list",on);
  if(kwSection) kwSection.classList.toggle("kw-is-list",on);
  if(barList){ barList.setAttribute("aria-pressed",String(on)); barList.textContent=on?"Back to the studio":"Prefer a list"; }
  if(barPlace&&on) barPlace.textContent="List view";
  if(on){ closeHelp(); if(sayOpen) closeSay(); closePad(); closeVan(); buildPlacesList(); }
  updateChip(false); sync();
  if(!on){ resize(); lastRoom=""; }
  if(!silent&&live) live.textContent=on?"List view. Every toy and game is below as a card.":"Back in the studio.";
}
if(barList) barList.addEventListener("click",function(){ setList(!state.list); });

/* ---------- the loop ---------- */
var raf=0, lastTs=0, inView=true, time=0, camRX=0, camRY=0, lastRoom="", lastPlace="", draw={dirty:true};
function wantRun(){ return inView&&!doc.hidden&&!state.list&&!ui(); }
function sync(){
  if(wantRun()){ if(!raf){ lastTs=0; raf=requestAnimationFrame(frame); } }
  else if(raf){ cancelAnimationFrame(raf); raf=0; }
}
if("IntersectionObserver" in window){ new IntersectionObserver(function(es){ inView=es[0].isIntersecting; sync(); },{threshold:0.01}).observe(stageEl); }
if(window.ResizeObserver) new ResizeObserver(function(){ if(!state.list) resize(); }).observe(stageEl); else window.addEventListener("resize",function(){ if(!state.list) resize(); });

function idleFrame(ph){ return (Math.floor(time*0.9+ph)%2)?5:4; }
function updateNpc(n,dt){
  var d=Math.sqrt((n.x-pl.x)*(n.x-pl.x)+(n.y-pl.y)*(n.y-pl.y));
  if(n.talking){ n.frame=idleFrame(n.walkT0||0); return; }
  if(d<26&&n.state!=="walk"){ n.dir=dirOf(pl.x-n.x,pl.y-n.y,n.dir); n.frame=idleFrame(n.walkT0||0); return; }
  if(n.state==="idle"){
    n.frame=idleFrame(n.walkT0||0); n.timer-=dt;
    if(n.timer<=0){
      var w=n.wander, pick=w[(Math.random()*w.length)|0], cx=Math.floor(n.x/T), cy=Math.floor(n.y/T);
      if(pick[0]===cx&&pick[1]===cy){ n.timer=1.5+Math.random()*3; n.dir=["down","left","right","up"][(Math.random()*4)|0]; return; }
      var p=findPath(cx,cy,pick[0],pick[1]);
      if(p&&p.length){ n.path=p; n.pi=0; n.state="walk"; } else n.timer=3;
    }
  }else{
    var t=n.path[n.pi]; if(!t){ n.state="idle"; n.timer=2+Math.random()*6; n.frame=4; return; }
    var tx=(t[0]+0.5)*T, ty=(t[1]+0.5)*T, dx=tx-n.x, dy=ty-n.y, dist=Math.sqrt(dx*dx+dy*dy), step=NPC_SPEED*dt;
    if(d<14){ n.frame=4; return; }                     /* never walk into the visitor */
    if(dist<=step){ n.x=tx; n.y=ty; n.pi++; if(n.pi>=n.path.length){ n.state="idle"; n.timer=2+Math.random()*6; n.frame=4; } }
    else{ n.x+=dx/dist*step; n.y+=dy/dist*step; n.dir=dirOf(dx,dy,n.dir); n.walkT+=dt; n.frame=Math.floor(n.walkT*6)%4; }
  }
}
function updatePlayer(dt){
  if(busy||ride){ pl.frame=idleFrame(0); return false; }
  var ax=0, ay=0, k;
  for(k in keys){ if(keys[k]&&MOVE[k]){ ax+=MOVE[k][0]; ay+=MOVE[k][1]; } }
  var moved=false;
  if(ax||ay){
    pl.path=null; pl.pending=null; var L=Math.sqrt(ax*ax+ay*ay), sp=SPEED*(cur.kind==="region"?1.3:1)*dt;
    var dx=ax/L*sp, dy=ay/L*sp; moved=stepPlayer(dx,dy);
    pl.dir=dirOf(ax,ay,pl.dir);
    if(!moved&&ax&&ay){ pl.dir=dirOf(ax,0,pl.dir); }
  }else if(pl.path){
    var wp=pl.path[pl.pi];
    if(!wp){ finishPath(); }
    else{
      var ddx=wp.x-pl.x, ddy=wp.y-pl.y, dist=Math.sqrt(ddx*ddx+ddy*ddy), step=SPEED*(cur.kind==="region"?1.3:1)*dt;
      if(dist<=step+0.5){ pl.x=wp.x; pl.y=wp.y; pl.pi++; moved=true; if(pl.pi>=pl.path.length) finishPath(); }
      else{
        var ox=pl.x, oy=pl.y; moved=stepPlayer(ddx/dist*step,ddy/dist*step); pl.dir=dirOf(ddx,ddy,pl.dir);
        if(Math.abs(pl.x-ox)+Math.abs(pl.y-oy)<step*0.25){ pl.stuck+=dt; if(pl.stuck>0.35){ pl.path=null; pl.pending=null; } } else pl.stuck=0;
      }
    }
  }
  if(moved){ pl.walkT+=dt; pl.frame=Math.floor(pl.walkT*8)%4; } else pl.frame=idleFrame(0);
  return moved;
}
function finishPath(){
  var pend=pl.pending; pl.path=null; pl.pending=null;
  if(pend){
    var t=pend.kind==="npc"?{kind:"npc",n:pend.n}:{kind:"obj",r:pend.r}, cx, cy;
    if(t.kind==="npc"){ cx=t.n.x; cy=t.n.y; } else { cx=t.r.fx+t.r.fw/2; cy=t.r.fy+t.r.fhp/2; }
    pl.dir=dirOf(cx-pl.x,cy-pl.y,pl.dir);
    var near=t.kind==="npc"?Math.sqrt((t.n.x-pl.x)*(t.n.x-pl.x)+(t.n.y-pl.y)*(t.n.y-pl.y))<=28:rectDist(pl.x,pl.y,t.r.fx,t.r.fy,t.r.fw,t.r.fhp)<=14;
    if(near) interact(t);
  }
}
function cameraStep(dt){
  var tx=pl.x-vw/2, ty=pl.y-vh/2-6;
  if(ride){ tx=ride.x-vw/2; ty=ride.y-vh/2; }
  if(eye&&cur===hq){ if(performance.now()<eye.until){ tx=eye.x-vw/2; ty=eye.y-vh/2; } else eye=null; }
  var mw=MW*T, mh=MH*T;
  tx=mw<=vw?(mw-vw)/2:clamp(tx,0,mw-vw); ty=mh<=vh?(mh-vh)/2:clamp(ty,0,mh-vh);
  if(!camSet||reduced){ camX=tx; camY=ty; camSet=true; }
  else{ var k=1-Math.pow(0.0008,dt); camX+=(tx-camX)*k; camY+=(ty-camY)*k; }
  camRX=Math.round(camX); camRY=Math.round(camY);
}

function frame(ts){
  raf=0;
  var dt=lastTs?Math.min(0.05,(ts-lastTs)/1000):0.016; lastTs=ts; time+=dt;
  var typing=!pad.hidden||ui();
  if(!typing){
    updatePlayer(dt);
    for(var i=0;i<npcs.length;i++) updateNpc(npcs[i],dt);
  }
  stage2Tick(dt,ts);
  cameraStep(dt);
  var nt=sayOpen||typing||busy||ride?null:findTarget();
  var tk=nt?(nt.kind==="npc"?"n:"+nt.n.id:"o:"+nt.r.o.id):"";
  if(tk!==lastTargetKey){ lastTargetKey=tk; target=nt; setPrompt(nt); }
  else target=nt;
  positionPrompt();
  hud();
  if(tapFx){ tapFx.t+=dt; if(tapFx.t>0.5||reduced) tapFx=null; }
  if(ts-saveAt>1500){ saveAt=ts; savePos(); }
  render(ts);
  if(wantRun()) raf=requestAnimationFrame(frame);
}

/* ---------- prompt, hud, live text ---------- */
function setPrompt(t){
  if(!t||sayOpen){ prompt.hidden=true; useBtn.hidden=!!(!t)||sayOpen; if(!t) useBtn.hidden=true; return; }
  pTx.textContent=targetLabel(t); prompt.hidden=false;
  prompt.classList.remove("kw-pop"); void prompt.offsetWidth; prompt.classList.add("kw-pop");
  useBtn.textContent=t.kind==="npc"?"Talk":(t.r.o.act==="game"||t.r.o.act==="toy"?"Play":"Use"); useBtn.hidden=!(coarse||window.innerWidth<700);
}
function positionPrompt(){
  if(!target||prompt.hidden) return;
  var wx, wy;
  if(target.kind==="npc"){ wx=target.n.x; wy=target.n.y-26; }
  else{ var r=target.r; wx=r.fx+r.fw/2; wy=r.wall?(r.o.y+r.o.h)*T+6:(r.o.y*T-4); if(r.wall) wy+=14; }
  var k=cssW/vw, sx=(wx-camRX)*k, sy=(wy-camRY)*k;
  sx=clamp(sx,60,cssW-60); sy=clamp(sy,34,cssH-6);
  prompt.style.transform="translate("+Math.round(sx)+"px,"+Math.round(sy)+"px) translate(-50%,-100%)";
}
function placeName(){
  var tx=Math.floor(pl.x/T), ty=Math.floor(pl.y/T);
  if(cur.kind==="region") return RG.cityAt(tx,ty);
  if(cur.kind==="shop") return cur.name;
  var rm=roomAtTile(tx,ty); return rm?rm.name:"";
}
function hud(){
  var nm=placeName()||lastPlace, tn=target?targetName(target):"", clk=cur.kind==="region"?clockStr():"", lk=nm+"|"+tn+"|"+cur.id+"|"+clk;
  if(lk!==lastRoom){
    lastRoom=lk; lastPlace=nm;
    var shown=cur.kind==="hq"?("K13 HQ"+(nm?" \u00b7 "+nm:"")):(nm+(clk?" \u00b7 "+clk:""));
    if(barPlace) barPlace.textContent=shown;
    if(live&&!sayOpen){ var where=cur.kind==="hq"?"You are in the "+nm+" at K13 HQ.":(cur.kind==="shop"?"You are inside "+nm+".":"You are in "+nm+"."); live.textContent=where+(tn?" Near: "+tn+". Press E to "+targetLabel(target).toLowerCase()+".":""); }
  }
}

/* ---------- drawing ---------- */
function drawSprite(spr,x,y){ ctx.drawImage(spr,Math.round(x),Math.round(y)); }
function inView2(x,y,w,h){ return x+w>=camRX&&x<=camRX+vw&&y+h>=camRY&&y<=camRY+vh; }
function lampColor(c){
  if(c==="jade") return "79,158,146"; if(c==="orange") return "234,94,20"; if(c==="warm"||!c) return "255,214,150";
  var m=/^#([0-9a-f]{6})$/i.exec(c); if(m){ var n=parseInt(m[1],16); return ((n>>16)&255)+","+((n>>8)&255)+","+(n&255); } return "255,214,150";
}
function render(ts){
  var tms=ts||performance.now();
  ctx.setTransform(S,0,0,S,0,0); ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="#16181B"; ctx.fillRect(0,0,vw,vh);
  ctx.translate(-camRX,-camRY);
  /* floor and walls */
  if(cur.kind==="region") drawRegionBase(tms);
  else{ var sx=clamp(camRX,0,MW*T), sy=clamp(camRY,0,MH*T), sw=Math.min(vw,MW*T-sx), sh=Math.min(vh,MH*T-sy);
    if(sw>0&&sh>0) ctx.drawImage(tileC,sx,sy,sw,sh,sx,sy,sw,sh); }
  var i, r, list=[];
  for(i=0;i<objs.length;i++){ r=objs[i]; if(r.hidden) continue;
    var vis=inView2(r.sx,r.sy,r.o.w*T+2*GP,r.o.h*T+2*GP); if(!vis) continue;
    if(r.anim&&!reduced&&tms-r.last>120) bakeObject(r,tms); else if(!r.spr) bakeObject(r,tms);
    if(r.floorL) drawSprite(r.spr,r.sx,r.sy);
  }
  for(i=0;i<objs.length;i++){ r=objs[i]; if(r.hidden||!r.wall||!inView2(r.sx,r.sy,r.o.w*T+2*GP,r.o.h*T+2*GP)) continue; drawSprite(r.spr,r.sx,r.sy); }
  windowLight();
  for(i=0;i<objs.length;i++){ r=objs[i]; if(r.hidden||r.wall||r.floorL||!inView2(r.sx,r.sy,r.o.w*T+2*GP,r.o.h*T+2*GP)) continue; list.push({y:r.sortY,r:r}); }
  for(i=0;i<npcs.length;i++){ var n=npcs[i]; if(inView2(n.x-8,n.y-24,16,32)) list.push({y:n.y,n:n}); }
  if(!ride) list.push({y:pl.y,p:true});
  list.sort(function(a,b){ return a.y-b.y; });
  for(i=0;i<list.length;i++){
    var it=list[i];
    if(it.r) drawSprite(it.r.spr,it.r.sx,it.r.sy);
    else if(it.n){ shadow(it.n.x,it.n.y); drawSprite(personSprite(it.n.id,it.n.dir,it.n.frame),it.n.x-8,it.n.y-19); }
    else{ shadow(pl.x,pl.y); drawSprite(personSprite("player",pl.dir,pl.frame),pl.x-8,pl.y-19); }
  }
  if(ride) drawVan();
  /* the thing you can use */
  if(target&&!sayOpen) bracket(target,tms);
  if(tapFx&&!reduced){ var q=tapFx.t/0.5; ctx.strokeStyle="rgba(240,180,41,"+(1-q).toFixed(2)+")"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(tapFx.x,tapFx.y+3,2+q*7,0,6.2832); ctx.stroke(); }
  lighting(tms);
}
function shadow(x,y){ ctx.fillStyle="rgba(0,0,0,.26)"; ctx.fillRect(Math.round(x)-5,Math.round(y)+3,10,2); ctx.fillRect(Math.round(x)-4,Math.round(y)+2,8,1); ctx.fillRect(Math.round(x)-4,Math.round(y)+5,8,1); }
function bracket(t,tms){
  var x,y,w,h;
  if(t.kind==="npc"){ x=t.n.x-8; y=t.n.y-21; w=16; h=26; }
  else{ x=t.r.o.x*T; y=t.r.o.y*T; w=t.r.o.w*T; h=t.r.o.h*T; }
  var o=reduced?0:Math.round(Math.sin(tms/260)*0.9+0.9), L=3;
  ctx.fillStyle="#F0B429";
  x-=o; y-=o; w+=o*2; h+=o*2;
  ctx.fillRect(x,y,L,1); ctx.fillRect(x,y,1,L); ctx.fillRect(x+w-L,y,L,1); ctx.fillRect(x+w-1,y,1,L);
  ctx.fillRect(x,y+h-1,L,1); ctx.fillRect(x,y+h-L,1,L); ctx.fillRect(x+w-L,y+h-1,L,1); ctx.fillRect(x+w-1,y+h-L,1,L);
}
function windowLight(){
  if(cur.id!=="hq") return;
  var i, r, id;
  for(i=1;i<=6;i++){
    r=objById["window-"+i]; if(!r||!inView2(r.fx,r.fy,r.fw,200)) continue;
    var x0=r.fx+2, x1=r.fx+r.fw-2, y0=r.fy+r.fhp, len=T*(r.o.room==="arcade"?5:4.5), dx=T*1.6;
    ctx.fillStyle=dark?"rgba(150,185,215,.07)":"rgba(255,232,180,.17)";
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y0); ctx.lineTo(x1+dx,y0+len); ctx.lineTo(x0+dx,y0+len); ctx.closePath(); ctx.fill();
  }
}
function lighting(tms){
  var reg=cur.kind==="region", dk=reg?skyDk:(dark?1:0);
  if(reg&&skyTint){ ctx.fillStyle=skyTint; ctx.fillRect(camRX,camRY,vw,vh); }
  if(dk<0.02){ ctx.fillStyle=reg?"rgba(255,236,200,.03)":"rgba(255,200,130,.05)"; ctx.fillRect(camRX,camRY,vw,vh); return; }
  var lx=lightX; lx.setTransform(1,0,0,1,0,0); lx.globalCompositeOperation="source-over";
  lx.clearRect(0,0,vw,vh); lx.fillStyle="rgba(8,12,22,"+(0.6*dk).toFixed(3)+")"; lx.fillRect(0,0,vw,vh);
  lx.globalCompositeOperation="destination-out";
  var L=allLights, i, fl;
  for(i=0;i<L.length;i++){
    var a=L[i], px=a.x*T-camRX, py=a.y*T-camRY, rad=a.r*T; if(px+rad<0||py+rad<0||px-rad>vw||py-rad>vh) continue;
    fl=reduced?1:1+Math.sin(tms/170+i*2.1)*0.025;
    var gr=lx.createRadialGradient(px,py,2,px,py,rad*fl); gr.addColorStop(0,"rgba(0,0,0,.95)"); gr.addColorStop(.5,"rgba(0,0,0,.6)"); gr.addColorStop(1,"rgba(0,0,0,0)");
    lx.fillStyle=gr; lx.beginPath(); lx.arc(px,py,rad*fl,0,6.2832); lx.fill();
  }
  /* a soft glow around the visitor so the dark never hides where you are */
  var ppx=pl.x-camRX, ppy=pl.y-8-camRY, g2=lx.createRadialGradient(ppx,ppy,2,ppx,ppy,34); g2.addColorStop(0,"rgba(0,0,0,.7)"); g2.addColorStop(1,"rgba(0,0,0,0)");
  lx.fillStyle=g2; lx.beginPath(); lx.arc(ppx,ppy,34,0,6.2832); lx.fill();
  ctx.setTransform(S,0,0,S,0,0); ctx.translate(-camRX,-camRY); ctx.imageSmoothingEnabled=true;
  ctx.drawImage(lightC,0,0,vw,vh,camRX,camRY,vw,vh);
  ctx.imageSmoothingEnabled=false;
  ctx.globalCompositeOperation="lighter";
  for(i=0;i<L.length;i++){
    var b=L[i], bx=b.x*T-camRX, by=b.y*T-camRY, br=b.r*T; if(bx+br<0||by+br<0||bx-br>vw||by-br>vh) continue;
    var gg=ctx.createRadialGradient(bx+camRX,by+camRY,1,bx+camRX,by+camRY,br*0.8); gg.addColorStop(0,"rgba("+lampColor(b.c)+","+(0.2*dk).toFixed(3)+")"); gg.addColorStop(1,"rgba("+lampColor(b.c)+",0)");
    ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(bx+camRX,by+camRY,br*0.8,0,6.2832); ctx.fill();
  }
  ctx.globalCompositeOperation="source-over";
}
/* collectLights: the lamps and the glow of every lit object, for one map */
function collectLightsFor(inst){
  var L=(inst.kind==="region")?inst.R.lamps.slice():(inst.kind==="shop"?inst.def.lights.slice():(map.lights||[]).slice()), D=NS.decor;
  if(inst.kind!=="region"&&D&&typeof D.lights==="function") inst.objs.forEach(function(r){ try{ var l=D.lights(r.o)||[]; l.forEach(function(a){ if(a&&typeof a.x==="number") L.push({x:a.x,y:a.y,r:Math.max(1.5,a.r),c:a.color||"warm"}); }); }catch(e){} });
  inst.lights=L; if(cur===inst) allLights=L;
}
/* ================= stage 2: the coast, the shops, the van, the clock, the crew ================= */
var fitPrev=false, busy=false, infoOpen=false, vanOpen=false, vanFrom="", ride=null, exitCool=0, skyAt=0, crewAt=0, miniAt=0, frameNo=0, skyHour=12;
function ui(){ return !!(modal||infoOpen||vanOpen); }
function savePos(){ state.map=cur.id; state.x=Math.round(pl.x/T*10)/10; state.y=Math.round(pl.y/T*10)/10; state.dir=pl.dir; save(); }
function focusCanvas(){ try{ canvas.focus({preventScroll:true}); }catch(e){} }
function sstep(a,b,v){ var t=clamp((v-a)/(b-a),0,1); return t*t*(3-2*t); }

/* ---------- the clock: San Diego time ---------- */
var tzFmt=null; try{ tzFmt=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",hour:"numeric",minute:"numeric",hourCycle:"h23"}); }catch(e){}
function sdHour(){
  var d=new Date();
  if(tzFmt){ try{ var ps=tzFmt.formatToParts(d), h=0, m=0, i; for(i=0;i<ps.length;i++){ if(ps[i].type==="hour") h=parseInt(ps[i].value,10); else if(ps[i].type==="minute") m=parseInt(ps[i].value,10); } return (h%24)+m/60; }catch(e){} }
  return d.getHours()+d.getMinutes()/60;
}
function clockStr(){ var h=Math.floor(skyHour), m=Math.floor((skyHour-h)*60+0.001), ap=h>=12?"pm":"am", hh=h%12; if(hh===0) hh=12; return hh+":"+(m<10?"0":"")+m+" "+ap; }
function updateSky(){
  var h=sdHour(), dk, tint="";
  skyHour=h;
  if(h<5||h>=20.5) dk=1; else if(h<7.5) dk=1-sstep(5,7.5,h); else if(h<17) dk=0; else dk=sstep(17,20.5,h);
  if(h>=5&&h<8.5) tint="rgba(255,168,120,"+(Math.sin(sstep(5,8.5,h)*3.1416)*0.2).toFixed(3)+")";
  else if(h>=16.5&&h<20.5) tint="rgba(255,140,70,"+(Math.sin(sstep(16.5,20.5,h)*3.1416)*0.22).toFixed(3)+")";
  if(dark){ dk=1; tint=""; }
  skyDk=dk; skyTint=tint;
  var ph=dk>=0.6?"night":(tint?(h<12?"dawn":"dusk"):"day");
  if(ph!==skyPhase){ skyPhase=ph; skyNight=(ph==="night"); if(insts.region){ if(cur&&cur.kind==="region") bakeAll(); else insts.region.stale=true; } }
}

/* ---------- fade between maps, and entering one ---------- */
var fadeEl=el("div","kw-fade"); fadeEl.setAttribute("aria-hidden","true"); stageEl.appendChild(fadeEl);
function travel(fn){
  if(busy) return; busy=true; keys={}; pl.path=null; pl.pending=null;
  if(reduced){ fn(); busy=false; return; }
  fadeEl.classList.add("kw-on");
  setTimeout(function(){ fn(); setTimeout(function(){ fadeEl.classList.remove("kw-on"); setTimeout(function(){ busy=false; },240); },60); },270);
}
function enter(inst,px,py,dir){
  if(sayOpen) closeSay(); closePad(); closeHelp(); closeVan();
  if(inst.kind==="region") crewSettle();
  useInst(inst);
  if(!inst.built){ buildBlocked(); inst.built=true; }
  if(inst.stale){ inst.objs.forEach(function(r){ r.spr=null; }); inst.stale=false; }
  if(inst.kind==="region") crewEnterRegion();
  pl.x=px; pl.y=py; if(dir) pl.dir=dir; pl.path=null; pl.pending=null; camSet=false; target=null; lastTargetKey=""; lastRoom="";
  exitCool=performance.now()+900; miniShow(inst.kind==="region");
  if(inst.kind==="shop"||fitPrev) resize(); fitPrev=(inst.kind==="shop");
  savePos(); sync();
}
function ensureRegion(){ if(!insts.region&&NS.region){ RG=NS.region.get(); insts.region=makeRegion(); } return insts.region; }
function makeRegion(){
  var inst={id:"region",kind:"region",name:"The coast",R:RG,w:RG.w,h:RG.h,rows:null,rooms:[],spawn:{x:RG.hq.door.x+0.5,y:RG.hq.door.y+0.7},npcs:[],lights:[],exit:null,
    blk:new Uint8Array(RG.w*RG.h),tileC:null,objs:mkObjs(RG.objects),chunks:{},nch:0,stale:false};
  indexObjs(inst); collectLightsFor(inst); insts.region=inst; return inst;
}
function shopInst(rec){
  var id="shop:"+rec.id; if(insts[id]) return insts[id];
  var def=NS.region.shopDef(rec), tc=mk(def.w*T,def.h*T);
  try{ def.paint(tc.getContext("2d")); }catch(e){}
  var inst={id:id,kind:"shop",name:rec.name,def:def,w:def.w,h:def.h,rows:def.rows.map(function(r){ return r.split(""); }),rooms:def.rooms,spawn:def.spawn,npcs:[],lights:[],exit:def.exit,
    blk:new Uint8Array(def.w*def.h),tileC:tc,objs:mkObjs(def.objects),stale:false,rec:rec};
  indexObjs(inst); insts[id]=inst; collectLightsFor(inst);
  var fo=inst.objById.shotframe;
  if(fo&&rec.peek){ var im=new Image(); im.onload=function(){ fo.spr=null; }; im.src="/assets/shots/webp/"+rec.peek+"-750.webp"; fo.o.img=im; }
  return inst;
}
function goOutside(){ if(!ensureRegion()) return; var d=RG.hq.door; travel(function(){ enter(insts.region,(d.x+0.5)*T,(d.y+0.7)*T,"down"); }); }
function enterHQ(){ travel(function(){ enter(hq,25.5*T,29.8*T,"up"); }); }
function enterShop(rec){ var inst=shopInst(rec); travel(function(){ enter(inst,inst.spawn.x*T,inst.spawn.y*T,"up"); }); }
function leaveShop(){ var rec=cur.rec, d=rec.door; travel(function(){ enter(insts.region,(d.x+0.5)*T,(d.y+0.8)*T,"down"); }); }
function checkDoorTile(){
  if(cur.kind!=="region"||busy||ride||performance.now()<exitCool||sayOpen) return;
  var tx=Math.floor(pl.x/T), ty=Math.floor((pl.y-1)/T), i, r, o;
  for(i=0;i<objs.length;i++){ r=objs[i]; o=r.o; if(!o.door||o.act!=="door") continue;
    if(tx===o.x+o.door.dx&&ty===o.y+o.door.dy){ exitCool=performance.now()+900; interact({kind:"obj",r:r}); return; } }
}
function checkExit(){
  if(busy||ride||!cur.exit||performance.now()<exitCool) return;
  var e=cur.exit; if(pl.y>=e.y&&pl.x>=e.x0&&pl.x<=e.x1){ if(cur.kind==="hq") goOutside(); else if(cur.kind==="shop") leaveShop(); }
}

/* ---------- the region on screen: cached chunks, water, cars ---------- */
function drawRegionBase(tms){
  var R=cur.R, CS=RG_CH*T, cx0=Math.max(0,Math.floor(camRX/CS)), cy0=Math.max(0,Math.floor(camRY/CS)), cx1=Math.min(Math.floor((R.w-1)/RG_CH),Math.floor((camRX+vw)/CS)), cy1=Math.min(Math.floor((R.h-1)/RG_CH),Math.floor((camRY+vh)/CS)), cx, cy, made=0;
  for(cy=cy0;cy<=cy1;cy++) for(cx=cx0;cx<=cx1;cx++){
    var key=cy*100+cx, ch=cur.chunks[key];
    if(!ch){ ch={c:mk(CS,CS),u:0}; var cc=ch.c.getContext("2d"); cc.imageSmoothingEnabled=false; R.paintChunk(R,cc,cx,cy); cur.chunks[key]=ch; cur.nch++; made++; }
    ch.u=frameNo; ctx.drawImage(ch.c,cx*CS,cy*CS);
  }
  if(cur.nch>96){ var k; for(k in cur.chunks){ if(cur.chunks[k].u<frameNo-90){ delete cur.chunks[k]; cur.nch--; } } }
  var tx0=Math.floor(camRX/T), ty0=Math.floor(camRY/T), tx1=Math.floor((camRX+vw)/T), ty1=Math.floor((camRY+vh)/T);
  if(!reduced) R.animate(R,ctx,tx0,ty0,tx1,ty1,tms);
  R.drawCars(R,ctx,tx0-2,ty0-2,tx1+2,ty1+2,reduced?0:tms);
}
var RG_CH=16;

/* ---------- the van ---------- */
var vanEl=el("div","kw-van"); vanEl.hidden=true; vanEl.setAttribute("role","dialog"); vanEl.setAttribute("aria-label","K13 van");
var vanH=el("h2","kw-van-h","K13 van"), vanP=el("p","kw-van-p","Where to? Pick a stop, or tap one on the map."), vanL=el("div","kw-van-l"), vanX=el("button","kw-van-x","Stay here"); vanX.type="button";
vanEl.appendChild(vanH); vanEl.appendChild(vanP); vanEl.appendChild(vanL); vanEl.appendChild(vanX); stageEl.appendChild(vanEl);
function stopRec(id){ for(var i=0;i<RG.stops.length;i++) if(RG.stops[i].id===id) return RG.stops[i]; return null; }
function openVan(o){
  if(!RG||busy) return; vanFrom=o.id; vanL.textContent="";
  [0,1,2].forEach(function(d){
    var list=RG.stops.filter(function(s){ return s.district===d; }); if(!list.length) return;
    vanL.appendChild(el("h3","kw-van-d",NS.region.DNAME[d]));
    list.forEach(function(s){
      var b=el("button","kw-van-b",s.name); b.type="button"; b.setAttribute("data-stop",s.id);
      if(s.id===vanFrom){ b.disabled=true; b.appendChild(el("span","kw-van-here","You are here")); }
      vanL.appendChild(b);
    });
  });
  vanOpen=true; vanEl.hidden=false; prompt.hidden=true; useBtn.hidden=true; keys={}; sync();
  setTimeout(function(){ var b=vanL.querySelector("button:not([disabled])"); if(b){ try{ b.focus({preventScroll:true}); }catch(e){} } },30);
}
function closeVan(){ if(!vanOpen) return; vanOpen=false; vanEl.hidden=true; sync(); lastTargetKey=""; focusCanvas(); }
vanX.addEventListener("click",closeVan);
vanEl.addEventListener("keydown",function(e){ if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); closeVan(); } });
vanL.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("button[data-stop]"); if(!b||b.disabled) return; rideTo(stopRec(b.getAttribute("data-stop"))); });
function stopFront(s){ var p=RG.posById[s.id]; return p?{x:(p.x+0.5)*T,y:(p.y+0.6)*T}:{x:(s.x+0.5)*T,y:(s.y+0.5)*T}; }
function nearIdx(p,q){ var bi=0, bd=1e9, i; for(i=0;i<p.length;i++){ var dx=p[i][0]*T-q.x, dy=p[i][1]*T-q.y, d=dx*dx+dy*dy; if(d<bd){ bd=d; bi=i; } } return bi; }
function rideTo(to){
  var from=stopRec(vanFrom); closeVan(); if(!to||!from||from===to) return;
  var A=stopFront(from), B=stopFront(to), pts=[A], lane=RG.lanes[0], i;
  if(lane&&lane.p.length>1){ var i0=nearIdx(lane.p,A), i1=nearIdx(lane.p,B); if(i0<=i1){ for(i=i0;i<=i1;i++) pts.push({x:lane.p[i][0]*T,y:lane.p[i][1]*T}); } else { for(i=i0;i>=i1;i--) pts.push({x:lane.p[i][0]*T,y:lane.p[i][1]*T}); } }
  pts.push(B);
  if(reduced){ pl.x=B.x; pl.y=B.y; pl.dir="down"; camSet=false; lastRoom=""; showToast("You arrive at "+to.name+"."); savePos(); return; }
  var len=0, cum=[0]; for(i=1;i<pts.length;i++){ var dx=pts[i].x-pts[i-1].x, dy=pts[i].y-pts[i-1].y; len+=Math.sqrt(dx*dx+dy*dy); cum.push(len); }
  ride={pts:pts,cum:cum,len:len,t:0,dur:clamp(1.8+len/1700,2.2,5.5),to:to,x:A.x,y:A.y,dx:1,dy:0}; busy=true; pl.path=null; keys={};
  showToast("Riding the K13 van to "+to.name+"...",ride.dur*1000);
}
function rideStep(dt){
  ride.t+=dt; var u=clamp(ride.t/ride.dur,0,1), e=u<0.5?2*u*u:1-Math.pow(-2*u+2,2)/2, d=e*ride.len, q=1, p=ride.pts;
  while(q<p.length-1&&ride.cum[q]<d) q++;
  var a=p[q-1], b=p[q], seg=(ride.cum[q]-ride.cum[q-1])||1, f=clamp((d-ride.cum[q-1])/seg,0,1);
  ride.x=a.x+(b.x-a.x)*f; ride.y=a.y+(b.y-a.y)*f; var ddx=b.x-a.x, ddy=b.y-a.y; if(ddx||ddy){ ride.dx=ddx; ride.dy=ddy; }
  if(u>=1){ var to=ride.to, B=stopFront(to); ride=null; busy=false; pl.x=B.x; pl.y=B.y; pl.dir="down"; camSet=false; lastRoom=""; showToast("You arrive at "+to.name+"."); savePos(); }
}
function drawVan(){
  var x=Math.round(ride.x), y=Math.round(ride.y), horiz=Math.abs(ride.dx)>=Math.abs(ride.dy), vd=horiz?(ride.dx>0?"right":"left"):(ride.dy>0?"down":"up"), vs=NS.region&&NS.region.vanSprite?NS.region.vanSprite(vd):null;
  if(vs){ fr(ctx,"rgba(0,0,0,.28)",x-vs.width/2+2,y+vs.height/2-3,vs.width-4,3); ctx.drawImage(vs,x-vs.width/2,y-vs.height/2); return; }
  fr(ctx,"rgba(0,0,0,.3)",x-13,y+4,26,3);
  if(horiz){ fr(ctx,"#EA5E14",x-12,y-6,24,11); fr(ctx,"#F6EEDC",x-12,y-6,24,3); fr(ctx,"#A9CDD4",ride.dx>0?x+4:x-10,y-5,6,4); fr(ctx,"#B94612",x-12,y+3,24,2); fr(ctx,"#1F2023",x-9,y+3,4,3); fr(ctx,"#1F2023",x+5,y+3,4,3); fr(ctx,"#1F2023",x-4,y-3,8,5); fr(ctx,"#F0B429",x-3,y-2,6,3); }
  else{ fr(ctx,"#EA5E14",x-6,y-12,12,24); fr(ctx,"#F6EEDC",x-6,y-12,12,3); fr(ctx,"#A9CDD4",x-5,ride.dy>0?y+5:y-10,10,4); fr(ctx,"#1F2023",x-7,y-9,2,5); fr(ctx,"#1F2023",x+5,y-9,2,5); fr(ctx,"#1F2023",x-7,y+4,2,5); fr(ctx,"#1F2023",x+5,y+4,2,5); fr(ctx,"#F0B429",x-3,y-3,6,6); }
}

/* ---------- the minimap ---------- */
var miniBtn=el("button","kw-mini"), miniC=el("canvas","kw-mini-c"); miniBtn.type="button"; miniBtn.hidden=true;
miniBtn.setAttribute("aria-label","Map of the coast. Tap a spot to walk there."); miniBtn.appendChild(miniC); stageEl.appendChild(miniBtn);
var miniBase=null, miniS=2, miniCtx=miniC.getContext("2d");
function miniShow(on){
  if(!on||!RG){ miniBtn.hidden=true; return; }
  miniBtn.hidden=false;
  if(!miniBase){ miniS=window.innerWidth<560?3:2; var bc=mk(RG.w,RG.h); RG.paintOverview(RG,bc.getContext("2d"),1,{}); miniBase=bc; miniC.width=Math.ceil(RG.w/miniS); miniC.height=Math.ceil(RG.h/miniS); }
  miniDraw(performance.now());
}
function miniDraw(tms){
  if(miniBtn.hidden||!miniBase) return; var c=miniCtx, w=miniC.width, h=miniC.height, k=1/(miniS*T);
  c.imageSmoothingEnabled=true; c.clearRect(0,0,w,h); c.drawImage(miniBase,0,0,RG.w,RG.h,0,0,w,h);
  c.fillStyle="rgba(246,238,220,.55)"; [RG.yLO,RG.yOS].forEach(function(y){ for(var x=0;x<w;x+=6) c.fillRect(x,Math.round(y/miniS),3,1); });
  RG.places.forEach(function(p){ c.fillStyle="#EA5E14"; c.fillRect(Math.round((p.x+2)/miniS)-1,Math.round((p.y+2)/miniS)-1,3,3); });
  RG.stops.forEach(function(s){ c.fillStyle="#4F9E92"; c.fillRect(Math.round((s.obj.x+2)/miniS)-1,Math.round((s.obj.y+1)/miniS)-1,3,3); });
  c.fillStyle="#F0B429"; c.fillRect(Math.round((RG.hq.x+3)/miniS)-2,Math.round((RG.hq.y+2)/miniS)-2,5,5); c.strokeStyle="#1F2023"; c.lineWidth=1; c.strokeRect(Math.round((RG.hq.x+3)/miniS)-2.5,Math.round((RG.hq.y+2)/miniS)-2.5,5,5);
  c.strokeStyle="rgba(246,238,220,.8)"; c.strokeRect(Math.round(camRX*k)+.5,Math.round(camRY*k)+.5,Math.max(4,Math.round(vw*k)),Math.max(4,Math.round(vh*k)));
  var px=pl.x*k, py=pl.y*k, on=reduced||(Math.floor(tms/450)%2===0);
  c.fillStyle="#1F2023"; c.fillRect(Math.round(px)-3,Math.round(py)-3,6,6); c.fillStyle=on?"#FFFFFF":"#F0B429"; c.fillRect(Math.round(px)-2,Math.round(py)-2,4,4);
  if(ride){ c.fillStyle="#EA5E14"; c.fillRect(Math.round(ride.x*k)-2,Math.round(ride.y*k)-2,5,5); }
}
miniBtn.addEventListener("click",function(e){
  if(!RG||busy) return; var r=miniC.getBoundingClientRect();
  if(e.detail===0&&e.clientX===0&&e.clientY===0){ showToast("Use the arrow keys, or click a spot on the map with a mouse or finger."); return; }
  var tx=Math.floor((e.clientX-r.left)/r.width*RG.w), ty=Math.floor((e.clientY-r.top)/r.height*RG.h);
  if(vanOpen){ var best=null, bd=1e9; RG.stops.forEach(function(s){ var dx=s.obj.x+2-tx, dy=s.obj.y+1-ty, d=dx*dx+dy*dy; if(d<bd){ bd=d; best=s; } }); if(best&&bd<225) rideTo(best); return; }
  if(ui()||ride) return;
  if(sayOpen) closeSay(); closeHelp();
  if(walkTo(tx,ty,null,14)) showToast("Walking there. Arrow keys stop you."); else showToast("No way through there. Try a street.");
  focusCanvas();
});

/* ---------- the info window: a shop's screenshot and link, the K13 Daily ---------- */
var infoD=el("dialog","kw-cab kw-info"); infoD.setAttribute("aria-labelledby","kwInfoT");
var infoF=el("div","kw-cab-frame"), infoTop=el("div","kw-cab-top"), infoT=el("h2","kw-cab-title"), infoX=el("button","kw-cab-x"), infoB=el("div","kw-cab-body"), infoIn=el("div","kw-info-body");
infoT.id="kwInfoT"; infoT.tabIndex=-1; infoX.type="button"; infoX.innerHTML="Close <kbd>Esc</kbd>";
infoTop.appendChild(infoT); infoTop.appendChild(infoX); infoB.appendChild(infoIn); infoF.appendChild(infoTop); infoF.appendChild(infoB); infoD.appendChild(infoF); doc.body.appendChild(infoD);
function showInfo(title,isNew){
  infoT.textContent=title; if(isNew){ var nw=el("span","kw-new","New"); infoT.appendChild(doc.createTextNode(" ")); infoT.appendChild(nw); }
  infoOpen=true; prompt.hidden=true; useBtn.hidden=true; keys={};
  try{ if(infoD.showModal) infoD.showModal(); else infoD.setAttribute("open",""); }catch(e){ infoD.setAttribute("open",""); }
  sync(); setTimeout(function(){ try{ infoT.focus({preventScroll:true}); }catch(e){} },40);
}
function closeInfo(){
  if(!infoOpen) return; infoOpen=false;
  try{ if(infoD.open&&infoD.close) infoD.close(); else infoD.removeAttribute("open"); }catch(e){ infoD.removeAttribute("open"); }
  sync(); lastTargetKey=""; focusCanvas();
}
infoX.addEventListener("click",closeInfo);
infoD.addEventListener("cancel",function(e){ e.preventDefault(); closeInfo(); });
infoD.addEventListener("click",function(e){ if(e.target===infoD) closeInfo(); });
function linkEl(href,label){ var a=el("a","kw-info-a",label); a.href=href; a.target="_blank"; a.rel="noopener noreferrer"; a.appendChild(el("span","vh"," (opens in a new tab)")); return a; }
function openShopInfo(rec){
  if(!rec) return; infoIn.textContent="";
  if(rec.peek){ var im=new Image(); im.className="kw-info-img"; im.alt="A look at "+rec.name+"'s live site"; im.onerror=function(){ im.hidden=true; }; im.src="/assets/shots/webp/"+rec.peek+"-750.webp"; infoIn.appendChild(im); }
  var where=rec.city||(rec.worldwide?"Worldwide Harbour, San Diego":""); if(where) infoIn.appendChild(el("p","kw-info-meta",where+(rec.category?" · "+rec.category:"")));
  if(rec.desc) infoIn.appendChild(el("p","kw-info-p",rec.desc));
  if(rec.isNew) infoIn.appendChild(el("p","kw-info-p","K13 shipped something new here in the last two weeks."));
  if(rec.url) infoIn.appendChild(linkEl(rec.url,"Visit the live site"));
  showInfo(rec.name,rec.isNew);
}
function newsLine(n){ if(typeof n==="string") return n; if(!n) return ""; var t=n.text||n.title||n.line||""; return n.date?t+" ("+n.date+")":t; }
function openNews(){
  infoIn.textContent=""; var items=(RG&&RG.news&&RG.news.length?RG.news:(NS.data&&NS.data.news)||[]).map(newsLine).filter(Boolean);
  if(!items.length) items=["K13 Daily is at the printer. Come back after the next ship."];
  infoIn.appendChild(el("p","kw-info-meta","The latest public moves from the studio"));
  var ul=el("ul","kw-info-l"); items.slice(0,13).forEach(function(t){ ul.appendChild(el("li","",t)); }); infoIn.appendChild(ul);
  infoIn.appendChild(el("p","kw-info-p","Walk out the front door to find the places these came from."));
  showInfo("K13 Daily",false);
}

/* ---------- list mode: the places ---------- */
var placesBuilt=false;
function buildPlacesList(){
  if(placesBuilt||!RG||!mainEl) return; placesBuilt=true;
  var sec=el("section","kw-places"); sec.id="kwPlaces"; sec.setAttribute("aria-labelledby","kwPlacesT");
  var wrap=el("div","wrap"), h=el("h2","h2 kw-places-h"); h.id="kwPlacesT"; h.textContent="Places on the map"; wrap.appendChild(h);
  wrap.appendChild(el("p","kw-places-note","Every project on the Work list, where it sits on the coast, and a link to the live site."));
  var ul=el("ul","kw-places-l");
  RG.places.forEach(function(p){
    var li=el("li","kw-places-i"), nm=el("b","kw-places-n",p.name), ct=el("span","kw-places-c",p.city||(p.worldwide?"Worldwide Harbour, San Diego":RG.cityAt(p.x+2,p.y+2)));
    li.appendChild(nm); li.appendChild(ct); if(p.state==="construction"&&!/coming soon/i.test(p.city)) li.appendChild(el("span","kw-places-c","Coming soon")); if(p.isNew) li.appendChild(el("span","kw-new","New")); if(p.url) li.appendChild(linkEl(p.url,"Visit the live site")); ul.appendChild(li);
  });
  wrap.appendChild(ul); sec.appendChild(wrap);
  var toys=$("toys"); if(toys&&toys.parentNode===mainEl) mainEl.insertBefore(sec,toys); else mainEl.appendChild(sec);
}

/* ---------- the crew's day: HQ in the morning, the shops by day, home at night ---------- */
var crew=[];
function sumStr(s){ var n=0,i; for(i=0;i<s.length;i++) n=(n*31+s.charCodeAt(i))|0; return Math.abs(n); }
function initCrew(){
  crew=[]; if(!RG) return;
  var act=RG.activity||{}, ordered=RG.places.slice().sort(function(a,b){ return String((act[b.key]||{}).lastShip||"").localeCompare(String((act[a.key]||{}).lastShip||"")); }), stay={kazim:1,gurkan:1,jessica:1,ana:1,james:1};
  hq.npcs.slice().forEach(function(n,i){
    var id=norm(n.id); if(stay[id]||i%4===3) return;
    var work=null, k;
    for(k=0;k<ordered.length&&!work;k++){ var cl=(act[ordered[k].key]||{}).crew; if(cl&&cl.map(norm).indexOf(id)>=0) work=ordered[k]; }
    if(!work){
      var role=String(n.role||"").toLowerCase(), pool=ordered;
      if(/design|creative|motion|art|brand/.test(role)) pool=ordered.filter(function(p){ return /gallery|club|hall/.test(NS.region.catOf(p.category)); });
      else if(/engineer|infra|operation|develop|qa|test/.test(role)) pool=ordered.filter(function(p){ return /office|kitchen/.test(NS.region.catOf(p.category)); });
      if(!pool.length) pool=ordered;
      work=pool[sumStr(id)%pool.length];
    }
    n.hqWander=n.wander; n.hqHome=n.home;
    crew.push({n:n,work:work,where:"hq",at:0,depart:9+crew.length*0.032,ret:17.1+crew.length*0.04});
  });
}
function removeNpc(inst,n){ var i=inst.npcs.indexOf(n); if(i>=0) inst.npcs.splice(i,1); }
function resetNpc(n){ n.path=null; n.pi=0; n.state="idle"; n.timer=1+Math.random()*4; n.frame=4; n.talking=false; n.leaving=false; n.returning=false; }
function crewSettle(){ /* before a map change: whoever should be home or out is, without walking */
  var h=sdHour(); crew.forEach(function(c){
    var out=h>=c.depart&&h<c.ret;
    if(out&&c.where==="hq"){ removeNpc(hq,c.n); resetNpc(c.n); c.where="region"; c.at=0; }
    else if(!out&&c.where==="region"){ if(insts.region) removeNpc(insts.region,c.n); resetNpc(c.n); sendHome(c,false); }
  });
}
function sendHome(c,walk){
  var n=c.n, hp=n.hqHome; resetNpc(n); n.wander=n.hqWander; c.where="hq"; if(hq.npcs.indexOf(n)<0) hq.npcs.push(n);
  if(walk&&cur===hq){ n.x=25.5*T; n.y=30.6*T; var p=findPath(25,30,hp.x,hp.y); if(p&&p.length){ n.path=p; n.pi=0; n.state="walk"; return; } }
  n.x=(hp.x+0.5)*T; n.y=(hp.y+0.5)*T;
}
function regionSpot(work,tries){
  var out=[], dx, dy, d=work.door;
  for(dy=-3;dy<=3;dy++) for(dx=-4;dx<=4;dx++){ var tx=d.x+dx, ty=d.y+dy; if(tx<0||ty<0||tx>=MW||ty>=MH||blk[ty*MW+tx]) continue; out.push([tx,ty]); }
  return out;
}
function crewEnterRegion(){
  var inst=insts.region; if(!inst) return;
  crew.forEach(function(c){
    if(c.where!=="region"||inst.npcs.indexOf(c.n)>=0) return;
    var n=c.n, spots=regionSpot(c.work), fresh=c.at&&(Date.now()-c.at)<70000;
    resetNpc(n); n.wander=spots.slice(0,10).sort(function(){ return Math.random()-0.5; });
    if(fresh){ n.x=(RG.hq.door.x+0.5)*T; n.y=(RG.hq.door.y+0.5)*T; var p=findPath(RG.hq.door.x,RG.hq.door.y,c.work.door.x,c.work.door.y); if(p&&p.length){ n.path=p; n.pi=0; n.state="walk"; inst.npcs.push(n); return; } }
    var sp=spots.length?spots[(Math.random()*spots.length)|0]:[c.work.door.x,c.work.door.y]; n.x=(sp[0]+0.5)*T; n.y=(sp[1]+0.5)*T; inst.npcs.push(n);
  });
}
function tickCrew(){
  if(!crew.length) return; var h=sdHour();
  crew.forEach(function(c){
    var n=c.n, out=h>=c.depart&&h<c.ret;
    if(out&&c.where==="hq"){
      if(cur===hq){
        if(!n.leaving&&!n.talking){ var cx=Math.floor(n.x/T), cy=Math.floor(n.y/T), p=findPath(cx,cy,25,30); if(p&&p.length){ n.leaving=true; n.path=p; n.pi=0; n.state="walk"; } else { removeNpc(hq,n); resetNpc(n); c.where="region"; c.at=Date.now(); } }
      }else{ removeNpc(hq,n); resetNpc(n); c.where="region"; c.at=Date.now(); }
    }else if(!out&&c.where==="region"){
      if(cur===insts.region){
        if(!n.returning&&!n.talking){ var rx=Math.floor(n.x/T), ry=Math.floor(n.y/T), q=findPath(rx,ry,RG.hq.door.x,RG.hq.door.y); if(q&&q.length){ n.returning=true; n.path=q; n.pi=0; n.state="walk"; } else { removeNpc(insts.region,n); sendHome(c,false); } }
      }else if(cur===hq){ if(insts.region) removeNpc(insts.region,n); sendHome(c,true); }
      else{ if(insts.region) removeNpc(insts.region,n); sendHome(c,false); }
    }
    if(n.leaving&&n.state==="idle"){ n.leaving=false; removeNpc(hq,n); resetNpc(n); c.where="region"; c.at=Date.now(); }
    if(n.returning&&n.state==="idle"){ n.returning=false; if(insts.region) removeNpc(insts.region,n); sendHome(c,false); }
  });
}

/* ---------- links into the world: /workbench/#at=<id> ---------- */
function parseAt(){ var m=/(?:^#|&)at=([^&]+)/.exec(location.hash||""); if(!m) return ""; try{ return decodeURIComponent(m[1]); }catch(e){ return m[1]; } }
function findPlace(id){
  var low=String(id).toLowerCase(), i, first=null; if(!RG) return null;
  for(i=0;i<RG.places.length;i++){ var p=RG.places[i]; if(String(p.id).toLowerCase()===low) return p; if(!first&&String(p.key).toLowerCase()===low) first=p; }
  return first;
}
function placeNearObj(r){
  var o=r.o, fh=o.fh||o.h, y0=r.wall?o.y:(o.y+o.h-fh), ring=ringTiles(o.x,y0,o.x+o.w-1,o.y+o.h-1), ax=o.x+o.w/2, ay=o.y+o.h+0.6;
  ring.sort(function(a,b){ return (Math.abs(a[0]+0.5-ax)+Math.abs(a[1]+0.5-ay))-(Math.abs(b[0]+0.5-ax)+Math.abs(b[1]+0.5-ay)); });
  if(ring.length){ pl.x=(ring[0][0]+0.5)*T; pl.y=(ring[0][1]+0.45)*T; pl.dir="up"; }
}
function goAt(id,instant){
  if(!id) return false; var low=String(id).toLowerCase(), job=null, p, k;
  if(low==="hq") job={inst:hq,px:25.5*T,py:29.8*T};
  else if(low==="arcade") job={inst:hq,near:[8,14]};
  else if(low==="pier"&&RG&&RG.posById.pier) job={inst:ensureRegion(),tile:RG.posById.pier};
  else if(/^van-/.test(low)&&RG&&RG.posById[low]) job={inst:ensureRegion(),tile:RG.posById[low]};
  else if((p=findPlace(id))) job={inst:ensureRegion(),tile:p.door};
  else{ for(k in hq.objById){ if(k.toLowerCase()===low){ job={inst:hq,obj:hq.objById[k]}; break; } } }
  if(!job) return false;
  var run=function(){
    var tx=job.tile?(job.tile.x+0.5)*T:(job.px||25.5*T), ty=job.tile?(job.tile.y+0.6)*T:(job.py||29.8*T);
    enter(job.inst,tx,ty,"down");
    if(job.near){ var f=nearestFree(job.near[0],job.near[1],6); if(f){ pl.x=(f[0]+0.5)*T; pl.y=(f[1]+0.9)*T; } }
    if(job.obj) placeNearObj(job.obj);
    savePos(); focusCanvas();
  };
  if(state.list) setList(false,true);
  if(instant) run(); else travel(run);
  return true;
}
window.addEventListener("hashchange",function(){ var id=parseAt(); if(id&&!busy) goAt(id,false); });

/* ---------- per-frame ---------- */
function stage2Tick(dt,ts){
  frameNo++;
  if(ride) rideStep(dt);
  skyAt+=dt; if(skyAt>1){ skyAt=0; updateSky(); }
  crewAt+=dt; if(crewAt>0.6){ crewAt=0; tickCrew(); }
  checkExit(); checkDoorTile();
  miniAt+=dt; if(miniAt>0.22){ miniAt=0; miniDraw(ts); }
}

/* ---------- boot ---------- */
function boot(){
  try{ if(NS.people&&typeof NS.people.prewarm==="function") NS.people.prewarm(); }catch(e){}
  hq=makeHQ(); insts.hq=hq; useInst(hq);
  if(state.backOpen) setBackDoor(true);
  buildBlocked(); renderTiles(); hq.npcs=buildNpcs(); npcs=hq.npcs; hq.built=true; collectLightsFor(hq);
  resize();
  if(NS.region){ try{ RG=NS.region.get(); makeRegion(); }catch(e){ RG=null; delete insts.region; } }
  updateSky(); initCrew(); crewSettle();
  /* where to start: a link, the saved map, or the lobby */
  var at=parseAt(), startId=state.map||"hq", inst=hq, sx=state.x, sy=state.y, linked=false;
  if(startId==="region"&&insts.region) inst=insts.region;
  else if(startId.indexOf("shop:")===0&&RG){ var pr=findPlace(startId.slice(5)); if(pr) inst=shopInst(pr); }
  if(!(typeof sx==="number"&&typeof sy==="number")){ sx=inst.spawn.x; sy=inst.spawn.y; }
  useInst(inst); if(!inst.built){ buildBlocked(); inst.built=true; } if(inst.kind==="region") crewEnterRegion();
  if(blockedPx(sx*T,sy*T)){ sx=inst.spawn.x; sy=inst.spawn.y; }
  pl.x=sx*T; pl.y=sy*T; if(state.dir) pl.dir=state.dir; miniShow(inst.kind==="region");
  bakeAll();
  resize();
  if(at&&RG&&goAt(at,true)) linked=true;
  updateChip(false);
  var tt=barChip&&barChip.querySelector("[data-kw-total]"); if(tt) tt.textContent=String(totalSecrets());
  setList(state.list,true);
  if(!state.list) sync();
  if(foundCount()>=totalSecrets()&&!state.flags.finale) checkFinale();
  window.addEventListener("beforeunload",function(){ savePos(); });
  if(hint) canvas.addEventListener("focus",function(){ hint.classList.add("kw-hint-on"); });
  if(doc.fonts&&doc.fonts.ready) doc.fonts.ready.then(function(){ draw.dirty=true; });
}
/* ---------- quick actions (Kazim, 2026-10-06): jump to a place or start a game without walking there ---------- */
var QUICK_PLACES=[
  ["K13 HQ",[["hq","Lobby"],["arcade","Arcade hall"],["bench-eggtoss","Workshop"],["couch","Lounge"],["whiteboard","Studio floor"],["news-stand","The K13 Daily"]]],
  ["San Diego",[["van-hq","Downtown street"],["globalfork-littleitaly","Little Italy"],["station8-ucsd","UC San Diego"],["lobsterlab-delmar","Del Mar"],["pier","Worldwide pier"]]],
  ["North County and Orange County",[["thg-carlsbad","Carlsbad"],["cosmos-oceanside","Oceanside"],["miramar-sc","San Clemente"]]],
  ["Los Angeles",[["carlos-lacma","LACMA"]]]
];
var quickBtn=null, quickPanel=null;
function quickClose(){ if(quickPanel&&!quickPanel.hidden){ quickPanel.hidden=true; if(quickBtn) quickBtn.setAttribute("aria-expanded","false"); } }
function quickJump(id){ quickClose(); closeHelp(); if(!goAt(id,false)) showToast("That place is not on the map yet."); }
function quickPlay(gameId){
  quickClose(); closeHelp();
  var r=hq.objById["cab-"+gameId]; if(!r) return;
  if(!goAt("cab-"+gameId,false)) return;
  var tries=0;
  (function wait(){ if(busy&&tries++<60){ setTimeout(wait,60); return; } interact({kind:"obj",r:r}); })();
}
function quickBuild(){
  if(quickPanel) return;
  quickPanel=el("div","kw-quick"); quickPanel.id="kwQuickPanel"; quickPanel.hidden=true; quickPanel.setAttribute("role","dialog"); quickPanel.setAttribute("aria-label","Go to a place or play a game");
  var cols=el("div","kw-quick-cols"), left=el("div","kw-quick-col"), right=el("div","kw-quick-col");
  left.appendChild(el("h2","kw-quick-h","Go to"));
  QUICK_PLACES.forEach(function(g){
    var list=g[1].filter(function(it){ return /^(hq|arcade|pier|van-)/.test(it[0])||!hq.objById||!/^(bench-|couch|whiteboard|news-stand)/.test(it[0])||hq.objById[it[0]]; });
    if(!list.length) return;
    left.appendChild(el("p","kw-quick-g",g[0]));
    var row=el("div","kw-quick-row");
    list.forEach(function(it){ var b=el("button","kw-quick-b",it[1]); b.type="button"; b.addEventListener("click",function(){ quickJump(it[0]); }); row.appendChild(b); });
    left.appendChild(row);
  });
  right.appendChild(el("h2","kw-quick-h","Play a game"));
  var grid=el("div","kw-quick-row kw-quick-games");
  (map.games||[]).forEach(function(g){ if(!hq.objById["cab-"+g.id]) return; var b=el("button","kw-quick-b kw-quick-play",g.title); b.type="button"; b.addEventListener("click",function(){ quickPlay(g.id); }); grid.appendChild(b); });
  right.appendChild(grid);
  cols.appendChild(left); cols.appendChild(right); quickPanel.appendChild(cols);
  var x=el("button","kw-help-x","Close"); x.type="button"; x.addEventListener("click",function(){ quickClose(); focusCanvas(); }); quickPanel.appendChild(x);
  quickPanel.addEventListener("keydown",function(e){ if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); quickClose(); if(quickBtn) quickBtn.focus(); } });
  stageEl.appendChild(quickPanel);
}
function quickToggle(){ quickBuild(); var open=quickPanel.hidden; closeHelp(); quickPanel.hidden=!open; quickBtn.setAttribute("aria-expanded",String(open)); if(open){ var f=quickPanel.querySelector("button"); try{ f&&f.focus({preventScroll:true}); }catch(e){} } }
(function(){
  var bar=$("kwBar"), help=$("kwHelp"); if(!bar) return;
  quickBtn=el("button","kw-btn kw-btn-go","Go to"); quickBtn.type="button"; quickBtn.id="kwGo";
  quickBtn.setAttribute("aria-expanded","false"); quickBtn.setAttribute("aria-controls","kwQuickPanel");
  var key=el("kbd","kw-kbd","G"); key.setAttribute("aria-hidden","true"); quickBtn.appendChild(key);
  quickBtn.addEventListener("click",quickToggle);
  if(help) bar.insertBefore(quickBtn,help); else bar.appendChild(quickBtn);
})();

boot();
NS.engine={version:2};
})();
