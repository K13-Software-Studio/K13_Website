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
    "Handing a food hall a CMS its team can run without ever calling us",
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
    "Catching defects at line speed, one frame at a time",
    "Moving a seafood kitchen off a rented menu platform, onto a site it finally owns",
    "Serving smash burgers loud, on a site you can almost taste from the couch",
    "Building a living memorial for the painter who made Los Angeles a dream of fire",
    "Rebuilding a marine brand's site on spec, to show them what it could be",
    "Giving a hood cleaning crew one screen for every customer and every job",
    "Putting every conversation a tattoo studio has into one inbox, one phone number",
    "Opening a merch drop store with no framework and no backend, just a cart that works",
    "Modelling every deal four ways for a private investment club, downside first",
    "Keeping a founder's cards, statements and credit score on one quiet screen",
    "Helping a friend pull whole playlists down without the busywork",
    "Teaching an affiliate video pipeline to skip the day when nothing is good enough",
    "Running the whole studio from one board that says out loud when it's stale",
    "Collecting the best interface details on the web, with honest provenance",
    "Turning the studio's characters into a small 3D office"
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
    im.src="assets/shots/webp/"+row.getAttribute("data-peek")+"-750.webp";
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
    row.addEventListener("mouseenter",function(){ var src="assets/shots/webp/"+row.getAttribute("data-peek")+"-1500.webp"; if(img.getAttribute("src")!==src) img.setAttribute("src",src); active=true; peek.classList.add("on"); kick(); });
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
    var w=window.open(url,"_blank","noopener");
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

/* the lockup gets one sheen the moment the opening hands the page over */
(function(){
  var brand=document.querySelector(".brand"); if(!brand||reduced) return;
  var html=document.documentElement;
  function fire(){ brand.classList.add("sheen","sheen-once"); setTimeout(function(){ brand.classList.remove("sheen-once"); },1200); }
  if(!html.classList.contains("k13-held")){ setTimeout(fire,700); return; }
  new MutationObserver(function(m,o){ if(!html.classList.contains("k13-held")){ o.disconnect(); setTimeout(fire,500); } }).observe(html,{attributes:true,attributeFilter:["class"]});
})();

/* the hunt: six of the thirteen hidden marks live in this page's own markup; the workbench places them */
document.addEventListener("DOMContentLoaded",function(){
  if(!(window.K13&&window.K13.hunt&&window.K13.hunt.place)) return;
  document.querySelectorAll("[data-hunt]").forEach(function(el){ window.K13.hunt.place(el); });
});


/* wall of work: pause control (it moves for longer than five seconds), and it rests when off screen */
(function(){
  var wall=document.getElementById("wall"), t=document.getElementById("wallToggle"); if(!wall||!t) return;
  var user=false;
  t.addEventListener("click",function(){ user=!user; wall.classList.toggle("paused",user); t.setAttribute("aria-pressed",String(user)); t.textContent=user?"Play the wall":"Pause the wall"; });
  new IntersectionObserver(function(es){ if(!user) wall.classList.toggle("paused",!es[0].isIntersecting); }).observe(wall);
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

})();
