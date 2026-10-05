/* ---------- a picture can never show as the browser's broken-image icon ----------
   Found 2026-10-05 (Kazim, verbal: "some photos don't show"): the wish card swaps its screen with one
   request and nothing watched it, so one failed request (a dev server restarting, a dropped connection)
   left the browser's broken icon on the hero until the next wish. Every picture is a committed file in
   assets/; this guard covers the moment a request still fails.

   For every <img> on the page, including ones scripts add later:
   1. a failed load is tried once more, a moment later, past any cached failure;
   2. if that fails too, the picture is replaced by a placeholder: the project's name on the house grid
      (css/site.css, .img-miss), so there is never a broken icon and never an empty hole;
   3. a later successful load (the wish card moves on to its next wish) puts the picture back. */
(function(){
"use strict";
var RETRY_MS=1200;

/* what the placeholder says: the project's name, read from the markup around the picture */
function nameOf(im){
  var n, t;
  if(im.id==="wmImg"){ n=document.getElementById("wmWho"); return n?n.textContent:""; }
  if((t=im.closest(".wall-tile"))&&(n=t.querySelector("figcaption"))) return n.textContent;
  if((t=im.closest(".row"))&&(n=t.querySelector(".rname"))) return n.textContent;
  if((t=im.closest(".door-btn"))&&(n=t.querySelector(".door-title"))) return n.textContent;
  return im.getAttribute("alt")||"";
}
function fail(im){
  if(im.__miss) return;
  var ph=document.createElement("span"), alt=im.getAttribute("alt");
  ph.className=(im.className?im.className+" ":"")+"img-miss";
  ph.setAttribute("data-name",nameOf(im));
  if(alt){ ph.setAttribute("role","img"); ph.setAttribute("aria-label",alt); } else ph.setAttribute("aria-hidden","true");
  im.parentNode.insertBefore(ph,im);
  im.setAttribute("data-failed",""); im.__miss=ph;
}
function heal(im){
  im.__retry=0;
  if(!im.__miss) return;
  im.__miss.parentNode&&im.__miss.parentNode.removeChild(im.__miss);
  im.__miss=null; im.removeAttribute("data-failed");
}
function onFail(im){
  var src=im.getAttribute("src"); if(!src||!im.parentNode) return;
  if(im.__retry){ fail(im); return; }
  im.__retry=1;
  setTimeout(function(){
    im.loading="eager"; im.removeAttribute("srcset");
    im.src=src.split("?")[0]+"?r="+Date.now(); },RETRY_MS);
}

/* error and load do not bubble, so listen while they travel down */
document.addEventListener("error",function(e){ var im=e.target; if(im&&im.tagName==="IMG") onFail(im); },true);
document.addEventListener("load",function(e){ var im=e.target; if(im&&im.tagName==="IMG") heal(im); },true);

/* a picture that already failed before this script ran */
function scan(){
  Array.prototype.forEach.call(document.images,function(im){
    if(im.complete&&!im.naturalWidth&&im.getAttribute("src")&&!im.hasAttribute("data-failed")) onFail(im); });
}
document.addEventListener("DOMContentLoaded",scan);
window.addEventListener("load",scan);
})();
