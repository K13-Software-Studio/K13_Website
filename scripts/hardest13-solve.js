#!/usr/bin/env node
/* Proves every level of The Hardest Ship (js/hardest13.js) can be beaten, using the game's own core.
   A breadth-first search over (position, requirements held) through time: the square moves on a 1/8-tile grid,
   one step every 1/28 s (exactly the game's speed), and may only stand where no bug is, with a safety margin added to
   every bug so a route needs human-sized gaps, not frame-perfect ones. Reports the fastest route per level, or FAIL.
   Usage: node scripts/hardest13-solve.js [margin=0.05] [level numbers...]
          node scripts/hardest13-solve.js tight [level numbers...]   (how fat the bugs can get before a level stops being beatable:
          the smaller the number, the tighter the gaps; the shipped curve runs from loose at level 1 to tight at level 13) */
"use strict";
var C=require("../js/hardest13.js");
var Q=8, DT=1/(C.SPEED*Q), HORIZON=150;
var tight=process.argv[2]==="tight", margin=tight?0:parseFloat(process.argv[2]||".05"), only=process.argv.slice(3).map(Number);
var GW=C.COLS*Q+1, GH=C.ROWS*Q+1;

function solve(li){
  var L=C.parse(C.LEVELS[li]), n=L.coins.length, full=(1<<n)-1, i, x, y;
  var open=new Uint8Array(GW*GH), bits=new Uint8Array(GW*GH), goal=new Uint8Array(GW*GH);
  for(y=0;y<GH;y++) for(x=0;x<GW;x++){
    var px=x/Q, py=y/Q, k=y*GW+x; if(C.blocked(L,px,py)) continue; open[k]=1;
    for(i=0;i<n;i++) if(C.boxCircle(px,py,C.PH,L.coins[i].x,L.coins[i].y,C.CR)) bits[k]|=1<<i;
    if(C.tile(L,Math.floor(px),Math.floor(py))===3) goal[k]=1;
  }
  /* unsafe grids, stamped bug by bug for one moment */
  var R=C.ER+margin, reach=Math.ceil((C.HIT+R)*Q)+1, P={x:0,y:0};
  function unsafe(t,out){
    out.fill(0);
    for(var e=0;e<L.en.length;e++){ C.epos(L.en[e],t,P); var cx=Math.round(P.x*Q), cy=Math.round(P.y*Q);
      for(var yy=Math.max(0,cy-reach);yy<=Math.min(GH-1,cy+reach);yy++) for(var xx=Math.max(0,cx-reach);xx<=Math.min(GW-1,cx+reach);xx++)
        if(C.boxCircle(xx/Q,yy/Q,C.HIT,P.x,P.y,R)) out[yy*GW+xx]=1; }
    return out;
  }
  var mid=new Uint8Array(GW*GH), end=new Uint8Array(GW*GH), seen=new Uint32Array(GW*GH*(full+1));
  var sx=Math.round(L.sx*Q), sy=Math.round(L.sy*Q), cur=[(sy*GW+sx)*(full+1)+bits[sy*GW+sx]], steps=Math.ceil(HORIZON/DT);
  var hist=[{par:null,mv:null}], par=[], mv=[];
  for(var s=1;s<=steps;s++){
    var t=s*DT; unsafe(t-DT/2,mid); unsafe(t,end);
    var nxt=[]; par=[]; mv=[];
    for(var j=0;j<cur.length;j++){
      var st=cur[j], m=st%(full+1), pos=(st-m)/(full+1), x0=pos%GW, y0=(pos-x0)/GW;
      if(mid[pos]) continue;
      for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
        var nx=x0+dx, ny=y0+dy; if(nx<0||ny<0||nx>=GW||ny>=GH) continue;
        var np=ny*GW+nx; if(!open[np]||mid[np]||end[np]) continue;
        if(dx&&dy&&!open[y0*GW+nx]) continue; /* the game moves along x first, then y: no cutting a wall corner */
        var nm=m|bits[np];
        if(goal[np]&&nm===full){ if(tight) return {t:t}; var route=[(dx+1)*3+dy+1], at=j; for(var h=hist.length-1;h>0;h--){ route.push(hist[h].mv[at]); at=hist[h].par[at]; } return {t:t,route:route.reverse()}; }
        var key=np*(full+1)+nm; if(seen[key]===s) continue; seen[key]=s; nxt.push(key); if(!tight){ par.push(j); mv.push((dx+1)*3+dy+1); }
      }
    }
    hist.push({par:par,mv:mv}); cur=nxt; if(!cur.length) return {t:-1,dead:t};
  }
  return {t:-1,horizon:true};
}
var bad=0;
if(tight){
  C.LEVELS.forEach(function(lv,li){
    if(only.length&&only.indexOf(li+1)<0) return;
    var lo=0, hi=.6; margin=lo; if(solve(li).t<0){ console.log(String(li+1).padStart(2)+" "+lv.name.padEnd(15)+"FAIL even with no margin"); return; }
    for(var k=0;k<7;k++){ margin=(lo+hi)/2; if(solve(li).t>=0) lo=margin; else hi=margin; }
    console.log(String(li+1).padStart(2)+" "+lv.name.padEnd(15)+"beatable up to a margin of "+lo.toFixed(3)+" tiles");
  });
  process.exit(0);
}
C.LEVELS.forEach(function(lv,li){
  if(only.length&&only.indexOf(li+1)<0) return;
  var t0=Date.now(), r=solve(li), replay="";
  if(r.t>=0){ /* walk the route through the game's own tick(): it must clear the level without a single death */
    var G=C.newGame(li), ev=[], won=false;
    r.route.forEach(function(m){ var d=[Math.floor(m/3)-1,m%3-1]; ev.length=0; C.tick(G,+d[0],+d[1],DT,ev); if(ev.indexOf("win")>=0) won=true; });
    replay=won&&!G.deaths?"  replay clears it":"  REPLAY FAILED ("+G.deaths+" deaths, won "+won+")"; if(!won||G.deaths) bad++;
  }
  if(r.t<0) bad++;
  console.log(String(li+1).padStart(2)+" "+lv.name.padEnd(15)+(r.t>=0?"OK   fastest route "+r.t.toFixed(1)+" s"+replay:"FAIL "+(r.horizon?"no route within "+HORIZON+" s":"every route dies by "+r.dead.toFixed(1)+" s"))+"  ("+(Date.now()-t0)+" ms)");
});
console.log("margin "+margin+" tiles on every bug; "+(bad?bad+" level(s) not beatable":"every level beatable"));
process.exit(bad?1:0);
