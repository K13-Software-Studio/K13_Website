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

/* ---------- people: the body size and frame counts come from people.js (16x32 with 8 walk frames), with the old 16x24 / 4 as the fallback ---------- */
var PEO=NS.people||null, PSZ=(PEO&&PEO.size)||{}, PW=PSZ.w||16, PH=PSZ.h||24, PORT=PSZ.portrait||32, FRS=(PEO&&PEO.frames)||null, FRW=(FRS&&FRS.walk)||4, NEWB=!!FRS;
var IDLE=NEWB?((typeof FRS.idle==="number"&&FRS.idle>=FRW)?FRS.idle:FRW):4, SPY=PH-5;   /* SPY: the sprite top sits SPY px above the feet position */
function cleanName(v){ return String(v==null?"":v).replace(/[<>&"\u0000-\u001f\u007f]/g,"").replace(/\s+/g," ").replace(/^\s+/,"").slice(0,16).replace(/\s+$/,""); }

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
  s.sound=!!s.sound;
  if(!s.tasks||typeof s.tasks!=="object"||Array.isArray(s.tasks)) s.tasks={};
  if(!Array.isArray(s.stickers)) s.stickers=[];
  if(!s.me||typeof s.me!=="object"||!s.me.look||typeof s.me.look!=="object"||Array.isArray(s.me.look)) s.me=null;
  else{ s.me.name=cleanName(s.me.name); if(typeof s.me.visits!=="number") s.me.visits=1; }
  return s;
}
var state=loadState(), saveAt=0, me=state.me;
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){} }

/* ---------- the maps: HQ interior, the region, one small interior per shop ---------- */
var rows=null, blk=new Uint8Array(1), cur=null, insts={}, RG=null, hq=null, objs=[], objById={}, tileC=null, npcs=[], byNorm={}, allLights=[];
function tileOpen(tx,ty){ return tx>=0&&ty>=0&&tx<MW&&ty<MH&&rows[ty][tx]!=="#"&&rows[ty][tx]!==" "; }
function isFloor(tx,ty){ return tileOpen(tx,ty); }

var ANIM={"neon-k13":1,"neon-free":1,"screens":1,"scoreboard":1,"fishtank":1,"records":1,"claw":1,"pinball":1,"coffee":1,"radio":1,"keypad":1,"printer":1,"whiteboard":0};
var ANIMK={stage:1,aquarium:1,griddle:1,greenery:1,brandwall:1,ticker:1,scalebar:1,mural:1,eggbar:1,menuboard:1,brandsign:1,kiosk:1,stringlights:1,djbooth:1,hallsign:1,stalls:1};
function mkObjs(list){
  return list.map(function(o){
    var fh=o.fh||o.h, wall=o.layer==="wall";
    return {o:o,wall:wall,floorL:o.layer==="floor",
      fx:o.x*T, fy:wall?o.y*T:(o.y+o.h-fh)*T, fw:o.w*T, fhp:wall?o.h*T:fh*T,
      sortY:(o.y+o.h)*T, sx:o.x*T-GP, sy:o.y*T-GP, spr:null, anim:!!(ANIM[o.id]||o.kind==="cabinet"||o.r4==="item"||ANIMK[o.tkind||""]), last:-1e9, hidden:false, title:o.title||(o.rec?o.rec.name:"")};
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
  var c=mk(PW,PH), cx=c.getContext("2d"), P=peopleApi(), ok=false; cx.imageSmoothingEnabled=false;
  if(P){ try{ ok=P.draw(cx,id,dir,frame,anchor.x,anchor.y,1)!==false; }catch(e){ ok=false; } }
  if(!ok){
    cx.clearRect(0,0,PW,PH); cx.save(); cx.translate(0,PH-24);
    var col=PCOL[Math.floor(hash(id.length,id.charCodeAt(0)||1,7)*PCOL.length)];
    var bob=(frame<FRW&&(frame%2))?1:0;
    fr(cx,"rgba(0,0,0,.25)",3,22,10,2);
    fr(cx,"#1F2023",4,10+bob,8,12); fr(cx,col,5,11+bob,6,9);
    fr(cx,"#1F2023",4,2+bob,8,9); fr(cx,"#E8C8A0",5,3+bob,6,7);
    if(dir==="up") fr(cx,"#3A2A20",5,3+bob,6,4); else { fr(cx,"#1F2023",6,6+bob,1,1); fr(cx,"#1F2023",9,6+bob,1,1); }
    cx.restore();
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
    var n={id:p.id,name:p.name||post.name||p.id,role:p.role||"",x:(post.x+0.5)*T,y:(post.y+0.5)*T,dir:"down",frame:IDLE,
      home:post,wander:[[post.x,post.y]].concat(post.wander||[]),baseWander:null,path:null,pi:0,timer:1+Math.random()*4,state:"idle",walkT:Math.random()*4,walkT0:Math.random()*2,talking:false};
    n.baseWander=n.wander; out.push(n); byNorm[norm(p.id)]=n;
  });
  var cat=makePet(); if(cat) out.push(cat);
  return out;
}

/* ---------- player ---------- */
var pl={x:(map.spawn.x)*T,y:(map.spawn.y)*T,dir:"down",frame:IDLE,walkT:0,path:null,pi:0,pending:null,stuck:0};

/* ---------- DOM ---------- */
var canvas=el("canvas","kw-canvas"); canvas.tabIndex=0; canvas.setAttribute("role","application");
canvas.setAttribute("aria-label","K13 Studio, an interactive room. Arrows or WASD walk, E uses what is near, T opens emotes. A list version of everything is one button away: Prefer a list.");
canvas.setAttribute("aria-describedby","kwLive");
var ctx=canvas.getContext("2d");
var prompt=el("div","kw-prompt"); prompt.hidden=true;
var pKey=el("span","kw-key","E"), pTx=el("span","kw-ptx"); prompt.appendChild(pKey); prompt.appendChild(pTx);
var say=el("div","kw-say"); say.hidden=true; say.setAttribute("role","group");
var sayFace=el("canvas","kw-say-face"); sayFace.width=PORT; sayFace.height=PORT; sayFace.setAttribute("aria-hidden","true");
var sayBody=el("div","kw-say-body"), sayName=el("b","kw-say-name"), sayRole=el("span","kw-say-role"), sayText=el("p","kw-say-text"), sayNext=el("button","kw-say-next","Next");
var sayTyped=el("span","kw-say-typed"), sayFullEl=el("span","vh"); sayTyped.setAttribute("aria-hidden","true"); sayText.appendChild(sayTyped); sayText.appendChild(sayFullEl);
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
  "<li><b>Crew</b> will talk if you stand next to them. <b>Pixel</b>, the studio cat, likes to be petted.</li>"+
  "<li><b>Emotes</b>: press T, or the Emote button, to say it without words.</li>"+
  "<li><b>Sound</b> is off until you turn it on with the Sound button.</li>"+
  "<li><b>Doors</b> lead out to the street and into every shop. The <b>K13 van</b> at a bus stop takes you up and down the coast.</li>"+
  "<li><b>The map</b> in the corner shows where you are. Tap it to walk there.</li>"+
  "<li><b>13 secrets</b> hide in the details. Look at everything.</li></ul>";
var helpStick=el("li","kw-help-stk"); helpPanel.querySelector(".kw-help-l").appendChild(helpStick);
function stickerTotal(){ var m=(NS.data&&NS.data.shops)||{}, n=0, k; for(k in m) if(m[k]&&m[k].task) n++; return n||13; }
function stickerHelp(){ helpStick.innerHTML="<b>Stickers</b>: <span class=\"kw-stk-n\">"+state.stickers.length+"</span> of "+stickerTotal()+". Talk to the staff at a counter, do the small errand, bring it back."; }
var helpClose=el("button","kw-help-x","Got it"), helpLook=el("button","kw-help-x kw-help-alt","Change look"); helpClose.type="button"; helpLook.type="button";
var helpRow=el("div","kw-help-row"); helpRow.appendChild(helpClose); helpRow.appendChild(helpLook); helpPanel.appendChild(helpRow);
helpLook.addEventListener("click",function(){ openWho(true); });
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
  if(booted&&!raf&&!state.list&&cur){ cameraStep(0.016); render(performance.now()); }   /* a resize clears the canvas: repaint when the loop is paused (a dialog is open) */
}
var booted=false;

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
  for(var i=0;i<npcs.length;i++){ var n=npcs[i], dx=n.x-px, dy=n.y-py, d2=dx*dx+dy*dy; if(n.pet) continue;
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
  for(i=0;i<npcs.length;i++){ var n=npcs[i]; d=Math.sqrt((n.x-pl.x)*(n.x-pl.x)+(n.y-pl.y)*(n.y-pl.y)); if(d>(n.staff?34:24)) continue;
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
  if(t.kind==="npc") return (t.n.pet?"Pet ":"Talk to ")+t.n.name.split(" (")[0];
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
  if(r.found){ sfx("found"); save(); updateChip(true); if(!quiet) showToast("Secret "+foundCount()+"/"+totalSecrets()+": "+(r.title||r.found),4200); }
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

/* ---------- dialogue: the big portrait with its expression, text that types itself, and a blip per word ---------- */
var sayPages=[], sayI=0, sayDone=null, sayOpen=false, sayNpc=null, sayBase=null, sayCta=null;
var sayFaceId=null, sayExpr="neutral", sayFull="", sayChars=0, sayTyping=false, sayFaceAt=0, sayBlipAt=0;
function exprFor(txt,i){
  if(/\?\s*$/.test(txt)) return "thinking";
  if(/!/.test(txt)) return "surprised";
  return i===0?"happy":"neutral";
}
function paintFace(t){
  var f=sayFace.getContext("2d"); f.imageSmoothingEnabled=false; f.clearRect(0,0,PORT,PORT);
  if(!sayFaceId){ sayFace.hidden=true; return; }
  sayFace.hidden=false; var P=peopleApi();
  if(sayNpc&&sayNpc.look&&NS.people&&typeof NS.people.portraitLook==="function"){ try{ if(NS.people.portraitLook(f,sayNpc.look,0,0,1,sayExpr)!==false) return; }catch(e){} }
  if(P){
    try{
      if(typeof P.portraitAt==="function"){ if(P.portraitAt(f,sayFaceId,0,0,1,sayExpr,t,!!sayTyping&&!reduced)!==false) return; }
      else if(typeof P.portrait==="function"){ if(P.portrait(f,sayFaceId,0,0,1,sayExpr)!==false) return; }
    }catch(e){}
  }
  f.clearRect(0,0,PORT,PORT); f.drawImage(personSprite(sayFaceId,"down",IDLE),0,0,PW,Math.min(PH,16),0,0,PORT,PORT*Math.min(PH,16)/PW);
}
function drawFace(id){ sayFaceId=id||null; paintFace(time); }
function openSay(name,role,pages,faceId,onDone,npc){
  sayPages=pages.length?pages:["..."]; sayI=0; sayBase={name:name,role:role,face:faceId}; sayDone=onDone||null; sayOpen=true; sayNpc=npc||null;
  sayName.textContent=name; sayRole.textContent=role||""; sayRole.hidden=!role;
  say.hidden=false; useBtn.hidden=true; prompt.hidden=true; closeEmo(); showPage();
  pl.path=null; pl.pending=null; sfx("talk");
}
function showPage(){
  var pg=sayPages[sayI], txt=typeof pg==="string"?pg:pg.say;
  if(typeof pg==="object"&&pg.name){ sayName.textContent=pg.name; sayRole.textContent=""; sayRole.hidden=true; sayFaceId=pg.who||null; }
  else if(sayBase&&sayI===0){ sayName.textContent=sayBase.name; sayRole.textContent=sayBase.role||""; sayRole.hidden=!sayBase.role; sayFaceId=sayBase.face||null; }
  var last=sayI>=sayPages.length-1;
  sayCtaEl.hidden=!(last&&sayCta); if(last&&sayCta){ sayCtaEl.textContent=sayCta.label; sayCtaEl.href=sayCta.href; }
  sayFull=txt; sayFullEl.textContent=txt; sayExpr=exprFor(txt,sayI);
  if(reduced){ sayTyped.textContent=txt; sayTyping=false; sayChars=txt.length; } else { sayTyped.textContent=""; sayTyping=true; sayChars=0; }
  paintFace(time);
  sayNext.textContent=last?"Done":"Next";
  say.classList.remove("kw-on"); void say.offsetWidth; say.classList.add("kw-on");
  if(live) live.textContent=sayName.textContent+": "+txt;
}
function sayTick(dt,ts){
  if(!sayOpen) return;
  if(sayTyping){
    var before=Math.floor(sayChars); sayChars+=dt*54; var n=Math.floor(sayChars);
    if(n>=sayFull.length){ n=sayFull.length; sayTyping=false; sayTyped.textContent=sayFull; paintFace(time); }
    else{ sayTyped.textContent=sayFull.slice(0,n); if(n!==before&&n%3===0&&/\S/.test(sayFull.charAt(n-1))) sfx("type",sayFaceId); }
  }
  if(sayFaceId&&ts-sayFaceAt>110){ sayFaceAt=ts; paintFace(time); }
}
function advanceSay(){
  if(!sayOpen) return;
  if(sayTyping){ sayTyping=false; sayTyped.textContent=sayFull; paintFace(time); return; }
  if(sayI<sayPages.length-1){ sayI++; showPage(); sfx("tick"); return; }
  closeSay();
}
function closeSay(){
  if(!sayOpen) return; sayOpen=false; say.hidden=true; sayCta=null; sayCtaEl.hidden=true; sayTyping=false;
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
  if(n.pet){ petIt(n); return; }
  if(n.staff){ staffTalk(n); return; }
  if(n.customer){ guestTalk(n); return; }
  var P=NS.people, S=NS.secrets, pages=[];
  if(P&&typeof P.lines==="function"){ try{ pages=asPages(P.lines(n.id,state)); }catch(e){ pages=[]; } }
  if(!pages.length){ pages=["Hi, I am "+n.name.split(" (")[0]+".","Welcome to K13 Studio. Look around and poke at things."];
    if(S&&typeof S.hintFor==="function"){ try{ var h=S.hintFor(n.id,state); if(typeof h==="string"&&h) pages.push(h); }catch(e){} } }
  if(S&&typeof S.onTalk==="function"){ try{ var tr=S.onTalk(n.id,state); if(tr&&tr.say){ pages.push(tr.say); absorb(tr,true); if(tr.found) showToast("Secret "+foundCount()+"/"+totalSecrets()+": "+(tr.title||tr.found),4200); } }catch(e){} }
  else state.talked[n.id]=true;
  if(me&&norm(n.id)==="kazim"){ var nm=me.name; pages.unshift((me.visits>1?"Welcome back":"Welcome")+(nm?", "+nm:"")+"."); }
  save(); checkFinale();
  n.talking=true; n.dir=dirOf(pl.x-n.x,pl.y-n.y,n.dir); n.frame=IDLE; n.path=null; setEmote(n,"laugh",1.8);
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
  prompt.hidden=true; useBtn.hidden=true; sync(); sfx("open");
  var fire=function(){ try{ window.dispatchEvent(new Event("resize")); }catch(e){} };
  requestAnimationFrame(function(){ fire(); requestAnimationFrame(function(){ fire(); setTimeout(fire,120); }); });
  setTimeout(function(){
    if(!modal) return;
    var cv=modal.card.querySelector("canvas[tabindex]"); try{ (cv||cabX).focus({preventScroll:true}); }catch(e){}
  },60);
}
function closeModal(){
  if(!modal) return;
  if(fsNow()){ try{ (doc.exitFullscreen||doc.webkitExitFullscreen).call(doc); }catch(e){} }
  var m=modal; modal=null;
  try{ if(dlg.open&&dlg.close) dlg.close(); else dlg.removeAttribute("open"); }catch(e){ dlg.removeAttribute("open"); }
  if(m.note.parentNode){ m.note.parentNode.insertBefore(m.card,m.note); m.note.parentNode.removeChild(m.note); } else m.from.appendChild(m.card);
  cabMq.textContent="";
  try{ window.dispatchEvent(new Event("resize")); }catch(e){}
  sync(); draw.dirty=true; lastTargetKey=""; sfx("close");
  try{ canvas.focus({preventScroll:true}); }catch(e){}
  if(m.after) m.after();
}
cabX.addEventListener("click",closeModal);
dlg.addEventListener("cancel",function(e){ e.preventDefault(); if(fsGuard()) return; closeModal(); });
dlg.addEventListener("click",function(e){ if(e.target===dlg) closeModal(); });
function fsNow(){ return !!(doc.fullscreenElement||doc.webkitFullscreenElement); }
var fsLeft=0;
function fsChange(){ if(!fsNow()) fsLeft=performance.now(); if(modal){ try{ window.dispatchEvent(new Event("resize")); }catch(e){} } }
doc.addEventListener("fullscreenchange",fsChange); doc.addEventListener("webkitfullscreenchange",fsChange);
function fsGuard(){ return fsNow()||performance.now()-fsLeft<450; }
window.addEventListener("keydown",function(e){ if(e.key==="Escape"){ if(modal&&fsGuard()) return; if(modal){ e.preventDefault(); closeModal(); } else if(vanOpen){ e.preventDefault(); closeVan(); } } },true);

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
  if(o.act==="shot"){ if(o.shop&&shopHas(o.shop.key)) openSite([o.shop.key],o.shop.key); else openShopInfo(o.shop); return; }
  if(o.act==="site"){ openSite(o.siteKeys||[],(o.siteKeys||[])[0]); return; }
  if(o.act==="menu"){ readMenu(o); return; }
  if(o.act==="pickup"){ takeItem(r); return; }
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
  if(k==="t"||k==="T"){ e.preventDefault(); toggleEmo(); }
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
  for(i=0;i<npcs.length;i++){ var n=npcs[i]; if(wx>=n.x-8&&wx<=n.x+8&&wy>=n.y-(n.pet?13:SPY+1)&&wy<=n.y+5){ if(n.y>by){ by=n.y; best={kind:"npc",n:n}; } } }
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
    if(hit.kind==="npc"&&hit.n.staff){ var sr=hit.n.staff.rect; walkNear(sr.x,sr.y,sr.x+sr.w-1,sr.y+sr.h-1,hit); }
    else if(hit.kind==="npc"){ var tx=Math.floor(hit.n.x/T), ty=Math.floor(hit.n.y/T); walkNear(tx,ty,tx,ty,hit); }
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

function toggleHelp(){ closeEmo(); sfx("tick"); stickerHelp(); helpPanel.hidden=!helpPanel.hidden; if(barHelp) barHelp.setAttribute("aria-expanded",String(!helpPanel.hidden)); }
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

function idleFrame(ph){ return NEWB?IDLE:((Math.floor(time*0.9+ph)%2)?5:4); }
function updateNpc(n,dt){
  if(n.pet){ updatePet(n,dt); return; }
  var d=Math.sqrt((n.x-pl.x)*(n.x-pl.x)+(n.y-pl.y)*(n.y-pl.y));
  if(n.talking){ n.frame=idleFrame(n.walkT0||0); return; }
  if(d<26&&n.state!=="walk"){ n.dir=dirOf(pl.x-n.x,pl.y-n.y,n.dir); n.frame=idleFrame(n.walkT0||0); return; }
  if(n.state==="idle"){
    n.frame=idleFrame(n.walkT0||0); n.timer-=dt;
    if(n.timer<=0){
      var w=n.wander, pick=w[(Math.random()*w.length)|0], cx=Math.floor(n.x/T), cy=Math.floor(n.y/T);
      if(pick[0]===cx&&pick[1]===cy){ n.timer=1.5+Math.random()*3; n.dir=n.hold||["down","left","right","up"][(Math.random()*4)|0]; return; }
      var p=findPath(cx,cy,pick[0],pick[1]);
      if(p&&p.length){ n.path=p; n.pi=0; n.state="walk"; } else n.timer=3;
    }
  }else{
    var t=n.path[n.pi]; if(!t){ n.state="idle"; n.timer=2+Math.random()*6; n.frame=IDLE; return; }
    var tx=(t[0]+0.5)*T, ty=(t[1]+0.5)*T, dx=tx-n.x, dy=ty-n.y, dist=Math.sqrt(dx*dx+dy*dy), step=NPC_SPEED*dt;
    if(d<14){ n.frame=IDLE; return; }                     /* never walk into the visitor */
    if(dist<=step){ n.x=tx; n.y=ty; n.pi++; if(n.pi>=n.path.length){ n.state="idle"; n.timer=2+Math.random()*6; n.frame=IDLE; } }
    else{ n.x+=dx/dist*step; n.y+=dy/dist*step; n.dir=dirOf(dx,dy,n.dir); n.walkT+=dt; n.frame=Math.floor(n.walkT*(NEWB?0.95:1.5)*FRW)%FRW; }
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
  if(moved){ pl.walkT+=dt; pl.frame=Math.floor(pl.walkT*(NEWB?2.2:2)*(cur.kind==="region"?1.3:1)*FRW)%FRW; } else pl.frame=idleFrame(0);
  return moved;
}
function finishPath(){
  var pend=pl.pending; pl.path=null; pl.pending=null;
  if(pend){
    var t=pend.kind==="npc"?{kind:"npc",n:pend.n}:{kind:"obj",r:pend.r}, cx, cy;
    if(t.kind==="npc"){ cx=t.n.x; cy=t.n.y; } else { cx=t.r.fx+t.r.fw/2; cy=t.r.fy+t.r.fhp/2; }
    pl.dir=dirOf(cx-pl.x,cy-pl.y,pl.dir);
    var near=t.kind==="npc"?Math.sqrt((t.n.x-pl.x)*(t.n.x-pl.x)+(t.n.y-pl.y)*(t.n.y-pl.y))<=(t.n.staff?40:28):rectDist(pl.x,pl.y,t.r.fx,t.r.fy,t.r.fw,t.r.fhp)<=14;
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
  r3Tick(dt,ts);
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
  useBtn.textContent=t.kind==="npc"?(t.n.pet?"Pet":"Talk"):(t.r.o.act==="game"||t.r.o.act==="toy"?"Play":"Use"); useBtn.hidden=!(coarse||window.innerWidth<700);
}
function positionPrompt(){
  if(!target||prompt.hidden) return;
  var wx, wy;
  if(target.kind==="npc"){ wx=target.n.x; wy=target.n.y-(target.n.pet?17:SPY+7); }
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
  for(i=0;i<npcs.length;i++){ var n=npcs[i]; if(inView2(n.x-PW/2-4,n.y-SPY-16,PW+8,PH+24)) list.push({y:n.sortY||n.y,n:n}); }
  if(!ride) list.push({y:pl.y,p:true});
  list.sort(function(a,b){ return a.y-b.y; });
  for(i=0;i<list.length;i++){
    var it=list[i];
    if(it.r) drawSprite(it.r.spr,it.r.sx,it.r.sy);
    else if(it.n){ drawNpcBody(it.n); }
    else{ shadow(pl.x,pl.y,1); drawSprite(playerSprite(pl.dir,pl.frame),pl.x-PW/2,pl.y-SPY); }
  }
  if(ride) drawVan();
  drawOverheads(list,tms);
  /* the thing you can use */
  if(target&&!sayOpen) bracket(target,tms);
  if(tapFx&&!reduced){ var q=tapFx.t/0.5; ctx.strokeStyle="rgba(240,180,41,"+(1-q).toFixed(2)+")"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(tapFx.x,tapFx.y+3,2+q*7,0,6.2832); ctx.stroke(); }
  lighting(tms);
}
/* ground shadow from people.js (x = centre, y = ground line, drawn before the sprite); k < 1 is the cat */
function shadow(x,y,k){
  var P=NS.people, px=Math.round(x), py=Math.round(y)+6;
  if(P&&typeof P.shadow==="function"){ try{ P.shadow(ctx,px,py,1,k<1?9:11); return; }catch(e){} }
  var w=Math.round(5*(k||1));
  ctx.fillStyle="rgba(0,0,0,.14)"; ctx.fillRect(px-w,py-3,w*2,3); ctx.fillRect(px-w+1,py-1,w*2-2,1);
}
function bracket(t,tms){
  var x,y,w,h;
  if(t.kind==="npc"){ x=t.n.x-8; w=16; if(t.n.pet){ y=t.n.y-12; h=17; } else { y=t.n.y-SPY-2; h=SPY+7; } }
  else{ x=t.r.o.x*T; y=t.r.o.y*T; w=t.r.o.w*T; h=t.r.o.h*T; }
  var o=reduced?0:Math.round(Math.sin(tms/260)*0.9+0.9), L=3;
  ctx.fillStyle="#F0B429";
  x-=o; y-=o; w+=o*2; h+=o*2;
  ctx.fillRect(x,y,L,1); ctx.fillRect(x,y,1,L); ctx.fillRect(x+w-L,y,L,1); ctx.fillRect(x+w-1,y,1,L);
  ctx.fillRect(x,y+h-1,L,1); ctx.fillRect(x,y+h-L,1,L); ctx.fillRect(x+w-L,y+h-1,L,1); ctx.fillRect(x+w-1,y+h-L,1,L);
}
function windowLight(){
  if(cur.id!=="hq") return;
  var i, r, ph=skyPhase, col, k=1;
  if(ph==="dusk"){ col="rgba(255,150,72,.27)"; k=1.45; }
  else if(ph==="dawn"){ col="rgba(255,196,150,.2)"; k=1.15; }
  else if(ph==="night") col="rgba(150,185,215,.07)";
  else col="rgba(255,232,180,.17)";
  for(i=1;i<=6;i++){
    r=objById["window-"+i]; if(!r||!inView2(r.fx,r.fy,r.fw,200)) continue;
    var x0=r.fx+2, x1=r.fx+r.fw-2, y0=r.fy+r.fhp, len=T*(r.o.room==="arcade"?5:4.5)*k, dx=T*1.6*k;
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y0); ctx.lineTo(x1+dx,y0+len); ctx.lineTo(x0+dx,y0+len); ctx.closePath(); ctx.fill();
  }
}
function lighting(tms){
  var reg=cur.kind==="region", dk=reg?skyDk:Math.max(dark?1:0,skyDk*0.85);
  if(reg&&!reduced&&skyDk<0.45) drawClouds(tms);
  if(reg&&skyTint){ ctx.fillStyle=skyTint; ctx.fillRect(camRX,camRY,vw,vh); }
  else if(!reg&&cur.kind==="hq"&&skyPhase==="dusk"){ ctx.fillStyle="rgba(255,140,70,.06)"; ctx.fillRect(camRX,camRY,vw,vh); }
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
var fitPrev=false, busy=false, infoOpen=false, siteOpen=false, crowdAt2=0, vanOpen=false, vanFrom="", ride=null, exitCool=0, skyAt=0, crewAt=0, miniAt=0, frameNo=0, skyHour=12;
function ui(){ return !!(modal||infoOpen||vanOpen||whoOpen||siteOpen); }
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
  if(busy) return; busy=true; keys={}; pl.path=null; pl.pending=null; sfx("door");
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
  if(inst.kind==="hq") routineApply(true);
  if(inst.kind==="shop"){ crowdSync(inst); taskSync(inst); }
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
  rec=rec.building||rec;
  var id="shop:"+rec.id; if(insts[id]) return insts[id];
  var def=NS.region.shopDef(rec), tc=mk(def.w*T,def.h*T);
  try{ def.paint(tc.getContext("2d")); }catch(e){}
  var inst={id:id,kind:"shop",name:rec.name,def:def,w:def.w,h:def.h,rows:def.rows.map(function(r){ return r.split(""); }),rooms:def.rooms,spawn:def.spawn,npcs:[],lights:[],exit:def.exit,
    blk:new Uint8Array(def.w*def.h),tileC:tc,objs:mkObjs(def.objects),stale:false,rec:rec};
  indexObjs(inst); insts[id]=inst; collectLightsFor(inst);
  makeStaff(inst);
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
  sfx("open"); vanOpen=true; vanEl.hidden=false; prompt.hidden=true; useBtn.hidden=true; keys={}; sync();
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

/* ---------- round 4: staff, guests, errands, the menu board and the site screen ---------- */
function shopData(key){ return NS.region&&NS.region.shopOf?NS.region.shopOf(key,key,""):{name:key,menu:[],images:[],palette:[],task:null,real:false}; }
function shopHas(key){ var m=NS.data&&NS.data.shops; return !!(m&&m[key]); }
function peopleLook(seed){ var P=NS.people; if(P&&typeof P.randomLook==="function"){ try{ return P.randomLook(seed); }catch(e){} } return null; }
function mkPerson(id,name,role,tx,ty,look,dir){
  return {id:id,name:name,role:role,x:tx*T,y:ty*T,dir:dir||"down",frame:IDLE,home:{x:Math.floor(tx),y:Math.floor(ty)},wander:[[Math.floor(tx),Math.floor(ty)]],baseWander:null,path:null,pi:0,timer:2+Math.random()*4,state:"idle",walkT:Math.random()*4,walkT0:Math.random()*2,talking:false,look:look,hold:dir||"down"};
}
function makeStaff(inst){
  var def=inst.def, list=def&&def.staff||[], P=NS.people;
  if(!P||typeof P.drawLook!=="function") return;
  list.forEach(function(sp){ var look=peopleLook(sp.seed); if(!look) return;
    var n=mkPerson("staff:"+inst.id+":"+sp.key,sp.name,sp.role,sp.x,sp.y,look,"down"); n.staff={key:sp.key,rect:sp.rect,brand:sp.role}; n.baseWander=n.wander; inst.npcs.push(n); });
}
function dayKey(){ var d=new Date(); function z(v){ return v<10?"0"+v:""+v; } return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate()); }
function hourBucket(h){ return (h>=6&&h<11)?"morning":(h>=11&&h<15)?"noon":(h>=15&&h<21)?"evening":"night"; }
/* guests: the hour decides how many, and who */
function crowdSync(inst){
  if(!inst||inst.kind!=="shop"||!inst.def||!inst.def.seats||!hasLooks()) return;
  var bk=hourBucket(skyHour); if(inst.crowdKey===bk) return; inst.crowdKey=bk;
  inst.npcs.forEach(function(n){ if(n.customer&&n.seatTile) inst.blk[n.seatTile]=0; });
  inst.npcs=inst.npcs.filter(function(n){ return !n.customer; }); if(inst===cur) npcs=inst.npcs;
  var seats=inst.def.seats.slice(), level=inst.def.crowdAt(skyHour), cap=Math.min(seats.length,10), cnt=Math.round(level*cap), i;
  if(level>0.15&&cnt<1) cnt=1; cnt=Math.min(cnt,seats.length);
  seats.sort(function(a,b){ return hash(a.x,a.y,31)-hash(b.x,b.y,31); });
  for(i=0;i<cnt;i++){ var st=seats[i], look=peopleLook(NS.region.seedOf(inst.id+"|"+bk+"|"+i)); if(!look) continue;
    var n=mkPerson("guest:"+inst.id+":"+i,"Guest","Visiting",st.x+0.5,st.y+0.62,look,st.dir); n.customer=true; n.baseWander=n.wander; n.seatTile=st.y*inst.w+st.x; inst.blk[n.seatTile]=1; inst.npcs.push(n); }
  if(inst===cur) npcs=inst.npcs;
}
var GUEST_LINES=["Good seat, this one.","I come here most days.","Have you tried the menu board? Read it before you order.","The staff behind the counter might need a hand."];
function guestTalk(n){ var k=NS.region.seedOf(n.id)%GUEST_LINES.length; n.talking=true; n.dir=dirOf(pl.x-n.x,pl.y-n.y,n.dir); n.frame=IDLE; n.path=null; openSay("Guest","",[GUEST_LINES[k]],"@look",null,n); }
function taskState(key){ var t=state.tasks[key]; return (t&&t.day===dayKey())?t:null; }
function staffOf(inst,key){ for(var i=0;i<inst.npcs.length;i++) if(inst.npcs[i].staff&&inst.npcs[i].staff.key===key) return inst.npcs[i]; return null; }
function taskEmote(inst,key){ var n=staffOf(inst,key); if(!n) return; var st=taskState(key); n.rk=(st&&st.s==="asked")?"question":((st&&st.s==="got")?"idea":null); }
function pickupSpot(inst,key){
  var sx=Math.floor(inst.spawn.x), sy=Math.floor(inst.spawn.y), cand=[], x, y, base=NS.region.seedOf(key+inst.id);
  for(y=3;y<inst.h-2;y++) for(x=1;x<inst.w-1;x++){ if(inst.blk[y*inst.w+x]||inst.rows[y][x]!==".") continue; if(Math.abs(x-sx)+Math.abs(y-sy)<4) continue; cand.push([x,y]); }
  cand.sort(function(a,b){ return hash(a[0],a[1],base%97)-hash(b[0],b[1],base%97); });
  var keep=cur; useInst(inst); var out=null, i;
  for(i=0;i<cand.length&&i<40&&!out;i++){ var occupied=false; inst.objs.forEach(function(r){ if(r.o.act==="pickup"&&r.o.x===cand[i][0]&&r.o.y===cand[i][1]) occupied=true; }); if(!occupied&&findPath(sx,sy,cand[i][0],cand[i][1])) out=cand[i]; }
  if(keep) useInst(keep); return out;
}
function addPickup(inst,key){
  var sh=shopData(key), tk=sh.task; if(!tk||!tk.item) return;
  for(var i=0;i<inst.objs.length;i++) if(inst.objs[i].o.id==="item-"+key) return;
  if(!inst.built){ var kp=cur; useInst(inst); buildBlocked(); inst.built=true; if(kp) useInst(kp); }
  var sp=pickupSpot(inst,key); if(!sp) return;
  var o={id:"item-"+key,kind:"item",x:sp[0],y:sp[1],w:1,h:1,solid:false,act:"pickup",label:"Pick up "+tk.item,title:tk.item,room:"shop",paint:true,r4:"item",palette:sh.palette,taskKey:key,look:tk.item};
  var r=mkObjs([o])[0]; inst.objs.push(r); inst.objById[o.id]=r; if(inst===cur){ objs=inst.objs; }
  draw.dirty=true;
}
function taskSync(inst){
  if(!inst||inst.kind!=="shop"||!inst.def) return; var shops=inst.def.shops||{}, k;
  for(k in shops){ var st=taskState(k); if(st&&st.s==="asked") addPickup(inst,k); taskEmote(inst,k); }
}
function staffTalk(n){
  var key=n.staff.key, sh=shopData(key), tk=sh.task, st=taskState(key), pages=[], greet="Welcome to "+n.staff.brand+".";
  if(!tk||!tk.ask) pages=[greet,"Today's list is on the menu board. The screen by the wall shows the live site."];
  else if(!st){ pages=[greet,tk.ask,"It is somewhere in this room, a small glowing thing."]; state.tasks[key]={day:dayKey(),s:"asked"}; save(); addPickup(cur,key); taskEmote(cur,key); }
  else if(st.s==="asked") pages=["Still looking? "+tk.ask,"It is somewhere in this room, a small glowing thing."];
  else if(st.s==="got"){ pages=[tk.thanks||"Thank you.",tk.give||"Here is a sticker."]; st.s="done"; save();
    var have=state.stickers.some(function(x){ return x.id===key; });
    if(!have){ state.stickers.push({id:key,name:sh.name,day:dayKey()}); save(); sfx("found"); showToast("Sticker for "+sh.name+". You have "+state.stickers.length+" of "+stickerTotal()+".",4200); }
    else showToast("Thanks again. You already have the "+sh.name+" sticker.",3600);
    taskEmote(cur,key); }
  else pages=["Thanks again. That is all for today. Come back tomorrow."];
  n.talking=true; n.dir=dirOf(pl.x-n.x,pl.y-n.y,n.dir); n.frame=IDLE; n.path=null;
  openSay(n.name,n.staff.brand,pages,"@look",null,n);
}
function takeItem(r){
  var o=r.o, key=o.taskKey, st=taskState(key); r.hidden=true; draw.dirty=true; lastTargetKey="";
  if(st&&st.s==="asked"){ st.s="got"; save(); }
  sfx("found"); taskEmote(cur,key);
  showToast("You picked up "+o.title+". Take it back to the counter.",4200);
}
function readMenu(o){
  var sh=shopData(o.menuKey||""), items=(sh.menu||[]), pages=[], i;
  if(!items.length){ openSay("Menu board","",["No menu is up for this one yet. The screen by the wall shows the live site."],null,null); return; }
  pages.push(sh.name+", from its public menu.");
  for(i=0;i<items.length;i+=3) pages.push(items.slice(i,i+3).map(function(m){ return m.item+(m.price?", "+m.price:""); }).join(". ")+".");
  openSay("Menu board","",pages,null,null);
}

/* the site screen: a scrollable copy of the public page, the place's pictures and menu, and a link to the real thing */
var siteD=el("dialog","kw-cab kw-site"); siteD.setAttribute("aria-labelledby","kwSiteT");
var siteF=el("div","kw-cab-frame"), siteTop=el("div","kw-cab-top"), siteT=el("h2","kw-cab-title"), siteLive=el("a","kw-site-live","Open the live site"), siteX=el("button","kw-cab-x"), siteB=el("div","kw-cab-body kw-site-b");
var siteTabs=el("div","kw-site-tabs"), siteNote=el("p","kw-site-note"), siteScroll=el("div","kw-site-scroll"), siteStrip=el("div","kw-site-strip"), siteMenu=el("div","kw-site-menu");
siteT.id="kwSiteT"; siteT.tabIndex=-1; siteX.type="button"; siteX.innerHTML="Close <kbd>Esc</kbd>";
siteLive.target="_blank"; siteLive.rel="noopener noreferrer"; siteLive.appendChild(el("span","vh"," (opens in a new tab)"));
siteScroll.tabIndex=0; siteScroll.setAttribute("role","region"); siteScroll.setAttribute("aria-label","Scrollable copy of the page. Use the arrow keys or Page Down to scroll.");
siteStrip.tabIndex=0; siteStrip.setAttribute("role","region"); siteStrip.setAttribute("aria-label","Pictures from the site");
siteTop.appendChild(siteT); siteTop.appendChild(siteLive); siteTop.appendChild(siteX);
[siteTabs,siteNote,siteScroll,siteStrip,siteMenu].forEach(function(e){ siteB.appendChild(e); });
siteF.appendChild(siteTop); siteF.appendChild(siteB); siteD.appendChild(siteF); doc.body.appendChild(siteD);
function dateWords(iso){ var d=new Date(String(iso||"")+"T12:00:00"); if(isNaN(d.getTime())) return ""; try{ return d.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}); }catch(e){ return String(iso); } }
function showSiteFor(key){
  var sh=shopData(key), D=NS.data||{}, full=sh.full;
  siteT.textContent=sh.name+" site screen"; siteLive.hidden=!sh.url; if(sh.url) siteLive.href=sh.url;
  var when=dateWords((full&&full.captured)||sh.captured||D.generated);
  siteNote.textContent="This is a copy of the public site"+(when?", captured "+when:"")+". It does not update by itself. The live site may look different today.";
  siteScroll.textContent=""; siteStrip.textContent=""; siteMenu.textContent="";
  if(full&&full.src){
    var st=el("p","kw-site-wait","Loading the copy..."), im=new Image(); im.className="kw-site-full"; im.loading="lazy"; im.decoding="async"; im.alt="A full-page copy of the "+sh.name+" site"; im.width=full.w||720; im.height=full.h||1200;
    im.onload=function(){ st.hidden=true; }; im.onerror=function(){ st.textContent="The copy did not load. Use Open the live site in the corner."; im.hidden=true; };
    im.src=full.src; siteScroll.appendChild(st); siteScroll.appendChild(im); siteScroll.hidden=false;
  } else { siteScroll.appendChild(el("p","kw-site-wait","There is no copy of this site yet. Use Open the live site in the corner.")); }
  siteScroll.scrollTop=0;
  var imgs=sh.images||[]; siteStrip.hidden=!imgs.length;
  imgs.forEach(function(g){ var i2=new Image(); i2.className="kw-site-pic"; i2.loading="lazy"; i2.decoding="async"; i2.src=g.src; i2.alt=g.alt||""; if(g.w) i2.width=g.w; if(g.h) i2.height=g.h; siteStrip.appendChild(i2); });
  var menu=sh.menu||[]; if(menu.length){ siteMenu.appendChild(el("h3","kw-site-mh","Menu, as printed on the site")); var ul=el("ul","kw-site-ml"); menu.forEach(function(m){ var li=el("li","",m.item); if(m.price) li.appendChild(el("b","",m.price)); ul.appendChild(li); }); siteMenu.appendChild(ul); }
  var bs=siteTabs.querySelectorAll("button"); for(var q=0;q<bs.length;q++) bs[q].setAttribute("aria-pressed",String(bs[q].getAttribute("data-k")===key));
}
function openSite(keys,start){
  keys=(keys||[]).filter(function(k,i,a){ return a.indexOf(k)===i; }); if(!keys.length) return;
  siteTabs.textContent=""; siteTabs.hidden=keys.length<2;
  if(keys.length>1){ siteTabs.appendChild(el("span","kw-site-tl","Whose site?")); keys.forEach(function(k){ var b=el("button","kw-site-tab",shopData(k).name); b.type="button"; b.setAttribute("data-k",k); b.addEventListener("click",function(){ showSiteFor(k); }); siteTabs.appendChild(b); }); }
  showSiteFor(start||keys[0]);
  siteOpen=true; prompt.hidden=true; useBtn.hidden=true; clearKeys();
  try{ if(siteD.showModal) siteD.showModal(); else siteD.setAttribute("open",""); }catch(e){ siteD.setAttribute("open",""); }
  sfx("open"); sync(); setTimeout(function(){ try{ siteT.focus({preventScroll:true}); }catch(e){} },40);
}
function closeSite(){
  if(!siteOpen) return; siteOpen=false;
  try{ if(siteD.open&&siteD.close) siteD.close(); else siteD.removeAttribute("open"); }catch(e){ siteD.removeAttribute("open"); }
  siteScroll.textContent=""; siteStrip.textContent="";
  sfx("close"); sync(); lastTargetKey=""; focusCanvas();
}
siteX.addEventListener("click",closeSite);
siteD.addEventListener("cancel",function(e){ e.preventDefault(); closeSite(); });
siteD.addEventListener("click",function(e){ if(e.target===siteD) closeSite(); });
siteD.addEventListener("keydown",function(e){
  if(e.key!=="Tab") return;
  var f=siteD.querySelectorAll("a[href],button:not([disabled]),[tabindex=\"0\"],h2[tabindex]"), vis=[], i;
  for(i=0;i<f.length;i++){ if(!f[i].hidden&&f[i].offsetParent!==null) vis.push(f[i]); }
  if(!vis.length) return; var first=vis[0], last=vis[vis.length-1];
  if(e.shiftKey&&(doc.activeElement===first||doc.activeElement===siteT)){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey&&doc.activeElement===last){ e.preventDefault(); first.focus(); }
});

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
    var id=norm(n.id); if(n.pet||stay[id]||i%4===3) return;
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
    crew.push({n:n,work:work,where:"hq",at:0,depart:9.75+crew.length*0.03,ret:17.1+crew.length*0.04});
  });
}
function removeNpc(inst,n){ var i=inst.npcs.indexOf(n); if(i>=0) inst.npcs.splice(i,1); }
function resetNpc(n){ n.path=null; n.pi=0; n.state="idle"; n.timer=1+Math.random()*4; n.frame=IDLE; n.talking=false; n.leaving=false; n.returning=false; }
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
  for(i=0;i<(RG.buildings||[]).length;i++){ if(String(RG.buildings[i].id).toLowerCase()===low) return RG.buildings[i]; }
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
  crowdAt2+=dt; if(crowdAt2>2){ crowdAt2=0; if(cur&&cur.kind==="shop") crowdSync(cur); }
  miniAt+=dt; if(miniAt>0.22){ miniAt=0; miniDraw(ts); }
}

/* ================= round 3: characters and graphics =================
   bodies and overheads, emotes, the day's routines, Pixel the studio cat, clouds, sound, and the "Who are you?" screen */
var whoOpen=false, SP=map.spots||{}, plEm=null;

/* ---------- the season and hour go to people.js once in a while, so outfits change with the weather and the evening ---------- */
var monFmt=null; try{ monFmt=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",month:"numeric"}); }catch(e){}
function sdSeason(){
  var m; try{ m=monFmt?parseInt(monFmt.format(new Date()),10):new Date().getMonth()+1; }catch(e){ m=new Date().getMonth()+1; }
  return (m>=6&&m<=8)?"summer":((m>=9&&m<=11)?"autumn":((m===12||m<=2)?"winter":"spring"));
}
var ctxKey="";
function pushContext(){
  var P=NS.people; if(!P||typeof P.setContext!=="function") return;
  var hr=Math.floor(skyHour), sn=sdSeason(), k=sn+"|"+hr; if(k===ctxKey) return; ctxKey=k;
  try{ P.setContext({season:sn,hour:hr}); }catch(e){}
  sprCache={};
}

/* ---------- bodies, shadows, name tag ---------- */
function hasLooks(){ var P=NS.people; return !!(P&&P.parts&&typeof P.drawLook==="function"); }
function lookUsable(){ return !!(me&&me.look&&hasLooks()&&Object.keys(me.look).length); }
function playerSprite(dir,frame){
  if(!lookUsable()) return personSprite("player",dir,frame);
  var key="@me|"+JSON.stringify(me.look)+"|"+dir+"|"+frame, s=sprCache[key]; if(s) return s;
  var c=mk(PW,PH), cx=c.getContext("2d"), ok=false; cx.imageSmoothingEnabled=false;
  try{ ok=NS.people.drawLook(cx,me.look,dir,frame,0,0,1)!==false; }catch(e){ ok=false; }
  if(!ok) return personSprite("player",dir,frame);
  sprCache[key]=c; return c;
}
function lookSprite(n){
  var key="@L|"+n.id+"|"+n.dir+"|"+n.frame, s=sprCache[key]; if(s) return s;
  var c=mk(PW,PH), cx=c.getContext("2d"), ok=false; cx.imageSmoothingEnabled=false;
  try{ ok=NS.people.drawLook(cx,n.look,n.dir,n.frame,0,0,1)!==false; }catch(e){ ok=false; }
  if(!ok) return personSprite("player",n.dir,n.frame);
  sprCache[key]=c; return c;
}
function drawNpcBody(n){
  if(n.pet){ shadow(n.x,n.y,0.6); drawSprite(petSprite(n),n.x-8,n.y-11); return; }
  shadow(n.x,n.y,1); drawSprite(n.look?lookSprite(n):personSprite(n.id,n.dir,n.frame),n.x-PW/2,n.y-SPY);
}
function nameTag(text,x,y){
  ctx.font="600 6px Inter,system-ui,sans-serif";
  var w=Math.ceil(ctx.measureText(text).width)+6, px=Math.round(x-w/2), py=Math.round(y-8);
  ctx.fillStyle="rgba(31,32,35,.86)"; ctx.fillRect(px,py,w,8); ctx.fillRect(px+1,py-1,w-2,1); ctx.fillRect(px+1,py+8,w-2,1);
  ctx.fillStyle="#F6EEDC"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(text,Math.round(x),py+4.5); ctx.textAlign="left";
}

/* ---------- emotes ---------- */
var EMOS=[["hi","Wave"],["heart","Heart"],["laugh","Laugh"],["idea","Idea"],["music","Music"],["coffee","Coffee"],["surprise","Wow"],["question","Huh?"]];
var EMO_TXT={hi:"Hi",heart:"<3",idea:"*",coffee:"c",music:"~",laugh:"ha",surprise:"!",question:"?",zzz:"z",work:"..",k13:"13"};
function emoteAt(c,kind,x,y,t){
  var P=NS.people;
  if(P&&typeof P.emote==="function"){ try{ if(P.emote(c,kind,x,y,1,t)!==false) return; }catch(e){} }
  var w=13, h=10, bx=Math.round(x-w/2), by=Math.round(y-h-2);
  c.fillStyle="#1F2023"; c.fillRect(bx-1,by-1,w+2,h+2); c.fillRect(Math.round(x)-1,by+h,3,2);
  c.fillStyle="#F6EEDC"; c.fillRect(bx,by,w,h); c.fillRect(Math.round(x),by+h,1,1);
  c.fillStyle="#1F2023"; c.font="bold 6px monospace"; c.textAlign="center"; c.textBaseline="middle"; c.fillText(EMO_TXT[kind]||"?",Math.round(x),by+h/2+0.5); c.textAlign="left";
}
function setEmote(o,kind,dur){ if(o) o.em={k:kind,t0:time,d:dur||2.2}; }
function emoteSpotOK(n){
  if(n.state==="walk"||n.leaving||n.returning) return false;
  if(n.rk==="coffee"){ var sp=n.wander&&n.wander[0]; return !!sp&&Math.abs(n.x-(sp[0]+0.5)*T)<5&&Math.abs(n.y-(sp[1]+0.5)*T)<5; }
  return true;
}
function emoteOf(n){
  if(n.em){ var age=time-n.em.t0; if(age>n.em.d) n.em=null; else return [n.em.k,reduced?1:Math.min(1,age/0.25)]; }
  if(n.rk&&!n.talking){ var ph=(time+(n.walkT0||0)*5)%11; if((ph<2.8||n.rk==="zzz"&&n.pet&&ph<7)&&emoteSpotOK(n)) return [n.rk,reduced?1:Math.min(1,ph/0.25)]; }
  return null;
}
function drawOverheads(list,tms){
  var i, it, e, age;
  for(i=0;i<list.length;i++){
    it=list[i];
    if(it.n){ e=emoteOf(it.n); if(e) emoteAt(ctx,e[0],it.n.x,it.n.y-(it.n.pet?10:SPY-1),e[1]); }
    else if(it.p&&plEm){ age=time-plEm.t0; if(age>plEm.d) plEm=null; else emoteAt(ctx,plEm.k,pl.x,pl.y-SPY+1-(me&&me.name?9:0),reduced?1:Math.min(1,age/0.25)); }
  }
  if(me&&me.name&&!ride) nameTag(me.name,pl.x,pl.y-SPY-2);
}
var hiGate=0;
function nearEmotes(){
  if(sayOpen||busy) return;
  for(var i=0;i<npcs.length;i++){
    var n=npcs[i]; if(n.pet||n.talking) continue;
    var dx=n.x-pl.x, dy=n.y-pl.y, d2=dx*dx+dy*dy;
    if(d2<44*44){ if(!n.near){ n.near=true; if(time>(n.nextHi||0)&&time>hiGate){ n.nextHi=time+30; hiGate=time+1.1; setEmote(n,"hi",2.4); } } }
    else if(d2>76*76) n.near=false;
  }
}
/* the visitor's emote wheel: key T, or the Emote button */
var emoPanel=null, emoBtn=$("kwEmote");
function emoBuild(){
  if(emoPanel) return;
  emoPanel=el("div","kw-emo"); emoPanel.id="kwEmoPanel"; emoPanel.hidden=true; emoPanel.setAttribute("role","group"); emoPanel.setAttribute("aria-label","Emotes");
  emoPanel.appendChild(el("h2","kw-emo-h","Say it without words"));
  var grid=el("div","kw-emo-g");
  EMOS.forEach(function(e,i){
    var b=el("button","kw-emo-b"); b.type="button"; b.setAttribute("data-k",e[0]); b.setAttribute("aria-label",e[1]+" (key "+(i+1)+")");
    var cv=el("canvas","kw-emo-c"); cv.width=24; cv.height=24; cv.setAttribute("aria-hidden","true");
    var cx=cv.getContext("2d"); cx.imageSmoothingEnabled=false; emoteAt(cx,e[0],12,22,1,1);
    b.appendChild(cv); b.appendChild(el("span","kw-emo-l",e[1])); grid.appendChild(b);
  });
  emoPanel.appendChild(grid);
  emoPanel.appendChild(el("p","kw-emo-n","Pick one, or press its number. It shows over your head for a moment."));
  var x=el("button","kw-help-x","Close"); x.type="button"; x.addEventListener("click",function(){ closeEmo(); focusCanvas(); }); emoPanel.appendChild(x);
  grid.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("button[data-k]"); if(b) emoPick(b.getAttribute("data-k")); });
  emoPanel.addEventListener("keydown",function(e){
    if(e.key==="Escape"||e.key==="t"||e.key==="T"){ e.preventDefault(); e.stopPropagation(); closeEmo(); if(emoBtn&&e.key==="Escape") emoBtn.focus(); else focusCanvas(); }
    else if(/^[1-8]$/.test(e.key)){ e.preventDefault(); emoPick(EMOS[parseInt(e.key,10)-1][0]); }
  });
  stageEl.appendChild(emoPanel);
}
function emoPick(kind){ plEm={k:kind,t0:time,d:2.8}; sfx("emote"); closeEmo(); focusCanvas(); }
function closeEmo(){
  if(emoPanel&&!emoPanel.hidden){ emoPanel.hidden=true; if(emoBtn) emoBtn.setAttribute("aria-expanded","false"); lastTargetKey=""; }
}
function toggleEmo(){
  if(ui()||!pad.hidden||busy||state.list) return;
  emoBuild();
  if(!emoPanel.hidden){ closeEmo(); focusCanvas(); return; }
  if(sayOpen) closeSay(); closeHelp(); quickClose(); keys={};
  emoPanel.hidden=false; useBtn.hidden=true; prompt.hidden=true; if(emoBtn) emoBtn.setAttribute("aria-expanded","true"); sfx("tick");
  var f=emoPanel.querySelector("button"); try{ f.focus({preventScroll:true}); }catch(e){}
}
if(emoBtn) emoBtn.addEventListener("click",toggleEmo);

/* ---------- the day's routines, by the San Diego clock ---------- */
var hqPhase="";
function phaseOf(h){ return (h<6.5||h>=21.5)?"night":(h<9?"coffee":(h<9.5?"standup":(h<17?"desks":"evening"))); }
function snapTile(t){ var f=nearestFree(t[0],t[1],4); return f||t; }
function routineApply(settle){
  if(cur!==hq) return;
  var ph=phaseOf(skyHour), ci=0, si=0, cs=SP.coffee||[], ss=SP.standup||[];
  hqPhase=ph;
  hq.npcs.forEach(function(n){
    if(n.pet||n.leaving||n.returning||n.talking) return;
    var id=norm(n.id), staff=(id==="kazim"||id==="gurkan"), room=n.home&&n.home.room, spot=null, hold=null, rk=null;
    if(staff){ rk=null; }
    else if(ph==="coffee"){ if(id!=="jessica"&&sumStr(id)%3===0&&cs.length){ spot=snapTile(cs[ci++%cs.length]); hold="up"; rk="coffee"; } }
    else if(ph==="standup"){ if(room==="studio"&&ss.length){ spot=snapTile(ss[si++%ss.length]); hold="up"; rk="idea"; } }
    else if(ph==="desks"){ if(room==="studio"||room==="workshop") rk="work"; }
    else if(ph==="night"){ rk="zzz"; }
    var key=ph+"|"+(spot?spot[0]+","+spot[1]:"");
    if(n.rph===key) return;
    var had=n.rph!==undefined; n.rph=key; n.rk=rk; n.hold=hold;
    if(ph==="night"&&!staff) n.wander=[[n.home.x,n.home.y]]; else n.wander=spot?[spot]:(n.baseWander||n.wander);
    var dest=spot||(ph==="night"&&!staff?[n.home.x,n.home.y]:null);
    if(settle&&dest){
      var ex=Math.abs(n.x-(dest[0]+0.5)*T)+Math.abs(n.y-(dest[1]+0.5)*T);
      if(ex>3*T){ n.x=(dest[0]+0.5)*T; n.y=(dest[1]+0.5)*T; n.path=null; n.state="idle"; n.timer=2+Math.random()*4; n.frame=IDLE; if(hold) n.dir=hold; }
    }else if(settle&&!dest&&had&&(n.wasSpot)){ n.x=(n.home.x+0.5)*T; n.y=(n.home.y+0.5)*T; n.path=null; n.state="idle"; n.timer=1+Math.random()*3; n.frame=IDLE; }
    n.wasSpot=!!spot;
    if(!settle&&n.state==="idle") n.timer=0.1+Math.random()*2.2;
  });
}

/* ---------- Pixel, the studio cat ---------- */
var PET_SPEED=34;
function fallbackCat(c,dir,f,pose){
  var O="#D98B3A", D="#9A5A1E", W="#F6EEDC", K="#1F2023", fl=(dir==="left")?-1:1;
  function px(col,x,y,w,h){ fr(c,col,fl<0?16-x-w:x,y,w,h); }
  if(pose==="sleep"){ px(D,3,9,10,5); px(O,3,8,10,5); px(W,5,12,4,1); px(O,10,8,4,4); px(D,10,7,1,2); px(D,13,7,1,2); px(D,2,11,2,3); px(K,12,10,1,1); return; }
  if(pose==="sit"){ px(D,5,7,6,7); px(O,5,6,6,7); px(W,6,10,3,3); px(O,5,2,6,5); px(D,5,1,2,2); px(D,9,1,2,2); px(K,6,4,1,1); px(K,9,4,1,1); px(D,11,11,3,3); px(O,11,10,3,3); return; }
  var by=pose==="stretch"?9:8, leg=(f%2)?1:0;
  px(D,3,by+1,9,4); px(O,3,by,9,4); px(O,11,by-3,4,4); px(D,11,by-4,1,2); px(D,14,by-4,1,2); px(K,13,by-2,1,1);
  px(D,1,by-3,2,6); px(D,3,by+4,2,2+leg); px(D,9,by+4,2,3-leg); if(pose==="stretch") px(D,12,by+3,3,2);
}
function petSprite(n){
  var f=n.pose==="walk"?(Math.floor(n.walkT*8)%4):(reduced?0:Math.floor(time*1.3+n.walkT0)%2), key="@pet|"+n.pose+"|"+n.dir+"|"+f, s=sprCache[key]; if(s) return s;
  var c=mk(16,16), cx=c.getContext("2d"), P=NS.people, ok=false; cx.imageSmoothingEnabled=false;
  if(P&&typeof P.drawPet==="function"){ try{ ok=P.drawPet(cx,n.dir,f,0,0,1,n.pose)!==false; }catch(e){ ok=false; } }
  if(!ok){ cx.clearRect(0,0,16,16); fallbackCat(cx,n.dir,f,n.pose); }
  sprCache[key]=c; return c;
}
function makePet(){
  var P=NS.people, info=(P&&P.pet)||{}, st=snapTile((SP.cat&&SP.cat[0])||[22,17]);
  return {id:info.id||"pixel",name:info.name||"Pixel",role:"Studio cat",pet:true,x:(st[0]+0.5)*T,y:(st[1]+0.5)*T,dir:"down",frame:IDLE,pose:"sit",mode:"rest",timer:2,path:null,pi:0,
    walkT:0,walkT0:0,state:"idle",talking:false,goal:null,goalT:[0,0],onCouch:false,sortY:0,follow:0,followMode:false,followCool:20,repath:1,nextGo:null,wander:[],home:{x:st[0],y:st[1]}};
}
function petGo(n,tile,opts){
  opts=opts||{};
  if(n.pose==="sleep"&&!opts.noStretch){ n.pose="stretch"; n.timer=1.1; n.nextGo=[tile,opts]; n.mode="rest"; n.path=null; return; }
  if(n.onCouch){ var cf=snapTile(SP.couchFront||[20,18]); n.x=(cf[0]+0.5)*T; n.y=(cf[1]+0.5)*T; n.onCouch=false; n.sortY=0; }
  var sx=Math.floor(n.x/T), sy=Math.floor(n.y/T), p=(sx===tile[0]&&sy===tile[1])?[]:findPath(sx,sy,tile[0],tile[1]);
  if(!p){ n.mode="rest"; n.pose="sit"; n.timer=3; return; }
  n.goal=opts; n.goalT=tile; n.path=p; n.pi=0; n.mode="walk"; n.pose="walk"; n.followMode=!!opts.follow;
  if(opts.follow){ n.follow=14; n.repath=1; }
  if(!p.length) petArrive(n);
}
function petArrive(n){
  var g=n.goal||{}; n.mode="rest"; n.path=null; n.state="idle";
  if(g.hop==="couch"){ var c=SP.couch||[20.5,17.1]; n.x=c[0]*T; n.y=c[1]*T; n.onCouch=true; n.sortY=((SP.couchFront?SP.couchFront[1]:18)*T)+1; n.dir="down"; }
  n.pose=g.pose||"sit"; n.timer=n.pose==="sleep"?(24+Math.random()*30):(5+Math.random()*9);
  if(g.follow){ n.followCool=45; n.followMode=false; n.timer=6+Math.random()*5; }
  n.goal=null;
}
function petFree(vt){
  var o=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1]], i;
  for(i=0;i<o.length;i++){ var x=vt[0]+o[i][0], y=vt[1]+o[i][1]; if(x>=0&&y>=0&&x<MW&&y<MH&&!blk[y*MW+x]) return [x,y]; }
  return null;
}
function petPlan(n,d){
  if(n.nextGo){ var ng=n.nextGo; n.nextGo=null; petGo(n,ng[0],{pose:ng[1].pose,hop:ng[1].hop,follow:ng[1].follow,noStretch:true}); return; }
  if(n.pose==="stretch"){ n.pose="sit"; n.timer=1.2; return; }
  var h=skyHour, night=(h<6.5||h>=21.5), r=Math.random(), cf=snapTile(SP.couchFront||[20,18]), sunny=snapTile(SP.sunny||[30,4]), sp, spots=SP.cat||[];
  if(night){ if(n.onCouch){ n.pose="sleep"; n.timer=30+Math.random()*30; } else petGo(n,cf,{hop:"couch",pose:"sleep"}); return; }
  if(d<70&&n.followCool<=0&&r<0.6){ var vt=petFree([Math.floor(pl.x/T),Math.floor(pl.y/T)]); if(vt){ petGo(n,vt,{pose:"sit",follow:true}); return; } }
  if(h>=10&&h<16&&r<0.45){ petGo(n,sunny,{pose:"sleep"}); return; }
  if(r<0.25){ petGo(n,cf,{hop:"couch",pose:"sit"}); return; }
  if(r<0.35&&n.pose!=="sleep"){ n.pose="stretch"; n.timer=1.2; return; }
  sp=spots.length?snapTile(spots[(Math.random()*spots.length)|0]):[Math.floor(n.x/T),Math.floor(n.y/T)];
  petGo(n,sp,{pose:"sit"});
}
function updatePet(n,dt){
  var dx0=pl.x-n.x, dy0=pl.y-n.y, d=Math.sqrt(dx0*dx0+dy0*dy0);
  n.followCool-=dt; n.rk=(n.pose==="sleep"&&n.mode!=="walk")?"zzz":null; n.frame=IDLE;
  if(n.mode==="walk"){
    if(n.followMode){ n.follow-=dt; if(n.follow<=0){ petArrive(n); return; }
      n.repath-=dt; if(n.repath<=0){ n.repath=1; var vt=[Math.floor(pl.x/T),Math.floor(pl.y/T)];
        if(Math.abs(vt[0]-n.goalT[0])+Math.abs(vt[1]-n.goalT[1])>2){ var nf=petFree(vt); if(nf){ var sx=Math.floor(n.x/T), sy=Math.floor(n.y/T), p=findPath(sx,sy,nf[0],nf[1]); if(p&&p.length){ n.path=p; n.pi=0; n.goalT=nf; } } } } }
    var t=n.path&&n.path[n.pi]; if(!t){ petArrive(n); return; }
    var tx=(t[0]+0.5)*T, ty=(t[1]+0.5)*T, dx=tx-n.x, dy=ty-n.y, dist=Math.sqrt(dx*dx+dy*dy), step=PET_SPEED*dt;
    n.pose="walk";
    if(dist<=step){ n.x=tx; n.y=ty; n.pi++; if(n.pi>=n.path.length) petArrive(n); }
    else{ n.x+=dx/dist*step; n.y+=dy/dist*step; n.dir=dirOf(dx,dy,n.dir); n.walkT+=dt; }
    return;
  }
  n.timer-=dt;
  if(n.pose==="sit"&&d<64) n.dir=dirOf(dx0,dy0,n.dir);
  if(n.timer<=0) petPlan(n,d);
}
function petIt(n){
  setEmote(n,"heart",2.4); sfx("purr"); n.dir=dirOf(pl.x-n.x,pl.y-n.y,n.dir);
  n.mode="rest"; n.path=null; n.nextGo=null; n.followMode=false; if(n.pose==="sleep"||n.pose==="walk"||n.pose==="stretch") n.pose="sit"; n.timer=Math.max(n.timer,4.5);
  state.petted=(state.petted||0)+1; save();
  showToast(n.name+" purrs. "+(state.petted>1?"She remembers you.":"She decided you are fine."),3200);
}

/* ---------- slow cloud shadows outdoors by day (off under reduced motion) ---------- */
var cloudC=null;
function drawClouds(tms){
  if(!RG) return;
  if(!cloudC){
    cloudC=mk(160,96); var c=cloudC.getContext("2d"), blobs=[[50,50,44,30],[84,42,40,28],[112,56,34,24],[70,62,40,22]], i, g;
    for(i=0;i<blobs.length;i++){ var b=blobs[i]; g=c.createRadialGradient(b[0],b[1],2,b[0],b[1],b[2]); g.addColorStop(0,"rgba(20,28,48,.9)"); g.addColorStop(1,"rgba(20,28,48,0)"); c.fillStyle=g; c.save(); c.translate(b[0],b[1]); c.scale(1,b[3]/b[2]); c.translate(-b[0],-b[1]); c.beginPath(); c.arc(b[0],b[1],b[2],0,6.2832); c.fill(); c.restore(); }
  }
  var W=RG.w*T, H=RG.h*T, span=W+400, n=64, i2, prev=ctx.imageSmoothingEnabled, a=0.085*(1-skyDk*2);
  if(a<=0.005) return;
  ctx.imageSmoothingEnabled=true; ctx.globalAlpha=a;
  for(i2=0;i2<n;i2++){
    var sc=0.9+hash(i2,3,5)*1.4, x=((hash(i2,1,5)*span+time*3.2*(0.7+hash(i2,2,5)*0.6))%span)-200, y=hash(i2,4,5)*H, w=160*sc, h=96*sc;
    if(x+w<camRX||x>camRX+vw||y+h<camRY||y>camRY+vh) continue;
    ctx.drawImage(cloudC,x,y,w,h);
  }
  ctx.globalAlpha=1; ctx.imageSmoothingEnabled=prev;
}

/* ---------- sound: WebAudio only, off until the visitor turns it on ---------- */
var snd={on:state.sound,ctx:null,out:null,music:null,fx:null,noise:null,white:null,surfG:null,swell:null,streetG:null,place:"",nt:0,beat:0,swellAt:0,carAt:0,timer:0,stepIdx:-1,lastWT:0,placeAt:0};
var sndBtn=$("kwSound");
function sndBtnUpdate(){
  if(!sndBtn) return; sndBtn.setAttribute("aria-pressed",String(!!snd.on)); sndBtn.classList.toggle("kw-snd-on",!!snd.on);
  var lab=sndBtn.querySelector(".kw-snd-t"); if(lab) lab.textContent=snd.on?"Sound on":"Sound off";
}
function bed(c,buf,freq){
  var s=c.createBufferSource(); s.buffer=buf; s.loop=true; var f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=freq;
  var g=c.createGain(); g.gain.value=0; s.connect(f); f.connect(g); s.start(); return {src:s,gain:g,filter:f};
}
function sndMake(){
  if(snd.ctx) return true;
  var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return false;
  try{ snd.ctx=new AC(); }catch(e){ snd.ctx=null; return false; }
  var c=snd.ctx, i, comp=c.createDynamicsCompressor();
  snd.out=c.createGain(); snd.out.gain.value=0; snd.out.connect(comp); comp.connect(c.destination);
  snd.music=c.createGain(); snd.music.gain.value=0; snd.music.connect(snd.out);
  snd.fx=c.createGain(); snd.fx.gain.value=1; snd.fx.connect(snd.out);
  var len=c.sampleRate*2, buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0), last=0;
  for(i=0;i<len;i++){ last=(last+0.02*(Math.random()*2-1))/1.02; d[i]=last*3.5; }
  snd.noise=buf;
  var wb=c.createBuffer(1,Math.floor(c.sampleRate*0.4),c.sampleRate), wd=wb.getChannelData(0); for(i=0;i<wd.length;i++) wd[i]=Math.random()*2-1; snd.white=wb;
  var sf=bed(c,buf,1100), sw=c.createGain(); sw.gain.value=0.2; sf.filter.disconnect(); sf.filter.connect(sw); sw.connect(sf.gain); sf.gain.connect(snd.out); snd.surfG=sf.gain; snd.swell=sw;
  var st=bed(c,buf,420); st.gain.connect(snd.out); snd.streetG=st.gain;
  snd.nt=c.currentTime+0.15; snd.beat=0;
  snd.timer=setInterval(sndTick,110);
  return true;
}
function sndWake(){
  if(!snd.on||snd.ctx) return;
  if(sndMake()){ try{ snd.ctx.resume(); }catch(e){} snd.out.gain.setTargetAtTime(0.5,snd.ctx.currentTime,0.15); snd.place=""; sndPlace(placeKey()); }
}
function sndOnGesture(){ doc.removeEventListener("pointerdown",sndOnGesture,true); doc.removeEventListener("keydown",sndOnGesture,true); sndWake(); }
function sndToggle(){
  if(snd.on){
    snd.on=false; var cc=snd.ctx;
    if(cc){ snd.out.gain.setTargetAtTime(0,cc.currentTime,0.08); setTimeout(function(){ if(!snd.on){ try{ cc.suspend(); }catch(e){} } },450); }
  }else{
    if(!sndMake()){ showToast("Sound is not available in this browser."); return; }
    snd.on=true; try{ snd.ctx.resume(); }catch(e){}
    snd.out.gain.setTargetAtTime(0.5,snd.ctx.currentTime,0.1); snd.place=""; sndPlace(placeKey()); sfx("open");
  }
  state.sound=snd.on; save(); sndBtnUpdate();
  if(live) live.textContent=snd.on?"Sound on.":"Sound off.";
}
if(sndBtn) sndBtn.addEventListener("click",sndToggle);
if(snd.on){ doc.addEventListener("pointerdown",sndOnGesture,true); doc.addEventListener("keydown",sndOnGesture,true); }
doc.addEventListener("visibilitychange",function(){ if(!snd.ctx) return; try{ if(doc.hidden) snd.ctx.suspend(); else if(snd.on) snd.ctx.resume(); }catch(e){} });

function placeKey(){
  if(state.list||modal||whoOpen) return "none";
  if(cur.kind==="hq") return "hq";
  if(cur.kind==="shop") return "shop";
  if(RG&&RG.ter){
    var K=(NS.region&&NS.region.K)||{OCEAN:0,SURF:1,SAND:2,PIER:10}, tx=Math.floor(pl.x/T), ty=Math.floor(pl.y/T), x, y, near=0;
    for(y=-3;y<=3;y+=3) for(x=-3;x<=3;x+=3){ var xx=tx+x, yy=ty+y; if(xx>=0&&yy>=0&&xx<RG.w&&yy<RG.h){ var tv=RG.ter[yy*RG.w+xx]; if(tv===K.OCEAN||tv===K.SURF||tv===K.SAND||tv===K.PIER) near++; } }
    return near>=3?"beach":"street";
  }
  return "street";
}
function sndPlace(key){
  if(!snd.ctx||key===snd.place) return; snd.place=key; var t=snd.ctx.currentTime;
  snd.music.gain.setTargetAtTime(key==="hq"?0.5:(key==="shop"?0.36:0),t,0.7);
  snd.surfG.gain.setTargetAtTime(key==="beach"?0.3:0,t,0.8);
  snd.streetG.gain.setTargetAtTime(key==="street"?0.16:(key==="beach"?0.04:0),t,0.8);
  if(key==="hq"||key==="shop"){ snd.nt=Math.max(snd.nt,snd.ctx.currentTime+0.2); }
}
function midi(m){ return 440*Math.pow(2,(m-69)/12); }
function voice(freq,t,dur,type,vol,lp,att,dest){
  var c=snd.ctx, o=c.createOscillator(), g=c.createGain(), f=null;
  o.type=type; o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+(att||0.02)); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  if(lp){ f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=lp; o.connect(f); f.connect(g); } else o.connect(g);
  g.connect(dest||snd.music); o.start(t); o.stop(t+dur+0.05);
}
function burst(t,dur,vol,type,freq,q,dest){
  var c=snd.ctx, s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain();
  s.buffer=snd.white; f.type=type; f.frequency.value=freq; f.Q.value=q||1;
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(f); f.connect(g); g.connect(dest||snd.fx); s.start(t); s.stop(t+dur+0.02);
}
var CH_HQ=[[57,60,64,67],[53,57,60,64],[48,52,55,59],[55,59,62,64]], CH_SHOP=[[50,53,57,60],[46,50,53,57],[53,57,60,64],[48,52,55,58]];
function sndBeat(t,e,shop){
  var prog=shop?CH_SHOP:CH_HQ, ch=prog[Math.floor(e/8)%4], eig=e%8, bpm=shop?82:70, bar=60/bpm*4, i;
  if(eig===0){ for(i=0;i<ch.length;i++) voice(midi(ch[i]),t,bar*1.05,"triangle",0.05,800,0.45); voice(midi(ch[0]-12),t,0.9,"sine",0.14,300,0.01); }
  if(eig===4) voice(midi(ch[0]-12),t,0.6,"sine",0.1,300,0.01);
  if(eig===0||eig===4){ var o=snd.ctx.createOscillator(), g=snd.ctx.createGain(); o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(45,t+0.14); g.gain.setValueAtTime(0.16,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.2); o.connect(g); g.connect(snd.music); o.start(t); o.stop(t+0.25); }
  if(eig===2||eig===6) burst(t,0.09,0.05,"bandpass",1800,0.8,snd.music);
  if(eig%2===1) burst(t,0.035,0.022,"highpass",6500,0.7,snd.music);
  if(Math.random()<0.32&&eig!==1){ var nn=ch[(Math.random()*ch.length)|0]+(Math.random()<0.6?12:19); voice(midi(nn),t+(Math.random()<0.4?0.03:0),0.7,"sine",0.06,2200,0.01); }
}
function sndTick(){
  var c=snd.ctx; if(!c||!snd.on||c.state!=="running") return;
  var now=c.currentTime;
  if(snd.place==="hq"||snd.place==="shop"){
    var eighth=60/(snd.place==="shop"?82:70)/2;
    if(snd.nt<now-1) snd.nt=now+0.1;
    while(snd.nt<now+0.4){ sndBeat(snd.nt,snd.beat,snd.place==="shop"); snd.nt+=eighth; snd.beat++; }
  }
  if(snd.place==="beach"&&now>snd.swellAt){ var g=snd.swell.gain; g.cancelScheduledValues(now); g.setTargetAtTime(0.85,now,1.3); g.setTargetAtTime(0.12,now+3.4,1.7); snd.swellAt=now+7.5; }
  if(snd.place==="street"&&now>snd.carAt){ snd.carAt=now+7+Math.random()*9; var f=250+Math.random()*200; var s=c.createBufferSource(), bp=c.createBiquadFilter(), gg=c.createGain(); s.buffer=snd.noise; bp.type="bandpass"; bp.Q.value=2; bp.frequency.setValueAtTime(f,now); bp.frequency.linearRampToValueAtTime(f*2.2,now+3); gg.gain.setValueAtTime(0.0001,now); gg.gain.linearRampToValueAtTime(0.07,now+1.4); gg.gain.linearRampToValueAtTime(0.0001,now+3.2); s.connect(bp); bp.connect(gg); gg.connect(snd.out); s.start(now); s.stop(now+3.3); }
}
function tone(f0,f1,dur,type,vol,delay){
  var c=snd.ctx, t=c.currentTime+(delay||0), o=c.createOscillator(), g=c.createGain();
  o.type=type||"sine"; o.frequency.setValueAtTime(f0,t); if(f1&&f1!==f0) o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.008); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(snd.fx); o.start(t); o.stop(t+dur+0.03);
}
function sfx(name,arg){
  if(!snd.on||!snd.ctx||snd.ctx.state!=="running") return;
  try{
    var c=snd.ctx, t=c.currentTime;
    if(name==="tick") tone(880,1180,0.06,"triangle",0.06);
    else if(name==="open") tone(520,880,0.14,"triangle",0.07);
    else if(name==="close") tone(880,520,0.12,"triangle",0.06);
    else if(name==="talk") tone(440,660,0.09,"triangle",0.05);
    else if(name==="type"){ var h=sumStr(String(arg||"x")); tone(280+(h%7)*38+Math.random()*14,0,0.035,"square",0.018); }
    else if(name==="found"){ [523,659,784,1047].forEach(function(f,i){ tone(f,0,0.16,"triangle",0.06,i*0.085); }); }
    else if(name==="emote") tone(660,1040,0.12,"sine",0.07);
    else if(name==="purr"){ var o=c.createOscillator(), g=c.createGain(), l=c.createOscillator(), lg=c.createGain(); o.type="triangle"; o.frequency.value=82; l.frequency.value=24; lg.gain.value=0.04; l.connect(lg); lg.connect(g.gain); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.06,t+0.15); g.gain.linearRampToValueAtTime(0.0001,t+1.1); o.connect(g); g.connect(snd.fx); o.start(t); l.start(t); o.stop(t+1.2); l.stop(t+1.2); tone(900,1300,0.09,"sine",0.04,0.02); }
    else if(name==="door"){ burst(t,0.18,0.08,"lowpass",420,0.7); tone(200,120,0.14,"sine",0.06); }
    else if(name==="step"){
      var out=cur.kind==="region", f=out?(380+Math.random()*160):(900+Math.random()*420);
      burst(t,out?0.07:0.045,out?0.05:0.06,out?"lowpass":"bandpass",f,1.2);
    }
  }catch(e){}
}
function stepSound(){
  if(!snd.ctx||!snd.on) return;
  if(pl.walkT!==snd.lastWT){ snd.lastWT=pl.walkT; var f=pl.frame; if(f!==snd.stepIdx){ snd.stepIdx=f; if(f===0||f===(FRW>>1)) sfx("step"); } } else snd.stepIdx=-1;
  if(time-snd.placeAt>0.5){ snd.placeAt=time; sndPlace(placeKey()); }
}

/* ---------- Who are you? A name and a character, saved on this device ---------- */
var who=el("dialog","kw-who"); who.setAttribute("aria-labelledby","kwWhoT");
var whoCard=el("div","kw-who-card"), whoH=el("h2","kw-who-h","Who are you?"), whoSub=el("p","kw-who-sub","Pick a name and a look. They stay on this device, and the crew will know you next time.");
whoH.id="kwWhoT"; whoH.tabIndex=-1;
var whoBody=el("div","kw-who-body"), whoPv=el("div","kw-who-pv"), whoFig=el("canvas","kw-who-fig"), whoPor=el("canvas","kw-who-por"), whoTurn=el("button","kw-who-turn","Turn");
whoFig.width=PW; whoFig.height=PH; whoPor.width=PORT; whoPor.height=PORT; whoFig.setAttribute("aria-hidden","true"); whoPor.setAttribute("aria-hidden","true"); whoTurn.type="button";
var whoForm=el("div","kw-who-form"), whoLab=el("label","kw-who-lab","Your name"), whoIn=el("input","kw-who-in"), whoHelp=el("p","kw-who-help","Shown over your head. You can leave it empty.");
whoLab.htmlFor="kwWhoName"; whoIn.id="kwWhoName"; whoIn.type="text"; whoIn.maxLength=16; whoIn.placeholder="Visitor"; whoIn.autocomplete="off"; whoIn.spellcheck=false; whoIn.setAttribute("autocapitalize","words"); whoHelp.id="kwWhoHelp"; whoIn.setAttribute("aria-describedby","kwWhoHelp");
var whoParts=el("div","kw-who-parts"), whoLive=el("p","vh"), whoAct=el("div","kw-who-act"), whoRnd=el("button","kw-who-b","Random"), whoSkip=el("button","kw-who-b kw-who-skip","Skip"), whoGo=el("button","kw-who-b kw-who-go","Start");
whoRnd.type=whoSkip.type=whoGo.type="button"; whoLive.setAttribute("role","status"); whoLive.setAttribute("aria-live","polite");
var whoNote=el("p","kw-who-note","Start walks you in. Esc skips and gives you a random look. You can change it any time from Help.");
whoPv.appendChild(whoFig); whoPv.appendChild(whoTurn); whoPv.appendChild(whoPor);
whoForm.appendChild(whoLab); whoForm.appendChild(whoIn); whoForm.appendChild(whoHelp); whoForm.appendChild(whoParts);
whoBody.appendChild(whoPv); whoBody.appendChild(whoForm);
whoAct.appendChild(whoRnd); whoAct.appendChild(whoSkip); whoAct.appendChild(whoGo);
whoCard.appendChild(whoH); whoCard.appendChild(whoSub); whoCard.appendChild(whoBody); whoCard.appendChild(whoLive); whoCard.appendChild(whoAct); whoCard.appendChild(whoNote);
who.appendChild(whoCard); doc.body.appendChild(who);
var whoLook=null, whoEdit=false, whoRows=[], whoBuilt=false, whoDir=0, whoManual=false, whoRaf=0, whoPorAt=0, WHO_DIRS=["down","right","up","left"];
var PART_ORDER=[["skin","Skin"],["hairStyle","Hair"],["hairColor","Hair color"],["top","Top"],["topColor","Top color"],["bottom","Bottom"],["bottomColor","Bottom color"],["accessory","Extra"]];
function partOpts(key){ var P=NS.people, a=P&&P.parts&&P.parts[key]; return Array.isArray(a)?a.filter(function(o){ return o&&o.id!=null; }):[]; }
function partIdx(opts,id){ for(var i=0;i<opts.length;i++) if(opts[i].id===id) return i; return 0; }
function randomLookNow(){
  var P=NS.people, seed=(Math.random()*1e9)|0;
  if(P&&typeof P.randomLook==="function"){ try{ var l=P.randomLook(seed); if(l&&typeof l==="object") return l; }catch(e){} }
  var out={}; PART_ORDER.forEach(function(p){ var o=partOpts(p[0]); if(o.length) out[p[0]]=o[(Math.random()*o.length)|0].id; }); return out;
}
function sanitizeLook(look){
  var out={}, base=look||{}; PART_ORDER.forEach(function(p){ var o=partOpts(p[0]); if(o.length) out[p[0]]=o[partIdx(o,base[p[0]])].id; }); return out;
}
function whoBuild(){
  if(whoBuilt||!hasLooks()) { whoBuilt=true; return; } whoBuilt=true;
  PART_ORDER.forEach(function(p){
    var opts=partOpts(p[0]); if(opts.length<2) return;
    var row=el("div","kw-who-row"), lab=el("span","kw-who-rl",p[1]), prev=el("button","kw-who-ar","◀"), val=el("span","kw-who-val"), next=el("button","kw-who-ar","▶"), chip=el("span","kw-who-chip");
    row.setAttribute("role","group"); row.setAttribute("aria-label",p[1]); prev.type=next.type="button";
    prev.setAttribute("aria-label","Previous "+p[1].toLowerCase()); next.setAttribute("aria-label","Next "+p[1].toLowerCase());
    var vt=el("span","kw-who-vt"); val.appendChild(chip); val.appendChild(vt);
    row.appendChild(lab); row.appendChild(prev); row.appendChild(val); row.appendChild(next);
    function step(d){ var i=partIdx(opts,whoLook[p[0]]); i=(i+d+opts.length)%opts.length; whoLook[p[0]]=opts[i].id; whoRefresh(); whoLive.textContent=p[1]+": "+vt.textContent; sfx("tick"); }
    prev.addEventListener("click",function(){ step(-1); }); next.addEventListener("click",function(){ step(1); });
    row.addEventListener("keydown",function(e){ if(e.key==="ArrowLeft"){ e.preventDefault(); step(-1); } else if(e.key==="ArrowRight"){ e.preventDefault(); step(1); } });
    whoParts.appendChild(row); whoRows.push({key:p[0],opts:opts,vt:vt,chip:chip});
  });
}
function whoRefresh(){
  whoRows.forEach(function(r){
    var o=r.opts[partIdx(r.opts,whoLook[r.key])]; r.vt.textContent=o.label||String(o.id);
    var col=o.color||o.hex; r.chip.hidden=!col; if(col) r.chip.style.background=col;
  });
  whoPorAt=0;
}
function whoDraw(ts){
  var c=whoFig.getContext("2d"), P=NS.people, dir=WHO_DIRS[whoDir], ok=false; c.imageSmoothingEnabled=false; c.clearRect(0,0,PW,PH);
  if(hasLooks()){ try{ ok=P.drawLook(c,whoLook,dir,IDLE,0,0,1)!==false; }catch(e){ ok=false; } }
  if(!ok) c.drawImage(personSprite("player",dir,IDLE),0,0);
  if(ts-whoPorAt>180){
    whoPorAt=ts; var pc=whoPor.getContext("2d"); pc.imageSmoothingEnabled=false; pc.clearRect(0,0,PORT,PORT);
    if(hasLooks()&&typeof P.portraitLook==="function"){ try{ P.portraitLook(pc,whoLook,0,0,1,"happy",ts/1000,false); whoPor.hidden=false; }catch(e){ whoPor.hidden=true; } } else whoPor.hidden=true;
  }
}
function whoLoop(ts){
  whoRaf=0; if(!whoOpen) return;
  if(!reduced&&!whoManual) whoDir=Math.floor(ts/1100)%4;
  whoDraw(ts); whoRaf=requestAnimationFrame(whoLoop);
}
function openWho(editing){
  if(whoOpen) return;
  if(sayOpen) closeSay(); closePad(); closeHelp(); closeEmo(); quickClose(); keys={}; pl.path=null; pl.pending=null;
  whoEdit=!!editing; whoBuild();
  var P=NS.people, start=(lookUsable()?me.look:(P&&P.defaultLook)||null);
  whoLook=hasLooks()?sanitizeLook(start||randomLookNow()):{};
  whoIn.value=me?me.name:""; whoH.textContent=editing?"Change your look":"Who are you?"; whoSkip.textContent=editing?"Cancel":"Skip"; if(!editing) whoSkip.appendChild(el("span","kw-who-sfx",", pick one for me"));
  whoSub.hidden=!!editing; whoParts.hidden=!whoRows.length; whoRnd.hidden=!hasLooks(); whoTurn.hidden=!hasLooks();
  var k=window.innerWidth<600?3:6; whoFig.style.width=(PW*k)+"px"; whoFig.style.height=(PH*k)+"px"; whoPor.style.width=Math.round(PORT*(k/2))+"px"; whoPor.style.height=Math.round(PORT*(k/2))+"px";
  whoDir=0; whoManual=reduced; whoRefresh();
  whoOpen=true; sync();
  try{ if(who.showModal) who.showModal(); else who.setAttribute("open",""); }catch(e){ who.setAttribute("open",""); }
  prompt.hidden=true; useBtn.hidden=true; whoDraw(performance.now()); whoRaf=requestAnimationFrame(whoLoop);
  setTimeout(function(){ try{ (coarse?whoH:whoIn).focus({preventScroll:true}); }catch(e){} },40);
}
function whoShut(){
  if(!whoOpen) return; whoOpen=false;
  try{ if(who.open&&who.close) who.close(); else who.removeAttribute("open"); }catch(e){ who.removeAttribute("open"); }
  sync(); lastTargetKey=""; draw.dirty=true; focusCanvas();
}
function commitMe(look){
  var first=!me, nm=cleanName(whoIn.value);
  me=state.me={name:nm,look:look||{},visits:(me&&me.visits)||1}; sprCache={}; save();
  whoShut();
  showToast(first?("Welcome"+(nm?", "+nm:"")+". Walk with the arrow keys, or tap a spot."):(nm?"Looking good, "+nm+".":"Looking good."),4200);
  sfx("found");
}
function whoStart(){ commitMe(hasLooks()?whoLook:{}); }
function whoSkipped(){ if(whoEdit){ whoShut(); return; } commitMe(hasLooks()?randomLookNow():{}); }
whoRnd.addEventListener("click",function(){ whoLook=sanitizeLook(randomLookNow()); whoRefresh(); whoLive.textContent="A new random look."; sfx("tick"); });
whoTurn.addEventListener("click",function(){ whoManual=true; whoDir=(whoDir+1)%4; sfx("tick"); });
whoGo.addEventListener("click",whoStart);
whoSkip.addEventListener("click",whoSkipped);
whoIn.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); whoStart(); } });
who.addEventListener("cancel",function(e){ e.preventDefault(); whoSkipped(); });

/* ---------- per-frame, round 3 ---------- */
var rAt=0, ctxAt=0;
function r3Tick(dt,ts){
  sayTick(dt,ts);
  ctxAt+=dt; if(ctxAt>5){ ctxAt=0; pushContext(); }
  if(cur===hq){ rAt+=dt; if(rAt>1.5){ rAt=0; routineApply(false); } }
  nearEmotes(); stepSound();
}

/* ---------- boot ---------- */
function boot(){
  try{ if(NS.people&&typeof NS.people.prewarm==="function") NS.people.prewarm(); }catch(e){}
  hq=makeHQ(); insts.hq=hq; useInst(hq);
  if(state.backOpen) setBackDoor(true);
  buildBlocked(); renderTiles(); hq.npcs=buildNpcs(); npcs=hq.npcs; hq.built=true; collectLightsFor(hq);
  resize();
  if(NS.region){ try{ RG=NS.region.get(); makeRegion(); }catch(e){ RG=null; delete insts.region; } }
  updateSky(); pushContext(); initCrew(); crewSettle();
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
  if(cur===hq) routineApply(true);
  if(at&&RG&&goAt(at,true)) linked=true;
  updateChip(false);
  var tt=barChip&&barChip.querySelector("[data-kw-total]"); if(tt) tt.textContent=String(totalSecrets());
  setList(state.list,true);
  if(!state.list) sync();
  if(foundCount()>=totalSecrets()&&!state.flags.finale) checkFinale();
  window.addEventListener("beforeunload",function(){ savePos(); });
  if(hint) canvas.addEventListener("focus",function(){ hint.classList.add("kw-hint-on"); });
  if(doc.fonts&&doc.fonts.ready) doc.fonts.ready.then(function(){ draw.dirty=true; });
  sndBtnUpdate(); booted=true;
  if(me){ me.visits=(me.visits||0)+1; save(); }
  else{ cameraStep(0.016); render(performance.now()); openWho(false); }
}
/* ---------- quick actions (Kazim, 2026-10-06): jump to a place or start a game without walking there ---------- */
var QUICK_PLACES=[
  ["K13 HQ",[["hq","Lobby"],["arcade","Arcade hall"],["bench-eggtoss","Workshop"],["couch","Lounge"],["whiteboard","Studio floor"],["news-stand","The K13 Daily"]]],
  ["San Diego",[["van-hq","Downtown street"],["globalfork-hall","Global Fork Food Hall"],["station8-hall","Station 8"],["lobsterlab-delmar","Lobster Lab Del Mar"],["pier","Worldwide pier"]]],
  ["North County and Orange County",[["windmill-hall","Windmill Food Hall"],["cosmos-oceanside","Cosmos Burger Oceanside"],["miramar-hall","Miramar Food Hall"]]],
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
  var cols=el("div","kw-quick-cols"), left=el("div","kw-quick-col kw-q-places"), right=el("div","kw-quick-col kw-q-games");
  var tabs=el("div","kw-quick-tabs"), tP=el("button","kw-quick-tab kw-on","Places"), tG=el("button","kw-quick-tab","Games"); tP.type=tG.type="button";
  tP.setAttribute("aria-pressed","true"); tG.setAttribute("aria-pressed","false");
  function showTab(g){ quickPanel.classList.toggle("kw-q-showgames",g); tP.classList.toggle("kw-on",!g); tG.classList.toggle("kw-on",g); tP.setAttribute("aria-pressed",String(!g)); tG.setAttribute("aria-pressed",String(g)); }
  tP.addEventListener("click",function(){ showTab(false); }); tG.addEventListener("click",function(){ showTab(true); });
  tabs.appendChild(tP); tabs.appendChild(tG);
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
  cols.appendChild(left); cols.appendChild(right); quickPanel.appendChild(tabs); quickPanel.appendChild(cols);
  var x=el("button","kw-help-x kw-quick-x","Close"); x.type="button"; x.addEventListener("click",function(){ quickClose(); focusCanvas(); }); quickPanel.appendChild(x);
  quickPanel.addEventListener("keydown",function(e){ if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); quickClose(); if(quickBtn) quickBtn.focus(); } });
  stageEl.appendChild(quickPanel);
}
function quickToggle(){ quickBuild(); var open=quickPanel.hidden; closeHelp(); quickPanel.hidden=!open; quickBtn.setAttribute("aria-expanded",String(open)); if(open){ var f=quickPanel.querySelector(".kw-quick-b"); try{ f&&f.focus({preventScroll:true}); }catch(e){} } }
(function(){
  var bar=$("kwBar"), help=$("kwHelp"); if(!bar) return;
  quickBtn=el("button","kw-btn kw-btn-go","Go to"); quickBtn.type="button"; quickBtn.id="kwGo";
  quickBtn.setAttribute("aria-expanded","false"); quickBtn.setAttribute("aria-controls","kwQuickPanel");
  var key=el("kbd","kw-kbd","G"); key.setAttribute("aria-hidden","true"); quickBtn.appendChild(key);
  quickBtn.addEventListener("click",quickToggle);
  var first=$("kwEmote")||$("kwSound")||help;
  if(first) bar.insertBefore(quickBtn,first); else bar.appendChild(quickBtn);
})();

boot();
NS.engine={version:3};
})();
