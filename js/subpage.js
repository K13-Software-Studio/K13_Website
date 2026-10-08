/* K13 sub-pages (workbench/index.html): the few site behaviours a page needs without the homepage's site.js
   (which expects the hero, the stepper and the rest of the homepage). Saved Night shift theme before first paint
   of the cards, header state on scroll, the phone menu, the footer year, the card reveal, and the arcade index.
   The toys and games bring their own scripts. */
(function(){
"use strict";
var html=document.documentElement, reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
try{ if(localStorage.getItem("k13-theme")==="dark") html.setAttribute("data-theme","dark"); }catch(e){}
document.querySelectorAll("[data-current-year]").forEach(function(el){ el.textContent=new Date().getFullYear(); });
var hdr=document.getElementById("hdr");
if(hdr){ var onScroll=function(){ hdr.classList.toggle("scrolled",(window.scrollY||0)>30); }; window.addEventListener("scroll",onScroll,{passive:true}); onScroll(); }
var btn=document.getElementById("menuBtn");
if(btn&&hdr){
  var set=function(on){ hdr.classList.toggle("menu-open",on); btn.setAttribute("aria-expanded",String(on)); btn.textContent=on?"Close":"Menu"; };
  btn.addEventListener("click",function(){ set(btn.getAttribute("aria-expanded")!=="true"); });
  document.querySelectorAll("#siteNav a").forEach(function(a){ a.addEventListener("click",function(){ set(false); }); });
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&hdr.classList.contains("menu-open")){ set(false); btn.focus(); } });
}
/* cards rise in as they arrive, the same .rv / .in contract as the homepage */
var rv=document.querySelectorAll(".rv");
if(reduced||!("IntersectionObserver" in window)) rv.forEach(function(el){ el.classList.add("in"); });
else{
  var io=new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); } }); },{threshold:.12,rootMargin:"0px 0px -6% 0px"});
  rv.forEach(function(el){ io.observe(el); });
  document.addEventListener("focusin",function(e){ var r=e.target.closest&&e.target.closest(".rv"); if(r) r.classList.add("in"); });
}
/* the arcade index: picking a game scrolls to it and hands it keyboard focus, so the eye and the keys land in the same place */
document.querySelectorAll(".arc-index a[href^='#']").forEach(function(a){
  a.addEventListener("click",function(e){
    var card=document.querySelector(a.getAttribute("href")); if(!card) return;
    e.preventDefault(); card.classList.add("in"); card.scrollIntoView({behavior:reduced?"auto":"smooth",block:"start"});
    history.replaceState(null,"",a.getAttribute("href"));
    card.classList.remove("arc-hi"); void card.offsetWidth; if(!reduced) card.classList.add("arc-hi");
    var cv=card.querySelector("canvas[tabindex]"); if(cv) setTimeout(function(){ try{ cv.focus({preventScroll:true}); }catch(x){} },reduced?0:500);
  });
});

/* full screen for every game and toy card (Kazim, 2026-10-06): a button in each card's head puts the whole card on
   the screen; Esc or the same button brings it back. Works in list mode and inside the world's cabinet, where the
   card is moved into the dialog. Hidden where the browser cannot do it (iPhone Safari allows only video). */
function fsEl(){ return document.fullscreenElement||document.webkitFullscreenElement||null; }
function fsEnter(el){ var f=el.requestFullscreen||el.webkitRequestFullscreen; if(!f) return; try{ var r=f.call(el); if(r&&r.catch) r.catch(function(){}); }catch(e){} }
function fsExit(){ var f=document.exitFullscreen||document.webkitExitFullscreen; if(f){ try{ var r=f.call(document); if(r&&r.catch) r.catch(function(){}); }catch(e){} } }
var fsOk=!!(document.fullscreenEnabled||document.webkitFullscreenEnabled);
var FS_IN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
var FS_OUT='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
function fsSync(){
  var cur=fsEl();
  document.querySelectorAll(".wb-fs").forEach(function(b){
    var on=cur&&cur===b.closest(".bench-card");
    b.innerHTML=(on?FS_OUT:FS_IN)+"<span>"+(on?"Exit full screen":"Full screen")+"</span>";
    b.setAttribute("aria-pressed",String(!!on));
  });
  if(cur){ try{ window.dispatchEvent(new Event("resize")); }catch(e){} var cv=cur.querySelector&&cur.querySelector("canvas[tabindex]"); if(cv) setTimeout(function(){ try{ cv.focus({preventScroll:true}); }catch(x){} },60); }
  else setTimeout(function(){ try{ window.dispatchEvent(new Event("resize")); }catch(e){} },60);
}
function fsAdd(){
  if(!fsOk) return;
  document.querySelectorAll(".bench-card .wb-head").forEach(function(h){
    if(h.querySelector(".wb-fs")) return;
    var card=h.closest(".bench-card"); if(!card) return;
    var title=(h.querySelector(".wb-title")||{}).textContent||"this game";
    var b=document.createElement("button"); b.type="button"; b.className="wb-fs"; b.setAttribute("aria-label","Full screen: "+title);
    b.addEventListener("click",function(){ if(fsEl()===card) fsExit(); else fsEnter(card); });
    h.appendChild(b);
  });
  fsSync();
}
document.addEventListener("fullscreenchange",fsSync); document.addEventListener("webkitfullscreenchange",fsSync);
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){ fsAdd(); setTimeout(fsAdd,1500); });
else { fsAdd(); setTimeout(fsAdd,1500); }
})();
