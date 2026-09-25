/* opening projection: plays once per visit, then hands the real page over.
   Placed at the end of body (after every sibling it needs to inert) so it
   runs the instant parsing reaches here, before the deferred Lenis script
   and the main IIFE below start touching scroll. */
(function(){
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var html = document.documentElement, body = document.body;
  var proj = document.getElementById("k13intro");
  if (!proj) return;

  function releasePage(){
    html.classList.remove("k13-held"); body.classList.remove("k13-held");
    Array.prototype.forEach.call(body.children, function(el){ if (el !== proj) el.inert = false; });
    if (window.__k13Lenis) window.__k13Lenis.start();
  }
  function dropIntro(){ if (proj.parentNode) proj.parentNode.removeChild(proj); }

  var forceReplay = /(^|[?&])intro(=|&|$)/.test(location.search); /* review switch: ?intro replays it */
  var seen = false;
  try { seen = sessionStorage.getItem("k13-projected") === "1"; } catch(e){}
  if (forceReplay) seen = false;

  if (reduce || seen) { releasePage(); dropIntro(); return; }

  /* hold the real page: inert every sibling, not just opacity:0 -- opacity alone leaves it
     focusable and readable to assistive tech, the same mistake that once shipped a contact
     form telling visitors their message sent when nothing had (see project CLAUDE.md). */
  Array.prototype.forEach.call(body.children, function(el){ if (el !== proj) el.inert = true; });

  var v = document.getElementById("k13introVideo");
  var skip = document.getElementById("k13introSkip");
  var dusting = false;

  function lightsUp(){
    if (proj.classList.contains("up")) return;
    proj.classList.add("up"); dusting = false;
    try { sessionStorage.setItem("k13-projected", "1"); } catch(e){}
    releasePage();
    setTimeout(function(){ proj.classList.add("out"); dropIntro(); }, 1500);
  }

  /* dust in the beam: a few dozen slow motes, only inside the cone, cheap to draw.
     (Kept invisible via opacity:0 on .k13intro-dust in both the "on" and "up" states,
     matching the approved prototype exactly -- drawn, but not shown.) */
  var c = document.getElementById("k13introDust"), ctx = c.getContext("2d"), motes = [];
  function size(){ c.width = innerWidth; c.height = innerHeight; motes = [];
    for (var i = 0; i < 70; i++) motes.push({y:Math.random()*c.height, u:Math.random()*2-1, r:.6+Math.random()*1.4, s:.08+Math.random()*.25, a:.15+Math.random()*.45, w:Math.random()*6.28}); }
  size(); addEventListener("resize", size);
  function draw(){
    if (!dusting) return;
    ctx.clearRect(0,0,c.width,c.height);
    var apex = -0.06*c.height, cx = c.width/2, half = Math.min(c.width*.92,1180)/2;
    motes.forEach(function(m){
      var t = (m.y - apex) / (1.2*c.height);
      var x = cx + m.u * half * t + Math.sin(m.w += .004) * 6;
      ctx.beginPath(); ctx.arc(x, m.y, m.r, 0, 6.28);
      ctx.fillStyle = "rgba(255,255,255," + (m.a * (1 - t*.7)).toFixed(2) + ")"; ctx.fill();
      m.y += m.s; if (m.y > c.height + 4) m.y = apex + 10;
    });
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(function(){ proj.classList.add("on"); dusting = true; draw(); });

  /* src/poster set here, not in the markup: preload="none" plus a JS-only src means a
     reduced-motion or already-seen visitor never fetches the 1.1MB film at all. */
  v.src = "assets/intro/k13-statue.mp4";
  v.poster = "assets/intro/k13-statue-first.jpg";
  v.playbackRate = 1.2;
  setTimeout(function(){
    var p = v.play(); if (p && p.catch) p.catch(lightsUp); /* autoplay refused: hand over at once */
  }, 120);
  v.addEventListener("playing", function(){ proj.classList.add("rolling"); }, {once:true});

  var verbs = [[0,"Kneading the clay"],[1.7,"Cutting the block"],[3.6,"Carving the name"],[5.2,"Shaping the hands"],[7.4,"Fitting the glasses"],[9.2,"Sanding the edges"]];
  var verbEl = document.getElementById("k13introVerb"), verbNow = 0;
  function setVerb(text){
    var old = verbEl.querySelector("span:not(.gone)"), nu = document.createElement("span");
    nu.className = "next"; nu.textContent = text; verbEl.appendChild(nu);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      nu.classList.remove("next");
      if (old){ old.classList.add("gone"); setTimeout(function(){ old.remove(); }, 600); }
    }); });
  }
  v.addEventListener("timeupdate", function(){
    if (!v.duration) return;
    var i = 0; verbs.forEach(function(x,k){ if (v.currentTime >= x[0]) i = k; });
    if (i !== verbNow){ verbNow = i; setVerb(verbs[i][1]); }
  });

  v.addEventListener("ended", function(){ setTimeout(lightsUp, 450); });
  v.addEventListener("error", lightsUp);
  setTimeout(lightsUp, 14000); /* hard ceiling */
  skip.addEventListener("click", lightsUp);
  addEventListener("keydown", function(e){ if (e.key === "Escape") lightsUp(); });
  skip.focus({preventScroll:true});
})();
