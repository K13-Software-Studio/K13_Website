/* Homepage door card: the explorable K13 world map. Each pin is a real link into /workbench/#at=<place>, so the
   map works without JavaScript; with it, a tap or click on a pin opens its card (what is there, each place a link) and
   a second one walks in. A mouse hover opens the card too, so one click walks in; keyboard focus opens it, Enter walks in. Plain ES5, no inline styles (CSP). */
(function(){
"use strict";
var root=document.querySelector(".wb-explore"); if(!root) return;
var pins=[].slice.call(root.querySelectorAll(".wb-pin")), infos=[].slice.call(root.querySelectorAll("[data-pin-info]"));
var panel=root.querySelector(".wb-map-panel"), cur="";
var fine=window.matchMedia("(hover:hover) and (pointer:fine)").matches;
if(panel) panel.setAttribute("aria-live","polite");
function show(id){
  if(id===cur) return; cur=id;
  infos.forEach(function(el){ var on=el.getAttribute("data-pin-info")===id; el.hidden=!on; if(on){ el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in"); } });
  pins.forEach(function(p){ var on=p.getAttribute("data-pin")===id; p.classList.toggle("is-on",on); if(on) p.setAttribute("aria-current","true"); else p.removeAttribute("aria-current"); });
}
pins.forEach(function(p){
  var id=p.getAttribute("data-pin");
  /* decide at press time: a press focuses the pin, and focus alone must not count as "already open" */
  var wasOn=null;
  p.addEventListener("pointerdown",function(){ wasOn=(cur===id); });
  p.addEventListener("click",function(e){
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button>0) return;
    var open=wasOn===null?(cur===id):wasOn; wasOn=null;
    if(!open){ e.preventDefault(); show(id); }
  });
  p.addEventListener("focus",function(){ show(id); });
  if(fine) p.addEventListener("mouseenter",function(){ show(id); });
});
})();
