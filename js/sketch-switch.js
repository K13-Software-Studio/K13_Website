/* sketch loader switch: before first paint, so the real page never flashes before its mask.
   Plays on every load, reloads included (Kazim, 2026-10-01); a reload starts from the top so the
   hero is what gets drawn. Skipped for reduced motion and deep links. */
try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&!location.hash){document.documentElement.classList.add("sk-on");if("scrollRestoration" in history)history.scrollRestoration="manual";scrollTo(0,0)}}catch(e){}
