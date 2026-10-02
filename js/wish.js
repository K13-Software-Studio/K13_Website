/* ---------- the wish machine (Kazim, verbal, 2026-10-02: "From 'I wish' to 'it works.'") ----------
   The hero performs its motto: a real client wish is typed, the build log ticks, the real shipped
   screen lands with a Live badge and its link, then the next wish. The markup in index.html is already
   the settled final state (the BarFix pair), so first paint, no-JS and reduced motion all show a calm,
   complete composition; this file only adds the journey and the "your turn" box.

   Truth: every project name, link and screen is read from that project's own row in the Work list
   (#w01 ... #w13). The wishes are plain-words paraphrases of what that row or its story says the client
   needed; the build lines and tool chips only restate what the row, its tags or its story already claim.
   Source of each is noted beside it.

   One clock (T) advances only while the machine is allowed to run, so pausing is exact: the user's
   Pause, a hidden tab, the hero off screen, the pointer resting on the machine, or focus inside it.
   Reduced motion never starts the clock. */
(function(){
"use strict";
var wm=document.getElementById("wm"); if(!wm) return;
var reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var $=function(id){ return document.getElementById(id); };
var E={ kind:$("wmKind"), who:$("wmWho"), text:$("wmText"), say:wm.querySelector(".wm-say"), img:$("wmImg"), specs:$("wmSpecs"), chips:$("wmChips"),
  link:$("wmLink"), pend:$("wmPending"), host:$("wmHost"), name:$("wmLinkName"), say2:$("wmAnnounce"), steps:wm.querySelectorAll(".wm-steps li"),
  dot:document.querySelector(".hl-dot"), toggle:$("wallToggle"), form:$("wmForm"), input:$("wmIn"), yours:$("wmYours"), hand:$("wmHand"), back:$("wmBack") };

/* the wishes. row = the Work list row it comes from */
var W=[
  { row:"w10", wish:"I wish somebody counted the bottles at 2am.",                      /* BarFix story: "nobody counts bottles at 2am" */
    specs:["Every bottle steps on a scale","Weight turns into pours","Every change is auditable"],        /* story: scale, counting engine, event-sourced stock */
    chips:["Counting engine","27 passing tests","Row-level security"] },                                  /* story: 27 passing tests, row-level security */
  { row:"w05", wish:"I wish every student could use our market's site, from day one.",   /* Station8 story: "had to work for every student from day one" */
    specs:["The market's team edits it themselves","A bookings form that delivers","A map of the vendors"], /* story: CMS, bookings form, vendor map */
    chips:["Next.js","CMS","Accessible from day one"] },                                                  /* story: Next.js, CMS, accessibility a requirement */
  { row:"w01", wish:"I wish all our restaurants lived under one roof.",                  /* Tiger row: "One roof for a family of restaurant brands" */
    specs:["A flagship with a pin per location","A rebuilt site for every concept","Menus the teams update themselves"], /* story */
    chips:["Maps","Structured data","Catering inbox"] },                                                  /* story: map, structured data, catering enquiries to a real inbox */
  { row:"w04", wish:"I wish my site restocked itself while I'm on stage.",               /* CENGO row: "restocks its own music, mixes, and tour dates" */
    specs:["Music restocks itself","Mixes and tour dates stay current","Nobody touches the code"],        /* row */
    chips:["Artist","Self-updating"] },                                                                   /* row tags */
  { row:"w08", wish:"I wish someone did the cold math on every bet.",                    /* TrustMeBro row: "does the cold math on every wager" */
    specs:["Cold math on every wager","A scoreboard the next morning","Win or lose, it faces it"],       /* row */
    chips:["Data","EV engine"] },                                                                         /* row tags */
  { row:"w03", wish:"I wish our 1938 theatre could open again, online first.",           /* Miramar row: "A 1938 theatre brought back online ... opening night drumroll" */
    specs:["A 1938 theatre, back online","Opening night drumroll included","Reporting for the team"],     /* row + tag Reporting */
    chips:["Brand","Reporting"] }                                                                         /* row tags */
];
W=W.filter(function(w){ var a=$(w.row); if(!a) return false;
  w.name=(a.querySelector(".rname")||{}).textContent||""; w.href=a.href; w.shot=a.getAttribute("data-peek");
  try{ w.host=new URL(a.href).host.replace(/^www\./,""); }catch(e){ w.host=a.href; }
  return !!(w.name&&w.shot); });
if(!W.length) return;

/* ---------- one render for the settled (landed) state ---------- */
function fill(ul,items){ ul.textContent=""; items.forEach(function(t){ var li=document.createElement("li"); li.textContent=t; ul.appendChild(li); }); }
function setShot(w){
  E.img.srcset="assets/shots/webp/"+w.shot+"-750.webp 750w, assets/shots/webp/"+w.shot+"-1500.webp 1500w";
  E.img.src="assets/shots/webp/"+w.shot+"-1500.webp"; }
function setLink(w){ E.link.href=w.href; E.host.textContent=w.host; E.name.textContent=w.name+", live at "; }
function steps(n){ for(var i=0;i<E.steps.length;i++) E.steps[i].classList.toggle("on",i===n); }
function phase(p){ wm.setAttribute("data-phase",p); }
function renderLanded(w){
  E.kind.textContent="A wish"; E.who.textContent=w.name; E.text.textContent=w.wish; E.say.classList.remove("typing");
  fill(E.specs,w.specs); fill(E.chips,w.chips); setShot(w); setLink(w); steps(2); phase("hold"); }

/* ---------- the clock ---------- */
var cur=0, nxt=1, T=-2600, last=0, raf=0, seg=null, total=0, curPhase="hold", typed=-1, started=false;
function plan(n){ var w=W[n], tw=700+w.wish.length*34; nxt=n;
  seg=[["wish",0,tw],["build",tw,tw+2200],["land",tw+2200,tw+3200],["hold",tw+3200,tw+6600]]; total=tw+6600; }
plan(1%W.length);

function enter(p,w){
  curPhase=p;
  if(p==="wish"){ E.kind.textContent="A wish"; E.who.textContent=w.name; E.text.textContent=""; typed=0; E.say.classList.add("typing");
    fill(E.specs,w.specs); fill(E.chips,w.chips); setShot(w); steps(0); E.pend.textContent="Building "+w.name; }
  else if(p==="build"){ E.say.classList.remove("typing"); steps(1); }
  else if(p==="land"){ setLink(w); steps(2); }
  else if(p==="hold"){ E.say2.textContent=w.name+" is live at "+w.host+". The wish was: "+w.wish;
    if(E.dot){ E.dot.classList.remove("ping"); void E.dot.offsetWidth; E.dot.classList.add("ping"); } }
  phase(p);
}
function update(){
  if(T<0) return;
  var w=W[nxt], i, p=seg[seg.length-1][0];
  for(i=0;i<seg.length;i++){ if(T<seg[i][2]){ p=seg[i][0]; break; } }
  if(p!==curPhase) enter(p,w);
  if(p==="wish"){ var n=Math.max(0,Math.min(w.wish.length,Math.floor((T-450)/34)));
    if(n!==typed){ typed=n; E.text.textContent=w.wish.slice(0,n); if(n>0) E.say.classList.remove("typing"); } }
  if(T>=total){ cur=nxt; T-=total; plan((cur+1)%W.length); curPhase="hold"; }
}
function tick(ts){ if(last) T+=Math.min(ts-last,100); last=ts; update(); raf=requestAnimationFrame(tick); }

/* ---------- when is it allowed to run ---------- */
var userPaused=false, inView=true, tabOn=!document.hidden, ptr=false, foc=false, yours=false;
function sync(){
  var run=started&&!reduced&&!userPaused&&inView&&tabOn&&!ptr&&!foc&&!yours;
  wm.classList.toggle("is-paused",!run&&started);
  if(run&&!raf){ last=0; raf=requestAnimationFrame(tick); }
  else if(!run&&raf){ cancelAnimationFrame(raf); raf=0; last=0; }
}
document.addEventListener("visibilitychange",function(){ tabOn=!document.hidden; sync(); });
new IntersectionObserver(function(es){ inView=es[0].isIntersecting; sync(); },{threshold:.15}).observe(wm);
wm.addEventListener("pointerenter",function(e){ if(e.pointerType==="mouse"){ ptr=true; sync(); } });
wm.addEventListener("pointerleave",function(){ ptr=false; sync(); });
wm.addEventListener("focusin",function(){ foc=true; sync(); });
wm.addEventListener("focusout",function(e){ if(!wm.contains(e.relatedTarget)){ foc=false; sync(); } });
/* the single hero Pause (WCAG 2.2.2) lives in the machine's footer and stops the screens behind it too;
   the screens' own handler flips aria-pressed first, so read it on the next turn */
if(E.toggle) E.toggle.addEventListener("click",function(){ setTimeout(function(){ userPaused=E.toggle.getAttribute("aria-pressed")==="true"; sync(); },0); });

/* ---------- your turn: a wish of your own. Nothing is built from it; it travels to the contact form ---------- */
var mine="";
function enterYours(v){
  mine=v; yours=true; sync(); wm.setAttribute("data-mode","yours"); wm.setAttribute("data-phase","wish");
  E.kind.textContent="Your wish"; E.who.textContent="From you"; E.text.textContent=v; E.say.classList.remove("typing"); steps(0);
  E.yours.hidden=false; E.say2.textContent="Your wish is ready. Use Start a project with this wish to send it to us, or go back to the examples.";
  E.hand.focus({preventScroll:true}); }
function leaveYours(){
  yours=false; wm.removeAttribute("data-mode"); E.yours.hidden=true; mine="";
  renderLanded(W[cur]); T=-1400; curPhase="hold"; plan((cur+1)%W.length); sync(); E.input.focus({preventScroll:true}); }
E.form.addEventListener("submit",function(e){
  e.preventDefault(); var v=E.input.value.replace(/\s+/g," ").trim();
  if(!v){ E.say2.textContent="Type a wish first, even a small one."; E.input.focus(); return; }
  enterYours(v); });
E.back.addEventListener("click",leaveYours);
E.hand.addEventListener("click",function(){
  /* the contact stepper listens for this and fills its own "why" field; only scroll once it confirms */
  var why=document.getElementById("sWhy");
  document.dispatchEvent(new CustomEvent("k13:wish",{detail:{text:mine}}));
  if(!why||why.value.trim()!==mine){ E.say2.textContent="Something got in the way. Please use the contact form below and type your wish there."; return; }
  var c=document.getElementById("contact"); if(!c) return;
  var l=window.__k13Lenis; if(l) l.scrollTo(c,{offset:-30,duration:1.2}); else c.scrollIntoView({behavior:reduced?"auto":"smooth"});
  E.say2.textContent="Your wish is in the contact form, ready for your name."; });

/* ---------- start: after the sketch loader lifts, with a beat of the settled composition first ---------- */
function go(){ if(started) return; started=true; sync(); }
var root=document.documentElement;
if(reduced){ /* calm static composition: the BarFix pair, already in the markup */ }
else if(root.classList.contains("sk-on")){
  new MutationObserver(function(m,o){ if(!root.classList.contains("sk-on")){ o.disconnect(); setTimeout(go,300); } }).observe(root,{attributes:true,attributeFilter:["class"]});
} else setTimeout(go,300);
})();
