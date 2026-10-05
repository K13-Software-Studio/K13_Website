(function(){
"use strict";
var reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* footer year: never goes stale by hand; the typed year is the no-JS fallback */
document.querySelectorAll("[data-current-year]").forEach(function(el){el.textContent=new Date().getFullYear();});

/* smooth scroll */
var lenis=null;
function startLenis(){ if(reduced || !window.Lenis) return;
  lenis=new Lenis({lerp:0.13,smoothWheel:true});
  window.__k13Lenis=lenis;
  var raf=function(t){ lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
if(window.Lenis) startLenis(); else window.addEventListener("DOMContentLoaded",startLenis);
function scrollTo(el){ if(lenis) lenis.scrollTo(el,{offset:-30,duration:1.2}); else el.scrollIntoView({behavior:reduced?"auto":"smooth"}); }
document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach(function(a){
  a.addEventListener("click",function(e){ var id=a.getAttribute("href"); if(id.length>1){ var el=document.querySelector(id); if(el){ e.preventDefault(); scrollTo(el); } } });
});
/* skip link: same smooth-scroll, but also actually move focus into <main> -- the shared
   handler above intentionally short-circuits native anchor navigation (which is what would
   normally focus the target), so a skip link needs its own explicit focus() call */
var skipLink=document.querySelector(".skip-link");
if(skipLink){
  skipLink.addEventListener("click",function(e){
    var el=document.querySelector(skipLink.getAttribute("href"));
    if(el){ e.preventDefault(); scrollTo(el); el.focus({preventScroll:true}); }
  });
}

/* header */
var hdr=document.getElementById("hdr");
function onScroll(){ hdr.classList.toggle("scrolled",(window.scrollY||0)>30); }
window.addEventListener("scroll",onScroll,{passive:true}); onScroll();

/* sketch loader: the logo is drawn first and shown through the mask; boxes are outlined by hand;
   every letter of the real copy is swept in from left, above and below and settles in reading order,
   on the exact spot of the real letter beneath; then the mask lifts and the real page is just there */
(function(){
  var root=document.documentElement,sk=document.getElementById("sk");
  if(!sk) return;
  if(!root.classList.contains("sk-on")){ sk.remove(); return; }
  function finish(){ sk.remove(); root.classList.remove("sk-on"); }
  if((window.scrollY||0)>40){ finish(); return; }
  /* the hero takes its final state under the mask, so nothing changes after it lifts */
  document.querySelectorAll(".hero .rv").forEach(function(el){ el.classList.add("in"); });
  document.querySelectorAll(".hero [data-count]").forEach(function(el){ el.textContent=el.getAttribute("data-count"); el.removeAttribute("data-count"); });
  var NS="http://www.w3.org/2000/svg",svg,pen,boxes=[],lines=[],chars=[],t0=0,R=0,skipAt=0;
  var n=0; function w(){ n++; return Math.sin(n*12.9898)*1.8; }
  function rnd(k){ var x=Math.sin(k*78.233+12.9898)*43758.5453; return x-Math.floor(x); }
  function seen(q){ return q.right-q.left>2&&q.bottom>0&&q.top<innerHeight; }
  function box(el){ var q=el.getBoundingClientRect(); return {left:q.left,top:q.top,right:q.right,bottom:q.bottom}; }
  function rectPath(q,r){ var x=q.left-4,y=q.top-4,W=q.right-q.left+8,H=q.bottom-q.top+8; r=Math.min(r,H/2);
    return "M"+(x+r)+" "+(y+w())+" L"+(x+W-r)+" "+(y+w())+" Q"+(x+W)+" "+y+" "+(x+W+w())+" "+(y+r)+" L"+(x+W+w())+" "+(y+H-r)+
      " Q"+(x+W)+" "+(y+H)+" "+(x+W-r)+" "+(y+H+w())+" L"+(x+r)+" "+(y+H+w())+" Q"+x+" "+(y+H)+" "+(x+w())+" "+(y+H-r)+" L"+(x+w())+" "+(y+r)+" Q"+x+" "+y+" "+(x+r)+" "+y; }
  function addBox(el,r,accent,fill){ if(!el) return; var q=box(el); if(!seen(q)) return;
    var cs=getComputedStyle(el); boxes.push({q:q,r:r,o:!!accent,bg:fill?cs.backgroundColor:null,rad:cs.borderRadius}); }
  /* every visible letter of an element, measured where the browser actually drew it */
  function addText(el){ if(!el) return; var tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),node,rg=document.createRange(),mine=[];
    while((node=tw.nextNode())){ var cs=getComputedStyle(node.parentElement),d=node.data;
      for(var i=0;i<d.length;i++){ if(/\s/.test(d[i])) continue; rg.setStart(node,i); rg.setEnd(node,i+1);
        var rs=rg.getClientRects(); if(!rs.length) continue; var q=rs[0]; if(!seen(q)||q.width<.5) continue;
        mine.push({ch:d[i],x:q.left,y:q.top,w:q.width,h:q.height,cs:cs}); } }
    /* group into visual lines, in reading order */
    mine.forEach(function(c){ var L=null; for(var j=lines.length-1;j>=0&&j>=lines.length-6;j--){ if(lines[j].el===el&&Math.abs(lines[j].top-c.y)<c.h*.5){ L=lines[j]; break; } }
      if(!L){ L={el:el,top:c.y,h:c.h,left:c.x,right:c.x+c.w,cs:[]}; lines.push(L); }
      L.left=Math.min(L.left,c.x); L.right=Math.max(L.right,c.x+c.w); L.h=Math.max(L.h,c.h); L.cs.push(c); c.L=L; chars.push(c); }); }
  function each(sel,fn){ document.querySelectorAll(sel).forEach(fn); }
  function build(){
    addBox(document.querySelector("#hdr .brand"),10);
    addBox(document.querySelector("#hdr nav .btn"),12,true,true);
    each(".hero-cta .btn",function(e,i){ addBox(e,12,i===0,true); });
    addBox(document.querySelector(".hero .wm"),22,false,true);
    addBox(document.querySelector(".hero .wm-steps li.on"),100,false,true);
    addBox(document.querySelector(".hero .wm-stage"),12);
    addBox(document.querySelector(".hero .wm-frow input"),11);
    addBox(document.querySelector(".hero .wm-go"),11,false,true);
    each("#hdr .nl",addText); each("#hdr nav .btn",addText);
    each(".hero .eyebrow",addText); each(".hero h1",addText); each(".hero-sub",addText);
    each(".hero-cta .btn",addText); each(".hero-meta span",addText);
    each(".hero .wm-title, .hero .wm-steps li, .hero .wm-wlab span, .hero .wm-wlab b, .hero .wm-say span, .hero .wm-live > span:not(.vh), .hero .wm-stats .st b, .hero .wm-stats .st span, .hero .wm-flab, .hero .wm-go, .hero .wall-toggle",addText);
    svg=document.createElementNS(NS,"svg"); pen=document.createElement("i"); pen.className="pen";
    boxes.forEach(function(it,i){ var q=it.q,d=document.createElement("div"); d.className="b";
      d.style.cssText="left:"+q.left+"px;top:"+q.top+"px;width:"+(q.right-q.left)+"px;height:"+(q.bottom-q.top)+"px;border-radius:"+it.rad;
      sk.appendChild(d); it.el=d;
      var p=document.createElementNS(NS,"path"); p.setAttribute("d",rectPath(q,it.r)); if(it.o) p.setAttribute("class","o"); svg.appendChild(p); it.p=p;
      it.a=i===0?.02:.07+(i-1)*.06; it.d=i===0?.2:.24; });
    sk.appendChild(svg);
    /* text: a soft skeleton bar per line, the broom, and the letters */
    lines.forEach(function(L,li){ var b=document.createElement("div"); b.className="b";
      var bh=Math.max(8,L.h*.5); b.style.cssText="left:"+L.left+"px;top:"+(L.top+(L.h-bh)/2)+"px;width:"+(L.right-L.left)+"px;height:"+bh+"px"; sk.appendChild(b); L.bar=b;
      var br=document.createElement("i"); br.className="broom"; br.style.top=(L.top-L.h*.15)+"px"; br.style.height=(L.h*1.3)+"px"; sk.appendChild(br); L.broom=br;
      L.s=.1+li*.026; L.D=.26+Math.min(.12,(L.right-L.left)/4000); });
    chars.forEach(function(c,i){ var e=document.createElement("span"),cs=c.cs; e.className="ch"; e.textContent=c.ch;
      e.style.cssText="left:"+c.x+"px;top:"+c.y+"px;font-family:"+cs.fontFamily+";font-size:"+cs.fontSize+";font-weight:"+cs.fontWeight+";font-style:"+cs.fontStyle+
        ";color:"+cs.color+";text-transform:"+cs.textTransform+";font-feature-settings:"+cs.fontFeatureSettings+";font-variation-settings:"+cs.fontVariationSettings+
        ";font-optical-sizing:"+cs.fontOpticalSizing+";font-variant-numeric:"+cs.fontVariantNumeric;
      sk.appendChild(e); c.e=e; var L=c.L,u=(c.x-L.left)/Math.max(1,L.right-L.left);
      c.land=L.s+L.D*u; c.fly=.26; c.dx=-(40+rnd(i)*150)*(.6+L.h/80); c.dy=(rnd(i+.5)<.5?-1:1)*(10+rnd(i+.3)*55)*(.5+L.h/70); c.rot=(rnd(i+.7)-.5)*50; });
    sk.appendChild(pen);
    boxes.forEach(function(it){ it.L=it.p.getTotalLength(); it.p.style.strokeDasharray=it.L; it.p.style.strokeDashoffset=it.L; });
    var lastLand=chars.reduce(function(m,c){ return Math.max(m,c.land); },0),lastBox=boxes.reduce(function(m,it){ return Math.max(m,it.a+it.d+.12); },0);
    R=Math.max(lastLand,lastBox)+.05;
    if(boxes[0]){ var q=boxes[0].q,x=q.left-10,y=q.top-10,W=q.right-q.left+20,H=q.bottom-q.top+20; boxes[0].r0=boxes[0].a+boxes[0].d+.02;
      boxes[0].hole='path(evenodd,"M0 0H'+innerWidth+'V'+innerHeight+'H0Z M'+x+' '+y+'h'+W+'v'+H+'h'+(-W)+'Z")'; }
    ["pointerdown","keydown","wheel","touchstart"].forEach(function(ev){ addEventListener(ev,skip,{passive:true,once:true}); });
    sk.style.animation="none"; requestAnimationFrame(function(ts){ t0=ts; frame(ts); });
  }
  function skip(){ if(!skipAt) skipAt=1; }
  function cl(x){ return x<0?0:x>1?1:x; }
  var ease=function(x){ x=cl(x); return 1-Math.pow(1-x,3); },io=function(x){ x=cl(x); return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2; },
      back=function(x){ x=cl(x); var c=1.4; return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2); };
  function frame(ts){ var t=(ts-t0)/1000;
    if(skipAt===1){ skipAt=t; R=Math.min(R,t); }
    var done=skipAt?1:0,tip=null;
    /* outlines, then the box takes its real fill so white button text has somewhere to land */
    boxes.forEach(function(it,i){ var k=done?1:io((t-it.a)/it.d); it.p.style.strokeDashoffset=it.L*(1-k); if(k>0&&k<1) tip=it.p.getPointAtLength(it.L*k);
      if(it.bg){ var f=done?1:ease((t-it.a-it.d+.04)/.14); if(f>0) it.el.style.background=it.bg; it.el.style.opacity=1; it.el.classList.toggle("filled",f>0); }
      if(it.hole){ var lr=done?1:ease((t-it.r0)/.12); it.el.style.opacity=1-lr; it.p.style.opacity=1-lr; if(!it.holed&&t>=it.r0){ sk.firstChild.style.clipPath=it.hole; it.holed=1; } } });
    /* letters: pulled toward their line first (the broom gathers them), then slid into place */
    chars.forEach(function(c){ var u=done?1:cl((t-(c.land-c.fly))/c.fly);
      if(u<=0){ c.e.style.opacity=0; return; }
      var ux=back(u),uy=ease(Math.min(1,u*1.6));
      c.e.style.opacity=cl(u*2.4); c.e.style.transform="translate("+(c.dx*(1-ux))+"px,"+(c.dy*(1-uy))+"px) rotate("+(c.rot*(1-ease(u)))+"deg) scale("+(.55+.45*ease(u))+")"; });
    lines.forEach(function(L){ var u=done?1:cl((t-L.s)/L.D); L.bar.style.opacity=1-ease((t-L.s-L.D*.4)/(L.D*.8))*(done?0:1)*(done?0:1)-(done?1:0);
      L.broom.style.opacity=done?0:Math.sin(Math.PI*u)*.95; L.broom.style.left=(L.left+(L.right-L.left)*u+6)+"px"; });
    if(tip&&!done){ pen.style.opacity=1; pen.style.transform="translate("+tip.x+"px,"+tip.y+"px)"; } else pen.style.opacity=0;
    /* the lift: paper first, then letters, bars and outlines; the real page is already underneath */
    var lift=ease((t-R)/.24); sk.firstChild.style.opacity=1-lift;
    var rest=1-ease((t-R-.04)/.2); svg.style.opacity=rest; boxes.forEach(function(it){ if(!it.hole) it.el.style.opacity=rest; });
    chars.forEach(function(c){ if(t>R) c.e.style.opacity=rest; });
    if(t<R+.3) requestAnimationFrame(frame); else finish(); }
  var ready=document.fonts&&document.fonts.ready?Promise.race([document.fonts.ready,new Promise(function(r){ setTimeout(r,1200); })]):Promise.resolve();
  ready.then(function(){ requestAnimationFrame(build); });
})();


/* reveal */
var io=new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); } }); },{threshold:0.16,rootMargin:"0px 0px -8% 0px"});
document.querySelectorAll(".rv").forEach(function(el){
  var i=0,n=el; while((n=n.previousElementSibling)){ if(n.classList.contains("rv")) i++; }
  el.style.setProperty("--i",Math.min(i,8)); io.observe(el); });
document.addEventListener("focusin",function(e){ var r=e.target.closest&&e.target.closest(".rv"); if(r) r.classList.add("in"); });
setTimeout(function(){ document.querySelectorAll(".hero .rv").forEach(function(el){ el.classList.add("in"); }); },160);

/* count-up */
var counted=false;
function countUp(){ if(counted)return; var els=document.querySelectorAll("[data-count]"); if(!els.length)return;
  if(els[0].getBoundingClientRect().top>window.innerHeight*0.95)return; counted=true;
  els.forEach(function(el){ var target=parseInt(el.getAttribute("data-count"),10),start=null;
    if(reduced){ el.textContent=target; return; }
    function step(t){ if(!start)start=t; var p=Math.min(1,(t-start)/1300); p=1-Math.pow(1-p,3); el.textContent=Math.round(target*p); if(p<1) requestAnimationFrame(step); }
    requestAnimationFrame(step); }); }
window.addEventListener("scroll",countUp,{passive:true}); countUp();

/* touch / narrow: inject inline screenshot per row (no hover preview there) */
(function(){
  if(!window.matchMedia("(hover:none), (max-width:920px)").matches) return;
  document.querySelectorAll(".row[data-peek]").forEach(function(row){
    if(row.querySelector(".rthumb")) return;
    var im=document.createElement("img");
    im.className="rthumb"; im.loading="lazy"; im.decoding="async"; im.alt="";
    im.src="assets/shots/webp/"+row.getAttribute("data-peek")+"-750.webp";
    row.insertBefore(im,row.firstChild);
  });
})();

/* work index cursor preview: sits just beside the pointer (flips left near the right edge),
   appears where the pointer is instead of flying in from the corner, and is smoothed once, here,
   never again by a CSS transition on transform (that double smoothing made it lag and wander) */
(function(){
  var peek=document.getElementById("peek"), vid=document.getElementById("peekVid");
  if(!peek || !vid || !window.matchMedia("(hover:hover)").matches) return;
  var GAP=28,tx=0,ty=0,cx=0,cy=0,s=.94,mx=0,my=0,active=false,shown=false,raf=null;
  function aim(){ var w=peek.offsetWidth,h=peek.offsetHeight;
    tx=(mx+GAP+w>innerWidth-12)?mx-GAP-w:mx+GAP;
    ty=Math.max(12,Math.min(innerHeight-h-12,my-h/2)); }
  function paint(){ peek.style.transform="translate("+cx+"px,"+cy+"px) scale("+s+") rotate(-2deg)"; }
  function loop(){ var k=reduced?1:.35; cx+=(tx-cx)*k; cy+=(ty-cy)*k; s+=((active?1:.94)-s)*.25; paint();
    var moving=Math.abs(tx-cx)>.3||Math.abs(ty-cy)>.3||Math.abs((active?1:.94)-s)>.002;
    raf=(active||moving)?requestAnimationFrame(loop):null; }
  function kick(){ if(!raf) raf=requestAnimationFrame(loop); }
  document.querySelectorAll(".row[data-peek]").forEach(function(row){
    row.addEventListener("mouseenter",function(e){
      var n=row.getAttribute("data-peek"), src="assets/shots/loops/"+n+".mp4";
      vid.poster="assets/shots/webp/"+n+"-1500.webp";
      if(vid.getAttribute("src")!==src){ vid.setAttribute("src",src); vid.load(); }
      if(!reduced){ var pr=vid.play(); if(pr&&pr.catch) pr.catch(function(){}); }
      mx=e.clientX; my=e.clientY; aim();
      if(!shown){ cx=tx; cy=ty; s=.94; paint(); }  /* start under the pointer, not at the corner */
      active=shown=true; peek.classList.add("on"); kick(); });
    row.addEventListener("mouseleave",function(){ active=false; peek.classList.remove("on"); vid.pause(); kick(); });
  });
  peek.addEventListener("transitionend",function(){ if(!active) shown=false; });
  document.addEventListener("mousemove",function(e){ mx=e.clientX; my=e.clientY; if(active){ aim(); kick(); } },{passive:true});
})();

/* about portrait: layered scroll depth (transform-only, runs only while visible) */
(function(){
  var wrap=document.getElementById("portrait"); if(!wrap||reduced) return;
  var layers=Array.prototype.map.call(wrap.querySelectorAll("[data-depth]"),function(el){
    return { el:el, d:parseFloat(el.getAttribute("data-depth"))||0, s:el.getAttribute("data-scale")||"" };
  });
  var vis=false,ticking=false;
  function update(){
    ticking=false;
    var r=wrap.getBoundingClientRect(), vh=window.innerHeight||1;
    var p=(r.top+r.height/2-vh/2)/vh; /* 0 at viewport centre, ±~0.8 at the edges */
    for(var i=0;i<layers.length;i++){ var l=layers[i];
      l.el.style.transform="translate3d(0,"+(p*l.d*90).toFixed(2)+"px,0)"+(l.s?" scale("+l.s+")":"");
    }
  }
  function ask(){ if(vis&&!ticking){ ticking=true; requestAnimationFrame(update); } }
  new IntersectionObserver(function(es){ vis=es[0].isIntersecting; ask(); },{rootMargin:"12% 0px"}).observe(wrap);
  window.addEventListener("scroll",ask,{passive:true});
  window.addEventListener("resize",ask,{passive:true});
})();

/* multi-step contact -> drafts a pre-filled email */
(function(){
  var stage=document.getElementById("stepStage"); if(!stage) return;
  var screens=Array.prototype.slice.call(stage.querySelectorAll(".screen-s"));
  var prog=document.getElementById("stepProg"), sum=document.getElementById("stepSum");
  var back=document.getElementById("stepBack"), lab=document.getElementById("stepLab"), sent=document.getElementById("sent");
  var data={type:"",name:"",email:"",why:""}, idx=0;
  screens.forEach(function(){ var i=document.createElement("i"); prog.appendChild(i); });
  var dots=prog.querySelectorAll("i");
  function render(){
    screens.forEach(function(s,i){ s.classList.toggle("on",i===idx); s.classList.toggle("past",i<idx); s.inert=(i!==idx); });
    dots.forEach(function(d,i){ d.classList.toggle("on",i<=idx); });
    back.classList.toggle("on",idx>0);
    back.disabled=(idx===0);
    lab.textContent="Step "+(idx+1)+" of "+screens.length;
    sum.innerHTML=""; var parts=[];
    if(data.type) parts.push(["Building",data.type,0]);
    if(data.name) parts.push(["Name",data.name,1]);
    if(data.email) parts.push(["Email",data.email,2]);
    parts.forEach(function(p){ var c=document.createElement("button"); c.type="button"; c.className="sc"; var lb=document.createElement("b"); lb.textContent=p[0]; c.appendChild(lb); c.appendChild(document.createTextNode(p[1]));
      c.addEventListener("click",function(){ idx=p[2]; render(); }); sum.appendChild(c); });
    sum.classList.toggle("on",parts.length>0 && idx>0);
    var inp=screens[idx].querySelector("input,textarea"); if(inp) setTimeout(function(){ inp.focus(); },360);
  }
  function go(i){ idx=Math.max(0,Math.min(screens.length-1,i)); render(); }
  back.addEventListener("click",function(){ go(idx-1); });
  stage.querySelectorAll(".opt").forEach(function(o){ o.addEventListener("click",function(){ data.type=o.getAttribute("data-pick"); go(1); }); });
  var nameI=document.getElementById("sName");
  document.getElementById("nameNext").addEventListener("click",function(){ data.name=nameI.value.trim(); go(2); });
  nameI.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); data.name=nameI.value.trim(); go(2); } });
  var emailI=document.getElementById("sEmail");
  document.getElementById("emailNext").addEventListener("click",function(){ data.email=emailI.value.trim(); go(3); });
  document.getElementById("emailSkip").addEventListener("click",function(){ data.email=""; go(3); });
  emailI.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); data.email=emailI.value.trim(); go(3); } });
  /* the hero's wish box hands its text over here (js/wish.js): it lands in the last step's "why" field,
     where the visitor can still edit it, and step one says so. Nothing is sent from here. */
  document.addEventListener("k13:wish",function(e){
    var t=((e.detail&&e.detail.text)||"").replace(/\s+/g," ").trim().slice(0,200); if(!t) return;
    var why=document.getElementById("sWhy"), note=document.getElementById("wishNote"); if(!why) return;
    why.value=t;
    if(note){ note.textContent="Your wish is saved for the last step: \u201C"+t+"\u201D"; note.hidden=false; }
  });
  function compose(){
    data.why=document.getElementById("sWhy").value.trim();
    var huntSubject=""; try{ huntSubject=sessionStorage.getItem("k13Subject")||""; }catch(e){}   /* set by the hunt when all 13 are found */
    var subject=(huntSubject||"Project inquiry")+(data.type?": "+data.type:"")+(data.name?" ("+data.name+")":"");
    var body="Hi Kazim,\r\n\r\n"
      +(data.type?"We're building: "+data.type+"\r\n":"")
      +(data.why?"\r\nWhy it matters: "+data.why+"\r\n":"")
      +"\r\n--\r\n"+(data.name||"")+(data.email?"\r\n"+data.email:"");
    return {subject:subject,body:body};
  }
  /* guard shared by all three ways out: never send or claim success on empty data */
  function ready(){ if(!data.type || !data.name){ go(!data.type?0:1); return false; } return true; }
  var copyNote=document.getElementById("copyNote");
  document.getElementById("gmailIt").addEventListener("click",function(){
    if(!ready()) return; var m=compose();
    var url="https://mail.google.com/mail/?view=cm&fs=1&to=projects.k13@gmail.com&su="+encodeURIComponent(m.subject)+"&body="+encodeURIComponent(m.body);
    var w=window.open(url,"_blank","noopener,noreferrer");
    if(!w){ copyNote.textContent="The browser blocked the new tab. Allow pop-ups for this page, or use Copy the message."; return; }
    document.getElementById("stepBody").inert=true; sent.inert=false;
    document.getElementById("sentTitle").textContent="Gmail opened in a new tab.";
    document.getElementById("sentMsg").textContent="Review it there, then hit send.";
    sent.classList.add("on");
  });
  var copyBtn=document.getElementById("copyIt");
  copyBtn.addEventListener("click",function(){
    if(!ready()) return; var m=compose(), text=m.subject+"\r\n\r\n"+m.body;
    if(!navigator.clipboard||!navigator.clipboard.writeText){ copyNote.textContent="This browser can't copy for us. Email us at projects.k13@gmail.com instead."; return; }
    navigator.clipboard.writeText(text).then(function(){
      copyBtn.textContent="Copied. Paste it anywhere you send email from."; copyNote.textContent="";
    },function(){
      copyNote.textContent="The copy didn't go through. Email us at projects.k13@gmail.com instead.";
    });
  });
  document.getElementById("sendIt").addEventListener("click",function(){
    if(!ready()) return; var m=compose(), subject=m.subject, body=m.body;
    var mailHref="mailto:projects.k13@gmail.com?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
    var title=document.getElementById("sentTitle"), msg=document.getElementById("sentMsg"), fallback=document.getElementById("sentFallback");
    var handedOff=false;
    function markHandedOff(){ if(handedOff) return; handedOff=true; title.textContent="Your mail app opened."; }
    window.addEventListener("blur",markHandedOff,{once:true});
    document.addEventListener("visibilitychange",function onVis(){
      if(document.hidden){ markHandedOff(); document.removeEventListener("visibilitychange",onVis); } });
    /* seal the form behind the success panel: inert the whole step-body (back button, chips, the
       active screen's field + send button) so nothing is tabbable underneath it, then reveal .sent
       (removing its own inert) and set its text fresh so the role=status live region actually has
       something to announce -- a region that was already inert/hidden at load never "changes" */
    document.getElementById("stepBody").inert=true;
    sent.inert=false;
    title.textContent="Opening your mail app…";
    msg.textContent="Your message is filled in and ready. Review it in your mail app, then hit send.";
    sent.classList.add("on");
    setTimeout(function(){
      window.location.href=mailHref;
      /* can't know for certain a mail client opened -- if nothing took focus away, offer a fallback instead of a false success claim */
      setTimeout(function(){ if(!handedOff) fallback.hidden=false; },1200);
    },700);
  });
  render();
})();

/* who it's for: a door highlights the tickets that prove it (rows dim, never disappear) */
(function(){
  var btns=document.querySelectorAll(".door-btn"); if(!btns.length) return;
  var rows=document.querySelectorAll(".row[data-door]");
  var reset=document.getElementById("doorReset"), resetBtn=document.getElementById("doorResetBtn"), label=document.getElementById("doorResetLabel");
  var names={hospitality:"restaurant and hospitality groups",founders:"founders with a product",brands:"brands and makers",institutions:"institutions"};
  function apply(k){
    btns.forEach(function(b){ b.setAttribute("aria-pressed",String(b.getAttribute("data-door")===k)); });
    rows.forEach(function(r){ r.classList.toggle("dim",!!k && r.getAttribute("data-door")!==k); });
    reset.hidden=!k; if(k) label.textContent="Showing the work for "+names[k]+".";
  }
  btns.forEach(function(b){ b.addEventListener("click",function(){
    var k=b.getAttribute("data-door"), on=b.getAttribute("aria-pressed")==="true";
    apply(on?null:k); if(!on) scrollTo(document.getElementById("work"));
  }); });
  resetBtn.addEventListener("click",function(){ apply(null); });
})();

/* craft showroom: one switch tags every section of this page with its own level and why */
(function(){
  var sw=document.getElementById("showroom"), help=document.getElementById("showroomHelp"); if(!sw) return;
  var html=document.documentElement;
  var ON="Now showing. Every section, tagged with its own level and why.", OFF="Flip it. See what level of craft went into this exact page.";
  document.querySelectorAll("[data-craft]").forEach(function(sec){
    var wrap=sec.querySelector(".wrap")||sec, tag=document.createElement("div"); tag.className="craft-tag"; tag.setAttribute("aria-hidden","true");
    var lvl=sec.getAttribute("data-craft"), why=sec.getAttribute("data-craft-why"), out="";
    if(sec.hasAttribute("data-craft-opening")){
      var ol=sec.getAttribute("data-craft-opening");
      out+='<b class="lvl-'+ol.toLowerCase()+'">Opening · '+ol+'</b><span>'+sec.getAttribute("data-craft-opening-why")+' <a class="replay" href="?intro#top">Replay the opening</a></span>';
    }
    out+='<b class="lvl-'+lvl.toLowerCase()+'">'+lvl+'</b><span>'+why+'</span>';
    tag.innerHTML=out; tag.inert=true; wrap.insertBefore(tag,wrap.firstChild);
  });
  function set(on){
    sw.setAttribute("aria-checked",String(on)); help.textContent=on?ON:OFF;
    if(on) html.setAttribute("data-showroom",""); else html.removeAttribute("data-showroom");
    document.querySelectorAll(".craft-tag").forEach(function(t){ t.setAttribute("aria-hidden",String(!on)); t.inert=!on; });
    try{ localStorage.setItem("k13-showroom",on?"1":"0"); }catch(e){}
  }
  var saved=false; try{ saved=localStorage.getItem("k13-showroom")==="1"; }catch(e){}
  if(saved) set(true);
  sw.addEventListener("click",function(){ set(sw.getAttribute("aria-checked")!=="true"); });
})();

/* the lockup gets one sheen the moment the sketch loader hands the page over */
(function(){
  var brand=document.querySelector(".brand"); if(!brand||reduced) return;
  var html=document.documentElement;
  function fire(){ brand.classList.add("sheen","sheen-once"); setTimeout(function(){ brand.classList.remove("sheen-once"); },1200); }
  if(!html.classList.contains("sk-on")){ setTimeout(fire,700); return; }
  new MutationObserver(function(m,o){ if(!html.classList.contains("sk-on")){ o.disconnect(); setTimeout(fire,500); } }).observe(html,{attributes:true,attributeFilter:["class"]});
})();

/* the hunt: six of the thirteen hidden marks live in this page's own markup; the workbench places them */
document.addEventListener("DOMContentLoaded",function(){
  if(!(window.K13&&window.K13.hunt&&window.K13.hunt.place)) return;
  document.querySelectorAll("[data-hunt]").forEach(function(el){ window.K13.hunt.place(el); });
});


/* hero stage: the moving screens behind the headline. A pause control (it moves for longer than
   five seconds), a third row for depth, a slow parallax from the pointer and the scroll, and it
   rests when off screen */
(function(){
  var st=document.getElementById("heroStage"), t=document.getElementById("wallToggle"); if(!st) return;
  var rows=st.querySelector(".wall-rows"), r0=rows&&rows.querySelector(".wall-row");
  if(r0){ var r3=r0.cloneNode(true); r3.classList.add("wall-row-far"); rows.insertBefore(r3,r0); }
  var user=false;
  if(t) t.addEventListener("click",function(){ user=!user; st.classList.toggle("paused",user); t.setAttribute("aria-pressed",String(user)); t.textContent=user?"Play the motion":"Pause the motion"; });
  new IntersectionObserver(function(es){ if(!user) st.classList.toggle("paused",!es[0].isIntersecting); }).observe(st);
  if(reduced) return;
  var plane=st.querySelector(".hero-plane"),px=0,py=0,cx=0,cy=0,sy=0,raf=null;
  function loop(){ cx+=(px-cx)*.06; cy+=(py-cy)*.06;
    plane.style.setProperty("--px",cx.toFixed(4)); plane.style.setProperty("--py",cy.toFixed(4)); plane.style.setProperty("--sy",sy.toFixed(1));
    raf=(Math.abs(px-cx)>.001||Math.abs(py-cy)>.001)?requestAnimationFrame(loop):null; }
  function kick(){ if(!raf) raf=requestAnimationFrame(loop); }
  if(window.matchMedia("(hover:hover)").matches) addEventListener("pointermove",function(e){ if((scrollY||0)>innerHeight) return; px=e.clientX/innerWidth-.5; py=e.clientY/innerHeight-.5; kick(); },{passive:true});
  addEventListener("scroll",function(){ var y=scrollY||0; if(y>innerHeight*1.2) return; sy=y; kick(); },{passive:true});
})();

/* drafting motifs: ruler ticks drawn once, then each layer drifts at its own depth */
(function(){
  var g=document.querySelector(".motif.m2 .ticks");
  if(g){ var ns="http://www.w3.org/2000/svg"; for(var x=0;x<=520;x+=13){ var l=document.createElementNS(ns,"line"); var tall=(x/13)%5===0; l.setAttribute("x1",x); l.setAttribute("x2",x); l.setAttribute("y1",30); l.setAttribute("y2",tall?12:22); g.appendChild(l); } }
  var box=document.querySelector(".motifs"); if(!box) return;
  function fit(){ box.style.height=document.documentElement.scrollHeight+"px"; }
  fit(); window.addEventListener("load",fit); window.addEventListener("resize",fit);
  if(reduced) return;
  var layers=Array.prototype.map.call(box.querySelectorAll(".motif"),function(el){ return {el:el,d:parseFloat(el.getAttribute("data-depth"))||0}; });
  var ticking=false;
  function update(){ ticking=false; var y=window.scrollY||0; layers.forEach(function(l){ l.el.style.transform="translate3d(0,"+(-y*l.d).toFixed(1)+"px,0) rotate("+(y*l.d*0.02).toFixed(2)+"deg)"; }); }
  window.addEventListener("scroll",function(){ if(!ticking){ ticking=true; requestAnimationFrame(update); } },{passive:true}); update();
})();


/* phones: Menu button opens the nav as a panel; Esc or picking a link closes it */
(function(){
  var btn=document.getElementById("menuBtn"), hdr=document.getElementById("hdr"); if(!btn||!hdr) return;
  function set(on){ hdr.classList.toggle("menu-open",on); btn.setAttribute("aria-expanded",String(on)); btn.textContent=on?"Close":"Menu"; }
  btn.addEventListener("click",function(){ set(btn.getAttribute("aria-expanded")!=="true"); });
  document.querySelectorAll("#siteNav a").forEach(function(a){ a.addEventListener("click",function(){ set(false); }); });
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&hdr.classList.contains("menu-open")){ set(false); btn.focus(); } });
})();


/* moving screens behind the hero: desktop with hover only, never on phones; the loops are fetched
   once the page is up (after the sketch loader), and play only while the hero is on screen */
(function(){
  var wall=document.getElementById("heroStage"); if(!wall||reduced||!window.matchMedia("(hover:hover) and (min-width:920px)").matches) return;
  var upgraded=false;
  function upgrade(){
    if(upgraded) return; upgraded=true;
    wall.querySelectorAll(".wall-row:not(.wall-row-far) .wall-tile img").forEach(function(im){ /* the far row stays still pictures: it is blurred anyway */
      var n=(im.getAttribute("src").match(/webp\/(.+)-750\.webp$/)||[])[1]; if(!n) return;
      var v=document.createElement("video"); v.muted=true; v.loop=true; v.playsInline=true; v.preload="metadata"; v.setAttribute("aria-hidden","true");
      v.poster=im.getAttribute("src"); v.src="assets/shots/loops/"+n+".mp4"; v.width=750; v.height=469;
      im.replaceWith(v); v.addEventListener("loadeddata",function(){ v.parentNode.setAttribute("data-loaded",""); });
      v.addEventListener("error",function(){ if(v.parentNode) v.replaceWith(im); }); /* a loop that will not load gives the still picture back */
    });
  }
  var t=document.getElementById("wallToggle"), inView=false;
  function userPaused(){ return !!(t&&t.getAttribute("aria-pressed")==="true"); }
  function playAll(on){ wall.querySelectorAll("video").forEach(function(v){ if(on){ var p=v.play(); if(p&&p.catch) p.catch(function(){}); } else v.pause(); }); }
  /* loops are fetched a little before the wall arrives, and play only while it is actually on screen */
  function soon(){ setTimeout(function(){ upgrade(); playAll(inView&&!userPaused()); },400); }
  if(document.documentElement.classList.contains("sk-on")) new MutationObserver(function(m,o){ if(!document.documentElement.classList.contains("sk-on")){ o.disconnect(); soon(); } }).observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
  else if(document.readyState==="complete") soon(); else addEventListener("load",soon);
  new IntersectionObserver(function(es){ inView=es[0].isIntersecting; if(upgraded) playAll(inView&&!userPaused()); },{threshold:.05}).observe(wall);
  if(t) t.addEventListener("click",function(){ setTimeout(function(){ playAll(inView&&!userPaused()); },0); });
})();

/* loading states: the shimmer stops the moment a picture is in */
document.querySelectorAll(".row .rthumb, .wall-tile img, .door-pic img").forEach(function(im){
  var box=im.classList.contains("rthumb")?im:im.parentNode; function done(){ box.setAttribute("data-loaded",""); }
  if(im.complete&&im.naturalWidth) done(); else { im.addEventListener("load",done); im.addEventListener("error",done); }
});

/* a note for whoever opens the console */
try{ console.log("%cK13 Software Studio","font:600 18px Fraunces,Georgia,serif;color:#1F2023","\nHand-built, one page, no framework, no tracker. Thirteen small 13s are hidden on this page; the footer keeps count. Curious about the code? projects.k13@gmail.com"); }catch(e){}


/* the three stories open in place; one at a time keeps the list readable */
(function(){
  var btns=document.querySelectorAll(".story-btn"); if(!btns.length) return;
  btns.forEach(function(b){ b.addEventListener("click",function(){
    var open=b.getAttribute("aria-expanded")==="true", panel=document.getElementById(b.getAttribute("aria-controls"));
    btns.forEach(function(o){ if(o!==b){ o.setAttribute("aria-expanded","false"); var p=document.getElementById(o.getAttribute("aria-controls")); if(p) p.hidden=true; o.firstChild.textContent="Read the story "; } });
    b.setAttribute("aria-expanded",String(!open)); panel.hidden=open; b.firstChild.textContent=open?"Read the story ":"Close the story ";
    if(!open) panel.querySelectorAll(".rv").forEach(function(r){ r.classList.add("in"); });
  }); });
})();

})();
