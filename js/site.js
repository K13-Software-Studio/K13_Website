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
  if(document.documentElement.classList.contains("k13-held")) lenis.stop(); /* opening projection still up: stay stopped until it hands over */
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

/* reveal */
var io=new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); } }); },{threshold:0.16,rootMargin:"0px 0px -8% 0px"});
document.querySelectorAll(".rv").forEach(function(el){ io.observe(el); });
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

/* rotating status feed */
(function(){
  var feed=document.getElementById("feed"); if(!feed||reduced) return;
  var items=[
    "Teaching an AI to actually pay attention in meetings, so people don't have to",
    "Getting five different AI models to agree on what your meeting actually decided",
    "Turning a one hour call into a summary you can read before it ends",
    "Keeping a meeting copilot honest across 1,100 plus commits and counting",
    "Dropping black-and-gold pins across a whole family of restaurants",
    "Giving a restaurant group one online home, without the brands stepping on each other",
    "Putting every location on one map, so a new neighborhood is just one more pin",
    "Making a hospitality group look as considered as the plating",
    "Bottling San Diego sunshine into an all-day kitchen, before a word is read",
    "Making a healthy menu feel like a vacation the moment the page loads",
    "Building a kitchen's site to sell the mood first and the calories never",
    "Turning a 1938 movie theatre into a food hall, online first",
    "Giving an 87 year old theatre a second opening night, this one on the web",
    "Mailing a food hall its own monthly report, no spreadsheet to open",
    "Reopening a cinema as a food hall, the drumroll built right into the scroll",
    "Building a DJ a site that restocks its own mixes overnight",
    "Wiring up an artist's page that updates its own tour dates while he plays",
    "Letting a producer ship new music without ever opening the code",
    "Wiring up a 20,000 square foot public market at UC San Diego",
    "Making twenty thousand square feet of food hall load like a single snack",
    "Building a campus market that every student can use, from day one",
    "Handing a food hall a CMS its team can run without ever calling me",
    "Giving a Little Italy food hall the scroll it deserves",
    "Building a food hall to the exact standard of the designer who shaped the room",
    "Making a menu worth scrolling slowly, the way Sunday dinner is eaten",
    "Crunching live betting math so the odds never quietly short-change you",
    "Building a betting brain brave enough to grade its own picks each morning",
    "Re-pricing a coupon when one leg gets voided, instead of refunding the lot",
    "Doing the cold EV math on every wager, with feelings left at the door",
    "Making a clay and limewash studio look like an art book",
    "Turning a finishing studio into an art book that quietly closes the sale",
    "Selling the feel of a Roman clay wall before anyone touches one",
    "Putting the bar's disappearing whiskey on a scale, and on notice",
    "Turning a bottle's weight into the exact pour, and the exact loss",
    "Giving a bar the honest gap between what it poured and what it sold",
    "Putting every bottle on a scale, so free pours have nowhere left to hide",
    "Letting a buyer spin a 3D lawn before they ever ask what it costs",
    "Turning a turf supplier's catalog into a sales floor that closes quotes",
    "Making artificial grass look worth the drive across San Diego",
    "Giving a sports private equity firm a site as quiet and certain as its thesis",
    "Dressing a sports investment house in ink navy and a single line of brass",
    "Hanging an LA interior studio's rooms online like a gallery, Scandi calm and all",
    "Plating an all day egg kitchen on the web before the first pan is hot",
    "Replacing an architecture office's Excel matrix with something that actually alerts",
    "Showing a project office which job is stuck, who owns it, and for how long",
    "Teaching factory cameras to catch the flaw tired eyes miss",
    "Giving a production line a second set of eyes that never blink",
    "Spotting the bad part before it ever reaches the box",
    "Catching defects at line speed, one frame at a time"
  ];
  for(var j=items.length-1;j>0;j--){var k=Math.floor(Math.random()*(j+1));var t=items[j];items[j]=items[k];items[k]=t;}
  feed.textContent=items[0];
  var i=0,timer=null,paused=false;
  function tick(){ i=(i+1)%items.length; feed.style.opacity=0;
    setTimeout(function(){ feed.textContent=items[i]; feed.style.opacity=1; },420); }
  function start(){ if(!timer) timer=setInterval(tick,3800); }
  function stop(){ clearInterval(timer); timer=null; }
  start();
  var toggle=document.getElementById("feedToggle");
  if(toggle){ toggle.addEventListener("click",function(){
    paused=!paused;
    if(paused){ stop(); toggle.textContent="Play"; toggle.setAttribute("aria-pressed","true"); toggle.setAttribute("aria-label","Resume rotating status text"); }
    else{ start(); toggle.textContent="Pause"; toggle.setAttribute("aria-pressed","false"); toggle.setAttribute("aria-label","Pause rotating status text"); }
  }); }
})();

/* touch / narrow: inject inline screenshot per row (no hover preview there) */
(function(){
  if(!window.matchMedia("(hover:none), (max-width:920px)").matches) return;
  document.querySelectorAll(".row[data-peek]").forEach(function(row){
    if(row.querySelector(".rthumb")) return;
    var im=document.createElement("img");
    im.className="rthumb"; im.loading="lazy"; im.decoding="async"; im.alt="";
    im.src=row.getAttribute("data-peek");
    row.insertBefore(im,row.firstChild);
  });
})();

/* work index cursor preview */
(function(){
  var peek=document.getElementById("peek"), img=document.getElementById("peekImg");
  if(!peek || !window.matchMedia("(hover:hover)").matches) return;
  var tx=0,ty=0,cx=0,cy=0,active=false,raf=null;
  function loop(){ cx+=(tx-cx)*0.18; cy+=(ty-cy)*0.18;
    peek.style.transform="translate("+cx+"px,"+cy+"px) translate(-50%,-50%) scale("+(active?1:.94)+") rotate(-2deg)";
    var moving=Math.abs(tx-cx)>0.5||Math.abs(ty-cy)>0.5;
    raf = (active||moving) ? requestAnimationFrame(loop) : null; }
  function kick(){ if(!raf) raf=requestAnimationFrame(loop); }
  document.querySelectorAll(".row[data-peek]").forEach(function(row){
    row.addEventListener("mouseenter",function(){ var src=row.getAttribute("data-peek"); if(img.getAttribute("src")!==src) img.setAttribute("src",src); active=true; peek.classList.add("on"); kick(); });
    row.addEventListener("mouseleave",function(){ active=false; peek.classList.remove("on"); kick(); });
  });
  document.addEventListener("mousemove",function(e){ tx=e.clientX+150; ty=e.clientY; if(active) kick(); },{passive:true});
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
    parts.forEach(function(p){ var c=document.createElement("button"); c.type="button"; c.className="sc"; c.innerHTML="<b>"+p[0]+"</b>"+p[1];
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
  document.getElementById("sendIt").addEventListener("click",function(){
    data.why=document.getElementById("sWhy").value.trim();
    /* guard: never send/claim success on empty data (e.g. reached here without completing steps 1-2) */
    if(!data.type || !data.name){ go(!data.type?0:1); return; }
    var subject="Project inquiry"+(data.type?": "+data.type:"")+(data.name?" ("+data.name+")":"");
    var body="Hi Kazim,\r\n\r\n"
      +(data.type?"We're building: "+data.type+"\r\n":"")
      +(data.why?"\r\nWhy it matters: "+data.why+"\r\n":"")
      +"\r\n--\r\n"+(data.name||"")+(data.email?"\r\n"+data.email:"");
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
})();
