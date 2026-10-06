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
})();
